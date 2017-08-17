
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
      browser.webNavigation.onCompleted.addListener(evt => {
        // Filter out any sub-frame related navigation event
        if (evt.frameId !== 0) {
          return;
        }

        hostNavigationStats["totalWebNav"] = hostNavigationStats["totalWebNav"] || 0
        hostNavigationStats['totalWebNav']++

        let totalCount = hostNavigationStats['totalWebNav'];
        console.log('TotalURI: ' + totalCount);

        // arbitrary condition for now
        if (totalCount > 2) {
          var sawPopup = browser.storage.local.get("sawPopup")
          sawPopup.then(function(result) {
            if (!result.sawPopup) { // client hasn't seen popUp
              browser.runtime.sendMessage({"trigger-popup": true})
              browser.storage.local.set({sawPopup: true}) 
            } else { //client has seen popup, send data to bootstrap.js to union with popUp response
                browser.storage.local.get().then(function(result) {
                  browser.runtime.sendMessage({"data":result})
                })
              }
          });
        }
        // Persist the updated stats.
        browser.storage.local.set(results);
      }, {
        url: [{schemes: ["http", "https"]}]});
    });
  }
}

let experiment = new TAARExperiment();
experiment.start();








