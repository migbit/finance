import { db } from './script.js';
import { showConfirm, showToast } from './toast.js';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const BASE_YEAR = 2025;
const NOW_YEAR = new Date().getFullYear();
const DEFAULT_YEAR = Math.max(BASE_YEAR, NOW_YEAR);

const STORE_COLLECTION = 'isabelDatas';
const COMPANIES_DOC_ID = 'companies';

const OBLIGATIONS = {
  annual: [
    { key: 'modelo22', label: 'Modelo 22' },
    { key: 'irs', label: 'IRS' },
    { key: 'ies', label: 'IES' },
    { key: 'inventario', label: 'Inventário' }
  ],
  monthly: [
    { key: 'dmr', label: 'DMR' },
    { key: 'seguranca_social', label: 'Segurança Social' },
    { key: 'sft', label: 'SFT' },
    { key: 'retencao_irs', label: 'Retenção IRS' },
    { key: 'modelo30', label: 'Modelo 30' }
  ]
};

const MONTHS = [
  { key: 1, label: 'Jan' },
  { key: 2, label: 'Fev' },
  { key: 3, label: 'Mar' },
  { key: 4, label: 'Abr' },
  { key: 5, label: 'Mai' },
  { key: 6, label: 'Jun' },
  { key: 7, label: 'Jul' },
  { key: 8, label: 'Ago' },
  { key: 9, label: 'Set' },
  { key: 10, label: 'Out' },
  { key: 11, label: 'Nov' },
  { key: 12, label: 'Dez' }
];

const INITIAL_ACTIVE = [
  'KM Linear',
  'Amplitude',
  'Atlantic',
  'Dinfelini',
  'UNUN',
  'OM&MT',
  'Isabel Unip',
  'Entretanto',
  'Lislei',
  'Tiago',
  'Fátima Martins',
  'C. Novais',
  'Hinopróspero',
  'Ervanária',
  'Duetos',
  'Luisa Miranda',
  'Edite/José Fanq',
  'Lello Cnsulting',
  'Segal',
  'Mariana/Hugo',
  'Sílvia',
  'Pergaminho',
  'Carlos Malheiro'
];

const INITIAL_SUSPENDED = [
  'Valor Mais I',
  'Valor Mais II',
  'Valor Mais III',
  'Maia Teixeira',
  'Seven Days',
  'Trafitel',
  'Aglaia',
  'Benjamin Unip',
  'Motupróprio'
];

const storeCol = collection(db, STORE_COLLECTION);
const companiesRef = doc(storeCol, COMPANIES_DOC_ID);

let companies = [];
const panelStateByKey = new Map(); // `${scope}:${obligationKey}` -> state

function normalizeId(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'empresa';
}

function ensureUniqueId(baseId, existingIds) {
  if (!existingIds.has(baseId)) return baseId;
  let i = 2;
  while (existingIds.has(`${baseId}-${i}`)) i += 1;
  return `${baseId}-${i}`;
}

function sortCompanies(list) {
  return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-PT', { sensitivity: 'base' }));
}

function yearsRange() {
  const maxYear = Math.max(BASE_YEAR, NOW_YEAR);
  const years = [];
  for (let y = BASE_YEAR; y <= maxYear; y += 1) years.push(y);
  return years;
}

function obligationDocId(scope, key, year) {
  return `${scope}_${key}_${year}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function createModal({ title, subtitle, bodyHtml, primaryLabel, dangerLabel, deleteLabel }) {
  const modal = document.createElement('div');
  modal.className = 'datas-modal-overlay';
  modal.innerHTML = `
    <div class="datas-modal-backdrop" data-modal-close></div>
    <div class="datas-modal-dialog" role="dialog" aria-modal="true">
      <div class="datas-modal-title">
        <h3>${escapeHtml(title)}</h3>
        ${subtitle ? `<div class="muted">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="datas-modal-actions">
        ${dangerLabel ? `<button type="button" class="btn" data-modal-danger>${escapeHtml(dangerLabel)}</button>` : ''}
        ${deleteLabel ? `<button type="button" class="btn" data-modal-delete>${escapeHtml(deleteLabel)}</button>` : ''}
        <button type="button" class="btn" data-modal-cancel>Cancelar</button>
        <button type="button" class="btn btn-primary" data-modal-primary>${escapeHtml(primaryLabel || 'Guardar')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));

  // Focus trap: get all focusable elements
  const dialog = modal.querySelector('.datas-modal-dialog');
  const getFocusableElements = () => {
    return Array.from(dialog.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
  };

  let onKey = null;
  const close = () => {
    modal.classList.remove('show');
    if (onKey) document.removeEventListener('keydown', onKey);
    setTimeout(() => modal.remove(), 160);
  };

  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-close]')) close();
  });

  onKey = (event) => {
    if (event.key === 'Escape') {
      close();
      return;
    }

    // Focus trap: keep focus within modal when using Tab
    if (event.key === 'Tab') {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    }
  };
  document.addEventListener('keydown', onKey);

  const cancelBtn = modal.querySelector('[data-modal-cancel]');
  cancelBtn?.addEventListener('click', close);

  // Set initial focus to first input or primary button
  requestAnimationFrame(() => {
    const firstInput = dialog.querySelector('input:not([type="checkbox"]):not([disabled])');
    const primaryBtn = dialog.querySelector('[data-modal-primary]');
    (firstInput || primaryBtn)?.focus();
  });

  return { modal, close };
}

async function writeCompanies(nextCompanies) {
  const payload = {
    version: 1,
    companies: nextCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state || 'active'
    })),
    updatedAt: new Date()
  };
  await setDoc(companiesRef, payload, { merge: true });
}

async function ensureCompaniesDoc() {
  const snap = await getDoc(companiesRef);
  if (snap.exists()) return;

  const existingIds = new Set();
  const seed = [];

  const addSeed = (name, state) => {
    const baseId = normalizeId(name);
    const id = ensureUniqueId(baseId, existingIds);
    existingIds.add(id);
    seed.push({ id, name, state });
  };

  INITIAL_ACTIVE.forEach((name) => addSeed(name, 'active'));
  INITIAL_SUSPENDED.forEach((name) => addSeed(name, 'suspended'));

  await writeCompanies(sortCompanies(seed));
}

async function ensureObligationDoc(scope, key, year) {
  const ref = doc(storeCol, obligationDocId(scope, key, year));
  const snap = await getDoc(ref);
  if (snap.exists()) return ref;

  const base = { scope, key, year, updatedAt: new Date() };
  const payload = scope === 'annual'
    ? { ...base, completedByCompany: {}, deadline: '' }
    : { ...base, monthsByCompany: {}, completedByCompany: {} };

  await setDoc(ref, payload, { merge: true });
  return ref;
}

function getCompanyList(state) {
  return sortCompanies(companies.filter((c) => (c.state || 'active') === state));
}

function isAnnualCompanyComplete(docData, companyId) {
  return Boolean(docData?.completedByCompany?.[companyId]);
}

function getMonthlyMonths(docData, companyId) {
  const map = docData?.monthsByCompany?.[companyId];
  if (!map || typeof map !== 'object') return {};
  return map;
}

function isMonthlyCompanyComplete(docData, companyId) {
  const months = getMonthlyMonths(docData, companyId);
  return MONTHS.every((m) => Boolean(months[String(m.key)]));
}

function renderScopePanel(scope, mountEl) {
  const obligations = OBLIGATIONS[scope];
  mountEl.innerHTML = `
    <div class="tab-navigation" data-obligation-tabs="${scope}">
      ${obligations.map((o, idx) => (
        `<button class="tab-btn ${idx === 0 ? 'active' : ''}" data-obligation="${o.key}">${escapeHtml(o.label)}</button>`
      )).join('')}
    </div>
    <div data-obligation-panels="${scope}"></div>
  `;

  const panelsWrap = mountEl.querySelector(`[data-obligation-panels="${scope}"]`);
  obligations.forEach((o, idx) => {
    const panel = document.createElement('section');
    panel.dataset.scope = scope;
    panel.dataset.obligation = o.key;
    panel.style.display = idx === 0 ? '' : 'none';
    panel.innerHTML = buildObligationPanelHtml(scope, o.key, o.label);
    panelsWrap.appendChild(panel);

    const stateKey = `${scope}:${o.key}`;
    panelStateByKey.set(stateKey, {
      scope,
      key: o.key,
      label: o.label,
      year: DEFAULT_YEAR,
      showOlder: false,
      ref: null,
      unsubscribe: null,
      docData: null,
      panelEl: panel
    });
  });

  const tabs = mountEl.querySelectorAll(`[data-obligation-tabs="${scope}"] .tab-btn`);
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.obligation;
      tabs.forEach((b) => b.classList.toggle('active', b === btn));
      panelsWrap.querySelectorAll('section[data-obligation]').forEach((p) => {
        p.style.display = p.dataset.obligation === key ? '' : 'none';
      });
    });
  });
}

function buildObligationPanelHtml(scope, key, label) {
  const yearId = `year-${scope}-${key}`;
  const olderId = `older-${scope}-${key}`;
  const activeTableId = `table-${scope}-${key}-active`;
  const suspendedTableId = `table-${scope}-${key}-suspended`;
  const showSuspended = scope === 'annual' && key === 'modelo22';
  const deadlineId = `deadline-${scope}-${key}`;

  return `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="field-inline"><strong>Obrigação:</strong> <span>${escapeHtml(label)}</span></div>
        ${scope === 'annual' ? `
          <div class="field-inline datas-deadline-row">
            <label for="${deadlineId}"><strong>Entregar até</strong></label>
            <input id="${deadlineId}" type="date" data-deadline-input />
            <span class="muted" data-deadline-status></span>
          </div>
        ` : ''}
      </div>
      <div class="toolbar-right">
        <div class="field-inline">
          <label for="${yearId}"><strong>Ano</strong></label>
          <select id="${yearId}" data-year-select>
            <option value="${DEFAULT_YEAR}">${DEFAULT_YEAR}</option>
          </select>
        </div>
        <div class="field-inline">
          <input type="checkbox" id="${olderId}" data-show-older />
          <label for="${olderId}">Mostrar anos anteriores</label>
        </div>
      </div>
    </div>

    <div class="split-grid" style="margin-top: 14px;">
      <div class="list-card" data-company-state="active">
        <div class="list-card-header">
          <h4>Empresas em Atividade</h4>
          <div class="actions">
            <button type="button" class="btn btn-primary" data-add-company>+ Adicionar</button>
            <button type="button" class="btn" data-print-table="${activeTableId}">Imprimir</button>
          </div>
        </div>
        <div class="table-wrap" id="${activeTableId}" data-table-wrap>
          <div class="muted">A carregar…</div>
        </div>
      </div>

      ${showSuspended ? `
      <div class="list-card" data-company-state="suspended">
        <div class="list-card-header">
          <h4>Suspensas</h4>
          <div class="actions">
            <button type="button" class="btn" data-print-table="${suspendedTableId}">Imprimir</button>
          </div>
        </div>
        <div class="table-wrap" id="${suspendedTableId}" data-table-wrap>
          <div class="muted">A carregar…</div>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

function buildAnnualTableHtml(rowsPending, rowsCompleted) {
  const cols = 3;
  return `
    <table data-kind="annual">
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Feito</th>
          <th style="text-align:right;">Ações</th>
        </tr>
      </thead>
      <tbody data-section="pending">
        ${rowsPending || `<tr><td colspan="${cols}" class="muted" style="padding: 12px 10px;">Sem empresas.</td></tr>`}
      </tbody>
      <tbody data-section="completed">
        ${rowsCompleted ? `<tr class="section-row"><td colspan="${cols}">Concluídas</td></tr>${rowsCompleted}` : ''}
      </tbody>
    </table>
  `;
}

function buildMonthlyTableHtml(rowsPending, rowsCompleted) {
  const cols = 2 + MONTHS.length;
  return `
    <table data-kind="monthly">
      <thead>
        <tr>
          <th>Empresa</th>
          ${MONTHS.map((m) => `<th>${m.label}</th>`).join('')}
          <th style="text-align:right;">Ações</th>
        </tr>
      </thead>
      <tbody data-section="pending">
        ${rowsPending || `<tr><td colspan="${cols}" class="muted" style="padding: 12px 10px;">Sem empresas.</td></tr>`}
      </tbody>
      <tbody data-section="completed">
        ${rowsCompleted ? `<tr class="section-row"><td colspan="${cols}">Concluídas</td></tr>${rowsCompleted}` : ''}
      </tbody>
    </table>
  `;
}

function renderTableInto(wrapEl, scope, docData, list) {
  const pending = [];
  const completed = [];

  list.forEach((company) => {
    if (scope === 'annual') {
      const done = isAnnualCompanyComplete(docData, company.id);
      const row = `
        <tr data-company-id="${company.id}" class="${done ? 'is-complete' : ''}">
          <td>${escapeHtml(company.name)}</td>
          <td><input type="checkbox" data-annual-check ${done ? 'checked' : ''} /></td>
          <td style="text-align:right;"><button type="button" class="btn" data-edit-company>Editar</button></td>
        </tr>
      `;
      (done ? completed : pending).push(row);
      return;
    }

    const months = getMonthlyMonths(docData, company.id);
    const isComplete = isMonthlyCompanyComplete(docData, company.id);
    const row = `
      <tr data-company-id="${company.id}" class="${isComplete ? 'is-complete' : ''}">
        <td>${escapeHtml(company.name)}</td>
        ${MONTHS.map((m) => {
          const checked = Boolean(months[String(m.key)]);
          return `<td><input type="checkbox" data-month="${m.key}" ${checked ? 'checked' : ''} /></td>`;
        }).join('')}
        <td style="text-align:right;"><button type="button" class="btn" data-edit-company>Editar</button></td>
      </tr>
    `;
    (isComplete ? completed : pending).push(row);
  });

  const pendingHtml = pending.join('');
  const completedHtml = completed.join('');
  wrapEl.innerHTML = scope === 'annual'
    ? buildAnnualTableHtml(pendingHtml, completedHtml)
    : buildMonthlyTableHtml(pendingHtml, completedHtml);
}

function refreshPanel(panelState) {
  const panelEl = panelState.panelEl;
  const scope = panelState.scope;

  const activeWrap = panelEl.querySelector('[data-company-state="active"] [data-table-wrap]');
  const suspendedWrap = panelEl.querySelector('[data-company-state="suspended"] [data-table-wrap]');
  const activeList = getCompanyList('active');
  const suspendedList = getCompanyList('suspended');

  renderTableInto(activeWrap, scope, panelState.docData, activeList);
  if (suspendedWrap) renderTableInto(suspendedWrap, scope, panelState.docData, suspendedList);
  updateDeadlineUI(panelState);
}

function attachDocListener(panelState) {
  const { scope, key, year } = panelState;
  const stateKey = `${scope}:${key}`;

  if (panelState.unsubscribe) {
    panelState.unsubscribe();
    panelState.unsubscribe = null;
  }

  ensureObligationDoc(scope, key, year)
    .then((ref) => {
      panelState.ref = ref;
      panelState.unsubscribe = onSnapshot(ref, (snap) => {
        panelState.docData = snap.data() || null;
        refreshPanel(panelState);
      }, (err) => {
        console.error('Erro ao ler Firestore:', err);
        showToast('Erro ao carregar dados (Firebase).', 'error');
      });
      panelStateByKey.set(stateKey, panelState);
    })
    .catch((err) => {
      console.error('Erro a garantir doc:', err);
      showToast('Erro ao inicializar dados (Firebase).', 'error');
    });
}

function updateYearSelectOptions(panelState) {
  const select = panelState.panelEl.querySelector('[data-year-select]');
  if (!select) return;
  const years = panelState.showOlder ? yearsRange() : [DEFAULT_YEAR];
  const currentValue = String(panelState.year);

  select.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
  const fallback = years.includes(panelState.year) ? currentValue : String(DEFAULT_YEAR);
  select.value = fallback;
  panelState.year = Number(select.value);
}

function parseLocalYMD(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map((v) => Number(v));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function daysBetweenLocalDates(a, b) {
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((b0 - a0) / 86400000);
}

function formatDeadlineLabel(ymd) {
  const date = parseLocalYMD(ymd);
  if (!date) return '';
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function updateDeadlineUI(panelState) {
  if (panelState.scope !== 'annual') return;
  const input = panelState.panelEl.querySelector('[data-deadline-input]');
  const status = panelState.panelEl.querySelector('[data-deadline-status]');
  if (!input || !status) return;

  const ymd = String(panelState.docData?.deadline || '').trim();
  if (document.activeElement !== input) input.value = ymd;

  if (!ymd) {
    status.textContent = '';
    return;
  }

  const date = parseLocalYMD(ymd);
  if (!date) {
    status.textContent = '';
    return;
  }

  const today = new Date();
  const diff = daysBetweenLocalDates(today, date);

  if (diff < 0) {
    status.textContent = `Prazo ultrapassado há ${Math.abs(diff)} dias`;
    return;
  }
  if (diff === 0) {
    status.textContent = 'É hoje';
    return;
  }
  status.textContent = `Faltam ${diff} dias`;
}

function bindPanelEvents(panelState) {
  const panelEl = panelState.panelEl;

  const olderToggle = panelEl.querySelector('[data-show-older]');
  olderToggle?.addEventListener('change', () => {
    panelState.showOlder = Boolean(olderToggle.checked);
    updateYearSelectOptions(panelState);
    attachDocListener(panelState);
  });

  const yearSelect = panelEl.querySelector('[data-year-select]');
  yearSelect?.addEventListener('change', () => {
    panelState.year = Number(yearSelect.value) || DEFAULT_YEAR;
    attachDocListener(panelState);
  });

  const deadlineInput = panelEl.querySelector('[data-deadline-input]');
  deadlineInput?.addEventListener('change', async () => {
    if (panelState.scope !== 'annual' || !panelState.ref) return;
    const ymd = String(deadlineInput.value || '').trim();
    try {
      await updateDoc(panelState.ref, { deadline: ymd, updatedAt: new Date() });
      showToast('Prazo guardado.', 'success');
    } catch (err) {
      console.error('Erro a guardar prazo:', err);
      showToast('Erro ao guardar o prazo (Firebase).', 'error');
    }
  });

  panelEl.addEventListener('click', (event) => {
    // Mobile shortcut: tap company name (annual) to edit
    const companyRow = event.target.closest('tr[data-company-id]');
    if (companyRow && !event.target.closest('button') && !event.target.closest('input[type="checkbox"]')) {
      const table = companyRow.closest('table');
      const firstCell = event.target.closest('td');
      if (table?.dataset.kind === 'annual' && firstCell === companyRow.querySelector('td')) {
        const companyId = companyRow.dataset.companyId;
        const company = companies.find((c) => c.id === companyId);
        if (company) {
          openEditCompanyModal(company);
          return;
        }
      }
    }

    const addBtn = event.target.closest('[data-add-company]');
    if (addBtn) {
      event.preventDefault();
      openAddCompanyModal();
      return;
    }

    const editBtn = event.target.closest('[data-edit-company]');
    if (editBtn) {
      event.preventDefault();
      const row = editBtn.closest('tr[data-company-id]');
      const companyId = row?.dataset.companyId;
      const company = companies.find((c) => c.id === companyId);
      if (company) openEditCompanyModal(company);
      return;
    }

    const printBtn = event.target.closest('[data-print-table]');
    if (printBtn) {
      const targetId = printBtn.getAttribute('data-print-table');
      const wrap = document.getElementById(targetId);
      if (wrap) {
        const listCard = printBtn.closest('.list-card');
        const listTitle = listCard?.querySelector('h4')?.textContent?.trim() || 'Tabela';
        const scopeLabel = panelState.scope === 'annual' ? 'Anual' : 'Mensal';
        const title = `${panelState.label} — ${panelState.year} — ${scopeLabel} — ${listTitle}`;
        wrap.setAttribute('data-print-title', title);
        printWrap(wrap, panelState);
      }
    }
  });

  panelEl.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;

    const row = input.closest('tr[data-company-id]');
    const companyId = row?.dataset.companyId;
    if (!companyId || !panelState.ref) return;

    try {
      if (panelState.scope === 'annual' && input.hasAttribute('data-annual-check')) {
        await updateDoc(panelState.ref, {
          [`completedByCompany.${companyId}`]: Boolean(input.checked),
          updatedAt: new Date()
        });
        showToast(input.checked ? 'Marcado como concluído.' : 'Marcado como pendente.', 'success');
        return;
      }

      const month = Number(input.getAttribute('data-month'));
      if (!month || month < 1 || month > 12) return;
      await updateDoc(panelState.ref, {
        [`monthsByCompany.${companyId}.${month}`]: Boolean(input.checked),
        updatedAt: new Date()
      });
      showToast(input.checked ? 'Mês concluído.' : 'Mês desmarcado.', 'success');
    } catch (err) {
      console.error('Erro a atualizar:', err);
      showToast('Erro ao guardar no Firebase.', 'error');
    }
  });
}

function openAddCompanyModal() {
  const { modal, close } = createModal({
    title: 'Adicionar empresa',
    subtitle: null,
    bodyHtml: `
      <div class="field" style="margin: 0;">
        <label for="new-company-name">Nome</label>
        <input id="new-company-name" type="text" placeholder="Ex.: Nova Empresa" />
        <div class="muted" style="font-size: .9rem;">Será adicionada a “Empresas em Atividade”.</div>
      </div>
    `,
    primaryLabel: 'Adicionar'
  });

  const input = modal.querySelector('#new-company-name');
  input?.focus();

  const primary = modal.querySelector('[data-modal-primary]');
  primary?.addEventListener('click', async () => {
    const name = (input?.value || '').trim();
    if (!name) {
      showToast('Indica o nome da empresa.', 'warning');
      return;
    }
    const existingIds = new Set(companies.map((c) => c.id));
    const id = ensureUniqueId(normalizeId(name), existingIds);
    const next = sortCompanies([...companies, { id, name, state: 'active' }]);

    try {
      await writeCompanies(next);
      showToast('Empresa adicionada.', 'success');
      close();
    } catch (err) {
      console.error('Erro a adicionar empresa:', err);
      showToast('Erro ao adicionar empresa (Firebase).', 'error');
    }
  });
}

function openEditCompanyModal(company) {
  const isSuspended = (company.state || 'active') === 'suspended';
  const dangerLabel = isSuspended ? 'Mover para Atividade' : 'Mover para Suspensas';

  const { modal, close } = createModal({
    title: 'Editar empresa',
    subtitle: 'Alterar o nome ou mover entre listas.',
    bodyHtml: `
      <div class="field-inline" style="gap: 10px; justify-content: space-between;">
        <label for="edit-company-name"><strong>Nome</strong></label>
        <input id="edit-company-name" type="text" style="width: min(360px, 100%);" value="${escapeHtml(company.name)}" />
      </div>
      <div class="muted">Estado atual: <strong>${isSuspended ? 'Suspensa' : 'Em Atividade'}</strong></div>
    `,
    primaryLabel: 'Guardar',
    dangerLabel,
    deleteLabel: 'Apagar'
  });

  const input = modal.querySelector('#edit-company-name');
  input?.focus();

  const primary = modal.querySelector('[data-modal-primary]');
  primary?.addEventListener('click', async () => {
    const name = (input?.value || '').trim();
    if (!name) {
      showToast('Indica o nome da empresa.', 'warning');
      return;
    }
    const next = companies.map((c) => c.id === company.id ? { ...c, name } : c);
    try {
      await writeCompanies(sortCompanies(next));
      showToast('Empresa atualizada.', 'success');
      close();
    } catch (err) {
      console.error('Erro a atualizar empresa:', err);
      showToast('Erro ao atualizar empresa (Firebase).', 'error');
    }
  });

  const danger = modal.querySelector('[data-modal-danger]');
  danger?.addEventListener('click', async () => {
    const nextState = isSuspended ? 'active' : 'suspended';
    const next = companies.map((c) => c.id === company.id ? { ...c, state: nextState } : c);
    try {
      await writeCompanies(sortCompanies(next));
      showToast(nextState === 'suspended' ? 'Movida para Suspensas.' : 'Movida para Atividade.', 'success');
      close();
    } catch (err) {
      console.error('Erro a mover empresa:', err);
      showToast('Erro ao mover empresa (Firebase).', 'error');
    }
  });

  const del = modal.querySelector('[data-modal-delete]');
  del?.addEventListener('click', () => {
    showConfirm(
      `Apagar a empresa “${company.name}”?`,
      async () => {
        const next = companies.filter((c) => c.id !== company.id);
        try {
          await writeCompanies(sortCompanies(next));
          showToast('Empresa apagada.', 'success');
          close();
        } catch (err) {
          console.error('Erro a apagar empresa:', err);
          showToast('Erro ao apagar empresa (Firebase).', 'error');
        }
      }
    );
  });
}

function printWrap(wrapEl, panelState) {
  const table = wrapEl.querySelector('table');
  if (!table) {
    showToast('Nada para imprimir.', 'warning');
    return;
  }

  const title = wrapEl.getAttribute('data-print-title') || document.querySelector('h2')?.textContent?.trim() || 'Datas';

  // Extract context from title (format: "Modelo 22 — 2025 — Anual — Empresas em Atividade")
  const parts = title.split(' — ');
  const obligation = parts[0] || 'Datas';
  const year = parts[1] || '';
  const scope = parts[2] || '';
  const listType = parts[3] || '';

  // Build deadline info if applicable
  let deadlineInfo = '';
  if (panelState && panelState.scope === 'annual' && panelState.docData?.deadline) {
    const ymd = panelState.docData.deadline;
    const formattedDeadline = formatDeadlineLabel(ymd);
    const date = parseLocalYMD(ymd);
    if (date) {
      const today = new Date();
      const diff = daysBetweenLocalDates(today, date);
      let status = '';
      if (diff < 0) {
        status = `(Prazo ultrapassado há ${Math.abs(diff)} dias)`;
      } else if (diff === 0) {
        status = '(É hoje)';
      } else {
        status = `(Faltam ${diff} dias)`;
      }
      deadlineInfo = `<div style="grid-column: 1 / -1;"><strong>Prazo de Entrega:</strong> ${escapeHtml(formattedDeadline)} ${escapeHtml(status)}</div>`;
    }
  }

  const tableClone = table.cloneNode(true);

  // Remove "Ações" column (last column) from print output
  const removeLastCell = (row) => {
    const cells = row ? Array.from(row.children) : [];
    if (cells.length) cells[cells.length - 1].remove();
  };
  tableClone.querySelectorAll('thead tr').forEach(removeLastCell);
  tableClone.querySelectorAll('tbody tr').forEach((tr) => {
    if (tr.classList.contains('section-row')) return;
    removeLastCell(tr);
  });

  // Ensure no buttons are printed even if structure changes
  tableClone.querySelectorAll('button').forEach((b) => b.remove());

  const printDate = new Date().toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html lang="pt-pt">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)} — Imprimir</title>
        <style>
          @page {
            margin: 1.5cm;
            size: A4;
          }

          body {
            font-family: Arial, sans-serif;
            padding: 0;
            margin: 0;
            font-size: 11pt;
          }

          .print-header {
            margin-bottom: 24px;
            border-bottom: 2px solid #333;
            padding-bottom: 16px;
          }

          .print-header h1 {
            font-size: 20pt;
            margin: 0 0 12px;
            color: #1a1a1a;
          }

          .print-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 10pt;
            color: #333;
          }

          .print-info strong {
            font-weight: 600;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          thead {
            display: table-header-group;
          }

          th, td {
            border: 1px solid #333;
            padding: 6px 8px;
            text-align: left;
            vertical-align: middle;
          }

          th {
            background: #e8e8e8;
            font-weight: 700;
            font-size: 10pt;
          }

          td {
            font-size: 10pt;
          }

          .section-row td {
            font-weight: 700;
            background: #f5f5f5;
            padding-top: 10px;
          }

          tr.is-complete {
            opacity: 0.6;
          }

          input[type="checkbox"] {
            transform: scale(1.2);
            margin: 2px;
          }

          .print-footer {
            margin-top: 20px;
            padding-top: 12px;
            border-top: 1px solid #999;
            font-size: 9pt;
            color: #666;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>${escapeHtml(obligation)}</h1>
          <div class="print-info">
            <div><strong>Ano:</strong> ${escapeHtml(year)}</div>
            <div><strong>Tipo:</strong> ${escapeHtml(scope)}</div>
            <div><strong>Lista:</strong> ${escapeHtml(listType)}</div>
            <div><strong>Impresso em:</strong> ${escapeHtml(printDate)}</div>
            ${deadlineInfo}
          </div>
        </div>
        ${tableClone.outerHTML}
        <div class="print-footer">
          Gerado automaticamente pelo sistema de gestão de obrigações
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (!win) {
    showToast('O browser bloqueou a janela de impressão.', 'warning');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function bindScopeTabs() {
  const scopeTabs = document.querySelectorAll('#datas-scope-tabs .tab-btn');
  const annual = document.querySelector('[data-scope-panel="annual"]');
  const monthly = document.querySelector('[data-scope-panel="monthly"]');

  scopeTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const scope = btn.dataset.scope;
      scopeTabs.forEach((b) => b.classList.toggle('active', b === btn));
      if (scope === 'annual') {
        annual.style.display = '';
        monthly.style.display = 'none';
      } else {
        annual.style.display = 'none';
        monthly.style.display = '';
      }
    });
  });
}

async function init() {
  const annualMount = document.getElementById('datas-scope-annual');
  const monthlyMount = document.getElementById('datas-scope-monthly');
  if (!annualMount || !monthlyMount) return;

  await ensureCompaniesDoc();

  onSnapshot(companiesRef, (snap) => {
    const data = snap.data();
    companies = Array.isArray(data?.companies) ? data.companies.map((c) => ({
      id: String(c.id || ''),
      name: String(c.name || ''),
      state: c.state === 'suspended' ? 'suspended' : 'active'
    })).filter((c) => c.id && c.name) : [];

    companies = sortCompanies(companies);
    panelStateByKey.forEach((state) => refreshPanel(state));
  }, (err) => {
    console.error('Erro ao ler empresas:', err);
    showToast('Erro ao carregar empresas (Firebase).', 'error');
  });

  renderScopePanel('annual', annualMount);
  renderScopePanel('monthly', monthlyMount);
  bindScopeTabs();

  panelStateByKey.forEach((panelState) => {
    updateYearSelectOptions(panelState);
    bindPanelEvents(panelState);
    attachDocListener(panelState);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
