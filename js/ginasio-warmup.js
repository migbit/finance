// Practical guidance, not a validated measure of tissue temperature or injury risk.
// Only registered work in this session contributes. Two recent work sets and
// 20 minutes are conservative product rules, not physiological thresholds.
export const WARMUP_WINDOW_MS = 20 * 60 * 1000;
const profiles = new Map();
function register(kind, ids) { ids.split(' ').forEach(id => profiles.set(id, kind)); }
register('press', 'chest-press-dragao chest-press-dragao-pob chest-press-constituicao-pob vertical-chest-press press-halteres-plano');
register('fly', 'pec-fly-dragao pec-fly-dragao-pob pectoral-constituicao-pob fly-halteres-plano');
register('triceps', 'triceps-press-dragao triceps-press-dragao-pob triceps-extension-dragao triceps-extension-dragao-pob arm-extension-constituicao-pob triceps-cabo-constituicao-pob');
register('biceps', 'dependent-curl-dragao dependent-curl-dragao-pob biceps-curl-dragao biceps-curl-dragao-pob arm-curl-constituicao-pob scott-halter-constituicao-pob');
register('lateral', 'lateral-raise-maquina-dragao-pob lateral-halteres-constituicao-pob lateral-cabo-constituicao-pob lateral-cabo');
register('pull', 'lat-pulldown-neutro');
register('row', 'seated-row-peito remada-cabo-lat');
register('hip', 'glute-trainer glute-trainer-arrabida technogym-glute-constituicao');
register('knee', 'leg-press-45 hack-squat leg-press-arrabida leg-press-horizontal-constituicao');
register('legCurl', 'leg-curl-deitado leg-curl-sentado seated-leg-curl-arrabida leg-curl-sentado-constituicao');
register('quad', 'leg-extension leg-extension-arrabida');
register('calf', 'seated-calf calf-leg-press-arrabida gemeos-leg-press-constituicao');
register('abductor', 'abdutora hip-abductor-arrabida technogym-abductor-constituicao');
register('lowerBack', 'lower-back');
register('facePull', 'face-pull');
register('cuff', 'rotacao-externa');
export const warmupProfile = id => profiles.get(id) || null;
const transfers = {
  press: ['press', 'fly'], fly: ['press', 'fly'],
  triceps: ['press', 'triceps'], biceps: ['pull', 'row', 'biceps'],
  pull: ['pull', 'row'], row: ['pull', 'row'],
  hip: ['hip', 'knee'], knee: ['knee', 'quad', 'hip'], quad: ['knee', 'quad']
};
const specific = new Set(['press', 'pull', 'row', 'hip', 'knee', 'lowerBack', 'facePull', 'cuff', 'lateral', 'legCurl', 'calf', 'abductor']);

export function warmupAdvice(target, work, now = Date.now()) {
  const kind = warmupProfile(target.id);
  if (!kind) return { mode: 'full', reason: 'Mantém a preparação própria deste exercício.' };
  const recent = work.filter(set => set.reps > 0 && set.at > 0 && set.at <= now && now - set.at <= WARMUP_WINDOW_MS);
  if (recent.some(set => set.id === target.id)) {
    return { mode: 'optional', reason: 'Já registaste trabalho neste exercício. Não precisas de repetir o aquecimento entre séries.' };
  }
  const compatible = transfers[kind] || [kind];
  const related = recent.filter(set => set.id !== target.id && compatible.includes(warmupProfile(set.id)));
  if (related.length < 2) return { mode: 'full', reason: 'Sem preparação recente suficiente registada para este movimento. Faz o aquecimento específico, sem fadiga.' };
  const names = [...new Set(related.map(set => set.name))].join(' e ');
  return specific.has(kind)
    ? { mode: 'specific', reason: `Já fizeste ${names}. Mantém uma série curta de adaptação à máquina/carga; não repitas toda a preparação.` }
    : { mode: 'optional', reason: `Já fizeste ${names}. O aquecimento extra pode ser dispensado se esta máquina e carga forem habituais e estiveres confortável.` };
}
