const fetch = require("node-fetch");
const fs = require("fs");
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit();
const config = require("config");
const ipcurl = config.get("ipcurl");
const ipcpassword = config.get("ipcpassword");
const timeinterval = config.get("timeinterval");
const claimlast = config.get("claimlast");
const gistid = config.get("gistid");
const webhookurl = config.get("webhookurl");

if (webhookurl.includes("https")) {
  var webhook = require("webhook-discord");
  var Hook = new webhook.Webhook(webhookurl);
  var sendwebhook = true;
} else {
  sendLog("warn", "Discord webhook link is missing!");
  var sendwebhook = false;
}

var launched = false;

lastlenghtfunc();
let lastLength;
function lastlenghtfunc() {
  fs.readFile("lastlength", function read(err, data) {
    if (!err && data) {
      lastLength = data;
    } else if (err.code == "ENOENT") {
      fs.writeFileSync("lastlength", "0");
      sendLog("info", "Looks like you first time run ASFClaim. Generate lastlength file...");
    } else {
      sendLog("err", "Error with lastlength: " + err.code);
    }
  });
}

checkGame();
setInterval(checkGame, timeinterval * 60 * 60 * 1000);
function checkGame() {
  let command = { Command: "!status" };
  fetch(ipcurl + "Api/Command/?password=" + ipcpassword, {
    method: "post",
    body: JSON.stringify(command),
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => res.json())
    .catch(() => {
      sendLog("err", "Unable connect to IPC!");
    })
    .then((body) => {
      if (body.Success) {
        if (!launched) {
          sendLog("info", "ASFClaim successfully launched!");
          launched = true;
          lastlenghtfunc();
        }
        claimGame();
      }
    });
}

function claimGame() {
  octokit.gists.get({ gist_id: gistid }).then((gist) => {
    let codes = gist.data.files["Steam Codes"].content.split("\n");
    if (lastLength < codes.length) {
      if (lastLength + claimlast < codes.length) {
        sendLog("warn", "Only runs on the last " + claimlast + " games");
        lastLength = codes.length - claimlast;
      }
      let asfcommand = "!addlicense asf ";
      let claimlinks = "";
      var countgames = codes.length - lastLength;
      for (lastLength; lastLength < codes.length; lastLength++) {
        asfcommand += codes[lastLength] + ", ";
        if (codes[lastLength].indexOf("a/") > -1) {
          claimlinks += codes[lastLength].replace("a/", "https://store.steampowered.com/app/") + ",\n";
        } else {
          claimlinks += codes[lastLength].replace("s/", "https://store.steampowered.com/sub/") + ",\n";
        }
      }
      asfcommand = asfcommand.slice(0, -2);
      claimlinks = claimlinks.slice(0, -2);
      let command = { Command: asfcommand };
      fetch(ipcurl + "Api/Command/?password=" + ipcpassword, {
        method: "post",
        body: JSON.stringify(command),
        headers: { "Content-Type": "application/json" },
      })
        .then((res) => res.json())
        .then((body) => {
          if (body.Success) {
            if (claimlinks.length < 1000) {
              sendLog("success", "Success claim " + countgames + " game(s):\n" + claimlinks);
            } else {
              sendLog("success", "Success claim " + countgames + " game(s) (many characters, sending without links):\n" + asfcommand.replace("!addlicense asf ", ""));
            }
            fs.writeFileSync("lastlength", lastLength.toString());
          } else {
            sendLog("err", "Error: " + body);
          }
        });
    } else {
      sendLog("info", "New games not found: " + codes.length + "/" + lastLength);
    }
  });
}

function sendLog(stat, msg) {
  if (sendwebhook == true) {
    if (stat == "err") {
      Hook.err("ASFClaim", msg);
    }
    if (stat == "info") {
      Hook.info("ASFClaim", msg);
    }
    if (stat == "warn") {
      Hook.warn("ASFClaim", msg);
    }
    if (stat == "success") {
      Hook.success("ASFClaim", msg);
    }
  }
  console.log(msg);
}
