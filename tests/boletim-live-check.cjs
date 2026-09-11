// Uses the existing Firebase CLI login; never prints credentials or guest data.
// --close-sent permanently revokes bearer access to already sent boletins.
const auth = require('C:/Users/apart/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
const project = 'apartments-a4b17';
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
async function main() {
  const account = auth.getProjectDefaultAccount(process.cwd());
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type':'application/json' };
  const query = await fetch(`${base}:runQuery`, {method:'POST', headers, body:JSON.stringify({structuredQuery:{
    from:[{collectionId:'alojamento_boletins'}],
    select:{fields:[{fieldPath:'sentToAuthorities'},{fieldPath:'publicAccessClosed'}]},
    where:{fieldFilter:{field:{fieldPath:'sentToAuthorities'},op:'EQUAL',value:{booleanValue:true}}}
  }})});
  if(!query.ok) throw new Error(`Private query failed: ${query.status}`);
  const documents=(await query.json()).filter(row=>row.document).map(row=>row.document);
  let closed=0;
  if(process.argv.includes('--close-sent')) {
    for(const document of documents) {
      if(document.fields.publicAccessClosed?.booleanValue===true) continue;
      const response=await fetch(`https://firestore.googleapis.com/v1/${document.name}?updateMask.fieldPaths=publicAccessClosed&currentDocument.updateTime=${encodeURIComponent(document.updateTime)}`, {
        method:'PATCH',headers,body:JSON.stringify({fields:{publicAccessClosed:{booleanValue:true}}})
      });
      if(!response.ok) throw new Error(`Closure update failed: ${response.status}`);
      closed++;
    }
    console.log(JSON.stringify({sentBoletins:documents.length,accessRevoked:closed,guestRecordsDeleted:0}));
  }
  if(documents.length) {
    const id=documents[0].name.split('/').at(-1);
    const result=await fetch(`https://${project}.web.app/api/guest-registration`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:id,action:'status'})
    });
    const body=await result.json();
    if(!result.ok || body.closed!==true || Object.keys(body).some(key=>!['closed','language'].includes(key))) throw new Error('Closed link did not return only a safe confirmation');
    const parent=await fetch(`${base}/alojamento_boletins/${id}`);
    const guests=await fetch(`${base}/alojamento_boletins/${id}/guests`);
    const summaries=await fetch(`${base}/alojamento_boletins/${id}/guest_summaries`);
    if([parent,guests,summaries].some(response=>response.status!==403)) throw new Error(`Public access not denied: ${parent.status}/${guests.status}/${summaries.status}`);
    console.log(JSON.stringify({closedLink:'confirmation only',directParent:parent.status,directGuests:guests.status,directSummaries:summaries.status}));
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
