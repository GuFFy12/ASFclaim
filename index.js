const config = require("./config.json");
const fetch = require("node-fetch");
const fs = require("fs");
const webhook = require("webhook-discord");
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit();
const hook = new webhook.Webhook(config.webhookUrl);

let launched = false;
lastLenght();
let lastLength;
function lastLenght() {
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
setInterval(checkGame, config.timeInterval * 60 * 60 * 1000);
function checkGame() {
  let command = { Command: "!status" };
  fetch(config.ipcUrl + "Api/Command/?password=" + config.ipcPass, {
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
          lastLenght();
        }
        claimGame();
      } else {
        sendLog("err", "Error! Check console for more info!");
        console.log(body);
      }
    });
}

function claimGame() {
  octokit.gists.get({ gist_id: config.gistId }).then((gist) => {
    let codes = gist.data.files["Steam Codes"].content.split("\n");
    if (lastLength < codes.length) {
      if (lastLength + config.claimLast < codes.length) {
        sendLog("warn", "Only runs on the last " + config.claimLast + " games");
        lastLength = codes.length - config.claimLast;
      }
      let asfcommand = "!addlicense asf ";
      let claimLinks = "";
      let countgames = codes.length - lastLength;
      for (lastLength; lastLength < codes.length; lastLength++) {
        asfcommand += codes[lastLength] + ", ";
        if (codes[lastLength].indexOf("a/") > -1) {
          claimLinks += codes[lastLength].replace("a/", "https://store.steampowered.com/app/") + ",\n";
        } else {
          claimLinks += codes[lastLength].replace("s/", "https://store.steampowered.com/sub/") + ",\n";
        }
      }
      asfcommand = asfcommand.slice(0, -2);
      claimLinks = claimLinks.slice(0, -2);
      let command = { Command: asfcommand };
      fetch(config.ipcUrl + "Api/Command/?password=" + config.ipcPass, {
        method: "post",
        body: JSON.stringify(command),
        headers: { "Content-Type": "application/json" },
      })
        .then((res) => res.json())
        .then((body) => {
          if (body.Success) {
            if (claimLinks.length < 1000) {
              sendLog("success", "Success claim " + countgames + " game(s):\n" + claimLinks);
            } else {
              sendLog(
                "success",
                "Success claim " +
                  countgames +
                  " game(s) (many characters, sending without links):\n" +
                  asfcommand.replace("!addlicense asf ", "")
              );
            }
            fs.writeFileSync("lastlength", lastLength.toString());
          } else {
            sendLog("err", "Error! Check console for more info!");
            console.log(body);
          }
        });
    } else {
      sendLog("info", "New games not found: " + codes.length + "/" + lastLength);
    }
  });
}

function sendLog(stat, msg) {
  if (stat == "err") {
    hook.err("ASFClaim", msg);
  }
  if (stat == "info") {
    hook.info("ASFClaim", msg);
  }
  if (stat == "warn") {
    hook.warn("ASFClaim", msg);
  }
  if (stat == "success") {
    hook.success("ASFClaim", msg);
  }
  console.log(msg);
}
