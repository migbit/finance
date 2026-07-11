const admin = require("firebase-admin");

const ANNUAL_INTEREST_RATE = 0.02;
const MONTHLY_VWCE = 120;
const MONTHLY_AGGH = 30;
const ETF_SYMBOLS = { vwce: "VWCE.DE", aggh: "EUNA.DE" };

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function monthId(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthRange(runDate) {
  const currentStart = new Date(Date.UTC(runDate.getUTCFullYear(), runDate.getUTCMonth(), 1));
  const start = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth() - 1, 1));
  const end = new Date(currentStart.getTime() - 1);
  return { id: monthId(start), start, end, currentId: monthId(currentStart), currentStart };
}

function daysInRange(start, end) {
  return Math.round((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
    - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86400000) + 1;
}

function calculateDailyInterest(openingBalance, movements, start, end, annualRate = ANNUAL_INTEREST_RATE) {
  const ordered = [...movements]
    .filter((item) => item.effectiveAt instanceof Date && item.effectiveAt <= end)
    .sort((a, b) => a.effectiveAt - b.effectiveAt);
  let balance = Number(openingBalance) || 0;
  let interest = 0;
  let movementIndex = 0;
  const daily = [];

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const dayEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59, 999));
    while (movementIndex < ordered.length && ordered[movementIndex].effectiveAt <= dayEnd) {
      const movement = ordered[movementIndex];
      if (movement.type === "set_balance") balance = Number(movement.balance) || 0;
      else balance += Number(movement.amount) || 0;
      movementIndex += 1;
    }
    const dayInterest = Math.max(0, balance) * annualRate / 365;
    interest += dayInterest;
    daily.push({ date: day.toISOString().slice(0, 10), balance: round(balance), interest: dayInterest });
  }

  return { interest: round(interest), closingBalanceBeforeInterest: round(balance), daily };
}

function selectLastClose(series, cutoff) {
  const cutoffId = cutoff.toISOString().slice(0, 10);
  const dates = Object.keys(series || {}).filter((date) => date <= cutoffId).sort().reverse();
  if (!dates.length) throw new Error(`Sem cotação disponível até ${cutoffId}`);
  const values = series[dates[0]];
  const price = Number(values?.["4. close"]);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Cotação inválida para ${dates[0]}`);
  return { date: dates[0], price };
}

async function fetchDailyClose(apiKey, symbol, cutoff) {
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("outputsize", "compact");
  url.searchParams.set("apikey", apiKey);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Alpha Vantage respondeu com ${response.status} para ${symbol}`);
  const payload = await response.json();
  if (payload.Note || payload.Information || payload["Error Message"]) {
    throw new Error(payload.Note || payload.Information || payload["Error Message"]);
  }
  return selectLastClose(payload["Time Series (Daily)"], cutoff);
}

async function loadMovements(firestore, start, end) {
  const snapshot = await firestore.collection("dca_juro_movements")
    .where("effectiveAt", ">=", admin.firestore.Timestamp.fromDate(start))
    .where("effectiveAt", "<=", admin.firestore.Timestamp.fromDate(end))
    .orderBy("effectiveAt", "asc")
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return { ...data, effectiveAt: data.effectiveAt?.toDate?.() || new Date(data.effectiveAt) };
  });
}

async function closePreviousMonthAndOpenCurrent({ firestore, apiKey, runDate = new Date() }) {
  const range = previousMonthRange(runDate);
  const closureRef = firestore.collection("dca_monthly_closures").doc(range.id);
  const existing = await closureRef.get();
  if (existing.exists && existing.data()?.status === "complete") {
    return { skipped: true, month: range.id, reason: "already-complete" };
  }

  const [sharesSnap, interestSnap, monthSnap, vwceQuote, agghQuote] = await Promise.all([
    firestore.collection("dca_settings").doc("shares").get(),
    firestore.collection("dca_juro").doc("current").get(),
    firestore.collection("dca").doc(range.id).get(),
    fetchDailyClose(apiKey, ETF_SYMBOLS.vwce, range.end),
    fetchDailyClose(apiKey, ETF_SYMBOLS.aggh, range.end),
  ]);

  const shares = sharesSnap.data() || {};
  const interestState = interestSnap.data() || {};
  const existingMonth = monthSnap.data() || {};
  const movements = await loadMovements(firestore, range.start, range.end);
  const openingBalance = Number(interestState.periodOpeningBalance ?? interestState.saldo) || 0;
  const interest = calculateDailyInterest(openingBalance, movements, range.start, range.end);
  const balanceAfterInterest = round(interest.closingBalanceBeforeInterest + interest.interest);
  const balanceAfterPurchase = round(balanceAfterInterest - MONTHLY_VWCE - MONTHLY_AGGH);
  const vwceSharesAtClose = Number(shares.vwce) || 0;
  const agghSharesAtClose = Number(shares.aggh) || 0;
  const newVwceShares = round(vwceSharesAtClose + MONTHLY_VWCE / vwceQuote.price, 8);
  const newAgghShares = round(agghSharesAtClose + MONTHLY_AGGH / agghQuote.price, 8);
  const closedAt = admin.firestore.FieldValue.serverTimestamp();

  await firestore.runTransaction(async (transaction) => {
    const latestClosure = await transaction.get(closureRef);
    if (latestClosure.exists && latestClosure.data()?.status === "complete") return;

    transaction.set(firestore.collection("dca").doc(range.id), {
      id: range.id,
      y: range.start.getUTCFullYear(),
      m: range.start.getUTCMonth() + 1,
      swda_value: round(vwceSharesAtClose * vwceQuote.price),
      aggh_value: round(agghSharesAtClose * agghQuote.price),
      cash_interest: interest.interest,
      vwce_shares: vwceSharesAtClose,
      aggh_shares: agghSharesAtClose,
      snapshot_source: "automatic",
      snapshot_status: "closed",
      snapshot_price_date: { vwce: vwceQuote.date, aggh: agghQuote.date },
      snapshot_prices: { vwce: vwceQuote.price, aggh: agghQuote.price },
      closed_at: closedAt,
      manual_swda_value: existingMonth.manual_swda_value ?? null,
      manual_aggh_value: existingMonth.manual_aggh_value ?? null,
    }, { merge: true });

    transaction.set(firestore.collection("dca_settings").doc("shares"), {
      vwce: newVwceShares,
      aggh: newAgghShares,
      updatedAt: closedAt,
      vwceUpdatedAt: closedAt,
      agghUpdatedAt: closedAt,
      automaticPurchaseMonth: range.currentId,
      automaticPurchasePrices: { vwce: vwceQuote.price, aggh: agghQuote.price },
    }, { merge: true });

    transaction.set(firestore.collection("dca_juro").doc("current"), {
      saldo: balanceAfterPurchase,
      taxa: ANNUAL_INTEREST_RATE,
      lastMonthlyInterest: interest.interest,
      lastClosedMonth: range.id,
      periodOpeningBalance: balanceAfterPurchase,
      periodStart: admin.firestore.Timestamp.fromDate(range.currentStart),
      updatedAt: closedAt,
    }, { merge: true });

    transaction.set(closureRef, {
      status: "complete",
      month: range.id,
      currentMonth: range.currentId,
      closedAt,
      daysCalculated: daysInRange(range.start, range.end),
      interest: interest.interest,
      closingBalanceBeforeInterest: interest.closingBalanceBeforeInterest,
      balanceAfterInterest,
      balanceAfterPurchase,
      sharesAtClose: { vwce: vwceSharesAtClose, aggh: agghSharesAtClose },
      prices: { vwce: vwceQuote, aggh: agghQuote },
      purchase: { vwce: MONTHLY_VWCE, aggh: MONTHLY_AGGH },
      sharesAfterPurchase: { vwce: newVwceShares, aggh: newAgghShares },
    }, { merge: true });
  });

  return { skipped: false, month: range.id, interest: interest.interest, balanceAfterPurchase };
}

module.exports = {
  ANNUAL_INTEREST_RATE,
  calculateDailyInterest,
  closePreviousMonthAndOpenCurrent,
  previousMonthRange,
  selectLastClose,
};
