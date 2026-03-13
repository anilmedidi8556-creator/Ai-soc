import json
import os
import random
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DATASET_PATH = os.path.join(os.path.dirname(__file__), 'datasets', 'logs.json')

def load_logs():
    try:
        with open(DATASET_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading logs: {e}")
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/logs', methods=['GET'])
def api_logs():
    logs = load_logs()
    
    # Simulate dynamic logs for realism
    if random.random() > 0.6:
        new_log = {
            "id": random.randint(10000, 99999),
            "timestamp": "2026-03-13T11:35:00Z", # simulated timestamp
            "source_ip": f"192.168.1.{random.randint(2, 254)}",
            "destination_ip": f"10.0.0.{random.randint(1, 100)}",
            "event_type": random.choice(["Connection Attempt", "Login Failed", "Port Scan", "Malware Detected"]),
            "severity": random.choice(["low", "medium", "high", "critical"]),
            "status": random.choice(["allowed", "blocked", "flagged"]),
            "description": "Auto-generated simulated log entry."
        }
        logs.insert(0, new_log)
        
        # In a real app we'd save it back, but let's just return it dynamically here
    
    return jsonify(logs[:50])

@app.route('/api/stats', methods=['GET'])
def api_stats():
    logs = load_logs()
    total_events = len(logs) + random.randint(100, 1000)
    critical_alerts = sum(1 for log in logs if log.get('severity') in ['high', 'critical'])
    active_threats = random.randint(1, 15)
    resolved_threats = random.randint(50, 200)
    
    return jsonify({
        "total_events": total_events,
        "critical_alerts": critical_alerts,
        "active_threats": active_threats,
        "resolved_threats": resolved_threats
    })

@app.route('/api/alerts', methods=['GET'])
def api_alerts():
    logs = load_logs()
    alerts = [log for log in logs if log.get('severity') in ['high', 'critical']]
    return jsonify(alerts)

@app.route('/api/block-ip', methods=['POST'])
def block_ip():
    data = request.json
    ip_to_block = data.get('ip')
    
    if not ip_to_block:
        return jsonify({"success": False, "message": "No IP provided"}), 400
        
    # Simulate blocking logic
    return jsonify({"success": True, "message": f"IP {ip_to_block} blocked successfully"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
