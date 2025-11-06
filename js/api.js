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

export class EnhancedStorage {
  static PREFIXES = {
    PRICE: 'price_usd_',
    COINGECKO_ID: 'cg_id_',
    PORTFOLIO: 'portfolio_data_',
    CACHE_META: 'cache_meta_'
  };

  static setWithTTL(key, value, ttlMs) {
    const item = {
      value,
      expires: Date.now() + ttlMs
    };
    try {
      localStorage.setItem(key, JSON.stringify(item));
      return true;
    } catch (err) {
      this.clearExpired();
      try {
        localStorage.setItem(key, JSON.stringify(item));
        return true;
      } catch {
        console.warn('EnhancedStorage: unable to persist item', err);
        return false;
      }
    }
  }

  static getWithTTL(key) {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;
      const item = JSON.parse(itemStr);
      if (item.expires && Date.now() > item.expires) {
        localStorage.removeItem(key);
        return null;
      }
      return item.value;
    } catch {
      return null;
    }
  }

  static clearExpired() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      try {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) continue;
        const item = JSON.parse(itemStr);
        if (item.expires && Date.now() > item.expires) {
          keysToRemove.push(key);
        }
      } catch {
        // skip invalid JSON
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  static getCacheSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      total += key.length + localStorage.getItem(key)?.length || 0;
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
  PREFIXES: { PRICE: 'price_usd_', COINGECKO_ID: 'cg_id_' },
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
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
    for (let i = 0; i < max; i++) {
      try {
        if (i > 0) await new Promise(r => setTimeout(r, [0, 500, 1000][i] || 500));
        const res = await fetch(url, opt);
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
          continue;
        }
        if (res.ok) return res;
      } catch {
        // try again
      }
    }
    throw new Error(`Failed ${url}`);
  }
}

export class Coingecko {
  static isFresh(p) {
    return p && p.usd > 0 && (Date.now() - p.ts) < CONFIG.COINGECKO.PRICE_TTL_MS;
  }

  static async resolveId(symbol) {
    const key = Storage.PREFIXES.COINGECKO_ID + symbol.toUpperCase();
    const cached = Storage.get(key);
    if (cached) return cached;

    const r = await ApiService.fetchWithRetry(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`);
    const data = await r.json();
    const coins = data?.coins || [];
    const exact = coins.find(c => c.symbol?.toUpperCase() === symbol.toUpperCase());
    const sw = coins.find(c => c.symbol?.toUpperCase().startsWith(symbol.toUpperCase()));
    const id = exact?.id || sw?.id || coins[0]?.id || null;
    if (id) Storage.set(key, id);
    return id;
  }

  static async fetchUSD(id) {
    const r = await ApiService.fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`);
    const j = await r.json();
    return Number(j?.[id]?.usd || 0);
  }

  static async prefetch(symbols) {
    const toFetch = [];
    for (const s of symbols) {
      const up = s.toUpperCase();
      const cached = Storage.getJSON(Storage.PREFIXES.PRICE + up);
      if (!this.isFresh(cached)) toFetch.push(up);
    }
    if (!toFetch.length) return;

    const queue = [...new Set(toFetch)];
    const pairs = [];
    const concurrency = Math.min(4, queue.length);
    const takeNext = () => queue.pop();
    const workers = Array.from({ length: concurrency }, () => (async () => {
      while (true) {
        const symbol = takeNext();
        if (!symbol) break;
        try {
          const id = await this.resolveId(symbol);
          if (id) pairs.push([symbol, id]);
        } catch (error) {
          console.warn('Coingecko.resolveId failed', symbol, error);
        } finally {
          if (queue.length) {
            const delay = Math.max(150, Math.floor(CONFIG.COINGECKO.RATE_LIMIT_DELAY / 6));
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }
    })());
    await Promise.all(workers);

    if (!pairs.length) return;

    for (let i = 0; i < pairs.length; i += CONFIG.COINGECKO.BATCH_SIZE) {
      const batchPairs = pairs.slice(i, i + CONFIG.COINGECKO.BATCH_SIZE);
      const ids = batchPairs.map(([, id]) => id).filter(Boolean);
      if (!ids.length) continue;
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
        const response = await ApiService.fetchWithRetry(url);
        const data = await response.json();
        const ts = Date.now();
        for (const [sym, id] of batchPairs) {
          const price = Number(data?.[id]?.usd || 0);
          if (price > 0) {
            Storage.setJSON(Storage.PREFIXES.PRICE + sym, { usd: price, ts });
          }
        }
      } catch (error) {
        console.warn('Coingecko.priceFetch failed', error);
      }
      if (i + CONFIG.COINGECKO.BATCH_SIZE < pairs.length) {
        await new Promise(r => setTimeout(r, CONFIG.COINGECKO.RATE_LIMIT_DELAY));
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
    const cached = Coingecko.getCachedUSD(up);
    if (cached > 0) return { price: cached, src: 'coingecko' };
    const id = await Coingecko.resolveId(up);
    if (!id) return { price: 0, src: 'unknown' };
    const p = await Coingecko.fetchUSD(id);
    if (p > 0) Storage.setJSON(Storage.PREFIXES.PRICE + up, { usd: p, ts: Date.now() });
    return { price: p, src: 'coingecko' };
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
