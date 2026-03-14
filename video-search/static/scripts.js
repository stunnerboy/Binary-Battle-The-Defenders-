document.addEventListener('DOMContentLoaded', () => {
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

    let currentTaskId = null;
    let pollInterval = null;

    function showToast(message, duration = 3000) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }

    // Update processing text formatting
    function formatStatus(statusStr) {
        return statusStr.replace(/_/g, ' ').toUpperCase() + '...';
    }

    analyzeBtn.addEventListener('click', async () => {
        const url = videoInput.value.trim();
        if(!url) {
            showToast('Please enter a valid video link', 3000);
            return;
        }

        // Trigger processing mode visually
        inputSection.style.display = 'none';
        processingSection.classList.add('active');
        progressFill.style.width = '5%';
        statusText.textContent = 'CONNECTING TO SERVER...';

        try {
            const resp = await fetch('http://127.0.0.1:5000/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await resp.json();
            
            if(data.error) {
                showError(data.error);
                return;
            }

            currentTaskId = data.task_id;
            
            // Start polling for status
            pollInterval = setInterval(checkStatus, 1500);

        } catch (err) {
            showError('Server connection failed. Is backend running?');
        }
    });

    async function checkStatus() {
        if(!currentTaskId) return;

        try {
            const resp = await fetch(`http://127.0.0.1:5000/api/status/${currentTaskId}`);
            const data = await resp.json();

            if(data.error) {
                clearInterval(pollInterval);
                showError(data.error);
                return;
            }

            progressFill.style.width = `${data.progress}%`;
            statusText.textContent = formatStatus(data.status);

            if(data.status === 'completed') {
                clearInterval(pollInterval);
                finishProcessing();
            }

        } catch (err) {
            console.error(err);
        }
    }

    function showError(msg) {
        // Reset view
        processingSection.classList.remove('active');
        inputSection.style.display = 'block';
        showToast(`Error: ${msg}`, 4000);
        if(pollInterval) clearInterval(pollInterval);
    }

    function finishProcessing() {
        // Switch views
        processingSection.classList.remove('active');
        searchView.classList.add('active');
        showToast('Processing complete! Intelligence indexing done.', 4000);
        
        // Initial empty search to show all results
        performSearch('');
    }

    // Debounce search input
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(e.target.value);
        }, 300); // 300ms debounce
    });

    async function performSearch(query) {
        if(!currentTaskId) return;

        try {
            const resp = await fetch(`http://127.0.0.1:5000/api/search/${currentTaskId}?q=${encodeURIComponent(query)}`);
            const data = await resp.json();

            if(data.error) return;

            renderResults(data.matches);
            
        } catch (err) {
            console.error('Search error', err);
        }
    }

    function renderResults(results) {
        resultsGrid.innerHTML = '';

        if(results.length === 0) {
            resultsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); margin-top: 2rem;">
                    <h4>No intelligence matches found in video.</h4>
                </div>
            `;
            return;
        }

        results.forEach((res, index) => {
            const typeClass = res.type === 'stt' ? 'type-stt' : 'type-ocr';
            const icon = res.type === 'stt' ? 'fa-solid fa-microphone-lines' : 'fa-solid fa-expand';
            const typeLabel = res.type === 'stt' ? 'Spoken Keyword' : 'Frame Text (OCR)';

            const card = document.createElement('div');
            card.className = 'result-card';
            // Slight delay based on index for cascade animation
            card.style.animation = `slideUp 0.4s ease-out ${index * 0.05}s both`;

            card.innerHTML = `
                <div class="result-type ${typeClass}">${typeLabel}</div>
                <div class="result-timestamp">
                    <i class="${icon}"></i> ${res.timestamp}
                </div>
                <div class="result-text">${highlightMatch(res.text, searchInput.value)}</div>
            `;

            // Click interaction placeholder
            card.addEventListener('click', () => {
                showToast(`Jumping to timestamp ${res.timestamp}...`);
                // Here we would typically sync a real video player's current time
            });

            resultsGrid.appendChild(card);
        });
    }

    function highlightMatch(text, query) {
        if(!query.trim()) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span style="color: var(--accent-blue); font-weight: bold; text-shadow: 0 0 10px rgba(0,242,254,0.5);">$1</span>');
    }
});
