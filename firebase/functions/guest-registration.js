const COLLECTION = 'alojamento_boletins';
const OWNER_UID = 'mnwi7SP84kZSXvxMPQz45RuvKG52';
const FIELDS = ['firstName', 'lastName', 'birthDate', 'documentType', 'documentNumber', 'countryOrigin', 'countryResidence', 'documentCountry'];

class RegistrationError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function expectedCount(boletim) {
  const value = Number(boletim.expectedGuests);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function isClosed(boletim, count) {
  return boletim.sentToAuthorities === true || boletim.publicAccessClosed === true || count >= expectedCount(boletim);
}

function statusData(boletim, guests) {
  const closed = isClosed(boletim, guests.length);
  const language = ['pt', 'en', 'fr', 'es', 'ko'].includes(boletim.language) ? boletim.language : 'en';
  // A closed bearer link returns no booking or guest details, including names.
  if (closed) return { closed: true, language };
  return {
    closed: false, language, expectedGuests: expectedCount(boletim),
    propertyId: ['123', '1248'].includes(boletim.propertyId) ? boletim.propertyId : '',
    checkinDate: boletim.checkinDate || '', checkoutDate: boletim.checkoutDate || '',
    guests: guests.map(({ id, data }) => ({
      id, ...Object.fromEntries(FIELDS.map(key => [key, data[key] || ''])),
      declarationAccepted: data.declarationAccepted === true,
      checkinDate: data.checkinDate || '', checkoutDate: data.checkoutDate || '',
      checkoutUnknown: !data.checkoutDate,
      submittedAt: data.submittedAt?.toMillis?.() || 0, editable: true
    })).sort((a, b) => a.submittedAt - b.submittedAt)
  };
}

function validateGuest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RegistrationError(400, 'invalid-data');
  const result = {};
  for (const key of FIELDS) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 200) throw new RegistrationError(400, 'invalid-data');
    result[key] = input[key].trim();
  }
  if (!['passport', 'id', 'other'].includes(result.documentType)) throw new RegistrationError(400, 'invalid-data');
  for (const key of ['countryOrigin', 'countryResidence', 'documentCountry']) {
    if (!/^[A-Z]{2}$/.test(result[key])) throw new RegistrationError(400, 'invalid-data');
  }
  const date = new Date(`${result.birthDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.birthDate) || !Number.isFinite(date.getTime())
      || date.toISOString().slice(0, 10) !== result.birthDate
      || result.birthDate > new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })) throw new RegistrationError(400, 'invalid-data');
  if (input.declarationAccepted !== true) throw new RegistrationError(400, 'invalid-data');
  result.declarationAccepted = true;
  return result;
}

async function processRegistration(db, Timestamp, request, userAgent = '') {
  const { token, action } = request || {};
  if (!/^[a-f0-9]{32}$/.test(token || '')) throw new RegistrationError(404, 'invalid-link');
  if (!['status', 'save'].includes(action)) throw new RegistrationError(400, 'invalid-action');
  const ref = db.collection(COLLECTION).doc(token);
  return db.runTransaction(async transaction => {
    const parent = await transaction.get(ref);
    if (!parent.exists) throw new RegistrationError(404, 'invalid-link');
    const boletim = parent.data();
    if (boletim.sentToAuthorities === true || boletim.publicAccessClosed === true) return statusData(boletim, []);
    const snapshot = await transaction.get(ref.collection('guests'));
    const guests = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    if (isClosed(boletim, guests.length)) {
      transaction.update(ref, { publicAccessClosed: true });
      return statusData(boletim, guests);
    }
    if (action === 'status') return statusData(boletim, guests);
    const guestId = request.guestId;
    const editing = request.editing === true;
    if (!/^[A-Za-z0-9-]{16,80}$/.test(guestId || '')) throw new RegistrationError(400, 'invalid-id');
    const existing = guests.find(guest => guest.id === guestId);
    // Idempotent retry after a successful create never creates another guest.
    if (existing && !editing) return statusData(boletim, guests);
    if (!existing && editing) throw new RegistrationError(404, 'guest-not-found');
    const data = validateGuest(request.data);
    Object.assign(data, validateStay(boletim, request.data));
    const now = Timestamp.now();
    const guestRef = ref.collection('guests').doc(guestId);
    if (existing) {
      const changes = { ...data, updatedAt: now };
      transaction.update(guestRef, changes);
      Object.assign(existing.data, changes);
    } else {
      const payload = { ...data, submittedAt: now, userAgent: String(userAgent).slice(0, 1000) };
      transaction.create(guestRef, payload);
      guests.push({ id: guestId, data: payload });
    }
    transaction.set(ref.collection('guest_summaries').doc(guestId), {
      firstName: data.firstName, lastName: data.lastName,
      submittedAt: existing ? existing.data.submittedAt : now
    });
    // This parent write serializes simultaneous submissions for the last slot.
    transaction.update(ref, {
      publicAccessClosed: guests.length >= expectedCount(boletim),
      updatedAt: now
    });
    return statusData(boletim, guests);
  });
}

function handler(db, Timestamp) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store, private, max-age=0');
    res.set('Pragma', 'no-cache');
    if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
    try {
      const result = await processRegistration(db, Timestamp, req.body, req.get('user-agent'));
      return res.json(result);
    } catch (error) {
      if (!(error instanceof RegistrationError)) console.error('Guest registration failed', error.code || 'internal');
      return res.status(error.status || 500).json({ error: error.code || 'save-error' });
    }
  };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateStay(boletim, input) {
  const checkinDate = boletim.checkinDate || input.checkinDate;
  const checkoutDate = boletim.checkoutDate || (input.checkoutUnknown === true ? '' : input.checkoutDate);
  if (!validDate(checkinDate) || (checkoutDate ? !validDate(checkoutDate) || checkoutDate <= checkinDate : input.checkoutUnknown !== true)) {
    throw new RegistrationError(400, 'invalid-dates');
  }
  return { checkinDate, checkoutDate };
}

module.exports = { handler, processRegistration, validateGuest, validateStay, validDate, statusData, isClosed, OWNER_UID, RegistrationError };
