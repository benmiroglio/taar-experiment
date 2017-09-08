from gengo import Gengo
from keys import *
import os
# keys contains API keys and ORDER_ID

def write_translation(lang, content, path="./shield-integrated-addon/addons/taar-study/addon/webextension/popup/locales"):
	os.system("mkdir {}/{}".format(path, lang))
	with open(path + '/' + lang + "/raw.txt", "w") as f:
		f.write(content.encode("utf-8"))

def fetch_job(job_id):
	resp = gengo.getTranslationJob(id=job_id)
	print resp
	translation = resp['response']['job']['body_tgt']
	lang = resp['response']['job']['lc_tgt']
	# custom formatting already applied
	if lang not in ("ar", "es", "ja", "ru", "zh-tw", "sk"):
		write_translation(lang, translation)

gengo = Gengo(
    public_key=PUBLIC_KEY,
    private_key=PRIVATE_KEY,
    sandbox=False,
    debug=False)

jobs = gengo.getTranslationOrderJobs(id=ORDER_ID)
orders = jobs['response']['order']

print "Total Jobs:", orders["total_jobs"]
print "Jobs pending:", len(orders["jobs_pending"])
print "Jobs reviewable", len(orders["jobs_reviewable"])
print "Jobs approved", len(orders["jobs_approved"])

# approve all reviewable jobs and grab text
for job_id in orders["jobs_reviewable"]:
	gengo.updateTranslationJob(id=job_id, action={"action": "approve"})
	fetch_job(job_id)

for job_id in orders["jobs_approved"]:
	fetch_job(job_id)
	









