#!/usr/bin/env python3
"""
Handpan Transcription Web Server

Flask-based backend that:
1. Accepts audio file uploads
2. Runs basic-pitch inference for audio-to-MIDI transcription
3. Maps detected notes to handpan scale positions
4. Returns structured JSON results for the frontend
"""

import os
import sys
import json
import uuid
import pathlib
import traceback
import tempfile
import logging
import numpy as np
from typing import Optional, List

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS

# Add parent directory to path so we can import basic_pitch
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from handpan_app.scales import (
    HANDPAN_SCALES,
    map_notes_to_handpan,
    get_all_scales,
    midi_to_note_name,
)


class NumpyJSONEncoder(json.JSONEncoder):
    """JSON encoder that handles numpy types."""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="static", static_url_path="")
app.json_encoder = NumpyJSONEncoder
CORS(app)

# Configure upload settings
UPLOAD_FOLDER = tempfile.mkdtemp(prefix="handpan_")
ALLOWED_EXTENSIONS = {"wav", "mp3", "flac", "ogg", "m4a", "aac", "wma", "aiff"}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/scales", methods=["GET"])
def list_scales():
    """Return all available handpan scales."""
    scales = get_all_scales()
    result = {}
    for key, scale in scales.items():
        result[key] = {
            "name": scale["name"],
            "description": scale["description"],
            "root": scale["root"],
            "notes": scale["notes"],
            "note_names": scale["note_names"],
            "positions": scale["positions"],
        }
    return jsonify(result)


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    """
    Transcribe an uploaded audio file.

    Form data:
      - audio: The audio file
      - scale: Scale key (e.g., "d_kurd_9") or "custom"
      - custom_notes: JSON array of MIDI note numbers (when scale=="custom")
      - tolerance: Semitone tolerance for note snapping (default: 1)
      - onset_threshold: Onset detection threshold (default: 0.5)
      - frame_threshold: Frame detection threshold (default: 0.3)
      - min_note_length: Minimum note length in ms (default: 80)
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    file = request.files["audio"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Unsupported file format. Supported: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    # Parse parameters
    scale_key = request.form.get("scale", "d_kurd_9")
    tolerance = int(request.form.get("tolerance", "1"))
    onset_threshold = float(request.form.get("onset_threshold", "0.5"))
    frame_threshold = float(request.form.get("frame_threshold", "0.3"))
    min_note_length = float(request.form.get("min_note_length", "80"))

    custom_notes = None
    if scale_key == "custom":
        custom_notes_str = request.form.get("custom_notes", "[]")
        try:
            custom_notes = json.loads(custom_notes_str)
            if not custom_notes:
                return jsonify({"error": "Custom scale must have at least one note"}), 400
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid custom_notes format"}), 400

    # Save uploaded file
    file_ext = file.filename.rsplit(".", 1)[1].lower()
    temp_filename = f"{uuid.uuid4().hex}.{file_ext}"
    temp_path = os.path.join(UPLOAD_FOLDER, temp_filename)

    try:
        file.save(temp_path)
        logger.info(f"Saved uploaded file to {temp_path}")

        # Import and run basic-pitch inference
        from basic_pitch.inference import predict, Model
        from basic_pitch import ICASSP_2022_MODEL_PATH

        # Get the scale's frequency range for filtering
        if custom_notes:
            import librosa
            min_freq = librosa.midi_to_hz(min(custom_notes) - 2)
            max_freq = librosa.midi_to_hz(max(custom_notes) + 2)
        elif scale_key in HANDPAN_SCALES:
            import librosa
            scale = HANDPAN_SCALES[scale_key]
            min_freq = librosa.midi_to_hz(min(scale["notes"]) - 2)
            max_freq = librosa.midi_to_hz(max(scale["notes"]) + 2)
        else:
            min_freq = None
            max_freq = None

        logger.info(f"Running inference with onset_thresh={onset_threshold}, frame_thresh={frame_threshold}")

        model_output, midi_data, note_events = predict(
            audio_path=temp_path,
            onset_threshold=onset_threshold,
            frame_threshold=frame_threshold,
            minimum_note_length=min_note_length,
            minimum_frequency=min_freq,
            maximum_frequency=max_freq,
            multiple_pitch_bends=False,
            melodia_trick=True,
        )

        logger.info(f"Detected {len(note_events)} raw note events")

        # Map to handpan positions
        handpan_notes = map_notes_to_handpan(
            note_events,
            scale_key=scale_key,
            custom_notes=custom_notes,
            tolerance=tolerance,
        )

        # Save MIDI to temp for download
        midi_filename = f"{uuid.uuid4().hex}.mid"
        midi_path = os.path.join(UPLOAD_FOLDER, midi_filename)
        midi_data.write(midi_path)

        # Build statistics
        matched = [n for n in handpan_notes if n["snapped_midi"] is not None]
        unmatched = [n for n in handpan_notes if n["snapped_midi"] is None]

        # Count note distribution
        note_distribution = {}
        for n in matched:
            pos = n["position"]
            if pos not in note_distribution:
                note_distribution[pos] = {
                    "count": 0,
                    "note_name": n["note_name"],
                    "midi": n["snapped_midi"],
                }
            note_distribution[pos]["count"] += 1

        # Get scale info for response
        if custom_notes:
            scale_info = {
                "name": "Custom Scale",
                "notes": custom_notes,
                "note_names": [midi_to_note_name(n) for n in custom_notes],
                "positions": [f"Note {i+1}" for i in range(len(custom_notes))],
            }
        else:
            scale_info = HANDPAN_SCALES.get(scale_key, {})

        response = {
            "success": True,
            "midi_download": f"/api/download/{midi_filename}",
            "scale": scale_info,
            "total_notes": len(note_events),
            "matched_notes": len(matched),
            "unmatched_notes": len(unmatched),
            "note_distribution": note_distribution,
            "notes": handpan_notes,
            "duration": round(max((n["end_time"] for n in handpan_notes), default=0), 2),
        }

        return jsonify(response)

    except Exception as e:
        logger.error(f"Transcription error: {traceback.format_exc()}")
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500

    finally:
        # Cleanup audio file (keep MIDI for download)
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.route("/api/download/<filename>", methods=["GET"])
def download_midi(filename):
    """Download a generated MIDI file."""
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    return send_file(file_path, as_attachment=True, download_name="handpan_transcription.mid")


if __name__ == "__main__":
    print("")
    print("🥁✨ Handpan Transcriber ✨🥁")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print("Starting server at http://localhost:5555")
    print("")
    app.run(host="0.0.0.0", port=5555, debug=True)
