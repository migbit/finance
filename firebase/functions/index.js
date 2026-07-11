// Node 20 runtime (global fetch). CommonJS style for Firebase Functions v2.
const crypto = require("crypto");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { loadCleaningCalendar } = require("./cleaning-calendar");
const { findPotentialCleaningConflicts } = require("./cleaning-alerts");
const { closePreviousMonthAndOpenCurrent } = require("./dca-monthly");

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const ACCESS_COLLECTION = "cleaning_hours_access";
const ENTRIES_COLLECTION = "cleaning_hours_entries";
const CALENDAR_STATE_COLLECTION = "cleaning_calendar_state";
const CALENDAR_STATE_VERSION = 2;
const CLEANING_ALERT_STATE_COLLECTION = "cleaning_alert_state";
const CLEANING_ALERT_STATE_DOCUMENT = "potential_conflicts";
const CLEANING_ALERT_LOOKAHEAD_DAYS = 90;
const EMAILJS_SERVICE_ID = "service_tuglp9h";
const EMAILJS_TEMPLATE_ID = "template_l516egr";
const EMAILJS_PUBLIC_KEY = "dRbsNarrwt7bsIiDK";
const DEFAULT_ALLOWED_APARTMENTS = ["123", "1248", "Ambos", "Ferro 123", "Ferro 1248", "Ferro Ambos"];
const COINPAPRIKA_BASE_URL = "https://api.coinpaprika.com/v1";
const KRAKEN_BASE_URL = "https://api.kraken.com";
const binanceTickerCache = { data: null, expires: 0 };
const krakenAssetPairsCache = { data: null, expires: 0 };
const krakenTickerCache = { data: new Map(), expires: 0 };
const coinpaprikaCoinsCache = { data: null, expires: 0 };
const coinpaprikaPriceCache = new Map();
let krakenLastNonce = 0;

// ---- Secrets (must be set via `firebase functions:secrets:set ...`)
const BINANCE_KEY = defineSecret("BINANCE_KEY");
const BINANCE_SECRET = defineSecret("BINANCE_SECRET");
const KRAKEN_KEY = defineSecret("KRAKEN_KEY");
const KRAKEN_SECRET = defineSecret("KRAKEN_SECRET");
const ALPHA_VANTAGE_API_KEY = defineSecret("ALPHA_VANTAGE_API_KEY");

// ---- Helpers
function sign(queryString) {
  return crypto.createHmac("sha256", BINANCE_SECRET.value())
               .update(queryString)
               .digest("hex");
}

function applyCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Vary", "Origin");
}

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return null;
  return Math.round(hours * 2) / 2;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim"].includes(normalized)) return true;
    if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
  }
  return Boolean(value);
}

function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch (_) {
    return {};
  }
}

async function findAccessByToken(token) {
  const trimmedToken = String(token || "").trim();
  if (!trimmedToken) return null;

  const directMatch = await firestore
    .collection(ACCESS_COLLECTION)
    .where("shareToken", "==", trimmedToken)
    .limit(1)
    .get();

  if (!directMatch.empty) {
    const docSnap = directMatch.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
  }

  const tokenHash = crypto.createHash("sha256").update(trimmedToken).digest("hex");
  const hashedMatch = await firestore
    .collection(ACCESS_COLLECTION)
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (hashedMatch.empty) return null;
  const docSnap = hashedMatch.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

async function isAuthorizedRequest(req) {
  const authorization = String(req.get("Authorization") || "");
  const idToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (idToken) {
    try {
      await admin.auth().verifyIdToken(idToken);
      return true;
    } catch (_) {
      // A public cleaning-hours token can still authorize the request.
    }
  }

  const access = await findAccessByToken(req.query.token);
  return Boolean(access && access.active !== false);
}

function sanitizeApartment(apartment, allowedApartments) {
  const value = String(apartment || "").trim();
  if (!value) return "";

  const allowed = new Set(DEFAULT_ALLOWED_APARTMENTS);
  if (Array.isArray(allowedApartments)) {
    allowedApartments
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .forEach((item) => allowed.add(item));
  }

  if (value === "Ambos") {
    return allowed.has("123") && allowed.has("1248") ? "Ambos" : null;
  }

  if (value === "Ferro Ambos") {
    return allowed.has("Ferro 123") && allowed.has("Ferro 1248") ? "Ferro Ambos" : null;
  }

  if (!allowed.has(value)) {
    return null;
  }

  return value.slice(0, 80);
}

function sortEntriesByDateDesc(rows) {
  return [...rows].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function buildYearlySummary(rows) {
  const yearsMap = new Map();

  rows.forEach((row) => {
    if (!row || !row.date) return;
    const year = Number(String(row.date).slice(0, 4));
    const monthKey = String(row.date).slice(0, 7);
    if (!year || !monthKey) return;

    if (!yearsMap.has(year)) yearsMap.set(year, new Map());
    const monthsMap = yearsMap.get(year);

    if (!monthsMap.has(monthKey)) {
      const labelDate = new Date(`${monthKey}-01T12:00:00Z`);
      const label = labelDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
      monthsMap.set(monthKey, {
        monthKey,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        totalHours: 0,
        days: [],
      });
    }

    const month = monthsMap.get(monthKey);
    month.totalHours += Number(row.hours || 0);
    month.days.push({
      date: row.date,
      apartment: row.apartment || "",
      hours: Number(row.hours || 0),
    });
  });

  return Array.from(yearsMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, monthsMap]) => ({
      year,
      months: Array.from(monthsMap.values())
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
        .map((month) => ({
          ...month,
          totalHours: Math.round(month.totalHours * 100) / 100,
          days: month.days.sort((a, b) => b.date.localeCompare(a.date)),
        })),
    }));
}

// Map LD* wrappers to the underlying asset for pricing/aggregation (e.g., LDBTC -> BTC)
function normalizeAsset(a) {
  if (!a) return a;
  if (a.startsWith("LD") && a.length > 2) return a.slice(2);
  return a;
}

function normalizeKrakenAssetCode(code) {
  let asset = String(code || "").trim().toUpperCase();
  if (!asset) return asset;

  asset = asset.split(".")[0];
  if (asset === "XXBT") asset = "XBT";
  if (asset === "XXDG") asset = "XDG";
  if (/^[XZ][A-Z0-9]{3,}$/.test(asset)) asset = asset.slice(1);

  const aliases = {
    XBT: "BTC",
    XDG: "DOGE",
    ETH2: "ETH",
    ZUSD: "USD",
    ZEUR: "EUR",
  };
  if (aliases[asset]) return aliases[asset];

  // Kraken Earn may expose strategy-specific balance wrappers such as DOT28/SOL03.
  // They represent the base asset and can duplicate Earn/Allocations rows.
  if (/^[A-Z]{2,10}\d{2,4}$/.test(asset)) {
    asset = asset.replace(/\d+$/, "");
  }

  return aliases[asset] || asset;
}

function krakenAssetExtension(code) {
  const match = String(code || "").trim().toUpperCase().match(/\.([A-Z]+)$/);
  return match ? match[1] : "";
}

function nextKrakenNonce() {
  const now = Date.now() * 1000;
  krakenLastNonce = Math.max(now, krakenLastNonce + 1);
  return String(krakenLastNonce);
}

function krakenSign(path, nonce, body) {
  const encoded = Buffer.from(`${nonce}${body}`);
  const hash = crypto.createHash("sha256").update(encoded).digest();
  const message = Buffer.concat([Buffer.from(path), hash]);
  return crypto
    .createHmac("sha512", Buffer.from(KRAKEN_SECRET.value(), "base64"))
    .update(message)
    .digest("base64");
}

async function krakenPrivate(path, payload = {}) {
  const nonce = nextKrakenNonce();
  const data = { nonce, ...payload };
  const body = new URLSearchParams(data).toString();
  const response = await fetch(`${KRAKEN_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "API-Key": KRAKEN_KEY.value(),
      "API-Sign": krakenSign(path, nonce, body),
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body,
  });
  const json = await response.json().catch(() => ({}));
  const errors = Array.isArray(json?.error) ? json.error.filter(Boolean) : [];
  if (!response.ok || errors.length) {
    throw new Error(errors.length ? errors.join("; ") : `HTTP ${response.status}`);
  }
  return json.result;
}

function getEarnAllocationNativeAmount(item) {
  const total = Number(item?.amount_allocated?.total?.native || 0);
  if (total > 0) return total;

  const states = ["bonding", "allocated", "exit_queue", "unbonding"];
  return states.reduce((sum, state) => {
    const amount = Number(item?.amount_allocated?.[state]?.native || 0);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
}

function getEarnAllocationConvertedAmount(item) {
  const total = Number(item?.amount_allocated?.total?.converted || 0);
  if (total > 0) return total;

  const states = ["bonding", "allocated", "exit_queue", "unbonding"];
  return states.reduce((sum, state) => {
    const amount = Number(item?.amount_allocated?.[state]?.converted || 0);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
}

async function krakenPublic(path, params) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const data = await fetchJson(`${KRAKEN_BASE_URL}${path}${qs}`);
  const errors = Array.isArray(data?.error) ? data.error.filter(Boolean) : [];
  if (errors.length) throw new Error(errors.join("; "));
  return data.result || {};
}

async function getCachedKrakenAssetPairs() {
  if (krakenAssetPairsCache.data && krakenAssetPairsCache.expires > Date.now()) {
    return krakenAssetPairsCache.data;
  }

  const result = await krakenPublic("/0/public/AssetPairs", { assetVersion: "1" });
  const pairs = [];
  for (const [key, info] of Object.entries(result || {})) {
    const base = normalizeKrakenAssetCode(info?.base || "");
    const quote = normalizeKrakenAssetCode(info?.quote || "");
    if (!base || !quote) continue;
    pairs.push({
      key,
      altname: String(info?.altname || ""),
      wsname: String(info?.wsname || ""),
      base,
      quote,
    });
  }

  krakenAssetPairsCache.data = pairs;
  krakenAssetPairsCache.expires = Date.now() + 24 * 60 * 60 * 1000;
  return pairs;
}

async function getKrakenTickerPrices(pairKeys) {
  const keys = [...new Set(pairKeys.filter(Boolean))];
  if (!keys.length) return new Map();

  const cached = new Map();
  const missing = [];
  const cacheFresh = krakenTickerCache.expires > Date.now();
  for (const key of keys) {
    if (cacheFresh && krakenTickerCache.data.has(key)) {
      cached.set(key, krakenTickerCache.data.get(key));
    } else {
      missing.push(key);
    }
  }

  if (missing.length) {
    const result = await krakenPublic("/0/public/Ticker", {
      pair: missing.join(","),
      assetVersion: "1",
    });
    for (const [resultKey, ticker] of Object.entries(result || {})) {
      const price = Number(ticker?.c?.[0] || 0);
      if (price > 0) {
        krakenTickerCache.data.set(resultKey, price);
        cached.set(resultKey, price);
      }
    }
    krakenTickerCache.expires = Date.now() + 60 * 1000;
  }

  return cached;
}

async function getKrakenUsdPrices(symbols) {
  const unique = [...new Set(symbols.map(normalizeKrakenAssetCode).filter(Boolean))];
  const prices = new Map();
  const sources = new Map();

  for (const stable of ["USD", "USDT", "USDC", "DAI"]) {
    if (unique.includes(stable)) {
      prices.set(stable, 1);
      sources.set(stable, "kraken");
    }
  }

  const pairs = await getCachedKrakenAssetPairs();
  const findPair = (base, quotes) => pairs.find((pair) => pair.base === base && quotes.includes(pair.quote));
  const pairRequestKey = (pair) => pair?.wsname || pair?.altname || pair?.key || "";
  const tickerPriceForPair = (tickerPrices, pair) => {
    for (const key of [pairRequestKey(pair), pair?.key, pair?.wsname, pair?.altname]) {
      const price = Number(tickerPrices.get(key) || 0);
      if (price > 0) return price;
    }
    return 0;
  };
  const eurUsdPair = findPair("EUR", ["USD"]);
  const selected = new Map();
  const pairKeys = [];

  if (eurUsdPair) pairKeys.push(pairRequestKey(eurUsdPair));
  for (const symbol of unique) {
    if (prices.has(symbol)) continue;
    const pair = findPair(symbol, ["USD", "USDT", "USDC", "EUR"]);
    if (!pair) continue;
    selected.set(symbol, pair);
    pairKeys.push(pairRequestKey(pair));
  }

  const tickerPrices = await getKrakenTickerPrices(pairKeys);
  const eurUsd = eurUsdPair ? tickerPriceForPair(tickerPrices, eurUsdPair) : 0;

  for (const [symbol, pair] of selected) {
    const price = tickerPriceForPair(tickerPrices, pair);
    if (!(price > 0)) continue;
    let usdPrice = price;
    if (pair.quote === "EUR") usdPrice = eurUsd > 0 ? price * eurUsd : 0;
    if (["USDT", "USDC"].includes(pair.quote)) usdPrice = price;
    if (usdPrice > 0) {
      prices.set(symbol, usdPrice);
      sources.set(symbol, "kraken");
    }
  }

  return { prices, sources };
}

// Signed (private) Binance call
async function signed(path, extra = "") {
  const qs = `timestamp=${Date.now()}&recvWindow=5000${extra ? "&" + extra : ""}`;
  const url = `https://api.binance.com${path}?${qs}&signature=${sign(qs)}`;
  const r = await fetch(url, { headers: { "X-MBX-APIKEY": BINANCE_KEY.value() } });
  const data = await r.json();
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

// Public (market data) Binance call
async function publicCall(path, params) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const r = await fetch(`https://api.binance.com${path}${qs}`);
  const data = await r.json();
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

// Fetch ALL pages for Simple Earn lists
async function fetchAllSimpleEarn(path) {
  const rows = [];
  let current = 1;
  const size = 100;
  while (true) {
    const page = await signed(path, `current=${current}&size=${size}`);
    const pageRows = page?.rows ?? [];
    rows.push(...pageRows);
    if (pageRows.length < size) break; // last page
    current++;
  }
  return rows;
}

function sendMethodNotAllowed(res) {
  res.status(405).json({ error: "Método não permitido." });
}

function parseSymbolsParam(value) {
  return [...new Set(
    String(value || "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)
  )];
}

async function getCachedBinanceTickers() {
  if (binanceTickerCache.data && binanceTickerCache.expires > Date.now()) {
    return binanceTickerCache.data;
  }
  const tickers = await publicCall("/api/v3/ticker/price");
  const prices = new Map([["USDT", 1]]);
  for (const ticker of tickers) {
    const pair = String(ticker.symbol || "");
    if (!pair.endsWith("USDT")) continue;
    const asset = pair.slice(0, -4);
    const price = Number(ticker.price || 0);
    if (asset && price > 0) prices.set(asset, price);
  }
  binanceTickerCache.data = prices;
  binanceTickerCache.expires = Date.now() + 60 * 1000;
  return prices;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "apartments-finance-dashboard/1.0",
      },
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = { error: text };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getCachedCoinpaprikaCoins() {
  if (coinpaprikaCoinsCache.data && coinpaprikaCoinsCache.expires > Date.now()) {
    return coinpaprikaCoinsCache.data;
  }
  const coins = await fetchJson(`${COINPAPRIKA_BASE_URL}/coins`);
  const bySymbol = new Map();
  for (const coin of Array.isArray(coins) ? coins : []) {
    if (!coin?.is_active) continue;
    const symbol = String(coin.symbol || "").toUpperCase();
    const id = String(coin.id || "");
    if (!symbol || !id) continue;
    const existing = bySymbol.get(symbol);
    if (!existing || Number(coin.rank || Infinity) < Number(existing.rank || Infinity)) {
      bySymbol.set(symbol, {
        id,
        symbol,
        rank: Number(coin.rank || Infinity),
      });
    }
  }
  coinpaprikaCoinsCache.data = bySymbol;
  coinpaprikaCoinsCache.expires = Date.now() + 24 * 60 * 60 * 1000;
  return bySymbol;
}

async function fetchCoinpaprikaPrice(symbol) {
  const up = String(symbol || "").toUpperCase();
  const cached = coinpaprikaPriceCache.get(up);
  if (cached && cached.expires > Date.now()) {
    return cached.price;
  }

  const coins = await getCachedCoinpaprikaCoins();
  const coin = coins.get(up);
  if (!coin?.id) return 0;

  const ticker = await fetchJson(`${COINPAPRIKA_BASE_URL}/tickers/${encodeURIComponent(coin.id)}?quotes=USD`);
  const price = Number(ticker?.quotes?.USD?.price || 0);
  if (price > 0) {
    coinpaprikaPriceCache.set(up, { price, expires: Date.now() + 5 * 60 * 1000 });
  }
  return price;
}

exports.cryptoPrices = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 15,
    cors: true,
  },
  async (req, res) => {
    try {
      applyCors(res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }

      const symbols = parseSymbolsParam(req.query.symbols);
      if (!symbols.length || symbols.length > 100 || symbols.some((symbol) => !/^[A-Z0-9]{1,20}$/.test(symbol))) {
        res.status(400).json({ error: "symbols inválido." });
        return;
      }

      const prices = {};
      const sources = {};
      const unresolvedFromKraken = [];

      let kraken = { prices: new Map(), sources: new Map() };
      try {
        kraken = await getKrakenUsdPrices(symbols);
      } catch (error) {
        console.warn("Kraken price lookup failed; falling back to CoinPaprika", error);
      }
      for (const symbol of symbols) {
        const normalized = normalizeKrakenAssetCode(symbol);
        const price = kraken.prices.get(normalized) || 0;
        if (price > 0) {
          prices[symbol] = price;
          sources[symbol] = kraken.sources.get(normalized) || "kraken";
        } else {
          unresolvedFromKraken.push(symbol);
        }
      }

      const unresolved = [];
      await Promise.all(unresolvedFromKraken.map(async (symbol) => {
        try {
          const price = await fetchCoinpaprikaPrice(symbol);
          if (price > 0) {
            prices[symbol] = price;
            sources[symbol] = "coinpaprika";
          } else {
            unresolved.push(symbol);
          }
        } catch (error) {
          console.warn("CoinPaprika price fallback failed", symbol, error);
          unresolved.push(symbol);
        }
      }));

      res.status(200).json({ quote: "USD", prices, sources, missing: unresolved });
    } catch (error) {
      console.error("cryptoPrices error", error);
      res.status(502).json({ error: String(error.message || error) });
    }
  }
);

exports.krakenPortfolio = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 20,
    cors: true,
    secrets: [KRAKEN_KEY, KRAKEN_SECRET],
  },
  async (req, res) => {
    try {
      applyCors(res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }

      const balanceResult = await krakenPrivate("/0/private/Balance");
      const earnResult = await krakenPrivate("/0/private/Earn/Allocations", {
        converted_asset: "USD",
        hide_zero_allocations: "true",
      }).catch((error) => ({ __error: error }));

      const spotByAsset = new Map();
      const extensionByAsset = new Map();
      const earnByAsset = new Map();
      const earnConvertedByAsset = new Map();
      const add = (map, asset, qty) => {
        const normalized = normalizeKrakenAssetCode(asset);
        const amount = Number(qty || 0);
        if (!normalized || !(amount > 0)) return;
        map.set(normalized, (map.get(normalized) || 0) + amount);
      };

      for (const [rawAsset, rawQty] of Object.entries(balanceResult || {})) {
        const qty = Number(rawQty || 0);
        if (!(qty > 0)) continue;
        const asset = normalizeKrakenAssetCode(rawAsset);
        const extension = krakenAssetExtension(rawAsset);
        if (["B", "F", "S", "M"].includes(extension)) {
          add(extensionByAsset, asset, qty);
        } else {
          add(spotByAsset, asset, qty);
        }
      }

      let earnError = null;
      const earnItems = Array.isArray(earnResult?.items) ? earnResult.items : [];
      if (earnResult?.__error) {
        earnError = String(earnResult.__error.message || earnResult.__error);
      } else {
        for (const item of earnItems) {
          const asset = normalizeKrakenAssetCode(item?.native_asset || "");
          const nativeAmount = getEarnAllocationNativeAmount(item);
          const convertedAmount = getEarnAllocationConvertedAmount(item);
          if (asset && nativeAmount > 0) add(earnByAsset, asset, nativeAmount);
          if (asset && convertedAmount > 0) {
            earnConvertedByAsset.set(asset, (earnConvertedByAsset.get(asset) || 0) + convertedAmount);
          }
        }
      }

      for (const [asset, extensionQty] of extensionByAsset) {
        const allocatedQty = earnByAsset.get(asset) || 0;
        const remainder = Math.max(0, extensionQty - allocatedQty);
        if (remainder > 0) add(earnByAsset, asset, remainder);
      }

      const positionAssets = [
        ...new Set([
          ...Array.from(spotByAsset.keys()),
          ...Array.from(earnByAsset.keys()),
          "EUR",
        ]),
      ];
      const krakenPrices = await getKrakenUsdPrices(positionAssets);
      const usdPrices = krakenPrices.prices;
      const priceSources = krakenPrices.sources;

      await Promise.all(positionAssets.map(async (asset) => {
        if (usdPrices.get(asset) > 0) return;
        try {
          const price = await fetchCoinpaprikaPrice(asset);
          if (price > 0) {
            usdPrices.set(asset, price);
            priceSources.set(asset, "coinpaprika");
          }
        } catch (error) {
          console.warn("Portfolio price fallback failed", asset, error);
        }
      }));

      const eurUsd = usdPrices.get("EUR") || 0;
      const eurPerUSD = eurUsd > 0 ? 1 / eurUsd : null;
      const positions = [];
      const pushPosition = (asset, quantity, location, convertedUSD = 0) => {
        const qty = Number(quantity || 0);
        if (!(qty > 0)) return;
        let priceUSDT = Number(usdPrices.get(asset) || 0);
        let valueUSDT = Number(convertedUSD || 0);
        if (!(valueUSDT > 0) && priceUSDT > 0) valueUSDT = qty * priceUSDT;
        if (!(priceUSDT > 0) && valueUSDT > 0) priceUSDT = valueUSDT / qty;
        const valueEUR = asset === "EUR"
          ? qty
          : (eurPerUSD && valueUSDT > 0 ? valueUSDT * eurPerUSD : 0);
        positions.push({
          asset,
          quantity: qty,
          location,
          priceUSDT: priceUSDT || null,
          valueUSDT,
          valueEUR,
          source: "kraken",
          priceSource: priceSources.get(asset) || "unknown",
        });
      };

      for (const [asset, qty] of spotByAsset) {
        pushPosition(asset, qty, "Kraken Spot");
      }
      for (const [asset, qty] of earnByAsset) {
        pushPosition(asset, qty, "Kraken Earn", earnConvertedByAsset.get(asset) || 0);
      }

      positions.sort((a, b) => (b.valueEUR || 0) - (a.valueEUR || 0));
      const totalEUR = positions.reduce((sum, row) => sum + (row.valueEUR || 0), 0);

      res.status(200).json({
        generatedAt: new Date().toISOString(),
        provider: "kraken",
        totals: { EUR: totalEUR },
        positions,
        breakdown: {
          spotCount: spotByAsset.size,
          earnCount: earnByAsset.size,
          earnError,
        },
      });
    } catch (e) {
      console.error("krakenPortfolio error", e);
      res.status(500).json({ error: String(e.message || e) });
    }
  }
);

// ---- Function
exports.binancePortfolio = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 20,
    cors: true,
    secrets: [BINANCE_KEY, BINANCE_SECRET],
  },
  async (req, res) => {
    try {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      // 1) Fetch Spot + Earn (with pagination on Earn)
      const [account, flexRows, lockedRows] = await Promise.all([
        signed("/api/v3/account"),
        fetchAllSimpleEarn("/sapi/v1/simple-earn/flexible/position"),
        fetchAllSimpleEarn("/sapi/v1/simple-earn/locked/position"),
      ]);

      // --- Combine Spot + Simple Earn ---

// Spot: skip LD* because Earn will provide those
const spot = (account.balances || [])
  .filter(b => !String(b.asset).startsWith("LD"))         // <-- important
  .map(b => ({
    asset: /* normalize after filtering */ (b.asset.startsWith("LD") ? b.asset.slice(2) : b.asset),
    qty: (+b.free) + (+b.locked)
  }))
  .filter(b => b.qty > 0);

const byAsset = new Map();
const add = (asset, qty) => byAsset.set(asset, (byAsset.get(asset) || 0) + qty);

// seed with spot
for (const s of spot) add(s.asset, s.qty);

// Flexible Earn
for (const p of flexRows) {
  const asset = (p.asset && p.asset.startsWith("LD")) ? p.asset.slice(2) : p.asset;
  const amt = Number(p.totalAmount ?? p.amount ?? p.positionAmount ?? 0);
  if (asset && amt > 0) add(asset, amt);
}

// Locked Earn
for (const p of lockedRows) {
  const asset = (p.asset && p.asset.startsWith("LD")) ? p.asset.slice(2) : p.asset;
  const amt = Number(p.totalAmount ?? p.amount ?? p.positionAmount ?? 0);
  if (asset && amt > 0) add(asset, amt);
}

// final combined balances
const balances = Array.from(byAsset, ([asset, qty]) => ({ asset, qty }))
  .filter(b => b.qty > 0);


      // 2) Build price map (USDT) and convert to EUR
      const assets = balances.map(b => b.asset);
      const symbols = assets.filter(a => a !== "USDT").map(a => `${a}USDT`);

      // Pull all tickers (cheap and avoids individual calls), plus EURUSDT for conversion
      const [tickers, eurUsdt] = await Promise.all([
        publicCall("/api/v3/ticker/price"),
        publicCall("/api/v3/ticker/price", { symbol: "EURUSDT" }),
      ]);

      const priceUSDT = new Map([["USDT", 1]]);
      for (const t of tickers) {
        // If this symbol is one we care about (ASSETUSDT), store its price as priceUSDT[ASSET]
        if (symbols.includes(t.symbol)) {
          priceUSDT.set(t.symbol.replace("USDT", ""), Number(t.price));
        }
      }
      const eurPerUSDT = eurUsdt && eurUsdt.price ? 1 / Number(eurUsdt.price) : null;

      const positions = balances.map(b => {
        const px = priceUSDT.get(b.asset) ?? (b.asset === "USDT" ? 1 : 0);
        const valueUSDT = b.qty * px;
        const valueEUR = eurPerUSDT ? valueUSDT * eurPerUSDT : null;
        return {
          asset: b.asset,
          quantity: b.qty,
          priceUSDT: px || null,
          valueUSDT,
          valueEUR
        };
      });

      const totalEUR = positions.reduce((s, p) => s + (p.valueEUR || 0), 0);

      // 3) Response
      res.status(200).json({
        generatedAt: new Date().toISOString(),
        totals: { EUR: totalEUR },
        positions,
        breakdown: {
          spot,
          earn: {
            flexibleCount: flexRows.length,
            lockedCount: lockedRows.length
          }
        }
      });
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  }
);

exports.cleaningHours = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 20,
    cors: true,
  },
  async (req, res) => {
    try {
      applyCors(res);

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      const token = req.method === "GET"
        ? req.query.token
        : parseJsonBody(req).token;

      const access = await findAccessByToken(token);
      if (!access || access.active === false) {
        res.status(403).json({ error: "Link inválido ou inativo." });
        return;
      }

      if (req.method === "GET") {
        const requestedDate = String(req.query.date || "").trim();
        const date = isValidDateString(requestedDate)
          ? requestedDate
          : new Date().toISOString().slice(0, 10);

        const entryRef = firestore.collection(ENTRIES_COLLECTION).doc(`${access.employeeId}__${date}`);
        const entrySnap = await entryRef.get();

        const entriesSnap = await firestore
          .collection(ENTRIES_COLLECTION)
          .where("employeeId", "==", access.employeeId)
          .get();

        const allEntries = sortEntriesByDateDesc(
          entriesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        );
        const recentEntries = allEntries.slice(0, 14);
        const yearlySummary = buildYearlySummary(allEntries);

        res.status(200).json({
          employeeId: access.employeeId,
          employeeName: access.employeeName || access.employeeId,
          allowedApartments: Array.from(new Set([
            ...DEFAULT_ALLOWED_APARTMENTS,
            ...(Array.isArray(access.allowedApartments) ? access.allowedApartments : [])
          ])),
          today: date,
          entry: entrySnap.exists ? { id: entrySnap.id, ...entrySnap.data() } : null,
          recentEntries,
          availableYears: yearlySummary.map((item) => item.year),
          yearlySummary,
        });
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Método não permitido." });
        return;
      }

      const body = parseJsonBody(req);
      const date = String(body.date || "").trim();
      if (!isValidDateString(date)) {
        res.status(400).json({ error: "Data inválida." });
        return;
      }

      if (String(body.action || "").trim() === "delete") {
        const docId = `${access.employeeId}__${date}`;
        await firestore.collection(ENTRIES_COLLECTION).doc(docId).delete();
        res.status(200).json({ ok: true, id: docId, deleted: true });
        return;
      }

      const worked = normalizeBoolean(body.worked);
      const hours = worked ? normalizeHours(body.hours) : 0;
      if (hours === null) {
        res.status(400).json({ error: "Número de horas inválido." });
        return;
      }

      const apartment = worked
        ? sanitizeApartment(body.apartment, access.allowedApartments)
        : "";

      if (worked && !apartment) {
        res.status(400).json({ error: "Apartamento inválido." });
        return;
      }

      const docId = `${access.employeeId}__${date}`;
      const docRef = firestore.collection(ENTRIES_COLLECTION).doc(docId);
      const existing = await docRef.get();
      const now = admin.firestore.FieldValue.serverTimestamp();

      await docRef.set({
        employeeId: access.employeeId,
        employeeName: access.employeeName || access.employeeId,
        date,
        worked,
        hours,
        apartment,
        approved: false,
        source: "public_link",
        updatedAt: now,
        createdAt: existing.exists ? existing.data().createdAt || now : now,
      }, { merge: true });

      res.status(200).json({
        ok: true,
        id: docId,
      });
    } catch (error) {
      console.error("cleaningHours error", error);
      res.status(500).json({ error: String(error.message || error) });
    }
  }
);

function todayInLisbon() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatAlertDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    dateStyle: "full",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

async function loadCleaningConflicts() {
  const start = todayInLisbon();
  const calendar = await loadCleaningCalendar(start, CLEANING_ALERT_LOOKAHEAD_DAYS);
  const conflicts = findPotentialCleaningConflicts(
    calendar.calendars,
    start,
    CLEANING_ALERT_LOOKAHEAD_DAYS
  );
  return {
    start,
    days: CLEANING_ALERT_LOOKAHEAD_DAYS,
    generatedAt: calendar.generatedAt,
    conflicts,
  };
}

async function sendCleaningAlertEmail(conflicts) {
  const dateLines = conflicts.map((conflict) =>
    `• ${formatAlertDate(conflict.date)} — o apartamento ${conflict.turnoverApartment} já tem entrada e saída; bloquear manualmente o apartamento ${conflict.atRiskApartment}`
  );
  const message = [
    "Alerta de 2 limpezas em simultâneo",
    "",
    "Existe a possibilidade de duas limpezas em simultâneo:",
    ...dateLines,
  ].join("\n");

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_name: "apartments.oporto@gmail.com",
        from_name: "Apartments Oporto",
        subject: "Alerta de 2 limpezas em simultâneo",
        message,
      },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`EmailJS respondeu com HTTP ${response.status}: ${await response.text()}`);
  }
}

async function checkCleaningAlerts({ sendEmail = true } = {}) {
  const snapshot = await loadCleaningConflicts();
  const stateRef = firestore
    .collection(CLEANING_ALERT_STATE_COLLECTION)
    .doc(CLEANING_ALERT_STATE_DOCUMENT);
  const stateSnap = await stateRef.get();
  const notifiedKeys = new Set(
    Array.isArray(stateSnap.data()?.notifiedKeys) ? stateSnap.data().notifiedKeys : []
  );
  const newConflicts = snapshot.conflicts.filter(
    (conflict) => !notifiedKeys.has(conflict.key)
  );

  try {
    if (sendEmail && newConflicts.length) {
      await sendCleaningAlertEmail(newConflicts);
    }

    const update = {
      conflicts: snapshot.conflicts,
      lookaheadDays: CLEANING_ALERT_LOOKAHEAD_DAYS,
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: admin.firestore.FieldValue.delete(),
    };
    if (sendEmail && newConflicts.length) {
      newConflicts.forEach((conflict) => notifiedKeys.add(conflict.key));
      update.notifiedKeys = [...notifiedKeys]
        .filter((key) => key >= snapshot.start)
        .sort();
      update.lastEmailAt = admin.firestore.FieldValue.serverTimestamp();
      update.lastEmailedDates = newConflicts.map((conflict) => conflict.key);
    }
    await stateRef.set(update, { merge: true });

    return {
      ...snapshot,
      emailSent: sendEmail && newConflicts.length > 0,
      emailedDates: newConflicts.map((conflict) => conflict.date),
    };
  } catch (error) {
    await stateRef.set({
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: String(error.message || error),
    }, { merge: true });
    throw error;
  }
}

exports.cleaningAlertsSchedule = onSchedule(
  {
    schedule: "every 3 hours",
    timeZone: "Europe/Lisbon",
    region: "europe-west1",
    timeoutSeconds: 30,
    maxInstances: 1,
  },
  async () => {
    const result = await checkCleaningAlerts({ sendEmail: true });
    console.log("Cleaning alerts checked", {
      conflicts: result.conflicts.length,
      emailSent: result.emailSent,
      emailedDates: result.emailedDates,
    });
  }
);

// Fecha primeiro o mês anterior e só depois aplica a compra DCA do novo mês.
// 01:10 em Lisboa corresponde sempre ao novo dia também em UTC, incluindo no horário de verão.
exports.dcaMonthlyClose = onSchedule(
  {
    schedule: "10 1 1 * *",
    timeZone: "Europe/Lisbon",
    region: "europe-west1",
    timeoutSeconds: 90,
    maxInstances: 1,
    retryCount: 2,
    secrets: [ALPHA_VANTAGE_API_KEY],
  },
  async () => {
    const result = await closePreviousMonthAndOpenCurrent({
      firestore,
      apiKey: ALPHA_VANTAGE_API_KEY.value(),
      runDate: new Date(),
    });
    console.log("DCA monthly close", result);
  }
);

exports.cleaningAlerts = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 30,
    cors: true,
  },
  async (req, res) => {
    try {
      applyCors(res);

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (!["GET", "POST"].includes(req.method)) {
        res.status(405).json({ error: "Método não permitido." });
        return;
      }
      if (!(await isAuthorizedRequest(req))) {
        res.status(401).json({ error: "Inicie sessão para consultar os alertas." });
        return;
      }

      if (req.method === "POST") {
        res.status(200).json(await checkCleaningAlerts({ sendEmail: true }));
        return;
      }

      const snapshot = await loadCleaningConflicts();
      const stateSnap = await firestore
        .collection(CLEANING_ALERT_STATE_COLLECTION)
        .doc(CLEANING_ALERT_STATE_DOCUMENT)
        .get();
      const state = stateSnap.data() || {};
      res.status(200).json({
        ...snapshot,
        lastCheckedAt: state.lastCheckedAt?.toDate?.().toISOString() || null,
        lastEmailAt: state.lastEmailAt?.toDate?.().toISOString() || null,
        lastEmailedDates: state.lastEmailedDates || [],
        lastError: state.lastError || null,
      });
    } catch (error) {
      console.error("cleaningAlerts error", error);
      res.status(502).json({ error: "Não foi possível verificar os alertas de limpeza." });
    }
  }
);

exports.cleaningCalendar = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 20,
    cors: true,
  },
  async (req, res) => {
    try {
      applyCors(res);

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "GET") {
        res.status(405).json({ error: "Método não permitido." });
        return;
      }

      const authorization = String(req.get("Authorization") || "");
      const idToken = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : "";
      let authorized = false;

      if (idToken) {
        try {
          await admin.auth().verifyIdToken(idToken);
          authorized = true;
        } catch (_) {
          authorized = false;
        }
      }

      if (!authorized) {
        const access = await findAccessByToken(req.query.token);
        authorized = Boolean(access && access.active !== false);
      }

      if (!authorized) {
        res.status(401).json({ error: "Link inválido ou sessão expirada." });
        return;
      }

      const start = String(req.query.start || "").trim();
      if (!isValidDateString(start)) {
        res.status(400).json({ error: "Data inicial inválida." });
        return;
      }

      const calendar = await loadCleaningCalendar(start, 14);
      calendar.calendars = await Promise.all(calendar.calendars.map(async (item) => {
        const stateRef = firestore.collection(CALENDAR_STATE_COLLECTION).doc(item.apartment);
        const stateSnap = await stateRef.get();
        const hasCurrentState =
          stateSnap.exists &&
          stateSnap.data()?.sourceVersion === CALENDAR_STATE_VERSION;
        const storedBookings = hasCurrentState && Array.isArray(stateSnap.data()?.bookings)
          ? stateSnap.data().bookings.filter((booking) =>
              isValidDateString(booking?.start) && isValidDateString(booking?.end)
            )
          : [];
        const storedTurnovers = hasCurrentState && Array.isArray(stateSnap.data()?.inferredTurnovers)
          ? stateSnap.data().inferredTurnovers.filter(isValidDateString)
          : [];
        const storedPrevious = [...storedBookings]
          .filter((booking) => booking.start < start)
          .sort((a, b) => b.end.localeCompare(a.end))[0];
        const bookings = deduplicateBookings([
          ...item.bookings,
          ...(storedPrevious ? [storedPrevious] : []),
        ]).sort((a, b) => a.start.localeCompare(b.start));
        const shouldInferTurnover =
          !hasCurrentState &&
          !bookings.some((booking) => booking.end === start) &&
          bookings.some((booking) => booking.start === start);
        const inferredTurnovers = Array.from(new Set([
          ...storedTurnovers,
          ...(shouldInferTurnover ? [start] : []),
        ]));

        await stateRef.set({
          apartment: item.apartment,
          bookings,
          inferredTurnovers,
          sourceVersion: CALENDAR_STATE_VERSION,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return {
          apartment: item.apartment,
          bookings,
          assumeTurnoverToday: inferredTurnovers.includes(start),
        };
      }));

      res.set("Cache-Control", "private, no-store");
      res.status(200).json(calendar);
    } catch (error) {
      console.error("cleaningCalendar error", error);
      res.status(502).json({ error: "Não foi possível carregar os calendários Airbnb." });
    }
  }
);

function deduplicateBookings(bookings) {
  const unique = new Map();
  bookings.forEach((booking) => {
    if (!isValidDateString(booking?.start) || !isValidDateString(booking?.end)) return;
    unique.set(`${booking.start}|${booking.end}`, {
      start: booking.start,
      end: booking.end,
    });
  });
  return Array.from(unique.values());
}
