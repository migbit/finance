// Read-only deployment checks. Never invokes cleanup or changes production data.
const auth = require('C:/Users/apart/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
async function main() {
  const project = 'apartments-a4b17';
  const account = auth.getProjectDefaultAccount(process.cwd());
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const response = await fetch(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/europe-west1/jobs/firebase-schedule-deleteExpiredBoletins-europe-west1`, {headers});
  if (!response.ok) throw new Error(`Scheduler verification failed: ${response.status}`);
  const job = await response.json();
  if (job.state !== 'ENABLED' || job.schedule !== '0 14 * * *' || job.timeZone !== 'Europe/Lisbon') throw new Error('Unexpected scheduler configuration');
  for (const [path, marker] of [
    ['/modules/boletins.html','departure-reported-date'],
    ['/modules/boletim.html','unknown-checkout'],
    ['/js/boletim-dates-copy.js','checkoutUnknown']
  ]) {
    const page = await fetch(`https://${project}.web.app${path}`, {cache:'no-store'});
    if (!page.ok || !(await page.text()).includes(marker)) throw new Error(`Published asset missing: ${path}`);
  }
  console.log(JSON.stringify({scheduler:job.state,schedule:job.schedule,timeZone:job.timeZone,pages:'updated',productionWrites:0}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
