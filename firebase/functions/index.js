const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const BINANCE_KEY = defineSecret("BINANCE_KEY");
const BINANCE_SECRET = defineSecret("BINANCE_SECRET");

function sign(query) {
  return crypto.createHmac("sha256", BINANCE_SECRET.value()).update(query).digest("hex");
}

// Signed private calls
async function signed(path, extra = "") {
  const qs = `timestamp=${Date.now()}&recvWindow=5000${extra ? "&" + extra : ""}`;
  const url = `https://api.binance.com${path}?${qs}&signature=${sign(qs)}`;
  const r = await fetch(url, { headers: { "X-MBX-APIKEY": BINANCE_KEY.value() } });
  const data = await r.json();
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

// Public market data (no key)
async function publicCall(path, params) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const r = await fetch(`https://api.binance.com${path}${qs}`);
  const data = await r.json();
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

exports.binancePortfolio = onRequest(
  { region: "europe-west1", timeoutSeconds: 20, cors: true, secrets: [BINANCE_KEY, BINANCE_SECRET] },
  async (req, res) => {
    try {
      // 1) balances + simple earn
      const [account, flex, locked] = await Promise.all([
        signed("/api/v3/account"),
        signed("/sapi/v1/simple-earn/flexible/position"),
        signed("/sapi/v1/simple-earn/locked/position"),
      ]);

      const balances = (account.balances || [])
        .map(b => ({ asset: b.asset, qty: (+b.free) + (+b.locked) }))
        .filter(b => b.qty > 0);

      // 2) build price map in USDT and convert to EUR
      const assets = balances.map(b => b.asset);
      const symbols = assets
        .filter(a => a !== "USDT")
        .map(a => `${a}USDT`);

      // fetch prices for all symbols at once
      // fallback: treat USDT=1
      const [tickers, eurUsdt] = await Promise.all([
        publicCall("/api/v3/ticker/price"),
        publicCall("/api/v3/ticker/price", { symbol: "EURUSDT" }),
      ]);

      const priceMapUSDT = new Map();
      priceMapUSDT.set("USDT", 1);
      for (const t of tickers) {
        if (symbols.includes(t.symbol)) priceMapUSDT.set(t.symbol.replace("USDT",""), Number(t.price));
      }
      const eurPerUSDT = eurUsdt && eurUsdt.price ? 1 / Number(eurUsdt.price) : null;

      const positions = balances.map(b => {
        const pxUSDT = priceMapUSDT.get(b.asset) ?? (b.asset === "USDT" ? 1 : 0);
        const valueUSDT = b.qty * pxUSDT;
        const valueEUR = eurPerUSDT ? valueUSDT * eurPerUSDT : null;
        return {
          asset: b.asset,
          quantity: b.qty,
          priceUSDT: pxUSDT || null,
          valueUSDT,
          valueEUR
        };
      });

      const totalEUR = positions.reduce((s, p) => s + (p.valueEUR || 0), 0);

      res.status(200).json({
        generatedAt: new Date().toISOString(),
        totals: { EUR: totalEUR },
        positions,
        simpleEarn: {
          flexible: (flex.rows || []),
          locked: (locked.rows || [])
        }
      });
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  }
);
