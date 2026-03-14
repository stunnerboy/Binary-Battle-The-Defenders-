# Visionary Search | AI Video Intelligence

Visionary Search is a Next-Gen Video Intelligence tool that allows users to search within video content using **Speech-to-Text (STT)** and **OCR-based Frame Analysis**. 

![Visionary UI Preview](https://img.shields.io/badge/Aesthetics-Premium-blueviolet) 
![Tech](https://img.shields.io/badge/Tech-Flask%20|%20Tesseract.js-blue)

## ✨ Features

- 🧠 **AI-Powered OCR**: Automatically scans video frames at intervals to detect text on slides, code, or titles.
- 🎙️ **Speech Intelligence**: Imports and indexes spoken keywords (mocked via backend for now, ready for Whisper/AssemblyAI).
- 🔗 **Deep Integration**: Supports lecture links from platforms like YouTube, Coursera, and direct sources.
- 🎨 **Premium UI**: Glassmorphic design with an interactive network background animation.
- ⚡ **Real-time Search**: Instant keyword highlighting and jumping to specific timestamps.

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Modern Browser (Chrome/Edge/Firefox)

### Installation

1. Navigate to the project directory:
   ```bash
   cd video-search
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the development server:
   ```bash
   python app.py
   ```

4. Open your browser to `http://127.0.0.1:5000`.

## 🛠️ How It Works

1. **URL Resolution**: The backend (`app.py`) resolves platform links to playable streams.
2. **Frame Analysis**: The frontend uses a hidden canvas to grab frames and passes them to **Tesseract.js** for OCR.
3. **Indexing**: Both visual and spoken data are indexed in the client-side `intelligenceIndex`.
4. **Interactive Background**: A vanilla JS `canvas` animation provides a sleek "high-tech" atmosphere.

## 📁 Project Structure

```bash
video-search/
├── app.py              # Flask Backend (API Resolve, STT Mock, Save Index)
├── static/
│   ├── scripts.js      # Core Logic (OCR, Animation, UI Sync)
│   └── styles.css      # Premium Design System
└── templates/
    └── index.html      # Main Application View
```

## ⚠️ Notes

- **CORS**: Ensure your video source allows CORS for OCR frame capture. 
- **Sample URL**: Try pasting a direct `.mp4` link for the best OCR experience.

---
Built with ❤️ for Binary Battle: The Defenders
