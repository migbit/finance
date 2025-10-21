// js/crypto.js
// Use Firebase rewrite only when hosted on Firebase domains.
// Otherwise (GitHub Pages, custom domains, localhost) hit the full CF URL.

const HOST = location.hostname;
const ON_FIREBASE = /\.web\.app$/.test(HOST) || /firebaseapp\.com$/.test(HOST);

const CF_URL = 'https://europe-west1-apartments-a4b17.cloudfunctions.net/binancePortfolio';
const API_URL = ON_FIREBASE ? '/api/portfolio' : CF_URL;

// Intl formatters
const nfQty  = new Intl.NumberFormat('en-PT', { maximumFractionDigits: 8 });
const nfEUR  = new Intl.NumberFormat('en-PT', { style:'currency', currency:'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfUSD  = new Intl.NumberFormat('en-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Small value toggle
const SMALL_USD_THRESHOLD = 5;   // Value ($) threshold
let hideSmall = true;            // start hidden by default

// Hide delisted/noise if desired
const HIDE_SYMBOLS = new Set(['NEBL','ETHW']);

// Dropdown choices
const LOCATION_CHOICES = [
  'Binance Spot',
  'Binance Earn Flexible',
  'Binance Staking',
  'Binance Earn',
  'Ledger'
];

// ---- Firestore (match your caixa.js pattern) ----
import { db } from './script.js';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let savedLocations   = new Map();  // from 'cryptoportfolio'
let manualAssets     = [];         // from 'cryptoportfolio_manual' (asset, quantity, location)
let binanceRows      = [];         // from API
let usdtToEurRate    = 0;          // derived from Binance rows only
let binancePriceMap  = new Map();  // symbol -> priceUSDT (per unit)

// ======== CoinGecko price resolver (symbol -> USD) ========
const LS_PRICE_PREFIX = 'price_usd_';   // key: price_usd_BTC
const LS_ID_PREFIX    = 'cg_id_';       // key: cg_id_btc
const PRICE_TTL_MS    = 1000 * 60 * 60; // 1 hour cache

async function getUsdPriceForSymbol(sym){
  const s = String(sym || '').toUpperCase();

  // 1) Use Binance price if we have it
  if (binancePriceMap.has(s)) {
    return { price: binancePriceMap.get(s), source: 'binance' };
  }

  // 2) Cached CoinGecko price?
  try {
    const cache = JSON.parse(localStorage.getItem(LS_PRICE_PREFIX + s) || 'null');
    if (cache && (Date.now() - cache.ts) < PRICE_TTL_MS && cache.usd > 0) {
      return { price: Number(cache.usd || 0), source: 'coingecko' };
    }
  } catch {}

  // 3) Resolve CoinGecko id (cached)
  let id = null;
  try {
    const cachedId = localStorage.getItem(LS_ID_PREFIX + s);
    if (cachedId) id = cachedId;
  } catch {}
  if (!id) {
    id = await resolveCoingeckoIdFromSymbol(s);
    if (!id) return { price: 0, source: 'unknown' };
    try { localStorage.setItem(LS_ID_PREFIX + s, id); } catch {}
  }

  // 4) Fetch fresh USD price (retry/backoff)
  const usd = await fetchCoingeckoUsdPrice(id);
  if (usd > 0) {
    try { localStorage.setItem(LS_PRICE_PREFIX + s, JSON.stringify({ usd, ts: Date.now() })); } catch {}
  }
  return { price: usd || 0, source: 'coingecko' };
}

async function resolveCoingeckoIdFromSymbol(symbol){
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`, { cache: 'no-cache' });
    if (!r.ok) return null;
    const j = await r.json();
    const coins = j?.coins || [];
    // Prefer exact symbol match; else startsWith; else first
    let hit = coins.find(c => (c.symbol || '').toUpperCase() === symbol);
    if (!hit) hit = coins.find(c => (c.symbol || '').toUpperCase().startsWith(symbol));
    if (!hit) hit = coins[0];
    return hit ? hit.id : null;
  } catch {
    return null;
  }
}

async function fetchCoingeckoUsdPrice(id){
  const tries = [0, 400, 900]; // ms backoff
  for (const delay of tries) {
    if (delay) await new Promise(r => setTimeout(r, delay));
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`, { cache: 'no-cache' });
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

// =============== Init ===============
document.addEventListener('DOMContentLoaded', () => { init(); });

async function init(){
  try {
    await loadSavedLocations();
    await loadManualAssets();

    const data = await fetchPortfolio();
    binanceRows = normalizeBinance(data);

    // derive USDT→EUR from Binance rows (for manual EUR calc)
    const bEur  = binanceRows.reduce((s,r)=> s + (r.valueEUR  || 0), 0);
    const bUsdt = binanceRows.reduce((s,r)=> s + (r.valueUSDT || 0), 0);
    usdtToEurRate = (bUsdt > 0 && bEur > 0) ? (bEur / bUsdt) : 0;

    await renderAll(data?.generatedAt);
  } catch (e) {
    $('#rows').innerHTML = `<tr><td colspan="6" class="text-muted">Error: ${e.message}</td></tr>`;
  }

  // UI: add button & modal init
  setupModal();

  // Toggle small values
  const btnToggle = document.getElementById('btn-toggle-small');
  if (btnToggle) {
    btnToggle.textContent = hideSmall ? 'Mostrar valores < $5' : 'Ocultar valores < $5';
    btnToggle.addEventListener('click', () => {
      hideSmall = !hideSmall;
      btnToggle.textContent = hideSmall ? 'Mostrar valores < $5' : 'Ocultar valores < $5';
      renderTable(getCurrentRows());
      updateSmallNote(getCurrentRows());
    });
  }
}

// =============== Data ===============
async function fetchPortfolio(){
  // Try primary
  let res = await fetch(API_URL, { cache: 'no-cache' });
  if (res.ok) return res.json();

  // If we were on Firebase and rewrite failed for some reason, try direct CF
  if (ON_FIREBASE) {
    res = await fetch(CF_URL, { cache: 'no-cache' });
    if (res.ok) return res.json();
  }

  // Surface the original error
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

      // If priceUSDT missing but we have total value and qty, derive it.
      if ((!priceU || priceU <= 0) && qty > 0 && valU > 0) priceU = valU / qty;

      // Keep per-unit price in a map for reuse by manual assets
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

// =============== Render ===============
let _latestCombinedRows = [];

async function renderAll(generatedAt){
  // Compute manual values with auto price
  const manualWithValues = await Promise.all(manualAssets.map(async m => {
    const { price, source: priceSource } = await getUsdPriceForSymbol(m.asset);
    const valUSDT = (price > 0 && m.quantity > 0) ? (m.quantity * price) : 0;
    const valEUR  = usdtToEurRate ? (valUSDT * usdtToEurRate) : 0;
    return { ...m, valueUSDT: valUSDT, valueEUR: valEUR, priceUSDT: price, priceSource };
  }));

  // Combine rows: Binance first, then manual
  const combined = [
    ...binanceRows.map(r => ({ ...r, location: savedLocations.get(r.asset) || '' })),
    ...manualWithValues
  ].sort((a,b) => (b.valueEUR || 0) - (a.valueEUR || 0));

  _latestCombinedRows = combined;

  renderKpis(combined, generatedAt);
  renderTable(combined);
  updateSmallNote(combined);
}

function getCurrentRows(){
  return _latestCombinedRows || [];
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

  // Apply small-value filter for display only
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
      r.priceSource === 'binance'
        ? '<span title="Price from Binance">ⓘ</span>'
        : r.priceSource === 'coingecko'
        ? '<span title="Price from CoinGecko">ⓘ</span>'
        : '';

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

  // ---- Bind handlers (inside renderTable) ----
  // Autosave location (Binance -> cryptoportfolio, Manual -> cryptoportfolio_manual)
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

  // Edit/Delete for manual rows
  $$('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openModalForEdit(btn.getAttribute('data-edit')));
  });
  $$('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const asset = btn.getAttribute('data-del');
      if (!confirm(`Delete manual asset ${asset}?`)) return;
      await deleteManual(asset);
      await loadManualAssets();
      await renderAll(); // re-render totals
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

// =============== Firestore ops ===============
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

// manual assets live in 'cryptoportfolio_manual'
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

// =============== Modal (Add/Edit) ===============
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
  $('#m-asset').disabled = true; // editing keeps same id
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
  await renderAll(); // recalc totals with new price
}

// =============== Utils ===============
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));


/* =============== PDF Export =============== */
function setupPdfButton() {
  const btn = document.getElementById('btn-pdf');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const rows = getCurrentRows();
    if (!rows.length) {
      alert('Sem dados para exportar.');
      return;
    }

    // Cria documento
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });


    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;

    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório de Portefólio Cripto', pageWidth / 2, y, { align: 'center' });
    y += 20;

    // Data de geração
    const dataStr = new Date().toLocaleString('pt-PT');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${dataStr}`, pageWidth - 40, y, { align: 'right' });
    y += 20;

    // Cabeçalho da tabela
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Ativo', 40, y);
    doc.text('Qtd', 120, y);
    doc.text('USD', 240, y);
    doc.text('EUR', 320, y);
    doc.text('Localização', 420, y);
    y += 10;
    doc.line(40, y, pageWidth - 40, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Linhas
    const displayRows = hideSmall
      ? rows.filter(r => (r.valueUSDT || 0) >= SMALL_USD_THRESHOLD)
      : rows;

    for (const r of displayRows) {
      if (y > 760) { // Nova página se necessário
        doc.addPage();
        y = 40;
      }
      doc.text(r.asset, 40, y);
      doc.text(nfQty.format(r.quantity), 120, y, { align: 'left' });
      doc.text(`$${nfUSD.format(r.valueUSDT || 0)}`, 240, y, { align: 'left' });
      doc.text(`${nfEUR.format(r.valueEUR || 0)}`, 320, y, { align: 'left' });
      doc.text(r.location || '', 420, y, { align: 'left' });
      y += 14;
    }

    y += 20;
    const totalEUR  = rows.reduce((s,r)=> s + (r.valueEUR  || 0), 0);
    const totalUSDT = rows.reduce((s,r)=> s + (r.valueUSDT || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total:  $${nfUSD.format(totalUSDT)}   (${nfEUR.format(totalEUR)})`, 40, y);

    // Guarda ficheiro
    const filename = `Crypto_Portfolio_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
  });
}

// Ativar após render inicial
document.addEventListener('DOMContentLoaded', setupPdfButton);



}
