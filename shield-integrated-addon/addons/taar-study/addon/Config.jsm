"use strict";

/* to use:

- this file has chrome privileges
- Cu.import will work for any 'general firefox things' (Services,etc)
  but NOT for addon-specific libs
*/
const {utils: Cu} = Components;
Cu.import("resource://gre/modules/TelemetryEnvironment.jsm");
Cu.import("resource://gre/modules/Console.jsm")
const EXPORTED_SYMBOLS = ["config"];
const slug = "taarexp"; // matches chrome.manifest;
const locales = new Set(
  [
    "ar",
    "bg",
    "cs",
    "da",
    "de",
    "el",
    "en-gb",
    "en-us",
    "es-ar",
    "es-es",
    "es-la",
    "fi",
    "fr",
    "fr-ca",
    "he",
    "hu",
    "id",
    "it",
    "ja",
    "ko",
    "ms",
    "nl",
    "no",
    "pl",
    "pt",
    "pt-br",
    "ro",
    "ru",
    "sk",
    "sr",
    "sv",
    "th",
    "tl",
    "tr",
    "uk",
    "vi",
    "zh-tw"
    ])

var config = {
  // Equal weighting for each  of the 4 variations
  "study": {
    "studyName": "TAARExperiment",
    "weightedVariations": [
      {"name": "vanilla-disco-popup",
        "weight": 1},
      {"name": "taar-disco-popup",
        "weight": 1},
      {"name": "vanilla-disco",
        "weight": 1},
      {"name": "taar-disco",
        "weight": 1}

    ],
    "endings": {},
    "telemetry": {
      "send": true, // assumed false. Actually send pings?
      "removeTestingFlag": false,  // Marks pings as testing, set true for actual release
      // TODO "onInvalid": "throw"  // invalid packet for schema?  throw||log
    },
    "studyUtilsPath": `./StudyUtils.jsm`,
  },
  "isEligible": async function() { 
    /*
    Return true if profile is at most one week old
    or has a qualifying locale
    */

    const locale = TelemetryEnvironment.currentEnvironment.settings.locale;
    const proflileCreationDate = TelemetryEnvironment.currentEnvironment.profile.creationDate;
    // MS -> Days
    const currentDay = Math.round(Date.now() / 60 / 60 / 24 / 1000)
    return (currentDay - proflileCreationDate) <= 7 && locales.has(locale)
  },
  // addon-specific modules to load/unload during `startup`, `shutdown`
  "modules": [
  ],
  "log": {
      // Fatal: 70, Error: 60, Warn: 50, Info: 40, Config: 30, Debug: 20, Trace: 10, All: -1,
      "bootstrap":  {
        "level": "Debug",
      },
      "studyUtils":  {
        "level": "Trace",
      },
  },
};
