from flask import Flask, request, jsonify
import json
import os

app = Flask(__name__)
DATA_FILE = "bets.json"

# TODO: add create event endpoint


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


# Endpoints to create a new tournament
# payload = {"tournament": "NAME", "teams": {}, "clean_name": "Name For Forum", "close_date": "m-d-y", "close_time": "00:00:00", "gift_flag": "flag", "image": "link"}
@app.route("/create", methods=["POST"])
def create_tournament():
    data = load_data()
    tourney = request.json
    tournament_name = tourney.get("tournament")
    teams = tourney.get("teams")
    clean_name = tourney.get("clean_name")
    if not tournament_name or not teams or not clean_name:
        return jsonify({"error": "Missing required parameters"}), 400
    newTourney = {}
    newTourney["status"] = "open"
    newTourney["bets"] = {}
    newTourney["teams"] = teams
    newTourney["clean_name"] = clean_name
    newTourney["close_date"] = tourney.get("close_date")
    newTourney["close_time"] = tourney.get("close_time")
    newTourney["gift_flag"] = tourney.get("gift_flag")
    newTourney["image"] = tourney.get("image") or None
    newTourney["total_wagered"] = 0
    data[tournament_name] = newTourney
    save_data(data)
    return jsonify(newTourney), 200


# Endpoint to close a tournament
@app.route("/close/<tournament>", methods=["GET"])
def close_tournament(tournament):
    data = load_data()
    if tournament not in data:
        return jsonify({"error": "Tournament not found"}), 404
    data[tournament]["status"] = "closed"
    save_data(data)
    return jsonify({"message": "Tournament closed successfully"}), 200


# Endpoint to get open tournaments
@app.route("/tournaments/", methods=["GET"])
def get_tournaments():
    data = load_data()
    open_tournaments = {}
    for key, tourney in data.items():
        if tourney["status"] == "open":
            open_tournaments[key] = tourney
    return jsonify(open_tournaments), 200


# Endpoint to get closed tournaments
@app.route("/tournaments/closed", methods=["GET"])
def get_closed_tournaments():
    data = load_data()
    open_tournaments = {}
    for key, tourney in data.items():
        if tourney["status"] == "closed":
            open_tournaments[key] = tourney
    return jsonify(open_tournaments), 200


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
    tournament["total_wagered"] += wager
    save_data(data)
    return jsonify({"message": "Bet added successfully"}), 201


if __name__ == "__main__":
    app.run(debug=True)
