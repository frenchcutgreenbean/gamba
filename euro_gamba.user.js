// ==UserScript==
// @name         EURO_24
// @namespace    http://tampermonkey.net/
// @version      2024-06-14
// @description  gamba script for Euro 2024
// @author       You
// @match        https://blutopia.cc/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=blutopia.cc
// @grant        GM.xmlHttpRequest
// ==/UserScript==
/*
TODO: 
Set the winning team
Chatbox gift winning commands.
Closed odds section.
*/
(function () {
  "use strict";
  let usernameAnchor = document.querySelector(
    ".top-nav__username--highresolution"
  );
  let username = usernameAnchor.querySelector("span").innerText.trim();
  let giftURL = `https://blutopia.cc/users/${username}/gifts`;

  let openEvents;
  let flagDict = {};

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
        const tourneyKey = flagDict[splitMessage[0].toLowerCase().trim()];
        if (sender === username) continue;
        if (!splitMessage || !tourneyKey) {
          continue;
        }
        if (openEvents[tourneyKey].bets[sender]) {
          console.log("already in tournament: " + sender);
          continue;
        }
        giftData.push({
          tourneyKey,
          amount,
          sender,
          team: splitMessage[1].toLowerCase(),
        });
      }
    }

    giftData.forEach((data) => {
      addBet(data.tourneyKey, data.sender, data.amount, data.team);
    });
  }

  function createPost() {
    const baseMessage = `
    [center][img=100]https://i.ibb.co/DL2zLYr/BIGMONEY.gif[/img]
    [b][size=24]GAMBA!![/size][/b]

    Extreme Early ALPHA. Bet BON.[/center]

    [b][size=24]How it works:[/size][/b]
    [list][*]Wager to win BON based on total of other bets & total of other bets on your prediction.
    [*]Odds are based on the assumption you are betting 100k.
    [*]Odds are locked when betting is CLOSED.
    [*]If the total pot is 1m and you were the only user to predict x team you win the whole pot.[/list]

    Github: [url=https://github.com/frenchcutgreenbean/gamba/]Repo[/url] | [url=https://github.com/frenchcutgreenbean/gamba/blob/main/bets.json]Bets[/url]
    
    [b][size=24]Winning Calculation:[/size][/b]
    Assuming you pick the winning team.
         (Your wager / Total wager on team) * Total pot ≈ winnings
    e.g. (500,000 / 883,333) * 7,000,000 ≈ 3,946,656 BON
    
    [b][size=24]How to enter:[/size][/b][list]
    [*]Send me a gift with the message "{tourney_flag} {team}"
    Chatbox Examples:
    /gift ${username} 100000 euro esp
    /gift ${username} 100000 euro Germany
    [*]Make sure your wager is between 50k and 500k.[/list]

    [b][size=24]Rules:[/size][/b]
    [list][*]You can only make 1 wager!
    [*]Bet limits are 50k min and 500k max.
    [*]No refunds on valid wagers.
    [/list]

    [b][size=24]Open Bets.[/size][/b]
  `;

    const eventsSection = processEvents();
    const newMessage = baseMessage + eventsSection;
    return newMessage;
  }

  function makeTables(teamData, betData) {
    let tableInfo = "[table]";

    let totalWagered = 0;
    for (let user in betData) {
      totalWagered += betData[user].wager;
    }

    for (let teamIndex in teamData) {
      let teamName = teamData[teamIndex][0].toLowerCase();
      teamName = teamName[0].toUpperCase() + teamName.substring(1);

      let teamWagers = 0;

      for (let user in betData) {
        if (betData[user].team === parseInt(teamIndex)) {
          teamWagers += betData[user].wager;
        }
      }

      const maxPayoutRatio = totalWagered / 100000; // Assuming base wager of 100000
      let odds = teamWagers > 0 ? maxPayoutRatio / (teamWagers / 100000) : 0;
      tableInfo += `[tr][td]${teamName}[/td][td]${odds.toFixed(2)}[/td][/tr]`;
    }

    const date = new Date();
    tableInfo += `[/table]
    Last Updated (UTC): ${date.toUTCString()}
    `;
    const newTable = "[center]" + tableInfo + "[/center]";
    return newTable;
  }

  function getOpenTournaments() {
    const tournamentsURL = `http://127.0.0.1:5000/tournaments`;
    GM_xmlHttpRequest_promise({
      method: "GET",
      url: tournamentsURL,
    })
      .then((response) => {
        openEvents = JSON.parse(response.responseText);
        for (const [key, value] of Object.entries(openEvents)) {
          const gift_flag = value.gift_flag;
          flagDict[gift_flag] = key;
        }
        getGifts();
      })
      .catch((error) => {
        console.error("Error in retrieving tournaments:", error);
      });
  }

  function processEvents() {
    let eventsSection = "";
    for (const [key, value] of Object.entries(openEvents)) {
      const teamData = openEvents[key].teams;
      const betData = openEvents[key].bets;
      const image = openEvents[key].image;
      const bbcodeImage = image ? `[img=350]${image}[/img]` : "";
      const title = openEvents[key].clean_name;
      const giftFlag = openEvents[key].gift_flag;
      const closing =
        openEvents[key].close_date + "-" + openEvents[key].close_time + "UTC";
      const table = makeTables(teamData, betData);
      const teamPortion = `
      [center]${bbcodeImage}
      [b][size=24]${title}[/size][/b]
      [b][size=18]Closing: ${closing}[/size][/b]
      [spoiler]
      Gifting Flag = ${giftFlag}
      ${table}
      [/spoiler]
      [/center]
      `;
      eventsSection += teamPortion;
    }
    return eventsSection;
  }

  function addBet(tourney, username, wager, team) {
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
        tournament: tourney,
        username,
        wager,
        team,
      }),
    })
      .then(() => {
        getOpenTournaments();
      })
      .catch((error) => {
        console.error("Error in adding bet:", error);
      });
  }

  function onEditPost() {
    const textArea = document.getElementById("bbcode-content");
    const newMessage = createPost();
    textArea.value = newMessage;
  }

  function injectEditButton() {
    const injectPoint = document.querySelector("h2.panel__heading");
    const editButton = document.createElement("span");
    editButton.innerHTML = "✏️";
    editButton.style.cursor = "pointer";
    editButton.style.marginLeft = "20px";
    editButton.addEventListener("click", onEditPost);
    injectPoint.appendChild(editButton);
  }
  injectEditButton();
  getOpenTournaments();
})();
