import { QUESTIONS, TOPICS } from './francisca-estudar-data.js';

export function parseNumber(raw, suffix = '') {
  let text=String(raw ?? '').trim();
  if(suffix === '%') text=text.replace(/\s*%$/, '');
  // Aceitar vírgula decimal, mas nunca avaliar expressões ou aceitar texto parcial.
  if(!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) return null;
  const value=Number(text.replace(',','.'));
  return Number.isFinite(value) ? value : null;
}

// Apenas uma potência literal; nunca executar código nem expressões arbitrárias.
export function parsePower(raw) {
  const text=String(raw ?? '').trim();
  const decimal='(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)';
  let match=text.match(new RegExp(`^(${decimal})\\s*(?:\\^|\\*\\*)\\s*(\\d+)$`));
  if(!match) {
    const superscript=text.match(new RegExp(`^(${decimal})\\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$`));
    if(superscript)match=[superscript[0],superscript[1],[...superscript[2]].map(d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(d)).join('')];
  }
  if(!match)return null;
  const base=parseNumber(match[1]), exponent=Number(match[2]);
  if(base===null || !Number.isSafeInteger(exponent) || exponent>1000 || (base===0&&exponent===0))return null;
  const value=base**exponent;
  return Number.isFinite(value)&&!(base>0&&value===0)?{base,exponent,value}:null;
}

export function formatAnswer(field) {
  return field.type==='power'
    ? `${field.base}${String(field.exponent).replace(/\d/g,d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])}`
    : typeof field.answer==='number'?String(field.answer).replace('.',','):String(field.answer);
}

// Tolerar espaços, pontuação final e apóstrofos tipográficos, preservando
// grafia, palavras, ordem e apóstrofos de posse/contração. Sem correspondência vaga.
export function normalizeEnglish(raw,caseSensitive=false) {
  const text=String(raw??'').normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s*,\s*/g,' ').trim().replace(/\s+/g,' ').replace(/\s*([;:])\s*/g,'$1 ').replace(/[.?!]+$/,'').trim();
  return caseSensitive?text:text.toLowerCase();
}

export function grade(question, answers) {
  if(!Array.isArray(answers) || answers.length !== question.fields.length) return { valid:false, correct:false, parts:[] };
  const parts=question.fields.map((field,i)=>{
    if(field.options) return { valid:field.options.includes(answers[i]), correct:answers[i] === field.answer };
    if(field.type==='text'||field.type==='order') {
      const normalize=value=>{const text=normalizeEnglish(value,field.caseSensitive);return field.language==='pt-PT'?text.normalize('NFD').replace(/[\u0300-\u036f]/g,''):text;};
      const answer=normalize(answers[i]);
      const complete=field.type!=='order'||answer.split(' ').length===field.words.length;
      return {valid:answer.length>0&&answer.length<=500&&complete,correct:complete&&[field.answer,...(field.accept||[])].some(expected=>answer===normalize(expected))};
    }
    if(field.type==='power') {
      const power=parsePower(answers[i]);
      return { valid:power!==null, correct:power!==null&&power.base===field.base&&power.exponent===field.exponent };
    }
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

export function selectQuestions(mode, topic='all', progress={}, random=Math.random, course={questions:QUESTIONS,topics:TOPICS}) {
  const bank=course.questions,topics=course.topics;
  if(course.adaptive) {
    if(mode==='test')return shuffle(topics.flatMap(t=>{
      const pool=bank.filter(q=>q.topic===t.id);
      const harder=shuffle(pool.filter(q=>q.level===3),random)[0];
      const basics=pool.filter(q=>q.level<3&&q.skill!==harder.skill);
      const preferred=basics.filter(q=>q.format==='true-false'||q.diagram||q.table||q.chart);
      const basic=shuffle(preferred.length?preferred:basics,random)[0];
      return [basic,harder];
    }),random);
    const status=conceptEvidence(bank,progress);
    const pool=shuffle(bank.filter(q=>(topic==='all'||q.topic===topic)&&(mode!=='review'||status[q.topic+':'+q.skill].attempted&&!status[q.topic+':'+q.skill].secure)),random);
    const ranked=pool.sort((a,b)=>{
      const rank=q=>{const e=status[q.topic+':'+q.skill],p=progress[q.id];return (e.secure?100:0)+(e.wrong?-30:0)+(e.due?-15:0)+(p?.lastCorrect?8:0)+Math.abs(q.level-(e.independentIds&&!e.wrong?3:1))*2;};
      return rank(a)-rank(b);
    });
    const chosen=[];for(const q of ranked){if(chosen.length>=(mode==='game'?5:6))break;if(topic==='all'&&mode!=='review'&&chosen.some(v=>v.topic===q.topic))continue;chosen.push(q);}
    return chosen;
  }
  if(mode==='test'&&course.examSlots) {
    const set=shuffle([...new Set(bank.filter(q=>q.readingSet).map(q=>q.readingSet))],random)[0];
    const readingPool=bank.filter(q=>q.readingSet===set);
    const reading=course.readingSkills?course.readingSkills.map(skill=>shuffle(readingPool.filter(q=>q.skill===skill),random)[0]):readingPool;
    const rest=course.examSlots.map(([topic,skill])=>shuffle(bank.filter(q=>q.topic===topic&&(!skill||q.skill===skill)),random)[0]);
    return [...reading,...rest];
  }
  if(mode==='test') return shuffle(topics.flatMap(t=>{
    const pool=shuffle(bank.filter(q=>q.topic===t.id),random);
    // Dois tipos de tarefa por tema: evitar um teste só de cálculos repetidos.
    return [pool[0],pool.find(q=>q.skill!==pool[0].skill)||pool[1]];
  }),random);
  let pool=bank.filter(q=>topic==='all'||q.topic===topic);
  if(mode==='review') pool=pool.filter(q=>progress[q.id]?.lastCorrect===false);
  const ranked=shuffle(pool,random).sort((a,b)=>Number(progress[a.id]?.lastCorrect===true)-Number(progress[b.id]?.lastCorrect===true));
  if(topic==='all' && mode!=='review') {
    // Distribuição por temas: cada sessão de treino inclui os seis temas.
    const perTopic=shuffle(topics,random).map(t=>ranked.find(q=>q.topic===t.id)).filter(Boolean);
    return perTopic.slice(0,mode==='game'?5:6);
  }
  return ranked.slice(0,mode==='game'?5:6);
}

export function reinforcement(question, usedIds=[], random=Math.random, bank=QUESTIONS) {
  const alternatives=bank.filter(q=>q.id!==question.id && q.topic===question.topic && !usedIds.includes(q.id));
  const sameSkill=alternatives.filter(q=>q.skill===question.skill);
  const candidates=sameSkill.length?sameSkill:alternatives;
  const easier=question.level?candidates.filter(q=>q.level<=question.level):[];
  return shuffle(easier.length?easier:candidates,random)[0] || question;
}

export function emptyState() { return { version:1, answerFormat:2, progress:{}, history:[], plan:[], active:null }; }
export function readState(raw,bank=QUESTIONS) {
  try {
    const data=JSON.parse(raw);
    if(data?.version!==1 || typeof data.progress!=='object' || !data.progress || Array.isArray(data.progress) || !Array.isArray(data.history) || !Array.isArray(data.plan)) return emptyState();
    const ids=new Set(bank.map(q=>q.id));
    const progress=Object.fromEntries(Object.entries(data.progress).filter(([id,v])=>ids.has(id)&&v&&typeof v==='object'));
    const active=data.active;
    // A versão anterior guardava só o expoente nestes quatro campos.
    // Converter uma única vez, preservando testes em curso e correções antigas.
    if(data.answerFormat!==2) {
      const migrate=(id,answers)=>{
        const question=bank.find(q=>q.id===id);
        if(!question||!Array.isArray(answers))return;
        question.fields.forEach((field,i)=>{
          if(field.type==='power'&&/^\d+$/.test(String(answers[i]??'')))answers[i]=`${field.base}^${answers[i]}`;
        });
      };
      if(Array.isArray(active?.queue))active.queue.forEach((item,i)=>migrate(item?.id,active.answers?.[i]));
      for(const session of [active,...data.history])if(Array.isArray(session?.attempts))session.attempts.forEach(a=>migrate(a?.id,a?.answers));
    }
    const validActive=active && ['train','game','test','review'].includes(active.mode) && Array.isArray(active.queue) && active.queue.length>0 && active.queue.length<1000 && active.queue.every(item=>item&&ids.has(item.id)) && Number.isInteger(active.index) && active.index>=0 && active.index<active.queue.length && active.answers && typeof active.answers==='object' && Array.isArray(active.attempts) && Number.isFinite(active.startedAt) && Number.isFinite(active.goal);
    return { version:1, answerFormat:2, progress, history:data.history.filter(h=>h&&typeof h==='object'&&Number.isFinite(h.date)).slice(0,20), plan:data.plan.filter(p=>p&&typeof p.id==='string'&&typeof p.task==='string'&&typeof p.subject==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.minutes)), active:validActive?active:null, ...(typeof data.writingDraft==='string'?{writingDraft:data.writingDraft.slice(0,3000)}:{}) };
  } catch { return emptyState(); }
}

export function recordAttempt(progress,id,correct,assisted=false,now=Date.now()) {
  const old=progress[id] || { attempts:0, independent:0 };
  const days=correct&&!assisted?[...new Set([...(old.independentDays||[]),localDateKey(new Date(now))])].slice(-10):(old.independentDays||[]);
  return { ...progress,[id]:{ attempts:(Number(old.attempts)||0)+1, independent:(Number(old.independent)||0)+(correct&&!assisted?1:0), independentDays:days,lastCorrect:correct,lastAssisted:assisted,lastAt:now } };
}

// Evidência observável, não uma inferência de certeza nem deteção de adivinhação.
export function conceptEvidence(bank,progress,now=Date.now()) {
  const result={};
  for(const q of bank){const key=q.topic+':'+q.skill;const e=result[key]??={topic:q.topic,skill:q.skill,attempted:false,independentIds:0,days:new Set(),reasoning:false,lastAt:0,lastWrong:0,lastIndependent:0};const p=progress[q.id];if(!p)continue;
    e.attempted||=p.attempts>0;e.lastAt=Math.max(e.lastAt,p.lastAt||0);
    if(p.lastCorrect===false)e.lastWrong=Math.max(e.lastWrong,p.lastAt||0);
    if(p.lastCorrect&&p.independent>0&&!p.lastAssisted){e.independentIds++;(p.independentDays||[]).forEach(d=>e.days.add(d));e.reasoning||=q.level>=2;e.lastIndependent=Math.max(e.lastIndependent,p.lastAt||0);}
  }
  for(const e of Object.values(result)){e.wrong=e.lastWrong>=e.lastIndependent&&e.lastWrong>0;e.secure=e.independentIds>=2&&e.days.size>=2&&e.reasoning&&!e.wrong;e.due=e.attempted&&now-e.lastAt>=86400000;e.days=[...e.days];}
  return result;
}

export function scoreTest(attempts,bank) {
  let earned=0,total=0;for(const a of attempts){const q=bank.find(q=>q.id===a.id);if(!q)continue;const points=q.points||1;total+=points;const parts=grade(q,a.answers).parts;earned+=points*parts.filter(p=>p.correct).length/q.fields.length;}
  return {earned:Math.round(earned*100)/100,total};
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
