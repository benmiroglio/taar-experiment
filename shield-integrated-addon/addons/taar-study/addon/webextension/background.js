



function telemetry (data) {
  function throwIfInvalid (obj) {
    // simple, check is all keys and values are strings
    for (const k in obj) {
      if (typeof k !== 'string') throw new Error(`key ${k} not a string`);
      if (typeof obj[k] !== 'string') throw new Error(`value ${k} ${obj[k]} not a string`);
    }
    return true
  }
  throwIfInvalid(data);
  msgStudy('telemetry', data);
}

// template code for talking to `studyUtils` using `browser.runtime`
async function msgStudy(msg, data) {
  const allowed = ['endStudy', 'telemetry', 'info'];
  if (!allowed.includes(msg)) throw new Error(`shieldUtils doesn't know ${msg}, only knows ${allowed}`);
  try {
    const ans = await browser.runtime.sendMessage({shield: true, msg, data});
    return ans;
  } catch (e) {
    console.log('msgStudy failed:', e);
  }
}

function triggerPopup() {
  browser.runtime.sendMessage({"trigger-popup": true})
  browser.storage.local.set({sawPopup: true})
} 


class TAARExperiment {

  constructor() {
    this.popUpVariations = new Set(["vanilla-disco-popup", ,"taar-diso-popup"])
  }
  logStorage() {
    browser.storage.local.get().then(console.log)
  }
  async start() {
    this.info = await msgStudy('info')
    let isFirstRun = !(await browser.storage.local.get('initialized'))['initialized']
    if (isFirstRun) await this.firstRun()

    this.branch = (await browser.storage.local.get('branch'))['branch']

    // only montior navigation for branches qualified to 
    // receive the pop-up. 
    if (this.popUpVariations.has(this.info.variation.name)) {
        console.log("monitoring nav")
        this.monitorNavigation()
    } else {console.log("no popup")}
  }

  async firstRun() {
    console.log('first run')
    await browser.storage.local.set({sawPopup: false})
    browser.runtime.sendMessage({"init": true})
  }

  monitorNavigation() {
    /*
    Records web navigation loads, sending a message 
    to bootstrap.js after 3 or more sucessfull loads.
    Upon receiving the message, bootstrap.js triggers a popup
    with a link to about:addons
    */
    var gettingStoredStats = browser.storage.local.get("hostNavigationStats");

    gettingStoredStats.then(results => {
      // Initialize the saved stats if not yet initialized.
      if (!results.hostNavigationStats) {
        results = {
          hostNavigationStats: {}
        };
      }

      const {hostNavigationStats} = results;

      // Monitor completed navigation events and update
      // stats accordingly. Keeps track of total completed web navigations

      browser.webNavigation.onCompleted.addListener(info => {
        // Filter out any sub-frame related navigation event
        if (info.frameId !== 0) {
          return;
        }
        const testing=true;

        let locale = browser.i18n.getUILanguage().replace("_", "-").toLowerCase()
        let acceptedLangauges = browser.i18n.getAcceptLanguages()

        console.log("locale", locale)

        hostNavigationStats["totalWebNav"] = hostNavigationStats["totalWebNav"] || 0
        hostNavigationStats['totalWebNav']++

        let totalCount = hostNavigationStats['totalWebNav'];
        let tabId = info.tabId;
        console.log('TotalURI: ' + totalCount);
        var sawPopup = browser.storage.local.get("sawPopup")
        sawPopup.then(function(result) {
              if (!result.sawPopup || testing) { 
                  // arbitrary condition for now
                  if (totalCount > 0) {
                    console.log("tabId", tabId)
                    browser.pageAction.show(tabId)
                    browser.pageAction.setPopup({
                      tabId,
                      popup: "/popup/locales/" + locale + "/popup.html"
                    });
                    // wait 500 ms to make sure pageAction exists in chrome
                    // so we can pageAction.show() from bootsrap.js
                    setTimeout(triggerPopup, 500);
                  }
                }
              })
        // Persist the updated stats.
        browser.storage.local.set(results);
      }, {
        url: [{schemes: ["http", "https"]}]});
    });
  }
}

let experiment = new TAARExperiment();
experiment.start();








