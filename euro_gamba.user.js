// ==UserScript==
// @name         GAMBA
// @namespace    http://tampermonkey.net/
// @version      2024-06-14
// @description  sports gambling script
// @author       You
// @match        https://blutopia.cc/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=blutopia.cc
// @grant        GM.xmlHttpRequest
// ==/UserScript==
/*
ALL MATHS DONE BY GPT, so any mathletes please help if you see errors!
TODO: 
Improve the chatbox settings controls for easier event handling.
*/
(function () {
  "use strict";
  const currentURL = window.location.href;
  const isEdit = currentURL.includes("edit");
  const isCreate = currentURL.includes("create");

  let usernameAnchor = document.querySelector(
    ".top-nav__username--highresolution"
  );
  let username = usernameAnchor.querySelector("span").innerText.trim();
  let giftURL = `https://blutopia.cc/users/${username}/gifts`;

  let openEvents, closedEvents;
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
        if (splitMessage.length < 2) {
          console.log("no team given");
          console.log(`/gift ${sender} ${amount} please select a team`);
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
    [*]Send me a gift with the message "{gifting flag} {team}"
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

  function makeTables(totalWagered, teamData, betData) {
    let tableInfo = "[table]";

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
      })
      .catch((error) => {
        console.error("Error in retrieving tournaments:", error);
      });
  }
  function getClosedTournaments() {
    const tournamentsURL = `http://127.0.0.1:5000/tournaments/closed`;
    GM_xmlHttpRequest_promise({
      method: "GET",
      url: tournamentsURL,
    })
      .then((response) => {
        closedEvents = JSON.parse(response.responseText);
        for (const [key, value] of Object.entries(closedEvents)) {
          const gift_flag = value.gift_flag;
          flagDict[gift_flag] = key;
        }
      })
      .catch((error) => {
        console.error("Error in retrieving tournaments:", error);
      });
  }

  function processEvents() {
    let eventsSection = "";
    for (const [key, value] of Object.entries(openEvents)) {
      const teamData = openEvents[key].teams;
      const totalWagered = openEvents[key].total_wagered;
      const betData = openEvents[key].bets;
      const image = openEvents[key].image;
      const bbcodeImage = image ? `[img=250]${image}[/img]` : "";
      const title = openEvents[key].clean_name;
      const giftFlag = openEvents[key].gift_flag;
      const closing =
        openEvents[key].close_date + "-" + openEvents[key].close_time + "UTC";
      const table = makeTables(totalWagered, teamData, betData);
      const teamPortion = `
      [center]${bbcodeImage}
      [b][size=24]${title}[/size][/b]
      [b][size=14]Closing: ${closing}[/size][/b]
      [b][size=14]Total Wagered: ${totalWagered}[/size][/b]
      [spoiler]Gifting Flag = ${giftFlag}
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
        getClosedTournaments();
      })
      .catch((error) => {
        console.error("Error in adding bet:", error);
      });
  }

  function onEditPost() {
    getGifts();
    const textArea = document.getElementById("bbcode-content");
    const newMessage = createPost();
    textArea.value = newMessage;
    textArea.dispatchEvent(new Event("input", { bubbles: true }));
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
  if (isEdit || isCreate) {
    injectEditButton();
  }

  function addSettingsButton() {
    const menuSelector = document.querySelector("#chatbox_header div");
    if (!menuSelector) {
      setTimeout(addSettingsButton, 1000);
      return;
    }
    const settingsButton = document.createElement("span");
    settingsButton.innerHTML = "⚙️";
    settingsButton.style.cursor = "pointer";
    settingsButton.style.marginLeft = "20px";
    settingsButton.addEventListener("click", createModal);
    menuSelector.prepend(settingsButton);
  }

  function addStyle(css) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createModal() {
    const modal = document.createElement("div");
    modal.id = "custom-modal";
    modal.className = "modal-container";
    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    const closeButton = document.createElement("span");
    closeButton.className = "close-button";
    closeButton.innerHTML = "&times;";
    closeButton.onclick = function () {
      modal.style.display = "none";
    };
    modalContent.appendChild(closeButton);
    const content = document.createElement("div");
    content.className = "modal-inner-content";
    content.innerHTML = `
    <h3>GAMBA SETTINGS</h3>
    <div class="modal-form" id="close-event">
    <label for="close-title">Event Name</label>
    <input type="text" id="close-title" />
    <span class="modal-btn" id="close-event-btn">Close</>
    </div>

    <div class="modal-form"  id="end-event">
    <label for="end-title">Event Name</label>
    <input type="text" id="end-title" />
    <label for="winning-team-id">Team ID</label>
    <input type="number" id="winning-team-id"  placeholder="0" />
    <span class="modal-btn" id="end-event-btn">End</>    
    </div>
    `;
    modalContent.appendChild(content);

    modal.appendChild(modalContent);

    document.body.appendChild(modal);
    const closeEventBtn = document.getElementById("close-event-btn");
    closeEventBtn.onclick = function () {
      const closeTitle = document.getElementById("close-title").value;
      const closeURL = `http://127.0.0.1:5000/close/${closeTitle}`;
      GM_xmlHttpRequest_promise({
        headers: {
          "Content-type": "application/json",
          Accept: "application/json",
        },
        method: "GET",
        url: closeURL,
      })
        .then(() => {
          getOpenTournaments();
          getClosedTournaments();
        })
        .catch((error) => {
          console.error("Error in closing event:", error);
        });
    };
    const endEventBtn = document.getElementById("end-event-btn");
    endEventBtn.onclick = function () {
      const teamID = parseInt(document.getElementById("winning-team-id").value);
      const eventName = document.getElementById("end-title").value;
      const bets = closedEvents[eventName].bets || undefined;
      const totalWagered = closedEvents[eventName].total_wagered;
      if (!bets) return;

      let teamWagers = {};

      for (let user in bets) {
        const team = bets[user].team;
        const wager = bets[user].wager;

        if (!teamWagers[team]) {
          teamWagers[team] = 0;
        }
        teamWagers[team] += wager;
      }
      for (let user in bets) {
        const bet = bets[user];
        if (bet.team === teamID) {
          const userWager = bet.wager;
          const teamTotalWagered = teamWagers[teamID];
          const userReward = (userWager / teamTotalWagered) * totalWagered;

          console.log(
            `/gift ${user} ${userReward.toFixed(2)} Congrats you won!`
          );
        }
      }
    };

    addStyle(`
        label {
        margin-top:10px;}
        .modal-btn {
        cursor: pointer;
        }
        .modal-form {
            display: flex;
            height: 100px;
            flex-direction: column;
            margin-bottom: 10px;
        }
        .modal-container {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            justify-content: center;
            align-items: center;
        }
        .modal-content {
            background-color: #333;
            padding: 20px;
            border: 1px solid #888;
            width: 400px;
            height: 400px;
            overflow-y: scroll;
            position: relative;
        }
        .close-button {
            color: #aaa;
            position: absolute;
            top: 10px;
            right: 25px;
            font-size: 28px;
            font-weight: bold;
        }
        .close-button:hover,
        .close-button:focus {
            color: black;
            text-decoration: none;
            cursor: pointer;
        }
        .modal-inner-content {
            max-height: 300px; /* Adjust as needed to fit within the modal content */
        }
    `);
    modal.style.display = "flex";
  }
  getClosedTournaments();
  getOpenTournaments();
  addSettingsButton();
})();
