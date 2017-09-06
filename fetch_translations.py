from gengo import Gengo
from keys import *

def write_translation(lang, content, path="./translations"):
	with open(path + '/' + lang, "w") as f:
		f.write(content.encode("utf-8"))

def fetch_job(job_id):
	resp = gengo.getTranslationJob(id=job_id)
	translation = resp['response']['job']['body_tgt']
	lang = resp['response']['job']['lc_tgt']
	write_translation(lang, translation)



ORDER_ID = 3137679

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

for job_id in orders["jobs_available"]:
	fetch_job(job_id)







