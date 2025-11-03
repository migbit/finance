import { CONFIG } from './config.js';

export class AppState {
  constructor() {
    this.savedLocations = new Map();
    this.manualAssets = [];
    this.binanceRows = [];
    this.binancePriceMap = new Map();
    this.usdtToEurRate = 0;
    this.apyValues = new Map();
    this.hideSmall = true;
    this.currentRows = [];
    this.currency = 'EUR';
    this.investedUSD = 0;
    this.investedEUR = 0;
    this.investments = new Map();
    this.monthlyTotals = [];
    this.monthlyChart = null;
    this.topAssetsChart = null;
    this.monthlyAssetSnapshots = [];
    this.baselineAssetMonth = null;
    this.dataSource = 'unknown';
    this.lastUpdated = null;
    this.cacheRestoredAt = null;
    this.modalCurrency = 'EUR';
    this.sortColumn = null;
    this.sortDirection = null;
    this.generatedAt = null;
  }

  get visibleRows() {
    return this.hideSmall
      ? this.currentRows.filter(r => (r.valueUSDT || 0) >= CONFIG.SMALL_USD_THRESHOLD)
      : this.currentRows;
  }

  get totals() {
    return this.currentRows.reduce(
      (t, r) => ({
        eur: t.eur + (r.valueEUR || 0),
        usdt: t.usdt + (r.valueUSDT || 0)
      }),
      { eur: 0, usdt: 0 }
    );
  }
}
