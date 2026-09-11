import { GUIDANCE } from './boletim-public-copy.js';
import { DATES_COPY } from './boletim-dates-copy.js';
import { PRIVACY_COPY } from './boletim-privacy-copy.js';
import { PROPERTIES, COUNTRY_CODES, FALLBACK_COUNTRIES } from './boletim-properties.js';

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

Object.entries(GUIDANCE).forEach(([lang, guidance]) => Object.assign(COPY[lang], guidance, PRIVACY_COPY[lang], DATES_COPY[lang]));

const els = {
  title: document.getElementById('page-title'),
  subtitle: document.getElementById('page-subtitle'),
  form: document.getElementById('guest-form'),
  message: document.getElementById('checkin-message'),
  submit: document.getElementById('submit-guest'),
  firstName: document.getElementById('first-name'),
  lastName: document.getElementById('last-name'),
  birthDate: document.getElementById('birth-date'),
  checkinDate: document.getElementById('guest-checkin'),
  checkoutDate: document.getElementById('guest-checkout'),
  checkoutUnknown: document.getElementById('unknown-checkout'),
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
  cancelEdit: document.getElementById('cancel-edit'),
  formTitle: document.getElementById('form-title'),
  instructions: document.getElementById('form-instructions'),
  nameHelp: document.getElementById('name-help'),
  saveHelp: document.getElementById('save-help')
};

const state = {
  token: new URLSearchParams(window.location.search).get('t') || '',
  language: 'en',
  expectedGuests: 1,
  checkinDate: '',
  checkoutDate: '',
  guests: [],
  editingGuestId: '',
  busy: false,
  ready: false,
  drafts: new Map(),
  baselines: new Map(),
  notice: null,
  pendingGuestRef: null,
  propertyId: '',
  closed: false
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindLanguageEvents();
  bindEvents();
  els.form.noValidate = true;
  const today = new Date();
  els.birthDate.max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  els.firstName.setAttribute('aria-describedby', 'name-help');
  await openBoletim();
  setInterval(checkAccess, 20000);
  document.addEventListener('visibilitychange', checkAccess);
  window.addEventListener('pageshow', checkAccess);
}

async function openBoletim() {
  setMessage(COPY.en.loading);
  if (!state.token) {
    applyLanguage('en');
    showInvalid();
    return;
  }

  try {
    const boletim = await registrationRequest('status');
    state.language = COPY[boletim.language] ? boletim.language : 'en';
    applyLanguage(state.language);
    state.ready = true;
    if (boletim.closed) { closePublicAccess(); return; }
    state.expectedGuests = boletim.expectedGuests;
    state.checkinDate = boletim.checkinDate || '';
    state.checkoutDate = boletim.checkoutDate || '';
    state.propertyId = boletim.propertyId || '';
    state.guests = boletim.guests || [];
    populateCountries();
    els.subtitle.textContent = formatStaySubtitle();
    renderStayDates();
    renderInformation();
    state.ready = true;
    renderProgress();
    if (state.guests.length >= state.expectedGuests) {
      showCompletion();
    } else {
      startAddingGuest(false);
    }
  } catch (err) {
    console.error('Erro ao abrir boletim', err);
    els.form.hidden = true;
    state.notice = { kind: err.code === 'invalid-link' ? 'invalidLink' : 'loadError' };
    renderNotice();
  }
}

function bindEvents() {
  document.getElementById('why-data').addEventListener('click', () => {
    document.getElementById('legal-information')?.focus({ preventScroll: true });
  });
  els.form.addEventListener('submit', handleSubmit);
  els.progress.addEventListener('click', handleProgressClick);
  els.cancelEdit?.addEventListener('click', returnToRegistration);
  els.message.addEventListener('click', (event) => {
    if (state.busy) return;
    if (event.target.closest('[data-action="retry"]')) openBoletim();
    if (event.target.closest('[data-action="add-guest"]')) startAddingGuest();
    const editButton = event.target.closest('[data-action="edit-guest"]');
    if (editButton) startEditingGuest(editButton.dataset.guestId);
  });
  els.form.addEventListener('input', handleFormInput);
  els.form.addEventListener('change', handleFormInput);
  window.addEventListener('beforeunload', (event) => {
    rememberDraft();
    if (state.busy || hasUnsavedDrafts()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

function bindLanguageEvents() {
  els.languageSelect?.addEventListener('change', handleLanguageChange);
}

function handleLanguageChange() {
  if (state.busy) return;
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
  els.subtitle.textContent = state.closed ? '' : formatStaySubtitle();
  renderInformation();
  renderStayDates();
  if (!state.closed && (state.guests.length || !els.progress.hidden)) renderProgress();
  updateFormActions();
  renderNotice();
  if (els.form.querySelector('[aria-invalid="true"]')) validateForm(false);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.busy || state.closed || !state.ready || els.form.hidden) return;
  const t = COPY[state.language];
  const editingGuest = state.guests.find((guest) => guest.id === state.editingGuestId);

  if (!validateForm()) return;

  const formData = {
    firstName: els.firstName.value.trim(),
    lastName: els.lastName.value.trim(),
    birthDate: els.birthDate.value,
    documentType: els.documentType.value,
    documentNumber: els.documentNumber.value.trim(),
    countryOrigin: els.countryOrigin.value,
    countryResidence: els.countryResidence.value,
    documentCountry: els.documentCountry.value,
    checkinDate: els.checkinDate.value,
    checkoutDate: els.checkoutDate.value,
    checkoutUnknown: els.checkoutUnknown.checked,
    declarationAccepted: els.declaration.checked
  };

  setBusy(true);
  els.submit.textContent = t.updating;
  try {
    if (editingGuest) {
      await updateGuest(editingGuest, formData);
    } else {
      await createGuest(formData);
    }

    if (state.closed) { focusSection(els.message); return; }
    state.drafts.delete(state.editingGuestId);
    state.baselines.delete(state.editingGuestId);
    resetGuestForm();
    renderProgress();
    const name = `${formData.firstName} ${formData.lastName}`;
    // Keep a partially filled next guest when returning from an edit.
    if (state.guests.length < state.expectedGuests || state.drafts.has('')) {
      openGuestForm('');
      state.notice = { kind: 'saved', name };
      renderNotice();
      focusSection(els.message);
    } else {
      showCompletion();
      focusSection(els.message);
    }
  } catch (err) {
    console.error('Erro ao guardar hóspede', err);
    state.notice = { kind: 'saveError' };
    renderNotice();
    focusSection(els.message);
  } finally {
    setBusy(false);
    updateFormActions();
  }
}

async function registrationRequest(action, extra = {}) {
  const response = await fetch('/api/guest-registration', {
    method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: state.token, action, ...extra })
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'save-error');
    error.code = result.error;
    throw error;
  }
  return result;
}

async function createGuest(formData) {
  state.pendingGuestRef ||= crypto.randomUUID();
  const result = await registrationRequest('save', { guestId: state.pendingGuestRef, data: formData });
  state.pendingGuestRef = null;
  if (result.closed) { closePublicAccess(); return; }
  state.guests = result.guests;
}

async function updateGuest(guest, formData) {
  const result = await registrationRequest('save', { guestId: guest.id, editing: true, data: formData });
  if (result.closed) { closePublicAccess(); return; }
  state.guests = result.guests;
}

function closePublicAccess() {
  state.closed = true;
  state.guests = [];
  state.drafts.clear();
  state.baselines.clear();
  state.propertyId = '';
  state.checkinDate = '';
  state.checkoutDate = '';
  state.pendingGuestRef = null;
  resetGuestForm();
  els.progress.replaceChildren();
  els.progress.hidden = true;
  els.stayDates.replaceChildren();
  els.stayDates.hidden = true;
  state.notice = { kind: 'closed' };
  els.subtitle.textContent = '';
  renderInformation();
  renderNotice();
}

async function checkAccess() {
  if (!state.ready || state.closed || state.busy || document.hidden) return;
  try {
    const result = await registrationRequest('status');
    if (result.closed) closePublicAccess();
  } catch { /* An unavailable connection must not erase an unsent draft. */ }
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
          <strong>✓ ${t.guestLabel} ${index + 1} · ${t.saved}</strong>
          <span>${escapeHtml(name || t.emptySlot)}</span>
        </div>
        ${guest.editable !== false ? `
          <div class="guest-slot-actions">
            <button type="button" data-action="edit-guest" data-guest-id="${escapeHtml(guest.id)}">${t.edit}</button>
          </div>
        ` : ''}
      </div>
    ` : `
      <div class="guest-slot">
        <span class="guest-slot-info">
          <strong>${t.guestLabel} ${index + 1}</strong>
          <span>${t.emptySlot}</span>
        </span>
      </div>
    `);
  }

  const expanded = els.progress.querySelector('details')?.open;
  const progressLabel = interpolate(t.progress, { saved: state.guests.length, total });
  els.progress.innerHTML = `
    <h2>${progressLabel}</h2>
    <progress max="${total}" value="${state.guests.length}" aria-label="${progressLabel}"></progress>
    <details ${expanded ? 'open' : ''}>
      <summary>${t.viewGuests}</summary>
      ${slots.join('')}
    </details>
  `;
  els.progress.hidden = false;
}

function handleProgressClick(event) {
  if (state.busy) return;
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
  if (state.busy || state.closed) return;
  const guest = state.guests.find((item) => item.id === guestId);
  if (!guest || guest.editable === false) return;
  rememberDraft();
  openGuestForm(guest.id);
  state.notice = null;
  renderNotice();
  focusSection(els.formTitle);
}

function startAddingGuest(moveFocus = true) {
  if (state.busy || state.closed) return;
  rememberDraft();
  openGuestForm('');
  state.notice = null;
  renderNotice();
  if (moveFocus) focusSection(els.formTitle);
}

const FORM_FIELDS = ['firstName', 'lastName', 'birthDate', 'documentType', 'documentNumber', 'countryOrigin', 'countryResidence', 'documentCountry', 'checkinDate', 'checkoutDate'];

function readForm() {
  return {
    ...Object.fromEntries(FORM_FIELDS.map((key) => [key, els[key].value])),
    checkoutUnknown: els.checkoutUnknown.checked,
    declarationAccepted: els.declaration.checked
  };
}

function rememberDraft() {
  if (!state.ready || els.form.hidden) return;
  const value = readForm();
  if (JSON.stringify(value) === state.baselines.get(state.editingGuestId)) {
    state.drafts.delete(state.editingGuestId);
  } else {
    state.drafts.set(state.editingGuestId, value);
  }
}

function hasUnsavedDrafts() {
  return state.drafts.size > 0;
}

function openGuestForm(guestId) {
  state.editingGuestId = guestId;
  const guest = state.guests.find((item) => item.id === guestId) || {};
  const baseline = {
    ...Object.fromEntries(FORM_FIELDS.map((key) => [key, guest[key] || ''])),
    checkinDate: guest.checkinDate || state.checkinDate,
    checkoutDate: guest.checkoutDate || state.checkoutDate,
    checkoutUnknown: Boolean(guest.id && !guest.checkoutDate && !state.checkoutDate),
    declarationAccepted: Boolean(guest.declarationAccepted)
  };
  state.baselines.set(guestId, JSON.stringify(baseline));
  const values = state.drafts.get(guestId) || baseline;
  FORM_FIELDS.forEach((key) => { els[key].value = values[key] || ''; });
  els.declaration.checked = Boolean(values.declarationAccepted);
  els.checkoutUnknown.checked = Boolean(values.checkoutUnknown);
  updateDateControls();
  clearErrors();
  els.form.hidden = false;
  updateFormActions();
}

function returnToRegistration() {
  if (state.busy) return;
  rememberDraft();
  // Returning keeps edits in memory; they are sent only by pressing Save.
  els.form.hidden = true;
  if (state.guests.length < state.expectedGuests) {
    startAddingGuest();
  } else {
    showCompletion();
    focusSection(els.message);
  }
}

function resetGuestForm() {
  state.editingGuestId = '';
  els.form.reset();
  clearErrors();
  els.form.hidden = true;
}

function updateFormActions() {
  const t = COPY[state.language] || COPY.en;
  const isEditing = Boolean(state.editingGuestId);
  const guest = state.guests.find((item) => item.id === state.editingGuestId);
  const current = state.guests.length + 1;
  const isLast = current >= state.expectedGuests;
  els.submit.textContent = state.busy ? t.updating : isEditing ? t.saveChanges
    : !isLast ? t.submitNext : state.expectedGuests === 1 || current > state.expectedGuests ? t.submitSingle : t.submitLast;
  els.formTitle.textContent = isEditing
    ? interpolate(t.editTitle, { name: `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim() })
    : current > state.expectedGuests ? t.extraTitle : interpolate(t.formTitle, { current, total: state.expectedGuests });
  els.instructions.textContent = t.instructions;
  els.nameHelp.textContent = t.nameHelp;
  els.saveHelp.textContent = t.saveHelp;
  const numberLabel = document.querySelector('[for="document-number"]');
  numberLabel.textContent = els.documentType.value === 'passport' ? t.passportNumber : t.idNumber;
  if (els.cancelEdit) {
    els.cancelEdit.textContent = t.back;
    els.cancelEdit.hidden = !isEditing && current <= state.expectedGuests;
  }
}

function renderStayDates() {
  const t = COPY[state.language];
  if (!state.checkinDate && !state.checkoutDate) {
    els.stayDates.hidden = true;
    return;
  }

  els.stayDates.innerHTML = `
    <span class="stay-date">${t.checkin}: ${escapeHtml(formatLongDate(state.checkinDate, state.language))}</span>
    <span class="stay-date">${t.checkout}: ${escapeHtml(formatLongDate(state.checkoutDate, state.language))}</span>
  `;
  els.stayDates.hidden = false;
}

function formatStaySubtitle() {
  return COPY[state.language].intro;
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
  const placeholder = `<option value="">${COPY[state.language].selectCountry}</option>`;
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
  state.notice = { kind: 'invalidLink' };
  renderNotice();
}

function setMessage(message, type = '') {
  els.message.className = `checkin-message ${type}`.trim();
  els.message.innerHTML = message || '';
  els.message.hidden = !message;
}

function interpolate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

function focusSection(element) {
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.focus({ preventScroll: true });
}

function setBusy(busy) {
  state.busy = busy;
  els.form.setAttribute('aria-busy', String(busy));
  document.querySelectorAll('input, select, button').forEach((control) => { control.disabled = busy; });
  if (!busy) updateDateControls();
}

function showCompletion() {
  els.form.hidden = true;
  state.notice = { kind: 'complete' };
  renderNotice();
}

function renderNotice() {
  const t = COPY[state.language];
  const notice = state.notice;
  if (!notice) { setMessage(''); return; }
  if (notice.kind === 'closed') {
    setMessage(`<h2>${t.closedTitle}</h2><p>${t.closedBody}</p><p><a href="mailto:apartments.oporto@gmail.com">apartments.oporto@gmail.com</a><br><a href="tel:+351935519009">+351 935 519 009</a></p>`, 'success');
    return;
  }
  if (notice.kind === 'complete') {
    const pending = [...state.drafts.keys()];
    if (pending.length) {
      setMessage(`<h2>${t.draftNotice}</h2><p>${t.pendingHelp}</p>${pending.map((id) => {
        const guest = state.guests.find((item) => item.id === id);
        return id ? `<button type="button" data-action="edit-guest" data-guest-id="${escapeHtml(id)}">${t.edit}: ${escapeHtml(guest?.firstName || t.guestLabel)}</button>`
          : `<button type="button" data-action="add-guest">${t.resume}</button>`;
      }).join(' ')}`);
      return;
    }
    const body = state.guests.length === 1 ? t.completeSingle : interpolate(t.completeBody, { total: state.guests.length });
    setMessage(`<h2>${t.completeTitle}</h2><p>${body}</p><details><summary>${t.additional}</summary><button type="button" data-action="add-guest">${t.addAnother}</button></details>`, 'success');
    return;
  }
  if (notice.kind === 'saved') {
    const remaining = Math.max(0, state.expectedGuests - state.guests.length);
    setMessage(`<strong>${escapeHtml(interpolate(t.savedGuest, { name: notice.name }))}</strong>${remaining ? `<p>${interpolate(t.remaining, { remaining })}</p>` : ''}`, 'success');
    return;
  }
  const retry = notice.kind === 'loadError' ? `<p><button type="button" data-action="retry">${t.retry}</button></p>` : '';
  setMessage(`${t[notice.kind] || t.saveError}${retry}`, 'error');
}

function renderInformation() {
  const t = COPY[state.language];
  const property = PROPERTIES[state.propertyId];
  const context = document.getElementById('property-context');
  context.innerHTML = state.closed ? '' : `${property ? `<strong>${property.names[state.language]}</strong>` : ''}<small>${t.host}: Miguel Maia</small>${property ? `<small>${t.licence}: ${property.licence}</small>` : ''}`;
  context.hidden = state.closed;
  document.getElementById('why-data').textContent = t.why;
  const information = document.getElementById('registration-information');
  const expanded = information.querySelector('details')?.open;
  information.innerHTML = `
    <section id="legal-information" tabindex="-1">
      <h2>${t.legalTitle}</h2><p>${t.legalBody}</p><p><strong>${t.noCopy}</strong></p>
      <p><a href="https://siba.ssi.gov.pt/ajuda/perguntas-frequentes/" target="_blank" rel="noopener noreferrer">${t.verify} ↗</a></p>
      ${state.closed ? '' : `<a href="#form-title">${t.backToForm} ↑</a>`}
    </section>
    <details ${expanded ? 'open' : ''}><summary>${t.privacyTitle}</summary>
      <p><strong>${t.controller}:</strong> Oliveira Maia &amp; Maia Teixeira, Lda.</p>
      <p><strong>${t.contact}:</strong> Miguel Maia · <a href="tel:+351935519009">+351 935 519 009</a> · <a href="mailto:apartments.oporto@gmail.com">apartments.oporto@gmail.com</a></p>
      <p>${t.purpose}</p><p>${t.retention}</p><p>${t.rights} <a href="https://www.cnpd.pt/" target="_blank" rel="noopener noreferrer">CNPD ↗</a></p>
    </details>`;
}

function clearFieldError(field) {
  field.removeAttribute('aria-invalid');
  document.getElementById(`${field.id}-error`)?.remove();
  const describedBy = (field.getAttribute('aria-describedby') || '').split(' ').filter((id) => id && id !== `${field.id}-error`);
  if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
  else field.removeAttribute('aria-describedby');
}

function clearErrors() {
  els.form.querySelectorAll('[aria-invalid="true"]').forEach(clearFieldError);
  document.getElementById('stay-error').hidden = true;
}

function handleFormInput(event) {
  const field = event.target;
  if (field.matches('input, select')) clearFieldError(field);
  if (field === els.documentType) updateFormActions();
  if (field === els.checkoutUnknown) updateDateControls();
  rememberDraft();
}

function validateForm(moveFocus = true) {
  clearErrors();
  const t = COPY[state.language];
  let firstInvalid = null;
  els.form.querySelectorAll('[required]').forEach((field) => {
    let message = '';
    if (field === els.declaration && !field.checked) message = t.requiredDeclaration;
    else if (field === els.birthDate && (!field.value || !field.validity.valid)) message = t.invalidDate;
    else if (field.type !== 'checkbox' && !field.value.trim()) message = field.tagName === 'SELECT' ? t.requiredSelect : t.requiredField;
    if (!message) return;
    firstInvalid ||= field;
    field.setAttribute('aria-invalid', 'true');
    const error = document.createElement('small');
    error.id = `${field.id}-error`;
    error.className = 'field-error';
    error.textContent = message;
    const container = field === els.declaration ? field.closest('label').querySelector('span') : field.parentElement;
    container.append(error);
    field.setAttribute('aria-describedby', `${field.getAttribute('aria-describedby') || ''} ${error.id}`.trim());
  });
  if (!els.checkinDate.value || !els.checkinDate.validity.valid || (!els.checkoutUnknown.checked && (!els.checkoutDate.value || !els.checkoutDate.validity.valid || els.checkoutDate.value <= els.checkinDate.value))) {
    const error = document.getElementById('stay-error');
    error.textContent = t.invalidStay;
    error.hidden = false;
    firstInvalid ||= !els.checkinDate.value ? els.checkinDate : els.checkoutDate;
  }
  if (firstInvalid) {
    state.notice = { kind: 'fixErrors' };
    renderNotice();
    if (moveFocus) focusSection(firstInvalid);
    return false;
  }
  return true;
}

function updateDateControls() {
  els.checkinDate.readOnly = Boolean(state.checkinDate);
  els.checkoutDate.readOnly = Boolean(state.checkoutDate);
  document.getElementById('unknown-checkout-label').hidden = Boolean(state.checkoutDate);
  if (state.checkoutDate) els.checkoutUnknown.checked = false;
  if (els.checkoutUnknown.checked) els.checkoutDate.value = '';
  els.checkoutDate.disabled = els.checkoutUnknown.checked || state.busy;
  els.checkoutDate.required = !els.checkoutUnknown.checked;
  document.getElementById('individual-dates').hidden = Boolean(state.checkinDate && state.checkoutDate);
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
