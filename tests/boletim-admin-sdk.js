// Synthetic administrative data for the local preview only.
export const db = {};
const parentPath = `alojamento_boletins/${'b'.repeat(32)}`;
const records = new Map([
  [parentPath, { guestName:'Reserva de teste', propertyId:'123', language:'pt', expectedGuests:1, checkinDate:'2026-09-11', checkoutDate:'2026-09-20', publicAccessClosed:true, sentToAuthorities:false, createdAt:new Date().toISOString() }],
  [`${parentPath}/guests/test-guest-00000001`, { firstName:'Teste', lastName:'Privado', birthDate:'1990-05-12', documentType:'passport', documentNumber:'TEST-001', countryOrigin:'PT', countryResidence:'FR', documentCountry:'PT', checkinDate:'2026-09-11', checkoutDate:'2026-09-20', declarationAccepted:true, submittedAt:new Date().toISOString() }]
]);
export const collection = (_db,...parts) => ({path:parts.join('/')});
export const doc = (_db,...parts) => ({path:parts.join('/'),id:parts.at(-1)});
export const query = ref => ref;
export const orderBy = () => null;
export const Timestamp = {now:()=>new Date().toISOString(),fromDate:date=>date.toISOString()};
export const runTransaction = async (_db, callback) => {
  const pending=[];
  const result=await callback({get:async ref=>({exists:()=>records.has(ref.path),data:()=>({...records.get(ref.path)})}),update:(ref,value)=>pending.push(()=>updateDoc(ref,value))});
  for(const update of pending) await update();
  return result;
};
export const getDocs = async ref => ({docs:[...records].filter(([path])=>path.startsWith(ref.path+'/') && path.split('/').length===ref.path.split('/').length+1).map(([path,value])=>({id:path.split('/').at(-1),ref:{path},data:()=>({...value})}))});
export const setDoc = async (ref,value) => { records.set(ref.path,{...value}); };
export const updateDoc = async (ref,value) => { Object.assign(records.get(ref.path),value); };
export const deleteDoc = async ref => { records.delete(ref.path); };
export const writeBatch = () => {
  const updates=[];
  return {update:(ref,value)=>updates.push(()=>updateDoc(ref,value)),set:(ref,value)=>updates.push(()=>setDoc(ref,value)),commit:async()=>{for(const update of updates)await update();}};
};
