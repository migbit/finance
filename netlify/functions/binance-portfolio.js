// netlify/functions/binance-portfolio.js
const crypto = require("node:crypto");

const { BINANCE_KEY, BINANCE_SECRET, CORS_ORIGIN } = process.env;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders(), body: "" };

  // NEW: env guard
  if (!BINANCE_KEY || !BINANCE_SECRET) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: "Missing environment variables",
        have: {
          BINANCE_KEY: !!BINANCE_KEY,
          BINANCE_SECRET: !!BINANCE_SECRET,
        },
        hint: "Set them in Site settings → Environment variables (Scope: Production; Applies to: Functions/Runtime), then Clear cache and deploy.",
      }),
    };
  }

  const API_BASE = "https://api.binance.com";
  const sign = (qs) => crypto.createHmac("sha256", BINANCE_SECRET).update(qs).digest("hex");
  const signed = async (path, extra = "") => {
    const qs = `timestamp=${Date.now()}&recvWindow=5000${extra ? "&" + extra : ""}`;
    const url = `${API_BASE}${path}?${qs}&signature=${sign(qs)}`;
    const r = await fetch(url, { headers: { "X-MBX-APIKEY": BINANCE_KEY } });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    return data;
  };

  try {
    const [account, flex, locked] = await Promise.all([
      signed("/api/v3/account"),
      signed("/sapi/v1/simple-earn/flexible/position"),
      signed("/sapi/v1/simple-earn/locked/position"),
    ]);

    const balances = (account.balances || [])
      .map((b) => ({ asset: b.asset, free: +b.free, locked: +b.locked }))
      .filter((b) => b.free + b.locked > 0);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          balances,
          simpleEarn: { flexible: flex.rows || [], locked: locked.rows || [] },
        },
        null,
        2
      ),
    };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
