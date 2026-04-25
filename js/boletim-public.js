import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBRx2EYDi3FpfmJjttO2wd9zeFVV3uH6Q0',
  authDomain: 'apartments-a4b17.firebaseapp.com',
  projectId: 'apartments-a4b17',
  storageBucket: 'apartments-a4b17.appspot.com',
  messagingSenderId: '465612199373',
  appId: '1:465612199373:web:2b8e1eb14f453caa532084'
};

const COLLECTION = 'alojamento_boletins';
const db = getFirestore(initializeApp(firebaseConfig));

const COUNTRY_CODES = [
  'PT', 'ES', 'FR', 'IT', 'DE', 'GB', 'IE', 'NL', 'BE', 'LU', 'CH', 'AT', 'DK', 'SE', 'NO', 'FI',
  'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'IS', 'LI',
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'VE', 'AU', 'NZ', 'CN', 'JP', 'KR', 'IN',
  'IL', 'TR', 'MA', 'DZ', 'TN', 'ZA', 'AO', 'MZ', 'CV', 'GW', 'ST'
];

const FALLBACK_COUNTRIES = {
  PT: 'Portugal',
  ES: 'Spain',
  FR: 'France',
  IT: 'Italy',
  DE: 'Germany',
  GB: 'United Kingdom',
  IE: 'Ireland',
  NL: 'Netherlands',
  BE: 'Belgium',
  LU: 'Luxembourg',
  CH: 'Switzerland',
  AT: 'Austria',
  DK: 'Denmark',
  SE: 'Sweden',
  NO: 'Norway',
  FI: 'Finland',
  PL: 'Poland',
  CZ: 'Czechia',
  SK: 'Slovakia',
  HU: 'Hungary',
  RO: 'Romania',
  BG: 'Bulgaria',
  GR: 'Greece',
  HR: 'Croatia',
  SI: 'Slovenia',
  EE: 'Estonia',
  LV: 'Latvia',
  LT: 'Lithuania',
  MT: 'Malta',
  CY: 'Cyprus',
  IS: 'Iceland',
  LI: 'Liechtenstein',
  US: 'United States',
  CA: 'Canada',
  MX: 'Mexico',
  BR: 'Brazil',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  PE: 'Peru',
  UY: 'Uruguay',
  VE: 'Venezuela',
  AU: 'Australia',
  NZ: 'New Zealand',
  CN: 'China',
  JP: 'Japan',
  KR: 'South Korea',
  IN: 'India',
  IL: 'Israel',
  TR: 'Turkey',
  MA: 'Morocco',
  DZ: 'Algeria',
  TN: 'Tunisia',
  ZA: 'South Africa',
  AO: 'Angola',
  MZ: 'Mozambique',
  CV: 'Cape Verde',
  GW: 'Guinea-Bissau',
  ST: 'Sao Tome and Principe'
};

const COPY = {
  pt: {
    title: 'Check-in de hóspede',
    subtitle: 'Preencha os dados necessários para o boletim de alojamento.',
    firstName: 'Nome',
    lastName: 'Apelido',
    birthDate: 'Data de nascimento',
    documentType: 'Tipo de identificação',
    documentNumber: 'Número de identificação',
    countryOrigin: 'País de origem',
    countryResidence: 'País de residência',
    documentCountry: 'País emissor do documento de identificação',
    declaration: 'Declaro a veracidade dos dados fornecidos e tenho conhecimento da base legal que exige o fornecimento dos dados incluídos neste formulário.',
    submit: 'Submeter',
    success: 'Dados submetidos com sucesso.',
    addAnother: 'Adicionar outro hóspede',
    invalidLink: 'Link inválido ou expirado.',
    loading: 'A carregar...',
    passport: 'Passaporte',
    idCard: 'Cartão de cidadão / identificação',
    other: 'Outro',
    progressTitle: 'Estado do grupo',
    guestLabel: 'Hóspede',
    emptySlot: 'Por preencher',
    checkin: 'Check-in',
    checkout: 'Check-out'
  },
  en: {
    title: 'Guest check-in',
    subtitle: 'Fill in the information required for the accommodation bulletin.',
    firstName: 'Name',
    lastName: 'Last name',
    birthDate: 'Date of birth',
    documentType: 'Identification type',
    documentNumber: 'Identification number',
    countryOrigin: 'Country of origin',
    countryResidence: 'Country of residence',
    documentCountry: 'Country of origin of the identification document',
    declaration: 'I declare the veracity of the data provided and I am aware of the legal basis which requires me to provide the data included on this form.',
    submit: 'Submit',
    success: 'Data submitted successfully.',
    addAnother: 'Add another guest',
    invalidLink: 'Invalid or expired link.',
    loading: 'Loading...',
    passport: 'Passport',
    idCard: 'ID card',
    other: 'Other',
    progressTitle: 'Group status',
    guestLabel: 'Guest',
    emptySlot: 'Not filled yet',
    checkin: 'Check-in',
    checkout: 'Check-out'
  },
  fr: {
    title: 'Check-in invité',
    subtitle: "Remplissez les informations nécessaires au bulletin d'hébergement.",
    firstName: 'Prénom',
    lastName: 'Nom',
    birthDate: 'Date de naissance',
    documentType: "Type d'identification",
    documentNumber: "Numéro d'identification",
    countryOrigin: "Pays d'origine",
    countryResidence: 'Pays de résidence',
    documentCountry: "Pays d'origine du document d'identification",
    declaration: "Je déclare l'exactitude des données fournies et je suis informé de la base légale qui exige la fourniture des données incluses dans ce formulaire.",
    submit: 'Envoyer',
    success: 'Données envoyées avec succès.',
    addAnother: 'Ajouter un autre invité',
    invalidLink: 'Lien invalide ou expiré.',
    loading: 'Chargement...',
    passport: 'Passeport',
    idCard: "Carte d'identité",
    other: 'Autre',
    progressTitle: 'Statut du groupe',
    guestLabel: 'Invité',
    emptySlot: 'À remplir',
    checkin: 'Arrivée',
    checkout: 'Départ'
  },
  es: {
    title: 'Check-in de huésped',
    subtitle: 'Rellene los datos necesarios para el boletín de alojamiento.',
    firstName: 'Nombre',
    lastName: 'Apellido',
    birthDate: 'Fecha de nacimiento',
    documentType: 'Tipo de identificación',
    documentNumber: 'Número de identificación',
    countryOrigin: 'País de origen',
    countryResidence: 'País de residencia',
    documentCountry: 'País de origen del documento de identificación',
    declaration: 'Declaro la veracidad de los datos proporcionados y soy consciente de la base legal que exige proporcionar los datos incluidos en este formulario.',
    submit: 'Enviar',
    success: 'Datos enviados correctamente.',
    addAnother: 'Añadir otro huésped',
    invalidLink: 'Enlace inválido o caducado.',
    loading: 'Cargando...',
    passport: 'Pasaporte',
    idCard: 'Documento de identidad',
    other: 'Otro',
    progressTitle: 'Estado del grupo',
    guestLabel: 'Huésped',
    emptySlot: 'Por rellenar',
    checkin: 'Entrada',
    checkout: 'Salida'
  }
};

const els = {
  title: document.getElementById('page-title'),
  subtitle: document.getElementById('page-subtitle'),
  form: document.getElementById('guest-form'),
  message: document.getElementById('checkin-message'),
  submit: document.getElementById('submit-guest'),
  firstName: document.getElementById('first-name'),
  lastName: document.getElementById('last-name'),
  birthDate: document.getElementById('birth-date'),
  documentType: document.getElementById('document-type'),
  documentNumber: document.getElementById('document-number'),
  countryOrigin: document.getElementById('country-origin'),
  countryResidence: document.getElementById('country-residence'),
  documentCountry: document.getElementById('document-country'),
  declaration: document.getElementById('declaration'),
  progress: document.getElementById('guest-progress'),
  stayDates: document.getElementById('stay-dates')
};

const state = {
  token: new URLSearchParams(window.location.search).get('t') || '',
  language: 'en',
  previousOrigin: '',
  expectedGuests: 1,
  checkinDate: '',
  checkoutDate: '',
  summaries: []
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  setMessage(COPY.en.loading);
  if (!state.token) {
    applyLanguage('en');
    showInvalid();
    return;
  }

  try {
    const snap = await getDoc(doc(db, COLLECTION, state.token));
    if (!snap.exists()) {
      applyLanguage('en');
      showInvalid();
      return;
    }

    const boletim = snap.data();
    state.language = COPY[boletim.language] ? boletim.language : 'en';
    state.expectedGuests = Math.max(1, Number(boletim.expectedGuests || 1));
    state.checkinDate = boletim.checkinDate || '';
    state.checkoutDate = boletim.checkoutDate || '';
    applyLanguage(state.language);
    populateCountries();
    els.subtitle.textContent = `${COPY[state.language].subtitle} ${boletim.guestName ? `(${boletim.guestName})` : ''}`;
    renderStayDates();
    await loadGuestSummaries();
    renderProgress();
    els.form.hidden = false;
    setMessage('');
    bindEvents();
  } catch (err) {
    console.error('Erro ao abrir boletim', err);
    applyLanguage('en');
    showInvalid();
  }
}

function bindEvents() {
  els.countryOrigin.addEventListener('change', handleOriginChange);
  els.countryResidence.addEventListener('change', () => els.countryResidence.dataset.touched = 'true');
  els.documentCountry.addEventListener('change', () => els.documentCountry.dataset.touched = 'true');
  els.form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();
  const t = COPY[state.language];

  if (!els.form.reportValidity()) return;
  els.submit.disabled = true;

  const payload = {
    firstName: els.firstName.value.trim(),
    lastName: els.lastName.value.trim(),
    birthDate: els.birthDate.value,
    documentType: els.documentType.value,
    documentNumber: els.documentNumber.value.trim(),
    countryOrigin: els.countryOrigin.value,
    countryResidence: els.countryResidence.value,
    documentCountry: els.documentCountry.value,
    checkinDate: state.checkinDate,
    checkoutDate: state.checkoutDate,
    declarationAccepted: els.declaration.checked,
    submittedAt: Timestamp.now(),
    userAgent: navigator.userAgent || ''
  };

  try {
    const guestRef = await addDoc(collection(db, COLLECTION, state.token, 'guests'), payload);
    const summary = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      submittedAt: payload.submittedAt
    };
    await setDoc(doc(db, COLLECTION, state.token, 'guest_summaries', guestRef.id), summary);
    state.summaries.push(summary);
    renderProgress();
    els.form.reset();
    els.countryResidence.dataset.touched = '';
    els.documentCountry.dataset.touched = '';
    state.previousOrigin = '';
    setMessage(`${t.success} <button id="add-another" type="button">${t.addAnother}</button>`, 'success');
    els.form.hidden = true;
    document.getElementById('add-another')?.addEventListener('click', () => {
      els.form.hidden = false;
      setMessage('');
      els.firstName.focus();
    });
  } catch (err) {
    console.error('Erro ao submeter hóspede', err);
    setMessage(t.invalidLink, 'error');
  } finally {
    els.submit.disabled = false;
  }
}

async function loadGuestSummaries() {
  const snap = await getDocs(collection(db, COLLECTION, state.token, 'guest_summaries'));
  state.summaries = snap.docs
    .map((docSnap) => docSnap.data())
    .sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt));
}

function renderProgress() {
  const t = COPY[state.language];
  const slots = [];
  const total = Math.max(state.expectedGuests, state.summaries.length || 0);

  for (let index = 0; index < total; index += 1) {
    const summary = state.summaries[index];
    const name = summary
      ? `${summary.firstName || ''} ${summary.lastName || ''}`.trim()
      : t.emptySlot;
    slots.push(`
      <div class="guest-slot">
        <strong>${t.guestLabel} ${index + 1}</strong>
        <span>${escapeHtml(name || t.emptySlot)}</span>
      </div>
    `);
  }

  els.progress.innerHTML = `<h2>${t.progressTitle}</h2>${slots.join('')}`;
  els.progress.hidden = false;
}

function renderStayDates() {
  const t = COPY[state.language];
  if (!state.checkinDate && !state.checkoutDate) {
    els.stayDates.hidden = true;
    return;
  }

  els.stayDates.innerHTML = `
    <span class="stay-date">${t.checkin}: ${escapeHtml(formatDateOnly(state.checkinDate, state.language))}</span>
    <span class="stay-date">${t.checkout}: ${escapeHtml(formatDateOnly(state.checkoutDate, state.language))}</span>
  `;
  els.stayDates.hidden = false;
}

function handleOriginChange() {
  const value = els.countryOrigin.value;
  const shouldSyncResidence = !els.countryResidence.dataset.touched || els.countryResidence.value === state.previousOrigin;
  const shouldSyncDocument = !els.documentCountry.dataset.touched || els.documentCountry.value === state.previousOrigin;

  if (shouldSyncResidence) els.countryResidence.value = value;
  if (shouldSyncDocument) els.documentCountry.value = value;
  state.previousOrigin = value;
}

function applyLanguage(lang) {
  const t = COPY[lang] || COPY.en;
  document.documentElement.lang = lang;
  els.title.textContent = t.title;
  els.subtitle.textContent = t.loading;
  els.submit.textContent = t.submit;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });

  els.documentType.innerHTML = `
    <option value="">${t.documentType}</option>
    <option value="passport">${t.passport}</option>
    <option value="id">${t.idCard}</option>
    <option value="other">${t.other}</option>
  `;
}

function populateCountries() {
  const countries = getCountries(state.language);
  const placeholder = `<option value="">${COPY[state.language].countryOrigin}</option>`;
  const options = countries
    .map((country) => `<option value="${country.code}">${escapeHtml(country.name)}</option>`)
    .join('');

  [els.countryOrigin, els.countryResidence, els.documentCountry].forEach((select) => {
    select.innerHTML = placeholder + options;
  });
}

function getCountries(lang) {
  const displayNames = typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames([lang], { type: 'region' })
    : null;

  return COUNTRY_CODES
    .map((code) => ({
      code,
      name: displayNames?.of(code) || FALLBACK_COUNTRIES[code] || code
    }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

function showInvalid() {
  els.form.hidden = true;
  els.subtitle.textContent = '';
  setMessage(COPY[state.language]?.invalidLink || COPY.en.invalidLink, 'error');
}

function setMessage(message, type = '') {
  els.message.className = `checkin-message ${type}`.trim();
  els.message.innerHTML = message || '';
  els.message.hidden = !message;
}

function toMillis(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function formatDateOnly(value, lang = 'en') {
  if (!value) return '-';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
