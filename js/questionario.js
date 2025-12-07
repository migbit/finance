import { db } from './script.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { showConfirm, showToast } from './toast.js';

const QUANT_FIELDS = [
  { id: 'q-avaliacao', key: 'avaliacao_global', min: 1, max: 10 },
  { id: 'q-comunicacao', key: 'comunicacao', min: 1, max: 5 },
  { id: 'q-limpeza-quartos', key: 'limpeza_quartos', min: 1, max: 5 },
  { id: 'q-limpeza-wc', key: 'limpeza_wc', min: 1, max: 5 },
  { id: 'q-limpeza-cozinha', key: 'limpeza_cozinha', min: 1, max: 5 },
  { id: 'q-limpeza-comuns', key: 'limpeza_areas_comuns', min: 1, max: 5 },
  { id: 'q-conforto-colchao', key: 'conforto_colchao', min: 1, max: 5 },
  { id: 'q-conforto-almofadas', key: 'conforto_almofadas', min: 1, max: 5 },
  { id: 'q-conforto-temperatura', key: 'conforto_temperatura', min: 1, max: 5 }
];

const QUALI_FIELDS = [
  { id: 't-problemas', key: 'problemas_limpeza', label: 'Problemas de limpeza/manutenção' },
  { id: 't-ruidos', key: 'ruidos', label: 'Ruídos' },
  { id: 't-avarias', key: 'equipamentos_avariados', label: 'Equipamentos avariados' },
  { id: 't-faltas', key: 'equipamentos_falta', label: 'Equipamentos em falta' },
  { id: 't-positivos', key: 'pontos_positivos', label: 'O que mais gostaram' },
  { id: 't-sugestoes', key: 'sugestoes', label: 'Sugestões' }
];

const LIMPEZA_KEYS = ['limpeza_quartos', 'limpeza_wc', 'limpeza_cozinha', 'limpeza_areas_comuns'];
const CONFORTO_KEYS = ['conforto_colchao', 'conforto_almofadas', 'conforto_temperatura'];

const state = {
  responses: [],
  tags: [],
  filtered: [],
  filters: {
    apartamento: document.getElementById('filtro-apartamento')?.value || 'all',
    periodo: document.getElementById('filtro-periodo')?.value || '30',
    categoria: 'all'
  },
  charts: {},
  editingId: null,
  hasLoadedResponses: false
};

const els = {
  form: document.getElementById('resposta-form'),
  cancelEdit: document.getElementById('cancelar-edicao'),
  submitBtn: document.getElementById('submit-resposta'),
  filtroApartamento: document.getElementById('filtro-apartamento'),
  filtroPeriodo: document.getElementById('filtro-periodo'),
  filtroCategoria: document.getElementById('filtro-categoria'),
  tagsSelect: document.getElementById('input-tags'),
  qualitativoBody: document.getElementById('qualitativo-body'),
  qualitativoCount: document.getElementById('qualitativo-count'),
  tagForm: document.getElementById('tag-form'),
  tagList: document.getElementById('tag-list'),
  chartAptCard: document.getElementById('chart-apartamento-card')
};

document.addEventListener('DOMContentLoaded', () => {
  bindListeners();
  loadInitialData();
});

function bindListeners() {
  if (els.form) {
    els.form.addEventListener('submit', handleSubmit);
  }
  if (els.cancelEdit) {
    els.cancelEdit.addEventListener('click', resetForm);
  }
  if (els.filtroApartamento) {
    els.filtroApartamento.addEventListener('change', () => {
      state.filters.apartamento = els.filtroApartamento.value;
      applyFilters();
    });
  }
  if (els.filtroPeriodo) {
    els.filtroPeriodo.addEventListener('change', () => {
      state.filters.periodo = els.filtroPeriodo.value;
      applyFilters();
    });
  }
  if (els.filtroCategoria) {
    els.filtroCategoria.addEventListener('change', () => {
      state.filters.categoria = els.filtroCategoria.value;
      renderQualitativoTable(state.filtered);
    });
  }
  if (els.tagForm) {
    els.tagForm.addEventListener('submit', handleCreateTag);
  }
  if (els.qualitativoBody) {
    els.qualitativoBody.addEventListener('click', handleTableAction);
  }
}

async function loadInitialData() {
  setQualitativeLoading('A carregar respostas…');
  try {
    await Promise.all([loadTags(), loadResponses()]);
  } catch (err) {
    console.error('Erro a carregar dados iniciais', err);
    showToast('Falha ao carregar questionário.', 'error');
  }
}

async function loadResponses() {
  try {
    const q = query(collection(db, 'questionario_respostas'), orderBy('data', 'desc'));
    const snapshot = await getDocs(q);
    state.responses = snapshot.docs.map(mapResponse);
    state.hasLoadedResponses = true;
    applyFilters();
    updateTagsUsage();
  } catch (err) {
    console.error('Erro ao ler respostas', err);
    showToast('Não foi possível carregar respostas.', 'error');
    setQualitativeLoading('Erro ao carregar respostas.');
  }
}

async function loadTags() {
  try {
    const snapshot = await getDocs(collection(db, 'questionario_tags'));
    state.tags = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    renderTagOptions();
    if (state.hasLoadedResponses) {
      updateTagsUsage();
    } else {
      renderTagList();
    }
  } catch (err) {
    console.error('Erro ao carregar tags', err);
    showToast('Não foi possível carregar tags.', 'error');
  }
}

function mapResponse(docSnap) {
  const data = docSnap.data();
  const toDate = (value) => (value?.toDate ? value.toDate() : value ? new Date(value) : null);
  return {
    id: docSnap.id,
    ...data,
    dataDate: toDate(data.data),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    tags: Array.isArray(data.tags) ? data.tags : []
  };
}

function applyFilters() {
  const now = new Date();
  const cutoff = resolveCutoff(now, state.filters.periodo);
  const filtered = state.responses.filter((resp) => {
    const aptMatch = state.filters.apartamento === 'all' || String(resp.apartamento) === state.filters.apartamento;
    const dateMatch = !cutoff || (resp.dataDate && resp.dataDate >= cutoff);
    return aptMatch && dateMatch;
  });
  state.filtered = filtered;
  renderMetrics(filtered);
  renderCharts(filtered);
  renderQualitativoTable(filtered);
}

function resolveCutoff(now, periodo) {
  if (periodo === 'all') return null;
  const days = Number(periodo || 0);
  if (!Number.isFinite(days) || days <= 0) return null;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

function renderMetrics(responses) {
  const qtd = responses.length;
  const quantTotals = {
    avaliacao_global: { sum: 0, count: 0 },
    comunicacao: { sum: 0, count: 0 }
  };
  const limpeza = { sum: 0, count: 0 };
  const conforto = { sum: 0, count: 0 };

  responses.forEach((resp) => {
    const q = resp.quantitativas || {};
    ['avaliacao_global', 'comunicacao'].forEach((key) => {
      const val = Number(q[key]);
      if (!Number.isNaN(val)) {
        quantTotals[key].sum += val;
        quantTotals[key].count += 1;
      }
    });
    LIMPEZA_KEYS.forEach((key) => {
      const val = Number(q[key]);
      if (!Number.isNaN(val)) {
        limpeza.sum += val;
        limpeza.count += 1;
      }
    });
    CONFORTO_KEYS.forEach((key) => {
      const val = Number(q[key]);
      if (!Number.isNaN(val)) {
        conforto.sum += val;
        conforto.count += 1;
      }
    });
  });

  const avg = (obj) => (obj.count ? (obj.sum / obj.count) : null);
  updateKpi('kpi-global', avg(quantTotals.avaliacao_global), 1);
  updateKpi('kpi-comunicacao', avg(quantTotals.comunicacao), 2);
  updateKpi('kpi-limpeza', avg(limpeza), 2);
  updateKpi('kpi-conforto', avg(conforto), 2);

  updateGlobalStatus(avg(quantTotals.avaliacao_global), qtd);
}

function updateKpi(elId, value, decimals = 1) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = value !== null && Number.isFinite(value) ? value.toFixed(decimals) : '—';
}

function updateGlobalStatus(avg, total) {
  const wrap = document.getElementById('kpi-global-status');
  const text = document.getElementById('kpi-global-text');
  if (!wrap || !text) return;

  let color = 'var(--border)';
  let label = total ? 'Sem dados' : 'Sem dados';

  if (total && avg !== null && Number.isFinite(avg)) {
    if (avg > 8) {
      color = 'var(--ok)';
      label = 'Excelente';
    } else if (avg >= 6) {
      color = '#f59e0b';
      label = 'Atenção';
    } else {
      color = 'var(--bad)';
      label = 'Crítico';
    }
  }

  const dot = wrap.querySelector('.dot');
  if (dot) dot.style.background = color;
  text.textContent = label;
}

function renderCharts(responses) {
  renderEvolucaoChart(responses);
  renderLimpezaChart(responses);
  renderConfortoChart(responses);
  renderApartamentosChart(responses);
}

function renderEvolucaoChart(responses) {
  const ctx = document.getElementById('chart-evolucao');
  if (!ctx) return;
  destroyChart('evolucao');

  const sorted = [...responses].filter((r) => r.dataDate).sort((a, b) => a.dataDate - b.dataDate);
  const labels = sorted.map((r) => r.dataDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }));
  const data = sorted.map((r) => Number(r.quantitativas?.avaliacao_global) || null);

  state.charts.evolucao = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Avaliação global',
        data,
        borderColor: 'rgba(95, 107, 122, 0.9)',
        backgroundColor: 'rgba(95, 107, 122, 0.15)',
        tension: 0.25,
        fill: true,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { suggestedMin: 0, suggestedMax: 10, ticks: { stepSize: 2 } }
      }
    }
  });
}

function renderLimpezaChart(responses) {
  const ctx = document.getElementById('chart-limpeza');
  if (!ctx) return;
  destroyChart('limpeza');

  const sums = LIMPEZA_KEYS.map((key) => ({ key, sum: 0, count: 0 }));
  responses.forEach((resp) => {
    const q = resp.quantitativas || {};
    sums.forEach((item) => {
      const v = Number(q[item.key]);
      if (!Number.isNaN(v)) {
        item.sum += v;
        item.count += 1;
      }
    });
  });

  const labels = ['Quartos', 'Casa de banho', 'Cozinha', 'Áreas comuns'];
  const data = sums.map((item) => item.count ? item.sum / item.count : null);

  state.charts.limpeza = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Média',
        data,
        backgroundColor: 'rgba(95, 107, 122, 0.65)',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { suggestedMin: 0, suggestedMax: 5, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderConfortoChart(responses) {
  const ctx = document.getElementById('chart-conforto');
  if (!ctx) return;
  destroyChart('conforto');

  const sums = CONFORTO_KEYS.map((key) => ({ key, sum: 0, count: 0 }));
  responses.forEach((resp) => {
    const q = resp.quantitativas || {};
    sums.forEach((item) => {
      const v = Number(q[item.key]);
      if (!Number.isNaN(v)) {
        item.sum += v;
        item.count += 1;
      }
    });
  });

  const labels = ['Colchão', 'Almofadas', 'Temperatura'];
  const data = sums.map((item) => item.count ? item.sum / item.count : null);

  state.charts.conforto = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Média',
        data,
        backgroundColor: 'rgba(95, 107, 122, 0.65)',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { suggestedMin: 0, suggestedMax: 5, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderApartamentosChart(responses) {
  if (!els.chartAptCard) return;
  const ctx = document.getElementById('chart-apartamentos');
  if (!ctx) return;

  const show = state.filters.apartamento === 'all';
  els.chartAptCard.style.display = show ? 'block' : 'none';
  if (!show) {
    destroyChart('apartamentos');
    return;
  }

  const byApt = {
    '123': { count: 0, global: 0, limpezaSum: 0, limpezaCount: 0, confortoSum: 0, confortoCount: 0 },
    '1248': { count: 0, global: 0, limpezaSum: 0, limpezaCount: 0, confortoSum: 0, confortoCount: 0 }
  };

  responses.forEach((resp) => {
    const apt = String(resp.apartamento);
    if (!byApt[apt]) return;
    const q = resp.quantitativas || {};
    const global = Number(q.avaliacao_global);
    if (!Number.isNaN(global)) {
      byApt[apt].global += global;
      byApt[apt].count += 1;
    }
    LIMPEZA_KEYS.forEach((key) => {
      const v = Number(q[key]);
      if (!Number.isNaN(v)) {
        byApt[apt].limpezaSum += v;
        byApt[apt].limpezaCount += 1;
      }
    });
    CONFORTO_KEYS.forEach((key) => {
      const v = Number(q[key]);
      if (!Number.isNaN(v)) {
        byApt[apt].confortoSum += v;
        byApt[apt].confortoCount += 1;
      }
    });
  });

  const labels = ['Avaliação global', 'Limpeza', 'Conforto'];
  const datasetFor = (apt) => {
    const base = byApt[apt];
    const avgGlobal = base.count ? base.global / base.count : null;
    const avgLimpeza = base.limpezaCount ? base.limpezaSum / base.limpezaCount : null;
    const avgConforto = base.confortoCount ? base.confortoSum / base.confortoCount : null;
    return [avgGlobal, avgLimpeza, avgConforto];
  };

  destroyChart('apartamentos');
  state.charts.apartamentos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '123',
          data: datasetFor('123'),
          backgroundColor: 'rgba(95, 107, 122, 0.8)',
          borderRadius: 8
        },
        {
          label: '1248',
          data: datasetFor('1248'),
          backgroundColor: 'rgba(154, 163, 181, 0.8)',
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { suggestedMin: 0, suggestedMax: 10 } }
    }
  });
}

function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

function renderQualitativoTable(responses) {
  if (!els.qualitativoBody) return;
  const rows = [];

  responses.forEach((resp) => {
    QUALI_FIELDS.forEach((field) => {
      const text = (resp.qualitativas?.[field.key] || '').trim();
      if (text) {
        rows.push({
          id: resp.id,
          apartamento: resp.apartamento,
          idioma: resp.idioma,
          dataDate: resp.dataDate,
          categoria: field.key,
          categoriaLabel: field.label,
          texto: text,
          tags: resp.tags || []
        });
      }
    });
  });

  const filteredRows = state.filters.categoria === 'all'
    ? rows
    : rows.filter((row) => row.categoria === state.filters.categoria);

  filteredRows.sort((a, b) => {
    const aDate = a.dataDate ? a.dataDate.getTime() : 0;
    const bDate = b.dataDate ? b.dataDate.getTime() : 0;
    return bDate - aDate;
  });

  if (els.qualitativoCount) {
    els.qualitativoCount.textContent = `${filteredRows.length} respostas de texto`;
  }

  if (!filteredRows.length) {
    setQualitativeLoading('Sem respostas para mostrar.');
    return;
  }

  const html = filteredRows.map((row) => {
    const dateStr = row.dataDate
      ? row.dataDate.toLocaleDateString('pt-PT')
      : '—';
    const tags = renderTagLabels(row.tags);
    return `
      <tr data-id="${row.id}">
        <td>${dateStr}</td>
        <td>${row.apartamento || '—'}</td>
        <td>${row.idioma || '—'}</td>
        <td>${row.categoriaLabel}</td>
        <td style="text-align:left;">${escapeHtml(row.texto)}</td>
        <td>${tags || '<span class="muted">Sem tags</span>'}</td>
        <td>
          <div style="display:flex; gap:6px; justify-content:center;">
            <button type="button" data-action="edit" data-id="${row.id}">Editar</button>
            <button type="button" data-action="delete" data-id="${row.id}">Apagar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  els.qualitativoBody.innerHTML = html;
}

function renderTagLabels(tagIds = []) {
  if (!tagIds.length || !state.tags.length) return '';
  const names = tagIds
    .map((id) => state.tags.find((t) => t.id === id))
    .filter(Boolean)
    .map((tag) => `<span class="tag-chip">${escapeHtml(tag.nome || '')}</span>`);
  return names.join('');
}

function setQualitativeLoading(message) {
  if (!els.qualitativoBody) return;
  els.qualitativoBody.innerHTML = `<tr><td colspan="7" class="muted">${message}</td></tr>`;
}

async function handleSubmit(event) {
  event.preventDefault();
  const payload = readForm();
  if (!payload) return;

  const isEdit = Boolean(state.editingId);
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'questionario_respostas', state.editingId), {
        ...payload,
        updatedAt: Timestamp.now()
      });
      showToast('Resposta atualizada.', 'success');
    } else {
      await addDoc(collection(db, 'questionario_respostas'), {
        ...payload,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      showToast('Resposta guardada.', 'success');
    }
    resetForm();
    await loadResponses();
  } catch (err) {
    console.error('Erro ao guardar resposta', err);
    showToast('Não foi possível guardar.', 'error');
  }
}

function readForm() {
  const apartamento = document.getElementById('input-apartamento')?.value;
  const idioma = document.getElementById('input-idioma')?.value;
  const dataStr = document.getElementById('input-data')?.value;
  const tags = Array.from(els.tagsSelect?.selectedOptions || []).map((opt) => opt.value);

  if (!apartamento || !idioma || !dataStr) {
    showToast('Preenche apartamento, idioma e data.', 'warning');
    return null;
  }

  const dataDate = new Date(dataStr);
  if (Number.isNaN(dataDate.getTime())) {
    showToast('Data inválida.', 'warning');
    return null;
  }

  const quantitativas = {};
  for (const field of QUANT_FIELDS) {
    const input = document.getElementById(field.id);
    const value = Number(input?.value);
    if (!Number.isFinite(value)) {
      showToast('Preenche todos os campos quantitativos.', 'warning');
      return null;
    }
    if (value < field.min || value > field.max) {
      showToast(`Valor fora do intervalo (${field.min}-${field.max}).`, 'warning');
      return null;
    }
    quantitativas[field.key] = value;
  }

  const qualitativas = {};
  QUALI_FIELDS.forEach((field) => {
    const text = document.getElementById(field.id)?.value?.trim() || '';
    qualitativas[field.key] = text;
  });

  return {
    apartamento,
    idioma,
    data: Timestamp.fromDate(dataDate),
    quantitativas,
    qualitativas,
    tags
  };
}

function resetForm() {
  if (els.form) els.form.reset();
  if (els.submitBtn) els.submitBtn.textContent = 'Guardar resposta';
  if (els.cancelEdit) els.cancelEdit.style.display = 'none';
  state.editingId = null;
}

function fillForm(response) {
  document.getElementById('input-apartamento').value = response.apartamento || '';
  document.getElementById('input-idioma').value = response.idioma || '';
  if (response.dataDate) {
    document.getElementById('input-data').value = formatDateInput(response.dataDate);
  }
  QUANT_FIELDS.forEach((field) => {
    const input = document.getElementById(field.id);
    if (input) input.value = response.quantitativas?.[field.key] ?? '';
  });
  QUALI_FIELDS.forEach((field) => {
    const textarea = document.getElementById(field.id);
    if (textarea) textarea.value = response.qualitativas?.[field.key] || '';
  });

  if (els.tagsSelect) {
    Array.from(els.tagsSelect.options).forEach((opt) => {
      opt.selected = response.tags?.includes(opt.value);
    });
  }
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function handleTableAction(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const response = state.responses.find((r) => r.id === id);
  if (!response) return;

  if (action === 'edit') {
    state.editingId = id;
    if (els.submitBtn) els.submitBtn.textContent = 'Atualizar resposta';
    if (els.cancelEdit) els.cancelEdit.style.display = 'inline-flex';
    fillForm(response);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (action === 'delete') {
    showConfirm('Apagar esta resposta?', async () => {
      try {
        await deleteDoc(doc(db, 'questionario_respostas', id));
        showToast('Resposta apagada.', 'success');
        await loadResponses();
      } catch (err) {
        console.error('Erro ao apagar', err);
        showToast('Não foi possível apagar.', 'error');
      }
    });
  }
}

function renderTagOptions() {
  if (!els.tagsSelect) return;
  const options = state.tags.map((tag) => `<option value="${tag.id}">${escapeHtml(tag.nome || '')}</option>`).join('');
  els.tagsSelect.innerHTML = options;
}

async function handleCreateTag(event) {
  event.preventDefault();
  const nome = document.getElementById('tag-nome')?.value.trim();
  const categoria = document.getElementById('tag-categoria')?.value || 'ruidos';
  const apartamento = document.getElementById('tag-apartamento')?.value || 'ambos';

  if (!nome) {
    showToast('Escreve um nome para a tag.', 'warning');
    return;
  }

  try {
    await addDoc(collection(db, 'questionario_tags'), {
      nome,
      categoria,
      apartamento,
      contagem: 0,
      createdAt: Timestamp.now()
    });
    showToast('Tag criada.', 'success');
    if (els.tagForm) els.tagForm.reset();
    await loadTags();
  } catch (err) {
    console.error('Erro ao criar tag', err);
    showToast('Não foi possível criar a tag.', 'error');
  }
}

function updateTagsUsage() {
  if (!state.hasLoadedResponses) {
    renderTagList();
    return;
  }
  const usage = computeTagUsage(state.responses);
  renderTagList(usage);
  syncTagCounts(usage).catch((err) => console.error('Erro ao sincronizar contagem de tags', err));
}

function computeTagUsage(responses) {
  const counts = {};
  responses.forEach((resp) => {
    (resp.tags || []).forEach((tagId) => {
      counts[tagId] = (counts[tagId] || 0) + 1;
    });
  });
  return counts;
}

function renderTagList(usageMap = {}) {
  if (!els.tagList) return;
  if (!state.tags.length) {
    els.tagList.innerHTML = '<div class="empty-state">Ainda não existem tags.</div>';
    return;
  }

  const cards = state.tags.map((tag) => {
    const count = usageMap[tag.id] || 0;
    const apt = tag.apartamento || 'ambos';
    const categoria = tag.categoria || '—';
    return `
      <div class="tag-card" data-tag-id="${tag.id}">
        <div class="tag-meta">
          <span>${escapeHtml(tag.nome || '')}</span>
          <span class="muted">#${count}</span>
        </div>
        <div class="muted">Categoria: ${escapeHtml(categoria)}</div>
        <div class="muted">Apartamento: ${escapeHtml(apt)}</div>
      </div>
    `;
  }).join('');

  els.tagList.innerHTML = cards;
}

async function syncTagCounts(usageMap) {
  const pending = state.tags
    .filter((tag) => (tag.contagem || 0) !== (usageMap[tag.id] || 0))
    .map((tag) => ({ id: tag.id, value: usageMap[tag.id] || 0 }));

  if (!pending.length) return;

  await Promise.all(
    pending.map((item) => updateDoc(doc(db, 'questionario_tags', item.id), { contagem: item.value }))
  );

  state.tags = state.tags.map((tag) => ({
    ...tag,
    contagem: usageMap[tag.id] || 0
  }));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
