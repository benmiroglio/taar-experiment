"use strict";

const {utils: Cu} = Components;
const CONFIGPATH = `${__SCRIPT_URI_SPEC__}/../Config.jsm`;
const { config } = Cu.import(CONFIGPATH, {});
const studyConfig = config.study;
const log = createLog(studyConfig.studyName, config.log.bootstrap.level);
Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource://gre/modules/ClientID.jsm");
Cu.import("resource://gre/modules/TelemetryEnvironment.jsm");
Cu.import("resource://gre/modules/TelemetryController.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import('resource://gre/modules/Services.jsm');
const STUDYUTILSPATH = `${__SCRIPT_URI_SPEC__}/../${studyConfig.studyUtilsPath}`;
const { studyUtils } = Cu.import(STUDYUTILSPATH, {});

console.log({"CONFIG": config})
class clientStatus {
  constructor() {
    this.clickedButton = false;
    this.sawPop = false;
    this.activeAddons = new Set()
    this.addonHistory  = new Set()
    this.lastInstalled = null
    this.lastDisabled = null
    this.startTime = null
  }

  updateAddons() {
    let prev = this.activeAddons
    let curr = getNonSystemAddons()

    console.log({'prev':prev, 'curr':curr})

    let currDiff = curr.difference(prev)
    if (currDiff.size > 0) { // an add-on was installed or re-enabled
      var newInstalls = curr.difference(this.addonHistory)
      if (newInstalls.size > 0) { // new install, not a re-enable
        this.lastInstalled = newInstalls.values().next().value
      }
    } else { //an add-on was disabled or uninstalled
      this.lastDisabled =  prev.difference(curr).values().next().value
    }
    this.activeAddons = curr
  }
}

function getNonSystemAddons() {
  var activeAddons = TelemetryEnvironment.currentEnvironment.addons.activeAddons
  var result = new Set()
  for (var addon in activeAddons) {
    let data = activeAddons[addon]
    if (!data.isSystem && !data.foreignInstall) {
      result.add(addon)
    }
  }
  return(result)
}

function getNonSystemAddonData() {
  var activeAddons = TelemetryEnvironment.currentEnvironment.addons.activeAddons
  for (var addon in activeAddons) {
    let data = activeAddons[addon]
    if (!data.isSystem && !data.foreignInstall) {
      console.log(data)
    }
  }
}

function addonChangeListener(change, client) {
  if (change == "addons-changed") {
    console.log("\n\n SOMETHING CHANGED WITH ADDONS... \n\n\n -----------------")
    client.updateAddons()
    var uri = Services.wm.getMostRecentWindow('navigator:browser').gBrowser.currentURI.asciiSpec;
    if (client.lastInstalled) {
      //send telemetry
      var dataOut = {
           "clickedButton": String(client.clickedButton),
           "sawPopup": String(client.sawPopup),
           "startTime": String(client.startTime),
           "addon_id": String(client.lastInstalled),
           "srcURI": String(uri),
           "pingType": "install"
        }
      console.log("Just installed", client.lastInstalled, "from", uri)
      console.log(dataOut)
      studyUtils.telemetry(dataOut)

      /////
      client.lastInstalled = null;
    }
    else if (client.lastDisabled) {
      console.log("Just disabled", client.lastDisabled, "from", uri)
      //send telemetry
      var dataOut = {
           "clickedButton": String(client.clickedButton),
           "sawPopup": String(client.sawPopup),
           "startTime": String(client.startTime),
           "addon_id": String(client.lastDisabled),
           "srcURI": String(uri),
           "pingType": "uninstall"
        }
      studyUtils.telemetry(dataOut)
      console.log(dataOut)

      //////
      client.lastDisabled = null

    }


  }
}


/////////////////////////////////////////////////////////

console.log({"eligible": config.isEligible()})
console.log({"eligible2": config.isEligible2()})



async function startup(addonData, reason) {
  const TESTING = true;
  const webExtension = addonData.webExtension;
  var client = new clientStatus();
  var studySetup =
   {
      studyName: studyConfig.studyName,
      endings: studyConfig.endings,
      addon: {id: addonData.id, version: addonData.version},
      telemetry: studyConfig.telemetry
    }

  studyUtils.setup(studySetup);
  studyUtils.setLoggingLevel(config.log.studyUtils.level);
  const variation = await chooseVariation();
  console.log({"variation":variation})
  studyUtils.setVariation(variation);

  if ((REASONS[reason]) === "ADDON_INSTALL") {
    studyUtils.firstSeen();  // sends telemetry "enter"
    const eligible = await config.isEligible(); // addon-specific
    if (!eligible & !TESTING) {
      // uses config.endings.ineligible.url if any,
      // sends UT for "ineligible"
      // then uninstalls addon
      console.log("ENDING STUDY DUE TO INELIGIBILITY")
      await studyUtils.endStudy({reason: "ineligible"});
      return;
    }
  }
await studyUtils.startup({reason});
  

  var aboutAddonsDomain = "https://discovery.addons.mozilla.org/%LOCALE%/firefox/discovery/pane/%VERSION%/%OS%/%COMPATIBILITY_MODE%"
  // dummy google for now
  // original url: https://discovery.addons.mozilla.org/%LOCALE%/firefox/discovery/pane/%VERSION%/%OS%/%COMPATIBILITY_MODE%
  var aboutAddonsNewDomain = "https://addons.mozilla.org"
  Preferences.set("extensions.webservice.discoverURL", aboutAddonsDomain)

  


  webExtension.startup().then(api => {
    client.activeAddons = getNonSystemAddons()
    client.addonHistory = getNonSystemAddons()
    TelemetryEnvironment.registerChangeListener("addonListener", function(x) {
      addonChangeListener(x, client)
      console.log(client)
    });

    const {browser} = api;
    browser.runtime.onMessage.addListener(studyUtils.respondToWebExtensionMessage);
    browser.runtime.onMessage.addListener((msg, sender, sendReply) => {
      if (msg["init"]) {
        console.log("init received")
        client.startTime = Date.now();
        var dataOut = {
           "clickedButton": String(client.clickedButton),
           "sawPopup": String(client.sawPopup),
           "startTime": String(client.startTime),
           "addon_id": String(client.lastInstalled),
           "srcURI": "NA",
           "pingType": "init"
        }
      studyUtils.telemetry(dataOut)
      console.log(dataOut)
      }
      if (msg['trigger-popup']) {
        ////////////////////// TESTING 
        // we can get these fields now if we want...
        var env = TelemetryEnvironment.currentEnvironment
        var clientId =  ClientID.getClientID();
        var profileCreationDate =env.profile.creationDate
        var appName = env.build.applicationName
        var version = env.build.platformVersion
        ///////////////////////////////////////
        var window = Services.wm.getMostRecentWindow('navigator:browser')
      
        var panelUIMenu = window.document.getElementById("PanelUI-button");
        var panelUIMenuButton = window.document.getElementById("PanelUI-menu-button");
        var doorhangerPopup = window.document.getElementById("doorhanger-popup")
        var foundDoorHanger = true
        if (!doorhangerPopup) {
            foundDoorHanger = false
            doorhangerPopup = createMenuPanel(window)
            panelUIMenu.appendChild(doorhangerPopup);
         }

        if(!foundDoorHanger) {
          // add listener for button routing to about:addons
          doorhangerPopup.getElementsByAttribute('type', 'button')[0].addEventListener("click", function() {
              console.log('clicked button...')

              console.log({'before': client.clickedButton})
              client.clickedButton =  true;
              console.log({'after': client.clickedButton})

              window.gBrowser.selectedTab = window.gBrowser.addTab("about:addons", {relatedToCurrent:true});
              doorhangerPopup.hidePopup();
            })
          // add listener for popup close (user dismissed)
          doorhangerPopup.addEventListener("popuphidden", function() {
            if (!client.clickedButton) {
                console.log("hidden");
            }
            
        })
        }
        
        // open popup, anchored by the panelUIMenuButton (hamburger)
        doorhangerPopup.openPopup(panelUIMenuButton, doorhangerPopup.getAttribute("position"), 0, 0, false, false);
        client.sawPopup = true
      }
      // else if (msg["data"]) {
      //   // var dataToSend = msg['data']
      //   // dataToSend['clickedButton'] = client.clickedButton
      //   // dataToSend['hostNavigationStats'] = dataToSend['hostNavigationStats']['totalWebNav']
      //   // console.log("received data from WebExt")
      //   // console.log({'Results': dataToSend})
      //   // studyUtils.telemetry({
      //   //    "clickedButton": String(dataToSend.clickedButton),
      //   //    "sawPopup": String(dataToSend.sawPopup),
      //   //    "webNav": String(dataToSend.hostNavigationStats),
      //   //    "startTime": String(dataToSend.starttime)
      //   // })
      // }
    });
  });
}

function shutdown(addonData, reason) {
  console.log("shutdown", REASONS[reason] || reason);
  // are we uninstalling?
  // if so, user or automatic?
  if (reason === REASONS.ADDON_UNINSTALL || reason === REASONS.ADDON_DISABLE) {
    console.log("uninstall or disable");
    if (!studyUtils._isEnding) {
      // we are the first requestors, must be user action.
      console.log("user requested shutdown");
      studyUtils.endStudy({reason: "user-disable"});
      return;
    }

  // normal shutdown, or 2nd attempts
    console.log("Jsms unloading");
    Jsm.unload(config.modules);
    Jsm.unload([CONFIGPATH, STUDYUTILSPATH]);
    Cu.unload("resource://gre/modules/Services.jsm");
    Cu.import("resource://gre/modules/Console.jsm");
  }
}

function createMenuPanel(window) {
  var doc = window.document;
  var panel = doc.createElement("panel");
  var attributes = {
                      "type": "arrow",
                        "id": "doorhanger-popup",
                      "flip": "slide",
                  "position": "bottomcenter topright",
               "noautofocus": "true",
                      "side": "top",
      "consumeoutsideclicks": "false",
             "arrowposition": "after_end"
  }

  for (var att in attributes) {
    panel.setAttribute(att, attributes[att])
  }
  var panelContent = doc.createElement("label");
  // panelContent.innerHTML = "<h1>Hi</h1>"
  panelContent.innerHTML = `
  <html>
    <head>
      <meta charset="utf-8"></meta>
  </head>
    <body>
      <div class="panel">
        <div class="panel-section panel-section-header">
          <div class="text-section-header">Customize Firefox with Add-ons!</div>
          <button type="button" id="btn"> Try Add-ons </button>
        </div>
      </div>
    </body>
  </html>
  `
  panel.appendChild(panelContent);
  return panel;
}

function uninstall(addonData, reason) {
  console.log("uninstall", REASONS[reason] || reason);
}

function install(addonData, reason) {
  console.log("install", REASONS[reason] || reason);
  // handle ADDON_UPGRADE (if needful) here
}



/** CONSTANTS and other bootstrap.js utilities */

Set.prototype.difference = function(setB) {
    var difference = new Set(this);
    for (var elem of setB) {
        difference.delete(elem);
    }
    return difference;
}

Set.prototype.union = function(setB) {
    var union = new Set(this);
    for (var elem of setB) {
        union.add(elem);
    }
    return union;
}

// addon state change reasons
const REASONS = {
  APP_STARTUP: 1,      // The application is starting up.
  APP_SHUTDOWN: 2,     // The application is shutting down.
  ADDON_ENABLE: 3,     // The add-on is being enabled.
  ADDON_DISABLE: 4,    // The add-on is being disabled. (Also sent during uninstallation)
  ADDON_INSTALL: 5,    // The add-on is being installed.
  ADDON_UNINSTALL: 6,  // The add-on is being uninstalled.
  ADDON_UPGRADE: 7,    // The add-on is being upgraded.
  ADDON_DOWNGRADE: 8,  // The add-on is being downgraded.
};
for (const r in REASONS) { REASONS[REASONS[r]] = r; }

// logging
function createLog(name, levelWord) {
  Cu.import("resource://gre/modules/Log.jsm");
  var L = Log.repository.getLogger(name);
  L.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
  L.level = Log.Level[levelWord] || Log.Level.Debug; // should be a config / pref
  return L;
}

async function chooseVariation() {
  let toSet, source;
  const sample = studyUtils.sample;

  if (studyConfig.variation) {
    source = "startup-config";
    toSet = studyConfig.variation;
  } else {
    source = "weightedVariation";
    // this is the standard arm choosing method
    const clientId = await studyUtils.getTelemetryId();
    const hashFraction = await sample.hashFraction(studyConfig.studyName + clientId, 12);
    toSet = sample.chooseWeighted(studyConfig.weightedVariations, hashFraction);
  }
  log.debug(`variation: ${toSet} source:${source}`);
  return toSet;
}

// jsm loader / unloader
class Jsm {
  static import(modulesArray) {
    for (const module of modulesArray) {
      log.debug(`loading ${module}`);
      Cu.import(module);
    }
  }
  static unload(modulesArray) {
    for (const module of modulesArray) {
      log.debug(`Unloading ${module}`);
      Cu.unload(module);
    }
}
}



