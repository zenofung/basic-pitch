/**
 * Handpan Transcriber - Frontend Application
 *
 * Handles:
 * - Audio file upload via drag & drop or file picker
 * - Scale selection and preview (with handpan diagram)
 * - API communication for transcription
 * - Result rendering: stats, note distribution, timeline (canvas), events table
 */

(function () {
  "use strict";

  // ---- DOM Elements ----
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const fileInfo = document.getElementById("fileInfo");
  const fileName = document.getElementById("fileName");
  const fileSize = document.getElementById("fileSize");
  const removeFile = document.getElementById("removeFile");
  const audioPlayerContainer = document.getElementById("audioPlayerContainer");
  const audioPlayer = document.getElementById("audioPlayer");

  const scaleSelect = document.getElementById("scaleSelect");
  const customNotesGroup = document.getElementById("customNotesGroup");
  const customNotes = document.getElementById("customNotes");
  const tolerance = document.getElementById("tolerance");
  const toleranceValue = document.getElementById("toleranceValue");
  const onsetThreshold = document.getElementById("onsetThreshold");
  const onsetValue = document.getElementById("onsetValue");
  const frameThreshold = document.getElementById("frameThreshold");
  const frameValue = document.getElementById("frameValue");
  const minNoteLength = document.getElementById("minNoteLength");
  const minNoteLenValue = document.getElementById("minNoteLenValue");

  const scalePreview = document.getElementById("scalePreview");
  const handpanDiagram = document.getElementById("handpanDiagram");
  const transcribeBtn = document.getElementById("transcribeBtn");

  const uploadSection = document.getElementById("uploadSection");
  const loadingSection = document.getElementById("loadingSection");
  const resultsSection = document.getElementById("resultsSection");
  const errorSection = document.getElementById("errorSection");

  const statTotal = document.getElementById("statTotal");
  const statMatched = document.getElementById("statMatched");
  const statUnmatched = document.getElementById("statUnmatched");
  const statDuration = document.getElementById("statDuration");

  const distributionChart = document.getElementById("distributionChart");
  const timelineCanvas = document.getElementById("timelineCanvas");
  const eventsBody = document.getElementById("eventsBody");

  const downloadMidi = document.getElementById("downloadMidi");
  const newAnalysis = document.getElementById("newAnalysis");
  const retryBtn = document.getElementById("retryBtn");
  const errorMessage = document.getElementById("errorMessage");

  const stepLoad = document.getElementById("stepLoad");
  const stepInfer = document.getElementById("stepInfer");
  const stepMap = document.getElementById("stepMap");

  let selectedFile = null;
  let scalesData = {};
  let lastResult = null;
  let timelineFilter = "all";

  // ---- Initialize ----
  async function init() {
    await loadScales();
    bindEvents();
  }

  // ---- Load Scales from API ----
  async function loadScales() {
    try {
      const res = await fetch("/api/scales");
      scalesData = await res.json();
      populateScaleSelect();
    } catch (e) {
      console.error("Failed to load scales:", e);
      scaleSelect.innerHTML = '<option value="d_kurd_9">D Kurd 9 (默认)</option>';
    }
  }

  function populateScaleSelect() {
    scaleSelect.innerHTML = "";
    for (const [key, scale] of Object.entries(scalesData)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${scale.name} — ${scale.description}`;
      scaleSelect.appendChild(opt);
    }
    // Add custom option
    const customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.textContent = "🎛️ 自定义音阶...";
    scaleSelect.appendChild(customOpt);

    scaleSelect.value = "d_kurd_9";
    renderScalePreview("d_kurd_9");
  }

  // ---- Bind Events ----
  function bindEvents() {
    // File upload
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileSelect);
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () =>
      dropZone.classList.remove("drag-over")
    );
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      if (e.dataTransfer.files.length) {
        setFile(e.dataTransfer.files[0]);
      }
    });
    removeFile.addEventListener("click", clearFile);

    // Scale selection
    scaleSelect.addEventListener("change", () => {
      const val = scaleSelect.value;
      customNotesGroup.style.display = val === "custom" ? "flex" : "none";
      if (val !== "custom") {
        renderScalePreview(val);
      } else {
        handpanDiagram.innerHTML =
          '<p style="color: var(--text-muted); font-size: 0.85rem;">请在上方输入自定义音符</p>';
      }
    });

    // Custom notes preview
    customNotes.addEventListener("input", () => {
      try {
        const notes = customNotes.value
          .split(",")
          .map((n) => parseInt(n.trim()))
          .filter((n) => !isNaN(n));
        if (notes.length > 0) {
          renderCustomPreview(notes);
        }
      } catch (e) {
        /* ignore */
      }
    });

    // Range sliders
    tolerance.addEventListener("input", () => (toleranceValue.textContent = tolerance.value));
    onsetThreshold.addEventListener("input", () => (onsetValue.textContent = parseFloat(onsetThreshold.value).toFixed(2)));
    frameThreshold.addEventListener("input", () => (frameValue.textContent = parseFloat(frameThreshold.value).toFixed(2)));
    minNoteLength.addEventListener("input", () => (minNoteLenValue.textContent = minNoteLength.value));

    // Transcribe
    transcribeBtn.addEventListener("click", doTranscribe);

    // Timeline filter buttons
    document.getElementById("btnTimelineAll").addEventListener("click", () => {
      timelineFilter = "all";
      document.getElementById("btnTimelineAll").classList.add("active");
      document.getElementById("btnTimelineMatched").classList.remove("active");
      if (lastResult) renderTimeline(lastResult);
    });
    document.getElementById("btnTimelineMatched").addEventListener("click", () => {
      timelineFilter = "matched";
      document.getElementById("btnTimelineMatched").classList.add("active");
      document.getElementById("btnTimelineAll").classList.remove("active");
      if (lastResult) renderTimeline(lastResult);
    });

    // New analysis
    newAnalysis.addEventListener("click", resetToUpload);
    retryBtn.addEventListener("click", resetToUpload);
  }

  // ---- File Handling ----
  function handleFileSelect(e) {
    if (e.target.files.length) {
      setFile(e.target.files[0]);
    }
  }

  function setFile(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove("hidden");
    dropZone.style.display = "none";
    transcribeBtn.disabled = false;

    // Show audio player
    const url = URL.createObjectURL(file);
    audioPlayer.src = url;
    audioPlayerContainer.classList.remove("hidden");
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = "";
    fileInfo.classList.add("hidden");
    dropZone.style.display = "";
    audioPlayerContainer.classList.add("hidden");
    audioPlayer.src = "";
    transcribeBtn.disabled = true;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // ---- Scale Preview (Handpan Diagram) ----
  function renderScalePreview(scaleKey) {
    const scale = scalesData[scaleKey];
    if (!scale) return;

    handpanDiagram.innerHTML = "";
    const positions = getHandpanPositions(scale.notes.length);

    scale.notes.forEach((midi, i) => {
      const div = document.createElement("div");
      div.className = "hp-note" + (i === 0 ? " ding" : "");
      div.innerHTML = `<span>${scale.note_names[i]}</span><span class="note-pos">${scale.positions[i]}</span>`;
      div.style.left = positions[i].x + "px";
      div.style.top = positions[i].y + "px";
      handpanDiagram.appendChild(div);
    });
  }

  function renderCustomPreview(notes) {
    handpanDiagram.innerHTML = "";
    const midiNames = {
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
    };

    const positions = getHandpanPositions(notes.length);
    notes.forEach((midi, i) => {
      const div = document.createElement("div");
      div.className = "hp-note" + (i === 0 ? " ding" : "");
      const name = midiNames[midi] || `M${midi}`;
      const pos = i === 0 ? "Ding" : `Tone ${i}`;
      div.innerHTML = `<span>${name}</span><span class="note-pos">${pos}</span>`;
      div.style.left = positions[i].x + "px";
      div.style.top = positions[i].y + "px";
      handpanDiagram.appendChild(div);
    });
  }

  function getHandpanPositions(count) {
    const cx = 110,
      cy = 110;
    const r = 95;
    const positions = [];

    // Center (Ding)
    positions.push({ x: cx - 29, y: cy - 29 });

    // Surrounding notes in a circle
    const surrounding = count - 1;
    for (let i = 0; i < surrounding; i++) {
      const angle = (2 * Math.PI * i) / surrounding - Math.PI / 2;
      positions.push({
        x: cx + r * Math.cos(angle) - 29,
        y: cy + r * Math.sin(angle) - 29,
      });
    }

    return positions;
  }

  // ---- Transcription ----
  async function doTranscribe() {
    if (!selectedFile) return;

    showSection("loading");

    // Animate loading steps
    stepLoad.classList.add("active");
    stepInfer.classList.remove("active", "done");
    stepMap.classList.remove("active", "done");

    const formData = new FormData();
    formData.append("audio", selectedFile);
    formData.append("scale", scaleSelect.value);
    formData.append("tolerance", tolerance.value);
    formData.append("onset_threshold", onsetThreshold.value);
    formData.append("frame_threshold", frameThreshold.value);
    formData.append("min_note_length", minNoteLength.value);

    if (scaleSelect.value === "custom") {
      formData.append("custom_notes", JSON.stringify(
        customNotes.value.split(",").map((n) => parseInt(n.trim())).filter((n) => !isNaN(n))
      ));
    }

    try {
      // Step 1: Upload
      setTimeout(() => {
        stepLoad.classList.remove("active");
        stepLoad.classList.add("done");
        stepInfer.classList.add("active");
      }, 500);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      // Step 2 -> 3
      stepInfer.classList.remove("active");
      stepInfer.classList.add("done");
      stepMap.classList.add("active");

      await new Promise((r) => setTimeout(r, 300));
      stepMap.classList.remove("active");
      stepMap.classList.add("done");

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Transcription failed");
      }

      lastResult = data;
      showResults(data);
    } catch (e) {
      showError(e.message);
    }
  }

  // ---- Display Results ----
  function showResults(data) {
    showSection("results");

    // Stats
    statTotal.textContent = data.total_notes;
    statMatched.textContent = data.matched_notes;
    statUnmatched.textContent = data.unmatched_notes;
    statDuration.textContent = data.duration + "s";

    // Distribution
    renderDistribution(data);

    // Timeline
    renderTimeline(data);

    // Table
    renderEventsTable(data);

    // MIDI download
    downloadMidi.href = data.midi_download;

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderDistribution(data) {
    distributionChart.innerHTML = "";

    const dist = data.note_distribution;
    const entries = Object.entries(dist);
    if (entries.length === 0) {
      distributionChart.innerHTML =
        '<p style="color: var(--text-muted);">无匹配音符</p>';
      return;
    }

    const maxCount = Math.max(...entries.map(([, v]) => v.count));

    entries.forEach(([pos, info]) => {
      const group = document.createElement("div");
      group.className = "dist-bar-group";

      const barHeight = Math.max((info.count / maxCount) * 120, 6);
      const bar = document.createElement("div");
      bar.className = "dist-bar";
      bar.style.height = barHeight + "px";
      bar.innerHTML = `<span class="bar-count">${info.count}</span>`;

      const label = document.createElement("div");
      label.className = "dist-label";
      label.innerHTML = `${info.note_name}<br>${pos}`;

      group.appendChild(bar);
      group.appendChild(label);
      distributionChart.appendChild(group);
    });
  }

  function renderTimeline(data) {
    const notes =
      timelineFilter === "matched"
        ? data.notes.filter((n) => n.snapped_midi !== null)
        : data.notes;

    if (notes.length === 0) {
      timelineCanvas.width = 0;
      timelineCanvas.height = 0;
      return;
    }

    const ctx = timelineCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    // Dimensions
    const containerWidth = timelineCanvas.parentElement.clientWidth - 16;
    const duration = data.duration || 1;
    const pixelsPerSecond = Math.max(80, containerWidth / duration);
    const canvasWidth = Math.max(containerWidth, duration * pixelsPerSecond + 80);
    const leftPadding = 60;

    // Get MIDI range
    const midiNotes = notes.map((n) => n.snapped_midi || n.original_midi);
    const minMidi = Math.min(...midiNotes) - 1;
    const maxMidi = Math.max(...midiNotes) + 1;
    const midiRange = maxMidi - minMidi + 1;
    const rowHeight = Math.max(16, Math.min(28, 200 / midiRange));
    const canvasHeight = midiRange * rowHeight + 60;

    timelineCanvas.style.width = canvasWidth + "px";
    timelineCanvas.style.height = canvasHeight + "px";
    timelineCanvas.width = canvasWidth * dpr;
    timelineCanvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#141722";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;

    // Horizontal grid (MIDI pitches)
    for (let i = 0; i <= midiRange; i++) {
      const y = canvasHeight - 30 - i * rowHeight;
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();

      // Label
      const midi = minMidi + i;
      const midiNames = {
        48:"C3", 49:"C#3", 50:"D3", 51:"Eb3", 52:"E3", 53:"F3",
        54:"F#3", 55:"G3", 56:"Ab3", 57:"A3", 58:"Bb3", 59:"B3",
        60:"C4", 61:"C#4", 62:"D4", 63:"Eb4", 64:"E4", 65:"F4",
        66:"F#4", 67:"G4", 68:"Ab4", 69:"A4", 70:"Bb4", 71:"B4",
        72:"C5", 73:"C#5", 74:"D5", 75:"Eb5", 76:"E5", 77:"F5",
        78:"F#5", 79:"G5", 80:"Ab5", 81:"A5",
      };
      ctx.fillStyle = "#5c6378";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(midiNames[midi] || midi.toString(), leftPadding - 8, y + 4);
    }

    // Vertical grid (time)
    const timeStep = duration > 30 ? 5 : duration > 10 ? 2 : 1;
    for (let t = 0; t <= duration; t += timeStep) {
      const x = leftPadding + t * pixelsPerSecond;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight - 30);
      ctx.stroke();

      ctx.fillStyle = "#5c6378";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t + "s", x, canvasHeight - 12);
    }

    // Draw notes
    const goldColors = [
      "#c9a243", "#d4b45c", "#e8d18a", "#b8912e",
      "#9a7824", "#f5e6b8", "#7d611d", "#c9a243", "#d4b45c",
    ];

    notes.forEach((note) => {
      const midi = note.snapped_midi || note.original_midi;
      const x = leftPadding + note.start_time * pixelsPerSecond;
      const w = Math.max(note.duration * pixelsPerSecond, 4);
      const y = canvasHeight - 30 - (midi - minMidi + 1) * rowHeight;
      const h = rowHeight - 2;

      const isMatched = note.snapped_midi !== null;
      const opacity = isMatched ? 0.85 : 0.3;

      // Find position index for color
      let colorIdx = 0;
      if (note.position && note.position.startsWith("Tone")) {
        const num = parseInt(note.position.replace("Tone ", ""));
        if (!isNaN(num)) colorIdx = num;
      }

      ctx.globalAlpha = opacity;
      ctx.fillStyle = isMatched
        ? goldColors[colorIdx % goldColors.length]
        : "#5c6378";

      // Rounded rect
      const r = 3;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fill();

      // Note label
      if (w > 20 && isMatched) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#0a0b0f";
        ctx.font = "bold 9px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(note.note_name, x + 4, y + h / 2 + 3);
      }
    });

    ctx.globalAlpha = 1;
  }

  function renderEventsTable(data) {
    eventsBody.innerHTML = "";

    data.notes.forEach((note, i) => {
      const tr = document.createElement("tr");
      const isMatched = note.snapped_midi !== null;

      let confClass = "low";
      if (note.confidence >= 0.8) confClass = "high";
      else if (note.confidence >= 0.5) confClass = "medium";

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${note.start_time.toFixed(2)}s</td>
        <td>${(note.duration * 1000).toFixed(0)}ms</td>
        <td class="${isMatched ? "td-position" : "td-unmatched"}">${note.position}</td>
        <td class="td-note">${note.note_name}</td>
        <td>${note.original_midi}${isMatched && note.snapped_midi !== note.original_midi ? " → " + note.snapped_midi : ""}</td>
        <td>${note.velocity}</td>
        <td><span class="td-confidence ${confClass}">${(note.confidence * 100).toFixed(0)}%</span></td>
      `;

      eventsBody.appendChild(tr);
    });
  }

  // ================================================================
  //  Playback Engine — Web Audio API Handpan Synthesizer
  // ================================================================

  const playbackDiagram = document.getElementById("playbackDiagram");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const btnStop = document.getElementById("btnStop");
  const iconPlay = document.getElementById("iconPlay");
  const iconPause = document.getElementById("iconPause");
  const playbackTime = document.getElementById("playbackTime");
  const playbackDurationEl = document.getElementById("playbackDuration");
  const playbackProgressBar = document.getElementById("playbackProgressBar");
  const playbackProgressFill = document.getElementById("playbackProgressFill");
  const playbackProgressCursor = document.getElementById("playbackProgressCursor");
  const playbackSpeedSelect = document.getElementById("playbackSpeed");
  const playbackVolumeSlider = document.getElementById("playbackVolume");

  let audioCtx = null;
  let masterGain = null;
  let playbackState = "stopped"; // "stopped" | "playing" | "paused"
  let playbackStartRealTime = 0;  // performance.now() when playback started
  let playbackOffset = 0;         // elapsed virtual time when paused
  let playbackAnimFrame = null;
  let scheduledSources = [];      // active oscillator nodes to cancel
  let playbackNotes = [];         // matched notes sorted by start_time
  let playbackNextIdx = 0;        // next note index to schedule
  let playbackTotalDuration = 0;
  let diagramNoteElements = [];   // DOM elements for playback diagram

  function getPlaybackSpeed() {
    return parseFloat(playbackSpeedSelect.value) || 1;
  }

  function getPlaybackVolume() {
    return (parseInt(playbackVolumeSlider.value) || 70) / 100;
  }

  /** Get current virtual playback time in seconds */
  function getVirtualTime() {
    if (playbackState === "playing") {
      const elapsed = (performance.now() - playbackStartRealTime) / 1000;
      return playbackOffset + elapsed * getPlaybackSpeed();
    }
    return playbackOffset;
  }

  /** Initialize AudioContext lazily (must be triggered by user gesture) */
  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = getPlaybackVolume();
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  /**
   * Synthesize a handpan-like tone.
   * Uses a sine fundamental + attenuated harmonics with a sharp percussive
   * envelope to approximate the metallic resonance of a handpan strike.
   */
  function playHandpanTone(midiNote, velocity, duration) {
    if (!audioCtx) return;

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const vol = (velocity / 127) * getPlaybackVolume() * 0.35;
    const now = audioCtx.currentTime;
    const sustainDur = Math.min(duration, 2.5);
    const releaseDur = 1.2;

    const noteGain = audioCtx.createGain();
    noteGain.connect(masterGain);

    // Percussive envelope: fast attack, medium decay, gentle release
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(vol, now + 0.005);
    noteGain.gain.exponentialRampToValueAtTime(vol * 0.5, now + 0.08);
    noteGain.gain.exponentialRampToValueAtTime(vol * 0.25, now + sustainDur * 0.5);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + sustainDur + releaseDur);

    // Harmonics for a richer, more handpan-like timbre
    const harmonics = [
      { ratio: 1,   gain: 1.0,  type: "sine" },      // fundamental
      { ratio: 2,   gain: 0.25, type: "sine" },      // octave
      { ratio: 3,   gain: 0.08, type: "sine" },      // 12th
      { ratio: 4.02, gain: 0.04, type: "sine" },     // slightly detuned 2nd octave (metallic shimmer)
    ];

    const sources = [];
    harmonics.forEach((h) => {
      const osc = audioCtx.createOscillator();
      const hGain = audioCtx.createGain();
      osc.type = h.type;
      osc.frequency.value = freq * h.ratio;
      hGain.gain.value = h.gain;
      osc.connect(hGain);
      hGain.connect(noteGain);
      osc.start(now);
      osc.stop(now + sustainDur + releaseDur + 0.1);
      sources.push(osc);
    });

    return sources;
  }

  /** Build the playback handpan diagram with positioned note elements */
  function buildPlaybackDiagram() {
    playbackDiagram.innerHTML = "";
    diagramNoteElements = [];

    if (!lastResult) return;

    const scaleKey = scaleSelect.value;
    const scale = scalesData[scaleKey];
    if (!scale) return;

    const positions = getHandpanPositions(scale.notes.length);
    // Adjust for the smaller playback diagram (240px vs 280px)
    const scaleFactor = 240 / 280;

    scale.notes.forEach((midi, i) => {
      const div = document.createElement("div");
      div.className = "hp-note" + (i === 0 ? " ding" : "");
      div.dataset.position = scale.positions[i];
      div.dataset.midi = midi;
      div.innerHTML = `<span>${scale.note_names[i]}</span><span class="note-pos">${scale.positions[i]}</span>`;
      // Scale positions for the smaller diagram
      const noteSize = i === 0 ? 28 : 25;
      div.style.left = (positions[i].x * scaleFactor + (280 - 240) / 2 * scaleFactor - (noteSize - 29) * scaleFactor) + "px";
      div.style.top = (positions[i].y * scaleFactor + (280 - 240) / 2 * scaleFactor - (noteSize - 29) * scaleFactor) + "px";
      playbackDiagram.appendChild(div);
      diagramNoteElements.push(div);
    });
  }

  /** Highlight a position on the playback diagram */
  function highlightDiagramNote(position) {
    diagramNoteElements.forEach((el) => {
      if (el.dataset.position === position) {
        el.classList.add("playing");
        // Remove after a brief duration
        setTimeout(() => el.classList.remove("playing"), 280);
      }
    });
  }

  /** Format seconds to m:ss */
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  /** Update progress bar and time display */
  function updateProgress() {
    const t = getVirtualTime();
    const pct = playbackTotalDuration > 0 ? Math.min(t / playbackTotalDuration * 100, 100) : 0;
    playbackProgressFill.style.width = pct + "%";
    playbackProgressCursor.style.left = pct + "%";
    playbackTime.textContent = formatTime(Math.min(t, playbackTotalDuration));

    // Schedule notes that have passed current time
    scheduleUpcomingNotes(t);

    // Check if playback has ended
    if (t >= playbackTotalDuration && playbackState === "playing") {
      stopPlayback();
      return;
    }

    if (playbackState === "playing") {
      playbackAnimFrame = requestAnimationFrame(updateProgress);
    }
  }

  /** Schedule notes in a lookahead window */
  function scheduleUpcomingNotes(currentVirtualTime) {
    const lookahead = 0.05; // 50ms lookahead
    while (
      playbackNextIdx < playbackNotes.length &&
      playbackNotes[playbackNextIdx].start_time <= currentVirtualTime + lookahead
    ) {
      const note = playbackNotes[playbackNextIdx];
      if (note.start_time >= currentVirtualTime - 0.05) {
        // Play the note
        const midi = note.snapped_midi || note.original_midi;
        const sources = playHandpanTone(midi, note.velocity, note.duration);
        if (sources) scheduledSources.push(...sources);
        // Highlight on diagram
        highlightDiagramNote(note.position);
      }
      playbackNextIdx++;
    }
  }

  /** Start or resume playback */
  function startPlayback() {
    if (!lastResult || playbackNotes.length === 0) return;
    ensureAudioCtx();

    if (playbackState === "stopped") {
      playbackOffset = 0;
      playbackNextIdx = 0;
    }

    playbackStartRealTime = performance.now();
    playbackState = "playing";

    // Find the correct next index based on current offset
    playbackNextIdx = 0;
    for (let i = 0; i < playbackNotes.length; i++) {
      if (playbackNotes[i].start_time >= playbackOffset - 0.01) {
        playbackNextIdx = i;
        break;
      }
      if (i === playbackNotes.length - 1) {
        playbackNextIdx = playbackNotes.length;
      }
    }

    iconPlay.style.display = "none";
    iconPause.style.display = "";
    btnPlayPause.classList.add("active");

    updateProgress();
  }

  /** Pause playback */
  function pausePlayback() {
    if (playbackState !== "playing") return;

    playbackOffset = getVirtualTime();
    playbackState = "paused";

    // Stop all currently playing sources
    scheduledSources.forEach((s) => { try { s.stop(); } catch (e) {} });
    scheduledSources = [];

    if (playbackAnimFrame) cancelAnimationFrame(playbackAnimFrame);

    iconPlay.style.display = "";
    iconPause.style.display = "none";
    btnPlayPause.classList.remove("active");
  }

  /** Stop playback and reset */
  function stopPlayback() {
    playbackState = "stopped";
    playbackOffset = 0;
    playbackNextIdx = 0;

    scheduledSources.forEach((s) => { try { s.stop(); } catch (e) {} });
    scheduledSources = [];

    if (playbackAnimFrame) cancelAnimationFrame(playbackAnimFrame);

    iconPlay.style.display = "";
    iconPause.style.display = "none";
    btnPlayPause.classList.remove("active");

    // Reset progress
    playbackProgressFill.style.width = "0%";
    playbackProgressCursor.style.left = "0%";
    playbackTime.textContent = "0:00";

    // Clear highlights
    diagramNoteElements.forEach((el) => el.classList.remove("playing"));
  }

  /** Seek to a position */
  function seekPlayback(pct) {
    const wasPlaying = playbackState === "playing";
    if (wasPlaying) pausePlayback();

    playbackOffset = (pct / 100) * playbackTotalDuration;

    // Update next note index
    playbackNextIdx = 0;
    for (let i = 0; i < playbackNotes.length; i++) {
      if (playbackNotes[i].start_time >= playbackOffset - 0.01) {
        playbackNextIdx = i;
        break;
      }
      if (i === playbackNotes.length - 1) {
        playbackNextIdx = playbackNotes.length;
      }
    }

    // Update display
    const p = Math.min(pct, 100);
    playbackProgressFill.style.width = p + "%";
    playbackProgressCursor.style.left = p + "%";
    playbackTime.textContent = formatTime(playbackOffset);

    if (wasPlaying) startPlayback();
  }

  /** Initialize playback when results arrive */
  function initPlayback(data) {
    // Filter to only matched notes
    playbackNotes = data.notes
      .filter((n) => n.snapped_midi !== null)
      .sort((a, b) => a.start_time - b.start_time);

    playbackTotalDuration = data.duration || 1;
    playbackDurationEl.textContent = formatTime(playbackTotalDuration);
    playbackTime.textContent = "0:00";
    playbackProgressFill.style.width = "0%";
    playbackProgressCursor.style.left = "0%";

    stopPlayback();
    buildPlaybackDiagram();
  }

  /** Bind playback events */
  function bindPlaybackEvents() {
    btnPlayPause.addEventListener("click", () => {
      if (playbackState === "playing") {
        pausePlayback();
      } else {
        startPlayback();
      }
    });

    btnStop.addEventListener("click", stopPlayback);

    // Seek on progress bar click
    playbackProgressBar.addEventListener("click", (e) => {
      const rect = playbackProgressBar.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      seekPlayback(Math.max(0, Math.min(100, pct)));
    });

    // Volume control
    playbackVolumeSlider.addEventListener("input", () => {
      if (masterGain) {
        masterGain.gain.value = getPlaybackVolume();
      }
    });

    // Speed control - if playing, recalculate timing
    playbackSpeedSelect.addEventListener("change", () => {
      if (playbackState === "playing") {
        // Save current position, restart with new speed
        playbackOffset = getVirtualTime();
        playbackStartRealTime = performance.now();
      }
    });
  }

  // ---- Section Management ----
  function showSection(name) {
    uploadSection.classList.toggle("hidden", name !== "upload");
    loadingSection.classList.toggle("hidden", name !== "loading");
    resultsSection.classList.toggle("hidden", name !== "results");
    errorSection.classList.toggle("hidden", name !== "error");

    // Keep upload visible when showing results
    if (name === "results") {
      uploadSection.classList.remove("hidden");
    }
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    showSection("error");
  }

  function resetToUpload() {
    showSection("upload");
    stopPlayback();
    lastResult = null;
  }

  // ---- Start ----
  init();
  bindPlaybackEvents();
})();
