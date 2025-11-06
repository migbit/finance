import { CONFIG } from './config.js';
import { FORMATTERS, PerformanceUtils, ValidationUtils } from './formatters.js';
import { Storage, ApiService, Coingecko, PriceResolver, FirebaseService, EnhancedStorage } from './api.js';
import { AppState } from './state.js';

/* ================== DOM UTILS ================== */
const DOM = {
  $: (sel) => document.querySelector(sel),
  $$: (sel) => Array.from(document.querySelectorAll(sel)),
  show: (el) => el && (el.style.display = 'flex'),
  hide: (el) => el && (el.style.display = 'none'),
  enable: (el) => el && (el.disabled = false),
  disable: (el) => el && (el.disabled = true)
};
const LOADING_STATS_KEY = 'crypto_loading_stats';
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

class ErrorHandler {
  static handle(error, context = '') {
    if (!error) return;
    const ctx = context ? `[${context}] ` : '';
    console.error(`${ctx}Error:`, error);
    const message = this.getUserFriendlyMessage(error);
    if (message) ToastService.error(message);
    if (typeof window !== 'undefined' && window.analytics?.track) {
      window.analytics.track('error', {
        context,
        message: error.message || String(error),
        stack: error.stack || null
      });
    }
  }

  static getUserFriendlyMessage(error) {
    const code = error?.code;
    const message = String(error?.message || '');
    if (code === 'permission-denied') return 'Permissão negada. Por favor, faça login novamente.';
    if (code === 'unavailable') return 'Serviço temporariamente indisponível. Tente novamente.';
    if (message.toLowerCase().includes('network')) return 'Erro de conexão. Verifique sua internet.';
    if (message.toLowerCase().includes('quota')) return 'Limite de operações excedido. Aguarde e tente mais tarde.';
    return 'Ocorreu um erro. Por favor, tente novamente.';
  }
}

/* ================== APP STATE ================== */
class CryptoPortfolioApp {
  constructor(){
    this.state = new AppState();
    this.priceResolver = null;
    this.initialized = false;
    this.cachedElements = {
      rows: null,
      kpiTotalEUR: null,
      kpiTotalUSD: null,
      kpiRealizedEUR: null,
      kpiRealizedUSD: null,
      kpiInvested: null,
      kpiInvestedSub: null,
      modalBackdrop: null,
      investmentModal: null,
      loadingOverlay: null,
      loadingMessage: null,
      loadingSpinner: null,
      loadingEta: null,
      errorMessage: null
    };
    this._chartsVisibility = { topAssets: false, monthly: false };
    this._debouncedRender = null;
    this._removeFocusTrap = null;
    this._previousFocus = null;
    this._keyboardHandler = null;
    this.announcer = null;
    this._announceTimer = null;
    this._renderedRowKeys = new Set();
    this._tableRenderTimeout = null;
    this._eventsAttached = false;
  }

  initDOMCache(){
    this.cachedElements.rows = DOM.$('#rows');
    this.cachedElements.kpiTotalEUR = DOM.$('#kpiTotalEUR');
    this.cachedElements.kpiTotalUSD = DOM.$('#kpiTotalUSD');
    this.cachedElements.kpiRealizedEUR = DOM.$('#kpiRealizedEUR');
    this.cachedElements.kpiRealizedUSD = DOM.$('#kpiRealizedUSD');
    this.cachedElements.kpiInvested = DOM.$('#kpiInvested');
    this.cachedElements.kpiInvestedSub = DOM.$('#kpiInvestedSub');
    this.cachedElements.modalBackdrop = DOM.$('#modal-backdrop');
    this.cachedElements.investmentModal = DOM.$('#investment-modal-backdrop');
    this.cachedElements.loadingOverlay = DOM.$('#portfolio-loading');
    this.cachedElements.loadingMessage = DOM.$('#portfolio-loading-message');
    this.cachedElements.loadingSpinner = DOM.$('#portfolio-loading .loading-spinner');
    this.cachedElements.loadingEta = DOM.$('#loading-eta');
    this.cachedElements.errorMessage = DOM.$('#error-message');
  }

  getCachedElement(key, selector){
    if (!this.cachedElements.hasOwnProperty(key)) {
      this.cachedElements[key] = null;
    }
    if (!this.cachedElements[key]) {
      this.cachedElements[key] = DOM.$(selector);
    }
    return this.cachedElements[key];
  }

  setLoadingState({ visible, message, busy = true, eta } = {}){
    const overlay = this.getCachedElement('loadingOverlay', '#portfolio-loading');
    if (!overlay) return;

    if (typeof visible === 'boolean') {
      overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }
    overlay.setAttribute('aria-busy', busy ? 'true' : 'false');

    const spinner = this.getCachedElement('loadingSpinner', '#portfolio-loading .loading-spinner');
    if (spinner) {
      spinner.style.display = busy ? '' : 'none';
    }

    if (typeof message === 'string') {
      const msgEl = this.getCachedElement('loadingMessage', '#portfolio-loading-message');
      if (msgEl) msgEl.textContent = message;
    }

    const etaEl = this.getCachedElement('loadingEta', '#loading-eta');
    if (etaEl) {
      if (typeof eta === 'string' && eta.trim()) {
        etaEl.textContent = eta;
        etaEl.style.display = '';
      } else {
        etaEl.textContent = '';
        etaEl.style.display = 'none';
      }
    }
  }

  resetAppData(){
    const currentTopAssetsChart = this.state?.topAssetsChart;
    if (currentTopAssetsChart?.destroy) {
      try { currentTopAssetsChart.destroy(); } catch (err) { console.warn('Failed to destroy top assets chart', err); }
    }
    const currentMonthlyChart = this.state?.monthlyChart;
    if (currentMonthlyChart?.destroy) {
      try { currentMonthlyChart.destroy(); } catch (err) { console.warn('Failed to destroy monthly chart', err); }
    }
    this.state = new AppState();
    this.priceResolver = null;
    this._chartsVisibility = { topAssets: false, monthly: false };
    this._renderedRowKeys.clear();
    if (this._tableRenderTimeout) {
      window.clearTimeout(this._tableRenderTimeout);
      this._tableRenderTimeout = null;
    }
    this._debouncedRender = null;
  }

  handleSignedOut(messageOrOptions, optionsMaybe){
    let message = 'Sessão terminada. Faça login para continuar.';
    let options = {};
    if (typeof messageOrOptions === 'string' || messageOrOptions instanceof String) {
      message = messageOrOptions;
      if (optionsMaybe && typeof optionsMaybe === 'object') {
        options = optionsMaybe;
      }
    } else if (messageOrOptions && typeof messageOrOptions === 'object') {
      options = messageOrOptions;
      if (typeof options.message === 'string') {
        message = options.message;
      }
    }
    const busy = typeof options.busy === 'boolean' ? options.busy : false;
    const eta = typeof options.eta === 'string' ? options.eta : undefined;

    this.setLoadingState({ visible: true, busy, message, eta });
    this.initialized = false;
    this.resetAppData();

    const rows = this.getCachedElement('rows', '#rows');
    if (rows) {
      const safeMessage = this.escape(message || 'Sessão terminada.');
      rows.innerHTML = `<tr><td colspan="11" class="text-muted">${safeMessage}</td></tr>`;
    }

    const kpiDefaults = [
      ['kpiTotalEUR', '—'],
      ['kpiTotalUSD', '—'],
      ['kpiRealizedEUR', '—'],
      ['kpiRealizedUSD', '—'],
      ['kpiInvested', '—'],
      ['kpiInvestedSub', '—'],
      ['kpiMonthlyTotal', '—'],
      ['kpiMonthlyTotalUSD', '—']
    ];
    for (const [key, value] of kpiDefaults) {
      const el = this.getCachedElement(key, `#${key}`);
      if (el) el.textContent = value;
    }

    const errorEl = this.getCachedElement('errorMessage', '#error-message');
    if (errorEl) {
      if (message && !busy) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      } else {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
    }
  }

  setupAccessibility(){
    if (this.announcer) return;
    const existing = document.getElementById('portfolio-live-announcer');
    this.announcer = existing || document.createElement('div');
    this.announcer.id = 'portfolio-live-announcer';
    this.announcer.className = 'sr-only';
    this.announcer.setAttribute('role', 'status');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    if (!existing) document.body.appendChild(this.announcer);
  }

  announce(message, priority = 'polite'){
    if (!message) return;
    if (!this.announcer) this.setupAccessibility();
    if (!this.announcer) return;
    this.announcer.setAttribute('aria-live', priority);
    this.announcer.textContent = message;
    window.clearTimeout(this._announceTimer);
    this._announceTimer = window.setTimeout(() => {
      if (this.announcer) this.announcer.textContent = '';
    }, 1000);
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

  normalizeLocation(value){
    return String(value || 'Other').trim().toUpperCase();
  }

  canonicalizeLocation(value){
    const trimmed = String(value || 'Other').trim();
    if (!trimmed) return 'Other';
    const match = CONFIG.LOCATION_CHOICES.find(loc => loc.toUpperCase() === trimmed.toUpperCase());
    return match || trimmed;
  }

  normalizeSymbol(symbol){
    const trimmed = String(symbol || '').trim().toUpperCase();
    if (!trimmed) return trimmed;
    const alias = CONFIG.SYMBOL_ALIASES[trimmed];
    return alias ? alias.toUpperCase() : trimmed;
  }

  makeManualDocId(asset, location='Other'){
    const sanitize = (value, fallback = 'VALUE') => {
      const input = String(value || '').trim();
      const upper = input ? input.toUpperCase() : fallback;
      return upper.replace(/[^A-Z0-9_.-]/g, '_');
    };
    const base = `${sanitize(asset, 'ASSET')}__${sanitize(location, 'OTHER')}`;
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    return `MAN_${base}__${suffix}`;
  }

  makeRowKey(row){
    if (!row) return 'ROW::UNKNOWN';
    const asset = this.normalizeSymbol(row.asset || '');
    const location = this.normalizeLocation(row.location || 'OTHER');
    const source = String(row.source || 'DEFAULT').trim().toUpperCase();
    return `ROW::${asset}::${location}::${source}`;
  }

  makeSubtotalKey(asset){
    const normalized = this.normalizeSymbol(asset || 'TOTAL');
    return `SUBTOTAL::${normalized}`;
  }

  findManualAsset(asset, location='Other'){
    const normalizedAsset = this.normalizeSymbol(asset || '');
    const normalizedLocation = this.normalizeLocation(location);
    return this.state.manualAssets.find(row =>
      row.asset === normalizedAsset &&
      this.normalizeLocation(row.location) === normalizedLocation
    ) || null;
  }

  getApyValue(asset, location=''){
    const canonicalLocation = this.canonicalizeLocation(location || '');
    const key = this.makeApyKey(asset, canonicalLocation);
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

  restoreCachedPortfolio(cache){
    if (!cache || !Array.isArray(cache.currentRows) || !cache.currentRows.length) return;
    this.state.currentRows = cache.currentRows;
    if (typeof cache.usdtToEurRate === 'number') {
      this.state.usdtToEurRate = cache.usdtToEurRate;
    }
    this.state.generatedAt = cache.timestamp || null;
    try {
      this.renderKPIs(cache.timestamp);
      this.renderTable();
      this.renderInsights();
      this.updateSmallNote();
    } catch (err) {
      console.warn('Failed to restore cached portfolio', err);
    }
  }

  async savePortfolioCache(){
    try {
      const payload = {
        currentRows: this.state.currentRows,
        totals: this.state.totals,
        timestamp: Date.now(),
        usdtToEurRate: this.state.usdtToEurRate
      };
      const compressed = await EnhancedStorage.compress(payload);
      EnhancedStorage.setWithTTL(
        EnhancedStorage.PREFIXES.PORTFOLIO + 'main',
        compressed,
        5 * 60 * 1000
      );
    } catch (err) {
      console.warn('savePortfolioCache failed', err);
    }
  }

  async loadPortfolioCache(){
    try {
      const compressed = EnhancedStorage.getWithTTL(
        EnhancedStorage.PREFIXES.PORTFOLIO + 'main'
      );
      if (!compressed) return null;
      return await EnhancedStorage.decompress(compressed);
    } catch (err) {
      console.warn('loadPortfolioCache failed', err);
      return null;
    }
  }

  async init(){
    if (this.initialized) return;
    CONFIG.API_URL = CONFIG.ON_FIREBASE ? '/api/portfolio' : CONFIG.CF_URL;
    this.initDOMCache();
    this.setupAccessibility();
    this.setLoadingState({
      visible: true,
      busy: true,
      message: 'A carregar dados do portfólio...'
    });
    const cachedPortfolio = await this.loadPortfolioCache();
    if (cachedPortfolio) {
      this.restoreCachedPortfolio(cachedPortfolio);
    }
    const sortPrefs = Storage.getJSON('crypto_sort_preferences');
    if (sortPrefs) {
      this.state.sortColumn = sortPrefs.column || null;
      this.state.sortDirection = sortPrefs.direction || null;
    }

    try {
      await Promise.all([
        this.loadSavedLocations().catch(err => ErrorHandler.handle(err, 'loadSavedLocations')),
        this.loadManualAssets().catch(err => ErrorHandler.handle(err, 'loadManualAssets')),
        this.loadInvested().catch(err => ErrorHandler.handle(err, 'loadInvested')),
        this.loadInvestments().catch(err => ErrorHandler.handle(err, 'loadInvestments')),
        this.loadApyValues().catch(err => ErrorHandler.handle(err, 'loadApyValues')),
        this.loadMonthlyTotals().catch(err => ErrorHandler.handle(err, 'loadMonthlyTotals')),
        this.loadMonthlyAssetSnapshots().catch(err => ErrorHandler.handle(err, 'loadMonthlyAssetSnapshots'))
      ]);
      const api = await ApiService.fetchPortfolio();
      this.state.binanceRows = this.normalizeBinance(api);

      const eur = this.state.binanceRows.reduce((s,r)=>s+(r.valueEUR||0),0);
      const usd = this.state.binanceRows.reduce((s,r)=>s+(r.valueUSDT||0),0);
      this.state.usdtToEurRate = usd>0 ? eur/usd : 0;

      this.priceResolver = new PriceResolver(this.state.binancePriceMap);
      const manualMissing = this.state.manualAssets
        .map(a=>a.asset)
        .filter(sym=>!this.state.binancePriceMap.has(sym));
      const binanceMissing = this.state.binanceRows
        .filter(r => (r.quantity || 0) > 0 && !(r.priceUSDT > 0))
        .map(r => r.asset);
      const toPrefetch = [...new Set([...manualMissing, ...binanceMissing])];
      if (toPrefetch.length) await Coingecko.prefetch(toPrefetch);

      await this.hydrateBinanceRows();
      const eurHydrated = this.state.binanceRows.reduce((s,r)=>s+(r.valueEUR||0),0);
      const usdHydrated = this.state.binanceRows.reduce((s,r)=>s+(r.valueUSDT||0),0);
      if (usdHydrated > 0) {
        this.state.usdtToEurRate = eurHydrated / usdHydrated;
      }

      await this.renderAll(api.generatedAt);
      this.initIntersectionObservers();
      await this.ensureMonthlyAssetSnapshot();
      await this.loadMonthlyAssetSnapshots();
      this.renderAssetSnapshotsTable();
      this.setupEvents();
      this.saveMonthlyTotal();
      this.setLoadingState({ visible: false, busy: false });
      const errorEl = this.getCachedElement('errorMessage', '#error-message');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
      this.initialized = true;
    } catch (e) {
      ErrorHandler.handle(e, 'init');
      this.showError(e.message || String(e));
      const friendlyMessage = e?.message ? String(e.message) : 'Erro ao carregar dados. Tente novamente.';
      this.setLoadingState({
        visible: true,
        busy: false,
        message: friendlyMessage
      });
    }
  }

  async loadSavedLocations(){
    const locs = await FirebaseService.getCollection('cryptoportfolio');
    this.state.savedLocations = new Map(locs.map(x=>{
      const asset = this.normalizeSymbol(x.id);
      const location = this.canonicalizeLocation(x.location || '');
      return [asset, location];
    }));
  }

  async loadManualAssets(){
    const rows = await FirebaseService.getCollection('cryptoportfolio_manual');
    this.state.manualAssets = rows.map(x=>{
      const asset = this.normalizeSymbol(x.asset || x.id || '');
      const rawLocation = String(x.location || 'Other').trim();
      const location = this.canonicalizeLocation(rawLocation || 'Other');
      return {
        id: x.id || asset,
        asset,
        quantity: Number(x.quantity || 0),
        location,
        source: 'manual'
      };
    });
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
      const asset = this.normalizeSymbol(inv.asset || '');
      const canonicalLocation = this.canonicalizeLocation(inv.location || 'Other');
      const locKey = this.normalizeLocation(canonicalLocation);
      const key = `${asset}_${locKey}`;
      if (!this.state.investments.has(key)) {
        this.state.investments.set(key, []);
      }
      this.state.investments.get(key).push({
        id: inv.id,
        location: canonicalLocation,
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
      const asset = this.normalizeSymbol(entry.asset || entry.id || '');
      const locationRaw = entry.hasOwnProperty('location') ? entry.location : '';
      const canonicalLocation = this.canonicalizeLocation(locationRaw || '');
      if (!asset) continue;
      const num = Number(entry.apy);
      if (!isFinite(num)) continue;
      const key = this.makeApyKey(asset, canonicalLocation);
      map.set(key, num);
    }
    this.state.apyValues = map;
  }

  async loadMonthlyTotals(){
    const data = await FirebaseService.getCollection(CONFIG.MONTHLY_TOTALS_COLLECTION);
    this.state.monthlyTotals = data
      .map(d => ({
        month: d.month,
        totalEUR: Number(d.totalEUR || 0),
        totalUSD: Number(d.totalUSD || 0),
        timestamp: new Date(d.month + '-01').getTime()
      }))
      .filter(d => {
        const year = parseInt(d.month.split('-')[0]);
        return year >= 2025;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async saveMonthlyTotal(){
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const t = this.state.totals;
    
    await FirebaseService.setDocument(CONFIG.MONTHLY_TOTALS_COLLECTION, currentMonth, {
      month: currentMonth,
      totalEUR: t.eur || 0,
      totalUSD: t.usdt || 0
    });
    
    await this.loadMonthlyTotals();
  }

  async loadMonthlyAssetSnapshots(){
    const data = await FirebaseService.getCollection(CONFIG.MONTHLY_ASSETS_COLLECTION);
    const snapshots = data
      .map(d => {
        const month = d.month || d.id || '';
        if (!month) return null;
        const assetsRaw = d.assets || {};
        const assets = {};
        for (const [assetKey, assetData] of Object.entries(assetsRaw)){
          assets[assetKey] = {
            quantity: Number(assetData?.quantity || 0),
            valueEUR: Number(assetData?.valueEUR || 0),
            valueUSD: Number(assetData?.valueUSD || assetData?.valueUSDT || 0)
          };
        }
        return { month, assets };
      })
      .filter(Boolean)
      .sort((a, b) => a.month.localeCompare(b.month));

    this.state.monthlyAssetSnapshots = snapshots;
    this.state.baselineAssetMonth = snapshots.length ? snapshots[0].month : null;
  }

  getAggregatedAssets(){
    const map = new Map();
    for (const row of this.state.currentRows){
      const asset = row.asset;
      if (!asset) continue;
      if (!map.has(asset)){
        map.set(asset, { quantity: 0, valueEUR: 0, valueUSD: 0 });
      }
      const entry = map.get(asset);
      entry.quantity += Number(row.quantity || 0);
      entry.valueEUR += Number(row.valueEUR || 0);
      entry.valueUSD += Number(row.valueUSDT || 0);
    }
    return map;
  }

  async ensureMonthlyAssetSnapshot(){
    const now = new Date();
    if (now.getDate() !== 1) return;

    const monthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const alreadyCaptured = this.state.monthlyAssetSnapshots.some(s => s.month === monthId);
    if (alreadyCaptured) return;

    const aggregates = this.getAggregatedAssets();
    if (!aggregates.size) return;

    const assets = {};
    for (const [asset, info] of aggregates.entries()){
      assets[asset] = {
        quantity: Number(info.quantity.toFixed(8)),
        valueEUR: Number(info.valueEUR.toFixed(2)),
        valueUSD: Number(info.valueUSD.toFixed(2))
      };
    }

    await FirebaseService.setDocument(CONFIG.MONTHLY_ASSETS_COLLECTION, monthId, {
      month: monthId,
      assets,
      capturedAt: new Date()
    });
  }

  formatMonthLabel(monthId){
    try {
      const [yearStr, monthStr] = monthId.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr) - 1;
      const date = new Date(year, month, 1);
      const monthName = date.toLocaleString('pt-PT', { month: 'long' });
      const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      return `${capitalized} ${year}`;
    } catch {
      return monthId;
    }
  }

  formatSignedQuantity(value){
    if (!isFinite(value) || value === 0) return FORMATTERS.quantity.format(0);
    const sign = value > 0 ? '+' : 'âˆ’';
    return `${sign}${FORMATTERS.quantity.format(Math.abs(value))}`;
  }

  formatSignedCurrency(value){
    if (!isFinite(value) || value === 0) return FORMATTERS.eur.format(0);
    const sign = value > 0 ? '+' : 'âˆ’';
    const formatted = FORMATTERS.eur.format(Math.abs(value));
    return `${sign}${formatted}`;
  }

  renderAssetSnapshotsTable(){
    const table = DOM.$('#monthly-assets-table');
    const head = DOM.$('#monthly-assets-head');
    const body = DOM.$('#monthly-assets-body');
    if (!table || !head || !body) return;

    const snapshots = this.state.monthlyAssetSnapshots || [];
    if (!snapshots.length){
      head.innerHTML = '';
      body.innerHTML = `<tr><td class="text-muted" style="text-align:center; padding:16px;">Sem dados</td></tr>`;
      return;
    }

    const months = snapshots.map(s => s.month);
    const baselineAssets = snapshots[0]?.assets || {};
    const assetsSet = new Set();
    snapshots.forEach(s => {
      Object.keys(s.assets || {}).forEach(asset => assetsSet.add(asset));
    });

    if (!assetsSet.size){
      head.innerHTML = '';
      body.innerHTML = `<tr><td class="text-muted" style="text-align:center; padding:16px;">Sem dados</td></tr>`;
      return;
    }

    const headerRow1 = ['<tr><th rowspan="2">Ativo</th>'];
    const headerRow2 = ['<tr>'];
    months.forEach(month => {
      headerRow1.push(`<th colspan="4" style="text-align:center;">${this.formatMonthLabel(month)}</th>`);
      headerRow2.push('<th>Qtd</th><th>Valor</th><th>&Delta;Qtd</th><th>&Delta;Valor</th>');
    });
    headerRow1.push('</tr>');
    headerRow2.push('</tr>');
    head.innerHTML = headerRow1.join('') + headerRow2.join('');

    const snapshotMap = new Map(snapshots.map(s => [s.month, s]));
    const latestMonth = months[months.length - 1];
    const rowsHtml = Array.from(assetsSet)
      .map(asset => ({
        asset,
        latestValue: snapshotMap.get(latestMonth)?.assets?.[asset]?.valueEUR || 0
      }))
      .sort((a, b) => (b.latestValue || 0) - (a.latestValue || 0))
      .map(asset => {
        const baseline = baselineAssets[asset.asset] || { quantity: 0, valueEUR: 0 };
        const baselineQty = Number(baseline.quantity || 0);
        const baselineValue = Number(baseline.valueEUR || 0);

        const cells = months.map((month, idx) => {
          const snapshot = snapshotMap.get(month);
          const data = snapshot?.assets?.[asset.asset];
          if (!data){
            return '<td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td>';
          }
          const qty = Number(data.quantity || 0);
          const value = Number(data.valueEUR || 0);
          if (idx === 0){
            return `
              <td>${FORMATTERS.quantity.format(qty)}</td>
              <td>${FORMATTERS.eur.format(value)}</td>
              <td>&mdash;</td>
              <td>&mdash;</td>
            `;
          }
          const deltaQty = qty - baselineQty;
          const deltaValue = value - baselineValue;
          const qtyClass = deltaQty > 0 ? 'pos' : deltaQty < 0 ? 'neg' : '';
          const valueClass = deltaValue > 0 ? 'pos' : deltaValue < 0 ? 'neg' : '';
          return `
            <td>${FORMATTERS.quantity.format(qty)}</td>
            <td>${FORMATTERS.eur.format(value)}</td>
            <td class="${qtyClass}">${this.formatSignedQuantity(deltaQty)}</td>
            <td class="${valueClass}">${this.formatSignedCurrency(deltaValue)}</td>
          `;
        }).join('');

        return `<tr><td><b>${this.escape(asset.asset)}</b></td>${cells}</tr>`;
      }).join('');

    body.innerHTML = rowsHtml;
  }

  getAssetInvestedAmounts(asset, location) {
    const canonicalAsset = this.normalizeSymbol(asset);
    const canonicalLocation = this.canonicalizeLocation(location || 'Other');
    const key = `${canonicalAsset}_${this.normalizeLocation(canonicalLocation)}`;
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

  normalizeBinance(api){
    const pos = Array.isArray(api?.positions)? api.positions : [];
    this.state.binancePriceMap.clear();
    return pos
      .map(p=>{
        const asset = this.normalizeSymbol(p.asset || '');
        const qty = Number(p.quantity||0);
        let priceUSDT = Number(p.priceUSDT||0);
        const vUSDT = Number(p.valueUSDT||0);
        const vEUR  = Number(p.valueEUR||0);
        if ((!priceUSDT || priceUSDT<=0) && qty>0 && vUSDT>0) priceUSDT = vUSDT/qty;
        if (priceUSDT>0) this.state.binancePriceMap.set(asset, priceUSDT);
        return { asset, quantity:qty, valueUSDT:vUSDT, valueEUR:vEUR, priceUSDT, source:'binance' };
      })
      .filter(r=>!CONFIG.HIDE_SYMBOLS.has(r.asset))
      .filter(r=>(r.quantity||0)>0 || (r.valueEUR||r.valueUSDT||0)>0)
      .sort((a,b)=>(b.valueEUR||0)-(a.valueEUR||0));
  }

  async hydrateBinanceRows(){
    for (const row of this.state.binanceRows){
      if ((row.quantity || 0) <= 0) continue;
      const needsPrice = !(row.priceUSDT > 0);
      const needsValue = !(row.valueUSDT > 0);
      if (!needsPrice && !needsValue) continue;
      try {
        const { price } = await this.priceResolver.getUSD(row.asset);
        if (price > 0){
          row.priceUSDT = price;
          row.valueUSDT = price * row.quantity;
          if (this.state.usdtToEurRate > 0){
            row.valueEUR = row.valueUSDT * this.state.usdtToEurRate;
          }
          this.state.binancePriceMap.set(row.asset, price);
        }
      } catch (err) {
        console.warn('Unable to hydrate price for', row.asset, err);
      }
    }
    this.state.binanceRows.sort((a,b)=>(b.valueEUR||0)-(a.valueEUR||0));
  }

  initIntersectionObservers(){
    if (typeof IntersectionObserver !== 'function') {
      this._chartsVisibility.topAssets = true;
      this._chartsVisibility.monthly = true;
      this.renderTopAssets();
      this.renderMonthlyChart();
      return;
    }

    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const chartId = entry.target.id;
        if (chartId === 'top-assets-chart') {
          this._chartsVisibility.topAssets = true;
          if (!this.state.topAssetsChart) {
            this.renderTopAssets();
          }
        } else if (chartId === 'monthly-totals-chart') {
          this._chartsVisibility.monthly = true;
          if (!this.state.monthlyChart) {
            this.renderMonthlyChart();
          }
        }
        chartObserver.unobserve(entry.target);
      });
    }, { rootMargin: '50px' });

    const topAssetsCanvas = this.getCachedElement('topAssetsCanvas', '#top-assets-chart');
    const monthlyCanvas = this.getCachedElement('monthlyTotalsCanvas', '#monthly-totals-chart');

    if (topAssetsCanvas) {
      chartObserver.observe(topAssetsCanvas);
    } else {
      this._chartsVisibility.topAssets = true;
    }

    if (monthlyCanvas) {
      chartObserver.observe(monthlyCanvas);
    } else {
      this._chartsVisibility.monthly = true;
    }
  }

  applyCurrentSort(){
    if (!Array.isArray(this.state.currentRows)) return;
    const column = this.state.sortColumn;
    const direction = this.state.sortDirection;

    if (column && direction) {
      this.state.currentRows.sort((a, b) => {
        let aVal;
        let bVal;

        if (column === 'asset') {
          aVal = a.asset || '';
          bVal = b.asset || '';
          return direction === 'asc'
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

        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    } else {
      this.state.currentRows.sort((a, b) => (b.valueEUR || 0) - (a.valueEUR || 0));
    }
  }

  getPerformanceBadge(roi) {
    return '';
  }
  async renderAll(generatedAt){
    this.state.generatedAt = generatedAt;
    
    const manualVal = await Promise.all(this.state.manualAssets.map(async m=>{
      const { price } = await this.priceResolver.getUSD(m.asset);
      const vUSDT = price>0 ? price * m.quantity : 0;
      const vEUR = (this.state.usdtToEurRate||0) ? vUSDT * this.state.usdtToEurRate : 0;
      const apy = this.getApyValue(m.asset, m.location);
      return { ...m, valueUSDT: vUSDT, valueEUR: vEUR, priceUSDT: price, priceSource: 'coingecko', apy };
    }));

    this.state.currentRows = [
      ...this.state.binanceRows.map(r=>{
        const location = this.state.savedLocations.get(r.asset) || '';
        const apy = this.getApyValue(r.asset, location);
        return { ...r, location, apy };
      }),
      ...manualVal
    ];
    this.applyCurrentSort();

    this.renderKPIs(generatedAt);
    this.renderTable();
    this.updateSortHeaders();
    const shouldRenderTopAssets = this._chartsVisibility.topAssets || this.state.topAssetsChart;
    if (shouldRenderTopAssets) this.renderTopAssets();
    const shouldRenderMonthly = this._chartsVisibility.monthly || this.state.monthlyChart;
    if (shouldRenderMonthly) this.renderMonthlyChart();
    this.renderInsights();
    this.updateSmallNote();
    this.listActiveInvestments();
    this.renderAssetSnapshotsTable();
    await this.savePortfolioCache();
  }

  renderKPIs(generatedAt){
    const t = this.state.totals;
    const totalInv = this.getTotalInvestedAmounts();
    const investedEUR = totalInv.eur;
    const investedUSD = totalInv.usd;

    const realizedEUR = (t.eur || 0) - investedEUR;
    const realizedUSD = (t.usdt || 0) - investedUSD;

    const kEUR = this.getCachedElement('kpiTotalEUR', '#kpiTotalEUR');
    const kUSD = this.getCachedElement('kpiTotalUSD', '#kpiTotalUSD');
    if (kEUR) kEUR.textContent = FORMATTERS.eur.format(t.eur || 0);
    if (kUSD) kUSD.textContent = `$${FORMATTERS.usd.format(t.usdt || 0)}`;

    const kRealEUR = this.getCachedElement('kpiRealizedEUR', '#kpiRealizedEUR');
    const kRealUSD = this.getCachedElement('kpiRealizedUSD', '#kpiRealizedUSD');
    if (kRealEUR){
      const sign = realizedEUR >= 0 ? '+' : '-';
      kRealEUR.textContent = `${sign}${FORMATTERS.eur.format(Math.abs(realizedEUR))}`;
      kRealEUR.classList.toggle('pos', realizedEUR >= 0);
      kRealEUR.classList.toggle('neg', realizedEUR < 0);
    }
    if (kRealUSD){
      const sign = realizedUSD >= 0 ? '+' : '-';
      kRealUSD.textContent = `${sign}$${FORMATTERS.usd.format(Math.abs(realizedUSD))}`;
      kRealUSD.classList.toggle('pos', realizedUSD >= 0);
      kRealUSD.classList.toggle('neg', realizedUSD < 0);
    }

    const kINV  = this.getCachedElement('kpiInvested', '#kpiInvested');
    const kINVs = this.getCachedElement('kpiInvestedSub', '#kpiInvestedSub');
    if (kINV)  kINV.textContent  = FORMATTERS.eur.format(investedEUR);
    if (kINVs) kINVs.textContent = `$${FORMATTERS.usd.format(investedUSD)}`;

    const resolveMonthId = (value) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${date.getFullYear()}-${month}`;
    };

    const kMonthly = document.getElementById('kpiMonthlyTotal');
    const kMonthlyUSD = document.getElementById('kpiMonthlyTotalUSD');
    if (kMonthly && kMonthlyUSD) {
      const monthlyTotals = this.state.monthlyTotals || [];
      const currentMonthId =
        resolveMonthId(generatedAt) ||
        resolveMonthId(this.state.generatedAt) ||
        resolveMonthId(Date.now());

      let previousEntry = null;
      if (monthlyTotals.length) {
        let currentIndex = monthlyTotals.findIndex(entry => entry.month === currentMonthId);
        if (currentIndex === -1) currentIndex = monthlyTotals.length;
        previousEntry = monthlyTotals[currentIndex - 1] || null;
      }

      if (!previousEntry) {
        kMonthly.textContent = '—';
        kMonthlyUSD.textContent = '—';
        kMonthly.classList.remove('pos', 'neg');
        kMonthlyUSD.classList.remove('pos', 'neg');
      } else {
        const deltaEUR = (t.eur || 0) - (previousEntry.totalEUR || 0);
        const deltaUSD = (t.usdt || 0) - (previousEntry.totalUSD || 0);
        const signEUR = deltaEUR > 0 ? '+' : deltaEUR < 0 ? '-' : '';
        const signUSD = deltaUSD > 0 ? '+' : deltaUSD < 0 ? '-' : '';
        const formattedEUR = FORMATTERS.eur.format(Math.abs(deltaEUR));
        const formattedUSD = FORMATTERS.usd.format(Math.abs(deltaUSD));

        kMonthly.textContent = signEUR ? `${signEUR}${formattedEUR}` : formattedEUR;
        kMonthlyUSD.textContent = signUSD
          ? `${signUSD}$${formattedUSD}`
          : `$${formattedUSD}`;

        kMonthly.classList.toggle('pos', deltaEUR > 0);
        kMonthly.classList.toggle('neg', deltaEUR < 0);
        kMonthlyUSD.classList.toggle('pos', deltaUSD > 0);
        kMonthlyUSD.classList.toggle('neg', deltaUSD < 0);
      }
    }
  }

  renderTopAssets(){
    const canvas = document.getElementById('top-assets-chart');
    const emptyState = document.getElementById('top-assets-empty');
    if (!canvas) return;

    const total = this.state.totals.eur || 0;
    const aggregates = new Map();
    for (const row of this.state.currentRows){
      const value = row.valueEUR || 0;
      if (value <= 0) continue;
      const key = row.asset;
      aggregates.set(key, (aggregates.get(key) || 0) + value);
    }
    const topRows = Array.from(aggregates.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (!topRows.length || total === 0) {
      if (this.state.topAssetsChart) {
        this.state.topAssetsChart.destroy();
        this.state.topAssetsChart = null;
      }
      if (emptyState) emptyState.style.display = 'block';
      canvas.style.display = 'none';
      return;
    }

    canvas.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    const labels = topRows.map(([asset]) => asset);
    const values = topRows.map(([, value]) => value);
    const palette = [
      '#365314','#1D4ED8','#9333EA','#0EA5E9','#F97316',
      '#16A34A','#EF4444','#7C3AED','#6366F1','#f59e0b'
    ];
    const colors = labels.map((_, idx) => palette[idx % palette.length]);
    const ctx = canvas.getContext('2d');
    const tooltipFormatter = (context) => {
      const rawValue = context.raw || 0;
      const percent = total > 0 ? (rawValue / total) * 100 : 0;
      return `${context.label}: ${FORMATTERS.percent.format(percent)}%`;
    };

    const chartConfig = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverBorderWidth: 4,
          hoverBorderColor: '#ffffff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 14,
              padding: 12,
              font: {
                size: 11,
                family: 'Montserrat'
              }
            }
          },
          tooltip: {
            callbacks: {
              label: tooltipFormatter
            },
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 13,
              family: 'Montserrat'
            },
            bodyFont: {
              size: 12,
              family: 'Montserrat'
            }
          }
        },
        animation: {
          animateScale: true,
          animateRotate: true,
          duration: 800,
          easing: 'easeInOutQuart'
        },
        onHover: (event, activeElements) => {
          const target = event?.native?.target;
          if (target) {
            target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
          }
        }
      }
    };

    if (this.state.topAssetsChart) {
      const chart = this.state.topAssetsChart;
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].backgroundColor = colors;
      chart.data.datasets[0].hoverBorderWidth = 4;
      chart.data.datasets[0].hoverBorderColor = '#ffffff';
      chart.data.datasets[0].hoverOffset = 8;
      chart.options.plugins = chart.options.plugins || {};
      chart.options.plugins.legend = {
        ...(chart.options.plugins.legend || {}),
        ...chartConfig.options.plugins.legend
      };
      chart.options.plugins.legend.labels = {
        ...(chart.options.plugins.legend?.labels || {}),
        ...chartConfig.options.plugins.legend.labels
      };
      chart.options.plugins.tooltip = {
        ...(chart.options.plugins.tooltip || {}),
        ...chartConfig.options.plugins.tooltip
      };
      chart.options.plugins.tooltip.callbacks = chartConfig.options.plugins.tooltip.callbacks;
      chart.options.animation = chartConfig.options.animation;
      chart.options.onHover = chartConfig.options.onHover;
      chart.update();
    } else {
      this.state.topAssetsChart = new Chart(ctx, chartConfig);
    }
  }

  renderMonthlyChart(){
    const canvas = document.getElementById('monthly-totals-chart');
    if (!canvas) return;

    const data = this.state.monthlyTotals;
    
    if (data.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px helvetica';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.fillText('Sem dados de 2025', canvas.width / 2, canvas.height / 2);
      return;
    }

    const labels = data.map(d => {
      const [year, month] = d.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
    });
    const dataEUR = data.map(d => d.totalEUR);

    if (this.state.monthlyChart) {
      this.state.monthlyChart.destroy();
    }

    this.state.monthlyChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total (EUR)',
          data: dataEUR,
          borderColor: '#526D82',
          backgroundColor: 'rgba(82, 109, 130, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#526D82'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            display: true,
            position: 'top'
          },
          tooltip: { 
            enabled: true,
            callbacks: {
              label: (context) => {
                return `Total: ${FORMATTERS.eur.format(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: (value) => FORMATTERS.eur.format(value)
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });
  }

  renderInsights(){
    const rows = (this.state.currentRows || []).filter(r => (r.valueEUR || 0) > 0);
    const total = this.state.totals.eur || 0;
    const bestPerformer = DOM.$('#best-performer');
    const bestPerformerROI = DOM.$('#best-performer-roi');
    const worstPerformer = DOM.$('#worst-performer');
    const worstPerformerROI = DOM.$('#worst-performer-roi');
    const largestPosition = DOM.$('#largest-position');
    const largestPositionValue = DOM.$('#largest-position-value');
    const diversificationScoreEl = DOM.$('#diversification-score');
    const diversificationDescEl = DOM.$('#diversification-desc');

    if (!rows.length || total <= 0) {
      if (bestPerformer) bestPerformer.textContent = '--';
      if (bestPerformerROI) bestPerformerROI.textContent = '--';
      if (worstPerformer) worstPerformer.textContent = '--';
      if (worstPerformerROI) worstPerformerROI.textContent = '--';
      if (largestPosition) largestPosition.textContent = '--';
      if (largestPositionValue) largestPositionValue.textContent = '--';
      if (diversificationScoreEl) diversificationScoreEl.textContent = '--';
      if (diversificationDescEl) diversificationDescEl.textContent = '--';
      return;
    }

    let bestAsset = null;
    let bestROI = -Infinity;
    let worstAsset = null;
    let worstROI = Infinity;
    let largestAsset = null;
    let largestValue = 0;

    rows.forEach(r => {
      const valueEUR = r.valueEUR || 0;
      if (valueEUR > largestValue) {
        largestValue = valueEUR;
        largestAsset = { name: r.asset, value: valueEUR };
      }
      const invested = this.getAssetInvestedAmounts(r.asset, r.location);
      if (invested.eur > 0) {
        const roi = ((valueEUR - invested.eur) / invested.eur) * 100;
        if (roi > bestROI) {
          bestROI = roi;
          bestAsset = { name: r.asset, roi };
        }
        if (roi < worstROI) {
          worstROI = roi;
          worstAsset = { name: r.asset, roi };
        }
      }
    });

    const hhi = rows.reduce((sum, r) => {
      const share = ((r.valueEUR || 0) / total) * 100;
      return sum + share * share;
    }, 0);
    const diversificationScore = Math.max(0, 100 - (hhi / 100));
    let diversificationDesc = 'Baixa';
    if (diversificationScore > 70) diversificationDesc = 'Excelente';
    else if (diversificationScore > 50) diversificationDesc = 'Boa';
    else if (diversificationScore > 30) diversificationDesc = 'Moderada';

    if (bestPerformer && bestPerformerROI) {
      if (bestAsset) {
        bestPerformer.textContent = bestAsset.name;
        const formattedBest = `${bestAsset.roi >= 0 ? '+' : ''}${FORMATTERS.percent.format(bestAsset.roi)}%`;
        bestPerformerROI.textContent = formattedBest;
        const isPositive = bestAsset.roi >= 0;
        bestPerformerROI.classList.toggle('pos', isPositive);
        bestPerformerROI.classList.toggle('neg', !isPositive);
      } else {
        bestPerformer.textContent = '--';
        bestPerformerROI.textContent = '--';
        bestPerformerROI.classList.remove('pos');
        bestPerformerROI.classList.remove('neg');
      }
    }

    if (worstPerformer && worstPerformerROI) {
      if (worstAsset) {
        worstPerformer.textContent = worstAsset.name;
        const formatted = `${worstAsset.roi >= 0 ? '+' : ''}${FORMATTERS.percent.format(worstAsset.roi)}%`;
        worstPerformerROI.textContent = formatted;
        const isNegative = worstAsset.roi < 0;
        worstPerformerROI.classList.toggle('neg', isNegative);
        worstPerformerROI.classList.toggle('pos', !isNegative);
      } else {
        worstPerformer.textContent = '--';
        worstPerformerROI.textContent = '--';
        worstPerformerROI.classList.remove('neg');
        worstPerformerROI.classList.remove('pos');
      }
    }

    if (largestAsset && largestPosition && largestPositionValue) {
      largestPosition.textContent = largestAsset.name;
      largestPositionValue.textContent = FORMATTERS.eur.format(largestAsset.value);
    } else if (largestPosition && largestPositionValue) {
      largestPosition.textContent = '--';
      largestPositionValue.textContent = '--';
    }

    if (diversificationScoreEl && diversificationDescEl) {
      diversificationScoreEl.textContent = String(Math.round(diversificationScore));
      diversificationDescEl.textContent = diversificationDesc;
    }
  }

  sortTable(column){
    if (this.state.sortColumn === column) {
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

    Storage.setJSON('crypto_sort_preferences', {
      column: this.state.sortColumn,
      direction: this.state.sortDirection
    });

    this.applyCurrentSort();

    if (!this._debouncedRender) {
      this._debouncedRender = PerformanceUtils.debounce(() => {
        this.renderTable();
        this.updateSortHeaders();
      }, 150);
    }
    this._debouncedRender();

    const direction = this.state.sortDirection;
    if (this.state.sortColumn && direction) {
      const columnLabels = {
        asset: 'ativo',
        quantity: 'quantidade',
        valueUSDT: 'valor em dólares',
        valueEUR: 'valor em euros',
        investedUSD: 'investido em dólares',
        investedEUR: 'investido em euros',
        realized: 'ganhos realizados',
        roi: 'retorno',
        apy: 'APY'
      };
      const colLabel = columnLabels[this.state.sortColumn] || this.state.sortColumn;
      const dirLabel = direction === 'asc' ? 'ascendente' : 'descendente';
      this.announce(`Tabela ordenada por ${colLabel} em ordem ${dirLabel}`);
    }
  }

  updateSortHeaders(){
    DOM.$$('#crypto-table th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      const col = th.getAttribute('data-sort');
      th.setAttribute('aria-sort', 'none');
      if (col === this.state.sortColumn) {
        th.classList.add(`sort-${this.state.sortDirection}`);
         const ariaValue = this.state.sortDirection === 'asc' ? 'ascending' : 'descending';
         th.setAttribute('aria-sort', ariaValue);
      }
    });
  }

  renderTable(){
    const tbody = this.getCachedElement('rows', '#rows');
    if (!tbody) return;
    const timerHost = typeof window !== 'undefined' ? window : globalThis;
    if (this._tableRenderTimeout) {
      timerHost.clearTimeout(this._tableRenderTimeout);
      this._tableRenderTimeout = null;
    }

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
      tbody.innerHTML = `
        <tr role="row">
          <td role="cell" colspan="11" style="text-align: center; padding: 48px 24px;">
            <div style="color: #9ca3af; margin-bottom: 16px;">
              <svg style="width: 64px; height: 64px; margin: 0 auto 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
              </svg>
              <div style="font-size: 1.1rem; font-weight: 600; color: #6b7280; margin-bottom: 8px;">Sem ativos no portfólio</div>
              <div style="font-size: 0.9rem; color: #9ca3af;">Clique em "+ Adicionar" para começar</div>
            </div>
          </td>
        </tr>
      `;
      this._renderedRowKeys.clear();
      this.applyCurrencyMode();
      this.updateSortHeaders();
      return;
    }

    const { segments, keys } = this.buildTableSegments(vis);
    if (vis.length > 50) {
      this.renderTableProgressive(tbody, segments, keys);
    } else {
      this.renderTableImmediate(tbody, segments, keys);
    }
  }

  buildTableSegments(vis){
    const esc = s => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
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

    const segments = [];
    const keys = [];
    for (const asset of assets){
      const rows = groups.get(asset).sort((x,y)=>(y.valueEUR||0)-(x.valueEUR||0));

      for (const r of rows){
        const invested = this.getAssetInvestedAmounts(r.asset, r.location);
        const apyValue = this.getApyValue(r.asset, r.location);
        const apyDisplay = this.formatApy(apyValue);
        const rowKey = this.makeRowKey(r);

        const roi = invested.eur > 0
          ? ((r.valueEUR - invested.eur) / invested.eur * 100)
          : 0;
        const roiDisplay = `${roi >= 0 ? '+' : ''}${FORMATTERS.percent.format(roi)}%`;
        const roiClass = roi >= 0 ? 'roi-positive' : 'roi-negative';
        const perfBadge = this.getPerformanceBadge(roi);

        const actionLabel = `Editar ${esc(r.asset)}`;
        const actions = `
          <button class="btn btn-edit btn-icon"
                  title="${actionLabel}"
                  aria-label="${actionLabel}"
                  data-edit="${esc(r.asset)}"
                  data-location="${esc(r.location)}"
                  data-source="${esc(r.source||'binance')}">
            &#9998;
          </button>
        `;

        const sel = this.renderLocationSelect(r.asset, r.location);

        const realizedUSD = (r.valueUSDT || 0) - invested.usd;
        const realizedEUR = (r.valueEUR || 0) - invested.eur;
        const realizedBase = this.state.currency === 'EUR' ? realizedEUR : realizedUSD;
        const realizedColor = realizedBase >= 0 ? 'green' : 'red';
        const realizedSign = realizedBase >= 0 ? '+' : '';
        const realizedValue = this.state.currency === 'EUR'
          ? `${realizedSign}${FORMATTERS.eur.format(realizedEUR)}`
          : `${realizedSign}${FORMATTERS.usd.format(realizedUSD)}`;

        segments.push(`
          <tr role="row" data-row-key="${esc(rowKey)}" data-asset="${esc(r.asset)}" data-source="${esc(r.source||'')}" data-location="${esc(r.location)}">
            <td role="cell"><b>${esc(r.asset)}</b>${perfBadge ? `<span class="perf-badge">${perfBadge}</span>` : ''}</td>
            <td role="cell" class="col-qty">${FORMATTERS.quantity.format(r.quantity)}</td>
            <td role="cell" class="col-usd">${FORMATTERS.usd.format(r.valueUSDT||0)}</td>
            <td role="cell" class="col-eur">${FORMATTERS.eur.format(r.valueEUR||0)}</td>
            <td role="cell" class="col-invested-usd">${FORMATTERS.usd.format(invested.usd)}</td>
            <td role="cell" class="col-invested-eur">${FORMATTERS.eur.format(invested.eur)}</td>
            <td role="cell" class="col-realized" style="color: ${realizedColor}; font-weight: 600;">${realizedValue}</td>
            <td role="cell" class="col-roi ${roiClass}">${roiDisplay}</td>
            <td role="cell" class="col-apy">${apyDisplay}</td>
            <td role="cell" class="col-loc">${sel}</td>
            <td role="cell">${actions}</td>
          </tr>
        `);
        keys.push(rowKey);
      }

      if (rows.length > 1){
        const totalQty = rows.reduce((s,x)=>s+(x.quantity||0),0);
        const totalUSD = rows.reduce((s,x)=>s+(x.valueUSDT||0),0);
        const totalEUR = rows.reduce((s,x)=>s+(x.valueEUR||0),0);
        const subtotalKey = this.makeSubtotalKey(asset);

        const investedSubtotal = rows.reduce((acc, row) => {
          const inv = this.getAssetInvestedAmounts(row.asset, row.location);
          return { usd: acc.usd + inv.usd, eur: acc.eur + inv.eur };
        }, { usd: 0, eur: 0 });

        const realizedUSD = totalUSD - investedSubtotal.usd;
        const realizedEUR = totalEUR - investedSubtotal.eur;
        const realizedBase = this.state.currency === 'EUR' ? realizedEUR : realizedUSD;
        const realizedColor = realizedBase >= 0 ? 'green' : 'red';
        const realizedSign = realizedBase >= 0 ? '+' : '';
        const realizedValue = this.state.currency === 'EUR'
          ? `${realizedSign}${FORMATTERS.eur.format(realizedEUR)}`
          : `${realizedSign}${FORMATTERS.usd.format(realizedUSD)}`;

        const roi = investedSubtotal.eur > 0
          ? ((totalEUR - investedSubtotal.eur) / investedSubtotal.eur * 100)
          : 0;
        const roiDisplay = `${roi >= 0 ? '+' : ''}${FORMATTERS.percent.format(roi)}%`;
        const roiClass = roi >= 0 ? 'roi-positive' : 'roi-negative';

        segments.push(`
          <tr role="row" class="subtotal-row" data-row-key="${esc(subtotalKey)}" data-asset="${esc(asset)}" data-subtotal="1">
            <td role="cell">Total ${esc(asset)}</td>
            <td role="cell" class="col-qty">${FORMATTERS.quantity.format(totalQty)}</td>
            <td role="cell" class="col-usd">${FORMATTERS.usd.format(totalUSD)}</td>
            <td role="cell" class="col-eur">${FORMATTERS.eur.format(totalEUR)}</td>
            <td role="cell" class="col-invested-usd">${FORMATTERS.usd.format(investedSubtotal.usd)}</td>
            <td role="cell" class="col-invested-eur">${FORMATTERS.eur.format(investedSubtotal.eur)}</td>
            <td role="cell" class="col-realized" style="color: ${realizedColor}; font-weight: 600;">${realizedValue}</td>
            <td role="cell" class="col-roi ${roiClass}">${roiDisplay}</td>
            <td role="cell" class="col-apy">-</td>
            <td role="cell" class="col-loc"></td>
            <td role="cell"></td>
          </tr>
        `);
        keys.push(subtotalKey);
      }
    }
    return { segments, keys };
  }

  renderTableImmediate(tbody, segments, keys){
    const prevKeys = new Set(this._renderedRowKeys || []);
    const nextKeys = new Set(keys || []);
    const existingRows = Array.from(tbody.querySelectorAll('tr[data-row-key]'));
    const exitingRows = existingRows.filter(row => !nextKeys.has(row.getAttribute('data-row-key') || ''));

    const host = typeof window !== 'undefined' ? window : globalThis;
    const raf = host.requestAnimationFrame
      ? host.requestAnimationFrame.bind(host)
      : (cb => host.setTimeout(cb, 16));

    const finalizeRender = () => {
      tbody.innerHTML = segments.join('');
      const renderedRows = Array.from(tbody.querySelectorAll('tr[data-row-key]'));
      renderedRows.forEach(row => {
        const key = row.getAttribute('data-row-key') || '';
        if (!prevKeys.has(key)) {
          row.classList.add('row-enter');
          raf(() => {
            row.classList.add('row-enter-active');
            row.classList.remove('row-enter');
            host.setTimeout(() => row.classList.remove('row-enter-active'), 220);
          });
        }
      });
      this.bindTableEvents();
      this.applyCurrencyMode();
      this.updateSortHeaders();
      this._renderedRowKeys = nextKeys;
      this._tableRenderTimeout = null;
    };

    if (exitingRows.length) {
      exitingRows.forEach(row => {
        row.classList.add('row-exit');
        raf(() => row.classList.add('row-exit-active'));
      });
      this._tableRenderTimeout = host.setTimeout(finalizeRender, 200);
    } else {
      finalizeRender();
    }
  }

  renderTableProgressive(tbody, segments, keys){
    const CHUNK_SIZE = 20;
    let index = 0;
    tbody.innerHTML = '';
    const prevKeys = new Set(this._renderedRowKeys || []);
    const nextKeys = new Set(keys || []);
    const host = typeof window !== 'undefined' ? window : globalThis;
    const schedule = host.requestAnimationFrame
      ? host.requestAnimationFrame.bind(host)
      : (cb => host.setTimeout(cb, 16));

    const appendChunk = () => {
      const slice = segments.slice(index, index + CHUNK_SIZE);
      if (slice.length) {
        const wrapper = document.createElement('tbody');
        wrapper.innerHTML = slice.join('');
        const rows = Array.from(wrapper.children);
        rows.forEach(row => {
          const key = row.getAttribute('data-row-key') || '';
          if (key && !prevKeys.has(key)) {
            row.classList.add('row-enter');
          }
          tbody.appendChild(row);
        });
        rows.forEach(row => {
          if (row.classList.contains('row-enter')) {
            schedule(() => {
              row.classList.add('row-enter-active');
              row.classList.remove('row-enter');
              host.setTimeout(() => row.classList.remove('row-enter-active'), 220);
            });
          }
        });
      }
      index += CHUNK_SIZE;
      if (index < segments.length) {
        schedule(appendChunk);
      } else {
        this.bindTableEvents();
        this.applyCurrencyMode();
        this.updateSortHeaders();
        this._renderedRowKeys = nextKeys;
      }
    };
    schedule(appendChunk);
  }
  renderLocationSelect(asset, selected){
    const current = String(selected ?? '').trim();
    const options = [...CONFIG.LOCATION_CHOICES];
    if (current && !options.includes(current)) options.push(current);

    const opts = options.map(loc =>
      `<option value="${this.escape(loc)}" ${loc === current ? 'selected':''}>${this.escape(loc)}</option>`
    ).join('');
    return `<select class="location-select" data-asset="${this.escape(asset)}">${opts}</select>`;
  }
  
  escape(s){
    const t = String(s||'');
    return t.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m]));
  }

  applyCurrencyMode(){
    const show = (sel,on)=>document.querySelectorAll(sel).forEach(el=>{el.style.display = on?'':'none';});
    const showEUR = this.state.currency==='EUR';
    const showUSD = this.state.currency==='USD';
    show('th.col-usd, td.col-usd', showUSD);
    show('th.col-eur, td.col-eur', showEUR);
    show('th.col-invested-usd, td.col-invested-usd', showUSD);
    show('th.col-invested-eur, td.col-invested-eur', showEUR);

    const totalInv = this.getTotalInvestedAmounts();
    const kINV = this.getCachedElement('kpiInvested', '#kpiInvested');
    if (kINV){
      if (this.state.currency==='EUR') kINV.textContent = FORMATTERS.eur.format(totalInv.eur);
      else kINV.textContent = `$${FORMATTERS.usd.format(totalInv.usd)}`;
    }
    this.renderKPIs();
  }

  updateSmallNote(){
    const note = DOM.$('#small-note');
    if (!note) return;
    const hidden = this.state.currentRows.filter(r=>(r.valueUSDT||0)<CONFIG.SMALL_USD_THRESHOLD).length;
    if (this.state.hideSmall && hidden>0) note.textContent = `A ocultar ${hidden} posicoes com valor < $${CONFIG.SMALL_USD_THRESHOLD}.`;
    else note.textContent = '';
  }

  setupEvents(){
    if (this._eventsAttached) return;
    this._eventsAttached = true;
    DOM.$('#btn-toggle-small')?.addEventListener('click', ()=>{
      this.state.hideSmall = !this.state.hideSmall;
      const btn = DOM.$('#btn-toggle-small');
      if (btn) btn.textContent = this.state.hideSmall ? 'Mostrar valores < $5' : 'Mostrar apenas >= $5';
      this.renderTable();
      this.updateSmallNote();
      this.announce(this.state.hideSmall ? 'A ocultar valores pequenos' : 'A mostrar todos os valores');
    });

    DOM.$$('#crypto-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const column = th.getAttribute('data-sort');
        if (column) this.sortTable(column);
      });
    });

    this.setupModal();
    this.setupInvestmentModal();
    this.setupSellModal();
    this.setupPdf();
    this.setupKeyboardShortcuts();
    this.setupBulkOperations();

    const btnEUR = DOM.$('#btn-eur');
    const btnUSD = DOM.$('#btn-usd');
    if (btnEUR && btnUSD){
      const setActive = (on,off)=>{
        on.classList.add('active');
        off.classList.remove('active');
        on.setAttribute('aria-pressed', 'true');
        off.setAttribute('aria-pressed', 'false');
      };
      btnEUR.addEventListener('click', ()=>{
        this.state.currency='EUR';
        setActive(btnEUR, btnUSD);
        this.applyCurrencyMode();
        this.announce('Mostrando valores em EUR');
      });
      btnUSD.addEventListener('click', ()=>{
        this.state.currency='USD';
        setActive(btnUSD, btnEUR);
        this.applyCurrencyMode();
        this.announce('Mostrando valores em USD');
      });
    }
  }

  setupKeyboardShortcuts(){
    if (this._keyboardHandler) return;
    this._keyboardHandler = (e) => {
      const tag = String(e.target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.openAddModal();
        return;
      }

      if (e.key === 'Escape') {
        this.closeModal();
        this.closeInvestmentModal();
        this.closeSellModal();
        return;
      }

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        this.state.currency = this.state.currency === 'EUR' ? 'USD' : 'EUR';
        const btnEUR = DOM.$('#btn-eur');
        const btnUSD = DOM.$('#btn-usd');
        if (this.state.currency === 'EUR') {
          btnEUR?.classList.add('active');
          btnUSD?.classList.remove('active');
          btnEUR?.setAttribute('aria-pressed', 'true');
          btnUSD?.setAttribute('aria-pressed', 'false');
          this.announce('Mostrando valores em EUR');
        } else {
          btnUSD?.classList.add('active');
          btnEUR?.classList.remove('active');
          btnUSD?.setAttribute('aria-pressed', 'true');
          btnEUR?.setAttribute('aria-pressed', 'false');
          this.announce('Mostrando valores em USD');
        }
        this.applyCurrencyMode();
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.exportToPdf();
      }
    };
    document.addEventListener('keydown', this._keyboardHandler);
  }

  setupBulkOperations(){
    // Placeholder for bulk operations setup (future enhancement)
  }

  setupModal(){
    const modal = this.getCachedElement('modalBackdrop', '#modal-backdrop');
    const locSelect = DOM.$('#m-loc');
    if (locSelect){
      locSelect.innerHTML = CONFIG.LOCATION_CHOICES.map(l=>`<option value="${this.escape(l)}">${this.escape(l)}</option>`).join('');
    }
    
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

  setupInvestmentModal(){
    const modal = this.getCachedElement('investmentModal', '#investment-modal-backdrop');
    DOM.$('#inv-close')?.addEventListener('click', ()=>this.closeInvestmentModal());
    DOM.$('#inv-add-btn')?.addEventListener('click', ()=>this.addInvestment());
    DOM.$('#inv-save-qty')?.addEventListener('click', ()=>this.saveManualQuantity());
    DOM.$('#inv-save-apy')?.addEventListener('click', ()=>this.saveApy());
    modal?.addEventListener('click', (e)=>{ if (e.target===modal) this.closeInvestmentModal(); });

    const dateInput = DOM.$('#inv-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const btnRemove = DOM.$('#inv-remove-asset');
    if (btnRemove){
      btnRemove.addEventListener('click', async () => {
        const asset = this.normalizeSymbol(this.currentInvestmentAsset || '');
        const location = this.canonicalizeLocation(this.currentInvestmentLocation || 'Other');
        if (!asset) return;
        if (!confirm(`Remover o ticker ${asset} (${location}) e respetivos investimentos desta localizaÃ§Ã£o?`)) return;
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
    this.currentInvestmentAsset   = this.normalizeSymbol(asset || '');
    this.currentInvestmentLocation = this.canonicalizeLocation(location || 'Other');
    this.currentInvestmentSource   = source || 'binance';

    const modal      = this.getCachedElement('investmentModal', '#investment-modal-backdrop');
    const titleSpan  = modal?.querySelector('#inv-asset-name');
    const qtyWrap    = modal?.querySelector('#inv-qty2-wrap');
    const qtyInput   = modal?.querySelector('#inv-qty2');
    const apyInput   = modal?.querySelector('#inv-apy');
    const btnRemove  = modal?.querySelector('#inv-remove-asset');
    const btnSaveQty = modal?.querySelector('#inv-save-qty');

    if (titleSpan) {
      titleSpan.textContent = `${this.currentInvestmentAsset} â€“ ${this.currentInvestmentLocation}`;
    }

    const isManual = (this.currentInvestmentSource === 'manual');
    if (qtyWrap)   qtyWrap.style.display = isManual ? 'block' : 'none';
    if (btnSaveQty) btnSaveQty.style.display = isManual ? '' : 'none';
    if (btnRemove) btnRemove.style.display = isManual ? '' : 'none';

    if (qtyInput)  {
      if (isManual) {
        const manualRow = this.findManualAsset(this.currentInvestmentAsset, this.currentInvestmentLocation);
        const currentQty = manualRow?.quantity ?? null;
        qtyInput.value = currentQty !== null ? String(currentQty) : '';
        if (currentQty !== null) {
          qtyInput.setAttribute('placeholder', `Atual: ${FORMATTERS.quantity.format(currentQty)}`);
        } else {
          qtyInput.setAttribute('placeholder', 'e.g. 0.015');
        }
      } else {
        qtyInput.value = '';
        qtyInput.setAttribute('placeholder', 'e.g. 0.015');
      }
    }
    if (apyInput) {
      const apyVal = this.getApyValue(this.currentInvestmentAsset, this.currentInvestmentLocation);
      apyInput.value = (apyVal !== null && apyVal !== undefined) ? String(apyVal) : '';
    }

    this.renderInvestmentList();
    if (modal) modal.style.display = 'flex';
  }

  async deleteManualAssetAndInvestments(asset, location){
    const normalizedAsset = this.normalizeSymbol(asset || '');
    const targetLocation = this.canonicalizeLocation(location || 'Other');
    const manualRow = this.findManualAsset(normalizedAsset, targetLocation);
    const manualDocId = manualRow?.id || normalizedAsset;

    try {
      await FirebaseService.deleteDocument('cryptoportfolio_manual', manualDocId);
    } catch (err) {
      console.warn('Falha ao remover ativo manual', err);
    }

    const key = `${normalizedAsset}_${this.normalizeLocation(targetLocation)}`;
    const list = this.state.investments.get(key) || [];
    for (const inv of list){
      if (inv?.id) {
        await FirebaseService.deleteDocument(CONFIG.INVESTMENTS_COLLECTION, inv.id);
      }
    }

    try {
      await FirebaseService.deleteDocument(CONFIG.APY_COLLECTION, this.makeApyDocId(normalizedAsset, targetLocation));
    } catch (err) {
      console.warn('Falha ao remover APY manual', err);
    }
    this.state.apyValues.delete(this.makeApyKey(normalizedAsset, targetLocation));
    this.state.investments.delete(key);
    this.state.manualAssets = this.state.manualAssets.filter(r =>
      !(r.asset === normalizedAsset && this.normalizeLocation(r.location) === this.normalizeLocation(targetLocation))
    );
  }

  closeInvestmentModal(){
    const modal = this.getCachedElement('investmentModal', '#investment-modal-backdrop');
    DOM.hide(modal);
    this.currentInvestmentAsset = null;
    this.currentInvestmentLocation = null;
    this.currentInvestmentSource = null;
    const apyInput = DOM.$('#inv-apy');
    if (apyInput) apyInput.value = '';
    const qtyInput = DOM.$('#inv-qty2');
    if (qtyInput) {
      qtyInput.value = '';
      qtyInput.setAttribute('placeholder', 'e.g. 0.015');
    }
    const qtyWrap = DOM.$('#inv-qty2-wrap');
    if (qtyWrap) qtyWrap.style.display = 'none';
    const btnSaveQty = DOM.$('#inv-save-qty');
    if (btnSaveQty) btnSaveQty.style.display = 'none';
  }

  renderInvestmentList(){
    const list = DOM.$('#investment-list');
    if (!list) return;

    const assetKey = this.normalizeSymbol(this.currentInvestmentAsset || '');
    const locKey = this.normalizeLocation(this.currentInvestmentLocation || 'Other');
    const key = `${assetKey}_${locKey}`;
    const investments = this.state.investments.get(key) || [];

    if (investments.length === 0) {
      list.innerHTML = '<p style="color: #6b7280; font-size: 0.9rem; padding: 12px; text-align: center;">Nenhum investimento registrado</p>';
      return;
    }

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
          <button class="btn btn-del-inv" data-inv-id="${this.escape(inv.id)}" style="padding: 4px 8px; font-size: 0.85rem;">Remover</button>
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
      const amountInput = DOM.$('#inv-amount');
      const currency = DOM.$('#inv-currency')?.value || 'EUR';
      const dateInput = DOM.$('#inv-date');
      const date = dateInput?.value || '';

      const rawAmount = amountInput?.value ?? '';
      const amountNumber = Number(rawAmount);
      const amount = ValidationUtils.sanitizeNumber(rawAmount, 2);

      if (!ValidationUtils.isValidNumber(amountNumber, 0)) {
        ToastService.error('Insira um valor valido (>= 0)');
        amountInput?.focus();
        return;
      }

      if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
        ToastService.error('Selecione uma data valida');
        dateInput?.focus();
        return;
      }

      const inputDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (inputDate > today) {
        ToastService.error('A data nao pode ser no futuro');
        dateInput?.focus();
        return;
      }

      const asset = this.normalizeSymbol(this.currentInvestmentAsset || '');
      const location = this.canonicalizeLocation(this.currentInvestmentLocation || 'Other');
      const source = this.currentInvestmentSource || 'binance';

      let qtyToAdd = 0;
      let manualRow = null;
      if (source === 'manual') {
        manualRow = this.findManualAsset(asset, location);
        const rawQty = parseFloat(document.querySelector('#investment-modal-backdrop #inv-qty2')?.value ?? '0');
        if (Number.isFinite(rawQty) && rawQty >= 0) {
          const currentQty = manualRow?.quantity || 0;
          const delta = rawQty - currentQty;
          qtyToAdd = delta > 0 ? delta : 0;
        }
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
        const newQty = (manualRow?.quantity || 0) + qtyToAdd;
        const manualDocId = manualRow?.id || this.makeManualDocId(asset, location);
        await FirebaseService.setDocument('cryptoportfolio_manual', manualDocId, {
          asset,
          quantity: newQty,
          location
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
      this.announce(`Investimento adicionado para ${asset}`);
    } catch (e) {
      ToastService.error('Erro ao adicionar investimento');
      console.error(e);
      this.announce('Erro ao adicionar investimento', 'assertive');
    }
  }

  async batchAddInvestments(investments = []){
    if (!Array.isArray(investments) || !investments.length) return;
    ToastService.info(`A adicionar ${investments.length} investimentos...`);
    const rate = this.state.usdtToEurRate || 1;
    const tasks = investments
      .map(inv => {
        const asset = this.normalizeSymbol(inv.asset || '');
        const location = this.canonicalizeLocation(inv.location || 'Other');
        const currency = (inv.currency || 'USD').toUpperCase();
        const amount = Number(inv.amount);
        const date = inv.date || new Date().toISOString().split('T')[0];
        if (!asset || !isFinite(amount)) return null;
        let amountUSD;
        let amountEUR;
        if (currency === 'EUR') {
          amountEUR = amount;
          amountUSD = rate > 0 ? amount / rate : 0;
        } else {
          amountUSD = amount;
          amountEUR = rate > 0 ? amount * rate : 0;
        }
        const id = `${asset}_${location}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        return FirebaseService.setDocument(CONFIG.INVESTMENTS_COLLECTION, id, {
          asset,
          location,
          amountUSD,
          amountEUR,
          currency,
          originalAmount: amount,
          date
        });
      })
      .filter(Boolean);

    if (!tasks.length) return;

    try {
      await Promise.all(tasks);
      await this.loadInvestments();
      await this.renderAll(this.state.generatedAt);
      ToastService.success(`${tasks.length} investimentos adicionados`);
    } catch (error) {
      ErrorHandler.handle(error, 'batchAddInvestments');
    }
  }

  async saveManualQuantity(){
    if (this.currentInvestmentSource !== 'manual') return;

    const qtyInput = DOM.$('#inv-qty2');
    if (!qtyInput) {
      ToastService.error('Campo de quantidade nao encontrado');
      return;
    }

    const asset = this.normalizeSymbol(this.currentInvestmentAsset || '');
    const location = this.canonicalizeLocation(this.currentInvestmentLocation || 'Other');
    if (!asset) {
      ToastService.error('Selecione um ativo manual valido');
      return;
    }

    const raw = qtyInput.value.trim();
    if (raw === '') {
      ToastService.error('Introduza uma quantidade valida');
      return;
    }

    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0) {
      ToastService.error('Quantidade invalida');
      return;
    }

    try {
      const manualRow = this.findManualAsset(asset, location);
      const docId = manualRow?.id || this.makeManualDocId(asset, location);
      await FirebaseService.setDocument('cryptoportfolio_manual', docId, {
        asset,
        quantity,
        location
      });

      await this.loadManualAssets();
        await this.loadInvestments();
      await this.renderAll(this.state.generatedAt);

      const updatedRow = this.findManualAsset(asset, location);
      if (updatedRow) {
        const value = updatedRow.quantity ?? 0;
        qtyInput.value = String(value);
        qtyInput.setAttribute('placeholder', `Atual: ${FORMATTERS.quantity.format(value)}`);
      }

      ToastService.success('Quantidade atualizada com sucesso');
    } catch (err) {
      console.error('Erro ao atualizar quantidade manual', err);
      ToastService.error('Erro ao atualizar quantidade');
    }
  }

  async saveApy(){
    const asset = this.normalizeSymbol(this.currentInvestmentAsset || '');
    const location = this.canonicalizeLocation(this.currentInvestmentLocation || '');
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
          ToastService.error('Valor APY invalido');
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

  async batchUpdateAPY(updates = []){
    if (!Array.isArray(updates) || !updates.length) return;
    ToastService.info(`A atualizar ${updates.length} valores APY...`);
    const tasks = updates
      .map(update => {
        const asset = this.normalizeSymbol(update.asset || '');
        const location = this.canonicalizeLocation(update.location || '');
        const apy = Number(update.apy);
        if (!asset || !isFinite(apy)) return null;
        const docId = this.makeApyDocId(asset, location);
        return FirebaseService.setDocument(CONFIG.APY_COLLECTION, docId, {
          asset,
          location,
          apy
        });
      })
      .filter(Boolean);

    if (!tasks.length) return;

    try {
      await Promise.all(tasks);
      await this.loadApyValues();
      await this.renderAll(this.state.generatedAt);
      ToastService.success(`${tasks.length} valores APY atualizados`);
    } catch (error) {
      ErrorHandler.handle(error, 'batchUpdateAPY');
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

  trapFocus(modalElement){
    if (!modalElement) return () => {};
    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusableElements.length) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    modalElement.addEventListener('keydown', handleTabKey);
    return () => modalElement.removeEventListener('keydown', handleTabKey);
  }

  openAddModal(){
    DOM.$('#modal-title').textContent = 'Add asset';
    const assetInput = DOM.$('#m-asset');
    const qtyInput = DOM.$('#m-qty');
    const costInput = DOM.$('#m-cost');
    const locInput = DOM.$('#m-loc');
    if (assetInput) assetInput.value = '';
    if (qtyInput) qtyInput.value = '';
    if (costInput) costInput.value = '0';
    if (locInput) locInput.value = 'Other';
    this.modalCurrency = 'EUR';
    DOM.$('#m-curr-eur').classList.add('active');
    DOM.$('#m-curr-usd').classList.remove('active');
    if (assetInput) DOM.enable(assetInput);
    const modal = this.getCachedElement('modalBackdrop', '#modal-backdrop');
    if (!modal) return;

    if (this._removeFocusTrap) {
      this._removeFocusTrap();
      this._removeFocusTrap = null;
    }
    this._previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    DOM.show(modal);
    if (assetInput) {
      setTimeout(() => assetInput.focus(), 0);
    }

    this._removeFocusTrap = this.trapFocus(modal);
  }

  closeModal(){ 
    const modal = this.getCachedElement('modalBackdrop', '#modal-backdrop');
    if (!modal) return;
    DOM.hide(modal); 
    DOM.enable(DOM.$('#m-asset'));
    if (this._removeFocusTrap) {
      this._removeFocusTrap();
      this._removeFocusTrap = null;
    }
    if (this._previousFocus && typeof this._previousFocus.focus === 'function') {
      try { this._previousFocus.focus(); } catch {}
    }
    this._previousFocus = null;
  }

  async saveModal(){
    const assetInput = DOM.$('#m-asset');
    const qtyInput = DOM.$('#m-qty');
    const costInput = DOM.$('#m-cost');
    const locInput = DOM.$('#m-loc');

    const rawAsset = assetInput?.value || '';
    const asset = this.normalizeSymbol(rawAsset);
    if (assetInput) assetInput.value = asset;

    const rawQty = qtyInput?.value ?? '';
    const qtyNumber = Number(rawQty);
    const qty = ValidationUtils.sanitizeNumber(rawQty, 8);

    const rawCost = costInput?.value ?? '0';
    const costNumber = Number(rawCost);
    const cost = ValidationUtils.sanitizeNumber(rawCost, 2);

    const loc = this.canonicalizeLocation(locInput?.value || 'Other');

    if (!ValidationUtils.isValidAssetSymbol(asset)) {
      ToastService.error('Simbolo de ativo invalido (2-10 caracteres)');
      assetInput?.focus();
      return;
    }

    if (!rawQty || !ValidationUtils.isValidNumber(qtyNumber, 0.00000001)) {
      ToastService.error('Quantidade invalida (minimo 0.00000001)');
      qtyInput?.focus();
      return;
    }

    if (!ValidationUtils.isValidNumber(costNumber, 0)) {
      ToastService.error('Custo invalido');
      costInput?.focus();
      return;
    }

    const optimisticRow = {
      asset,
      quantity: qty,
      location: loc,
      source: 'manual',
      valueUSDT: 0,
      valueEUR: 0,
      priceUSDT: 0,
      apy: null,
      _optimistic: true
    };

    this.state.currentRows.push(optimisticRow);
    this.applyCurrentSort();
    this.renderTable();
    this.closeModal();
    ToastService.info('A guardar...');
    
    try {
      const existingManual = this.findManualAsset(asset, loc);
      const manualDocId = existingManual?.id || this.makeManualDocId(asset, loc);
    
      await FirebaseService.setDocument('cryptoportfolio_manual', manualDocId, { 
        asset, 
        quantity: qty, 
        location: loc 
      });
      
      if (cost > 0) {
        const rate = this.state.usdtToEurRate || 1;
        let amountUSD;
        let amountEUR;
    
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
      await this.renderAll();
      ToastService.success('Asset guardado com sucesso');
      this.announce(`Asset ${asset} guardado com sucesso`);
    } catch (error) {
      this.state.currentRows = this.state.currentRows.filter(r => !r._optimistic);
      this.applyCurrentSort();
      this.renderTable();
      ToastService.error('Erro ao guardar asset');
      console.error(error);
      this.announce(`Erro ao guardar asset ${asset}`, 'assertive');
    }
  }
  async updateManualAssetLocation(asset, previousLocation, newLocation){
    const normalizedAsset = this.normalizeSymbol(asset || '');
    const fromLocation = this.canonicalizeLocation(previousLocation || 'Other');
    const targetLocation = this.canonicalizeLocation(newLocation || 'Other');
    const manualRow = this.findManualAsset(normalizedAsset, fromLocation);

    if (!manualRow) {
      console.warn('Manual asset not found for location update', normalizedAsset, previousLocation);
      return;
    }

    const existingTarget = this.findManualAsset(normalizedAsset, targetLocation);
    if (existingTarget && existingTarget.id !== manualRow.id) {
      const mergedQty = (existingTarget.quantity || 0) + (manualRow.quantity || 0);
      await FirebaseService.setDocument('cryptoportfolio_manual', existingTarget.id, {
        asset: normalizedAsset,
        quantity: mergedQty,
        location: targetLocation
      });
      await FirebaseService.deleteDocument('cryptoportfolio_manual', manualRow.id);
      return;
    }

    const docId = manualRow.id || this.makeManualDocId(normalizedAsset, targetLocation);
    await FirebaseService.setDocument('cryptoportfolio_manual', docId, {
      asset: normalizedAsset,
      quantity: manualRow.quantity || 0,
      location: targetLocation
    });

    if (!manualRow.id && docId !== normalizedAsset) {
      try {
        await FirebaseService.deleteDocument('cryptoportfolio_manual', normalizedAsset);
      } catch (err) {
        console.warn('Falha ao remover documento manual legado', err);
      }
    }
  }

  bindTableEvents(){
    DOM.$$('select[data-asset]').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const asset = e.target.getAttribute('data-asset');
        const loc = this.canonicalizeLocation(e.target.value || 'Other');
        const row = e.target.closest('tr');
        const previousLoc = row?.getAttribute('data-location') || '';
        const prevCanonical = this.canonicalizeLocation(previousLoc || 'Other');
        const source = row?.getAttribute('data-source') || 'binance';
        
        if (source === 'manual') {
          await this.updateManualAssetLocation(asset, prevCanonical, loc);
          await this.loadManualAssets();
        } else {
          const canonicalAsset = this.normalizeSymbol(asset || '');
          await FirebaseService.setDocument('cryptoportfolio', canonicalAsset, { asset: canonicalAsset, location: loc });
          this.state.savedLocations.set(canonicalAsset, loc);
        }
        
        if (row) {
          row.setAttribute('data-location', loc);
          const editBtn = row.querySelector('.btn-edit');
          if (editBtn) editBtn.setAttribute('data-location', loc);
        }
        
        const assetUpperKey = this.normalizeSymbol(asset || '');
        const currentRow = this.state.currentRows.find(r =>
          r.asset === assetUpperKey && this.canonicalizeLocation(r.location || 'Other') === prevCanonical
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

  setupSellModal(){
    const modal = DOM.$('#sell-modal-backdrop');
    DOM.$('#sell-cancel')?.addEventListener('click', ()=>this.closeSellModal());
    DOM.$('#sell-confirm')?.addEventListener('click', ()=>this.confirmSell());
    modal?.addEventListener('click', (e)=>{ if (e.target===modal) this.closeSellModal(); });
  }

  openSellModal(asset, location){
    this.currentSellAsset = this.normalizeSymbol(asset || '');
    this.currentSellLocation = this.canonicalizeLocation(location || 'Other');

    const nameEl = DOM.$('#sell-asset-name');
    if (nameEl) nameEl.textContent = this.currentSellAsset;

    const assetRows = this.state.currentRows.filter(r => r.asset === this.currentSellAsset);

    const updateMaxQuantity = (canonicalLoc) => {
      const maxQtyEl = DOM.$('#sell-max-qty');
      if (!maxQtyEl) return;
      const row = assetRows.find(r => this.canonicalizeLocation(r.location || 'Other') === canonicalLoc);
      maxQtyEl.textContent = row
        ? `Maximo: ${FORMATTERS.quantity.format(row.quantity)}`
        : '';
    };

    const locSelect = DOM.$('#sell-location');
    if (locSelect) {
      const options = assetRows
        .map(r => {
          const canonicalLoc = this.canonicalizeLocation(r.location || 'Other');
          const displayLoc = r.location || canonicalLoc;
          const selectedAttr = canonicalLoc === this.currentSellLocation ? 'selected' : '';
          return `<option value="${this.escape(canonicalLoc)}" ${selectedAttr}>${this.escape(displayLoc)}</option>`;
        })
        .join('');
      locSelect.innerHTML = options;
      locSelect.value = this.currentSellLocation;
      locSelect.onchange = (e) => {
        const selectedLoc = this.canonicalizeLocation(e.target.value || 'Other');
        this.currentSellLocation = selectedLoc;
        updateMaxQuantity(selectedLoc);
      };
      updateMaxQuantity(this.currentSellLocation);
    } else {
      updateMaxQuantity(this.currentSellLocation);
    }

    const qtyInput = DOM.$('#sell-qty');
    if (qtyInput) qtyInput.value = '';
    DOM.show(DOM.$('#sell-modal-backdrop'));
  }

  closeSellModal(){
    DOM.hide(DOM.$('#sell-modal-backdrop'));
    this.currentSellAsset = null;
    this.currentSellLocation = null;
  }

  async confirmSell(){
    try {
      const qtyInput = DOM.$('#sell-qty');
      const sellQty = parseFloat(qtyInput?.value ?? '');
      const locSelect = DOM.$('#sell-location');
      const location = this.canonicalizeLocation(locSelect?.value || this.currentSellLocation || 'Other');

      if (!isFinite(sellQty) || sellQty <= 0) {
        ToastService.error('Por favor, insira uma quantidade valida');
        return;
      }

      const row = this.state.currentRows.find(r =>
        r.asset === this.currentSellAsset &&
        this.canonicalizeLocation(r.location || 'Other') === location
      );

      if (!row) {
        ToastService.error('Ativo nao encontrado');
        return;
      }

      if (sellQty > row.quantity) {
        ToastService.error('Quantidade excede o disponivel');
        return;
      }

      const newQty = row.quantity - sellQty;

      if (row.source === 'manual') {
        const manualRow = this.findManualAsset(row.asset, location);
        if (newQty <= 0) {
          if (manualRow?.id) {
            await FirebaseService.deleteDocument('cryptoportfolio_manual', manualRow.id);
          }
        } else {
          const docId = manualRow?.id || this.makeManualDocId(row.asset, location);
          await FirebaseService.setDocument('cryptoportfolio_manual', docId, {
            asset: row.asset,
            quantity: newQty,
            location
          });
        }

        await this.loadManualAssets();
        await this.loadInvestments();
        await this.renderAll(this.state.generatedAt);
        ToastService.success('Venda registrada com sucesso');
      } else {
        ToastService.error('Nao e possivel vender ativos do Binance diretamente');
        return;
      }

      this.closeSellModal();
    } catch (e) {
      ToastService.error('Erro ao vender ativo');
      console.error(e);
    }
  }
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
    const title = `Portf\u00f3lio Cripto - ${month.charAt(0).toUpperCase()+month.slice(1)} ${now.getFullYear()}`;
    doc.setFont('helvetica','bold'); 
    doc.setFontSize(18);
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
        : [ r.asset, FORMATTERS.quantity.format(r.quantity), `$${FORMATTERS.usd.format(r.valueUSDT||0)}` ]
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

    const t = this.state.totals;
    const totalInv = this.getTotalInvestedAmounts();
    const invEUR = totalInv.eur;
    const invUSD = totalInv.usd;
    const realEUR = (t.eur || 0) - invEUR;
    const realUSD = (t.usdt || 0) - invUSD;

    let y = (doc.lastAutoTable?.finalY || 70) + 25;
    const leftX = marginLeft;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);

    if (mode === 'EUR') {
      const part1 = `Total: ${FORMATTERS.eur.format(t.eur || 0)}   `;
      const part2 = `Investido: ${FORMATTERS.eur.format(invEUR)}   `;
      const sign = realEUR >= 0 ? '+' : 'âˆ’';
      const part3 = `Realizado: ${sign}${FORMATTERS.eur.format(Math.abs(realEUR))}`;

      doc.setTextColor(0, 0, 0);
      doc.text(part1, leftX, y);

      let x2 = leftX + doc.getTextWidth(part1);
      doc.text(part2, x2, y);

      let x3 = x2 + doc.getTextWidth(part2);
      doc.setTextColor(realEUR >= 0 ? 22 : 220, realEUR >= 0 ? 163 : 38, realEUR >= 0 ? 74 : 38);
      doc.text(part3, x3, y);
    } else {
      const part1 = `Total: $${FORMATTERS.usd.format(t.usdt || 0)}   `;
      const part2 = `Investido: $${FORMATTERS.usd.format(invUSD)}   `;
      const sign = realUSD >= 0 ? '+' : 'âˆ’';
      const part3 = `Realizado: ${sign}$${FORMATTERS.usd.format(Math.abs(realUSD))}`;

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

  showError(msg){
    console.error(msg);
    const tb = DOM.$('#rows');
    if (tb) tb.innerHTML = `<tr><td colspan="11" class="text-muted">Error: ${msg}</td></tr>`;
  }
}

export { DOM, ToastService, CryptoPortfolioApp };









