import { QUESTIONS, TOPICS } from './francisca-estudar-data.js';

export function parseNumber(raw, suffix = '') {
  let text=String(raw ?? '').trim();
  if(suffix === '%') text=text.replace(/\s*%$/, '');
  // Aceitar vírgula decimal, mas nunca avaliar expressões ou aceitar texto parcial.
  if(!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) return null;
  const value=Number(text.replace(',','.'));
  return Number.isFinite(value) ? value : null;
}

export function grade(question, answers) {
  if(!Array.isArray(answers) || answers.length !== question.fields.length) return { valid:false, correct:false, parts:[] };
  const parts=question.fields.map((field,i)=>{
    if(field.options) return { valid:field.options.includes(answers[i]), correct:answers[i] === field.answer };
    const value=parseNumber(answers[i],field.suffix);
    return { valid:value !== null, correct:value !== null && Math.abs(value-field.answer)<1e-9 };
  });
  return { valid:parts.every(p=>p.valid), correct:parts.every(p=>p.correct), parts };
}

export function shuffle(items, random = Math.random) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
}

export function selectQuestions(mode, topic='all', progress={}, random=Math.random) {
  if(mode==='test') return shuffle(TOPICS.flatMap(t=>shuffle(QUESTIONS.filter(q=>q.topic===t.id),random).slice(0,2)),random);
  let pool=QUESTIONS.filter(q=>topic==='all'||q.topic===topic);
  if(mode==='review') pool=pool.filter(q=>progress[q.id]?.lastCorrect===false);
  const ranked=shuffle(pool,random).sort((a,b)=>Number(progress[a.id]?.lastCorrect===true)-Number(progress[b.id]?.lastCorrect===true));
  if(topic==='all' && mode!=='review') {
    // Distribuição por temas: cada sessão de treino inclui os seis temas.
    const perTopic=shuffle(TOPICS,random).map(t=>ranked.find(q=>q.topic===t.id)).filter(Boolean);
    return perTopic.slice(0,mode==='game'?5:6);
  }
  return ranked.slice(0,mode==='game'?5:6);
}

export function reinforcement(question, usedIds=[], random=Math.random) {
  const alternatives=QUESTIONS.filter(q=>q.id!==question.id && q.topic===question.topic && !usedIds.includes(q.id));
  const sameSkill=alternatives.filter(q=>q.skill===question.skill);
  return shuffle(sameSkill.length?sameSkill:alternatives,random)[0] || question;
}

export function emptyState() { return { version:1, progress:{}, history:[], plan:[], active:null }; }
export function readState(raw) {
  try {
    const data=JSON.parse(raw);
    if(data?.version!==1 || typeof data.progress!=='object' || !data.progress || Array.isArray(data.progress) || !Array.isArray(data.history) || !Array.isArray(data.plan)) return emptyState();
    const ids=new Set(QUESTIONS.map(q=>q.id));
    const progress=Object.fromEntries(Object.entries(data.progress).filter(([id,v])=>ids.has(id)&&v&&typeof v==='object'));
    const active=data.active;
    const validActive=active && ['train','game','test','review'].includes(active.mode) && Array.isArray(active.queue) && active.queue.length>0 && active.queue.length<1000 && active.queue.every(item=>item&&ids.has(item.id)) && Number.isInteger(active.index) && active.index>=0 && active.index<active.queue.length && active.answers && typeof active.answers==='object' && Array.isArray(active.attempts) && Number.isFinite(active.startedAt) && Number.isFinite(active.goal);
    return { version:1, progress, history:data.history.filter(h=>h&&typeof h==='object'&&Number.isFinite(h.date)).slice(0,20), plan:data.plan.filter(p=>p&&typeof p.id==='string'&&typeof p.task==='string'&&typeof p.subject==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.minutes)), active:validActive?active:null };
  } catch { return emptyState(); }
}

export function recordAttempt(progress,id,correct,assisted=false) {
  const old=progress[id] || { attempts:0, independent:0 };
  return { ...progress,[id]:{ attempts:(Number(old.attempts)||0)+1, independent:(Number(old.independent)||0)+(correct&&!assisted?1:0), lastCorrect:correct, lastAt:Date.now() } };
}

export function localDateKey(date=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=type=>parts.find(p=>p.type===type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function normalizeTask(subject,date,task,minutes,subjects) {
  if(!subjects.includes(subject)) throw new Error('Escolhe uma disciplina.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date) throw new Error('Escolhe uma data válida.');
  const text=String(task).trim(); const duration=Number(minutes);
  if(!text || text.length>160) throw new Error('Escreve uma tarefa com até 160 caracteres.');
  if(!Number.isInteger(duration)||duration<5||duration>120||duration%5!==0) throw new Error('Escolhe entre 5 e 120 minutos, em passos de 5.');
  return { subject,date,task:text,minutes:duration,done:false };
}
