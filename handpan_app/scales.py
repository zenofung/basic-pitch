#!/usr/bin/env python3
"""
Handpan Scale Definitions

Each scale defines:
  - name: Display name
  - root: Root note name
  - notes: List of MIDI note numbers on the handpan
  - note_names: Corresponding note names (e.g., "D3", "A3")
  - positions: Physical position names on the handpan (Ding, Tone 1-8, etc.)

Common handpan layout:
  - Ding (center, bottom note / root)
  - Tone 1-8 (surrounding notes, ascending)
  - Some handpans have 9-10 tone fields or additional bottom notes (Gu)
"""

from typing import Dict, List, Optional, Tuple
import json


# MIDI note number reference:
# C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55, A3 = 57, B3 = 59
# C4 = 60 (Middle C), D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71
# C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79, A5 = 81


HANDPAN_SCALES = {
    "d_kurd_9": {
        "name": "D Kurd 9",
        "description": "最常见的手碟音阶，忧郁深沉",
        "root": "D3",
        "notes": [50, 57, 58, 60, 62, 64, 65, 67, 69],
        "note_names": ["D3", "A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "d_celtic_minor": {
        "name": "D Celtic Minor",
        "description": "凯尔特风格，空灵神秘",
        "root": "D3",
        "notes": [50, 57, 60, 62, 64, 67, 69, 72, 74],
        "note_names": ["D3", "A3", "C4", "D4", "E4", "G4", "A4", "C5", "D5"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "c_sharp_amara": {
        "name": "C# Amara / Integral",
        "description": "温暖柔和的大调音阶",
        "root": "C#3",
        "notes": [49, 56, 58, 61, 63, 66, 68, 70, 73],
        "note_names": ["C#3", "Ab3", "Bb3", "Db4", "Eb4", "Gb4", "Ab4", "Bb4", "Db5"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "d_amara": {
        "name": "D Amara",
        "description": "大调音阶，明亮欢快",
        "root": "D3",
        "notes": [50, 57, 60, 62, 64, 66, 69, 72, 74],
        "note_names": ["D3", "A3", "C4", "D4", "E4", "F#4", "A4", "C5", "D5"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "d_minor_pentatonic": {
        "name": "D Minor Pentatonic",
        "description": "小调五声音阶，东方韵味",
        "root": "D3",
        "notes": [50, 53, 55, 57, 60, 62, 65, 67, 69],
        "note_names": ["D3", "F3", "G3", "A3", "C4", "D4", "F4", "G4", "A4"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "e_kurd_9": {
        "name": "E Kurd 9",
        "description": "E 调 Kurd，比 D Kurd 高一个全音",
        "root": "E3",
        "notes": [52, 59, 60, 62, 64, 66, 67, 69, 71],
        "note_names": ["E3", "B3", "C4", "D4", "E4", "F#4", "G4", "A4", "B4"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "f_pygmy": {
        "name": "F Pygmy",
        "description": "Pygmy 音阶，非洲韵味",
        "root": "F3",
        "notes": [53, 60, 63, 65, 67, 72, 75, 77, 79],
        "note_names": ["F3", "C4", "Eb4", "F4", "G4", "C5", "Eb5", "F5", "G5"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "d_hijaz": {
        "name": "D Hijaz",
        "description": "中东风格音阶，异域风情",
        "root": "D3",
        "notes": [50, 57, 58, 61, 62, 64, 65, 67, 69],
        "note_names": ["D3", "A3", "Bb3", "C#4", "D4", "E4", "F4", "G4", "A4"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "c_aegean": {
        "name": "C Aegean",
        "description": "Aegean 音阶，地中海风情",
        "root": "C3",
        "notes": [48, 55, 57, 60, 62, 63, 67, 69, 72],
        "note_names": ["C3", "G3", "A3", "C4", "D4", "Eb4", "G4", "A4", "C5"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
    "g_oxalis": {
        "name": "G Oxalis",
        "description": "明亮的大调音阶",
        "root": "G3",
        "notes": [55, 59, 62, 64, 67, 69, 71, 74, 76],
        "note_names": ["G3", "B3", "D4", "E4", "G4", "A4", "B4", "D5", "E5"],
        "positions": ["Ding", "Tone 1", "Tone 2", "Tone 3", "Tone 4", "Tone 5", "Tone 6", "Tone 7", "Tone 8"],
    },
}


MIDI_NOTE_NAMES = {
    21: "A0", 22: "Bb0", 23: "B0",
    24: "C1", 25: "C#1", 26: "D1", 27: "Eb1", 28: "E1", 29: "F1",
    30: "F#1", 31: "G1", 32: "Ab1", 33: "A1", 34: "Bb1", 35: "B1",
    36: "C2", 37: "C#2", 38: "D2", 39: "Eb2", 40: "E2", 41: "F2",
    42: "F#2", 43: "G2", 44: "Ab2", 45: "A2", 46: "Bb2", 47: "B2",
    48: "C3", 49: "C#3", 50: "D3", 51: "Eb3", 52: "E3", 53: "F3",
    54: "F#3", 55: "G3", 56: "Ab3", 57: "A3", 58: "Bb3", 59: "B3",
    60: "C4", 61: "C#4", 62: "D4", 63: "Eb4", 64: "E4", 65: "F4",
    66: "F#4", 67: "G4", 68: "Ab4", 69: "A4", 70: "Bb4", 71: "B4",
    72: "C5", 73: "C#5", 74: "D5", 75: "Eb5", 76: "E5", 77: "F5",
    78: "F#5", 79: "G5", 80: "Ab5", 81: "A5", 82: "Bb5", 83: "B5",
    84: "C6", 85: "C#6", 86: "D6", 87: "Eb6", 88: "E6", 89: "F6",
    90: "F#6", 91: "G6", 92: "Ab6", 93: "A6", 94: "Bb6", 95: "B6",
    96: "C7",
}


def get_scale_info(scale_key: str) -> Optional[Dict]:
    """Get scale info by key."""
    return HANDPAN_SCALES.get(scale_key)


def get_all_scales() -> Dict:
    """Return all available scales."""
    return HANDPAN_SCALES


def midi_to_note_name(midi_num: int) -> str:
    """Convert MIDI note number to note name."""
    return MIDI_NOTE_NAMES.get(midi_num, f"MIDI_{midi_num}")


def snap_to_scale(midi_note: int, scale_notes: List[int], tolerance: int = 1) -> Optional[Tuple[int, str, str]]:
    """
    Snap a detected MIDI note to the nearest note in the handpan scale.

    Args:
        midi_note: Detected MIDI note number
        scale_notes: List of MIDI note numbers in the handpan scale
        tolerance: Maximum semitones difference to consider a match

    Returns:
        Tuple of (snapped_midi, note_name, position_name) or None if no match
    """
    if not scale_notes:
        return None

    # Find the closest note in the scale
    distances = [abs(midi_note - sn) for sn in scale_notes]
    min_dist = min(distances)

    if min_dist > tolerance:
        return None

    idx = distances.index(min_dist)
    snapped_midi = scale_notes[idx]

    return snapped_midi, midi_to_note_name(snapped_midi), idx


def map_notes_to_handpan(
    note_events: List[Tuple],
    scale_key: str,
    custom_notes: Optional[List[int]] = None,
    tolerance: int = 1,
) -> List[Dict]:
    """
    Map detected note events to handpan positions.

    Args:
        note_events: List of (start_time, end_time, pitch_midi, velocity, pitch_bend)
        scale_key: Key of the handpan scale to use
        custom_notes: Optional custom MIDI notes (overrides scale_key)
        tolerance: Semitone tolerance for snapping

    Returns:
        List of handpan note event dicts
    """
    if custom_notes:
        scale_notes = custom_notes
        positions = [f"Note {i+1}" for i in range(len(custom_notes))]
        note_names = [midi_to_note_name(n) for n in custom_notes]
    else:
        scale = HANDPAN_SCALES.get(scale_key)
        if not scale:
            raise ValueError(f"Unknown scale: {scale_key}")
        scale_notes = scale["notes"]
        positions = scale["positions"]
        note_names = scale["note_names"]

    results = []
    for event in note_events:
        start_time, end_time, pitch_midi, velocity = event[0], event[1], event[2], event[3]
        pitch_bend = event[4] if len(event) > 4 else None

        match = snap_to_scale(pitch_midi, scale_notes, tolerance)
        if match:
            snapped_midi, note_name, idx = match
            results.append({
                "start_time": round(float(start_time), 4),
                "end_time": round(float(end_time), 4),
                "duration": round(float(end_time - start_time), 4),
                "original_midi": int(pitch_midi),
                "snapped_midi": int(snapped_midi),
                "note_name": note_names[idx] if idx < len(note_names) else note_name,
                "position": positions[idx] if idx < len(positions) else f"Note {idx+1}",
                "velocity": int(round(float(velocity) * 127)) if float(velocity) <= 1.0 else int(float(velocity)),
                "confidence": round(1.0 - abs(pitch_midi - snapped_midi) / max(tolerance, 1), 2),
            })
        else:
            # Include unmatched notes with a flag
            results.append({
                "start_time": round(float(start_time), 4),
                "end_time": round(float(end_time), 4),
                "duration": round(float(end_time - start_time), 4),
                "original_midi": int(pitch_midi),
                "snapped_midi": None,
                "note_name": midi_to_note_name(pitch_midi),
                "position": "Unknown",
                "velocity": int(round(float(velocity) * 127)) if float(velocity) <= 1.0 else int(float(velocity)),
                "confidence": 0.0,
            })

    # Sort by start time
    results.sort(key=lambda x: x["start_time"])
    return results
