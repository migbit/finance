export const FILIPA_UID = 'SsNolBpIOxQK1upboCXIUwWlsuV2';
export const FRANCISCA_UID = 'Fg8GKPt6fNb1vXIZf3Eg0xsHQID3';
export const LEONOR_UID = '9d2FHATsREVrX2t5gJDBviNWibv1';

// 21/12/2027 00:00 in Lisbon. Portugal is on UTC in December.
export const INVESTMENTS_RELEASE_AT_MS = Date.UTC(2027, 11, 21, 0, 0, 0);

const FILIPA_BASE_MODULES = new Set([
  'diversos',
  'filipa-ginasio',
  'filipa-alimentacao',
  'alimentacao'
]);

const INVESTMENT_MODULES = new Set([
  'dca',
  'dca-revolut',
  'crypto'
]);

const FAMILY_FINANCE_MODULES = new Set([
  'francisca-financas',
  'leonor-financas',
  'gestao-financas'
]);

const FAMILY_SHARED_MODULES = new Set([
  'francisca-calendario'
]);

const CHILD_PROFILE_BY_UID = new Map([
  [FRANCISCA_UID, { id: 'francisca', groupKey: 'francisca', moduleKey: 'francisca-financas' }],
  [LEONOR_UID, { id: 'leonor', groupKey: 'leonor', moduleKey: 'leonor-financas' }]
]);

function asTime(value) {
  if (value instanceof Date) return value.getTime();
  const time = Number(value);
  return Number.isFinite(time) ? time : Date.now();
}

export function isFilipa(uid) {
  return uid === FILIPA_UID;
}

export function isFrancisca(uid) {
  return uid === FRANCISCA_UID;
}

export function isLeonor(uid) {
  return uid === LEONOR_UID;
}

export function getChildProfile(uid) {
  return CHILD_PROFILE_BY_UID.get(uid) || null;
}

export function isChild(uid) {
  return CHILD_PROFILE_BY_UID.has(uid);
}

export function investmentsReleased(now = Date.now()) {
  return asTime(now) >= INVESTMENTS_RELEASE_AT_MS;
}

export function getModuleAccess(uid, moduleKey, groupKey = '', now = Date.now()) {
  if (!uid) return 'none';

  const childProfile = getChildProfile(uid);
  if (childProfile) {
    if (moduleKey === 'francisca-calendario' && groupKey === 'francisca') return 'write';
    const ownsModule = moduleKey === childProfile.moduleKey;
    return ownsModule && groupKey === childProfile.groupKey
      ? 'write'
      : 'none';
  }

  if (!isFilipa(uid)) return 'write';

  // Future links added to the Filipa group are visible by default. Their data
  // should live below /users/{uid} or receive an explicit Firestore rule.
  if (groupKey === 'filipa' || FILIPA_BASE_MODULES.has(moduleKey)) return 'write';
  if (FAMILY_FINANCE_MODULES.has(moduleKey)) return 'write';
  if (FAMILY_SHARED_MODULES.has(moduleKey)) return 'write';
  if (INVESTMENT_MODULES.has(moduleKey) && investmentsReleased(now)) return 'read';
  return 'none';
}

function isLinkVisibleForUid(link, uid) {
  if (Array.isArray(link.onlyUids) && !link.onlyUids.includes(uid)) return false;
  if (Array.isArray(link.excludeUids) && link.excludeUids.includes(uid)) return false;
  return true;
}

export function filterNavigation(groups, uid, now = Date.now()) {
  if (!uid) return [];

  return groups
    .map(group => ({
      ...group,
      links: group.links.filter(link => (
        isLinkVisibleForUid(link, uid)
        && getModuleAccess(uid, link.key, group.key, now) !== 'none'
      ))
    }))
    .filter(group => group.links.length > 0);
}

export function findModuleGroup(groups, moduleKey, uid, now = Date.now()) {
  const candidateGroups = uid === undefined ? groups : filterNavigation(groups, uid, now);
  return candidateGroups.find(group => group.links.some(link => link.key === moduleKey))?.key || '';
}
