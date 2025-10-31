// js/crypto.js  – KISS version with global Investido + Realizado = Total - Investido

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
    'Binance Earn Locked',
    'Ledger',
    'Ledger staking.chain.link'
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
  MONTHLY_REALIZED_COLLECTION: 'cryptoportfolio_monthly_realized', // stores monthly realized values
  APY_COLLECTION: 'cryptoportfolio_apy', // stores manually entered APY per asset/location
  SNAPSHOTS_COLLECTION: 'crypto_snapshots' // stores daily snapshots for 24h change
};

CONFIG.API_URL = CONFIG.ON_FIREBASE ? '/api/portfolio' : CONFIG.CF_URL;

/* ================== FORMATTERS ================== */
const FORMATTERS = {
  quantity: new Intl.NumberFormat('en-PT', { maximumFractionDigits: 8 }),
  eur: new Intl.NumberFormat('en-PT', { style: 'currency', currency: 'EUR' }),
  usd: new Intl.NumberFormat('en-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  percent: new Intl.NumberFormat('en-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

/* ================== TOAST NOTIFICATIONS ================== */
class ToastService {
  static show(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  static success(msg) { this.show(msg, 'success'); }
  static error(msg) { this.show(msg, 'error'); }
  static info(msg) { this.show(msg, 'info'); }
}

/* ================== APP STATE ================== */
class AppState {
  constructor(){
    this.savedLocations = new Map(); // Binance positions -> location
    this.manualAssets = [];
    this.binanceRows = [];
    this.binancePriceMap = new Map();
    this.usdtToEurRate = 0;
    this.apyValues = new Map(); // asset|location -> apy

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
    this.allocationChart = null;
    
    // Modal currency for add crypto
    this.modalCurrency = 'EUR';
    
    // 24h change tracking
    this.previousDayTotal = { eur: 0, usd: 0 };
    
    // Sorting state
    this.sortColumn = null;
    this.sortDirection = null;
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

  makeApyKey(asset, location=''){
    const a = String(asset || '').trim().toUpperCase();
    const l = String(location || '').trim().toUpperCase();
    return `${a}|${l}`;
  }

  makeApyDocId(asset, location=''){
    const sanitize = (value, fallback='DEFAULT') => {
      const v = String(value || '').trim();
      const upper = v ? v.toUpperCase() : fallback;
      return upper.replace(/[^A-Z0-9_.-]/g, '_');
    };
    return `${sanitize(asset)}__${sanitize(location, 'GLOBAL')}`;
  }

  getApyValue(asset, location=''){
    const key = this.makeApyKey(asset, location);
    if (this.state.apyValues.has(key)) return this.state.apyValues.get(key);
    const fallbackKey = this.makeApyKey(asset, '');
    return this.state.apyValues.has(fallbackKey)
      ? this.state.apyValues.get(fallbackKey)
      : null;
  }

  formatApy(value){
    if (value === null || value === undefined || !isFinite(value)) return '--';
    return `${FORMATTERS.percent.format(value)}%`;
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
        this.loadApyValues(),
        this.loadMonthlyRealized(),
        this.load24hSnapshot()
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
      this.saveDailySnapshot();
      this.initialized = true;
    } catch (e) {
      this.showError(e.message || String(e));
      ToastService.error('Erro ao carregar portfolio');
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

  async loadApyValues(){
    const docs = await FirebaseService.getCollection(CONFIG.APY_COLLECTION);
    const map = new Map();
    for (const entry of docs){
      const asset = String(entry.asset || entry.id || '').trim().toUpperCase();
      const locationRaw = entry.hasOwnProperty('location') ? entry.location : '';
      const location = String(locationRaw || '').trim().toUpperCase();
      if (!asset) continue;
      const num = Number(entry.apy);
      if (!isFinite(num)) continue;
      const key = this.makeApyKey(asset, location);
      map.set(key, num);
    }
    this.state.apyValues = map;
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

  async load24hSnapshot(){
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = yesterday.toISOString().split('T')[0];
    
    const snapshot = await FirebaseService.getDocument(CONFIG.SNAPSHOTS_COLLECTION, key);
    if (snapshot) {
      this.state.previousDayTotal = {
        eur: Number(snapshot.totalEUR || 0),
        usd: Number(snapshot.totalUSD || 0)
      };
    }
  }

  async saveDailySnapshot(){
    const today = new Date().toISOString().split('T')[0];
    const t = this.state.totals;
    
    await FirebaseService.setDocument(CONFIG.SNAPSHOTS_COLLECTION, today, {
      date: today,
      totalEUR: t.eur,
      totalUSD: t.usdt
    });
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

  listActiveInvestments() {
    const all = [];
    for (const [key, investments] of this.state.investments) {
      for (const inv of investments) {
        if ((inv.amountUSD || 0) > 0 || (inv.amountEUR || 0) > 0) {
          const asset = key.split('_')[0];
          all.push({
            asset,
            location: inv.location,
            amountUSD: inv.amountUSD,
            amountEUR: inv.amountEUR,
            date: inv.date
          });
        }
      }
    }

    if (all.length === 0) {
      console.log('✅ No active investments found.');
      return [];
    }

    const assets = [...new Set(all.map(i => i.asset))];
    console.log('✅ Assets with active investments:', assets);
    console.table(all);
    return all;
  }

  async saveInvested(value, currency){
    const v = Number(value || 0);
    if (!isFinite(v) || v<0) throw new Error('Valor inválido');
    const rate = this.state.usdtToEurRate || 0;

    if (currency === 'EUR') {
      this.state.investedEUR = v;
      this.state.investedUSD = rate>0 ? v / rate : 0;
    } else {
      this.state.investedUSD = v;
      this.state.investedEUR = rate>0 ? v * rate : 0;
    }
    await FirebaseService.setDocument(CONFIG.META_COLLECTION, CONFIG.META_DOC, {
      investedUSD: this.state.investedUSD,
      investedEUR: this.state.investedEUR
    });
  }

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

  getPerformanceBadge(roi) {
    if (roi >= 50) return '🔥'; // Hot performer
    if (roi >= 20) return '📈'; // Good
    if (roi < -20) return '📉'; // Underperforming
    return '';
  }

  async renderAll(generatedAt){
    // compute manual values
    const manualVal = await Promise.all(this.state.manualAssets.map(async m=>{
      const { price } = await this.priceResolver.getUSD(m.asset);
      const vUSDT = price>0 ? price * m.quantity : 0;
      const vEUR = (this.state.usdtToEurRate||0) ? vUSDT * this.state.usdtToEurRate : 0;
      const apy = this.getApyValue(m.asset, m.location);
      return { ...m, valueUSDT: vUSDT, valueEUR: vEUR, priceUSDT: price, priceSource: 'coingecko', apy };
    }));

    // merge
    this.state.currentRows = [
      ...this.state.binanceRows.map(r=>{
        const location = this.state.savedLocations.get(r.asset) || '';
        const apy = this.getApyValue(r.asset, location);
        return { ...r, location, apy };
      }),
      ...manualVal
    ].sort((a,b)=>(b.valueEUR||0)-(a.valueEUR||0));

    this.renderKPIs(generatedAt);
    this.renderTable();
    this.renderAllocationChart();
    this.updateSmallNote();
    this.listActiveInvestments();
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

    // 4th KPI: 24h Change
    const k24h = document.getElementById('kpi24h');
    const k24hPercent = document.getElementById('kpi24hPercent');
    if (k24h && k24hPercent) {
      const currentEUR = t.eur || 0;
      const prevEUR = this.state.previousDayTotal.eur || 0;
      const changeEUR = currentEUR - prevEUR;
      const changePercent = prevEUR > 0 ? (changeEUR / prevEUR) * 100 : 0;
      
      const sign = changeEUR >= 0 ? '+' : '−';
      k24h.textContent = `${sign}${FORMATTERS.eur.format(Math.abs(changeEUR))}`;
      k24h.classList.toggle('pos', changeEUR >= 0);
      k24h.classList.toggle('neg', changeEUR < 0);
      
      k24hPercent.textContent = `${sign}${FORMATTERS.percent.format(Math.abs(changePercent))}%`;
      k24hPercent.classList.toggle('pos', changeEUR >= 0);
      k24hPercent.classList.toggle('neg', changeEUR < 0);
    }

    // 5th KPI: Trend chart
    this.renderTrendChart();
  }

  renderTrendChart(){
    const canvas = document.getElementById('kpi-trend-chart');
    if (!canvas) return;

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

  /* ================== ALLOCATION CHART ================== */
  renderAllocationChart(){
    const canvas = document.getElementById('allocation-chart');
    if (!canvas) return;

    // Get top 10 assets by value
    const data = [...this.state.currentRows]
      .sort((a, b) => (b.valueEUR || 0) - (a.valueEUR || 0))
      .slice(0, 10);

    const labels = data.map(d => d.asset);
    const values = data.map(d => d.valueEUR || 0);
    
    // Color palette
    const colors = [
      '#526D82', '#9DB2BF', '#27374D', '#DDE6ED',
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899'
    ];

    if (this.state.allocationChart) {
      this.state.allocationChart.destroy();
    }

    this.state.allocationChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 15,
              font: { size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${FORMATTERS.eur.format(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  /* ================== TABLE WITH SORTING ================== */
  sortTable(column){
    if (this.state.sortColumn === column) {
      // Toggle direction
      if (this.state.sortDirection === 'asc') {
        this.state.sortDirection = 'desc';
      } else if (this.state.sortDirection === 'desc') {
        this.state.sortDirection = null;
        this.state.sortColumn = null;
      } else {
        this.state.sortDirection = 'asc';
      }
    } else {
      this.state.sortColumn = column;
      this.state.sortDirection = 'asc';
    }

    if (this.state.sortColumn && this.state.sortDirection) {
      this.state.currentRows.sort((a, b) => {
        let aVal, bVal;
        
        if (column === 'asset') {
          aVal = a.asset || '';
          bVal = b.asset || '';
          return this.state.sortDirection === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        if (column === 'roi') {
          const aInv = this.getAssetInvestedAmounts(a.asset, a.location);
          const bInv = this.getAssetInvestedAmounts(b.asset, b.location);
          aVal = aInv.eur > 0 ? ((a.valueEUR - aInv.eur) / aInv.eur * 100) : 0;
          bVal = bInv.eur > 0 ? ((b.valueEUR - bInv.eur) / bInv.eur * 100) : 0;
        } else if (column === 'investedEUR') {
          const aInv = this.getAssetInvestedAmounts(a.asset, a.location);
          const bInv = this.getAssetInvestedAmounts(b.asset, b.location);
          aVal = aInv.eur;
          bVal = bInv.eur;
        } else if (column === 'investedUSD') {
          const aInv = this.getAssetInvestedAmounts(a.asset, a.location);
          const bInv = this.getAssetInvestedAmounts(b.asset, b.location);
          aVal = aInv.usd;
          bVal = bInv.usd;
        } else if (column === 'realized') {
          const aInv = this.getAssetInvestedAmounts(a.asset, a.location);
          const bInv = this.getAssetInvestedAmounts(b.asset, b.location);
          aVal = (a.valueEUR || 0) - aInv.eur;
          bVal = (b.valueEUR || 0) - bInv.eur;
        } else {
          aVal = a[column] || 0;
          bVal = b[column] || 0;
        }
        
        return this.state.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
    } else {
      // Reset to default sort (by value)
      this.state.currentRows.sort((a,b)=>(b.valueEUR||0)-(a.valueEUR||0));
    }

    this.renderTable();
    this.updateSortHeaders();
  }

  updateSortHeaders(){
    DOM.$$('#crypto-table th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      const col = th.getAttribute('data-sort');
      if (col === this.state.sortColumn) {
        th.classList.add(`sort-${this.state.sortDirection}`);
      }
    });
  }

  renderTable(){
    const tbody = DOM.$('#rows');
    if (!tbody) return;

    const investedOnly = [];
    for (const [key, invs] of this.state.investments) {
      const asset = key.split('_')[0];
      const alreadyInTable = this.state.currentRows?.some(r => r.asset === asset);
      if (!alreadyInTable) {
        const locKey = key.split('_')[1] || 'Other';
        investedOnly.push({
          asset,
          quantity: 0,
          valueUSDT: 0,
          valueEUR: 0,
          location: locKey,
          source: 'investments',
          apy: this.getApyValue(asset, locKey)
        });
      }
    }
    this.state.currentRows = [...(this.state.currentRows || []), ...investedOnly];

    const vis = this.state.visibleRows;
    if (!vis.length){
      tbody.innerHTML = '<tr><td colspan="11" class="text-muted">No data to display</td></tr>';
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

      for (const r of rows){
        const invested = this.getAssetInvestedAmounts(r.asset, r.location);
        const apyValue = this.getApyValue(r.asset, r.location);
        const apyDisplay = this.formatApy(apyValue);

        // Calculate ROI
        const roi = invested.eur > 0 
          ? ((r.valueEUR - invested.eur) / invested.eur * 100)
          : 0;
        const roiDisplay = `${roi >= 0 ? '+' : ''}${FORMATTERS.percent.format(roi)}%`;
        const roiClass = roi >= 0 ? 'roi-positive' : 'roi-negative';
        const perfBadge = this.getPerformanceBadge(roi);

        const actions = `
          <button class="btn btn-edit btn-icon"
                  title="Editar"
                  aria-label="Editar"
                  data-edit="${esc(r.asset)}"
                  data-location="${esc(r.location)}"
                  data-source="${esc(r.source||'binance')}">
            ✎
          </button>
        `;

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
          <tr data-asset="${esc(r.asset)}" data-source="${esc(r.source||'')}" data-location="${esc(r.location)}">
            <td><b>${esc(r.asset)}</b>${perfBadge ? `<span class="perf-badge">${perfBadge}</span>` : ''}</td>
            <td class="col-qty">${FORMATTERS.quantity.format(r.quantity)}</td>
            <td class="col-usd">$${FORMATTERS.usd.format(r.valueUSDT||0)}</td>
            <td class="col-eur">${FORMATTERS.eur.format(r.valueEUR||0)}</td>
            <td class="col-invested-usd">$${FORMATTERS.usd.format(invested.usd)}</td>
            <td class="col-invested-eur">${FORMATTERS.eur.format(invested.eur)}</td>
            <td class="col-realized" style="color: ${realizedColor}; font-weight: 600;">${realizedValue}</td>
            <td class="col-roi ${roiClass}">${roiDisplay}</td>
            <td class="col-apy">${apyDisplay}</td>
            <td class="col-loc">${sel}</td>
            <td>${actions}</td>
          </tr>
        `;
      }

      // subtotal
      if (rows.length > 1){
        const totalQty = rows.reduce((s,x)=>s+(x.quantity||0),0);
        const totalUSD = rows.reduce((s,x)=>s+(x.valueUSDT||0),0);
        const totalEUR = rows.reduce((s,x)=>s+(x.valueEUR||0),0);

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

        const roi = investedSubtotal.eur > 0 
          ? ((totalEUR - investedSubtotal.eur) / investedSubtotal.eur * 100)
          : 0;
        const roiDisplay = `${roi >= 0 ? '+' : ''}${FORMATTERS.percent.format(roi)}%`;
        const roiClass = roi >= 0 ? 'roi-positive' : 'roi-negative';

        html += `
          <tr class="subtotal-row" data-asset="${esc(asset)}" data-subtotal="1">
            <td>Total ${esc(asset)}</td>
            <td class="col-qty">${FORMATTERS.quantity.format(totalQty)}</td>
            <td class="col-usd">$${FORMATTERS.usd.format(totalUSD)}</td>
            <td class="col-eur">${FORMATTERS.eur.format(totalEUR)}</td>
            <td class="col-invested-usd">$${FORMATTERS.usd.format(investedSubtotal.usd)}</td>
            <td class="col-invested-eur">${FORMATTERS.eur.format(investedSubtotal.eur)}</td>
            <td class="col-realized" style="color: ${realizedColor}; font-weight: 600;">${realizedValue}</td>
            <td class="col-roi ${roiClass}">${roiDisplay}</td>
            <td class="col-apy">-</td>
            <td class="col-loc"></td>
            <td></td>
          </tr>
        `;
      }     
    }

    tbody.innerHTML = html;

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
    this.updateSortHeaders();
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

    const totalInv = this.getTotalInvestedAmounts();
    const kINV = DOM.$('#kpiInvested');
    if (kINV){
      if (this.state.currency==='EUR') kINV.textContent = FORMATTERS.eur.format(totalInv.eur);
      else kINV.textContent = `${FORMATTERS.usd.format(totalInv.usd)}`;
    }
    this.renderKPIs();
  }

  updateSmallNote(){
    const note = DOM.$('#small-note');
    if (!note) return;
    const hidden = this.state.currentRows.filter(r=>(r.valueUSDT||0)<CONFIG.SMALL_USD_THRESHOLD).length;
    if (this.state.hideSmall && hidden>0) note.textContent = `A ocultar ${hidden} posições com valor < ${CONFIG.SMALL_USD_THRESHOLD}.`;
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

    // Sortable headers
    DOM.$$('#crypto-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const column = th.getAttribute('data-sort');
        if (column) this.sortTable(column);
      });
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
    DOM.$('#inv-save-apy')?.addEventListener('click', ()=>this.saveApy());
    modal?.addEventListener('click', (e)=>{ if (e.target===modal) this.closeInvestmentModal(); });

    // default date
    const dateInput = DOM.$('#inv-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // remover ticker (apenas manual)
    const btnRemove = DOM.$('#inv-remove-asset');
    if (btnRemove){
      btnRemove.addEventListener('click', async () => {
        const asset = (this.currentInvestmentAsset||'').toUpperCase();
        const location = this.currentInvestmentLocation || 'Other';
        if (!asset) return;
        if (!confirm(`Remover o ticker ${asset} (${location}) e respetivos investimentos desta localização?`)) return;
        await this.deleteManualAssetAndInvestments(asset, location);
        this.closeInvestmentModal();
        await this.loadManualAssets();
        await this.loadInvestments();
        await this.renderAll();
        this.renderKPIs();
        ToastService.success('Ativo removido com sucesso');
      });
    }
  }

  openEditWindow(asset, location, source){
    this.currentInvestmentAsset   = (asset || '').toUpperCase();
    this.currentInvestmentLocation = location || 'Other';
    this.currentInvestmentSource   = source || 'binance';

    const modal      = document.querySelector('#investment-modal-backdrop');
    const titleSpan  = modal?.querySelector('#inv-asset-name');
    const qtyWrap    = modal?.querySelector('#inv-qty2-wrap');
    const qtyInput   = modal?.querySelector('#inv-qty2');
    const apyInput   = modal?.querySelector('#inv-apy');
    const btnRemove  = modal?.querySelector('#inv-remove-asset');

    if (titleSpan) {
      titleSpan.textContent = `${this.currentInvestmentAsset} – ${this.currentInvestmentLocation}`;
    }

    const isManual = (this.currentInvestmentSource === 'manual');
    if (qtyWrap)   qtyWrap.style.display = isManual ? 'block' : 'none';
    if (btnRemove) btnRemove.style.display = isManual ? '' : 'none';

    if (qtyInput)  qtyInput.value = '';
    if (apyInput) {
      const apyVal = this.getApyValue(this.currentInvestmentAsset, this.currentInvestmentLocation);
      apyInput.value = (apyVal !== null && apyVal !== undefined) ? String(apyVal) : '';
    }

    this.renderInvestmentList();
    if (modal) modal.style.display = 'flex';
  }

  async deleteManualAssetAndInvestments(asset, location){
    await FirebaseService.deleteDocument('cryptoportfolio_manual', asset);

    const key = `${asset.toUpperCase()}_${(location||'Other').toUpperCase()}`;
    const list = this.state.investments.get(key) || [];
    for (const inv of list){
      if (inv?.id) {
        await FirebaseService.deleteDocument(CONFIG.INVESTMENTS_COLLECTION, inv.id);
      }
    }

    try {
      await FirebaseService.deleteDocument(CONFIG.APY_COLLECTION, this.makeApyDocId(asset, location));
    } catch (err) {
      console.warn('Falha ao remover APY manual', err);
    }
    this.state.apyValues.delete(this.makeApyKey(asset, location));
    this.state.investments.delete(key);
    this.state.manualAssets = this.state.manualAssets.filter(r => !(r.asset===asset && (r.location||'Other')===location));
  }

  closeInvestmentModal(){
    DOM.hide(DOM.$('#investment-modal-backdrop'));
    this.currentInvestmentAsset = null;
    this.currentInvestmentLocation = null;
    this.currentInvestmentSource = null;
    const apyInput = DOM.$('#inv-apy');
    if (apyInput) apyInput.value = '';
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

    const sorted = [...investments].sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = sorted.map(inv => {
      const displayAmount = inv.currency === 'EUR' 
        ? FORMATTERS.eur.format(inv.originalAmount)
        : `${FORMATTERS.usd.format(inv.originalAmount)}`;
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

    list.querySelectorAll('.btn-del-inv').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const invId = e.target.getAttribute('data-inv-id');
        await this.deleteInvestment(invId);
      });
    });
  }

  async addInvestment(){
    try {
      const amount = parseFloat(DOM.$('#inv-amount')?.value ?? '');
      const currency = DOM.$('#inv-currency')?.value || 'EUR';
      const date = DOM.$('#inv-date')?.value || '';

      const asset = (this.currentInvestmentAsset || '').toUpperCase();
      const location = this.currentInvestmentLocation || 'Other';
      const source = this.currentInvestmentSource || 'binance';

      const qtyToAdd = (source === 'manual')
        ? parseFloat(document.querySelector('#investment-modal-backdrop #inv-qty2')?.value ?? '0')
        : 0;

      if (!isFinite(amount) || amount < 0) { 
        ToastService.error('Por favor, insira um valor válido (≥ 0)');
        return; 
      }
      if (!date) { 
        ToastService.error('Por favor, selecione uma data');
        return; 
      }

      const rate = this.state.usdtToEurRate || 1;
      const amountUSD = (currency === 'EUR') ? (rate > 0 ? amount / rate : 0) : amount;
      const amountEUR = (currency === 'EUR') ? amount : (rate > 0 ? amount * rate : 0);

      const id = `${asset}_${location}_${Date.now()}`;
      await FirebaseService.setDocument(CONFIG.INVESTMENTS_COLLECTION, id, {
        asset, location, amountUSD, amountEUR, currency,
        originalAmount: amount, date
      });

      if (source === 'manual' && qtyToAdd > 0) {
        const manualRow = this.state.manualAssets.find(
          r => r.asset === asset && (r.location || 'Other') === location
        );
        const newQty = (manualRow?.quantity || 0) + qtyToAdd;
        await FirebaseService.setDocument('cryptoportfolio_manual', asset, {
          asset, quantity: newQty, location
        });
      }

      this.closeInvestmentModal();

      await this.loadManualAssets();
      await this.loadInvestments();
      await this.renderAll();
      this.renderKPIs();

      const amt = DOM.$('#inv-amount'); if (amt) amt.value = '';
      const dt  = DOM.$('#inv-date');   if (dt)  dt.value = new Date().toISOString().split('T')[0];
      const qi  = DOM.$('#inv-qty2');   if (qi)  qi.value = '';

      ToastService.success('Investimento adicionado com sucesso');
    } catch (e) {
      ToastService.error('Erro ao adicionar investimento');
      console.error(e);
    }
  }

  async saveApy(){
    const asset = (this.currentInvestmentAsset || '').toUpperCase();
    const location = this.currentInvestmentLocation || '';
    const input = DOM.$('#inv-apy');
    if (!asset || !input) {
      ToastService.error('Selecione um ativo para definir o APY');
      return;
    }

    const raw = input.value.trim();
    const key = this.makeApyKey(asset, location);
    try {
      if (raw === '') {
        const docId = this.makeApyDocId(asset, location);
        await FirebaseService.deleteDocument(CONFIG.APY_COLLECTION, docId);
        this.state.apyValues.delete(key);
        input.value = '';
        ToastService.success('APY removido');
      } else {
        const value = Number(raw);
        if (!isFinite(value)) {
          ToastService.error('Valor APY inválido');
          return;
        }
        const docId = this.makeApyDocId(asset, location);
        await FirebaseService.setDocument(CONFIG.APY_COLLECTION, docId, {
          asset,
          location,
          apy: value
        });
        this.state.apyValues.set(key, value);
        ToastService.success('APY guardado com sucesso');
      }
      await this.renderAll();
    } catch (err) {
      console.error(err);
      ToastService.error('Erro ao guardar APY');
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
      ToastService.success('Investimento removido');
    } catch (e) {
      ToastService.error('Erro ao remover investimento');
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
      ToastService.error('Asset/quantidade inválidos');
      return; 
    }
    
    await FirebaseService.setDocument('cryptoportfolio_manual', asset, { 
      asset, 
      quantity: qty, 
      location: loc 
    });
    
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
        location: loc,
        amountUSD,
        amountEUR,
        currency: this.modalCurrency,
        originalAmount: cost,
        date: new Date().toISOString().split('T')[0]
      };

      const id = `${asset}_${loc}_${Date.now()}`;
      await FirebaseService.setDocument(CONFIG.INVESTMENTS_COLLECTION, id, investmentData);
    }

    await this.loadManualAssets();
    await this.loadInvestments();
    this.closeModal();
    await this.renderAll();
    ToastService.success('Asset guardado com sucesso');
  }

  bindTableEvents(){
  DOM.$$('select[data-asset]').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const asset = e.target.getAttribute('data-asset');
        const loc = e.target.value;
        const row = e.target.closest('tr');
        const previousLoc = row?.getAttribute('data-location') || '';
        const source = row?.getAttribute('data-source') || 'binance';
        
        if (source === 'manual') {
          await FirebaseService.setDocument('cryptoportfolio_manual', asset, { location: loc });
          await this.loadManualAssets();
        } else {
          const assetUpper = String(asset || '').toUpperCase();
          await FirebaseService.setDocument('cryptoportfolio', asset, { asset, location: loc });
          this.state.savedLocations.set(assetUpper, loc);
        }
        
        if (row) {
          row.setAttribute('data-location', loc);
          const editBtn = row.querySelector('.btn-edit');
          if (editBtn) editBtn.setAttribute('data-location', loc);
        }
        
        const assetUpperKey = String(asset || '').toUpperCase();
        const currentRow = this.state.currentRows.find(r =>
          r.asset === assetUpperKey && (r.location || '') === previousLoc
        );
        if (currentRow) currentRow.location = loc;
        
        await this.renderAll();
        ToastService.success('Localização atualizada');
      });
    });

  DOM.$$('.btn-edit').forEach(b =>
      b.addEventListener('click', () => {
        const asset = b.getAttribute('data-edit');
        const location = b.getAttribute('data-location') || 'Other';
        const source = b.getAttribute('data-source') || 'binance';
        this.openEditWindow(asset, location, source);
      })
    );
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
    
    const assetRows = this.state.currentRows.filter(r => r.asset === this.currentSellAsset);
    const locSelect = DOM.$('#sell-location');
    if (locSelect) {
      locSelect.innerHTML = assetRows
        .map(r => `<option value="${this.escapeHtml(r.location)}" ${r.location === location ? 'selected' : ''}>${this.escapeHtml(r.location)}</option>`)
        .join('');
      
      locSelect.addEventListener('change', (e) => {
        const selectedLoc = e.target.value;
        const row = assetRows.find(r => r.location === selectedLoc);
        const maxQty = DOM.$('#sell-max-qty');
        if (maxQty && row) {
          maxQty.textContent = `Máximo: ${FORMATTERS.quantity.format(row.quantity)}`;
        }
      });
    }
    
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
        ToastService.error('Por favor, insira uma quantidade válida');
        return;
      }
      
      const row = this.state.currentRows.find(r => 
        r.asset === this.currentSellAsset && r.location === location
      );
      
      if (!row) {
        ToastService.error('Ativo não encontrado');
        return;
      }
      
      if (sellQty > row.quantity) {
        ToastService.error('Quantidade excede o disponível');
        return;
      }
      
      const newQty = row.quantity - sellQty;
      
      if (row.source === 'manual') {
        if (newQty <= 0) {
          await FirebaseService.deleteDocument('cryptoportfolio_manual', this.currentSellAsset);
        } else {
          await FirebaseService.setDocument('cryptoportfolio_manual', this.currentSellAsset, {
            asset: this.currentSellAsset,
            quantity: newQty,
            location: location
          });
        }
        
        await this.loadManualAssets();
        await this.renderAll();
        ToastService.success('Venda registrada com sucesso');
      } else {
        ToastService.error('Não é possível vender ativos do Binance diretamente');
      }
      
      this.closeSellModal();
    } catch (e) {
      ToastService.error('Erro ao vender ativo');
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
    const btn = DOM.$('#btn-pdf');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      this.exportToPdf();
    });
  }

  exportToPdf(){
    if (!window.jspdf){ 
      ToastService.error('PDF library not loaded.');
      return; 
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'pt', format:'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const now = new Date();
    const month = now.toLocaleString('pt-PT', { month:'long' });
    const title = `Portfólio Cripto - ${month.charAt(0).toUpperCase()+month.slice(1)} ${now.getFullYear()}`;
    doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text(title, pageWidth/2, 40, { align:'center' });

    const rows = this.state.visibleRows;
    if (!rows.length){ 
      ToastService.error('Sem dados para exportar.');
      return; 
    }

    const mode = this.state.currency;
    const head = (mode === 'EUR')
      ? [['Ativo','Quantidade','Valor (EUR)']]
      : [['Ativo','Quantidade','Valor ($)']];

    const body = rows.map(r => (
      mode === 'EUR'
        ? [ r.asset, FORMATTERS.quantity.format(r.quantity), FORMATTERS.eur.format(r.valueEUR||0) ]
        : [ r.asset, FORMATTERS.quantity.format(r.quantity), `${FORMATTERS.usd.format(r.valueUSDT||0)}` ]
    ));

    const widths = [110, 95, 120];
    const totalTableWidth = widths.reduce((a,b)=>a+b,0);
    const marginLeft = Math.max(20, Math.floor((pageWidth - totalTableWidth) / 2));
    const margin = { left: marginLeft, right: marginLeft };

    if (typeof doc.autoTable !== 'function'){
      ToastService.error('PDF table plugin (autoTable) not loaded.');
      return;
    }

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
        halign: 'center'
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: 30,
        fontStyle: 'bold',
        halign: 'center'
      },
      margin,
      tableWidth: 'wrap',
      columnStyles: {
        0: { cellWidth: widths[0] },
        1: { cellWidth: widths[1], halign: 'center' },
        2: { cellWidth: widths[2], halign: 'center' }
      }
    });

    // Totais abaixo da tabela
    const t = this.state.totals;
    const totalInv = this.getTotalInvestedAmounts();
    const invEUR = totalInv.eur;
    const invUSD = totalInv.usd;
    const realEUR = (t.eur || 0) - invEUR;
    const realUSD = (t.usdt || 0) - invUSD;

    let y = (doc.lastAutoTable?.finalY || 70) + 25;
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

      doc.setTextColor(0, 0, 0);
      doc.text(part1, leftX, y);

      let x2 = leftX + doc.getTextWidth(part1);
      doc.text(part2, x2, y);

      let x3 = x2 + doc.getTextWidth(part2);
      doc.setTextColor(realEUR >= 0 ? 22 : 220, realEUR >= 0 ? 163 : 38, realEUR >= 0 ? 74 : 38);
      doc.text(part3, x3, y);
    } else {
      const part1 = `Total: ${FORMATTERS.usd.format(t.usdt || 0)}   `;
      const part2 = `Investido: ${FORMATTERS.usd.format(invUSD)}   `;
      const sign = realUSD >= 0 ? '+' : '−';
      const part3 = `Realizado: ${sign}${FORMATTERS.usd.format(Math.abs(realUSD))}`;

      doc.setTextColor(0, 0, 0);
      doc.text(part1, leftX, y);

      let x2 = leftX + doc.getTextWidth(part1);
      doc.text(part2, x2, y);

      let x3 = x2 + doc.getTextWidth(part2);
      doc.setTextColor(realUSD >= 0 ? 22 : 220, realUSD >= 0 ? 163 : 38, realUSD >= 0 ? 74 : 38);
      doc.text(part3, x3, y);
    }

    doc.setTextColor(0, 0, 0);

    const filename = `Crypto_Portfolio_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.pdf`;
    doc.save(filename);
    ToastService.success('PDF exportado com sucesso');
  }

  /* ================== MISC ================== */
  showError(msg){
    console.error(msg);
    const tb = DOM.$('#rows');
    if (tb) tb.innerHTML = `<tr><td colspan="11" class="text-muted">Error: ${msg}</td></tr>`;
  }
}

/* ================== BOOT ================== */
const app = new CryptoPortfolioApp();
document.addEventListener('DOMContentLoaded', ()=> app.init() );

window.cryptoApp = app;
