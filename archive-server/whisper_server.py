#!/usr/bin/env python3
import os
import whisper
from flask import Flask, request, jsonify

app = Flask(__name__)

# Load model once at startup
MODEL_PATH = os.getenv('WHISPER_MODEL', 'base')
model = whisper.load_model(MODEL_PATH, device='cpu')

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/v1/audio/transcriptions', methods=['POST'])
def transcribe():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        language = request.form.get('language', None)
        
        # Save temp file
        temp_path = '/tmp/audio_temp'
        file.save(temp_path)
        
        # Transcribe
        result = model.transcribe(temp_path, language=language)
        
        # Clean up
        os.remove(temp_path)
        
        return jsonify({
            "text": result["text"],
            "language": result.get("language", "unknown")
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)
