// js/crypto.js

/* ================== Host / API ================== */
const HOST = location.hostname;
const ON_FIREBASE = /\.web\.app$/.test(HOST) || /firebaseapp\.com$/.test(HOST);
const CF_URL = 'https://europe-west1-apartments-a4b17.cloudfunctions.net/binancePortfolio';
const API_URL = ON_FIREBASE ? '/api/portfolio' : CF_URL;

/* ================== Intl ================== */
const nfQty  = new Intl.NumberFormat('en-PT', { maximumFractionDigits: 8 });
const nfEUR  = new Intl.NumberFormat('en-PT', { style:'currency', currency:'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfUSD  = new Intl.NumberFormat('en-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ================== UI State ================== */
const SMALL_USD_THRESHOLD = 5;   // threshold do toggle
let hideSmall = true;            // começa a ocultar < $5

/* ================== Config ================== */
const HIDE_SYMBOLS = new Set(['NEBL','ETHW']);
const LOCATION_CHOICES = [
  'Binance Spot',
  'Binance Earn Flexible',
  'Binance Staking',
  'Binance Earn',
  'Ledger',
  'Other'
];

/* ================== Firebase ================== */
import { db } from './script.js';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/* ================== DOM utils ================== */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ================== App State ================== */
let savedLocations   = new Map();  // cryptoportfolio
let manualAssets     = [];         // cryptoportfolio_manual
let binanceRows      = [];         // da função
let usdtToEurRate    = 0;          // EUR/USDT ratio
let binancePriceMap  = new Map();  // symbol -> priceUSDT
let _latestCombinedRows = [];      // linhas mostradas

// Expor helpers no window (debug / PDF)
window.getCurrentRows  = () => _latestCombinedRows.slice();
window.getHideSmall    = () => hideSmall;
window.getUsdThreshold = () => SMALL_USD_THRESHOLD;

/* ================== CoinGecko helpers ================== */
const LS_PRICE_PREFIX = 'price_usd_';   // price_usd_BTC
const LS_ID_PREFIX    = 'cg_id_';       // cg_id_BTC
const PRICE_TTL_MS    = 1000 * 60 * 60; // 1h

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function resolveCoingeckoIdFromSymbol(symbol){
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`, { cache: 'no-cache' });
    if (!r.ok) return null;
    const j = await r.json();
    const coins = j?.coins || [];
    let hit = coins.find(c => (c.symbol || '').toUpperCase() === symbol);
    if (!hit) hit = coins.find(c => (c.symbol || '').toUpperCase().startsWith(symbol));
    if (!hit) hit = coins[0];
    return hit ? hit.id : null;
  } catch {
    return null;
  }
}

async function fetchCoingeckoUsdPrice(id){
  const tries = [0, 500, 1000]; // retry/backoff simples
  for (const delay of tries) {
    if (delay) await sleep(delay);
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`, { cache: 'no-cache' });
      if (r.status === 429) continue;
      if (!r.ok) continue;
      const j = await r.json();
      const v = j?.[id]?.usd;
      if (typeof v === 'number' && v > 0) return v;
      console.warn('CG empty/zero price for', id, j);
    } catch (e) {
      console.warn('CG fetch error', id, e);
    }
  }
  return 0;
}

// Pré-carrega e cacheia preços em batch para evitar 429 no 1º load
async function ensureCoingeckoIdsForSymbols(symbols){
  const need = [];
  for (const s0 of symbols) {
    const s = String(s0).toUpperCase();
    const key = LS_ID_PREFIX + s;
    const cached = localStorage.getItem(key);
    if (!cached) need.push(s);
  }
  for (const s of need) {
    const id = await resolveCoingeckoIdFromSymbol(s);
    if (id) try { localStorage.setItem(LS_ID_PREFIX + s, id); } catch {}
    await sleep(120);
  }
}

function symbolsNeedingPrice(symbols){
  const out = [];
  for (const s0 of symbols) {
    const s = String(s0).toUpperCase();
    const cache = localStorage.getItem(LS_PRICE_PREFIX + s);
    if (cache) {
      try {
        const c = JSON.parse(cache);
        if (c && (Date.now() - c.ts) < PRICE_TTL_MS && c.usd > 0) continue;
      } catch {}
    }
    out.push(s);
  }
  return out;
}

async function fetchCoingeckoPricesBatch(ids){
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`;
  let tries = 0;
  while (tries < 3) {
    tries++;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.status === 429) { await sleep(900 + Math.random()*600); continue; }
      if (!res.ok) { await sleep(400); continue; }
      const json = await res.json();
      return json || {};
    } catch {
      await sleep(400);
    }
  }
  return {};
}

async function prefetchUsdPricesForSymbols(symbols, batchSize=30){
  await ensureCoingeckoIdsForSymbols(symbols);

  const symToId = new Map();
  for (const s0 of symbols) {
    const s = String(s0).toUpperCase();
    const id = localStorage.getItem(LS_ID_PREFIX + s);
    if (id) symToId.set(s, id);
  }

  const needSyms = symbolsNeedingPrice(symbols);
  const needIds = needSyms.map(s => symToId.get(s)).filter(Boolean);

  for (let i=0; i<needIds.length; i+=batchSize) {
    const slice = needIds.slice(i, i+batchSize);
    const data = await fetchCoingeckoPricesBatch(slice);
    for (const id of slice) {
      const v = data?.[id]?.usd;
      for (const [sym, symId] of symToId.entries()) {
        if (symId === id && typeof v === 'number' && v > 0) {
          try { localStorage.setItem(LS_PRICE_PREFIX + sym, JSON.stringify({ usd: v, ts: Date.now() })); } catch {}
        }
      }
    }
    await sleep(600 + Math.random()*600);
  }
}

// Único resolvedor por símbolo (usa Binance se possível; senão cache/CG)
async function getUsdPriceForSymbol(sym){
  const s = String(sym || '').toUpperCase();

  // 1) preço por ativo vindo da própria Binance
  if (binancePriceMap.has(s)) {
    return { price: binancePriceMap.get(s), source: 'binance' };
  }

  // 2) cache local válida
  try {
    const cache = JSON.parse(localStorage.getItem(LS_PRICE_PREFIX + s) || 'null');
    if (cache && (Date.now() - cache.ts) < PRICE_TTL_MS && cache.usd > 0) {
      return { price: Number(cache.usd || 0), source: 'coingecko' };
    }
  } catch {}

  // 3) resolver id (cacheado) e pedir preço
  let id = null;
  try { id = localStorage.getItem(LS_ID_PREFIX + s) || null; } catch {}
  if (!id) {
    id = await resolveCoingeckoIdFromSymbol(s);
    if (!id) return { price: 0, source: 'unknown' };
    try { localStorage.setItem(LS_ID_PREFIX + s, id); } catch {}
  }
  const usd = await fetchCoingeckoUsdPrice(id);
  if (usd > 0) {
    try { localStorage.setItem(LS_PRICE_PREFIX + s, JSON.stringify({ usd, ts: Date.now() })); } catch {}
  }
  return { price: usd || 0, source: 'coingecko' };
}

/* ================== Init ================== */
document.addEventListener('DOMContentLoaded', () => { init(); });

async function init(){
  try {
    await loadSavedLocations();
    await loadManualAssets();

    const data = await fetchPortfolio();
    binanceRows = normalizeBinance(data);

    // ratio EUR/USDT a partir da Binance
    const bEur  = binanceRows.reduce((s,r)=> s + (r.valueEUR  || 0), 0);
    const bUsdt = binanceRows.reduce((s,r)=> s + (r.valueUSDT || 0), 0);
    usdtToEurRate = (bUsdt > 0 && bEur > 0) ? (bEur / bUsdt) : 0;

    await renderAll(data?.generatedAt);
  } catch (e) {
    $('#rows').innerHTML = `<tr><td colspan="6" class="text-muted">Error: ${e.message}</td></tr>`;
  }

  // UI/Bind
  setupModal();

  const btnToggle = document.getElementById('btn-toggle-small');
  if (btnToggle) {
    btnToggle.textContent = hideSmall ? 'Ocultar valores < $5' : 'Mostrar apenas ≥ $5';
    btnToggle.addEventListener('click', () => {
      hideSmall = !hideSmall;
      btnToggle.textContent = hideSmall ? 'Ocultar valores < $5' : 'Mostrar apenas ≥ $5';
      renderTable(getCurrentRows());
      updateSmallNote(getCurrentRows());
    });
  }

  // PDF button bind (também é chamado mais abaixo por segurança)
  setupPdfButton();
}

/* ================== Data fetch/normalize ================== */
async function fetchPortfolio(){
  let res = await fetch(API_URL, { cache: 'no-cache' });
  if (res.ok) return res.json();
  if (ON_FIREBASE) {
    res = await fetch(CF_URL, { cache: 'no-cache' });
    if (res.ok) return res.json();
  }
  throw new Error(`HTTP ${res.status}`);
}

function normalizeBinance(api){
  const positions = Array.isArray(api?.positions) ? api.positions : [];
  const rows = positions
    .map(p => {
      const asset = String(p.asset || '').toUpperCase();
      const qty   = Number(p.quantity || 0);
      let priceU  = (p.priceUSDT == null) ? 0 : Number(p.priceUSDT || 0);
      const valU  = Number(p.valueUSDT || 0);
      const valE  = Number(p.valueEUR  || 0);
      if ((!priceU || priceU <= 0) && qty > 0 && valU > 0) priceU = valU / qty;
      if (priceU > 0) binancePriceMap.set(asset, priceU);

      return {
        asset,
        quantity: qty,
        valueUSDT: valU,
        valueEUR: valE,
        priceUSDT: priceU,
        priceSource: 'binance',
        source: 'binance'
      };
    })
    .filter(r => !HIDE_SYMBOLS.has(r.asset))
    .filter(r => (r.valueEUR || r.valueUSDT || 0) > 0)
    .sort((a,b) => (b.valueEUR || 0) - (a.valueEUR || 0));
  return rows;
}

async function loadSavedLocations(){
  savedLocations = new Map();
  const snap = await getDocs(collection(db, 'cryptoportfolio'));
  snap.forEach(docSnap => {
    const id = docSnap.id;
    const loc = docSnap.data()?.location || null;
    if (id && typeof loc === 'string') savedLocations.set(id.toUpperCase(), loc);
  });
}

async function loadManualAssets(){
  manualAssets = [];
  const snap = await getDocs(collection(db, 'cryptoportfolio_manual'));
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    manualAssets.push({
      asset: String(d.asset || docSnap.id || '').toUpperCase(),
      quantity: Number(d.quantity || 0),
      location: typeof d.location === 'string' ? d.location : 'Other',
      updatedAt: d.updatedAt || null,
      source: 'manual'
    });
  });
}

/* ================== Render ================== */
async function renderAll(generatedAt){
  // Prefetch: símbolos manuais que não têm preço da Binance
  const manualSyms = manualAssets
    .map(m => String(m.asset || '').toUpperCase())
    .filter(s => s && !binancePriceMap.has(s));
  if (manualSyms.length) {
    await prefetchUsdPricesForSymbols(manualSyms, 25); // batches menores reduzem 429
  }

  const manualWithValues = await Promise.all(manualAssets.map(async m => {
    const { price, source: priceSource } = await getUsdPriceForSymbol(m.asset);
    const valUSDT = (price > 0 && m.quantity > 0) ? (m.quantity * price) : 0;
    const valEUR  = usdtToEurRate ? (valUSDT * usdtToEurRate) : 0;
    return { ...m, valueUSDT: valUSDT, valueEUR: valEUR, priceUSDT: price, priceSource };
  }));

  const combined = [
    ...binanceRows.map(r => ({ ...r, location: savedLocations.get(r.asset) || '' })),
    ...manualWithValues
  ].sort((a,b) => (b.valueEUR || 0) - (a.valueEUR || 0));

  _latestCombinedRows = combined;

  renderKpis(combined, generatedAt);
  renderTable(combined);
  updateSmallNote(combined);
}

function renderKpis(rows, generatedAt){
  const totalEUR  = rows.reduce((s,r)=> s + (r.valueEUR  || 0), 0);
  const totalUSDT = rows.reduce((s,r)=> s + (r.valueUSDT || 0), 0);
  $('#kpiTotalEUR').textContent  = nfEUR.format(totalEUR);
  $('#kpiTotalUSDT').textContent = `$${nfUSD.format(totalUSDT)}`;
  $('#kpiStamp').textContent     = generatedAt ? new Date(generatedAt).toLocaleString('pt-PT') : '—';
}

function renderTable(rows){
  const tbody = $('#rows');
  if (!tbody) return;

  const displayRows = hideSmall
    ? rows.filter(r => (r.valueUSDT || 0) >= SMALL_USD_THRESHOLD)
    : rows;

  if (!displayRows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">No data</td></tr>`;
    return;
  }

  const html = displayRows.map(r => {
    const sel = locationSelectHtml(r.asset, r.location || '');
    const priceInfoIcon =
      r.priceSource === 'binance'       ? '<span title="Price from Binance">ⓘ</span>' :
      r.priceSource === 'coingecko'     ? '<span title="Price from CoinGecko">ⓘ</span>' :
                                          '';

    const actions = r.source === 'manual'
      ? `<button class="btn btn-edit" data-edit="${escapeHtml(r.asset)}">Edit</button>
         <button class="btn btn-del" data-del="${escapeHtml(r.asset)}">Delete</button>`
      : `<span class="status" id="status-${escapeHtml(r.asset)}"></span>`;

    return `
      <tr data-asset="${escapeHtml(r.asset)}" data-source="${r.source}">
        <td><b>${escapeHtml(r.asset)}</b></td>
        <td>${nfQty.format(r.quantity)}</td>
        <td>$${nfUSD.format(r.valueUSDT || 0)} ${priceInfoIcon}</td>
        <td>${nfEUR.format(r.valueEUR || 0)}</td>
        <td>${sel}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;

  // Bind: select (autosave)
  $$('select[data-asset]').forEach(el => {
    el.addEventListener('change', async (e) => {
      const asset = e.target.getAttribute('data-asset');
      const location = e.target.value;
      const row = e.target.closest('tr');
      const source = row?.getAttribute('data-source') || 'binance';
      if (source === 'manual') {
        await saveManual(asset, { location });
      } else {
        await saveBinanceLocation(asset, location);
      }
    });
  });

  // Bind: edit/delete manual
  $$('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openModalForEdit(btn.getAttribute('data-edit')));
  });
  $$('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const asset = btn.getAttribute('data-del');
      if (!confirm(`Delete manual asset ${asset}?`)) return;
      await deleteManual(asset);
      await loadManualAssets();
      await renderAll(); // recalc e re‐render
    });
  });
}

function updateSmallNote(allRows) {
  const note = document.getElementById('small-note');
  if (!note) return;
  const hiddenCount = allRows.filter(r => (r.valueUSDT || 0) < SMALL_USD_THRESHOLD).length;
  if (hideSmall && hiddenCount > 0) {
    note.textContent = `A ocultar ${hiddenCount} posições com valor < $${SMALL_USD_THRESHOLD}.`;
  } else {
    note.textContent = '';
  }
}

function locationSelectHtml(asset, selected){
  const opts = LOCATION_CHOICES.map(v => {
    const sel = v === (selected || '') ? 'selected' : '';
    return `<option value="${escapeHtml(v)}" ${sel}>${escapeHtml(v)}</option>`;
  }).join('');
  return `<select class="location-select" data-asset="${escapeHtml(asset)}">${opts}</select>`;
}

/* ================== Firestore ops ================== */
async function saveBinanceLocation(asset, location){
  const cell = document.getElementById(`status-${asset}`);
  try {
    if (cell) { cell.textContent = 'saving…'; cell.classList.remove('ok','err'); }
    const ref = doc(collection(db, 'cryptoportfolio'), asset);
    await setDoc(ref, { asset, location, updatedAt: new Date() }, { merge: true });
    savedLocations.set(asset, location);
    if (cell) { cell.textContent = 'saved ✓'; cell.classList.add('ok'); }
  } catch (e) {
    console.error(e);
    if (cell) { cell.textContent = 'error'; cell.classList.add('err'); }
    alert('Falha ao guardar localização');
  }
}

async function saveManual(asset, partial){
  const ref = doc(collection(db, 'cryptoportfolio_manual'), asset);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? (snap.data() || {}) : {};
  const next = { ...prev, ...partial, asset, updatedAt: new Date() };
  await setDoc(ref, next, { merge: true });
}

async function deleteManual(asset){
  const ref = doc(collection(db, 'cryptoportfolio_manual'), asset);
  await deleteDoc(ref);
}

/* ================== Modal Add/Edit ================== */
function setupModal(){
  const modal = $('#modal-backdrop');
  const selLoc = $('#m-loc');
  if (selLoc) {
    selLoc.innerHTML = LOCATION_CHOICES.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  }
  $('#btn-add')?.addEventListener('click', () => openModalForAdd());
  $('#m-cancel')?.addEventListener('click', closeModal);
  $('#m-save')?.addEventListener('click', saveModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

function openModalForAdd(){
  $('#modal-title').textContent = 'Add asset';
  $('#m-asset').value = '';
  $('#m-qty').value = '';
  $('#m-loc').value = 'Other';
  $('#modal-backdrop').style.display = 'flex';
  $('#m-asset').focus();
}

function openModalForEdit(asset){
  const m = manualAssets.find(x => x.asset === asset);
  $('#modal-title').textContent = `Edit ${asset}`;
  $('#m-asset').value = m?.asset || asset;
  $('#m-asset').disabled = true;
  $('#m-qty').value = m?.quantity ?? '';
  $('#m-loc').value = m?.location || 'Other';
  $('#modal-backdrop').style.display = 'flex';
}

function closeModal(){
  $('#modal-backdrop').style.display = 'none';
  $('#m-asset').disabled = false;
}

async function saveModal(){
  const asset = String($('#m-asset').value || '').toUpperCase().trim();
  const qty   = Number($('#m-qty').value || 0);
  const loc   = $('#m-loc').value;

  if (!asset || !isFinite(qty) || qty <= 0) {
    alert('Ticker e quantidade são obrigatórios.');
    return;
  }

  await saveManual(asset, { asset, quantity: qty, location: loc });
  await loadManualAssets();
  closeModal();
  await renderAll(); // recalc preços e totais
}

/* ================== PDF Export (jsPDF UMD) ================== */
function setupPdfButton() {
  const btn = document.getElementById('btn-pdf');
  if (!btn) return;

  btn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    try {
      if (!window.jspdf) { alert('Módulo jsPDF não carregado.'); return; }
      const { jsPDF } = window.jspdf;

      const rows = window.getCurrentRows ? window.getCurrentRows() : [];
      if (!rows.length) { alert('Sem dados para exportar.'); return; }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 40;

      // ======== HEADER ========
      const now = new Date();
      const monthName = now.toLocaleString('pt-PT', { month: 'long' });
      const year = now.getFullYear();
      const title = `Portefólio Cripto — ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(title, pageWidth / 2, y, { align: 'center' });
      y += 30;

      // ======== TABLE HEADER ========
      doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text('Ativo', 40, y); doc.text('Qtd', 120, y);
      doc.text('USD', 240, y); doc.text('EUR', 320, y); doc.text('Localização', 420, y);
      y += 10; doc.line(40, y, pageWidth - 40, y); y += 15;

      // ======== TABLE ROWS ========
      const hide = window.getHideSmall ? window.getHideSmall() : hideSmall;
      const thr  = window.getUsdThreshold ? window.getUsdThreshold() : SMALL_USD_THRESHOLD;
      const displayRows = hide ? rows.filter(r => (r.valueUSDT || 0) >= thr) : rows;

      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      for (const r of displayRows) {
        if (y > 760) { doc.addPage(); y = 40; }
        doc.text(r.asset, 40, y);
        doc.text(nfQty.format(r.quantity), 120, y);
        doc.text(`$${nfUSD.format(r.valueUSDT || 0)}`, 240, y);
        doc.text(`${nfEUR.format(r.valueEUR || 0)}`, 320, y);
        doc.text(r.location || '', 420, y);
        y += 14;
      }

      // ======== TOTAL ========
      y += 20;
      const totalEUR  = rows.reduce((s,r)=> s + (r.valueEUR  || 0), 0);
      const totalUSDT = rows.reduce((s,r)=> s + (r.valueUSDT || 0), 0);
      doc.setFont('helvetica','bold');
      doc.text(`Total:  $${nfUSD.format(totalUSDT)}   (${nfEUR.format(totalEUR)})`, 40, y);

      const filename = `Crypto_Portfolio_${year}-${String(now.getMonth()+1).padStart(2,'0')}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Falha ao gerar PDF. Ver consola.');
    }
  });
}

// Se o DOM já estiver pronto, liga já; senão espera
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPdfButton);
} else {
  setupPdfButton();
}


/* ================== Utils ================== */
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
