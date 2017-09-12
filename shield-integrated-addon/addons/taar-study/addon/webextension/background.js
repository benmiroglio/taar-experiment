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

function webNavListener(info) {
  // Filter out any sub-frame related navigation event
  if (info.frameId !== 0) {
    return;
  }
  browser.storage.local.get("hostNavigationStats").then(results => {
      // Initialize the saved stats if not yet initialized.
      if (!results.hostNavigationStats) {
        results = {
          hostNavigationStats: {}
        };
      }
    const testing=false;
    const locale = browser.i18n.getUILanguage().replace("_", "-").toLowerCase()

    const {hostNavigationStats} = results;
    hostNavigationStats["totalWebNav"] = hostNavigationStats["totalWebNav"] || 0
    hostNavigationStats['totalWebNav']++

    const totalCount = hostNavigationStats['totalWebNav'];
    const tabId = info.tabId;
    const sawPopup = browser.storage.local.get("sawPopup")

    console.log('TotalURI: ' + totalCount);

    sawPopup.then(function(result) {
          if (!result.sawPopup || testing) { // client has not seen popup
              // arbitrary condition for now
              if (totalCount > 0) {
                browser.storage.local.set({"PA-tabId": tabId})
                browser.pageAction.show(tabId)
                browser.pageAction.setPopup({
                  tabId,
                  popup: "/popup/locales/" + locale + "/popup.html"
                });
                // wait 500ms second to make sure pageAction exists in chrome
                // so we can pageAction.show() from bootsrap.js
                setTimeout(triggerPopup, 500);
              }
          } else { //client has seen the popup
              browser.storage.local.get("PA-hidden").then(function(result) {
                if (!result["PA-hidden"]) { // page action is still visible
                   browser.storage.local.get("PA-tabId").then(function(result2) { 
                      browser.pageAction.hide(result2["PA-tabId"])
                      browser.storage.local.set({"PA-hidden": true})
                    })
                   browser.webNavigation.onCompleted.removeListener(webNavListener)
                }
              })
            }
          })
      // Persist the updated webNav stats.
      browser.storage.local.set(results);
  })
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
        this.monitorNavigation()
    }
  }

  async firstRun() {
    await browser.storage.local.set({sawPopup: false})
    browser.runtime.sendMessage({"init": true})
  }

  monitorNavigation() {
    browser.webNavigation.onCompleted.addListener(webNavListener, 
        {url: [{schemes: ["http", "https"]}]});
  }
}

let experiment = new TAARExperiment();
experiment.start();








