const admin = require("firebase-admin");

const ANNUAL_INTEREST_RATE = 0.02;
const CONTRIBUTION_CHANGE_MONTH = "2026-10";
const MONTHLY_CONTRIBUTIONS = {
  previous: { vwce: 120, aggh: 30 },
  current: { vwce: 150, aggh: 50 },
};
const ETF_SYMBOLS = { vwce: ["VWCE.DE"], aggh: ["EUNA.DE", "AGGH.DE"] };
const DEFAULT_AUTOMATION = Object.freeze({
  enabled: true,
  effectiveFrom: CONTRIBUTION_CHANGE_MONTH,
  vwceAmount: 150,
  agghAmount: 50,
  annualInterestRate: ANNUAL_INTEREST_RATE,
  timezone: "Europe/Lisbon",
  day: 1,
  time: "01:10",
});

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

function normalizeAutomation(data = {}) {
  const effectiveFrom = /^\d{4}-\d{2}$/.test(data.effectiveFrom || "")
    ? data.effectiveFrom
    : DEFAULT_AUTOMATION.effectiveFrom;
  const vwceCents = Number.isSafeInteger(data.vwceAmountCents)
    ? data.vwceAmountCents
    : Math.round(Number(data.vwceAmount ?? DEFAULT_AUTOMATION.vwceAmount) * 100);
  const agghCents = Number.isSafeInteger(data.agghAmountCents)
    ? data.agghAmountCents
    : Math.round(Number(data.agghAmount ?? DEFAULT_AUTOMATION.agghAmount) * 100);
  const annualInterestRate = Number(data.annualInterestRate ?? data.interestRate ?? ANNUAL_INTEREST_RATE);
  if (vwceCents < 0 || agghCents < 0 || vwceCents + agghCents <= 0 || !Number.isSafeInteger(vwceCents) || !Number.isSafeInteger(agghCents)) {
    throw new Error("Configuração automática com montantes inválidos");
  }
  if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0 || annualInterestRate > 1) {
    throw new Error("Configuração automática com taxa de juro inválida");
  }
  if ((data.timezone || DEFAULT_AUTOMATION.timezone) !== "Europe/Lisbon"
      || Number(data.day ?? DEFAULT_AUTOMATION.day) !== 1
      || (data.time || DEFAULT_AUTOMATION.time) !== "01:10") {
    throw new Error("Agendamento automático incompatível com a função publicada");
  }
  return {
    enabled: data.enabled !== false,
    effectiveFrom,
    vwceAmount: vwceCents / 100,
    agghAmount: agghCents / 100,
    annualInterestRate,
    timezone: "Europe/Lisbon",
    day: 1,
    time: "01:10",
  };
}

function getMonthlyContributions(month, automationData = null) {
  const automation = normalizeAutomation(automationData || DEFAULT_AUTOMATION);
  if (!automation.enabled) return { vwce: 0, aggh: 0 };
  const plan = month >= automation.effectiveFrom
    ? { vwce: automation.vwceAmount, aggh: automation.agghAmount }
    : MONTHLY_CONTRIBUTIONS.previous;
  return { ...plan };
}

function validateSufficientBalance(availableBalance, contributions) {
  const available = round(availableBalance);
  const required = round((Number(contributions?.vwce) || 0) + (Number(contributions?.aggh) || 0));
  if (available < required) {
    const error = new Error(`Saldo insuficiente: ${available} < ${required}`);
    error.code = "insufficient_balance";
    error.availableBalance = available;
    error.requiredBalance = required;
    throw error;
  }
  return { availableBalance: available, requiredBalance: required };
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

async function fetchDailyCloseWithFallback(apiKey, symbols, cutoff, fetcher = fetchDailyClose) {
  const candidates = Array.isArray(symbols) ? symbols : [symbols];
  let lastError = null;
  for (const symbol of candidates) {
    try {
      return { ...(await fetcher(apiKey, symbol, cutoff)), symbol };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Sem símbolos configurados para obter a cotação");
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
  }).filter((item) => item.includedInOpeningBalance !== true);
}

async function closePreviousMonthAndOpenCurrent({ firestore, apiKey, runDate = new Date() }) {
  const range = previousMonthRange(runDate);
  const closureRef = firestore.collection("dca_monthly_closures").doc(range.id);
  const existing = await closureRef.get();
  if (existing.exists && existing.data()?.status === "complete") {
    return { skipped: true, month: range.id, reason: "already-complete" };
  }

  const [sharesSnap, interestSnap, monthSnap, automationSnap] = await Promise.all([
    firestore.collection("dca_settings").doc("shares").get(),
    firestore.collection("dca_juro").doc("current").get(),
    firestore.collection("dca").doc(range.id).get(),
    firestore.collection("dca_settings").doc("automation").get(),
  ]);

  const shares = sharesSnap.data() || {};
  const interestState = interestSnap.data() || {};
  const existingMonth = monthSnap.data() || {};
  let automation;
  try {
    automation = normalizeAutomation(automationSnap.exists ? automationSnap.data() : DEFAULT_AUTOMATION);
  } catch (configurationError) {
    await closureRef.set({
      status: "failed",
      failureCode: "invalid_automation_configuration",
      month: range.id,
      currentMonth: range.currentId,
      failureMessage: configurationError.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    throw configurationError;
  }
  const movements = await loadMovements(firestore, range.start, range.end);
  const openingBalance = Number(interestState.periodOpeningBalance ?? interestState.saldo) || 0;
  const interest = calculateDailyInterest(openingBalance, movements, range.start, range.end, automation.annualInterestRate);
  const monthlyContributions = getMonthlyContributions(range.currentId, automation);
  const balanceAfterInterest = round(interest.closingBalanceBeforeInterest + interest.interest);
  const requiredBalance = round(monthlyContributions.vwce + monthlyContributions.aggh);
  try {
    validateSufficientBalance(balanceAfterInterest, monthlyContributions);
  } catch (validationError) {
    await closureRef.set({
      status: "failed",
      failureCode: "insufficient_balance",
      month: range.id,
      currentMonth: range.currentId,
      availableBalance: balanceAfterInterest,
      requiredBalance,
      attemptedPurchase: monthlyContributions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    throw new Error(`Saldo insuficiente para o DCA ${range.currentId}: ${balanceAfterInterest} < ${requiredBalance}`);
  }
  let vwceQuote;
  let agghQuote;
  try {
    [vwceQuote, agghQuote] = await Promise.all([
      fetchDailyCloseWithFallback(apiKey, ETF_SYMBOLS.vwce, range.end),
      fetchDailyCloseWithFallback(apiKey, ETF_SYMBOLS.aggh, range.end),
    ]);
  } catch (quoteError) {
    await closureRef.set({
      status: "failed",
      failureCode: "quote_unavailable",
      month: range.id,
      currentMonth: range.currentId,
      failureMessage: String(quoteError.message || quoteError).slice(0, 500),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    throw quoteError;
  }
  const balanceAfterPurchase = round(balanceAfterInterest - monthlyContributions.vwce - monthlyContributions.aggh);
  const vwceSharesAtClose = Number(shares.vwce) || 0;
  const agghSharesAtClose = Number(shares.aggh) || 0;
  const newVwceShares = round(vwceSharesAtClose + monthlyContributions.vwce / vwceQuote.price, 8);
  const newAgghShares = round(agghSharesAtClose + monthlyContributions.aggh / agghQuote.price, 8);
  const closedAt = admin.firestore.FieldValue.serverTimestamp();
  const interestMovementRef = firestore.collection("dca_juro_movements").doc(`interest_${range.id}`);
  const dcaMovementRef = firestore.collection("dca_juro_movements").doc(`dca_${range.currentId}`);

  await firestore.runTransaction(async (transaction) => {
    const latestClosure = await transaction.get(closureRef);
    if (latestClosure.exists && latestClosure.data()?.status === "complete") return;
    const latestSharesSnap = await transaction.get(firestore.collection("dca_settings").doc("shares"));
    const latestInterestSnap = await transaction.get(firestore.collection("dca_juro").doc("current"));
    const latestAutomationSnap = await transaction.get(firestore.collection("dca_settings").doc("automation"));
    const latestSharesData = latestSharesSnap.data() || {};
    const latestInterestData = latestInterestSnap.data() || {};
    const latestAutomation = normalizeAutomation(latestAutomationSnap.exists ? latestAutomationSnap.data() : DEFAULT_AUTOMATION);
    if (Number(latestSharesData.vwce || 0) !== vwceSharesAtClose
        || Number(latestSharesData.aggh || 0) !== agghSharesAtClose
        || Number(latestInterestData.saldo || 0) !== Number(interestState.saldo || 0)
        || latestAutomation.enabled !== automation.enabled
        || latestAutomation.vwceAmount !== automation.vwceAmount
        || latestAutomation.agghAmount !== automation.agghAmount
        || latestAutomation.annualInterestRate !== automation.annualInterestRate) {
      throw new Error("O estado DCA mudou durante o fecho; a operação será repetida em segurança");
    }

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
      taxa: automation.annualInterestRate,
      lastMonthlyInterest: interest.interest,
      lastClosedMonth: range.id,
      periodOpeningBalance: balanceAfterPurchase,
      periodStart: admin.firestore.Timestamp.fromDate(range.currentStart),
      updatedAt: closedAt,
    }, { merge: true });

    transaction.set(interestMovementRef, {
      type: "interest",
      amount: interest.interest,
      balanceAfter: balanceAfterInterest,
      effectiveAt: admin.firestore.Timestamp.fromDate(range.currentStart),
      description: `Juro de ${range.id}`,
      includedInOpeningBalance: true,
      createdAt: closedAt,
    }, { merge: true });
    if (requiredBalance > 0) {
      transaction.set(dcaMovementRef, {
        type: "dca",
        amount: -requiredBalance,
        balanceAfter: balanceAfterPurchase,
        effectiveAt: admin.firestore.Timestamp.fromDate(range.currentStart),
        description: `DCA de ${range.currentId}`,
        includedInOpeningBalance: true,
        createdAt: closedAt,
      }, { merge: true });
    }

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
      purchase: monthlyContributions,
      sharesAfterPurchase: { vwce: newVwceShares, aggh: newAgghShares },
      automation: {
        enabled: automation.enabled,
        effectiveFrom: automation.effectiveFrom,
        annualInterestRate: automation.annualInterestRate,
      },
    }, { merge: true });
  });

  return { skipped: false, month: range.id, interest: interest.interest, balanceAfterPurchase };
}

module.exports = {
  ANNUAL_INTEREST_RATE,
  calculateDailyInterest,
  closePreviousMonthAndOpenCurrent,
  fetchDailyCloseWithFallback,
  getMonthlyContributions,
  normalizeAutomation,
  validateSufficientBalance,
  previousMonthRange,
  selectLastClose,
};
