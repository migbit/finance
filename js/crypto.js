// js/crypto.js  — KISS version with global Investido + Realizado = Total - Investido

/* ================== CONSTANTS & CONFIG ================== */
const CONFIG = {
  HOST: location.hostname,
  ON_FIREBASE: /\.web\.app$/.test(location.hostname) || /firebaseapp\.com$/.test(location.hostname),
  CF_URL: 'https://europe-west1-apartments-a4b17.cloudfunctions.net/binancePortfolio',
  API_URL: null, // set in init
  SMALL_USD_THRESHOLD: 5,
  HIDE_SYMBOLS: new Set(['NEBL','ETHW']),
  LOCATION_CHOICES: [
    'Binance Spot',
    'Binance Earn Flexible',
    'Binance Staking',
    'Binance Earn',
    'Ledger',
    'Other'
  ],
  COINGECKO: {
    PRICE_TTL_MS: 1000 * 60 * 60, // 1 hour
    BATCH_SIZE: 25,
    RETRY_DELAYS: [0, 500, 1000],
    RATE_LIMIT_DELAY: 1200
  },
  META_COLLECTION: 'cryptoportfolio_meta',
  META_DOC: 'invested', // stores investedUSD, investedEUR
  INVESTMENTS_COLLECTION: 'cryptoportfolio_investments', // stores individual investments
  MONTHLY_REALIZED_COLLECTION: 'cryptoportfolio_monthly_realized' // stores monthly realized values
};

CONFIG.API_URL = CONFIG.ON_FIREBASE ? '/api/portfolio' : CONFIG.CF_URL;

/* ================== FORMATTERS ================== */
const FORMATTERS = {
  quantity: new Intl.NumberFormat('en-PT', { maximumFractionDigits: 8 }),
  eur: new Intl.NumberFormat('en-PT', { style: 'currency', currency: 'EUR' }),
  usd: new Intl.NumberFormat('en-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
};

/* ================== DOM UTILS ================== */
const DOM = {
  $: (sel) => document.querySelector(sel),
  $$: (sel) => Array.from(document.querySelectorAll(sel)),
  show: (el) => el && (el.style.display = 'flex'),
  hide: (el) => el && (el.style.display = 'none'),
  enable: (el) => el && (el.disabled = false),
  disable: (el) => el && (el.disabled = true)
};

/* ================== STORAGE (for CoinGecko cache) ================== */
const Storage = {
  PREFIXES: { PRICE: 'price_usd_', COINGECKO_ID: 'cg_id_' },
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k,v) => { try { localStorage.setItem(k,v); return true; } catch { return false; } },
  getJSON(k){ const s=this.get(k); try {return s?JSON.parse(s):null;} catch {return null;} },
  setJSON(k,v){ return this.set(k, JSON.stringify(v)); }
};

/* ================== API SERVICE ================== */
class ApiService {
  static async fetchPortfolio() {
    const tries = [CONFIG.API_URL, CONFIG.CF_URL];
    for (const url of tries) {
      if (!url) continue;
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) return await res.json();
      } catch {}
    }
    throw new Error('HTTP 404');
  }
  static async fetchWithRetry(url, opt={}, max=3){
    for (let i=0;i<max;i++){
      try {
        if (i>0) await new Promise(r=>setTimeout(r, [0,500,1000][i]||500));
        const res = await fetch(url, opt);
        if (res.status===429){ await new Promise(r=>setTimeout(r, 900+Math.random()*600)); continue; }
        if (res.ok) return res;
      } catch {}
    }
    throw new Error(`Failed ${url}`);
  }
}

/* ================== COINGECKO ================== */
class Coingecko {
  static isFresh(p){ return p && p.usd>0 && (Date.now()-p.ts)<CONFIG.COINGECKO.PRICE_TTL_MS; }

  static async resolveId(symbol){
    const key = Storage.PREFIXES.COINGECKO_ID + symbol.toUpperCase();
    const cached = Storage.get(key);
    if (cached) return cached;

    const r = await ApiService.fetchWithRetry(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`);
    const data = await r.json();
    const coins = data?.coins || [];
    const exact = coins.find(c=>c.symbol?.toUpperCase()===symbol.toUpperCase());
    const sw = coins.find(c=>c.symbol?.toUpperCase().startsWith(symbol.toUpperCase()));
    const id = exact?.id || sw?.id || coins[0]?.id || null;
    if (id) Storage.set(key, id);
    return id;
  }

  static async fetchUSD(id){
    const r = await ApiService.fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`);
    const j = await r.json();
    return Number(j?.[id]?.usd || 0);
  }

  static async prefetch(symbols){
    const toFetch = [];
    for (const s of symbols){
      const up = s.toUpperCase();
      const cached = Storage.getJSON(Storage.PREFIXES.PRICE + up);
      if (!this.isFresh(cached)) toFetch.push(up);
    }
    // resolve ids
    const pairs = [];
    for (const s of toFetch){
      const id = await this.resolveId(s);
      if (id) pairs.push([s,id]);
      await new Promise(r=>setTimeout(r, CONFIG.COINGECKO.RATE_LIMIT_DELAY));
    }
    // batch prices
    const ids = pairs.map(p=>p[1]);
    for (let i=0;i<ids.length;i+=CONFIG.COINGECKO.BATCH_SIZE){
      const batch = ids.slice(i,i+CONFIG.COINGECKO.BATCH_SIZE);
      const r = await ApiService.fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${batch.join(',')}&vs_currencies=usd`);
      const data = await r.json();
      for (const [sym,id] of pairs){
        const price = Number(data?.[id]?.usd || 0);
        if (price>0) Storage.setJSON(Storage.PREFIXES.PRICE + sym, { usd:price, ts:Date.now() });
      }
      await new Promise(r=>setTimeout(r, CONFIG.COINGECKO.RATE_LIMIT_DELAY));
    }
  }

  static getCachedUSD(symbol){
    const up = symbol.toUpperCase();
    const c = Storage.getJSON(Storage.PREFIXES.PRICE + up);
    return this.isFresh(c) ? c.usd : 0;
  }
}

/* ================== PRICE RESOLVER ================== */
class PriceResolver {
  constructor(binancePriceMap){ this.binancePriceMap = binancePriceMap; }
  async getUSD(symbol){
    const up = symbol.toUpperCase();
    if (this.binancePriceMap.has(up)) return { price: this.binancePriceMap.get(up), src: 'binance' };
    const cached = Coingecko.getCachedUSD(up);
    if (cached>0) return { price: cached, src:'coingecko' };
    const id = await Coingecko.resolveId(up);
    if (!id) return { price:0, src:'unknown' };
    const p = await Coingecko.fetchUSD(id);
    if (p>0) Storage.setJSON(Storage.PREFIXES.PRICE+up, {usd:p, ts:Date.now()});
    return { price:p, src:'coingecko' };
  }
}

/* ================== FIREBASE SERVICE ================== */
import { db } from './script.js';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

class FirebaseService {
  static async getCollection(name){
    const snap = await getDocs(collection(db, name));
    return snap.docs.map(d=>({id:d.id, ...d.data()}));
  }
  static async getDocument(name, id){
    const ref = doc(db, name, id);
    const snap = await getDoc(ref);
    return snap.exists()? {id: snap.id, ...snap.data()} : null;
  }
  static async setDocument(name, id, data){
    const ref = doc(db, name, id);
    await setDoc(ref, {...data, updatedAt: new Date()}, { merge:true });
  }
  static async deleteDocument(name, id){
    await deleteDoc(doc(db, name, id));
  }
}

/* ================== APP STATE ================== */
class AppState {
  constructor(){
    this.savedLocations = new Map(); // Binance positions -> location
    this.manualAssets = [];
    this.binanceRows = [];
    this.binancePriceMap = new Map();
    this.usdtToEurRate = 0;

    this.hideSmall = true;
    this.currentRows = [];
    this.currency = 'EUR';

    // Invested (global)
    this.investedUSD = 0;
    this.investedEUR = 0;
    
    // Individual investments per asset { assetSymbol: [{amount, currency, date, id}, ...] }
    this.investments = new Map();
    
    // Monthly realized data for chart
    this.monthlyRealized = [];
    
    // Chart instances
    this.trendChart = null;
    this.expandedChart = null;
    
    // Modal currency for add crypto
    this.modalCurrency = 'EUR';
  }

  get visibleRows(){
    return this.hideSmall
      ? this.currentRows.filter(r => (r.valueUSDT||0) >= CONFIG.SMALL_USD_THRESHOLD)
      : this.currentRows;
  }

  get totals(){
    return this.currentRows.reduce((t,r)=>({
      eur: t.eur + (r.valueEUR||0),
      usdt: t.usdt + (r.valueUSDT||0)
    }), {eur:0, usdt:0});
  }
}

/* ================== MAIN APP ================== */
class CryptoPortfolioApp {
  constructor(){
    this.state = new AppState();
    this.priceResolver = null;
    this.initialized = false;
  }

  async init(){
    if (this.initialized) return;
    CONFIG.API_URL = CONFIG.ON_FIREBASE ? '/api/portfolio' : CONFIG.CF_URL;

    try {
      await Promise.all([
        this.loadSavedLocations(),
        this.loadManualAssets(),
        this.loadInvested(),
        this.loadInvestments(),
        this.loadMonthlyRealized()
      ]);
      const api = await ApiService.fetchPortfolio();
      this.state.binanceRows = this.normalizeBinance(api);

      // FX
      const eur = this.state.binanceRows.reduce((s,r)=>s+(r.valueEUR||0),0);
      const usd = this.state.binanceRows.reduce((s,r)=>s+(r.valueUSDT||0),0);
      this.state.usdtToEurRate = usd>0 ? eur/usd : 0;

      // Prices for manual
      this.priceResolver = new PriceResolver(this.state.binancePriceMap);
      const missing = this.state.manualAssets
        .map(a=>a.asset)
        .filter(sym=>!this.state.binancePriceMap.has(sym));
      if (missing.length) await Coingecko.prefetch(missing);

      await this.renderAll(api.generatedAt);
      this.setupEvents();
      this.checkAndSaveMonthlyRealized();
      this.initialized = true;
    } catch (e) {
      this.showError(e.message || String(e));
    }
  }

  async loadSavedLocations(){
    const locs = await FirebaseService.getCollection('cryptoportfolio');
    this.state.savedLocations = new Map(locs.map(x=>[String(x.id).toUpperCase(), x.location || '']));
  }

  async loadManualAssets(){
    const rows = await FirebaseService.getCollection('cryptoportfolio_manual');
    this.state.manualAssets = rows.map(x=>({
      asset: String(x.asset || x.id || '').toUpperCase(),
      quantity: Number(x.quantity || 0),
      location: x.location || 'Other',
      source: 'manual'
    }));
  }

  async loadInvested(){
    const doc = await FirebaseService.getDocument(CONFIG.META_COLLECTION, CONFIG.META_DOC);
    if (doc){
      this.state.investedUSD = Number(doc.investedUSD || 0);
      this.state.investedEUR = Number(doc.investedEUR || 0);
    }
  }

      async loadInvestments(){
      const investments = await FirebaseService.getCollection(CONFIG.INVESTMENTS_COLLECTION);
      this.state.investments.clear();

        for (const inv of investments) {
          const asset = String(inv.asset || '').toUpperCase();
          const loc = String(inv.location || 'Other').toUpperCase();
          const key = `${asset}_${loc}`;
          if (!this.state.investments.has(key)) {
            this.state.investments.set(key, []);
          }
          this.state.investments.get(key).push({
            id: inv.id,
            location: inv.location || 'Other',
            amountUSD: Number(inv.amountUSD || 0),
            amountEUR: Number(inv.amountEUR || 0),
            currency: inv.currency || 'USD',
            date: inv.date || '',
            originalAmount: Number(inv.originalAmount || 0)
          });
          }
      }


  async loadMonthlyRealized(){
    const data = await FirebaseService.getCollection(CONFIG.MONTHLY_REALIZED_COLLECTION);
    this.state.monthlyRealized = data
      .map(d => ({
        month: d.month,
        realizedEUR: Number(d.realizedEUR || 0),
        realizedUSD: Number(d.realizedUSD || 0),
        timestamp: new Date(d.month + '-01').getTime()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async checkAndSaveMonthlyRealized(){
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const t = this.state.totals;
    const totalInv = this.getTotalInvestedAmounts();
    const realizedEUR = (t.eur || 0) - totalInv.eur;
    const realizedUSD = (t.usdt || 0) - totalInv.usd;
    
    await FirebaseService.setDocument(CONFIG.MONTHLY_REALIZED_COLLECTION, currentMonth, {
      month: currentMonth,
      realizedEUR,
      realizedUSD
    });
    
    await this.loadMonthlyRealized();
  }

  getAssetInvestedAmounts(asset, location) {
  const key = `${asset.toUpperCase()}_${(location || 'Other').toUpperCase()}`;
  const investments = this.state.investments.get(key) || [];
  return investments.reduce(
    (acc, inv) => ({
      usd: acc.usd + inv.amountUSD,
      eur: acc.eur + inv.amountEUR
    }),
    { usd: 0, eur: 0 }
  );
  }


  getTotalInvestedAmounts() {
    let totalUSD = 0;
    let totalEUR = 0;
    for (const [asset, investments] of this.state.investments) {
      for (const inv of investments) {
        totalUSD += inv.amountUSD;
        totalEUR += inv.amountEUR;
      }
    }
    return { usd: totalUSD, eur: totalEUR };
  }

  async saveInvested(value, currency){
    const v = Number(value || 0);
    if (!isFinite(v) || v<0) throw new Error('Valor inválido');
    const rate = this.state.usdtToEurRate || 0;

    if (currency === 'EUR') {
      this.state.investedEUR = v;
      this.state.investedUSD = rate>0 ? v / rate : 0;
    } else {
      // USD
      this.state.investedUSD = v;
      this.state.investedEUR = rate>0 ? v * rate : 0;
    }
    await FirebaseService.setDocument(CONFIG.META_COLLECTION, CONFIG.META_DOC, {
      investedUSD: this.state.investedUSD,
      investedEUR: this.state.investedEUR
    });
  }

      // === NOVA FUNÇÃO: adiciona delta ao Investido existente ===
    async addInvestedDelta(delta, currency){
      const rate = this.state.usdtToEurRate || 0;

      if (currency === 'EUR') {
        this.state.investedEUR = (this.state.investedEUR || 0) + delta;
        this.state.investedUSD = rate > 0 ? this.state.investedEUR / rate : 0;
      } else {
        this.state.investedUSD = (this.state.investedUSD || 0) + delta;
        this.state.investedEUR = rate > 0 ? this.state.investedUSD * rate : 0;
      }

      await FirebaseService.setDocument('cryptoportfolio_meta', 'invested', {
        investedUSD: this.state.investedUSD,
        investedEUR: this.state.investedEUR
      });
    }


  normalizeBinance(api){
    const pos = Array.isArray(api?.positions)? api.positions : [];
    return pos
      .map(p=>{
        const asset = String(p.asset||'').toUpperCase();
        const qty = Number(p.quantity||0);
        let priceUSDT = Number(p.priceUSDT||0);
        const vUSDT = Number(p.valueUSDT||0);
        const vEUR  = Number(p.valueEUR||0);
        if ((!priceUSDT || priceUSDT<=0) && qty>0 && vUSDT>0) priceUSDT = vUSDT/qty;
        if (priceUSDT>0) this.state.binancePriceMap.set(asset, priceUSDT);
        return { asset, quantity:qty, valueUSDT:vUSDT, valueEUR:vEUR, priceUSDT, source:'binance' };
      })
      .filter(r=>!CONFIG.HIDE_SYMBOLS.has(r.asset))
      .filter(r=>(r.valueEUR||r.valueUSDT||0)>0)
      .sort((a,b)=>(b.valueEUR||0)-(a.valueEUR||0));
  }

  async renderAll(generatedAt){
    // compute manual values
    const manualVal = await Promise.all(this.state.manualAssets.map(async m=>{
      const { price } = await this.priceResolver.getUSD(m.asset);
      const vUSDT = price>0 ? price * m.quantity : 0;
      const vEUR = (this.state.usdtToEurRate||0) ? vUSDT * this.state.usdtToEurRate : 0;
      return { ...m, valueUSDT: vUSDT, valueEUR: vEUR, priceUSDT: price, priceSource: 'coingecko' };
    }));

    // merge
    this.state.currentRows = [
      ...this.state.binanceRows.map(r=>({ ...r, location: this.state.savedLocations.get(r.asset)||'' })),
      ...manualVal
    ].sort((a,b)=>(b.valueEUR||0)-(a.valueEUR||0));

    this.renderKPIs(generatedAt);
    this.renderTable();
    this.updateSmallNote();
  }

  /* ================== KPIs ================== */
      renderKPIs(generatedAt){
      const t = this.state.totals;
      const totalInv = this.getTotalInvestedAmounts();
      const investedEUR = totalInv.eur;
      const investedUSD = totalInv.usd;

      const realizedEUR = (t.eur || 0) - investedEUR;
      const realizedUSD = (t.usdt || 0) - investedUSD;

      // 1st KPI: Total (EUR primary, USD underneath)
      const kEUR = document.getElementById('kpiTotalEUR');
      const kUSD = document.getElementById('kpiTotalUSD');
      if (kEUR) kEUR.textContent = FORMATTERS.eur.format(t.eur || 0);
      if (kUSD) kUSD.textContent = `$${FORMATTERS.usd.format(t.usdt || 0)}`;

      // 2nd KPI: Realizado (EUR primary, USD underneath, with colors)
      const kRealEUR = document.getElementById('kpiRealizedEUR');
      const kRealUSD = document.getElementById('kpiRealizedUSD');
      if (kRealEUR){
        const sign = realizedEUR >= 0 ? '+' : '−';
        kRealEUR.textContent = `${sign}${FORMATTERS.eur.format(Math.abs(realizedEUR))}`;
        kRealEUR.classList.toggle('pos', realizedEUR >= 0);
        kRealEUR.classList.toggle('neg', realizedEUR < 0);
      }
      if (kRealUSD){
        const sign = realizedUSD >= 0 ? '+' : '−';
        kRealUSD.textContent = `${sign}$${FORMATTERS.usd.format(Math.abs(realizedUSD))}`;
        kRealUSD.classList.toggle('pos', realizedUSD >= 0);
        kRealUSD.classList.toggle('neg', realizedUSD < 0);
      }

      // 3rd KPI: Investido (EUR primary, USD underneath)
      const kINV  = document.getElementById('kpiInvested');
      const kINVs = document.getElementById('kpiInvestedSub');
      if (kINV)  kINV.textContent  = FORMATTERS.eur.format(investedEUR);
      if (kINVs) kINVs.textContent = `$${FORMATTERS.usd.format(investedUSD)}`;

      // 4th KPI: Trend chart
      this.renderTrendChart();
    }



  renderTrendChart(){
    const canvas = document.getElementById('kpi-trend-chart');
    if (!canvas) return;

    // Get last 12 months of data
    const last12 = this.state.monthlyRealized.slice(-12);
    const labels = last12.map(d => {
      const [year, month] = d.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
    });
    const dataEUR = last12.map(d => d.realizedEUR);

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: dataEUR,
          borderColor: '#526D82',
          backgroundColor: 'rgba(82, 109, 130, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
  }


  /* ================== TABLE ================== */
    renderTable(){
      const tbody = DOM.$('#rows');
      if (!tbody) return;

      const vis = this.state.visibleRows;
      if (!vis.length){
        tbody.innerHTML = '<tr><td colspan="9" class="text-muted">No data to display</td></tr>';
        this.applyCurrencyMode();
        return;
      }

      const esc = s=>String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m]));

      // group by asset
      const groups = new Map();
      for (const row of vis){
        const a = (row.asset||'').toUpperCase();
        if (!groups.has(a)) groups.set(a, []);
        groups.get(a).push(row);
      }
      const assets = Array.from(groups.keys()).sort((a,b)=>{
        const sum = sym => groups.get(sym).reduce((s,x)=>s+(x.valueEUR||0),0);
        return sum(b)-sum(a);
      });

      let html = '';
      for (const asset of assets){
        const rows = groups.get(asset).sort((x,y)=>(y.valueEUR||0)-(x.valueEUR||0));

        // Get invested amounts for this asset
        // linhas individuais
        for (const r of rows){
        const invested = this.getAssetInvestedAmounts(r.asset, r.location);

        const actions = r.source==='manual'
          ? `<button class="btn btn-invest" data-invest="${esc(r.asset)}" data-location="${esc(r.location)}">+</button>
              <button class="btn btn-sell" data-sell="${esc(r.asset)}" data-location="${esc(r.location)}">-</button>
              <button class="btn btn-edit" data-edit="${esc(r.asset)}">Edit</button>
              <button class="btn btn-del" data-del="${esc(r.asset)}">Delete</button>`
          : `<button class="btn btn-invest" data-invest="${esc(r.asset)}" data-location="${esc(r.location)}">+</button>
              <button class="btn btn-sell" data-sell="${esc(r.asset)}" data-location="${esc(r.location)}">-</button>
              <span class="status" id="status-${esc(r.asset)}"></span>`;

        const sel = this.renderLocationSelect(r.asset, r.location);

        // Calculate realized (profit/loss) = current value - invested (per location)
        const realizedUSD = (r.valueUSDT || 0) - invested.usd;
        const realizedEUR = (r.valueEUR || 0) - invested.eur;
        const realizedColor = (this.state.currency === 'EUR' ? realizedEUR : realizedUSD) >= 0 ? 'green' : 'red';
        const realizedSign = (this.state.currency === 'EUR' ? realizedEUR : realizedUSD) >= 0 ? '+' : '';
        const realizedValue = this.state.currency === 'EUR' 
          ? `${realizedSign}${FORMATTERS.eur.format(realizedEUR)}`
          : `${realizedSign}$${FORMATTERS.usd.format(realizedUSD)}`;

        html += `
          <tr data-asset="${esc(r.asset)}" data-source="${esc(r.source||'')}">
            <td><b>${esc(r.asset)}</b></td>
            <td class="col-qty">${FORMATTERS.quantity.format(r.quantity)}</td>
            <td class="col-usd">$${FORMATTERS.usd.format(r.valueUSDT||0)}</td>
            <td class="col-eur">${FORMATTERS.eur.format(r.valueEUR||0)}</td>
            <td class="col-invested-usd">$${FORMATTERS.usd.format(invested.usd)}</td>
            <td class="col-invested-eur">${FORMATTERS.eur.format(invested.eur)}</td>
            <td class="col-realized" style="color: ${realizedColor}; font-weight: 600;">${realizedValue}</td>
            <td class="col-loc">${sel}</td>
            <td>${actions}</td>
          </tr>
        `;
      }

      // subtotal (quando há várias localizações)
      if (rows.length > 1){
        const totalQty = rows.reduce((s,x)=>s+(x.quantity||0),0);
        const totalUSD = rows.reduce((s,x)=>s+(x.valueUSDT||0),0);
        const totalEUR = rows.reduce((s,x)=>s+(x.valueEUR||0),0);

        // Somar investido por localização
        const investedSubtotal = rows.reduce((acc, row) => {
          const inv = this.getAssetInvestedAmounts(row.asset, row.location);
          return { usd: acc.usd + inv.usd, eur: acc.eur + inv.eur };
        }, { usd: 0, eur: 0 });

        const realizedUSD = totalUSD - investedSubtotal.usd;
        const realizedEUR = totalEUR - investedSubtotal.eur;
        const realizedColor = (this.state.currency === 'EUR' ? realizedEUR : realizedUSD) >= 0 ? 'green' : 'red';
        const realizedSign = (this.state.currency === 'EUR' ? realizedEUR : realizedUSD) >= 0 ? '+' : '';
        const realizedValue = this.state.currency === 'EUR' 
          ? `${realizedSign}${FORMATTERS.eur.format(realizedEUR)}`
          : `${realizedSign}$${FORMATTERS.usd.format(realizedUSD)}`;

        html += `
          <tr class="subtotal-row" data-asset="${esc(asset)}" data-subtotal="1">
            <td>Total ${esc(asset)}</td>
            <td class="col-qty">${FORMATTERS.quantity.format(totalQty)}</td>
            <td class="col-usd">$${FORMATTERS.usd.format(totalUSD)}</td>
            <td class="col-eur">${FORMATTERS.eur.format(totalEUR)}</td>
            <td class="col-invested-usd">$${FORMATTERS.usd.format(investedSubtotal.usd)}</td>
            <td class="col-invested-eur">${FORMATTERS.eur.format(investedSubtotal.eur)}</td>
            <td class="col-realized" style="color: ${realizedColor}; font-weight: 600;">${realizedValue}</td>
            <td class="col-loc"></td>
            <td></td>
          </tr>
        `;
      }     
      }

      tbody.innerHTML = html;

      // === Mostrar data de geração ===
      const stampDivId = 'table-stamp';
      let stampDiv = document.getElementById(stampDivId);
      if (!stampDiv) {
        stampDiv = document.createElement('div');
        stampDiv.id = stampDivId;
        stampDiv.className = 'table-stamp';
        tbody.parentElement.insertAdjacentElement('afterend', stampDiv);
      }
      if (this.state.generatedAt) {
        const d = new Date(this.state.generatedAt);
        stampDiv.textContent = `Gerado em: ${d.toLocaleString('pt-PT')}`;
      }


      this.bindTableEvents();
      this.applyCurrencyMode();
    }


  renderLocationSelect(asset, selected){
    const opts = CONFIG.LOCATION_CHOICES.map(loc =>
      `<option value="${this.escape(asset, loc)}" ${loc === (selected||'') ? 'selected':''}>${this.escape(asset, loc, true)}</option>`
    ).join('');
    return `<select class="location-select" data-asset="${this.escapeHtml(asset)}">${opts}</select>`;
  }
  escape(asset, s, textOnly=false){
    const t = String(s||'');
    return textOnly ? t.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m]))
                    : t.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m]));
  }
  escapeHtml(s){ return this.escape('', s, true); }

  /* ================== UI HELPERS ================== */
  applyCurrencyMode(){
    const show = (sel,on)=>document.querySelectorAll(sel).forEach(el=>{el.style.display = on?'':'none';});
    const showEUR = this.state.currency==='EUR';
    const showUSD = this.state.currency==='USD';
    show('th.col-usd, td.col-usd', showUSD);
    show('th.col-eur, td.col-eur', showEUR);
    show('th.col-invested-usd, td.col-invested-usd', showUSD);
    show('th.col-invested-eur, td.col-invested-eur', showEUR);

    // update invested box (displayed in selected currency)
    const totalInv = this.getTotalInvestedAmounts();
    const kINV = DOM.$('#kpiInvested');
    if (kINV){
      if (this.state.currency==='EUR') kINV.textContent = FORMATTERS.eur.format(totalInv.eur);
      else kINV.textContent = `$${FORMATTERS.usd.format(totalInv.usd)}`;
    }
    // update totals with realized
    this.renderKPIs(); // refresh signs/values
  }

  updateSmallNote(){
    const note = DOM.$('#small-note');
    if (!note) return;
    const hidden = this.state.currentRows.filter(r=>(r.valueUSDT||0)<CONFIG.SMALL_USD_THRESHOLD).length;
    if (this.state.hideSmall && hidden>0) note.textContent = `A ocultar ${hidden} posições com valor < $${CONFIG.SMALL_USD_THRESHOLD}.`;
    else note.textContent = '';
  }

  /* ================== EVENTS ================== */
  setupEvents(){
    // Toggle small assets
    DOM.$('#btn-toggle-small')?.addEventListener('click', ()=>{
      this.state.hideSmall = !this.state.hideSmall;
      const btn = DOM.$('#btn-toggle-small');
      if (btn) btn.textContent = this.state.hideSmall ? 'Mostrar valores < $5' : 'Mostrar apenas ≥ $5';
      this.renderTable();
      this.updateSmallNote();
    });

    // Add / Edit modal
    this.setupModal();
    
    // Investment modal
    this.setupInvestmentModal();
    
    // Sell modal
    this.setupSellModal();
    
    // Chart modal
    this.setupChartModal();

    // PDF
    this.setupPdf();

    // Currency toggle
    const btnEUR = DOM.$('#btn-eur');
    const btnUSD = DOM.$('#btn-usd');
    if (btnEUR && btnUSD){
      const setActive = (on,off)=>{ on.classList.add('active'); off.classList.remove('active'); };
      btnEUR.addEventListener('click', ()=>{
        this.state.currency='EUR';
        setActive(btnEUR, btnUSD);
        this.applyCurrencyMode();
      });
      btnUSD.addEventListener('click', ()=>{
        this.state.currency='USD';
        setActive(btnUSD, btnEUR);
        this.applyCurrencyMode();
      });
    }
  }

  /* ===== Modal Add/Edit manual asset ===== */
  setupModal(){
    const modal = DOM.$('#modal-backdrop');
    const locSelect = DOM.$('#m-loc');
    if (locSelect){
      locSelect.innerHTML = CONFIG.LOCATION_CHOICES.map(l=>`<option value="${this.escapeHtml(l)}">${this.escapeHtml(l)}</option>`).join('');
    }
    
    // Currency toggle
    const btnEUR = DOM.$('#m-curr-eur');
    const btnUSD = DOM.$('#m-curr-usd');
    if (btnEUR && btnUSD) {
      btnEUR.addEventListener('click', () => {
        this.modalCurrency = 'EUR';
        btnEUR.classList.add('active');
        btnUSD.classList.remove('active');
      });
      btnUSD.addEventListener('click', () => {
        this.modalCurrency = 'USD';
        btnUSD.classList.add('active');
        btnEUR.classList.remove('active');
      });
    }
    
    DOM.$('#btn-add')?.addEventListener('click', ()=>this.openAddModal());
    DOM.$('#m-cancel')?.addEventListener('click', ()=>this.closeModal());
    DOM.$('#m-save')?.addEventListener('click', ()=>this.saveModal());
    modal?.addEventListener('click', (e)=>{ if (e.target===modal) this.closeModal(); });
  }

  /* ===== Investment Modal ===== */
  setupInvestmentModal(){
    const modal = DOM.$('#investment-modal-backdrop');
    DOM.$('#inv-close')?.addEventListener('click', ()=>this.closeInvestmentModal());
    DOM.$('#inv-add-btn')?.addEventListener('click', ()=>this.addInvestment());
    modal?.addEventListener('click', (e)=>{ if (e.target===modal) this.closeInvestmentModal(); });
    
    // Set default date to today
    const dateInput = DOM.$('#inv-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }

  openInvestmentModal(asset, location){
  this.currentInvestmentAsset = asset.toUpperCase();
  this.currentInvestmentLocation = (location || 'Other');
  DOM.$('#inv-asset-name').textContent = `${this.currentInvestmentAsset} — ${this.currentInvestmentLocation}`;
  this.renderInvestmentList();
  DOM.show(DOM.$('#investment-modal-backdrop'));
  }


  closeInvestmentModal(){
    DOM.hide(DOM.$('#investment-modal-backdrop'));
    this.currentInvestmentAsset = null;
  }

  renderInvestmentList(){
    const list = DOM.$('#investment-list');
    if (!list) return;

    const key = `${(this.currentInvestmentAsset||'').toUpperCase()}_${(this.currentInvestmentLocation||'Other').toUpperCase()}`;
    const investments = this.state.investments.get(key) || [];

 
    if (investments.length === 0) {
      list.innerHTML = '<p style="color: #6b7280; font-size: 0.9rem; padding: 12px; text-align: center;">Nenhum investimento registrado</p>';
      return;
    }

    // Sort by date (most recent first)
    const sorted = [...investments].sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = sorted.map(inv => {
      const displayAmount = inv.currency === 'EUR' 
        ? FORMATTERS.eur.format(inv.originalAmount)
        : `$${FORMATTERS.usd.format(inv.originalAmount)}`;
      const date = new Date(inv.date).toLocaleDateString('pt-PT');
      
      return `
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: white; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600;">${displayAmount}</div>
            <div style="font-size: 0.85rem; color: #6b7280;">${date}</div>
          </div>
          <button class="btn btn-del-inv" data-inv-id="${this.escapeHtml(inv.id)}" style="padding: 4px 8px; font-size: 0.85rem;">Remover</button>
        </div>
      `;
    }).join('');

    // Bind delete buttons
    list.querySelectorAll('.btn-del-inv').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const invId = e.target.getAttribute('data-inv-id');
        await this.deleteInvestment(invId);
      });
    });
  }

  async addInvestment(){
  try {
    const amount = parseFloat(DOM.$('#inv-amount').value);
    const currency = DOM.$('#inv-currency').value;  // 'EUR' | 'USD'
    const date = DOM.$('#inv-date').value;

    const asset = (this.currentInvestmentAsset || '').toUpperCase();
    const location = this.currentInvestmentLocation || 'Other';

    if (!isFinite(amount) || amount < 0) {
      alert('Por favor, insira um valor válido (≥ 0)');
      return;
    }
    if (!date) {
      alert('Por favor, selecione uma data');
      return;
    }

    const rate = this.state.usdtToEurRate || 1;

    // Convert to both currencies
    const amountUSD = (currency === 'EUR') ? (rate > 0 ? amount / rate : 0) : amount;
    const amountEUR = (currency === 'EUR') ? amount : (rate > 0 ? amount * rate : 0);

    const investmentData = {
      asset,
      location,
      amountUSD,
      amountEUR,
      currency,
      originalAmount: amount,
      date
    };

    // Unique ID includes asset + location
    const id = `${asset}_${location}_${Date.now()}`;
    await FirebaseService.setDocument(CONFIG.INVESTMENTS_COLLECTION, id, investmentData);

    // Refresh UI
    await this.loadInvestments();
    this.renderInvestmentList();
    this.renderTable();
    this.renderKPIs();

    // Clear form
    DOM.$('#inv-amount').value = '';
    DOM.$('#inv-date').value = new Date().toISOString().split('T')[0];

  } catch (e) {
    alert('Erro ao adicionar investimento');
    console.error(e);
  }
}


  async deleteInvestment(invId){
    if (!confirm('Remover este investimento?')) return;
    
    try {
      await FirebaseService.deleteDocument(CONFIG.INVESTMENTS_COLLECTION, invId);
      await this.loadInvestments();
      this.renderInvestmentList();
      this.renderTable();
      this.renderKPIs();
    } catch (e) {
      alert('Erro ao remover investimento');
      console.error(e);
    }
  }

  openAddModal(){
    DOM.$('#modal-title').textContent = 'Add asset';
    DOM.$('#m-asset').value = '';
    DOM.$('#m-qty').value = '';
    DOM.$('#m-cost').value = '0';
    DOM.$('#m-loc').value = 'Other';
    this.modalCurrency = 'EUR';
    DOM.$('#m-curr-eur').classList.add('active');
    DOM.$('#m-curr-usd').classList.remove('active');
    DOM.enable(DOM.$('#m-asset'));
    DOM.show(DOM.$('#modal-backdrop'));
    DOM.$('#m-asset').focus();
  }
  openEditModal(asset){
    const row = this.state.manualAssets.find(a=>a.asset===asset);
    DOM.$('#modal-title').textContent = `Edit ${asset}`;
    DOM.$('#m-asset').value = row?.asset || asset;
    DOM.disable(DOM.$('#m-asset'));
    DOM.$('#m-qty').value = row?.quantity || '';
    DOM.$('#m-cost').value = '0';
    DOM.$('#m-loc').value = row?.location || 'Other';
    DOM.show(DOM.$('#modal-backdrop'));
  }
  closeModal(){ 
    DOM.hide(DOM.$('#modal-backdrop')); 
    DOM.enable(DOM.$('#m-asset')); 
  }

  async saveModal(){
    const asset = DOM.$('#m-asset').value.trim().toUpperCase();
    const qty = Number(DOM.$('#m-qty').value || 0);
    const cost = Number(DOM.$('#m-cost').value || 0);
    const loc = DOM.$('#m-loc').value;
    
    if (!asset || !isFinite(qty) || qty<=0){ 
      alert('Asset/quantidade inválidos'); 
      return; 
    }
    
    // Save the asset
    await FirebaseService.setDocument('cryptoportfolio_manual', asset, { 
      asset, 
      quantity: qty, 
      location: loc 
    });
    
    // If cost > 0, add as investment
    if (cost > 0) {
      const rate = this.state.usdtToEurRate || 1;
      let amountUSD, amountEUR;

      if (this.modalCurrency === 'EUR') {
        amountEUR = cost;
        amountUSD = rate > 0 ? cost / rate : 0;
      } else {
        amountUSD = cost;
        amountEUR = rate > 0 ? cost * rate : 0;
      }

      const investmentData = {
        asset,
        location: loc,                 // add location
        amountUSD,
        amountEUR,
        currency: this.modalCurrency,
        originalAmount: cost,
        date: new Date().toISOString().split('T')[0]
      };

      const id = `${asset}_${loc}_${Date.now()}`; // include location in id
      await FirebaseService.setDocument(CONFIG.INVESTMENTS_COLLECTION, id, investmentData);
    }

    
    await this.loadManualAssets();
    await this.loadInvestments();
    this.closeModal();
    await this.renderAll();
  }

  bindTableEvents(){
    // location changes
    DOM.$$('select[data-asset]').forEach(sel=>{
      sel.addEventListener('change', async (e)=>{
        const asset = e.target.getAttribute('data-asset');
        const loc = e.target.value;
        const row = e.target.closest('tr');
        const source = row?.getAttribute('data-source') || 'binance';
        if (source==='manual'){
          await FirebaseService.setDocument('cryptoportfolio_manual', asset, { location: loc });
          await this.loadManualAssets();
        } else {
          await FirebaseService.setDocument('cryptoportfolio', asset, { asset, location: loc });
        }
      });
    });
    // edit/delete
    DOM.$$('.btn-edit').forEach(b=>b.addEventListener('click', ()=>this.openEditModal(b.getAttribute('data-edit'))));
    DOM.$$('.btn-del').forEach(b=>b.addEventListener('click', async ()=>{
      const asset = b.getAttribute('data-del');
      if (!confirm(`Delete ${asset}?`)) return;
      await FirebaseService.deleteDocument('cryptoportfolio_manual', asset);
      await this.loadManualAssets();
      await this.renderAll();
    }));
    // investment
        DOM.$$('.btn-invest').forEach(b=>b.addEventListener('click', ()=>{
          const asset = b.getAttribute('data-invest');
          const location = b.getAttribute('data-location') || '';
          this.openInvestmentModal(asset, location);
       }));

    // sell
    DOM.$$('.btn-sell').forEach(b=>b.addEventListener('click', ()=>{
      const asset = b.getAttribute('data-sell');
      const location = b.getAttribute('data-location');
      this.openSellModal(asset, location);
    }));
  }

  /* ===== Sell Modal ===== */
  setupSellModal(){
    const modal = DOM.$('#sell-modal-backdrop');
    DOM.$('#sell-cancel')?.addEventListener('click', ()=>this.closeSellModal());
    DOM.$('#sell-confirm')?.addEventListener('click', ()=>this.confirmSell());
    modal?.addEventListener('click', (e)=>{ if (e.target===modal) this.closeSellModal(); });
  }

  openSellModal(asset, location){
    this.currentSellAsset = asset.toUpperCase();
    this.currentSellLocation = location;
    
    DOM.$('#sell-asset-name').textContent = this.currentSellAsset;
    
    // Populate location dropdown with available locations for this asset
    const assetRows = this.state.currentRows.filter(r => r.asset === this.currentSellAsset);
    const locSelect = DOM.$('#sell-location');
    if (locSelect) {
      locSelect.innerHTML = assetRows
        .map(r => `<option value="${this.escapeHtml(r.location)}" ${r.location === location ? 'selected' : ''}>${this.escapeHtml(r.location)}</option>`)
        .join('');
      
      // Update max quantity when location changes
      locSelect.addEventListener('change', (e) => {
        const selectedLoc = e.target.value;
        const row = assetRows.find(r => r.location === selectedLoc);
        const maxQty = DOM.$('#sell-max-qty');
        if (maxQty && row) {
          maxQty.textContent = `Máximo: ${FORMATTERS.quantity.format(row.quantity)}`;
        }
      });
    }
    
    // Set initial max quantity
    const row = assetRows.find(r => r.location === location);
    const maxQty = DOM.$('#sell-max-qty');
    if (maxQty && row) {
      maxQty.textContent = `Máximo: ${FORMATTERS.quantity.format(row.quantity)}`;
    }
    
    DOM.$('#sell-qty').value = '';
    DOM.show(DOM.$('#sell-modal-backdrop'));
  }

  closeSellModal(){
    DOM.hide(DOM.$('#sell-modal-backdrop'));
    this.currentSellAsset = null;
    this.currentSellLocation = null;
  }

  async confirmSell(){
    try {
      const sellQty = parseFloat(DOM.$('#sell-qty').value);
      const location = DOM.$('#sell-location').value;
      
      if (!isFinite(sellQty) || sellQty <= 0) {
        alert('Por favor, insira uma quantidade válida');
        return;
      }
      
      // Find the asset row
      const row = this.state.currentRows.find(r => 
        r.asset === this.currentSellAsset && r.location === location
      );
      
      if (!row) {
        alert('Ativo não encontrado');
        return;
      }
      
      if (sellQty > row.quantity) {
        alert('Quantidade excede o disponível');
        return;
      }
      
      const newQty = row.quantity - sellQty;
      
      if (row.source === 'manual') {
        if (newQty <= 0) {
          // Delete the asset if quantity reaches zero
          await FirebaseService.deleteDocument('cryptoportfolio_manual', this.currentSellAsset);
        } else {
          // Update the quantity
          await FirebaseService.setDocument('cryptoportfolio_manual', this.currentSellAsset, {
            asset: this.currentSellAsset,
            quantity: newQty,
            location: location
          });
        }
        
        await this.loadManualAssets();
        await this.renderAll();
      } else {
        alert('Não é possível vender ativos do Binance diretamente');
      }
      
      this.closeSellModal();
    } catch (e) {
      alert('Erro ao vender ativo');
      console.error(e);
    }
  }

  /* ===== Chart Modal ===== */
  setupChartModal(){
    const modal = DOM.$('#chart-modal-backdrop');
    const card = DOM.$('#kpi-trend-card');
    
    if (card) {
      card.addEventListener('click', ()=>this.openChartModal());
    }
    
    DOM.$('#chart-modal-close')?.addEventListener('click', ()=>this.closeChartModal());
    modal?.addEventListener('click', (e)=>{ if (e.target===modal) this.closeChartModal(); });
    
    // Range buttons
    DOM.$$('#chart-modal-backdrop .btn-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        DOM.$$('#chart-modal-backdrop .btn-toggle').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const range = e.target.getAttribute('data-range');
        this.renderExpandedChart(range);
      });
    });
  }

  openChartModal(){
    DOM.show(DOM.$('#chart-modal-backdrop'));
    this.renderExpandedChart('6m');
  }

  closeChartModal(){
    DOM.hide(DOM.$('#chart-modal-backdrop'));
    if (this.expandedChart) {
      this.expandedChart.destroy();
      this.expandedChart = null;
    }
  }

  renderExpandedChart(range){
    const canvas = document.getElementById('chart-modal-canvas');
    if (!canvas) return;

    let data = [];
    const now = new Date();
    
    switch(range) {
      case '3m':
        data = this.state.monthlyRealized.slice(-3);
        break;
      case '6m':
        data = this.state.monthlyRealized.slice(-6);
        break;
      case '1y':
        data = this.state.monthlyRealized.slice(-12);
        break;
      case 'all':
      default:
        data = this.state.monthlyRealized;
        break;
    }

    const labels = data.map(d => {
      const [year, month] = d.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
    });
    const dataEUR = data.map(d => d.realizedEUR);

    if (this.expandedChart) {
      this.expandedChart.destroy();
    }

    this.expandedChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Realizado (EUR)',
          data: dataEUR,
          borderColor: '#526D82',
          backgroundColor: 'rgba(82, 109, 130, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: { 
            enabled: true,
            callbacks: {
              label: (context) => {
                return `Realizado: ${FORMATTERS.eur.format(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => FORMATTERS.eur.format(value)
            }
          }
        }
      }
    });
  }

  /* ================== PDF ================== */
  setupPdf(){
    DOM.$('#btn-pdf')?.addEventListener('click', (e)=>{
      e.preventDefault();
      this.exportToPdf();
    });
  }

  exportToPdf(){
    if (!window.jspdf){ alert('PDF library not loaded.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'pt', format:'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const now = new Date();
    const month = now.toLocaleString('pt-PT', { month:'long' });
    const title = `Portefólio Cripto - ${month.charAt(0).toUpperCase()+month.slice(1)} ${now.getFullYear()}`;
    doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text(title, pageWidth/2, 40, { align:'center' });

    const rows = this.state.visibleRows;
    if (!rows.length){ alert('Sem dados para exportar.'); return; }

    // Build table for selected currency
    const mode = this.state.currency; // 'EUR'|'USD'
    const head = (mode==='EUR')
      ? [['Ativo','Quantidade','Valor (EUR)','Localização']]
      : [['Ativo','Quantidade','Valor ($)','Localização']];

    const body = rows.map(r=>{
      return (mode==='EUR')
        ? [ r.asset, FORMATTERS.quantity.format(r.quantity), FORMATTERS.eur.format(r.valueEUR||0), r.location||'' ]
        : [ r.asset, FORMATTERS.quantity.format(r.quantity), `$${FORMATTERS.usd.format(r.valueUSDT||0)}`, r.location||'' ];
    });

    // ----- construir head/body como já fazes acima -----

      // 1) Larguras por modo (mais estreitas para Ativo / Valor / Localização)
      const widths = (mode === 'EUR')
        // Ativo | Quantidade | Valor(€) | Localização
        ? [70, 95, 85, 150]
        // Ativo | Quantidade | Valor($) | Localização
        : [70, 95, 80, 155];

      // 2) Centragem: margem simétrica com base na soma das colunas
      const totalTableWidth = widths.reduce((a, b) => a + b, 0);
      const marginLeft = Math.max(20, Math.floor((pageWidth - totalTableWidth) / 2));
      const margin = { left: marginLeft, right: marginLeft };

      // 3) Tabela
      doc.autoTable({
        startY: 70,
        head,
        body,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.2,
          halign: 'center' // centra texto das células
        },
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: 30,
          fontStyle: 'bold',
          halign: 'center'
        },
        margin,
        tableWidth: 'wrap',
        // colunas: usamos as larguras calculadas acima
        columnStyles: {
          0: { cellWidth: widths[0] },                  // Ativo
          1: { cellWidth: widths[1], halign: 'center' }, // Quantidade
          2: { cellWidth: widths[2], halign: 'center' }, // Valor
          3: { cellWidth: widths[3] }                   // Localização
        }
      });

      // === Totais imediatamente abaixo da tabela, alinhados à esquerda da tabela ===
        const t = this.state.totals;
        const totalInv = this.getTotalInvestedAmounts();
        const invEUR = totalInv.eur;
        const invUSD = totalInv.usd;
        const realEUR = (t.eur || 0) - invEUR;
        const realUSD = (t.usdt || 0) - invUSD;

        let y = (doc.lastAutoTable?.finalY || 70) + 25;
        // usa a mesma margem esquerda da tabela; fallback para 40 px
        const leftX = (typeof marginLeft !== 'undefined')
          ? marginLeft
          : (doc.lastAutoTable?.settings?.margin?.left ?? 40);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);

        if (mode === 'EUR') {
          const part1 = `Total: ${FORMATTERS.eur.format(t.eur || 0)}   `;
          const part2 = `Investido: ${FORMATTERS.eur.format(invEUR)}   `;
          const sign = realEUR >= 0 ? '+' : '−';
          const part3 = `Realizado: ${sign}${FORMATTERS.eur.format(Math.abs(realEUR))}`;

          // texto 1 (preto)
          doc.setTextColor(0, 0, 0);
          doc.text(part1, leftX, y);

          // texto 2 (preto), encostado a seguir ao 1
          let x2 = leftX + doc.getTextWidth(part1);
          doc.text(part2, x2, y);

          // texto 3 (verde/vermelho), encostado a seguir ao 2
          let x3 = x2 + doc.getTextWidth(part2);
          doc.setTextColor(realEUR >= 0 ? 22 : 220, realEUR >= 0 ? 163 : 38, realEUR >= 0 ? 74 : 38);
          doc.text(part3, x3, y);
        } else {
          const part1 = `Total: $${FORMATTERS.usd.format(t.usdt || 0)}   `;
          const part2 = `Investido: $${FORMATTERS.usd.format(invUSD)}   `;
          const sign = realUSD >= 0 ? '+' : '−';
          const part3 = `Realizado: ${sign}$${FORMATTERS.usd.format(Math.abs(realUSD))}`;

          doc.setTextColor(0, 0, 0);
          doc.text(part1, leftX, y);

          let x2 = leftX + doc.getTextWidth(part1);
          doc.text(part2, x2, y);

          let x3 = x2 + doc.getTextWidth(part2);
          doc.setTextColor(realUSD >= 0 ? 22 : 220, realUSD >= 0 ? 163 : 38, realUSD >= 0 ? 74 : 38);
          doc.text(part3, x3, y);
        }

        // reset cor para o que vier depois
        doc.setTextColor(0, 0, 0);



    const filename = `Crypto_Portfolio_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.pdf`;
    doc.save(filename);
  }

  /* ================== MISC ================== */
  showError(msg){
    console.error(msg);
    const tb = DOM.$('#rows');
    if (tb) tb.innerHTML = `<tr><td colspan="6" class="text-muted">Error: ${msg}</td></tr>`;
  }
}

/* ================== BOOT ================== */
const app = new CryptoPortfolioApp();
document.addEventListener('DOMContentLoaded', ()=> app.init() );

// expose for console debug
window.cryptoApp = app;
