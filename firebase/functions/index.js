const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const BINANCE_KEY = defineSecret("BINANCE_KEY");
const BINANCE_SECRET = defineSecret("BINANCE_SECRET");

function sign(query) {
  return crypto.createHmac("sha256", BINANCE_SECRET.value())
               .update(query)
               .digest("hex");
}

async function signed(path, extra = "") {
  const qs = `timestamp=${Date.now()}&recvWindow=5000${extra ? "&" + extra : ""}`;
  const url = `https://api.binance.com${path}?${qs}&signature=${sign(qs)}`;
  const r = await fetch(url, { headers: { "X-MBX-APIKEY": BINANCE_KEY.value() } });
  const data = await r.json();
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

exports.binancePortfolio = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 20,
    cors: true,
    // 👇 ISTO É O QUE FALTAVA
    secrets: [BINANCE_KEY, BINANCE_SECRET],
  },
  async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).end();
    try {
      const [account, flex, locked] = await Promise.all([
        signed("/api/v3/account"),
        signed("/sapi/v1/simple-earn/flexible/position"),
        signed("/sapi/v1/simple-earn/locked/position"),
      ]);

      const balances = (account.balances || [])
        .map(b => ({ asset: b.asset, free: +b.free, locked: +b.locked }))
        .filter(b => b.free + b.locked > 0);

      res.status(200).json({
        generatedAt: new Date().toISOString(),
        balances,
        simpleEarn: { flexible: flex.rows || [], locked: locked.rows || [] },
      });
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  }
);
