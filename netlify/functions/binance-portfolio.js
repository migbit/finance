// netlify/functions/binance-portfolio.js
const crypto = require("node:crypto");

const API_BASE = "https://api.binance.com";

function sign(queryString) {
  return crypto
    .createHmac("sha256", process.env.BINANCE_SECRET)
    .update(queryString)
    .digest("hex");
}

async function signed(path, extra = "") {
  const qs = `timestamp=${Date.now()}&recvWindow=5000${extra ? "&" + extra : ""}`;
  const url = `${API_BASE}${path}?${qs}&signature=${sign(qs)}`;
  const r = await fetch(url, { headers: { "X-MBX-APIKEY": process.env.BINANCE_KEY } });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

function corsHeaders() {
  const origin = process.env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  try {
    // Get balances + Simple Earn positions
    const [account, flex, locked] = await Promise.all([
      signed("/api/v3/account"),
      signed("/sapi/v1/simple-earn/flexible/position"),
      signed("/sapi/v1/simple-earn/locked/position"),
    ]);

    const balances = (account.balances || [])
      .map((b) => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
      }))
      .filter((b) => b.free + b.locked > 0);

    const payload = {
      generatedAt: new Date().toISOString(),
      balances,
      simpleEarn: {
        flexible: flex.rows || [],
        locked: locked.rows || [],
      },
    };

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(payload, null, 2),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: String(e.message || e) }),
    };
  }
};
