/**
 * VISIONARY SEARCH | AI VIDEO INTELLIGENCE
 * Core logic for network animation, video processing, and OCR.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- UI ELEMENTS ---
    const analyzeBtn = document.getElementById('analyze-btn');
    const videoInput = document.getElementById('video-url');
    const inputSection = document.getElementById('input-section');
    const processingSection = document.getElementById('processing-section');
    const searchView = document.getElementById('search-view');
    const progressFill = document.getElementById('progress-fill');
    const statusText = document.getElementById('status-text');
    const searchInput = document.getElementById('search-input');
    const resultsGrid = document.getElementById('results-grid');
    const toast = document.getElementById('toast');
    const playerWrapper = document.getElementById('player-wrapper');
    const ocrBtn = document.getElementById('extract-ocr-btn');
    const transcriptBtn = document.getElementById('import-transcript-btn');

    // --- STATE ---
    let intelligenceIndex = [];
    let videoElement = null;
    let isProcessing = false;
    let currentVideoId = null;

    // --- INITIALIZATION ---
    initBackgroundCanvas();

    // --- EVENT LISTENERS ---
    analyzeBtn.addEventListener('click', handleAnalyze);
    ocrBtn.addEventListener('click', startOCRAnalysis);
    transcriptBtn.addEventListener('click', importSpeechIntelligence);

    searchInput.addEventListener('input', (e) => {
        renderResults(searchIndex(e.target.value));
    });

    // --- CORE FUNCTIONS ---

    async function handleAnalyze() {
        const url = videoInput.value.trim();
        if (!url) {
            showToast('Please enter a valid video link');
            return;
        }

        // Show loading state
        inputSection.style.display = 'none';
        processingSection.classList.add('active');
        statusText.textContent = 'RESOLVING PLATFORM LINK...';
        progressFill.style.width = '30%';

        try {
            // Call backend to resolve the URL
            const resp = await fetch('/api/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await resp.json();
            
            statusText.textContent = `LOADING: ${data.title.toUpperCase()}`;
            progressFill.style.width = '60%';

            await loadVideo(data.resolved_url);
            
            currentVideoId = Math.random().toString(36).substr(2, 9);
            
            // Transition to Search View
            processingSection.classList.remove('active');
            searchView.classList.add('active');
            showToast(`System: ${data.platform} Source Identified. Ready.`);
            
            // Initial render
            renderResults([]);
            
        } catch (err) {
            console.error(err);
            showToast('Error: Could not resolve video link.', 5000);
            inputSection.style.display = 'block';
            processingSection.classList.remove('active');
        }
    }

    function loadVideo(url) {
        return new Promise((resolve, reject) => {
            playerWrapper.innerHTML = `<video id="active-video" controls crossorigin="anonymous" src="${url}"></video>`;
            videoElement = document.getElementById('active-video');
            
            videoElement.onloadedmetadata = () => resolve();
            videoElement.onerror = () => reject();
            
            setTimeout(() => reject('Load timeout'), 15000);
        });
    }

    async function startOCRAnalysis() {
        if (!videoElement || isProcessing) return;
        isProcessing = true;
        ocrBtn.disabled = true;
        
        statusText.textContent = 'INITIALIZING OCR PIPELINE...';
        showToast('Visionary AI is scanning frames. Please wait...');

        const canvas = document.getElementById('ocr-canvas');
        const ctx = canvas.getContext('2d');
        const duration = videoElement.duration;
        const step = duration > 120 ? 10 : 5; // Adaptive stepping
        const totalSteps = Math.floor(duration / step);
        
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        try {
            const worker = await Tesseract.createWorker('eng');

            for (let i = 0; i <= totalSteps; i++) {
                const timestamp = i * step;
                const progress = Math.round((i / totalSteps) * 100);
                
                statusText.textContent = `VISION ANALYSIS: ${formatTimestamp(timestamp)} [${progress}%]`;
                progressFill.style.width = `${progress}%`;

                await seekTo(timestamp);
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                
                const { data: { text } } = await worker.recognize(canvas);
                
                if (text && text.trim().length > 4) {
                    intelligenceIndex.push({
                        id: 'ocr-' + Date.now() + '-' + i,
                        type: 'ocr',
                        timestamp: formatTimestamp(timestamp),
                        rawTime: timestamp,
                        text: text.trim().replace(/\s+/g, ' ')
                    });
                    renderResults(searchIndex(searchInput.value), true);
                }
            }

            await worker.terminate();
            showToast('OCR Intelligence indexing complete!');
            saveSession();
        } catch (err) {
            console.error(err);
            showToast('OCR Engine error. Check console.');
        } finally {
            isProcessing = false;
            ocrBtn.disabled = false;
            statusText.textContent = 'IDLE';
            progressFill.style.width = '0%';
        }
    }

    async function importSpeechIntelligence() {
        if (isProcessing) return;
        
        showToast('Fetching Spoken Keywords via Whisper API (Mock)...');
        
        try {
            const resp = await fetch(`/api/intelligence/stt?id=${currentVideoId}`);
            const data = await resp.json();
            
            data.transcript.forEach(entry => {
                intelligenceIndex.push({
                    id: 'stt-' + Date.now() + '-' + entry.time,
                    type: 'stt',
                    timestamp: formatTimestamp(entry.time),
                    rawTime: entry.time,
                    text: entry.text
                });
            });
            
            showToast(`${data.transcript.length} speech segments indexed.`);
            renderResults(searchIndex(searchInput.value));
            saveSession();
        } catch (err) {
            showToast('Failed to reach Speech API.');
        }
    }

    function seekTo(time) {
        return new Promise(resolve => {
            const onSeeked = () => {
                videoElement.removeEventListener('seeked', onSeeked);
                resolve();
            };
            videoElement.addEventListener('seeked', onSeeked);
            videoElement.currentTime = time;
        });
    }

    async function saveSession() {
        if (!currentVideoId) return;
        await fetch('/api/intelligence/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: currentVideoId, index: intelligenceIndex })
        });
    }

    function searchIndex(query) {
        if (!query) return intelligenceIndex;
        const q = query.toLowerCase();
        return intelligenceIndex.filter(item => item.text.toLowerCase().includes(q));
    }

    function renderResults(results, isUpdate = false) {
        if (!isUpdate) resultsGrid.innerHTML = '';
        
        if (results.length === 0 && !isProcessing) {
            resultsGrid.innerHTML = '<p class="subtitle" style="grid-column: 1/-1; text-align: center; margin-top: 2rem;">No matches yet. Try "Analyze Visuals" or "Import Transcript".</p>';
            return;
        }

        // Sort by time
        const sorted = results.sort((a, b) => a.rawTime - b.rawTime);
        
        // If updating, we just re-render to keep it simple, or we could append
        resultsGrid.innerHTML = '';
        sorted.forEach((res, index) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            const typeLabel = res.type === 'stt' ? 'SPOKEN' : 'SCREEN';
            const typeClass = res.type === 'stt' ? 'type-stt' : 'type-ocr';
            const icon = res.type === 'stt' ? 'fa-microphone-lines' : 'fa-expand';

            card.innerHTML = `
                <div class="result-type ${typeClass}">${typeLabel}</div>
                <div class="result-timestamp"><i class="fa-solid ${icon}"></i> ${res.timestamp}</div>
                <div class="result-text">${highlightMatch(res.text, searchInput.value)}</div>
            `;

            card.onclick = () => {
                videoElement.currentTime = res.rawTime;
                videoElement.play();
                showToast(`Jumped to ${res.timestamp}`);
            };

            resultsGrid.appendChild(card);
        });
    }

    function highlightMatch(text, query) {
        if (!query.trim()) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="highlight">$1</mark>');
    }

    // --- UTILS ---

    function formatTimestamp(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0 
            ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            : `${m}:${s.toString().padStart(2, '0')}`;
    }

    function showToast(msg, duration = 3000) {
        toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${msg}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }

    // --- NETWORK ANIMATION ---
    function initBackgroundCanvas() {
        const canvas = document.getElementById('network-canvas');
        const ctx = canvas.getContext('2d');
        let points = [];
        const numPoints = innerWidth < 800 ? 40 : 80;
        const maxDist = 180;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            points = [];
            for (let i = 0; i < numPoints; i++) {
                points.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    r: Math.random() * 2 + 1
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw points
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 242, 254, 0.5)';
                ctx.fill();

                for (let j = i + 1; j < points.length; j++) {
                    const p2 = points[j];
                    const d = Math.sqrt((p.x - p2.x)**2 + (p.y - p2.y)**2);
                    if (d < maxDist) {
                        ctx.beginPath();
                        ctx.lineWidth = 1 - d / maxDist;
                        ctx.strokeStyle = `rgba(155, 81, 224, ${0.2 * (1 - d / maxDist)})`;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize);
        resize();
        draw();
    }
});
