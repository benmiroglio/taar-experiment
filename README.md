# Web Health Study
This repository hosts a [Shield study](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies) that is designed to understand what the best way to raise awareness around policies that govern the way the Internet works.

## Task
When the user visits certain websites that are in support of healthy internet policies, they receive a message calling for action to support such policies. The user can take action by clicking a button and filling out a form that eventually will be submitted to FCC as comments on the recently proposed policy changes.

## Data Collection
The `internet-policy-study` extension collects a participant's Firefox usage data that is related to her interaction with the messages, as well as metrics that could be correlated with her receptivity to those messages. In particular, it collects:

- visits to the designated set of websites (only the top-level hostnames will be collected, e.g. www.amazon.com)
	-- the list of websites is a subset of the participants list found here: https://www.battleforthenet.com/july12/
- the participant's interaction with the notification

NOTE: no data is collected in private browsing mode

The collected data is transferred through Shield [Telemetry](https://wiki.mozilla.org/T\elemetry) pings to Mozilla along with the usual [environment ping](http://gecko.readthedocs.io/en/latest/toolkit/components/telemetry/telemetry/data/environment.html) data from Telemetry. 

The schema for messages sent to Telemetry can be found [here](https://github.com/raymak/shield-internet-policy-awareness/blob/master/schemas/schema.json).
