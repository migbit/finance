import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  '../data/meditations/buddhist.json',
  '../data/meditations/asian-non-buddhist.json',
  '../data/meditations/global-modern.json'
];

const allowedPositions = new Set([
  'chair',
  'cushion-cross-legged',
  'kneeling',
  'standing',
  'walking',
  'lying',
  'movement'
]);
const allowedLevels = new Set(['beginner', 'intermediate', 'advanced']);
const allowedIntensity = new Set(['low', 'moderate', 'high']);
const allowedFlexibility = new Set(['low', 'medium', 'high']);

const catalogs = await Promise.all(files.map(async file => {
  const raw = await readFile(new URL(file, import.meta.url), 'utf8');
  return { file, data: JSON.parse(raw) };
}));

test('os shards têm versão, âmbito e fichas', () => {
  catalogs.forEach(({ file, data }) => {
    assert.equal(data.catalogVersion, '2026-08-12', file);
    assert.equal(typeof data.scope, 'string', file);
    assert.ok(data.scope.length > 20, file);
    assert.ok(Array.isArray(data.meditations), file);
    assert.ok(data.meditations.length > 0, file);
  });
});

test('IDs são únicos em todo o catálogo', () => {
  const all = catalogs.flatMap(item => item.data.meditations);
  const ids = all.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('cada prática tem instruções profundas, metadados e pelo menos duas fontes', () => {
  const all = catalogs.flatMap(item => item.data.meditations);
  all.forEach(item => {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)+$/, `${item.id}: id`);
    assert.ok(item.name?.length >= 3, `${item.id}: name`);
    assert.ok(Array.isArray(item.originalNames), `${item.id}: originalNames`);
    assert.ok(Array.isArray(item.aliases), `${item.id}: aliases`);
    assert.ok(item.summary?.length >= 80, `${item.id}: summary`);
    ['traditions', 'beliefSystems', 'regions', 'families', 'attentionModes', 'anchors', 'features', 'goals']
      .forEach(field => assert.ok(Array.isArray(item[field]) && item[field].length > 0, `${item.id}: ${field}`));
    assert.ok(item.period?.length > 0, `${item.id}: period`);
    assert.ok(Array.isArray(item.positions) && item.positions.length > 0, `${item.id}: positions`);
    item.positions.forEach(position => assert.ok(allowedPositions.has(position), `${item.id}: position ${position}`));
    assert.ok(allowedFlexibility.has(item.flexibility), `${item.id}: flexibility`);
    assert.ok(allowedLevels.has(item.difficulty), `${item.id}: difficulty`);
    assert.ok(allowedIntensity.has(item.intensity), `${item.id}: intensity`);
    assert.ok(item.contextNote?.length >= 20, `${item.id}: contextNote`);
    assert.ok(Number.isFinite(item.duration?.defaultMinutes), `${item.id}: duration.defaultMinutes`);
    assert.ok(item.duration.minMinutes <= item.duration.defaultMinutes, `${item.id}: min/default duration`);
    assert.ok(item.duration.defaultMinutes <= item.duration.maxMinutes, `${item.id}: default/max duration`);
    assert.equal(typeof item.psilocybin, 'boolean', `${item.id}: psilocybin`);
    assert.ok(item.instructions?.preparation?.length >= 2, `${item.id}: preparation`);
    assert.ok(item.instructions?.steps?.length >= 5, `${item.id}: steps`);
    assert.ok(item.instructions?.closing?.length >= 2, `${item.id}: closing`);
    assert.ok(item.instructions?.adaptations?.length >= 2, `${item.id}: adaptations`);
    assert.ok(Array.isArray(item.precautions), `${item.id}: precautions`);
    assert.ok(item.sources?.length >= 2, `${item.id}: sources`);
    assert.equal(new Set(item.sources.map(source => source.url)).size, item.sources.length, `${item.id}: source URLs únicas`);
    item.sources.forEach(source => {
      assert.ok(source.title && source.type && source.language && source.url, `${item.id}: source fields`);
      assert.doesNotThrow(() => new URL(source.url), `${item.id}: source URL`);
    });
    assert.ok(['high', 'medium'].includes(item.review?.confidence), `${item.id}: review confidence`);
    assert.equal(item.review?.reviewedAt, '2026-08-12', `${item.id}: review date`);
  });
});

test('as exclusões editoriais e o limite da psilocibina são explícitos', () => {
  const all = catalogs.flatMap(item => item.data.meditations);
  const psilocybin = all.filter(item => item.psilocybin);
  assert.equal(psilocybin.length, 4);
  psilocybin.forEach(item => assert.match(item.id, /^psy-/, `${item.id}: prefixo psilocibina`));

  const identityText = all.map(item => [
    item.id,
    item.name,
    ...item.aliases,
    ...item.traditions,
    ...item.families,
    ...item.features
  ].join(' ').toLowerCase()).join('\n');
  assert.doesNotMatch(identityText, /hipnose|hypnosis|hypnotic/);
});

test('o catálogo cobre as tradições e abordagens acordadas', () => {
  const all = catalogs.flatMap(item => item.data.meditations);
  const searchable = all.map(item => [
    item.name,
    ...item.traditions,
    ...item.beliefSystems,
    ...item.features
  ].join(' ').toLowerCase()).join('\n');
  [
    'therav', 'zen', 'vajray', 'hindu', 'yoga', 'tantr', 'jain', 'sikh', 'dao',
    'confuc', 'crist', 'juda', 'sufi', 'indígen', 'secular', 'psiloc'
  ].forEach(term => assert.ok(searchable.includes(term), `cobertura em falta: ${term}`));
  assert.ok(all.some(item => item.psilocybin), 'falta uma prática contemplativa relacionada com psilocibina');
});
