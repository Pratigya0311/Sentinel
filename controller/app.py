import os
from flask import Flask, jsonify, request
from logic import ControllerState, update_state

app = Flask(__name__)
state = ControllerState()


@app.get("/health")
def health():
    return jsonify({"service": "controller", "status": "ok", "state": state.__dict__})


@app.get("/state")
def read_state():
    return jsonify(state.__dict__)


@app.post("/ingest")
def ingest():
    global state
    payload = request.get_json(silent=True) or {}
    state = update_state(state, payload)
    return jsonify(state.__dict__)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
