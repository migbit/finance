const DIMENSION_WEIGHTS = Object.freeze({
  beliefSystems: 1.2,
  traditions: 1,
  families: 1.35,
  attentionModes: 1.35,
  anchors: 1.25,
  features: 1.1,
  goals: 0.8,
  positions: 0.7,
  flexibility: 0.65,
  difficulty: 0.45,
  intensity: 0.45,
  psilocybin: 0.6
});

const DEFAULT_PREFERENCES = Object.freeze({
  flexibility: { low: 1, medium: 0.35, high: -0.2 },
  positions: {
    chair: 0.75,
    lying: 0.55,
    standing: 0.2,
    walking: 0.15,
    movement: 0.05,
    kneeling: -0.15,
    'cushion-cross-legged': -0.3
  }
});

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toValues(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean);
  if (typeof value === 'boolean') return [String(value)];
  const normalized = normalizeText(value);
  return normalized ? [normalized] : [];
}

function unique(values) {
  return [...new Set(values)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCompletedSessions(sessions) {
  return (Array.isArray(sessions) ? sessions : []).filter(session =>
    session?.status === 'completed'
    && session.rating !== null
    && session.rating !== ''
    && session.rating !== undefined
    && Number.isInteger(Number(session.rating))
    && Number(session.rating) >= 0
    && Number(session.rating) <= 20
  );
}

export function aggregateProgress(catalog, sessions) {
  const byMeditation = new Map();
  getCompletedSessions(sessions).forEach(session => {
    if (!byMeditation.has(session.meditationId)) byMeditation.set(session.meditationId, []);
    byMeditation.get(session.meditationId).push(session);
  });

  return new Map((Array.isArray(catalog) ? catalog : []).map(meditation => {
    const rows = byMeditation.get(meditation.id) || [];
    const ratings = rows.map(row => Number(row.rating));
    const averageRating = ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : null;
    const timestamps = rows.map(row => {
      const raw = row.completedAtMs ?? row.completedAt?.toMillis?.() ?? row.completedAt ?? row.updatedAt?.toMillis?.() ?? row.updatedAt;
      const parsed = typeof raw === 'number' ? raw : Date.parse(raw || '');
      return Number.isFinite(parsed) ? parsed : 0;
    });
    return [meditation.id, {
      tried: rows.length > 0,
      sessionCount: rows.length,
      averageRating,
      lastCompletedAt: Math.max(0, ...timestamps),
      sessions: rows.sort((a, b) => {
        const aTime = a.completedAtMs ?? a.completedAt?.toMillis?.() ?? (Date.parse(a.completedAt || '') || 0);
        const bTime = b.completedAtMs ?? b.completedAt?.toMillis?.() ?? (Date.parse(b.completedAt || '') || 0);
        return bTime - aTime;
      })
    }];
  }));
}

export function buildTasteProfile(catalog, sessions) {
  const byId = new Map((Array.isArray(catalog) ? catalog : []).map(item => [item.id, item]));
  const completed = getCompletedSessions(sessions);
  const perMeditation = new Map();
  completed.forEach(session => {
    if (!perMeditation.has(session.meditationId)) perMeditation.set(session.meditationId, []);
    perMeditation.get(session.meditationId).push(Number(session.rating));
  });

  const profile = {};
  Object.keys(DIMENSION_WEIGHTS).forEach(dimension => { profile[dimension] = new Map(); });

  perMeditation.forEach((ratings, meditationId) => {
    const meditation = byId.get(meditationId);
    if (!meditation) return;
    const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
    const signal = clamp((average - 10) / 10, -1, 1);
    Object.keys(DIMENSION_WEIGHTS).forEach(dimension => {
      const values = toValues(meditation[dimension]);
      values.forEach(value => {
        const current = profile[dimension].get(value) || { weighted: 0, count: 0 };
        current.weighted += signal;
        current.count += 1;
        profile[dimension].set(value, current);
      });
    });
  });

  return {
    completedTechniqueCount: [...perMeditation.keys()].filter(meditationId => byId.has(meditationId)).length,
    dimensions: profile
  };
}

function scoreDefaultPreference(meditation) {
  const flexibility = DEFAULT_PREFERENCES.flexibility[normalizeText(meditation.flexibility)] || 0;
  const positions = toValues(meditation.positions);
  const position = positions.length
    ? Math.max(...positions.map(item => DEFAULT_PREFERENCES.positions[item] || 0))
    : 0;
  return flexibility + position;
}

export function scoreMeditation(meditation, profile) {
  const learned = profile?.completedTechniqueCount >= 5;
  let weightedScore = 0;
  let totalWeight = 0;
  const reasons = [];

  if (learned) {
    Object.entries(DIMENSION_WEIGHTS).forEach(([dimension, dimensionWeight]) => {
      const values = toValues(meditation[dimension]);
      const matches = values.map(value => {
        const signal = profile.dimensions?.[dimension]?.get(value);
        if (!signal) return null;
        return { value, score: signal.weighted / signal.count };
      }).filter(Boolean);
      if (!matches.length) return;
      const best = matches.sort((a, b) => b.score - a.score)[0];
      weightedScore += best.score * dimensionWeight;
      totalWeight += dimensionWeight;
      if (best.score > 0.18) reasons.push({ dimension, value: best.value, strength: best.score });
    });
  }

  const learnedSignal = totalWeight ? weightedScore / totalWeight : 0;
  const ergonomicSignal = clamp(scoreDefaultPreference(meditation) / 1.75, -1, 1);
  const combined = learned ? learnedSignal * 0.88 + ergonomicSignal * 0.12 : ergonomicSignal;
  const compatibility = learned
    ? Math.round(clamp(50 + combined * 45, 5, 95))
    : null;

  return {
    compatibility,
    learned,
    reasons: reasons.sort((a, b) => b.strength - a.strength).slice(0, 3),
    rawScore: combined,
    ergonomicScore: ergonomicSignal
  };
}

function seededExploration(id, sessionCount) {
  let hash = 2166136261;
  const input = `${id}:${sessionCount}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function recommendCatalog(catalog, sessions, options = {}) {
  const list = Array.isArray(catalog) ? catalog : [];
  const progress = aggregateProgress(list, sessions);
  const profile = buildTasteProfile(list, sessions);
  const completedCount = getCompletedSessions(sessions).length;
  const explorationRate = clamp(Number(options.explorationRate ?? 0.15), 0, 0.5);

  const scored = list.map(meditation => {
    const personal = progress.get(meditation.id) || {
      tried: false,
      sessionCount: 0,
      averageRating: null,
      lastCompletedAt: 0,
      sessions: []
    };
    const recommendation = scoreMeditation(meditation, profile);
    const exploration = !personal.tried
      && profile.completedTechniqueCount >= 5
      && seededExploration(meditation.id, completedCount) < explorationRate;
    return { meditation, progress: personal, recommendation, exploration };
  });

  const sort = options.sort || 'recommended';
  const compare = (a, b) => {
    if (a.progress.tried !== b.progress.tried) return a.progress.tried ? 1 : -1;
    if (sort === 'name') return a.meditation.name.localeCompare(b.meditation.name, 'pt');
    if (sort === 'rating') {
      return (b.progress.averageRating ?? -1) - (a.progress.averageRating ?? -1)
        || a.meditation.name.localeCompare(b.meditation.name, 'pt');
    }
    if (sort === 'sessions') {
      return b.progress.sessionCount - a.progress.sessionCount
        || (b.progress.averageRating ?? -1) - (a.progress.averageRating ?? -1);
    }
    if (sort === 'recent') return b.progress.lastCompletedAt - a.progress.lastCompletedAt;
    if (sort === 'duration') {
      return Number(a.meditation.duration?.defaultMinutes || 0)
        - Number(b.meditation.duration?.defaultMinutes || 0);
    }
    if (sort === 'random') {
      return seededExploration(a.meditation.id, completedCount + 1)
        - seededExploration(b.meditation.id, completedCount + 1);
    }

    if (!a.progress.tried && !b.progress.tried) {
      const aScore = (a.recommendation.rawScore ?? 0) + (a.exploration ? 0.08 : 0);
      const bScore = (b.recommendation.rawScore ?? 0) + (b.exploration ? 0.08 : 0);
      return bScore - aScore
        || a.meditation.name.localeCompare(b.meditation.name, 'pt');
    }
    return (b.progress.averageRating ?? -1) - (a.progress.averageRating ?? -1)
      || b.progress.sessionCount - a.progress.sessionCount
      || a.meditation.name.localeCompare(b.meditation.name, 'pt');
  };

  return scored.sort(compare);
}

export function matchesFilters(item, filters = {}) {
  const meditation = item.meditation || item;
  const progress = item.progress || { tried: false };
  const search = normalizeText(filters.search);
  if (search) {
    const haystack = [
      meditation.name,
      meditation.summary,
      meditation.period,
      ...(meditation.aliases || []),
      ...(meditation.originalNames || []).flatMap(entry => [entry.text, entry.language]),
      ...(meditation.traditions || []),
      ...(meditation.beliefSystems || []),
      ...(meditation.families || []),
      ...(meditation.attentionModes || []),
      ...(meditation.anchors || []),
      ...(meditation.features || []),
      ...(meditation.goals || [])
    ].map(normalizeText).join(' ');
    if (!haystack.includes(search)) return false;
  }

  if (filters.status === 'new' && progress.tried) return false;
  if (filters.status === 'tried' && !progress.tried) return false;
  if (filters.psilocybin === 'yes' && !meditation.psilocybin) return false;
  if (filters.psilocybin === 'no' && meditation.psilocybin) return false;

  const modalityText = [
    ...(meditation.anchors || []),
    ...(meditation.features || []),
    ...(meditation.attentionModes || []),
    ...(meditation.positions || [])
  ].map(normalizeText);
  const modalityPatterns = {
    breath: /respir|breath|pranay|pranayam|prāṇ|saas|hōsh dar dam/,
    visualization: /visual|imagem|image|imagetic|imagétic|mandala|kasina|kasiṇa|nimitta|gaze|contemplação visual/,
    mantra: /mantra|japa|recita|repeti|dhikr|oração repet|prayer repetition|chant|canto repet|nome divino/,
    movement: /moviment|movement|caminh|walking|danç|dance|giro|turning|prostra/
  };
  const negativePatterns = {
    breath: /sem respir|without breath/,
    visualization: /sem visual|without visual/,
    mantra: /sem mantra|without mantra/,
    movement: /sem movimento|stillness|imobilidade/
  };
  for (const [modality, pattern] of Object.entries(modalityPatterns)) {
    const selected = filters[modality];
    if (!selected || selected === 'all') continue;
    const present = modalityText.some(value => pattern.test(value) && !negativePatterns[modality].test(value));
    if (selected === 'yes' && !present) return false;
    if (selected === 'no' && present) return false;
  }

  const dimensions = ['traditions', 'beliefSystems', 'families', 'attentionModes', 'anchors', 'features', 'goals', 'positions'];
  for (const dimension of dimensions) {
    const selected = normalizeText(filters[dimension]);
    if (selected && !toValues(meditation[dimension]).includes(selected)) return false;
  }
  for (const dimension of ['flexibility', 'difficulty', 'intensity']) {
    const selected = normalizeText(filters[dimension]);
    if (selected && normalizeText(meditation[dimension]) !== selected) return false;
  }
  return true;
}

export function listFilterValues(catalog, dimension) {
  return unique((Array.isArray(catalog) ? catalog : []).flatMap(item => toValues(item[dimension])))
    .sort((a, b) => a.localeCompare(b, 'pt'));
}

export { DIMENSION_WEIGHTS, DEFAULT_PREFERENCES };
