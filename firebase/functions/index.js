// Node 20 runtime (global fetch). CommonJS style for Firebase Functions v2.
const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// ---- Secrets (must be set via `firebase functions:secrets:set ...`)
const BINANCE_KEY = defineSecret("BINANCE_KEY");
const BINANCE_SECRET = defineSecret("BINANCE_SECRET");

// ---- Helpers
function sign(queryString) {
  return crypto.createHmac("sha256", BINANCE_SECRET.value())
               .update(queryString)
               .digest("hex");
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
  async (_req, res) => {
    try {
      // 1) Fetch Spot + Earn (with pagination on Earn)
      const [account, flexRows, lockedRows] = await Promise.all([
        signed("/api/v3/account"),
        fetchAllSimpleEarn("/sapi/v1/simple-earn/flexible/position"),
        fetchAllSimpleEarn("/sapi/v1/simple-earn/locked/position"),
      ]);

      // Spot balances (normalize assets like LDBTC -> BTC just in case)
      const spot = (account.balances || [])
        .map(b => ({ asset: normalizeAsset(b.asset), qty: (+b.free) + (+b.locked) }))
        .filter(b => b.qty > 0);

      // Merge Spot + Earn into a single map
      const byAsset = new Map();
      const add = (asset, qty) => byAsset.set(asset, (byAsset.get(asset) || 0) + qty);

      // Seed with spot
      for (const s of spot) add(s.asset, s.qty);

      // Flexible: sum totalAmount/amount/positionAmount (varies across products)
      for (const p of flexRows) {
        const asset = normalizeAsset(p.asset);
        const amt = Number(p.totalAmount ?? p.amount ?? p.positionAmount ?? 0);
        if (asset && amt > 0) add(asset, amt);
      }

      // Locked: same idea
      for (const p of lockedRows) {
        const asset = normalizeAsset(p.asset);
        const amt = Number(p.totalAmount ?? p.amount ?? p.positionAmount ?? 0);
        if (asset && amt > 0) add(asset, amt);
      }

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
