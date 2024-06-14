from flask import Flask, request, jsonify
import json
import os

app = Flask(__name__)
DATA_FILE = "bets.json"


# Load data from the JSON file
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as file:
            return json.load(file)
    return {"EURO_24": {"teams": {}, "bets": {}}, "COPA_24": {"teams": {}, "bets": {}}}


# Save data to the JSON file
def save_data(data):
    with open(DATA_FILE, "w") as file:
        json.dump(data, file, indent=4)


# Function to get the team id from a team name or alias
def get_team_id(tournament, team_name):
    teams = tournament.get("teams", {})
    for team_id, names in teams.items():
        if team_name in names:
            return int(team_id)
    return None


# Endpoint to add a user's bet
@app.route("/bet", methods=["POST"])
def add_bet():
    data = load_data()
    bet = request.json
    print(data, bet)
    tournament_name = bet.get("tournament")
    username = bet.get("username")
    wager = bet.get("wager")
    team_name = bet.get("team")
    if not tournament_name or not username or wager is None or not team_name:
        return jsonify({"error": "Missing required parameters"}), 400

    if tournament_name not in data:
        return jsonify({"error": "Tournament not found"}), 404

    tournament = data[tournament_name]

    if username in tournament["bets"]:
        return (
            jsonify({"error": "User has already placed a bet on this tournament"}),
            400,
        )

    team_id = get_team_id(tournament, team_name)
    if team_id is None:
        return jsonify({"error": "Invalid team"}), 400

    tournament["bets"][username] = {"wager": wager, "team": team_id}
    save_data(data)
    return jsonify({"message": "Bet added successfully"}), 201


# Endpoint to get all bets for a specific tournament
@app.route("/bets/<tournament>", methods=["GET"])
def get_bets(tournament):
    data = load_data()
    if tournament not in data:
        return jsonify({"error": "Tournament not found"}), 404
    return jsonify(data[tournament]["bets"])


# Endpoint to get all teams for a specific tournament
@app.route("/teams/<tournament>", methods=["GET"])
def get_teams(tournament):
    data = load_data()
    if tournament not in data:
        return jsonify({"error": "Tournament not found"}), 404
    return jsonify(data[tournament]["teams"])


# Endpoint to get a specific user's bet for a specific tournament
@app.route("/bet/<tournament>/<username>", methods=["GET"])
def get_bet(tournament, username):
    data = load_data()
    if tournament not in data:
        return jsonify({"error": "Tournament not found"}), 404
    if username not in data[tournament]["bets"]:
        return jsonify({"error": "User bet not found"}), 404
    return jsonify(data[tournament]["bets"][username])


if __name__ == "__main__":
    app.run(debug=True)
