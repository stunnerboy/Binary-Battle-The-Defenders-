import os
from flask import Flask, request, jsonify, render_template
import time
import threading
import uuid

app = Flask(__name__)
# Enable CORS for development
from flask_cors import CORS
CORS(app)

# In-memory storage for processing tasks
tasks = {}

def process_video_task(task_id, source_url):
    """
    Simulates speech-to-text and OCR backend processing.
    In a real app, this would use yt-dlp to download, AssemblyAI/Whisper to transcribe,
    and PyTesseract/Google Vision for OCR frame analysis.
    """
    tasks[task_id]['status'] = 'downloading'
    tasks[task_id]['progress'] = 10
    time.sleep(2)
    
    tasks[task_id]['status'] = 'extracting_audio'
    tasks[task_id]['progress'] = 30
    time.sleep(2)
    
    tasks[task_id]['status'] = 'speech_to_text'
    tasks[task_id]['progress'] = 50
    time.sleep(3)
    
    tasks[task_id]['status'] = 'ocr_analysis'
    tasks[task_id]['progress'] = 75
    time.sleep(3)
    
    # Mock result with sample transcripts and frames
    tasks[task_id]['status'] = 'completed'
    tasks[task_id]['progress'] = 100
    tasks[task_id]['results'] = [
        {"type": "stt", "timestamp": "0:12", "text": "Welcome to this introduction to machine learning."},
        {"type": "ocr", "timestamp": "0:25", "text": "Slide: Supervised vs Unsupervised Learning"},
        {"type": "stt", "timestamp": "1:05", "text": "Here we can see an example of deep neural networks."},
        {"type": "ocr", "timestamp": "1:15", "text": "Equation: y = Wx + b"},
        {"type": "stt", "timestamp": "2:30", "text": "Now let's talk about convolutional neural networks and search engines."},
        {"type": "ocr", "timestamp": "2:35", "text": "Architecture Diagram: CNNs"},
    ]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/process', methods=['POST'])
def process_video():
    data = request.json
    source_url = data.get('url', '')
    if not source_url:
        return jsonify({"error": "No URL provided"}), 400
    
    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        'id': task_id,
        'status': 'queued',
        'progress': 0,
        'source': source_url,
        'results': []
    }
    
    # Start background processing thread
    t = threading.Thread(target=process_video_task, args=(task_id, source_url))
    t.start()
    
    return jsonify({"task_id": task_id, "message": "Video processing started"})

@app.route('/api/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    task = tasks.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    return jsonify({
        "status": task['status'],
        "progress": task['progress']
    })

@app.route('/api/search/<task_id>', methods=['GET'])
def search_video(task_id):
    keyword = request.args.get('q', '').lower()
    task = tasks.get(task_id)
    
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if task['status'] != 'completed':
        return jsonify({"error": "Video not fully processed yet"}), 400
        
    results = task.get('results', [])
    if keyword:
        # Filter results by keyword for both STT and OCR
        matches = [r for r in results if keyword in r['text'].lower()]
    else:
        matches = results
        
    return jsonify({"matches": matches})

if __name__ == '__main__':
    # Run the Flask app
    app.run(debug=True, port=5000)
