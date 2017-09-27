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

class clientStatus {
  constructor() {
    this.clickedButton = null;
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

function bucketURI(uri) {
  if (uri != "about:addons") {
        if (uri.indexOf("addons.mozilla.org") > 0) {
        uri = "AMO"
      } else {
        uri = "other"
      }
    }
  return uri
}

function addonChangeListener(change, client) {
  if (change == "addons-changed") {
    client.updateAddons()
    var uri = bucketURI(Services.wm.getMostRecentWindow('navigator:browser').gBrowser.currentURI.asciiSpec);

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
      studyUtils.telemetry(dataOut)
      client.lastInstalled = null;
    } else if (client.lastDisabled) {
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
        client.lastDisabled = null
    }
  }
}

function closePageAction() {
  var window = Services.wm.getMostRecentWindow('navigator:browser')
  var pageAction = window.document.getElementById("taarexp_mozilla_com-page-action")
  pageAction.parentNode.removeChild(pageAction);
}


///////////////////////////////////////////////////////////////
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

  //force test branch
  variation.name = 'taar-disco-popup';
  studyUtils.setVariation(variation);

  if ((REASONS[reason]) === "ADDON_INSTALL") {
    studyUtils.firstSeen();  // sends telemetry "enter"
    const eligible = await config.isEligible(); // addon-specific
    if (!eligible & !TESTING) {
      await studyUtils.endStudy({reason: "ineligible"});
      return;
    }
  }
await studyUtils.startup({reason});
  console.log({"Branch": variation.name});
  const clientId = await ClientID.getClientID()

  //default
  var aboutAddonsDomain = "https://discovery.addons.mozilla.org/%LOCALE%/firefox/discovery/pane/%VERSION%/%OS%/%COMPATIBILITY_MODE%"
  if (variation.name == "taar-disco-popup" || variation.name == "taar-disco") {
    aboutAddonsDomain += "?clientId=" + clientId
    Preferences.set("extensions.webservice.discoverURL", aboutAddonsDomain)
  }

  


  webExtension.startup().then(api => {
    client.activeAddons = getNonSystemAddons()
    client.addonHistory = getNonSystemAddons()
    TelemetryEnvironment.registerChangeListener("addonListener", function(x) {
      addonChangeListener(x, client)
    });

    const {browser} = api;
    browser.runtime.onMessage.addListener(studyUtils.respondToWebExtensionMessage);
    browser.runtime.onMessage.addListener((msg, sender, sendReply) => {
      // message handers //////////////////////////////////////////
      if (msg["init"]) {
        client.startTime = Date.now();
        var dataOut = {
           "clickedButton": String(client.clickedButton),
           "sawPopup": String(client.sawPopup),
           "startTime": String(client.startTime),
           "addon_id": String(client.lastInstalled),
           "srcURI": "null",
           "pingType": "init"
        }
      studyUtils.telemetry(dataOut)
      }
      else if (msg['trigger-popup']) {
        client.sawPopup = true;
        Preferences.set("extensions.ui.lastCategory", "addons://discover/")
        var window = Services.wm.getMostRecentWindow('navigator:browser')
        var pageAction = window.document.getElementById("taarexp_mozilla_com-page-action")
        pageAction.click()

        
      }
      else if (msg['clicked-disco-button']) {
          var window = Services.wm.getMostRecentWindow('navigator:browser')
          window.gBrowser.selectedTab = window.gBrowser.addTab("about:addons", {relatedToCurrent:true});
          client.clickedButton = true;
          closePageAction();
      }
      else if (msg['clicked-close-button']) {
          client.clickedButton = false
          closePageAction();
      }


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



