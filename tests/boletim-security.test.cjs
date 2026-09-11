const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('../firebase/functions/node_modules/firebase-admin');
const { processRegistration, OWNER_UID, handler } = require('../firebase/functions/guest-registration');
const { expiryFor, deleteExpiredBoletins } = require('../firebase/functions/boletim-retention');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('These tests require the Firestore emulator. Never run against production.');
const projectId = 'demo-boletim';
admin.initializeApp({ projectId });
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;
const token = 'a'.repeat(32);
const ref = db.collection('alojamento_boletins').doc(token);
const fields = {
  firstName: 'Test', lastName: 'Guest', birthDate: '1990-05-12', documentType: 'passport',
  documentNumber: 'TEST-123', countryOrigin: 'PT', countryResidence: 'FR', documentCountry: 'PT', declarationAccepted: true
};
async function seed(overrides = {}) {
  await db.recursiveDelete(ref);
  await ref.set({ guestName: 'Private booking name', propertyId: '123', language: 'pt', expectedGuests: 2,
    checkinDate: '2026-09-11', checkoutDate: '2026-09-20', sentToAuthorities: false, ...overrides });
}
function request(action, extra = {}) { return processRegistration(db, Timestamp, { token, action, ...extra }, 'test-browser'); }
function jwt(uid) {
  const now = Math.floor(Date.now()/1000);
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encode({alg:'none',typ:'JWT'})}.${encode({sub:uid,user_id:uid,aud:projectId,iss:`https://securetoken.google.com/${projectId}`,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'}})}.`;
}
async function clientRead(path, uid) {
  return fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    headers: uid ? { Authorization: `Bearer ${jwt(uid)}` } : {}
  });
}
test.beforeEach(async () => seed());
test.after(async () => { await db.recursiveDelete(ref); await admin.app().delete(); });

test('missing booking dates are individual; unknown departure is explicit and fixed dates cannot be overridden', async () => {
  await seed({ checkinDate: '', checkoutDate: '', expectedGuests: 3 });
  await assert.rejects(request('save', { guestId: 'test-guest-00000001', data: { ...fields, checkinDate:'2026-09-11' } }), /invalid-dates/);
  await assert.rejects(request('save', { guestId: 'test-guest-00000001', data: { ...fields, checkinDate:'2026-02-30', checkoutUnknown:true } }), /invalid-dates/);
  const result = await request('save', { guestId: 'test-guest-00000001', data: { ...fields, checkinDate:'2026-09-11', checkoutUnknown:true } });
  assert.equal(result.guests[0].checkoutDate, '');
  assert.equal(result.guests[0].checkoutUnknown, true);
  await request('save', { guestId: 'test-guest-00000002', data: { ...fields, checkinDate:'2026-09-14', checkoutDate:'2026-09-18' } });
  const stored = (await ref.collection('guests').doc('test-guest-00000002').get()).data();
  assert.equal(stored.checkinDate,'2026-09-14');
  assert.equal(stored.checkoutDate,'2026-09-18');
  await assert.rejects(request('save', { guestId: 'test-guest-00000003', data: { ...fields, checkinDate:'2026-09-14', checkoutDate:'2026-09-13' } }), /invalid-dates/);
});

test('retention uses calendar year after communication and deletes the entire expired group atomically', async () => {
  assert.equal(expiryFor('2024-02-28').toISOString(), '2025-03-01T12:00:00.000Z');
  assert.equal(expiryFor('2024-12-31').toISOString(), '2026-01-01T12:00:00.000Z');
  assert.equal(expiryFor('invalid'), null);
  await seed({ expectedGuests:1, checkinDate:'2024-01-01', checkoutDate:'2024-01-03' });
  await request('save', {guestId:'test-guest-00000001',data:fields});
  await ref.update({sentToAuthorities:true, departureReportedDate:'2024-01-04',deleteAfter:Timestamp.fromDate(expiryFor('2024-01-04'))});
  assert.deepEqual(await deleteExpiredBoletins(db,Timestamp,new Date('2025-01-05T11:59:59Z')), {deleted:0});
  assert.deepEqual(await deleteExpiredBoletins(db,Timestamp,new Date('2025-01-05T12:00:00Z')), {deleted:1});
  assert.equal((await ref.get()).exists,false);
  assert.equal((await ref.collection('guests').get()).size,0);
  assert.equal((await ref.collection('guest_summaries').get()).size,0);
});

test('legacy records, incomplete groups, unknown departures and stale expiry dates are never deleted', async () => {
  await seed({expectedGuests:1,checkinDate:'2024-01-01',checkoutDate:'2024-01-03'});
  await request('save',{guestId:'test-guest-00000001',data:fields});
  const old = Timestamp.fromDate(new Date('2020-01-01'));
  await ref.update({sentToAuthorities:true,deleteAfter:old});
  const now = new Date('2026-01-01');
  assert.deepEqual(await deleteExpiredBoletins(db,Timestamp,now),{deleted:0});
  await ref.update({departureReportedDate:'2025-12-01'});
  assert.deepEqual(await deleteExpiredBoletins(db,Timestamp,now),{deleted:0});
  await ref.update({departureReportedDate:'2024-01-04',expectedGuests:2});
  assert.deepEqual(await deleteExpiredBoletins(db,Timestamp,now),{deleted:0});
  await ref.update({expectedGuests:1});
  await ref.collection('guests').doc('test-guest-00000001').update({checkoutDate:''});
  assert.deepEqual(await deleteExpiredBoletins(db,Timestamp,now),{deleted:0});
  assert.equal((await ref.get()).exists,true);
});

test('guest payload and summary retain their existing field names and values', async () => {
  const result = await request('save', { guestId: 'test-guest-00000001', data: { ...fields, checkinDate: 'spoofed', userAgent: 'spoofed' } });
  assert.equal(result.closed, false);
  const stored = (await ref.collection('guests').doc('test-guest-00000001').get()).data();
  assert.deepEqual(Object.keys(stored).sort(), [...Object.keys(fields),'checkinDate','checkoutDate','submittedAt','userAgent'].sort());
  for (const [key,value] of Object.entries(fields)) assert.equal(stored[key], value);
  assert.equal(stored.checkinDate, '2026-09-11');
  assert.equal(stored.userAgent, 'test-browser');
  const summary = (await ref.collection('guest_summaries').doc('test-guest-00000001').get()).data();
  assert.deepEqual(Object.keys(summary).sort(), ['firstName','lastName','submittedAt']);
});

test('two concurrent attempts at the last slot never exceed expected guests; response has no personal data', async () => {
  await request('save', { guestId: 'test-guest-00000001', data: fields });
  const results = await Promise.all([
    request('save', { guestId: 'test-guest-00000002', data: fields }),
    request('save', { guestId: 'test-guest-00000003', data: fields })
  ]);
  for (const result of results) assert.deepEqual(result, {closed:true,language:'pt'});
  assert.equal((await ref.collection('guests').get()).size,2);
  assert.equal((await ref.get()).data().publicAccessClosed,true);
  assert.deepEqual(await request('status'), {closed:true,language:'pt'});
});

test('retry is idempotent and editing only works before closure', async () => {
  const payload = {guestId:'test-guest-00000001',data:fields};
  await request('save',payload);
  await request('save',payload);
  assert.equal((await ref.collection('guests').get()).size,1);
  await request('save',{...payload,editing:true,data:{...fields,lastName:'Corrected'}});
  assert.equal((await ref.collection('guests').doc(payload.guestId).get()).data().lastName,'Corrected');
  await ref.update({sentToAuthorities:true});
  assert.deepEqual(await request('save',{...payload,editing:true,data:fields}),{closed:true,language:'pt'});
  assert.equal((await ref.collection('guests').doc(payload.guestId).get()).data().lastName,'Corrected');
});

test('old sent and old complete links close without migration or disclosing guest data', async () => {
  await ref.update({sentToAuthorities:true});
  assert.deepEqual(await request('status'),{closed:true,language:'pt'});
  await seed({expectedGuests:1});
  await ref.collection('guests').doc('legacy-guest-00000001').set({...fields,submittedAt:Timestamp.now()});
  assert.deepEqual(await request('status'),{closed:true,language:'pt'});
  assert.equal((await ref.get()).data().publicAccessClosed,true);
});

test('Firebase rules deny direct parent, guest and summary access to public and other authenticated accounts; owner keeps access', async () => {
  await request('save',{guestId:'test-guest-00000001',data:fields});
  for (const suffix of ['', '/guests/test-guest-00000001','/guest_summaries/test-guest-00000001']) {
    const path=`alojamento_boletins/${token}${suffix}`;
    for (const uid of [undefined,'another-authenticated-user']) {
      const response=await clientRead(path,uid);
      assert.equal(response.status,403, await response.text());
    }
    const response=await clientRead(path,OWNER_UID);
    assert.equal(response.status,200,await response.text());
  }
});

test('invalid data and missing declaration cause no writes', async () => {
  for (const bad of [{...fields,declarationAccepted:false},{...fields,birthDate:'1990-02-31'},{...fields,firstName:'  '},{...fields,countryOrigin:'Portugal'}]) {
    await assert.rejects(request('save',{guestId:'test-guest-00000001',data:bad}),error=>error.status===400);
  }
  assert.equal((await ref.collection('guests').get()).size,0);
});

test('HTTP endpoint forbids caching private results', async () => {
  const headers={}; let result;
  const response={set:(key,value)=>{headers[key]=value;},json:value=>{result=value;},status:()=>response};
  await handler(db,Timestamp)({method:'POST',body:{token,action:'status'},get:()=>''},response);
  assert.match(headers['Cache-Control'],/no-store/);
  assert.equal(result.closed,false);
  assert.equal(result.guestName,undefined);
});
