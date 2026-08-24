import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const recommenderSource = await readFile(new URL('../js/meditacao-recommender.js', import.meta.url), 'utf8');
const meditationPageSource = await readFile(new URL('../js/meditacao.js', import.meta.url), 'utf8');
const meditationHtml = await readFile(new URL('../modules/meditacao.html', import.meta.url), 'utf8');
const recommenderModule = await import(`data:text/javascript;base64,${Buffer.from(recommenderSource).toString('base64')}`);
const {
  aggregateProgress,
  buildTasteProfile,
  matchesFilters,
  parseMeditationRating,
  recommendCatalog,
  scoreMeditation,
  selectSessionLifecycle
} = recommenderModule;

const base = {
  traditions: ['Secular'],
  beliefSystems: ['secular'],
  attentionModes: ['focused'],
  anchors: ['breath'],
  features: ['silent'],
  goals: ['attention'],
  positions: ['chair'],
  flexibility: 'low',
  difficulty: 'beginner',
  intensity: 'low',
  duration: { defaultMinutes: 20 }
};

const catalog = [
  { ...base, id: 'breath', name: 'Respiração', families: ['body-centered'] },
  { ...base, id: 'visual', name: 'Visualização', families: ['visual-concentration'], anchors: ['image'], features: ['visualization'], positions: ['cushion-cross-legged'], flexibility: 'high' },
  { ...base, id: 'walk', name: 'Caminhada', families: ['movement'], positions: ['walking'], features: ['movement'] }
];

function completed(meditationId, rating, completedAt = '2026-08-01T10:00:00Z') {
  return { meditationId, rating, status: 'completed', completedAt };
}

test('a classificação distingue zero de um valor ainda não preenchido', () => {
  assert.equal(parseMeditationRating(null), null);
  assert.equal(parseMeditationRating(undefined), null);
  assert.equal(parseMeditationRating(''), null);
  assert.equal(parseMeditationRating(0), 0);
  assert.equal(parseMeditationRating('20'), 20);
  assert.equal(parseMeditationRating(10.5), null);
  assert.equal(parseMeditationRating(21), null);
});

test('sessão em curso não conta como experimentada e 0/20 são classificações válidas', () => {
  const sessions = [
    { meditationId: 'visual', rating: null, status: 'in_progress' },
    { meditationId: 'visual', rating: 20, status: 'rating_pending' },
    { meditationId: 'visual', rating: null, status: 'completed' },
    completed('visual', -1),
    completed('visual', 10.5),
    completed('walk', 21),
    completed('breath', 0),
    completed('breath', 20)
  ];
  const progress = aggregateProgress(catalog, sessions);
  assert.equal(progress.get('visual').tried, false);
  assert.equal(progress.get('walk').tried, false);
  assert.equal(progress.get('breath').tried, true);
  assert.equal(progress.get('breath').averageRating, 10);
  assert.equal(progress.get('breath').sessionCount, 2);
});

test('terminar o contador separa a sessão ativa da classificação pendente', () => {
  const lifecycle = selectSessionLifecycle([
    { id: 'old-active', status: 'in_progress', startedAtMs: 10 },
    { id: 'new-active', status: 'in_progress', startedAtMs: 20 },
    { id: 'old-rating', status: 'rating_pending', stoppedAtMs: 30 },
    { id: 'new-rating', status: 'rating_pending', stoppedAtMs: 40 },
    { id: 'done', status: 'completed', completedAtMs: 50 }
  ]);

  assert.equal(lifecycle.activeSession.id, 'new-active');
  assert.equal(lifecycle.pendingRatingSession.id, 'new-rating');
  assert.equal(lifecycle.activeCount, 2);
  assert.equal(lifecycle.pendingRatingCount, 2);
});

test('a interface não retoma uma sessão já terminada ao fechar a classificação', () => {
  assert.match(meditationPageSource, /status: 'rating_pending'/);
  assert.match(meditationPageSource, /state\.pendingRatingSession = session/);
  assert.doesNotMatch(meditationPageSource, /resumeAfterDismissedRating/);
  assert.match(meditationPageSource, /Sessão em pausa/);
  assert.match(meditationHtml, /id="meditation-active-label"/);
  assert.match(meditationHtml, /O contador já terminou\. Podes fechar esta janela e classificar mais tarde\./);
});

test('a página abre após autenticação sem pedir PIN', () => {
  assert.doesNotMatch(meditationHtml, /meditation-(?:pin|lock)/);
  assert.doesNotMatch(meditationHtml, /Introduz o PIN|Desbloquear|Bloquear/);
  assert.doesNotMatch(meditationPageSource, /ACCESS_PIN|PIN_STORAGE_PREFIX|pinStorageKey|sessionStorage|unlocked|lockPage/);
  assert.match(meditationPageSource, /elements\.authGate\.hidden = true;\s+await loadPrivateApp\(\);/);
});

test('técnicas novas aparecem sempre antes das experimentadas', () => {
  const ranked = recommendCatalog(catalog, [completed('breath', 20)]);
  assert.deepEqual(ranked.slice(0, 2).map(item => item.meditation.id).sort(), ['visual', 'walk']);
  assert.equal(ranked.at(-1).meditation.id, 'breath');
});

test('o perfil usa a média por técnica em vez de deixar repetições dominarem', () => {
  const sessions = [completed('breath', 20), completed('breath', 20), completed('visual', 0)];
  const profile = buildTasteProfile(catalog, sessions);
  assert.equal(profile.completedTechniqueCount, 2);
  assert.equal(profile.dimensions.families.get('body-centered').weighted, 1);
  assert.equal(profile.dimensions.families.get('visual-concentration').weighted, -1);
});

test('compatibilidade só é mostrada depois de cinco técnicas diferentes', () => {
  const smallProfile = buildTasteProfile(catalog, [completed('breath', 20)]);
  assert.equal(scoreMeditation(catalog[0], smallProfile).compatibility, null);

  const extended = Array.from({ length: 5 }, (_, index) => ({ ...base, id: `m${index}`, name: `M${index}`, families: ['body-centered'] }));
  const profile = buildTasteProfile(extended, extended.map(item => completed(item.id, 18)));
  assert.ok(scoreMeditation(catalog[0], profile).compatibility > 50);
});

test('IDs antigos fora do catálogo não ativam o recomendador', () => {
  const sessions = Array.from({ length: 5 }, (_, index) => completed(`removed-${index}`, 20));
  const profile = buildTasteProfile(catalog, sessions);
  assert.equal(profile.completedTechniqueCount, 0);
  assert.equal(scoreMeditation(catalog[0], profile).compatibility, null);
});

test('filtros combinam pesquisa, posição e estado sem excluir por defeito', () => {
  const ranked = recommendCatalog(catalog, [completed('breath', 18)]);
  assert.equal(matchesFilters(ranked.find(item => item.meditation.id === 'walk'), { search: 'caminhada', positions: 'walking', status: 'new' }), true);
  assert.equal(matchesFilters(ranked.find(item => item.meditation.id === 'visual'), { positions: 'chair' }), false);
  assert.equal(matchesFilters(ranked.find(item => item.meditation.id === 'breath'), { breath: 'yes' }), true);
  assert.equal(matchesFilters(ranked.find(item => item.meditation.id === 'visual'), { breath: 'no' }), true);
  assert.equal(matchesFilters(ranked.find(item => item.meditation.id === 'visual'), { visualization: 'yes' }), true);
});
