const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { YoutubeTranscript } = require('youtube-transcript');
const { AssemblyAI } = require('assemblyai');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Set up Mutler for local video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Serve static files from 'video-search'
app.use(express.static(path.join(__dirname, 'video-search')));

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'video-search', 'index.html'));
});

// Helper: Format Seconds to MM:SS or HH:MM:SS
function formatTimestamp(seconds) {
    if (!seconds) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

// 1. YouTube Transcribe Endpoint (Fast & Free with AI Fallback)
app.post('/api/transcribe-youtube', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: 'No URL provided' });

    try {
        console.log(`Transcribing YouTube URL: ${videoUrl}`);
        const transcript = await YoutubeTranscript.fetchTranscript(videoUrl);
        
        const formattedData = transcript.map((entry, index) => ({
            id: 'stt-' + Date.now() + '-' + index,
            type: 'stt',
            timestamp: formatTimestamp(entry.offset / 1000),
            rawTime: entry.offset / 1000,
            text: entry.text
        }));

        res.json({ success: true, data: formattedData });
    } catch (err) {
        console.error('YouTube transcript scraper failed, attempting AssemblyAI fallback...', err);
        
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        if (apiKey) {
            try {
                const ytdl = require('@distube/ytdl-core');
                const client = new AssemblyAI({ apiKey });
                
                console.log(`Streaming YouTube audio to AssemblyAI fallback for: ${videoUrl}`);
                const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
                
                // Prevent unhandled stream error process crashes
                audioStream.on('error', (streamErr) => {
                    console.error('YTDL Audio Stream Error:', streamErr);
                });
                
                const transcript = await client.transcripts.transcribe({
                    audio: audioStream,
                    speech_models: ["universal-3-pro"]
                });

                let formattedData = [];
                if (transcript.utterances && Array.isArray(transcript.utterances) && transcript.utterances.length > 0) {
                    formattedData = transcript.utterances.map((u, i) => ({
                        id: 'stt-' + Date.now() + '-' + i,
                        type: 'stt',
                        timestamp: formatTimestamp(u.start / 1000),
                        rawTime: u.start / 1000,
                        text: u.text || u.word || transcript.text || ""
                    }));
                } else if (transcript.words && Array.isArray(transcript.words) && transcript.words.length > 0) {
                    const segmentSize = 10;
                    for (let i = 0; i < transcript.words.length; i += segmentSize) {
                        const segment = transcript.words.slice(i, i + segmentSize);
                        const text = segment.map(w => w.text || w.word || '').join(' ').trim();
                        formattedData.push({
                            id: 'stt-' + Date.now() + '-' + (i / segmentSize),
                            type: 'stt',
                            timestamp: formatTimestamp(segment[0].start / 1000),
                            rawTime: segment[0].start / 1000,
                            text: text
                        });
                    }
                } else {
                    formattedData.push({
                        id: 'stt-' + Date.now(),
                        type: 'stt',
                        timestamp: "0:00",
                        rawTime: 0,
                        text: transcript.text || "No speech detected"
                    });
                }

                res.json({ success: true, data: formattedData });
            } catch (fallbackErr) {
                console.error('AssemblyAI fallback failed:', fallbackErr);
                res.status(500).json({ success: false, error: 'Full AI Transcription failed. Ensure link is public and accessible.' });
            }
        } else {
            res.status(500).json({ success: false, error: 'Could not fetch YouTube transcript. Ensure CC are available or provide AssemblyAI Key in .env for full AI translation.' });
        }
    }
});

// 2. Local File / Remote URL AssemblyAI Endpoint (Full AI STT)
app.post('/api/transcribe-ai', upload.single('video'), async (req, res) => {
    const { videoUrl } = req.body;
    const file = req.file;

    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
        // Fallback for demo if key is missing, so it doesn't just error out but reminds them!
        return res.status(401).json({ 
            success: false, 
            error: 'AssemblyAI API Key not configured in .env!',
            requiresKey: true
        });
    }

    try {
        const client = new AssemblyAI({ apiKey });
        let audioSource = videoUrl;

        // If file uploaded, use the uploaded file path
        if (file) {
            audioSource = file.path;
            console.log(`Analyzing local file: ${file.path}`);
        } else if (!videoUrl) {
            return res.status(400).json({ success: false, error: 'No file or URL provided' });
        }

        console.log(`Requesting AssemblyAI transcribe for: ${audioSource}`);
        const params = {
            audio: audioSource,
            speaker_labels: false,
            speech_models: ["universal-3-pro"]
        };

        const transcript = await client.transcripts.transcribe(params);

        // Convert AssemblyAI sentences / words to our format
        // We'll use utterances if available for cleaner breakdown, or just full text broken up.
        let formattedData = [];
        if (transcript.utterances && Array.isArray(transcript.utterances) && transcript.utterances.length > 0) {
            formattedData = transcript.utterances.map((u, i) => ({
                id: 'stt-' + Date.now() + '-' + i,
                type: 'stt',
                timestamp: formatTimestamp(u.start / 1000),
                rawTime: u.start / 1000,
                text: u.text || u.word || transcript.text || ""
            }));
        } else if (transcript.words && Array.isArray(transcript.words) && transcript.words.length > 0) {
            const segmentSize = 10;
            for (let i = 0; i < transcript.words.length; i += segmentSize) {
                const segment = transcript.words.slice(i, i + segmentSize);
                const text = segment.map(w => w.text || w.word || '').join(' ').trim();
                formattedData.push({
                    id: 'stt-' + Date.now() + '-' + (i / segmentSize),
                    type: 'stt',
                    timestamp: formatTimestamp(segment[0].start / 1000),
                    rawTime: segment[0].start / 1000,
                    text: text
                });
            }
        } else {
            formattedData.push({
                id: 'stt-' + Date.now(),
                type: 'stt',
                timestamp: "0:00",
                rawTime: 0,
                text: transcript.text || "No speech detected"
            });
        }

        // Cleanup local uploaded file if it exists
        if (file && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        res.json({ success: true, data: formattedData });

    } catch (err) {
        console.error('AssemblyAI Error:', err);
        // Cleanup on error too
        if (file && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch(e) {}
        }
        res.status(500).json({ success: false, error: err.message || 'AssemblyAI Request Failed' });
    }
});

// 3. Backend OCR for YouTube (Indestructible Puppeteer Screenshots)
app.post('/api/ocr-youtube', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: 'No URL provided' });

    try {
        const puppeteer = require('puppeteer');
        const { createWorker, createScheduler } = require('tesseract.js');

        // Extract ID
        const match = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/(?:shorts\/)?)([a-zA-Z0-9_-]{11})/);
        const ytId = match ? match[1] : null;

        if (!ytId) {
            throw new Error('Could not resolve absolute YouTube ID from link.');
        }

        console.log(`Analyzing YouTube Video with Backend Puppeteer OCR: ${videoUrl}`);

        const tempDir = path.join(__dirname, 'temp_frames');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Boot Headless robot
        const browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        // Pass complete Chrome mask to bypass consent walls 
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to YouTube Embed (Bypasses Main setup rate-locks safely)
        await page.goto(`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1`, { waitUntil: 'domcontentloaded' });
        
        try {
            await page.waitForSelector('.html5-video-player', { timeout: 10000 });
        } catch (e) {
            console.warn("Player frame taking longer to render than expected...");
        }

        const worker = await createWorker('eng');
        const ocrData = [];
        const totalSteps = 6; // Standard hardcoded iteration layout
        const step = 20; 

        console.log(`Processing sequential screenshot OCR pipeline for: ${ytId}...`);

        for (let i = 0; i < totalSteps; i++) {
            const timestamp = Math.floor(i * step);
            const framePath = path.join(tempDir, `frame-${timestamp}-${Date.now()}.jpg`);

            try {
                await page.evaluate((t) => {
                    const video = document.querySelector('video');
                    if (video) { video.currentTime = t; video.pause(); }
                }, timestamp);

                await new Promise(r => setTimeout(r, 800)); // wait seek

                // Capture viewport representation 
                await page.screenshot({ path: framePath, quality: 80, type: 'jpeg' });

                if (fs.existsSync(framePath)) {
                    const { data: { text } } = await worker.recognize(framePath);
                    const cleaned = text.trim().replace(/\s+/g, ' ');

                    if (cleaned && cleaned.length > 8) {
                        ocrData.push({
                            id: 'ocr-' + Date.now() + '-' + i,
                            type: 'ocr',
                            timestamp: formatTimestamp(timestamp),
                            rawTime: timestamp,
                            text: cleaned
                        });
                    }
                    fs.unlinkSync(framePath); 
                }
            } catch (err) {
                 console.error(`Frame extraction error at ${timestamp}s:`, err);
            }
        }

        await worker.terminate();
        await browser.close();

        res.json({ success: true, data: ocrData });

    } catch (err) {
        console.error('Backend OCR Error:', err);
        res.status(500).json({ success: false, error: 'Backend OCR extraction failed: ' + err.message });
    }
});

app.listen(port, () => {
    console.log(`\x1b[32m[Visionary Search API]\x1b[0m Server active at http://localhost:${port}`);
});
