const { validDate } = require('./guest-registration');

// UTC noon is after the start of the expiry day in Lisbon in summer and winter.
// Calendar arithmetic deliberately handles leap years without shortening retention.
function expiryFor(reportDate) {
  if (!validDate(reportDate)) return null;
  const date = new Date(`${reportDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date;
}

async function deleteExpiredBoletins(db, Timestamp, now = new Date()) {
  const candidates = await db.collection('alojamento_boletins').where('deleteAfter', '<=', Timestamp.fromDate(now)).get();
  let deleted = 0;
  for (const candidate of candidates.docs) {
    const removed = await db.runTransaction(async tx => {
      const parent = await tx.get(candidate.ref);
      if (!parent.exists) return false;
      const data = parent.data();
      const expiry = expiryFor(data.departureReportedDate);
      if (!expiry || expiry > now || data.publicAccessClosed !== true || data.sentToAuthorities !== true) return false;
      const guests = await tx.get(candidate.ref.collection('guests'));
      const summaries = await tx.get(candidate.ref.collection('guest_summaries'));
      if (!guests.size || guests.size < Number(data.expectedGuests || 1) || guests.size + summaries.size > 450) return false;
      // A stale expiry field alone can never authorize deletion.
      if (guests.docs.some(doc => {
        const guest = doc.data();
        return !validDate(guest.checkinDate) || !validDate(guest.checkoutDate)
          || guest.checkoutDate <= guest.checkinDate || guest.checkoutDate > data.departureReportedDate;
      })) return false;
      guests.docs.forEach(doc => tx.delete(doc.ref));
      summaries.docs.forEach(doc => tx.delete(doc.ref));
      tx.delete(candidate.ref);
      return true;
    });
    if (removed) deleted++;
  }
  return { deleted };
}
module.exports = { expiryFor, deleteExpiredBoletins };
