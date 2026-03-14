# Video Intelligence Search Engine

A fully client-side web application that lets you:

- Upload a video.
- Analyze frames using OCR (via Tesseract.js) to detect text that appears **inside** the video.
- Search for keywords across:
  - Extracted on-screen text (frame OCR).
  - A transcript or subtitle text that you paste or load.
- Jump directly to matching timestamps in the video.

All processing runs in the browser using HTML, CSS, and vanilla JavaScript.

> ⚠️ **Note on speech-to-text**  
> Browsers do not currently expose a reliable, privacy‑friendly API for doing high‑quality speech‑to‑text directly on arbitrary uploaded video files.  
> This app is designed so that you can:
> - Paste a transcript or subtitles (e.g. from `.srt` / `.vtt` files).
> - Or later plug in a backend/cloud STT service behind a simple HTTP API, while keeping the UI and search logic unchanged.

## Tech stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Canvas**:
  - Global animated background with a node/edge network effect.
  - Off‑screen frame capture for OCR.
- **OCR**: [Tesseract.js](https://github.com/naptha/tesseract.js) via CDN.

No frameworks or build tools are required.

## Running the app

1. Open `index.html` in a modern browser (Chrome, Edge, Firefox).
2. Drop a video file (MP4, WebM, etc.) onto the upload area.
3. Optionally:
   - Paste transcript / subtitles text into the transcript box, **or**
   - Click **Load .srt / .vtt** and select a subtitle file.
4. Adjust the **frame sampling interval** (smaller = more precise OCR, but slower).
5. Click **Run analysis** and wait while the frames are scanned.
6. Type a keyword in the search box and press **Search** or Enter.
7. Click a result to jump the video to that timestamp.

## How it works

- The video metadata is read via the standard `<video>` element.
- For frame OCR:
  - The video is sampled at regular intervals.
  - Each sampled frame is drawn to a hidden `<canvas>`.
  - The canvas image is passed to Tesseract.js to extract any visible text.
- For transcript search:
  - Raw text (or subtitle files) are parsed into lightweight segments.
  - Simple timestamp patterns like `00:01:23` are converted into seconds.
- Both OCR and transcript segments are indexed and searched in memory.

## Extending with real speech-to-text

To connect this UI to an actual speech‑to‑text engine, you can:

1. Build a small backend (Node, Python, etc.) that:
   - Accepts a video file upload or URL.
   - Calls your preferred STT provider (e.g. AssemblyAI, Deepgram, Azure, GCP).
   - Returns an array of `{ time, text }` segments.
2. Replace or augment `parseTranscript(...)` and `buildTranscriptIndex(...)` in `app.js` to fetch that data and store it in `transcriptIndex`.

That way, the **UI, canvas animations, and search UX remain unchanged**, and only the data source for transcript segments is swapped out.

