// Node 20 runtime (global fetch). CommonJS style for Firebase Functions v2.
const crypto = require("crypto");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const ACCESS_COLLECTION = "cleaning_hours_access";
const ENTRIES_COLLECTION = "cleaning_hours_entries";

// ---- Secrets (must be set via `firebase functions:secrets:set ...`)
const BINANCE_KEY = defineSecret("BINANCE_KEY");
const BINANCE_SECRET = defineSecret("BINANCE_SECRET");

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

function sanitizeApartment(apartment, allowedApartments) {
  const value = String(apartment || "").trim();
  if (!value) return "";

  const allowed = Array.isArray(allowedApartments)
    ? allowedApartments.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (value === "Ambos") {
    return allowed.includes("123") && allowed.includes("1248") ? "Ambos" : null;
  }

  if (allowed.length && !allowed.includes(value)) {
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
          allowedApartments: Array.isArray(access.allowedApartments) ? access.allowedApartments : [],
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
