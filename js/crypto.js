// js/crypto.js
// KISS page: pull positions from Function, show Asset / Qty / Value (USDT/EUR) / Location dropdown.
// Autosave Location to Firestore collection "cryptoportfolio" with doc id = asset symbol.
// Uses your site's styles.css; table text is centered via page-scoped CSS.

const isLocal = location.hostname === 'localhost' || location.hostname.startsWith('127.');
const API_URL = isLocal
  ? 'https://europe-west1-apartments-a4b17.cloudfunctions.net/binancePortfolio'
  : '/api/portfolio';

// --- Intl formatters
const nfQty   = new Intl.NumberFormat('en-PT', { maximumFractionDigits: 8 });
const nfEUR   = new Intl.NumberFormat('en-PT', { style:'currency', currency:'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfUSDT  = new Intl.NumberFormat('en-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Hide delisted/noise if desired
const HIDE_SYMBOLS = new Set(['NEBL','ETHW']);

// Dropdown choices
const LOCATION_CHOICES = [
  'Binance Spot',
  'Binance Earn Flexible',
  'Binance Staking',
  'Binance Earn',
  'Other'
];

// ---- Firestore (match your caixa.js pattern) ----
import { db } from './script.js';
import {
  collection, doc, getDocs, setDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let savedLocations = new Map();

document.addEventListener('DOMContentLoaded', () => { init(); });

async function init(){
  try {
    await loadSavedLocations();
    const data = await fetchPortfolio();
    const view = normalize(data);

    renderKpis(view);
    renderTable(view.rows);
    renderTotals(view.rows);

    const d = data?.generatedAt ? new Date(data.generatedAt) : null;
    $('#stamp').textContent = d ? `Generated at: ${d.toLocaleString('pt-PT')}` : '';
  } catch (e) {
    $('#rows').innerHTML = `<tr><td colspan="6" class="text-muted">Error: ${e.message}</td></tr>`;
  }
}

async function fetchPortfolio(){
  const r = await fetch(API_URL, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

function normalize(api){
  const positions = Array.isArray(api?.positions) ? api.positions : [];

  const rows = positions
    .map(p => ({
      asset: String(p.asset || '').toUpperCase(),
      quantity: Number(p.quantity || 0),
      valueUSDT: Number(p.valueUSDT || 0),
      valueEUR: Number(p.valueEUR || 0),
    }))
    .filter(r => !HIDE_SYMBOLS.has(r.asset))
    .filter(r => (r.valueUSDT || 0) >= 5)   // hide positions worth less than $5
    .sort((a,b) => (b.valueEUR || 0) - (a.valueEUR || 0));


  const totalEUR  = rows.reduce((s,r) => s + (r.valueEUR  || 0), 0);
  const totalUSDT = rows.reduce((s,r) => s + (r.valueUSDT || 0), 0);

  return { rows, totalEUR, totalUSDT, generatedAt: api?.generatedAt };
}

function renderKpis(view){
  $('#kpiTotalEUR').textContent  = nfEUR.format(view.totalEUR || 0);
  $('#kpiTotalUSDT').textContent = `${nfUSDT.format(view.totalUSDT || 0)} USDT`;
  $('#kpiStamp').textContent     = view.generatedAt ? new Date(view.generatedAt).toLocaleString('pt-PT') : '—';
}

function renderTable(rows){
  const tbody = $('#rows');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">No data</td></tr>`;
    return;
  }

  const html = rows.map(r => {
    const sel = locationSelectHtml(r.asset, savedLocations.get(r.asset));
    return `
      <tr data-asset="${escapeHtml(r.asset)}">
        <td><b>${escapeHtml(r.asset)}</b></td>
        <td>${nfQty.format(r.quantity)}</td>
        <td>$${nfUSDT.format(r.valueUSDT)}</td>
        <td>${nfEUR.format(r.valueEUR)}</td>
        <td>${sel}</td>
        <td class="status" id="status-${escapeHtml(r.asset)}"></td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;

  // Bind autosave handlers
  $$('select[data-asset]').forEach(el => {
    el.addEventListener('change', async (e) => {
      const asset = e.target.getAttribute('data-asset');
      const value = e.target.value;
      await saveLocation(asset, value);
    });
  });
}

function renderTotals(rows){
  const totalQty   = rows.reduce((s,r)=> s + (r.quantity || 0), 0);
  const totalUSDT  = rows.reduce((s,r)=> s + (r.valueUSDT || 0), 0);
  const totalEUR   = rows.reduce((s,r)=> s + (r.valueEUR  || 0), 0);

  $('#ft-qty').textContent  = nfQty.format(totalQty);
  $('#ft-usdt').textContent = `$${nfUSDT.format(totalUSDT)}`;
  $('#ft-eur').textContent  = nfEUR.format(totalEUR);
}

function locationSelectHtml(asset, selected){
  const opts = LOCATION_CHOICES.map(v => {
    const sel = v === (selected || '') ? 'selected' : '';
    return `<option value="${escapeHtml(v)}" ${sel}>${escapeHtml(v)}</option>`;
  }).join('');
  return `<select class="location-select" data-asset="${escapeHtml(asset)}">${opts}</select>`;
}

// ----- Firestore persistence -----
async function loadSavedLocations(){
  savedLocations = new Map();
  const snap = await getDocs(collection(db, 'cryptoportfolio'));
  snap.forEach(docSnap => {
    const id = docSnap.id;
    const loc = docSnap.data()?.location || null;
    if (id && typeof loc === 'string') savedLocations.set(id.toUpperCase(), loc);
  });
}

async function saveLocation(asset, location){
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

// ----- utils -----
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
