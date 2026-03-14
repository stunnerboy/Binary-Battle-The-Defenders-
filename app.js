// Core state
let videoFile = null;
let videoElement = null;
let frameCanvas = null;
let frameCtx = null;

let frameIndex = []; // { time: number, text: string, type: 'ocr' }
let transcriptIndex = []; // { time: number, text: string, type: 'transcript' }

let analysisInProgress = false;

// Background canvas animation
function initBackgroundCanvas() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize);

  const nodes = [];
  const NODE_COUNT = 48;

  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 2 + Math.random() * 2,
    });
  }

  function tick() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Draw connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160) {
          const alpha = 1 - dist / 160;
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `rgba(56,189,248,${0.05 + alpha * 0.18})`);
          grad.addColorStop(1, `rgba(129,140,248,${0.03 + alpha * 0.12})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;

      if (n.x < -40) n.x = window.innerWidth + 40;
      if (n.x > window.innerWidth + 40) n.x = -40;
      if (n.y < -40) n.y = window.innerHeight + 40;
      if (n.y > window.innerHeight + 40) n.y = -40;

      const radial = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
      radial.addColorStop(0, "rgba(56,189,248,0.4)");
      radial.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  tick();
}

// Utility helpers
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
      s
    ).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateMetric(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function setProgress(message, value) {
  const bar = document.getElementById("progress-bar");
  const text = document.getElementById("progress-text");
  const percent = document.getElementById("progress-percent");
  const fill = document.getElementById("progress-fill");
  if (!bar || !text || !percent || !fill) return;

  bar.hidden = false;
  text.textContent = message;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  percent.textContent = `${clamped}%`;
  fill.style.width = `${clamped}%`;
}

function hideProgress() {
  const bar = document.getElementById("progress-bar");
  if (bar) bar.hidden = true;
}

// Transcript parsing (supports very lightweight timestamps)
const timestampRegex =
  /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/; // [hh:]mm:ss[.mmm]

function parseTimestampToSeconds(str) {
  const m = str.match(timestampRegex);
  if (!m) return null;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}

function parseTranscript(text) {
  const lines = text.split(/\r?\n/);
  const segments = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let time = 0;
    let content = line;

    // SRT-style time range
    if (line.includes("-->")) {
      const [start] = line.split("-->");
      const ts = parseTimestampToSeconds(start.trim());
      time = ts ?? 0;
      content = "";
      continue; // content usually on following lines; we'll pick up below
    }

    // Leading timestamp "00:01:23 ..."
    const match = line.match(/^(\d{1,2}:\d{2}:\d{2})\s+(.+)$/);
    if (match) {
      const ts = parseTimestampToSeconds(match[1]);
      time = ts ?? 0;
      content = match[2];
    }

    segments.push({
      time,
      text: content,
      type: "transcript",
    });
  }
  return segments;
}

// Frame OCR pipeline
async function runFrameAnalysis({ intervalSec }) {
  if (!videoElement || !frameCtx) return;

  const ocrEnabled = document.getElementById("toggle-ocr")?.checked;
  if (!ocrEnabled) {
    frameIndex = [];
    updateMetric("metric-frames", 0);
    return;
  }

  const duration = videoElement.duration || 0;
  if (!duration || !Number.isFinite(duration)) return;

  const core = window.Tesseract;
  if (!core) {
    console.warn("Tesseract.js not loaded; skipping OCR.");
    return;
  }

  const maxFrames = Math.min(80, Math.ceil(duration / intervalSec));
  const step = duration / maxFrames;

  frameIndex = [];
  updateMetric("metric-frames", 0);

  const width = videoElement.videoWidth || 640;
  const height = videoElement.videoHeight || 360;

  frameCanvas.width = width;
  frameCanvas.height = height;

  let processed = 0;

  for (let i = 0; i < maxFrames; i++) {
    const t = i * step;
    await new Promise((resolve) => {
      const onSeeked = async () => {
        videoElement.removeEventListener("seeked", onSeeked);
        frameCtx.drawImage(videoElement, 0, 0, width, height);
        const dataUrl = frameCanvas.toDataURL("image/jpeg", 0.7);
        try {
          const { data } = await core.recognize(dataUrl, "eng", {
            logger: () => {},
          });
          const text = (data?.text || "").trim();
          if (text) {
            frameIndex.push({
              time: t,
              text,
              type: "ocr",
            });
            updateMetric("metric-frames", frameIndex.length);
          }
        } catch (err) {
          console.error("OCR error", err);
        }

        processed++;
        const progress = (processed / maxFrames) * 100;
        setProgress("Scanning frames for on-screen text…", progress);
        resolve();
      };
      videoElement.addEventListener("seeked", onSeeked, { once: true });
      videoElement.currentTime = t;
    });
  }
}

// Build transcript index from textarea content
function buildTranscriptIndex() {
  const enabled = document.getElementById("toggle-transcript")?.checked;
  const textarea = document.getElementById("transcript-text");
  if (!enabled || !textarea) {
    transcriptIndex = [];
    updateMetric("metric-transcript", 0);
    return;
  }

  const raw = textarea.value.trim();
  if (!raw) {
    transcriptIndex = [];
    updateMetric("metric-transcript", 0);
    return;
  }

  transcriptIndex = parseTranscript(raw);
  updateMetric("metric-transcript", transcriptIndex.length);
}

// Search
function runSearch() {
  const queryInput = document.getElementById("search-input");
  const resultsList = document.getElementById("results-list");
  const summary = document.getElementById("results-summary");
  const filterOcr = document.getElementById("filter-ocr");
  const filterTranscript = document.getElementById("filter-transcript");
  const matchesMetric = document.getElementById("metric-matches");

  if (!queryInput || !resultsList || !summary || !matchesMetric) return;

  const query = queryInput.value.trim();
  resultsList.innerHTML = "";

  if (!query) {
    summary.textContent = "No query yet. Type a keyword to begin.";
    matchesMetric.textContent = "0";
    return;
  }

  const qLower = query.toLowerCase();
  const all = [];

  if (!filterOcr || filterOcr.checked) {
    all.push(...frameIndex);
  }
  if (!filterTranscript || filterTranscript.checked) {
    all.push(...transcriptIndex);
  }

  const results = all
    .filter((entry) => entry.text.toLowerCase().includes(qLower))
    .sort((a, b) => a.time - b.time)
    .slice(0, 200);

  matchesMetric.textContent = String(results.length);

  if (!results.length) {
    summary.textContent = `No matches for “${query}” in current analysis.`;
    return;
  }

  summary.textContent = `${results.length} match${
    results.length === 1 ? "" : "es"
  } for “${query}”. Click a result to jump.`;

  for (const res of results) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "result-item";

    const badge = document.createElement("div");
    badge.className =
      "result-badge " + (res.type === "ocr" ? "result-badge--ocr" : "result-badge--transcript");
    badge.textContent = res.type === "ocr" ? "Frame OCR" : "Transcript";

    const time = document.createElement("div");
    time.className = "result-time";
    time.textContent = formatTime(res.time);

    const snippet = document.createElement("div");
    snippet.className = "result-snippet";
    const safeText = res.text.replace(/[<>]/g, (c) => {
      switch (c) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        default:
          return c;
      }
    });
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})`, "gi");
    snippet.innerHTML = safeText.replace(regex, "<mark>$1</mark>");

    item.appendChild(badge);
    item.appendChild(time);
    item.appendChild(snippet);

    item.addEventListener("click", () => {
      if (videoElement && Number.isFinite(res.time)) {
        videoElement.currentTime = res.time;
        videoElement.play().catch(() => {});
      }
    });

    resultsList.appendChild(item);
  }
}

// Video loading and metadata
function attachVideoEvents() {
  const timelineCursor = document.getElementById("timeline-cursor");
  if (!videoElement || !timelineCursor) return;

  videoElement.addEventListener("timeupdate", () => {
    if (!videoElement.duration || !Number.isFinite(videoElement.duration)) return;
    const ratio = videoElement.currentTime / videoElement.duration;
    timelineCursor.style.left = `${ratio * 100}%`;
  });
}

function handleVideoFile(file) {
  const input = document.getElementById("video-input");
  const player = document.getElementById("video-player");
  const metaName = document.getElementById("meta-name");
  const metaRes = document.getElementById("meta-resolution");
  const metaDur = document.getElementById("meta-duration");
  const analyzeBtn = document.getElementById("btn-analyze");

  if (!file || !player || !metaName || !metaRes || !metaDur || !analyzeBtn) return;

  videoFile = file;

  const url = URL.createObjectURL(file);
  player.src = url;

  videoElement = player;
  attachVideoEvents();

  metaName.textContent = file.name;
  metaRes.textContent = "Loading…";
  metaDur.textContent = "Loading…";

  player.addEventListener(
    "loadedmetadata",
    () => {
      metaRes.textContent = `${player.videoWidth} x ${player.videoHeight}`;
      metaDur.textContent = formatTime(player.duration);
      analyzeBtn.disabled = false;
    },
    { once: true }
  );
}

// File inputs and drag & drop
function initFileInputs() {
  const dropzone = document.getElementById("dropzone");
  const videoInput = document.getElementById("video-input");
  const transcriptInput = document.getElementById("transcript-input");
  const btnLoadVtt = document.getElementById("btn-load-vtt");

  if (!dropzone || !videoInput || !btnLoadVtt || !transcriptInput) return;

  dropzone.addEventListener("click", () => {
    videoInput.click();
  });

  videoInput.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (file) handleVideoFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dropzone.classList.add("drag-active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dropzone.classList.remove("drag-active");
    });
  });

  dropzone.addEventListener("drop", (ev) => {
    const dt = ev.dataTransfer;
    if (!dt) return;
    const file = dt.files?.[0];
    if (file && file.type.startsWith("video/")) {
      handleVideoFile(file);
    }
  });

  btnLoadVtt.addEventListener("click", () => {
    transcriptInput.click();
  });

  transcriptInput.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const textarea = document.getElementById("transcript-text");
      if (textarea && typeof reader.result === "string") {
        textarea.value = reader.result;
      }
    };
    reader.readAsText(file);
  });
}

// Analysis flow
async function runAnalysis() {
  if (analysisInProgress) return;
  if (!videoElement || !videoFile) return;

  analysisInProgress = true;
  const analyzeBtn = document.getElementById("btn-analyze");
  const searchBtn = document.getElementById("btn-search");

  if (analyzeBtn) analyzeBtn.disabled = true;
  if (searchBtn) searchBtn.disabled = true;

  setProgress("Preparing video for analysis…", 2);

  buildTranscriptIndex();

  const intervalInput = document.getElementById("frame-interval");
  const intervalSec = intervalInput ? parseFloat(intervalInput.value) || 1 : 1;

  try {
    await runFrameAnalysis({ intervalSec });
  } catch (err) {
    console.error("Frame analysis error", err);
  }

  hideProgress();
  analysisInProgress = false;

  if (analyzeBtn) analyzeBtn.disabled = false;
  if (searchBtn) searchBtn.disabled = false;
}

// Reset
function resetApp() {
  const videoInput = document.getElementById("video-input");
  const transcriptInput = document.getElementById("transcript-input");
  const transcriptText = document.getElementById("transcript-text");
  const metaName = document.getElementById("meta-name");
  const metaRes = document.getElementById("meta-resolution");
  const metaDur = document.getElementById("meta-duration");
  const analyzeBtn = document.getElementById("btn-analyze");
  const searchInput = document.getElementById("search-input");
  const resultsList = document.getElementById("results-list");
  const resultsSummary = document.getElementById("results-summary");
  const matchesMetric = document.getElementById("metric-matches");

  if (videoInput) videoInput.value = "";
  if (transcriptInput) transcriptInput.value = "";
  if (transcriptText) transcriptText.value = "";
  if (metaName) metaName.textContent = "–";
  if (metaRes) metaRes.textContent = "–";
  if (metaDur) metaDur.textContent = "–";
  if (analyzeBtn) analyzeBtn.disabled = true;
  if (searchInput) searchInput.value = "";
  if (resultsList) resultsList.innerHTML = "";
  if (resultsSummary)
    resultsSummary.textContent = "No query yet. Type a keyword to begin.";
  if (matchesMetric) matchesMetric.textContent = "0";

  updateMetric("metric-frames", 0);
  updateMetric("metric-transcript", 0);

  frameIndex = [];
  transcriptIndex = [];

  if (videoElement) {
    videoElement.pause();
    videoElement.removeAttribute("src");
    videoElement.load();
  }

  hideProgress();
}

// Wire UI events
function initUiEvents() {
  const frameInterval = document.getElementById("frame-interval");
  const frameLabel = document.getElementById("frame-interval-label");
  const btnAnalyze = document.getElementById("btn-analyze");
  const btnReset = document.getElementById("btn-reset");
  const btnSearch = document.getElementById("btn-search");
  const searchInput = document.getElementById("search-input");

  if (frameInterval && frameLabel) {
    frameInterval.addEventListener("input", () => {
      frameLabel.textContent = `${parseFloat(frameInterval.value).toFixed(1)}s`;
    });
  }

  if (btnAnalyze) {
    btnAnalyze.addEventListener("click", () => {
      runAnalysis();
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      resetApp();
    });
  }

  if (btnSearch) {
    btnSearch.addEventListener("click", () => {
      runSearch();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        runSearch();
      }
    });
  }

  const filterOcr = document.getElementById("filter-ocr");
  const filterTranscript = document.getElementById("filter-transcript");
  filterOcr?.addEventListener("change", runSearch);
  filterTranscript?.addEventListener("change", runSearch);
}

window.addEventListener("DOMContentLoaded", () => {
  videoElement = document.getElementById("video-player");
  frameCanvas = document.getElementById("frame-canvas");
  if (frameCanvas) {
    frameCtx = frameCanvas.getContext("2d");
  }

  initBackgroundCanvas();
  initFileInputs();
  initUiEvents();
});

