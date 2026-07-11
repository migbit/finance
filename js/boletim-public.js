import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  Timestamp,
  writeBatch
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
    staySubtitle: 'Estadia de {start} até {end}',
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
    submitting: 'A submeter...',
    updating: 'A guardar...',
    success: 'Dados submetidos com sucesso.',
    updateSuccess: 'Dados atualizados com sucesso.',
    saveError: 'Não foi possível guardar os dados. Tente novamente.',
    addAnother: 'Adicionar outro hóspede',
    edit: 'Editar',
    saveChanges: 'Guardar alterações',
    cancel: 'Cancelar',
    invalidLink: 'Link inválido ou expirado.',
    loading: 'A carregar...',
    passport: 'Passaporte',
    idCard: 'Cartão de cidadão / identificação',
    other: 'Outro',
    progressTitle: 'Hóspedes por preencher',
    guestLabel: 'Hóspede',
    emptySlot: 'Por preencher',
    fillGuest: 'Preencher dados',
    language: 'Idioma',
    checkin: 'Check-in',
    checkout: 'Check-out'
  },
  en: {
    title: 'Guest check-in',
    subtitle: 'Fill in the information required for the accommodation bulletin.',
    staySubtitle: 'Stay from {start} to {end}',
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
    submitting: 'Submitting...',
    updating: 'Saving...',
    success: 'Data submitted successfully.',
    updateSuccess: 'Data updated successfully.',
    saveError: 'The data could not be saved. Please try again.',
    addAnother: 'Add another guest',
    edit: 'Edit',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    invalidLink: 'Invalid or expired link.',
    loading: 'Loading...',
    passport: 'Passport',
    idCard: 'ID card',
    other: 'Other',
    progressTitle: 'Guests to complete',
    guestLabel: 'Guest',
    emptySlot: 'Not filled yet',
    fillGuest: 'Fill in details',
    language: 'Language',
    checkin: 'Check-in',
    checkout: 'Check-out'
  },
  fr: {
    title: 'Check-in invité',
    subtitle: "Remplissez les informations nécessaires au bulletin d'hébergement.",
    staySubtitle: 'Séjour du {start} au {end}',
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
    submitting: 'Envoi...',
    updating: 'Enregistrement...',
    success: 'Données envoyées avec succès.',
    updateSuccess: 'Données mises à jour avec succès.',
    saveError: "Impossible d'enregistrer les données. Veuillez réessayer.",
    addAnother: 'Ajouter un autre invité',
    edit: 'Modifier',
    saveChanges: 'Enregistrer les modifications',
    cancel: 'Annuler',
    invalidLink: 'Lien invalide ou expiré.',
    loading: 'Chargement...',
    passport: 'Passeport',
    idCard: "Carte d'identité",
    other: 'Autre',
    progressTitle: 'Invités à compléter',
    guestLabel: 'Invité',
    emptySlot: 'À remplir',
    fillGuest: 'Remplir les données',
    language: 'Langue',
    checkin: 'Arrivée',
    checkout: 'Départ'
  },
  es: {
    title: 'Check-in de huésped',
    subtitle: 'Rellene los datos necesarios para el boletín de alojamiento.',
    staySubtitle: 'Estancia del {start} al {end}',
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
    submitting: 'Enviando...',
    updating: 'Guardando...',
    success: 'Datos enviados correctamente.',
    updateSuccess: 'Datos actualizados correctamente.',
    saveError: 'No se pudieron guardar los datos. Inténtelo de nuevo.',
    addAnother: 'Añadir otro huésped',
    edit: 'Editar',
    saveChanges: 'Guardar cambios',
    cancel: 'Cancelar',
    invalidLink: 'Enlace inválido o caducado.',
    loading: 'Cargando...',
    passport: 'Pasaporte',
    idCard: 'Documento de identidad',
    other: 'Otro',
    progressTitle: 'Huéspedes por completar',
    guestLabel: 'Huésped',
    emptySlot: 'Por rellenar',
    fillGuest: 'Rellenar datos',
    language: 'Idioma',
    checkin: 'Entrada',
    checkout: 'Salida'
  },
  ko: {
    title: '게스트 체크인',
    subtitle: '숙박 신고에 필요한 정보를 입력해 주세요.',
    staySubtitle: '{start}부터 {end}까지 숙박',
    firstName: '이름',
    lastName: '성',
    birthDate: '생년월일',
    documentType: '신분증 종류',
    documentNumber: '신분증 번호',
    countryOrigin: '출신 국가',
    countryResidence: '거주 국가',
    documentCountry: '신분증 발급 국가',
    declaration: '제공한 정보가 사실임을 확인하며, 이 양식에 포함된 정보 제공을 요구하는 법적 근거를 인지하고 있습니다.',
    submit: '제출',
    submitting: '제출 중...',
    updating: '저장 중...',
    success: '정보가 성공적으로 제출되었습니다.',
    updateSuccess: '정보가 성공적으로 수정되었습니다.',
    saveError: '정보를 저장할 수 없습니다. 다시 시도해 주세요.',
    addAnother: '다른 게스트 추가',
    edit: '수정',
    saveChanges: '변경사항 저장',
    cancel: '취소',
    invalidLink: '유효하지 않거나 만료된 링크입니다.',
    loading: '불러오는 중...',
    passport: '여권',
    idCard: '신분증',
    other: '기타',
    progressTitle: '입력할 게스트',
    guestLabel: '게스트',
    emptySlot: '미입력',
    fillGuest: '정보 입력',
    language: '언어',
    checkin: '체크인',
    checkout: '체크아웃'
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
  stayDates: document.getElementById('stay-dates'),
  languageSelect: document.getElementById('language-select'),
  languageLabel: document.getElementById('language-label'),
  cancelEdit: document.getElementById('cancel-edit')
};

const state = {
  token: new URLSearchParams(window.location.search).get('t') || '',
  language: 'en',
  previousOrigin: '',
  expectedGuests: 1,
  checkinDate: '',
  checkoutDate: '',
  guests: [],
  editingGuestId: ''
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindLanguageEvents();
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
    els.subtitle.textContent = formatStaySubtitle();
    renderStayDates();
    await loadGuests();
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
  els.progress.addEventListener('click', handleProgressClick);
  els.cancelEdit?.addEventListener('click', startAddingGuest);
}

function bindLanguageEvents() {
  els.languageSelect?.addEventListener('change', handleLanguageChange);
}

function handleLanguageChange() {
  const nextLanguage = COPY[els.languageSelect.value] ? els.languageSelect.value : 'en';
  changeLanguage(nextLanguage);
}

function changeLanguage(nextLanguage) {
  const selectedCountries = {
    origin: els.countryOrigin.value,
    residence: els.countryResidence.value,
    documentCountry: els.documentCountry.value
  };
  const selectedDocumentType = els.documentType.value;

  state.language = nextLanguage;
  applyLanguage(state.language);
  els.documentType.value = selectedDocumentType;
  populateCountries();
  restoreCountrySelections(selectedCountries);
  renderTranslatedContent();
}

function renderTranslatedContent() {
  els.subtitle.textContent = formatStaySubtitle();
  renderStayDates();
  if (state.guests.length || !els.progress.hidden) renderProgress();
  updateFormActions();
}

async function handleSubmit(event) {
  event.preventDefault();
  const t = COPY[state.language];
  const editingGuest = state.guests.find((guest) => guest.id === state.editingGuestId);

  if (!els.form.reportValidity()) return;
  els.submit.disabled = true;
  if (els.cancelEdit) els.cancelEdit.disabled = true;
  els.submit.textContent = editingGuest ? t.updating : t.submitting;

  const formData = {
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
    declarationAccepted: els.declaration.checked
  };

  try {
    if (editingGuest) {
      await updateGuest(editingGuest, formData);
    } else {
      await createGuest(formData);
    }

    renderProgress();
    const successMessage = editingGuest ? t.updateSuccess : t.success;
    resetGuestForm();
    setMessage(`${successMessage} <button id="add-another" type="button">${t.addAnother}</button>`, 'success');
    els.form.hidden = true;
    document.getElementById('add-another')?.addEventListener('click', startAddingGuest);
  } catch (err) {
    console.error('Erro ao guardar hóspede', err);
    setMessage(t.saveError, 'error');
  } finally {
    els.submit.disabled = false;
    if (els.cancelEdit) els.cancelEdit.disabled = false;
    updateFormActions();
  }
}

async function createGuest(formData) {
  const guestRef = doc(collection(db, COLLECTION, state.token, 'guests'));
  const submittedAt = Timestamp.now();
  const payload = {
    ...formData,
    submittedAt,
    userAgent: navigator.userAgent || ''
  };
  await setDoc(guestRef, payload);
  await setDoc(doc(db, COLLECTION, state.token, 'guest_summaries', guestRef.id), {
    firstName: payload.firstName,
    lastName: payload.lastName,
    submittedAt
  });
  state.guests.push({ id: guestRef.id, ...payload });
  sortGuests();
}

async function updateGuest(guest, formData) {
  const changes = {
    ...formData,
    updatedAt: Timestamp.now()
  };
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTION, state.token, 'guests', guest.id), changes);
  batch.set(doc(db, COLLECTION, state.token, 'guest_summaries', guest.id), {
    firstName: changes.firstName,
    lastName: changes.lastName,
    submittedAt: guest.submittedAt
  }, { merge: true });
  await batch.commit();
  Object.assign(guest, changes);
  sortGuests();
}

async function loadGuests() {
  try {
    const snap = await getDocs(collection(db, COLLECTION, state.token, 'guests'));
    state.guests = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      editable: true,
      ...docSnap.data()
    }));
  } catch (err) {
    console.warn('Leitura completa indisponível; a usar resumos dos hóspedes.', err);
    const snap = await getDocs(collection(db, COLLECTION, state.token, 'guest_summaries'));
    state.guests = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      editable: false,
      ...docSnap.data()
    }));
  }
  sortGuests();
}

function sortGuests() {
  state.guests.sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt));
}

function renderProgress() {
  const t = COPY[state.language];
  const slots = [];
  const total = Math.max(state.expectedGuests, state.guests.length || 0);

  for (let index = 0; index < total; index += 1) {
    const guest = state.guests[index];
    const name = guest
      ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim()
      : t.emptySlot;
    slots.push(guest ? `
      <div class="guest-slot guest-slot-complete">
        <div class="guest-slot-info">
          <strong>${t.guestLabel} ${index + 1}</strong>
          <span>${escapeHtml(name || t.emptySlot)}</span>
        </div>
        ${guest.editable !== false ? `
          <div class="guest-slot-actions">
            <button type="button" data-action="edit-guest" data-guest-id="${escapeHtml(guest.id)}">${t.edit}</button>
          </div>
        ` : ''}
      </div>
    ` : `
      <button type="button" class="guest-slot guest-slot-empty" data-action="add-guest">
        <span class="guest-slot-info">
          <strong>${t.guestLabel} ${index + 1}</strong>
          <span>${t.emptySlot}</span>
        </span>
        <span class="guest-slot-cta">${t.fillGuest} ↓</span>
      </button>
    `);
  }

  const hasEmptyExpectedSlots = state.guests.length < state.expectedGuests;

  els.progress.innerHTML = `
    <h2>${t.progressTitle}</h2>
    ${slots.join('')}
    ${hasEmptyExpectedSlots ? '' : `
      <button type="button" class="guest-progress-add" data-action="add-guest">${t.addAnother}</button>
    `}
  `;
  els.progress.hidden = false;
}

function handleProgressClick(event) {
  const editButton = event.target.closest('[data-action="edit-guest"]');
  if (editButton) {
    startEditingGuest(editButton.dataset.guestId);
    return;
  }

  if (event.target.closest('[data-action="add-guest"]')) {
    startAddingGuest();
  }
}

function startEditingGuest(guestId) {
  const guest = state.guests.find((item) => item.id === guestId);
  if (!guest) return;

  state.editingGuestId = guest.id;
  els.firstName.value = guest.firstName || '';
  els.lastName.value = guest.lastName || '';
  els.birthDate.value = guest.birthDate || '';
  els.documentType.value = guest.documentType || '';
  els.documentNumber.value = guest.documentNumber || '';
  els.countryOrigin.value = guest.countryOrigin || '';
  els.countryResidence.value = guest.countryResidence || '';
  els.documentCountry.value = guest.documentCountry || '';
  els.declaration.checked = Boolean(guest.declarationAccepted);
  els.countryResidence.dataset.touched = 'true';
  els.documentCountry.dataset.touched = 'true';
  state.previousOrigin = guest.countryOrigin || '';
  els.form.hidden = false;
  setMessage('');
  updateFormActions();
  els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.firstName.focus({ preventScroll: true });
}

function startAddingGuest() {
  resetGuestForm();
  els.form.hidden = false;
  setMessage('');
  updateFormActions();
  els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.firstName.focus({ preventScroll: true });
}

function resetGuestForm() {
  state.editingGuestId = '';
  els.form.reset();
  els.countryResidence.dataset.touched = '';
  els.documentCountry.dataset.touched = '';
  state.previousOrigin = '';
}

function updateFormActions() {
  const t = COPY[state.language] || COPY.en;
  const isEditing = Boolean(state.editingGuestId);
  els.submit.textContent = isEditing ? t.saveChanges : t.submit;
  if (els.cancelEdit) {
    els.cancelEdit.textContent = t.cancel;
    els.cancelEdit.hidden = !isEditing;
  }
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

function formatStaySubtitle() {
  const t = COPY[state.language];
  if (!state.checkinDate || !state.checkoutDate) {
    return t.subtitle;
  }

  return t.staySubtitle
    .replace('{start}', formatLongDate(state.checkinDate, state.language))
    .replace('{end}', formatLongDate(state.checkoutDate, state.language));
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
  if (els.languageSelect) els.languageSelect.value = COPY[lang] ? lang : 'en';
  if (els.languageLabel) els.languageLabel.textContent = t.language;
  els.title.textContent = t.title;
  els.subtitle.textContent = t.loading;
  updateFormActions();
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

function restoreCountrySelections(selectedCountries) {
  els.countryOrigin.value = selectedCountries.origin || '';
  els.countryResidence.value = selectedCountries.residence || '';
  els.documentCountry.value = selectedCountries.documentCountry || '';
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

function formatLongDate(value, lang = 'en') {
  if (!value) return '-';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
