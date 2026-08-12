import { db } from './script.js';
import { showConfirm, showToast } from './toast.js';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  buildTasteProfile,
  listFilterValues,
  matchesFilters,
  recommendCatalog
} from './meditacao-recommender.js';

const ACCESS_PIN = '6969';
const CATALOG_URLS = [
  '../data/meditations/buddhist.json',
  '../data/meditations/asian-non-buddhist.json',
  '../data/meditations/global-modern.json'
];
const PAGE_SIZE = 24;
const CATALOG_VERSION = '2026-08-12';
const PIN_STORAGE_PREFIX = 'meditacao-pin-unlocked-v1';

const LABELS = Object.freeze({
  chair: 'cadeira',
  'cushion-cross-legged': 'almofada / pernas cruzadas',
  kneeling: 'ajoelhado',
  standing: 'de pé',
  walking: 'caminhada',
  lying: 'deitado',
  movement: 'movimento',
  low: 'baixa',
  medium: 'média',
  high: 'alta',
  moderate: 'moderada',
  beginner: 'iniciante',
  intermediate: 'intermédia',
  advanced: 'avançada',
  'body-centered': 'centrada no corpo',
  'visual-concentration': 'concentração visual',
  'mindful-observation': 'observação consciente',
  contemplation: 'contemplação',
  'affect-centered': 'cultivo afetivo',
  'mantra-meditation': 'mantra / recitação',
  movement: 'movimento',
  focused: 'atenção focada',
  open: 'atenção aberta',
  constructive: 'construtiva',
  deconstructive: 'desconstrutiva',
  breath: 'respiração',
  body: 'corpo',
  sound: 'som',
  silence: 'silêncio',
  image: 'imagem',
  visualization: 'visualização',
  mantra: 'mantra',
  prayer: 'oração',
  emotion: 'emoção',
  movement: 'movimento',
  walking: 'caminhada',
  secular: 'secular',
  devotional: 'devocional',
  individual: 'individual'
});

const DIMENSION_LABELS = Object.freeze({
  beliefSystems: 'sistema de crença',
  traditions: 'tradição',
  families: 'família de prática',
  attentionModes: 'modo de atenção',
  anchors: 'âncora',
  features: 'característica',
  goals: 'objetivo',
  positions: 'posição'
});

const elements = {
  access: document.getElementById('meditation-access'),
  authGate: document.getElementById('meditation-auth-gate'),
  login: document.getElementById('meditation-login'),
  pinForm: document.getElementById('meditation-pin-form'),
  pin: document.getElementById('meditation-pin'),
  pinError: document.getElementById('meditation-pin-error'),
  lock: document.getElementById('meditation-lock'),
  app: document.getElementById('meditation-app'),
  active: document.getElementById('meditation-active'),
  activeName: document.getElementById('meditation-active-name'),
  activeTime: document.getElementById('meditation-active-time'),
  activeOpen: document.getElementById('meditation-active-open'),
  statTotal: document.getElementById('meditation-stat-total'),
  statNew: document.getElementById('meditation-stat-new'),
  statTried: document.getElementById('meditation-stat-tried'),
  statSessions: document.getElementById('meditation-stat-sessions'),
  search: document.getElementById('meditation-search'),
  status: document.getElementById('meditation-status-filter'),
  sort: document.getElementById('meditation-sort'),
  clearFilters: document.getElementById('meditation-clear-filters'),
  filterCount: document.getElementById('meditation-filter-count'),
  learningNote: document.getElementById('meditation-learning-note'),
  resultsCount: document.getElementById('meditation-results-count'),
  list: document.getElementById('meditation-list'),
  showMore: document.getElementById('meditation-show-more'),
  detailDialog: document.getElementById('meditation-detail-dialog'),
  detailContent: document.getElementById('meditation-detail-content'),
  sessionDialog: document.getElementById('meditation-session-dialog'),
  sessionHide: document.getElementById('meditation-session-hide'),
  sessionName: document.getElementById('meditation-session-name'),
  sessionClock: document.getElementById('meditation-session-clock'),
  sessionPhase: document.getElementById('meditation-session-phase'),
  sessionProgress: document.getElementById('meditation-session-progress-bar'),
  sessionMinutes: document.getElementById('meditation-session-minutes'),
  sessionSteps: document.getElementById('meditation-session-steps'),
  sessionPause: document.getElementById('meditation-session-pause'),
  sessionCancel: document.getElementById('meditation-session-cancel'),
  sessionFinish: document.getElementById('meditation-session-finish'),
  ratingDialog: document.getElementById('meditation-rating-dialog'),
  ratingForm: document.getElementById('meditation-rating-form'),
  rating: document.getElementById('meditation-rating'),
  ratingOutput: document.getElementById('meditation-rating-output'),
  sessionNote: document.getElementById('meditation-session-note'),
  editDialog: document.getElementById('meditation-edit-dialog'),
  editForm: document.getElementById('meditation-edit-form'),
  editRating: document.getElementById('meditation-edit-rating'),
  editNote: document.getElementById('meditation-edit-note')
};

const FILTER_IDS = Object.freeze({
  beliefSystems: 'filter-beliefSystems',
  traditions: 'filter-traditions',
  families: 'filter-families',
  attentionModes: 'filter-attentionModes',
  anchors: 'filter-anchors',
  features: 'filter-features',
  goals: 'filter-goals',
  positions: 'filter-positions',
  breath: 'filter-breath',
  visualization: 'filter-visualization',
  mantra: 'filter-mantra',
  movement: 'filter-movement',
  flexibility: 'filter-flexibility',
  difficulty: 'filter-difficulty',
  intensity: 'filter-intensity',
  psilocybin: 'filter-psilocybin'
});

const state = {
  user: null,
  unlocked: false,
  loading: false,
  catalog: [],
  sessions: [],
  activeSession: null,
  selectedMeditationId: '',
  editingSessionId: '',
  visibleCount: PAGE_SIZE,
  timerInterval: null,
  searchTimer: null,
  loadGeneration: 0,
  startPending: false,
  finishingSnapshot: null
};

function createElement(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = String(text);
  return node;
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function humanize(value) {
  const normalized = normalize(value);
  if (LABELS[normalized]) return LABELS[normalized];
  const cleaned = String(value ?? '').replace(/[-_]/g, ' ').trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '—';
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value) || 0);
}

function formatClock(totalSeconds) {
  const total = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(totalSeconds) {
  const total = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes) return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
  return `${seconds} s`;
}

function localDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSessionDate(session) {
  const key = session.sessionDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key || '')) {
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(year, month - 1, day, 12));
  }
  const timestamp = session.completedAtMs || session.startedAtMs;
  return timestamp ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(timestamp)) : 'Data desconhecida';
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function pinStorageKey(uid) {
  return `${PIN_STORAGE_PREFIX}:${uid}`;
}

function sessionsCollection() {
  if (!state.user) throw new Error('É necessário iniciar sessão.');
  return collection(db, 'users', state.user.uid, 'meditation_sessions');
}

function sessionReference(sessionId) {
  if (!state.user) throw new Error('É necessário iniciar sessão.');
  return doc(db, 'users', state.user.uid, 'meditation_sessions', sessionId);
}

function closeAllDialogs() {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
}

function showDialog(dialog) {
  if (!dialog) return;
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function findMeditation(id) {
  return state.catalog.find(item => item.id === id) || null;
}

function findSession(id) {
  return state.sessions.find(item => item.id === id) || null;
}

function getActiveElapsedSeconds(session = state.activeSession, at = Date.now()) {
  if (!session?.startedAtMs) return 0;
  const end = session.isPaused && session.pausedAtMs ? session.pausedAtMs : at;
  return Math.max(0, Math.floor((end - session.startedAtMs - Number(session.pausedDurationMs || 0)) / 1000));
}

function getFilters() {
  const filters = {
    search: elements.search.value,
    status: elements.status.value,
    psilocybin: document.getElementById(FILTER_IDS.psilocybin).value
  };
  Object.entries(FILTER_IDS).forEach(([dimension, id]) => {
    if (dimension === 'psilocybin') return;
    filters[dimension] = document.getElementById(id)?.value || '';
  });
  return filters;
}

async function loadCatalog() {
  const shards = await Promise.all(CATALOG_URLS.map(async url => {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (networkError) {
      response = await fetch(url);
      if (!response.ok) throw new Error(`Falha ao carregar ${url} (${response.status}).`, { cause: networkError });
    }
    const payload = await response.json();
    if (!Array.isArray(payload.meditations)) throw new Error(`Catálogo inválido em ${url}.`);
    return payload.meditations;
  }));

  const catalog = shards.flat();
  const ids = new Set();
  catalog.forEach(item => {
    if (!item?.id || !item?.name || !Array.isArray(item.instructions?.steps)) {
      throw new Error('Foi encontrada uma ficha de meditação incompleta.');
    }
    if (ids.has(item.id)) throw new Error(`ID de meditação duplicado: ${item.id}`);
    ids.add(item.id);
  });
  return catalog;
}

async function fetchSessions() {
  const snapshot = await getDocs(sessionsCollection());
  return snapshot.docs.map(snapshotDoc => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));
}

function applySessions(sessions) {
  state.sessions = sessions;
  const activeSessions = sessions
    .filter(session => session.status === 'in_progress')
    .sort((a, b) => Number(b.startedAtMs || 0) - Number(a.startedAtMs || 0));
  state.activeSession = activeSessions[0] || null;
  if (activeSessions.length > 1) {
    showToast('Há mais de uma sessão em curso no Firebase. Abri a mais recente; termina ou cancela-a antes de continuar.', 'warning', 6000);
  }
}

async function loadPrivateApp() {
  if (!state.user || !state.unlocked || state.loading) return;
  state.loading = true;
  const generation = state.loadGeneration;
  const uid = state.user.uid;
  elements.access.hidden = true;
  elements.app.hidden = false;
  elements.lock.hidden = false;
  elements.list.setAttribute('aria-busy', 'true');
  elements.list.replaceChildren(createElement('div', 'meditation-empty', 'A carregar catálogo e sessões…'));

  try {
    const [catalogResult, sessions] = await Promise.all([loadCatalog(), fetchSessions()]);
    if (generation !== state.loadGeneration || state.user?.uid !== uid || !state.unlocked) return;
    state.catalog = catalogResult;
    applySessions(sessions);
    populateDynamicFilters();
    renderAll();
    startTimerTicker();
  } catch (error) {
    if (generation !== state.loadGeneration || state.user?.uid !== uid || !state.unlocked) return;
    console.error('[meditacao] Falha ao carregar:', error);
    elements.list.replaceChildren(createElement('div', 'meditation-empty', 'Não foi possível carregar a página. Confirma a ligação e tenta novamente.'));
    showToast('Não foi possível carregar o catálogo ou o histórico.', 'error', 5000);
  } finally {
    if (generation === state.loadGeneration) {
      state.loading = false;
      elements.list.setAttribute('aria-busy', 'false');
    }
  }
}

function resetPrivateState() {
  state.loadGeneration += 1;
  state.loading = false;
  state.unlocked = false;
  state.catalog = [];
  state.sessions = [];
  state.activeSession = null;
  state.selectedMeditationId = '';
  state.editingSessionId = '';
  state.startPending = false;
  state.finishingSnapshot = null;
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
  closeAllDialogs();
  elements.app.hidden = true;
  elements.lock.hidden = true;
  elements.access.hidden = false;
}

function showAccessForUser(user) {
  elements.access.hidden = false;
  elements.authGate.hidden = Boolean(user);
  elements.pinForm.hidden = !user;
  elements.pinError.hidden = true;
  elements.pin.value = '';
  if (user) setTimeout(() => elements.pin.focus(), 0);
}

async function handleAuthChange(user) {
  const previousUid = state.user?.uid || '';
  if (previousUid && previousUid !== user?.uid) resetPrivateState();
  state.user = user;

  if (!user) {
    resetPrivateState();
    showAccessForUser(null);
    return;
  }

  const remembered = sessionStorage.getItem(pinStorageKey(user.uid)) === 'true';
  if (remembered) {
    state.unlocked = true;
    await loadPrivateApp();
  } else {
    resetPrivateState();
    state.user = user;
    showAccessForUser(user);
  }
}

function lockPage() {
  if (state.user) sessionStorage.removeItem(pinStorageKey(state.user.uid));
  const user = state.user;
  resetPrivateState();
  state.user = user;
  showAccessForUser(user);
}

function populateDynamicFilters() {
  ['beliefSystems', 'traditions', 'families', 'attentionModes', 'anchors', 'features', 'goals', 'positions']
    .forEach(dimension => {
      const select = document.getElementById(FILTER_IDS[dimension]);
      if (!select) return;
      const first = select.options[0]?.cloneNode(true) || new Option('Todas', '');
      select.replaceChildren(first);
      listFilterValues(state.catalog, dimension).forEach(value => {
        const option = new Option(humanize(value), value);
        select.appendChild(option);
      });
    });
}

function appendTags(container, values, limit = 4) {
  const unique = [...new Set((values || []).filter(Boolean))].slice(0, limit);
  unique.forEach(value => container.appendChild(createElement('span', 'meditation-tag', humanize(value))));
}

function cardScoreText(item) {
  if (item.progress.tried) {
    return {
      strong: `${formatNumber(item.progress.averageRating, 1)} / 20`,
      small: `${item.progress.sessionCount} ${item.progress.sessionCount === 1 ? 'sessão' : 'sessões'}`
    };
  }
  if (item.recommendation.compatibility !== null) {
    return {
      strong: `${item.recommendation.compatibility}% compatível`,
      small: item.exploration ? 'descoberta fora do habitual' : 'com as tuas preferências'
    };
  }
  return {
    strong: `${Number(item.meditation.duration?.defaultMinutes || 20)} min`,
    small: 'duração documentada'
  };
}

function createMeditationCard(item) {
  const meditation = item.meditation;
  const card = createElement('article', 'meditation-card');
  card.dataset.tried = String(item.progress.tried);
  card.appendChild(createElement('div', 'meditation-card-accent'));
  const body = createElement('div', 'meditation-card-body');
  const topline = createElement('div', 'meditation-card-topline');
  topline.appendChild(createElement('span', `meditation-badge ${item.progress.tried ? 'meditation-badge--tried' : ''}`, item.progress.tried ? 'Experimentada' : 'Nova'));
  if (meditation.psilocybin) topline.appendChild(createElement('span', 'meditation-badge meditation-badge--gold', 'Psilocibina'));
  else if (item.exploration) topline.appendChild(createElement('span', 'meditation-badge meditation-badge--gold', 'Explorar'));
  body.appendChild(topline);
  body.appendChild(createElement('h3', '', meditation.name));

  const original = meditation.originalNames?.[0];
  body.appendChild(createElement('p', 'meditation-original-name', original ? `${original.text} · ${original.language}` : meditation.period || ''));
  body.appendChild(createElement('p', 'meditation-card-summary', meditation.summary));
  const tags = createElement('div', 'meditation-tag-row');
  appendTags(tags, [
    ...(meditation.traditions || []).slice(0, 1),
    ...(meditation.families || []).slice(0, 1),
    ...(meditation.positions || []).slice(0, 1),
    meditation.flexibility === 'low' ? 'flexibilidade baixa' : ''
  ]);
  body.appendChild(tags);

  const footer = createElement('div', 'meditation-card-footer');
  const score = cardScoreText(item);
  const scoreWrap = createElement('div', 'meditation-card-score');
  scoreWrap.append(createElement('strong', '', score.strong), createElement('span', '', score.small));
  const open = createElement('button', 'meditation-card-open', 'Ver prática');
  open.type = 'button';
  open.addEventListener('click', () => openMeditationDetail(meditation.id));
  footer.append(scoreWrap, open);
  body.appendChild(footer);
  card.appendChild(body);
  return card;
}

function updateFilterCount(filters) {
  const count = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return Boolean(String(value).trim());
    if (key === 'status') return value !== 'all';
    if (value === 'all') return false;
    return Boolean(value);
  }).length;
  elements.filterCount.textContent = count ? `(${count} ativos)` : '';
}

function updateStats(ranked) {
  const tried = ranked.filter(item => item.progress.tried).length;
  const completed = state.sessions.filter(session => session.status === 'completed').length;
  elements.statTotal.textContent = formatNumber(state.catalog.length);
  elements.statNew.textContent = formatNumber(state.catalog.length - tried);
  elements.statTried.textContent = formatNumber(tried);
  elements.statSessions.textContent = formatNumber(completed);

  const profile = buildTasteProfile(state.catalog, state.sessions);
  if (profile.completedTechniqueCount < 5) {
    const remaining = 5 - profile.completedTechniqueCount;
    elements.learningNote.textContent = `O recomendador está a aprender: experimenta mais ${remaining} ${remaining === 1 ? 'prática diferente' : 'práticas diferentes'} para ativar a compatibilidade pessoal. Até lá, prioriza posições de baixa flexibilidade e oferece todo o catálogo pelos filtros.`;
  } else {
    elements.learningNote.textContent = 'As recomendações cruzam as médias de cada técnica com tradição, crença, atenção, âncoras, características, objetivos, posição e flexibilidade. Algumas sugestões exploratórias evitam que fiques preso apenas ao que já conheces.';
  }
}

function renderCatalog() {
  const filters = getFilters();
  const ranked = recommendCatalog(state.catalog, state.sessions, {
    sort: elements.sort.value,
    explorationRate: 0.15
  });
  const filtered = ranked.filter(item => matchesFilters(item, filters));
  const visible = filtered.slice(0, state.visibleCount);
  elements.list.replaceChildren(...visible.map(createMeditationCard));
  if (!visible.length) {
    elements.list.appendChild(createElement('div', 'meditation-empty', 'Nenhuma prática corresponde a estes filtros. Experimenta remover um critério.'));
  }
  elements.resultsCount.textContent = `${formatNumber(filtered.length)} ${filtered.length === 1 ? 'prática encontrada' : 'práticas encontradas'}`;
  elements.showMore.hidden = visible.length >= filtered.length;
  if (!elements.showMore.hidden) elements.showMore.textContent = `Mostrar mais (${formatNumber(filtered.length - visible.length)})`;
  elements.list.setAttribute('aria-busy', 'false');
  updateFilterCount(filters);
  updateStats(ranked);
}

function renderAll() {
  renderCatalog();
  renderActiveSession();
  if (elements.detailDialog.open && state.selectedMeditationId) renderMeditationDetail(state.selectedMeditationId);
}

function appendInstructionGroup(parent, heading, values, ordered = false) {
  if (!Array.isArray(values) || !values.length) return;
  const section = createElement('div', 'meditation-instruction-group');
  section.appendChild(createElement('h4', '', heading));
  const list = createElement(ordered ? 'ol' : 'ul');
  values.forEach(value => list.appendChild(createElement('li', '', value)));
  section.appendChild(list);
  parent.appendChild(section);
}

function createMetaItem(label, value) {
  const item = createElement('div');
  item.append(createElement('small', '', label), createElement('strong', '', value));
  return item;
}

function createHistorySection(item) {
  const section = createElement('section', 'meditation-detail-section');
  section.appendChild(createElement('h3', '', 'As minhas sessões'));
  const history = createElement('div', 'meditation-history');
  if (!item.progress.sessions.length) {
    history.appendChild(createElement('p', '', 'Ainda não experimentaste esta prática.'));
  } else {
    item.progress.sessions.forEach(session => {
      const row = createElement('article', 'meditation-history-item');
      row.appendChild(createElement('strong', '', formatSessionDate(session)));
      row.appendChild(createElement('span', '', formatDuration(session.durationSeconds)));
      row.appendChild(createElement('strong', '', `${session.rating} / 20`));
      const edit = createElement('button', '', 'Editar');
      edit.type = 'button';
      edit.addEventListener('click', () => openSessionEditor(session.id));
      row.appendChild(edit);
      if (session.note) row.appendChild(createElement('p', 'meditation-history-note', session.note));
      history.appendChild(row);
    });
  }
  section.appendChild(history);
  return section;
}

function createSourcesSection(meditation) {
  const section = createElement('section', 'meditation-detail-section');
  section.appendChild(createElement('h3', '', 'Fontes revistas'));
  const list = createElement('ul', 'meditation-source-list');
  (meditation.sources || []).forEach(source => {
    const item = createElement('li');
    const url = safeExternalUrl(source.url);
    const title = source.title || 'Fonte';
    if (url) {
      const link = createElement('a', '', title);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.appendChild(link);
    } else {
      item.appendChild(createElement('strong', '', title));
    }
    const details = [source.author, source.year, humanize(source.type), source.language].filter(Boolean).join(' · ');
    if (details) item.appendChild(document.createTextNode(` — ${details}`));
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function createPsilocybinContext() {
  const section = createElement('section', 'meditation-detail-section');
  section.appendChild(createElement('h3', '', 'Enquadramento da psilocibina'));
  const note = createElement('p', 'meditation-context-note');
  note.appendChild(document.createTextNode('Esta ficha aborda apenas contemplação, preparação não farmacológica e integração; não contém aquisição, cultivo, dosagem, preparação da substância ou combinações. Em Portugal, consumo, aquisição e detenção para consumo próprio continuam a constituir contraordenação; o limiar de dez dias é um critério legal, não uma autorização geral. '));
  const link = createElement('a', '', 'Consultar a Lei n.º 30/2000 consolidada');
  link.href = 'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2000-34545875';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  note.appendChild(link);
  note.appendChild(document.createTextNode('.'));
  section.appendChild(note);
  return section;
}

function createRecommendationExplanation(item) {
  if (item.progress.tried) return `Média pessoal de ${formatNumber(item.progress.averageRating, 1)} / 20 em ${item.progress.sessionCount} ${item.progress.sessionCount === 1 ? 'sessão' : 'sessões'}.`;
  if (item.recommendation.compatibility === null) return 'A posição e a flexibilidade ajudam na ordem inicial; a compatibilidade personalizada aparece depois de cinco práticas diferentes.';
  const reasons = item.recommendation.reasons.map(reason => `${DIMENSION_LABELS[reason.dimension] || reason.dimension}: ${humanize(reason.value)}`);
  const exploration = item.exploration ? ' Esta é também uma sugestão exploratória fora do padrão habitual.' : '';
  return `${item.recommendation.compatibility}% de compatibilidade${reasons.length ? `, sobretudo por ${reasons.join('; ')}` : ''}.${exploration}`;
}

function createStartPanel(item) {
  const panel = createElement('section', 'meditation-start-panel');
  if (state.activeSession) {
    const copy = createElement('div');
    copy.appendChild(createElement('strong', '', 'Já tens uma sessão em curso'));
    copy.appendChild(createElement('p', '', state.activeSession.meditationTitleSnapshot || 'Meditação'));
    const button = createElement('button', '', 'Continuar sessão');
    button.type = 'button';
    button.addEventListener('click', () => {
      elements.detailDialog.close();
      openActiveSession();
    });
    panel.append(copy, button);
    return panel;
  }

  const documentedMinutes = Math.min(240, Math.max(1, Number(item.meditation.duration?.defaultMinutes || 20)));
  const field = createElement('label', '', `Objetivo da sessão (sugestão da ficha: ${documentedMinutes} min)`);
  const input = createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = '240';
  input.step = '1';
  input.value = '20';
  input.setAttribute('aria-label', 'Duração em minutos');
  field.appendChild(input);
  const button = createElement('button', '', 'Iniciar meditação');
  button.type = 'button';
  button.addEventListener('click', () => startSession(item.meditation, input.value, button));
  panel.append(field, button);
  return panel;
}

function renderMeditationDetail(meditationId) {
  const item = recommendCatalog(state.catalog, state.sessions, { sort: elements.sort.value })
    .find(candidate => candidate.meditation.id === meditationId);
  if (!item) return;
  const meditation = item.meditation;
  const fragment = document.createDocumentFragment();
  fragment.appendChild(createElement('p', 'meditation-eyebrow', [meditation.traditions?.[0], meditation.period].filter(Boolean).join(' · ')));
  fragment.appendChild(createElement('h2', 'meditation-detail-title', meditation.name));
  const originalNames = (meditation.originalNames || []).map(entry => `${entry.text} (${entry.language})`);
  const aliasText = [...originalNames, ...(meditation.aliases || [])].filter(Boolean).join(' · ');
  if (aliasText) fragment.appendChild(createElement('p', 'meditation-original-name', aliasText));
  fragment.appendChild(createElement('p', 'meditation-detail-lead', meditation.summary));

  const tagRow = createElement('div', 'meditation-tag-row');
  appendTags(tagRow, [
    ...(meditation.beliefSystems || []),
    ...(meditation.traditions || []),
    ...(meditation.families || []),
    ...(meditation.attentionModes || []),
    ...(meditation.anchors || []),
    ...(meditation.features || []),
    ...(meditation.goals || [])
  ], 18);
  fragment.appendChild(tagRow);
  fragment.appendChild(createElement('p', 'meditation-recommendation-note', createRecommendationExplanation(item)));

  const meta = createElement('div', 'meditation-detail-meta');
  meta.append(
    createMetaItem('Posições', (meditation.positions || []).map(humanize).join(', ')),
    createMetaItem('Flexibilidade', humanize(meditation.flexibility)),
    createMetaItem('Dificuldade', humanize(meditation.difficulty)),
    createMetaItem('Duração documentada', `${meditation.duration?.minMinutes || 1}–${meditation.duration?.maxMinutes || meditation.duration?.defaultMinutes || 20} min`)
  );
  fragment.appendChild(meta);
  if (meditation.contextNote) fragment.appendChild(createElement('p', 'meditation-context-note', meditation.contextNote));

  const instructions = createElement('section', 'meditation-detail-section');
  instructions.appendChild(createElement('h3', '', 'Como fazer'));
  appendInstructionGroup(instructions, 'Preparação', meditation.instructions?.preparation);
  appendInstructionGroup(instructions, 'Prática', meditation.instructions?.steps, true);
  appendInstructionGroup(instructions, 'Encerramento', meditation.instructions?.closing);
  appendInstructionGroup(instructions, 'Adaptações', meditation.instructions?.adaptations);
  fragment.appendChild(instructions);

  if (meditation.precautions?.length) {
    const precautions = createElement('section', 'meditation-detail-section');
    precautions.appendChild(createElement('h3', '', 'Contexto e precauções'));
    appendInstructionGroup(precautions, 'Antes de experimentar', meditation.precautions);
    fragment.appendChild(precautions);
  }

  if (meditation.psilocybin) fragment.appendChild(createPsilocybinContext());

  fragment.appendChild(createStartPanel(item));
  fragment.appendChild(createHistorySection(item));
  fragment.appendChild(createSourcesSection(meditation));
  elements.detailContent.replaceChildren(fragment);
}

function openMeditationDetail(meditationId) {
  state.selectedMeditationId = meditationId;
  renderMeditationDetail(meditationId);
  showDialog(elements.detailDialog);
}

async function startSession(meditation, requestedMinutes, button = null) {
  if (!state.user || !state.unlocked) return;
  if (state.activeSession) {
    elements.detailDialog.close();
    openActiveSession();
    return;
  }
  if (state.startPending) return;
  state.startPending = true;
  if (button) button.disabled = true;
  const generation = state.loadGeneration;
  const uid = state.user.uid;
  const targetMinutes = Math.min(240, Math.max(1, Math.round(Number(requestedMinutes) || 20)));
  const now = Date.now();
  const ref = doc(sessionsCollection());
  const payload = {
    schemaVersion: 1,
    catalogVersion: CATALOG_VERSION,
    ownerUid: state.user.uid,
    meditationId: meditation.id,
    meditationTitleSnapshot: meditation.name,
    status: 'in_progress',
    sessionDate: localDateKey(now),
    targetMinutes,
    startedAt: serverTimestamp(),
    startedAtMs: now,
    pausedDurationMs: 0,
    pausedAtMs: null,
    isPaused: false,
    rating: null,
    note: '',
    durationSeconds: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(ref, payload);
    if (generation !== state.loadGeneration || state.user?.uid !== uid || !state.unlocked) return;
    state.activeSession = { id: ref.id, ...payload };
    state.sessions.push(state.activeSession);
    elements.detailDialog.close();
    renderAll();
    openActiveSession();
    showToast('Sessão iniciada.', 'success');
  } catch (error) {
    console.error('[meditacao] Falha ao iniciar sessão:', error);
    showToast('Não foi possível iniciar a sessão no Firebase.', 'error');
  } finally {
    state.startPending = false;
    if (button?.isConnected) button.disabled = false;
  }
}

function renderSessionSteps(meditation) {
  elements.sessionSteps.replaceChildren();
  const steps = meditation?.instructions?.steps || [];
  steps.forEach(step => elements.sessionSteps.appendChild(createElement('li', '', step)));
}

function renderActiveSession() {
  const session = state.activeSession;
  elements.active.hidden = !session;
  if (!session) return;
  const meditation = findMeditation(session.meditationId);
  elements.activeName.textContent = meditation?.name || session.meditationTitleSnapshot || 'Meditação';
  elements.sessionName.textContent = elements.activeName.textContent;
  elements.sessionMinutes.value = String(session.targetMinutes || 20);
  elements.sessionMinutes.disabled = Boolean(session.isPaused);
  elements.sessionPause.textContent = session.isPaused ? 'Retomar' : 'Pausar';
  renderSessionSteps(meditation);
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const session = state.activeSession;
  if (!session) return;
  const elapsed = getActiveElapsedSeconds(session);
  const targetSeconds = Math.max(60, Number(session.targetMinutes || 20) * 60);
  const remaining = targetSeconds - elapsed;
  const pausedPrefix = session.isPaused ? 'Pausado · ' : '';
  if (remaining >= 0) {
    elements.sessionClock.textContent = formatClock(remaining);
    elements.sessionPhase.textContent = `${pausedPrefix}tempo restante`;
    elements.activeTime.textContent = formatClock(remaining);
  } else {
    elements.sessionClock.textContent = `+${formatClock(Math.abs(remaining))}`;
    elements.sessionPhase.textContent = `${pausedPrefix}tempo extra`;
    elements.activeTime.textContent = `+${formatClock(Math.abs(remaining))}`;
  }
  const percent = Math.min(100, Math.max(0, elapsed / targetSeconds * 100));
  elements.sessionProgress.style.width = `${percent}%`;
}

function startTimerTicker() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
}

function openActiveSession() {
  if (!state.activeSession) return;
  renderActiveSession();
  showDialog(elements.sessionDialog);
}

async function togglePause() {
  const session = state.activeSession;
  if (!session) return;
  const now = Date.now();
  let updates;
  if (session.isPaused) {
    updates = {
      isPaused: false,
      pausedDurationMs: Number(session.pausedDurationMs || 0) + Math.max(0, now - Number(session.pausedAtMs || now)),
      pausedAtMs: null,
      updatedAt: serverTimestamp()
    };
  } else {
    updates = {
      isPaused: true,
      pausedAtMs: now,
      updatedAt: serverTimestamp()
    };
  }
  elements.sessionPause.disabled = true;
  try {
    await updateDoc(sessionReference(session.id), updates);
    Object.assign(session, updates);
    renderActiveSession();
  } catch (error) {
    console.error('[meditacao] Falha ao pausar/retomar:', error);
    showToast('Não foi possível atualizar a pausa.', 'error');
  } finally {
    elements.sessionPause.disabled = false;
  }
}

async function updateTargetMinutes() {
  const session = state.activeSession;
  if (!session || session.isPaused) return;
  const targetMinutes = Math.min(240, Math.max(1, Math.round(Number(elements.sessionMinutes.value) || 20)));
  elements.sessionMinutes.value = String(targetMinutes);
  if (targetMinutes === Number(session.targetMinutes)) return;
  try {
    await updateDoc(sessionReference(session.id), { targetMinutes, updatedAt: serverTimestamp() });
    session.targetMinutes = targetMinutes;
    updateTimerDisplay();
  } catch (error) {
    console.error('[meditacao] Falha ao atualizar duração:', error);
    elements.sessionMinutes.value = String(session.targetMinutes || 20);
    showToast('Não foi possível alterar a duração.', 'error');
  }
}

function requestFinishSession() {
  if (!state.activeSession) return;
  const now = Date.now();
  const elapsedSeconds = getActiveElapsedSeconds(state.activeSession, now);
  state.finishingSnapshot = {
    at: now,
    elapsedSeconds,
    wasPaused: Boolean(state.activeSession.isPaused)
  };
  elements.rating.value = '10';
  elements.ratingOutput.value = '10';
  elements.ratingOutput.textContent = '10';
  elements.sessionNote.value = '';
  elements.sessionDialog.close();
  showDialog(elements.ratingDialog);
}

async function completeSession(event) {
  event.preventDefault();
  const session = state.activeSession;
  if (!session) return;
  const rating = Number(elements.rating.value);
  if (!Number.isInteger(rating) || rating < 0 || rating > 20) {
    showToast('A classificação tem de ser um número inteiro entre 0 e 20.', 'warning');
    return;
  }
  const now = Date.now();
  const finishedAtMs = state.finishingSnapshot?.at ?? now;
  const durationSeconds = state.finishingSnapshot?.elapsedSeconds ?? getActiveElapsedSeconds(session, now);
  const note = elements.sessionNote.value.trim();
  const updates = {
    status: 'completed',
    completedAt: serverTimestamp(),
    completedAtMs: finishedAtMs,
    durationSeconds,
    rating,
    note,
    isPaused: false,
    pausedAtMs: null,
    updatedAt: serverTimestamp()
  };
  const submit = elements.ratingForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await updateDoc(sessionReference(session.id), updates);
    Object.assign(session, updates);
    state.activeSession = null;
    state.finishingSnapshot = null;
    elements.ratingDialog.close();
    renderAll();
    const next = recommendCatalog(state.catalog, state.sessions, { sort: 'recommended', explorationRate: 0.15 })
      .find(item => !item.progress.tried);
    showToast(next
      ? `Sessão guardada. Próxima sugestão: ${next.meditation.name}.`
      : 'Sessão guardada. Já experimentaste todo o catálogo atual.', 'success', 4500);
    elements.list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error('[meditacao] Falha ao terminar sessão:', error);
    showToast('Não foi possível guardar a sessão.', 'error');
  } finally {
    submit.disabled = false;
  }
}

async function resumeAfterDismissedRating() {
  const session = state.activeSession;
  const snapshot = state.finishingSnapshot;
  state.finishingSnapshot = null;
  if (!session || !snapshot) return;

  if (!snapshot.wasPaused) {
    const promptDurationMs = Math.max(0, Date.now() - snapshot.at);
    session.pausedDurationMs = Number(session.pausedDurationMs || 0) + promptDurationMs;
    try {
      await updateDoc(sessionReference(session.id), {
        pausedDurationMs: session.pausedDurationMs,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('[meditacao] Falha ao descontar a pausa de classificação:', error);
      showToast('A sessão continuou, mas não foi possível sincronizar esta pausa.', 'warning');
    }
  }
  renderActiveSession();
}

function cancelSession() {
  const session = state.activeSession;
  if (!session) return;
  showConfirm('Cancelar esta sessão? Não contará como experimentada.', async () => {
    const now = Date.now();
    const updates = {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledAtMs: now,
      durationSeconds: getActiveElapsedSeconds(session, now),
      updatedAt: serverTimestamp()
    };
    try {
      await updateDoc(sessionReference(session.id), updates);
      Object.assign(session, updates);
      state.activeSession = null;
      elements.sessionDialog.close();
      renderAll();
      showToast('Sessão cancelada.', 'info');
    } catch (error) {
      console.error('[meditacao] Falha ao cancelar sessão:', error);
      showToast('Não foi possível cancelar a sessão.', 'error');
    }
  });
}

function openSessionEditor(sessionId) {
  const session = findSession(sessionId);
  if (!session || session.status !== 'completed') return;
  state.editingSessionId = sessionId;
  elements.editRating.value = String(session.rating);
  elements.editNote.value = session.note || '';
  if (elements.detailDialog.open) elements.detailDialog.close();
  showDialog(elements.editDialog);
}

async function saveSessionEdit(event) {
  event.preventDefault();
  const session = findSession(state.editingSessionId);
  if (!session) return;
  const rating = Number(elements.editRating.value);
  if (!Number.isInteger(rating) || rating < 0 || rating > 20) {
    showToast('A classificação tem de ser um número inteiro entre 0 e 20.', 'warning');
    return;
  }
  const updates = {
    rating,
    note: elements.editNote.value.trim(),
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const submit = elements.editForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await updateDoc(sessionReference(session.id), updates);
    Object.assign(session, updates);
    elements.editDialog.close();
    renderAll();
    showToast('Sessão atualizada.', 'success');
    if (state.selectedMeditationId) openMeditationDetail(state.selectedMeditationId);
  } catch (error) {
    console.error('[meditacao] Falha ao editar sessão:', error);
    showToast('Não foi possível editar a sessão.', 'error');
  } finally {
    submit.disabled = false;
  }
}

function clearFilters() {
  elements.search.value = '';
  elements.status.value = 'all';
  elements.sort.value = 'recommended';
  Object.entries(FILTER_IDS).forEach(([dimension, id]) => {
    const select = document.getElementById(id);
    if (select) select.value = ['psilocybin', 'breath', 'visualization', 'mantra', 'movement'].includes(dimension) ? 'all' : '';
  });
  state.visibleCount = PAGE_SIZE;
  renderCatalog();
}

function bindEvents() {
  elements.login.addEventListener('click', () => {
    const globalLogin = document.getElementById('login-btn');
    if (globalLogin) globalLogin.click();
    else showToast('Abre o menu e escolhe Login.', 'info');
  });

  elements.pinForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.user) return;
    if (elements.pin.value !== ACCESS_PIN) {
      elements.pinError.hidden = false;
      elements.pin.select();
      return;
    }
    elements.pinError.hidden = true;
    sessionStorage.setItem(pinStorageKey(state.user.uid), 'true');
    state.unlocked = true;
    await loadPrivateApp();
  });

  elements.lock.addEventListener('click', lockPage);
  elements.activeOpen.addEventListener('click', openActiveSession);
  elements.sessionHide.addEventListener('click', () => elements.sessionDialog.close());
  elements.sessionPause.addEventListener('click', togglePause);
  elements.sessionCancel.addEventListener('click', cancelSession);
  elements.sessionFinish.addEventListener('click', requestFinishSession);
  elements.sessionMinutes.addEventListener('change', updateTargetMinutes);
  elements.rating.addEventListener('input', () => {
    elements.ratingOutput.value = elements.rating.value;
    elements.ratingOutput.textContent = elements.rating.value;
  });
  elements.ratingForm.addEventListener('submit', completeSession);
  elements.editForm.addEventListener('submit', saveSessionEdit);
  elements.showMore.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderCatalog();
  });
  elements.clearFilters.addEventListener('click', clearFilters);

  elements.search.addEventListener('input', () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.visibleCount = PAGE_SIZE;
      renderCatalog();
    }, 140);
  });

  [elements.status, elements.sort, ...Object.values(FILTER_IDS).map(id => document.getElementById(id))]
    .filter(Boolean)
    .forEach(control => control.addEventListener('change', () => {
      state.visibleCount = PAGE_SIZE;
      renderCatalog();
    }));

  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  elements.ratingDialog.addEventListener('close', resumeAfterDismissedRating);
}

bindEvents();
onAuthStateChanged(getAuth(), handleAuthChange);
