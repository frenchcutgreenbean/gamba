// ==UserScript==
// @name         EURO_24
// @namespace    http://tampermonkey.net/
// @version      2024-06-14
// @description  gamba script for Euro 2024
// @author       You
// @match        https://blutopia.cc/forums/topics/5827*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=blutopia.cc
// @grant        GM.xmlHttpRequest
// ==/UserScript==

(function () {
  "use strict";
  const tournament = "EURO_24";
  let usernameAnchor = document.querySelector(
    ".top-nav__username--highresolution"
  );
  let username = usernameAnchor.querySelector("span").innerText.trim();
  let giftURL = `https://blutopia.cc/users/${username}/gifts`;
  let betsData, teamsData, teamOdds;

  function GM_xmlHttpRequest_promise(details) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        ...details,
        onload: (response) => {
          console.log("Request successful:", response);
          resolve(response);
        },
        onerror: (error) => {
          console.error("Request failed:", error);
          reject(error);
        },
      });
    });
  }

  async function getGifts() {
    try {
      const response = await GM_xmlHttpRequest_promise({
        method: "GET",
        url: giftURL,
      });
      const parser = new DOMParser();
      const data = parser.parseFromString(response.responseText, "text/html");
      parseGifts(data);
    } catch (error) {
      console.error("Error in getGifts:", error);
    }
  }

  function parseGifts(data) {
    const gifts = data.querySelectorAll(".data-table tr");
    const giftData = [];

    for (let gift of gifts) {
      const cells = gift.querySelectorAll("td");
      if (cells.length > 0) {
        // Ensure that the row has td elements
        const sender = cells[0].innerText.trim();
        let amount = cells[2].innerText.trim();
        amount = parseInt(amount);
        const message = cells[3].innerText.trim();
        const splitMessage = message.split(" ");
        const isGamba = tournament
          .toLowerCase()
          .includes(splitMessage[0].toLowerCase());
        if (sender === username) continue;
        if (!splitMessage || !isGamba) {
          continue;
        }
        if (betsData[sender]) {
          console.log("already in tournament: " + sender);
          continue;
        }
        giftData.push({ amount, sender, team: splitMessage[1].toLowerCase() });
      }
    }

    giftData.forEach((data) => {
      addBet(data.sender, data.amount, data.team);
    });
  }

  function editForum() {
    const mainImage =
      "https://i.ibb.co/L9kx0Nm/22700824-euro-2024-allemagne-officiel-logo-avec-nom-bleu-symbole-europeen-football-final-conception.webp";
    const tournamentTitle = "UEFA EURO 2024";
    const giftExample = "euro";
    const teamExamples = ["esp", "Germany"];

    const forumMessage = `
[center]
[url=${mainImage}][img=350]${mainImage}[/img][/url] 

[b][size=24]${tournamentTitle}[/size][/b]

Bet BON.
[/center]

[b][size=24]How it works:[/size][/b]
[list]
[*]Wager to win BON based on total of other bets & total of other bets on your prediction.
[*]Odds are based on the assumption you are betting 100k.
[*]Odds are locked when betting is CLOSED.
[*]If the total pot is 1m and you were the only user to predict x team you win the whole pot. [/list]

[b][size=24]How to enter:[/size][/b][list]
[*]Send me a gift with the message "${giftExample} {team}"
Chatbox Examples:
/gift ${username} 100000 ${giftExample} ${teamExamples[0]}
/gift ${username} 100000 ${giftExample} ${teamExamples[1]}
[*]Make sure your wager is between 50k and 500k.
[/list]

[b][size=24]Rules:[/size][/b]

[list]
[*]You can only make 1 wager!
[*]Bet limits are 50k min and 500k max.
[*]No refunds on valid wagers.
[/list]

    `;
    teamOdds = calculateOdds(teamsData, betsData);
    let tableInfo = "[table]";
    for (let teamIndex in teamOdds) {
      let teamName = teamsData[teamIndex][0];
      teamName = teamName[0].toUpperCase() + teamName.substring(1);
      console.log(teamOdds[teamIndex])
      tableInfo += `[tr][td]${teamName}[/td][td]${teamOdds[teamIndex]}[/td][/tr]`;

      if (teamIndex == Object.keys(teamOdds).length - 1) {
        const date = new Date();
        tableInfo += `[/table]
            Last Updated (UTC): ${date.toUTCString()}
            `;
      }
    }
    let newMessage = forumMessage + "[center]" + tableInfo + "[/center]";
    console.log(newMessage);
  }

  function getTourneyData() {
    const betURL = `http://127.0.0.1:5000/bets/${tournament}`;
    const teamURL = `http://127.0.0.1:5000/teams/${tournament}`;
    GM_xmlHttpRequest_promise({
      method: "GET",
      url: betURL,
    }).then((response) => {
      betsData = JSON.parse(response.responseText);
      console.log(betsData);
    });
    GM_xmlHttpRequest_promise({
      method: "GET",
      url: teamURL,
    }).then((response) => {
      teamsData = JSON.parse(response.responseText);
      console.log(teamsData);
      // Print or display odds

      teamOdds = calculateOdds(teamsData, betsData);
      editForum();
    });
  }

  getTourneyData();

  function addBet(username, wager, team) {
    if (wager > 500000 || wager < 50000) {
      console.log("Wager not accepted");
      console.log(
        `/gift ${username} ${wager} Please re-enter with a wager between 50k and 500k`
      );
      return;
    }
    const betURL = `http://127.0.0.1:5000/bet`;
    GM_xmlHttpRequest_promise({
      headers: {
        "Content-type": "application/json",
        Accept: "application/json",
      },
      method: "POST",
      url: betURL,
      data: JSON.stringify({
        tournament,
        username,
        wager,
        team,
      }),
    });
    getTourneyData();
  }
  getGifts();

  function calculateOdds(teams, bets) {
    let totalWagered = 0;
    for (let user in bets) {
      totalWagered += bets[user].wager;
    }
    let maxPayoutRatio = totalWagered / 100000; // Assuming base wager of 100000

    let odds = {};
    for (let teamIndex in teams) {
      let teamWagers = 0;

      for (let user in bets) {
        if (bets[user].team === parseInt(teamIndex)) {
          teamWagers += bets[user].wager;
        }
      }

      if (teamWagers > 0) {
        odds[teamIndex] = maxPayoutRatio / (teamWagers / 100000);
      } else {
        odds[teamIndex] = 0; // Set default odds if no wagers are placed on the team
      }
    }

    return odds;
  }
})();
