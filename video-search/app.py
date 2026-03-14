import os
from flask import Flask, request, jsonify, render_template
import time
import uuid

app = Flask(__name__)
# Enable CORS for development
from flask_cors import CORS
CORS(app)

# In-memory storage for video intelligence indexes
intelligence_store = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/resolve', methods=['POST'])
def resolve_video():
    """
    Simulates resolving a platform link (YouTube/Coursera) to a playable source.
    In a production app, this would use a service or library to get steam URLs.
    """
    data = request.json
    url = data.get('url', '')
    
    if 'youtube.com' in url or 'youtu.be' in url:
        # Mocking a resolved video stream for demo purposes
        # In reality, you'd need a proxy or a resolved URL
        return jsonify({
            "resolved_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "title": "YouTube Lecture: Advanced AI Architectures",
            "platform": "YouTube",
            "note": "Resolved via Visionary Proxy"
        })
    elif 'coursera' in url:
        return jsonify({
            "resolved_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            "title": "Coursera: Machine Learning Specialization",
            "platform": "Coursera"
        })
    else:
        # Return the raw URL if it looks like a direct video
        return jsonify({
            "resolved_url": url,
            "title": "Direct Video Source",
            "platform": "Direct"
        })

@app.route('/api/intelligence/stt', methods=['GET'])
def get_mock_stt():
    """
    Simulates a Speech-to-Text API result for a video ID.
    Returns transcriptions with timestamps.
    """
    video_id = request.args.get('id', 'default')
    
    # Mocked transcript related to machine learning
    transcript = [
        {"time": 5, "text": "Welcome to the introduction of neural networks."},
        {"time": 45, "text": "As we can see, gradient descent is the core optimization algorithm."},
        {"time": 120, "text": "Backpropagation allows us to calculate gradients across layers."},
        {"time": 180, "text": "Let's look at the implementation of a convolutional layer."},
        {"time": 240, "text": "Artificial intelligence is transforming the search engine landscape."},
    ]
    
    return jsonify({"transcript": transcript})

@app.route('/api/intelligence/save', methods=['POST'])
def save_index():
    data = request.json
    video_id = data.get('video_id', str(uuid.uuid4()))
    index_data = data.get('index', [])
    
    intelligence_store[video_id] = index_data
    return jsonify({"status": "success", "video_id": video_id})

@app.route('/api/intelligence/load/<video_id>', methods=['GET'])
def load_index(video_id):
    index_data = intelligence_store.get(video_id, [])
    return jsonify({"index": index_data})

if __name__ == '__main__':
    # Use environment variables for port if needed
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, port=port)
