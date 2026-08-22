export const FILIPA_UID = 'SsNolBpIOxQK1upboCXIUwWlsuV2';

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

function asTime(value) {
  if (value instanceof Date) return value.getTime();
  const time = Number(value);
  return Number.isFinite(time) ? time : Date.now();
}

export function isFilipa(uid) {
  return uid === FILIPA_UID;
}

export function investmentsReleased(now = Date.now()) {
  return asTime(now) >= INVESTMENTS_RELEASE_AT_MS;
}

export function getModuleAccess(uid, moduleKey, groupKey = '', now = Date.now()) {
  if (!uid) return 'none';
  if (!isFilipa(uid)) return 'write';

  // Future links added to the Filipa group are visible by default. Their data
  // should live below /users/{uid} or receive an explicit Firestore rule.
  if (groupKey === 'filipa' || FILIPA_BASE_MODULES.has(moduleKey)) return 'write';
  if (INVESTMENT_MODULES.has(moduleKey) && investmentsReleased(now)) return 'read';
  return 'none';
}

export function filterNavigation(groups, uid, now = Date.now()) {
  if (!uid) return [];
  if (!isFilipa(uid)) return groups;

  return groups
    .map(group => ({
      ...group,
      links: group.links.filter(link => getModuleAccess(uid, link.key, group.key, now) !== 'none')
    }))
    .filter(group => group.links.length > 0);
}

export function findModuleGroup(groups, moduleKey) {
  return groups.find(group => group.links.some(link => link.key === moduleKey))?.key || '';
}
