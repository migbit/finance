const FILIPA_UID = "SsNolBpIOxQK1upboCXIUwWlsuV2";
const INVESTMENTS_RELEASE_AT_MS = Date.UTC(2027, 11, 21, 0, 0, 0);

function getInvestmentAccess(uid, now = Date.now()) {
  if (!uid) return "none";
  if (uid !== FILIPA_UID) return "write";
  return Number(now) >= INVESTMENTS_RELEASE_AT_MS ? "read" : "none";
}

async function authorizeInvestmentRequest(req, firebaseAuth, now = Date.now()) {
  const authorization = String(req.get("Authorization") || "");
  const idToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!idToken) return { allowed: false, status: 401, access: "none" };

  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const access = getInvestmentAccess(decoded.uid, now);
    return {
      allowed: access !== "none",
      status: access === "none" ? 403 : 200,
      access,
      uid: decoded.uid
    };
  } catch (_) {
    return { allowed: false, status: 401, access: "none" };
  }
}

module.exports = {
  FILIPA_UID,
  INVESTMENTS_RELEASE_AT_MS,
  getInvestmentAccess,
  authorizeInvestmentRequest
};
