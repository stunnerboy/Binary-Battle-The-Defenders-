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
    const videoUpload = document.getElementById('video-upload');
    const backBtn = document.getElementById('back-btn');
    const timelineBar = document.getElementById('timeline-bar');

    // --- STATE ---
    let intelligenceIndex = [];
    let videoElement = null;
    let ytPlayer = null;
    let isProcessing = false;
    let currentVideoId = null;
    let videoType = 'direct'; // 'direct' or 'youtube'
    let currentUploadedFile = null; // Store for backend analysis
    let currentYoutubeId = null; // Store for backend transcription fallback

    // --- INITIALIZATION ---
    initBackgroundCanvas();

    // --- EVENT LISTENERS ---
    analyzeBtn.addEventListener('click', handleAnalyze);
    videoUpload.addEventListener('change', handleFileUpload);
    if (ocrBtn) ocrBtn.addEventListener('click', startOCRAnalysis);
    transcriptBtn.addEventListener('click', importSpeechIntelligence);
    backBtn.addEventListener('click', () => {
        resetSession();
        searchView.classList.remove('active');
        inputSection.style.display = 'block';
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        const filtered = searchIndex(query);
        renderResults(filtered);
        updateTimeline(filtered);
    });

    // --- CORE FUNCTIONS ---
    
    function resetSession() {
        intelligenceIndex = [];
        resultsGrid.innerHTML = '';
        timelineBar.innerHTML = '';
        searchInput.value = '';
        isProcessing = false;
        if (ocrBtn) ocrBtn.disabled = false;
        
        if (videoElement) {
            videoElement.pause();
            videoElement.src = "";
        }
        if (ytPlayer && ytPlayer.destroy) {
            try { ytPlayer.destroy(); } catch(e) {}
            ytPlayer = null;
        }
        playerWrapper.innerHTML = `
            <div class="video-placeholder" id="video-placeholder">
                <i class="fa-solid fa-play-circle"></i>
                <p>Loading Video Source...</p>
            </div>
        `;
    }

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        resetSession();
        videoType = 'direct';
        currentUploadedFile = file; // Save for Backend STT if requested

        // Show loading state
        inputSection.style.display = 'none';
        processingSection.classList.add('active');
        statusText.textContent = 'PREPARING LOCAL VIDEO...';
        progressFill.style.width = '30%';

        try {
            const objectUrl = URL.createObjectURL(file);
            statusText.textContent = `LOADING: ${file.name.toUpperCase()}`;
            progressFill.style.width = '60%';

            await loadVideo(objectUrl);
            
            currentVideoId = 'local-' + Math.random().toString(36).substr(2, 9);
            
            processingSection.classList.remove('active');
            searchView.classList.add('active');
            showToast(`System: Local Media Loaded. Ready for analysis.`);
            renderResults([]);
        } catch (err) {
            console.error('File load error:', err);
            showToast(`Error: ${err.message || 'Could not load video file.'}`, 6000);
            inputSection.style.display = 'block';
            processingSection.classList.remove('active');
        }
    }

    async function handleAnalyze() {
        const url = videoInput.value.trim();
        if (!url) {
            showToast('Please enter a valid link or upload a file');
            return;
        }

        resetSession();

        inputSection.style.display = 'none';
        processingSection.classList.add('active');
        statusText.textContent = 'RESOLVING LINK...';
        progressFill.style.width = '30%';

        try {
            const ytId = extractYoutubeId(url);
            if (ytId) {
                videoType = 'youtube';
                currentYoutubeId = ytId; // Save for perfect API links!
                statusText.textContent = `CONNECTING TO YOUTUBE...`;
                progressFill.style.width = '60%';
                await loadYoutubeVideo(ytId);
                showToast(`System: YouTube Stream Connected. OCR disabled for IFrame stability.`, 5000);
            } else {
                videoType = 'direct';
                statusText.textContent = `LOADING VIDEO SOURCE...`;
                progressFill.style.width = '60%';
                await loadVideo(url);
                showToast(`System: Remote Source Identified. Ready.`);
            }
            
            currentVideoId = 'remote-' + Math.random().toString(36).substr(2, 9);
            processingSection.classList.remove('active');
            searchView.classList.add('active');
            renderResults([]);
        } catch (err) {
            console.error('Analysis error:', err);
            showToast(`Error: ${err.message || 'Check link or format.'}`, 8000);
            inputSection.style.display = 'block';
            processingSection.classList.remove('active');
        }
    }

    function extractYoutubeId(url) {
        if (!url) return null;
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regExp);
        if (match) return match[1];
        
        // Autocorrect raw 11-character YouTube IDs
        if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
            return url.trim();
        }
        return null;
    }

    function loadVideo(url) {
        return new Promise((resolve, reject) => {
            playerWrapper.innerHTML = `<video id="active-video" controls crossorigin="anonymous" src="${url}"></video>`;
            videoElement = document.getElementById('active-video');

            const timeout = setTimeout(() => {
                reject(new Error('Video load timeout. Check your connection.'));
            }, 15000);

            videoElement.onloadedmetadata = () => {
                clearTimeout(timeout);
                resolve();
            };

            videoElement.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Format or CORS issue. External links must allow Cross-Origin access. Try local upload for restricted links.'));
            };
        });
    }

    function loadYoutubeVideo(id) {
        return new Promise((resolve, reject) => {
            playerWrapper.innerHTML = `<div id="yt-player"></div>`;
            const timeout = setTimeout(() => {
                reject(new Error('YouTube Player load timeout.'));
            }, 15000);

            ytPlayer = new YT.Player('yt-player', {
                height: '100%',
                width: '100%',
                videoId: id,
                playerVars: { 
                    'autoplay': 1, 
                    'controls': 1, 
                    'origin': window.location.origin,
                    'enablejsapi': 1 
                },
                events: {
                    'onReady': (event) => {
                        clearTimeout(timeout);
                        resolve();
                    },
                    'onError': (e) => {
                        clearTimeout(timeout);
                        reject(new Error('YouTube Player Error (ID: ' + e.data + '). The video might be restricted or deleted.'));
                    }
                }
            });
        });
    }

    async function startOCRAnalysis() {
        if (videoType === 'youtube') {
            if (isProcessing) return;
            showToast('Initializing Backend Visual Extraction...');
            
            isProcessing = true;
            if (ocrBtn) ocrBtn.disabled = true;
            statusText.textContent = 'BACKEND OCR PIPELINE...';
            progressFill.style.width = '30%';

            const API_BASE = window.location.port === '3000' ? '' : 'http://localhost:3000';

            try {
                const response = await fetch(`${API_BASE}/api/ocr-youtube`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl: currentYoutubeId ? `https://www.youtube.com/watch?v=${currentYoutubeId}` : videoInput.value.trim() })
                });

                const result = await response.json();
                if (result.success) {
                    if (result.data && result.data.length > 0) {
                        intelligenceIndex = [...intelligenceIndex, ...result.data];
                        showToast('Visual OCR successfully indexed.');
                        const filtered = searchIndex(searchInput.value);
                        renderResults(filtered);
                        updateTimeline(filtered);
                    } else {
                        showToast('No readable text discovered in frames.');
                    }
                } else {
                    showToast(`Backend OCR: ${result.error || 'Failed to extract text.'}`, 5000);
                }
            } catch (err) {
                console.error('OCR API Error:', err);
                showToast('Unable to support Backend OCR pipeline.');
            } finally {
                isProcessing = false;
                if (ocrBtn) ocrBtn.disabled = false;
                statusText.textContent = 'IDLE';
                progressFill.style.width = '0%';
            }
            return;
        }
        if (!videoElement || isProcessing) return;
        
        videoElement.pause();
        const originalTime = videoElement.currentTime;
        isProcessing = true;
        ocrBtn.disabled = true;
        
        statusText.textContent = 'INITIALIZING OCR PIPELINE...';
        showToast('Scanning frames...');

        const canvas = document.getElementById('ocr-canvas');
        const ctx = canvas.getContext('2d');
        const duration = videoElement.duration;
        const step = duration > 120 ? 15 : 5;
        const totalSteps = Math.floor(duration / step);
        
        // Ensure we use the actual intrinsic video dimensions for best OCR accuracy
        if (videoElement.videoWidth && videoElement.videoHeight) {
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
        } else {
            // Fallback to client dimensions if intrinsic are not available
            canvas.width = videoElement.clientWidth || 1280;
            canvas.height = videoElement.clientHeight || 720;
        }

        try {
            const worker = await Tesseract.createWorker('eng');

            for (let i = 0; i <= totalSteps; i++) {
                const timestamp = i * step;
                const progress = Math.round((i / totalSteps) * 100);
                statusText.textContent = `VISION ANALYSIS: [${progress}%]`;
                progressFill.style.width = `${progress}%`;

                await seekTo(timestamp);
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                
                const { data: { text } } = await worker.recognize(canvas);
                const cleanedText = cleanOCRText(text);
                
                if (cleanedText) {
                    intelligenceIndex.push({
                        id: 'ocr-' + Date.now() + '-' + i,
                        type: 'ocr',
                        timestamp: formatTimestamp(timestamp),
                        rawTime: timestamp,
                        text: cleanedText
                    });
                    renderResults(searchIndex(searchInput.value), true);
                    updateTimeline(searchIndex(searchInput.value));
                }
            }

            await worker.terminate();
            showToast('OCR Complete!');
            videoElement.currentTime = originalTime;
        } catch (err) {
            console.error(err);
            showToast('OCR Error.');
        } finally {
            isProcessing = false;
            ocrBtn.disabled = false;
            statusText.textContent = 'IDLE';
            progressFill.style.width = '0%';
        }
    }

    async function importSpeechIntelligence() {
        if (isProcessing) return;
        const duration = videoType === 'youtube' ? ytPlayer.getDuration() : (videoElement ? videoElement.duration : 0);
        if (!duration) return;

        showToast('Processing Speech-to-Text with AI Pipeline...');
        
        const API_BASE = window.location.port === '3000' ? '' : 'http://localhost:3000';
        let endpoint = `${API_BASE}/api/transcribe-youtube`;
        
        let options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: videoType === 'youtube' && currentYoutubeId ? `https://www.youtube.com/watch?v=${currentYoutubeId}` : videoInput.value.trim() })
        };

        if (videoType !== 'youtube') {
            endpoint = `${API_BASE}/api/transcribe-ai`;
            const formData = new FormData();
            
            if (currentUploadedFile) {
                formData.append('video', currentUploadedFile);
            } else {
                const url = videoInput.value.trim() || (videoElement ? videoElement.src : '');
                if (url) formData.append('videoUrl', url);
            }
            
            options = {
                method: 'POST',
                body: formData // Fetch automatically sets content-type multipart/form-data
            };
        }

        try {
            const response = await fetch(endpoint, options);
            const result = await response.json();

            if (result.success) {
                if (result.data && result.data.length > 0) {
                    intelligenceIndex = [...intelligenceIndex, ...result.data];
                    showToast('Speech Intelligence successfully indexed.');
                    const filtered = searchIndex(searchInput.value);
                    renderResults(filtered);
                    updateTimeline(filtered);
                } else {
                    showToast('No speech data was extracted. (Maybe silent or no CC)');
                }
            } else {
                if (result.requiresKey) {
                    showToast('AssemblyAI: Add API key to .env for local files.', 6000);
                } else {
                    showToast(`API: ${result.error || 'Failed to index speech.'}`, 5000);
                }
            }
        } catch (err) {
            console.error('STT API Fetch Error:', err);
            showToast('Unable to reach Transcription Backend.');
        }
    }

    function jumpTo(time) {
        if (videoType === 'youtube' && ytPlayer) {
            ytPlayer.seekTo(time, true);
            ytPlayer.playVideo();
        } else if (videoElement) {
            videoElement.currentTime = time;
            videoElement.play();
        }
        showToast(`System: Jumping to ${formatTimestamp(time)}`);
    }

    function updateTimeline(filteredResults) {
        timelineBar.innerHTML = '';
        const duration = videoType === 'youtube' ? ytPlayer.getDuration() : (videoElement ? videoElement.duration : 0);
        if (!duration) return;

        filteredResults.forEach(res => {
            const marker = document.createElement('div');
            marker.className = `timeline-marker type-${res.type}`;
            const percent = (res.rawTime / duration) * 100;
            marker.style.left = `${percent}%`;
            marker.setAttribute('data-time', res.timestamp);
            marker.onclick = () => jumpTo(res.rawTime);
            timelineBar.appendChild(marker);
        });
    }

    // --- OTHER CORE LOGIC ---

    function cleanOCRText(text) {
        if (!text) return null;
        const sanitized = text.trim().replace(/\s+/g, ' ');
        if (sanitized.length < 10) return null;

        const words = sanitized.split(' ');
        const meaningfulWords = words.filter(w => {
            const hasLetters = /[a-zA-Z]/.test(w);
            const hasVowel = /[aeiouAEIOU]/.test(w);
            return w.length >= 2 && hasLetters && (hasVowel || w.length > 5);
        });

        const symbols = (sanitized.match(/[^a-zA-Z0-9\s]/g) || []).length;
        const density = symbols / sanitized.length;

        return (meaningfulWords.length >= 3 && density < 0.25) ? sanitized : null;
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

    function searchIndex(query) {
        if (!query) return intelligenceIndex;
        const q = query.toLowerCase();
        return intelligenceIndex.filter(item => item.text.toLowerCase().includes(q));
    }

    function transliterateDevanagariToHinglish(text) {
        if (!/[\u0900-\u097F]/.test(text)) return text;

        const mapping = {
            'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
            'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
            'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
            'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
            'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
            'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
            'प': 'p', 'ख': 'kh', 'ब': 'b', 'भ': 'bh', 'म': 'm',
            'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
            'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy',
            'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
            'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', '्': '', 'ः': 'h'
        };

        const words = text.split(' ');
        const transliteratedWords = words.map(word => {
            let res = '';
            for (let i = 0; i < word.length; i++) {
                const char = word[i];
                res += mapping[char] || char;
            }
            return res;
        });

        return transliteratedWords.join(' ');
    }

    function renderResults(results, isUpdate = false) {
        if (!isUpdate) resultsGrid.innerHTML = '';
        if (results.length === 0 && !isProcessing) {
            resultsGrid.innerHTML = '<p class="subtitle" style="grid-column: 1/-1; text-align: center; margin-top: 2rem;">No matches found. Try analyzing visuals or importing transcript.</p>';
            return;
        }

        const sorted = results.sort((a, b) => a.rawTime - b.rawTime);
        resultsGrid.innerHTML = '';
        sorted.forEach((res) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            const typeLabel = res.type === 'stt' ? 'SPOKEN' : 'SCREEN';
            const typeClass = res.type === 'stt' ? 'type-stt' : 'type-ocr';
            const icon = res.type === 'stt' ? 'fa-microphone-lines' : 'fa-expand';

            // Clean up and summarize heavy OCR frame lists into descriptive topics
            let displayText = res.text;
            if (res.type === 'ocr') {
                const items = res.text.split(/\||•|\n|\s{3,}/).map(i => i.trim()).filter(i => i.length > 4 && i.length < 100);
                displayText = items.length > 1 ? items.slice(0, 3).join(' • ') : res.text;
            } else if (res.type === 'stt') {
                displayText = transliterateDevanagariToHinglish(displayText);
            }

            card.innerHTML = `
                <div class="result-type ${typeClass}">${typeLabel}</div>
                <div class="result-timestamp"><i class="fa-solid ${icon}"></i> ${res.timestamp}</div>
                <div class="result-text">${highlightMatch(displayText, searchInput.value)}</div>
            `;
            card.onclick = () => jumpTo(res.rawTime);
            resultsGrid.appendChild(card);
        });
    }

    function highlightMatch(text, query) {
        if (!query.trim()) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="highlight">$1</mark>');
    }

    function formatTimestamp(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
    }

    function showToast(msg, duration = 3000) {
        toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${msg}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }

    function initBackgroundCanvas() {
        const canvas = document.getElementById('network-canvas');
        const ctx = canvas.getContext('2d');
        let points = [];
        const numPoints = innerWidth < 800 ? 50 : 100;
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
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 242, 254, 0.4)';
                ctx.fill();
                for (let j = i + 1; j < points.length; j++) {
                    const p2 = points[j];
                    const d = Math.sqrt((p.x - p2.x)**2 + (p.y - p2.y)**2);
                    if (d < maxDist) {
                        ctx.beginPath();
                        ctx.lineWidth = 1 - d / maxDist;
                        ctx.strokeStyle = `rgba(155, 81, 224, ${0.1 * (1 - d / maxDist)})`;
                        ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', resize);
        resize(); draw();
    }
});
