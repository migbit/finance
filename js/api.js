import { CONFIG } from './config.js';
import { db } from './script.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

function getLocalStorageSafe() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class EnhancedStorage {
  static PREFIXES = {
    PRICE: 'price_usd_',
    PORTFOLIO: 'portfolio_data_',
    CACHE_META: 'cache_meta_'
  };

  static setWithTTL(key, value, ttlMs) {
    const store = getLocalStorageSafe();
    if (!store) return false;
    const item = {
      value,
      expires: Date.now() + ttlMs
    };
    try {
      store.setItem(key, JSON.stringify(item));
      return true;
    } catch (err) {
      this.clearExpired();
      try {
        store.setItem(key, JSON.stringify(item));
        return true;
      } catch {
        console.warn('EnhancedStorage: unable to persist item', err);
        return false;
      }
    }
  }

  static getWithTTL(key) {
    const store = getLocalStorageSafe();
    if (!store) return null;
    try {
      const itemStr = store.getItem(key);
      if (!itemStr) return null;
      const item = JSON.parse(itemStr);
      if (item.expires && Date.now() > item.expires) {
        store.removeItem(key);
        return null;
      }
      return item.value;
    } catch {
      return null;
    }
  }

  static clearExpired() {
    const store = getLocalStorageSafe();
    if (!store) return;
    const keysToRemove = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key) continue;
      try {
        const itemStr = store.getItem(key);
        if (!itemStr) continue;
        const item = JSON.parse(itemStr);
        if (item.expires && Date.now() > item.expires) {
          keysToRemove.push(key);
        }
      } catch {
        // skip invalid JSON
      }
    }
    keysToRemove.forEach(key => store.removeItem(key));
  }

  static getCacheSize() {
    const store = getLocalStorageSafe();
    if (!store) return '0.00';
    let total = 0;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key) continue;
      total += key.length + store.getItem(key)?.length || 0;
    }
    return (total / 1024).toFixed(2);
  }

  static async compress(data) {
    const str = JSON.stringify(data);
    if (typeof CompressionStream === 'undefined') {
      return btoa(unescape(encodeURIComponent(str)));
    }
    const blob = new Blob([str]);
    const stream = blob.stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(compressedStream).blob();
    const arrayBuffer = await compressedBlob.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  }

  static async decompress(compressed) {
    try {
      if (typeof DecompressionStream === 'undefined') {
        const text = decodeURIComponent(escape(atob(compressed)));
        return JSON.parse(text);
      }
      const binaryString = atob(compressed);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes]);
      const stream = blob.stream();
      const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
      const decompressedBlob = await new Response(decompressedStream).blob();
      const text = await decompressedBlob.text();
      return JSON.parse(text);
    } catch (error) {
      console.warn('EnhancedStorage: falling back to base64 decode', error);
      const text = decodeURIComponent(escape(atob(compressed)));
      return JSON.parse(text);
    }
  }
}

export const Storage = {
  PREFIXES: { PRICE: 'price_usd_' },
  get: (k) => {
    const store = getLocalStorageSafe();
    if (!store) return null;
    try { return store.getItem(k); } catch { return null; }
  },
  set: (k, v) => {
    const store = getLocalStorageSafe();
    if (!store) return false;
    try { store.setItem(k, v); return true; } catch { return false; }
  },
  getJSON(k) {
    const s = this.get(k);
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  },
  setJSON(k, v) { return this.set(k, JSON.stringify(v)); }
};

export class ApiService {
  static async fetchPortfolio() {
    const tries = [CONFIG.API_URL, CONFIG.CF_URL];
    for (const url of tries) {
      if (!url) continue;
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) return await res.json();
      } catch {
        // ignore, try fallback
      }
    }
    throw new Error('HTTP 404');
  }

  static async fetchWithRetry(url, opt = {}, max = 3) {
    let lastStatus = 0;
    let lastBody = '';
    for (let i = 0; i < max; i++) {
      try {
        if (i > 0) await new Promise(r => setTimeout(r, [0, 500, 1000][i] || 500));
        const res = await fetch(url, opt);
        if (res.status === 429) {
          lastStatus = res.status;
          lastBody = await res.text().catch(() => '');
          await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
          continue;
        }
        if (res.ok) return res;
        lastStatus = res.status;
        lastBody = await res.text().catch(() => '');
      } catch (error) {
        lastBody = error?.message || String(error);
        // try again
      }
    }
    const detail = lastStatus ? `HTTP ${lastStatus}${lastBody ? `: ${lastBody.slice(0, 200)}` : ''}` : lastBody;
    throw new Error(`Failed ${url}${detail ? ` (${detail})` : ''}`);
  }
}

export class CryptoPrices {
  static isFresh(p) {
    return p && p.usd > 0 && (Date.now() - p.ts) < CONFIG.CRYPTO_PRICES.PRICE_TTL_MS;
  }

  static buildUrl(baseUrl, params) {
    const query = new URLSearchParams(params);
    return `${baseUrl}?${query.toString()}`;
  }

  static async fetchUSD(symbol) {
    const up = symbol.toUpperCase();
    const r = await ApiService.fetchWithRetry(this.buildUrl(CONFIG.CRYPTO_PRICES.URL, { symbols: up }));
    const data = await r.json();
    return {
      price: Number(data?.prices?.[up] || 0),
      src: data?.sources?.[up] || 'unknown'
    };
  }

  static async prefetch(symbols) {
    const toFetch = [];
    for (const s of symbols) {
      const up = s.toUpperCase();
      const cached = Storage.getJSON(Storage.PREFIXES.PRICE + up);
      if (!this.isFresh(cached)) toFetch.push(up);
    }
    if (!toFetch.length) return;

    const uniqueSymbols = [...new Set(toFetch)];

    for (let i = 0; i < uniqueSymbols.length; i += CONFIG.CRYPTO_PRICES.BATCH_SIZE) {
      const batchSymbols = uniqueSymbols.slice(i, i + CONFIG.CRYPTO_PRICES.BATCH_SIZE);
      try {
        const url = this.buildUrl(CONFIG.CRYPTO_PRICES.URL, { symbols: batchSymbols.join(',') });
        const response = await ApiService.fetchWithRetry(url);
        const data = await response.json();
        const prices = data?.prices || {};
        const ts = Date.now();
        for (const sym of batchSymbols) {
          const price = Number(prices?.[sym] || 0);
          if (price > 0) {
            Storage.setJSON(Storage.PREFIXES.PRICE + sym, { usd: price, ts });
          }
        }
      } catch (error) {
        console.warn('CryptoPrices.priceFetch failed', error);
      }
      if (i + CONFIG.CRYPTO_PRICES.BATCH_SIZE < uniqueSymbols.length) {
        await new Promise(r => setTimeout(r, CONFIG.CRYPTO_PRICES.RATE_LIMIT_DELAY));
      }
    }
  }

  static getCachedUSD(symbol) {
    const up = symbol.toUpperCase();
    const c = Storage.getJSON(Storage.PREFIXES.PRICE + up);
    return this.isFresh(c) ? c.usd : 0;
  }
}

export class PriceResolver {
  constructor(binancePriceMap) {
    this.binancePriceMap = binancePriceMap;
  }

  async getUSD(symbol) {
    const up = symbol.toUpperCase();
    if (this.binancePriceMap.has(up)) return { price: this.binancePriceMap.get(up), src: 'binance' };
    const cached = CryptoPrices.getCachedUSD(up);
    if (cached > 0) return { price: cached, src: 'cached' };
    const { price, src } = await CryptoPrices.fetchUSD(up);
    if (price > 0) Storage.setJSON(Storage.PREFIXES.PRICE + up, { usd: price, ts: Date.now() });
    return { price, src: price > 0 ? src : 'unknown' };
  }
}

export class FirebaseService {
  static async withRetry(operation, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed:`, error.message);
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  static async getCollection(name) {
    return this.withRetry(async () => {
      const snap = await getDocs(collection(db, name));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
  }

  static async getDocument(name, id) {
    return this.withRetry(async () => {
      const ref = doc(db, name, id);
      const snap = await getDoc(ref);
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    });
  }

  static async setDocument(name, id, data) {
    return this.withRetry(async () => {
      const ref = doc(db, name, id);
      await setDoc(ref, { ...data, updatedAt: new Date() }, { merge: true });
    });
  }

  static async deleteDocument(name, id) {
    return this.withRetry(async () => {
      await deleteDoc(doc(db, name, id));
    });
  }
}
