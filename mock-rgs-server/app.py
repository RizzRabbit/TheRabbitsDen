import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Mock data - you can adjust these values as needed
mock_balance = 1000000000  # $1000.00
mock_session_id = "test_session_123"

mock_bet_modes = {
    "BASE": {"cost_multiplier": 1, "description": "Standard Play"},
    "SUPER": {"cost_multiplier": 1.5, "description": "Super Play (1.5x cost, higher win potential)"},
    "MEGA": {"cost_multiplier": 2, "description": "Mega Play (2x cost, even higher win potential)"},
}

mock_config = {
    "minBet": 100000,  # $0.10
    "maxBet": 1000000000, # $1000.00
    "stepBet": 10000,  # $0.01
    "defaultBetLevel": 1000000, # $1.00
    "betLevels": [
        100000, # $0.10
        500000, # $0.50
        1000000, # $1.00
        2000000, # $2.00
        5000000, # $5.00
        10000000, # $10.00
    ],
    "jurisdiction": {
        "socialCasino": False,
        "disabledFullscreen": False,
        "disabledTurbo": False,
    },
    "betModes": mock_bet_modes
}

@app.route('/wallet/authenticate', methods=['POST'])
def authenticate():
    data = request.get_json()
    session_id = data.get('sessionID')

    if session_id != mock_session_id:
        return jsonify({"error": {"statusCode": 400, "message": "ERR_IS"}}), 400

    return jsonify({
        "balance": {"amount": mock_balance, "currency": "USD"},
        "config": mock_config,
        "round": {} # Placeholder for round data
    })

@app.route('/wallet/balance', methods=['POST'])
def get_balance():
    data = request.get_json()
    session_id = data.get('sessionID')

    if session_id != mock_session_id:
        return jsonify({"error": {"statusCode": 400, "message": "ERR_IS"}}), 400

    return jsonify({
        "balance": {"amount": mock_balance, "currency": "USD"}
    })

@app.route('/wallet/play', methods=['POST'])
def play():
    global mock_balance
    data = request.get_json()
    session_id = data.get('sessionID')
    amount = data.get('amount')
    mode = data.get('mode', 'BASE') # Default to BASE if not provided

    if session_id != mock_session_id:
        return jsonify({"error": {"statusCode": 400, "message": "ERR_IS"}}), 400

    if mode not in mock_bet_modes:
        return jsonify({"error": {"statusCode": 400, "message": "ERR_VAL", "details": "Invalid bet mode"}}), 400

    cost_multiplier = mock_bet_modes[mode]["cost_multiplier"]
    effective_amount = int(amount * cost_multiplier)

    if effective_amount > mock_balance:
        return jsonify({"error": {"statusCode": 400, "message": "ERR_IPB"}}), 400

    # Deduct bet amount
    mock_balance -= effective_amount

    # Call math-sdk server for game outcome
    math_sdk_url = "http://localhost:5001/spin"
    try:
        math_sdk_response = requests.post(math_sdk_url, json={
            "amount": amount, # Pass original amount to math-sdk
            "mode": mode
        })
        math_sdk_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        math_sdk_data = math_sdk_response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error communicating with math-sdk: {e}")
        return jsonify({"error": {"statusCode": 500, "message": "ERR_GEN", "details": "Failed to get game outcome from math-sdk"}}), 500

    # Update balance with win from math-sdk
    total_win_amount = math_sdk_data.get("total_win_amount", 0)
    mock_balance += total_win_amount

    return jsonify({
        "balance": {"amount": mock_balance, "currency": "USD"},
        "round": math_sdk_data # Pass the entire math-sdk response as round data
    })

@app.route('/wallet/endround', methods=['POST'])
def end_round():
    data = request.get_json()
    session_id = data.get('sessionID')

    if session_id != mock_session_id:
        return jsonify({"error": {"statusCode": 400, "message": "ERR_IS"}}), 400

    return jsonify({
        "balance": {"amount": mock_balance, "currency": "USD"}
    })

@app.route('/bet/event', methods=['POST'])
def bet_event():
    data = request.get_json()
    session_id = data.get('sessionID')
    event = data.get('event')

    if session_id != mock_session_id:
        return jsonify({"error": {"statusCode": 400, "message": "ERR_IS"}}), 400

    return jsonify({"event": event})

if __name__ == '__main__':
    app.run(debug=True, port=3000)
