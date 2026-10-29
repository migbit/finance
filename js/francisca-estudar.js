import { whenAccessResolved } from './script.js';
import { FRANCISCA_SUBJECTS } from './francisca-calendar-core.js';
import { COURSES,MATHS_COURSE } from './francisca-estudar-courses.js';
import { grade, shuffle, selectQuestions, reinforcement, readState, recordAttempt, localDateKey, normalizeTask, formatAnswer, parseNumber, conceptEvidence, scoreTest } from './francisca-estudar-core.js';

const $=id=>document.getElementById(id);
let course=MATHS_COURSE,QUESTIONS=course.questions,TOPICS=course.topics,TOPIC_HINTS=course.hints;
let byId=new Map(QUESTIONS.map(q=>[q.id,q]));
const modeNames={train:'Treino com ajuda',game:'Missão: 5 chaves',test:'Como num teste',review:'Rever dificuldades'};
let studyLabel='Matemática · 1.º Teste';
let state, storageKey, planState, selectedSubject='Matemática';
const states={},storageKeys={};
function node(tag,className,text) { const n=document.createElement(tag); if(className)n.className=className; if(text!==undefined)n.textContent=text; return n; }
function button(text,handler,primary=false) { const n=node('button',primary?'study-primary':'',text);n.type='button';n.addEventListener('click',handler);return n; }
function save() {
  try { localStorage.setItem(storageKey,JSON.stringify(state)); }
  catch { $('study-storage').textContent='Não foi possível guardar neste navegador. Mantém esta página aberta para não perderes o progresso e o plano.'; $('study-storage').setAttribute('role','alert'); }
}
function savePlan() {
  try { localStorage.setItem(storageKeys.maths,JSON.stringify(planState)); }
  catch { $('study-storage').textContent='Não foi possível guardar o plano neste navegador.'; }
}
function chooseSubject(subject) {
  selectedSubject=subject;
  for(const child of $('study-subjects').children)child.setAttribute('aria-pressed',String(child.dataset.subject===subject));
  const next=COURSES.find(c=>c.subject===subject);
  $('study-maths').hidden=!next;
  $('study-subject-note').textContent=next?'':'Ainda não há material de estudo de '+subject+'. Já podes organizar esta disciplina no plano.';
  $('plan-subject').value=subject;
  if(!next)return;
  course=next;QUESTIONS=course.questions;TOPICS=course.topics;TOPIC_HINTS=course.hints;byId=new Map(QUESTIONS.map(q=>[q.id,q]));
  state=states[course.id];storageKey=storageKeys[course.id];studyLabel=course.subject+' · 1.º Teste';
  $('maths-title').textContent=course.subject;$('study-course-badge').textContent=course.badge;$('study-course-intro').textContent=course.intro;
  $('study-test-description').textContent=course.testDescription;$('study-test-button').textContent=course.testButton;$('study-course-sources').textContent=course.sources;
  $('study-english-method').hidden=!course.writing;
  $('study-science-method').hidden=!course.adaptive;
  $('plan-task').placeholder=course.adaptive?'Ex.: recordar absorção e explicar um erro':course.writing?'Ex.: rever have got e escrever 5 frases':'Ex.: resolver expressões com parênteses';
  document.querySelector('.study-hero-symbol').textContent=course.adaptive?'Explora!':course.writing?'Hello!':'a² + b²';
  $('study-topic').replaceChildren(new Option('Todos os temas','all'));TOPICS.forEach(t=>$('study-topic').append(new Option(t.title,t.id)));
  renderDashboard();
}
function focusHeading(n) { n.tabIndex=-1; n.focus({preventScroll:true}); n.scrollIntoView({block:'start',behavior:'instant'}); }
function openSession() { $('study-dashboard').hidden=true;$('study-session').hidden=false; }
function home() { $('study-dashboard').hidden=false;$('study-session').hidden=true;renderDashboard();focusHeading($('maths-title')); }
function currentQuestion() { return byId.get(state.active.queue[state.active.index].id); }

function renderDashboard() {
  const attempted=Object.values(state.progress).filter(p=>p.attempts>0).length;
  const independent=Object.values(state.progress).filter(p=>p.independent>0).length;
  const evidence=course.adaptive?conceptEvidence(QUESTIONS,state.progress):null;
  const difficult=evidence?Object.values(evidence).filter(e=>e.attempted&&!e.secure).length:Object.values(state.progress).filter(p=>p.lastCorrect===false).length;
  $('study-stats').replaceChildren();
  [[`${attempted}/${QUESTIONS.length}`,'perguntas exploradas'],[String(independent),'resolvidas sem ajuda'],[String(difficult),'para voltar a praticar']].forEach(([v,label])=>{
    const card=node('div');card.append(node('strong','',v),node('span','',label));$('study-stats').append(card);
  });
  $('study-review').disabled=!difficult;
  $('study-resume').hidden=!state.active;
  $('study-topics').replaceChildren();
  TOPICS.forEach(topic=>{
    const qs=QUESTIONS.filter(q=>q.topic===topic.id);
    const mastered=qs.filter(q=>state.progress[q.id]?.independent>0).length;
    const article=node('article','study-topic');
    const title=node('h3');title.append(node('span','study-topic-icon',topic.icon),document.createTextNode(topic.title));
    article.append(title,node('p','study-muted',`${topic.pages} · ${mastered}/${qs.length} sem ajuda`));
    const progress=node('progress');progress.max=qs.length;progress.value=mastered;progress.setAttribute('aria-label',`${topic.title}: ${mastered} de ${qs.length} perguntas resolvidas sem ajuda`);article.append(progress);
    const details=node('details');details.append(node('summary','','Recordar a matéria'));
    const list=node('ol');topic.lesson.forEach(s=>list.append(node('li','',s)));details.append(list,node('p','study-example',topic.example));
    if(course.adaptive&&topic.id==='cn-orgaos')details.append(diagramNode({kind:'route'}));
    if(course.adaptive&&topic.id==='cn-absorcao')details.append(diagramNode({kind:'villi'}));
    if(evidence){const es=Object.values(evidence).filter(e=>e.topic===topic.id);article.append(node('p','study-recommendation',`${es.filter(e=>e.secure).length}/${es.length} conceitos confirmados em perguntas e dias diferentes · ${es.filter(e=>e.due&&!e.secure).length} a recordar hoje`));}
    if(course.adaptive){details.append(node('p','study-muted','Recordar → explicar → verificar: fecha o resumo, escreve duas ideias e explica um exemplo. Na próxima sessão, tenta sem consultar.'));}
    article.append(details,button('Praticar este tema',()=>requestStart('train',topic.id)));$('study-topics').append(article);
  });
  renderPlan();renderHistory();
}

function renderSubjects() {
  const icons=['∑','Aa','⌛','✎','❧','En','◎','♧','✧','♫'];
  FRANCISCA_SUBJECTS.forEach((subject,i)=>{
    const b=button('',()=>chooseSubject(subject));
    b.dataset.subject=subject;b.setAttribute('aria-pressed',String(subject===selectedSubject));
    b.append(node('span','study-subject-icon',icons[i]),node('strong','',subject),node('small','',COURSES.some(c=>c.subject===subject)?'1.º Teste disponível':'Aguarda material'));
    $('study-subjects').append(b);
    $('plan-subject').append(new Option(subject,subject));
  });
}

function requestStart(mode,topic=$('study-topic').value) {
  if(state.active) {
    openSession();const pane=$('study-session');pane.replaceChildren();
    const title=node('h2','','Tens uma sessão por terminar');title.id='session-title';
    pane.append(title,node('p','',`${modeNames[state.active.mode]}: o teu trabalho está guardado. Podes retomá-lo ou substituí-lo por uma nova sessão.`),button('Retomar sessão guardada',renderSession,true),button('Substituir por uma nova sessão',()=>start(mode,topic)),button('Voltar',home));focusHeading(title);return;
  }
  start(mode,topic);
}
function start(mode,topic) {
  const qs=selectQuestions(mode,mode==='review'?'all':topic,state.progress,Math.random,course);
  if(!qs.length)return;
  state.active={mode,queue:qs.map(q=>({id:q.id,repair:false})),index:0,answers:{},attempts:[],startedAt:Date.now(),goal:qs.length,keys:0,feedback:null};save();renderSession();
}
function answerInputs(form,q,answers=[]) {
  const fields=node('div','study-answer-fields');
  q.fields.forEach((field,i)=>{
    if(field.type==='order') {
      const group=node('fieldset','study-word-game');group.append(node('legend','',field.label),node('p','study-muted','Toca nas palavras pela ordem certa. Usa «Desfazer» para corrigir.'));
      const input=node('input');input.type='hidden';input.name=`answer-${i}`;input.value=answers[i]||'';
      const assembled=node('p','study-assembled');assembled.setAttribute('aria-live','polite');
      const bank=node('div','study-word-bank');bank.lang=field.language||'en-GB';const selected=[];
      let seed=[...q.id].reduce((n,c)=>n+c.charCodeAt(0),i+1);
      const tokens=shuffle(field.words,()=>{seed=(seed*9301+49297)%233280;return seed/233280;});
      let remaining=String(answers[i]||'').replace(/[.?!]$/,'').split(' ').filter(Boolean);
      const buttons=tokens.map((word,index)=>{const b=button(word,()=>{selected.push(index);draw();});return b;});
      for(const word of remaining){const index=tokens.findIndex((token,index)=>token===word&&!selected.includes(index));if(index>=0)selected.push(index);}
      function draw(notify=true) {
        input.value=selected.map(index=>tokens[index]).join(' ');assembled.textContent=input.value||'A tua frase aparece aqui.';
        buttons.forEach((b,index)=>b.disabled=selected.includes(index)||Boolean(state.active?.feedback));
        if(notify)input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      buttons.forEach(b=>bank.append(b));draw(false);
      group.append(assembled,bank,button('Desfazer',()=>{selected.pop();draw();}),button('Limpar frase',()=>{selected.length=0;draw();}),input);fields.append(group);
    } else if(field.options) {
      const fieldset=node('fieldset','study-choices');fieldset.append(node('legend','',field.label||'Escolhe uma resposta'));
      // A ordem fica estável ao regressar à pergunta e não denuncia a opção correta.
      const seed=[...q.id].reduce((n,c)=>n+c.charCodeAt(0),0);
      let s=seed;const options=shuffle(field.options,()=>{s=(s*9301+49297)%233280;return s/233280;});
      options.forEach((option,j)=>{
        const label=node('label','study-choice');const input=node('input');input.type='radio';input.name=`answer-${i}`;input.value=option;input.checked=answers[i]===option;input.required=false;
        label.append(input,node('span','study-choice-letter',String.fromCharCode(65+j)),node('span','',option));fieldset.append(label);
      });fields.append(fieldset);
    } else {
      const group=node('div','study-number-label');const label=node('label','',field.label);const inputId=`study-answer-${i}`;label.htmlFor=inputId;group.append(label);
      const supportsPower=field.type==='power',english=field.type==='text';
      const wrap=node('span','study-input-wrap');const input=node('input');input.id=inputId;input.name=`answer-${i}`;input.type='text';input.inputMode=supportsPower||english?'text':'decimal';input.autocomplete='off';input.value=answers[i]??'';input.setAttribute('aria-label',`${field.label}${field.suffix?' em '+field.suffix:''}`);
      if(english){input.lang=field.language||'en-GB';input.spellcheck=false;input.maxLength=500;input.setAttribute('autocapitalize','off');group.classList.add('study-text-label');}
      wrap.append(input);if(field.suffix)wrap.append(node('span','',field.suffix));
      if(supportsPower) {
        const insert=button('xʸ',()=>{
          if(input.disabled)return;
          input.setRangeText('^',input.selectionStart??input.value.length,input.selectionEnd??input.value.length,'end');input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));
        });insert.className='study-insert-power';insert.setAttribute('aria-label',`Inserir expoente em ${field.label}`);insert.title='Inserir ^ entre a base e o expoente';wrap.append(insert);
        const hint=node('small','study-muted','Escreve a potência completa: 2^3 ou 2³.');hint.id=`study-answer-hint-${i}`;input.setAttribute('aria-describedby',hint.id);group.append(wrap,hint);
      } else group.append(wrap);
      fields.append(group);
    }
  });form.append(fields);
}
function values(form,q) {const data=new FormData(form);return q.fields.map((_,i)=>data.get(`answer-${i}`)??'');}

function renderSession() {
  const s=state.active;if(!s)return home();openSession();
  const pane=$('study-session');pane.replaceChildren();
  const q=currentQuestion();const item=s.queue[s.index];const test=s.mode==='test';
  const top=node('div','study-heading');const title=node('h2','',modeNames[s.mode]);title.id='session-title';
  pane.append(node('p','study-eyebrow',studyLabel));
  top.append(title,button('Guardar e sair',home));pane.append(top);
  const count=s.mode==='game'?`${s.keys||0} de ${s.goal} chaves conquistadas`:`Pergunta ${s.index+1} de ${s.queue.length}`;
  pane.append(node('p','study-eyebrow',`${count} · ${TOPICS.find(t=>t.id===q.topic).title}`));
  const bar=node('progress');bar.max=s.mode==='game'?s.goal:s.queue.length;bar.value=s.mode==='game'?s.keys||0:s.index;bar.setAttribute('aria-label',count);pane.append(bar);
  if(s.mode==='game')pane.append(node('div','study-keys',Array.from({length:s.goal},(_,i)=>i<(s.keys||0)?'🔑':'○').join('  ')));
  if(test)pane.append(node('p','study-muted','Usa papel e lápis. Podes voltar atrás. Só vais ver as soluções depois de entregar.'));
  if(item.repair)pane.append(node('p','study-pill','Volta a experimentar · aplica o que aprendeste'));
  const question=node('h3','study-question',q.prompt);pane.append(question);
  if(course.writing)question.lang='en-GB';
  if(q.diagram)pane.append(diagramNode(q.diagram));
  if(course.adaptive)pane.append(node('p','study-muted',`${q.source} · Nível ${q.level}: ${['','Recordar','Interpretar','Aplicar e justificar'][q.level]}${test?' · '+q.points+' pontos':''}`));
  if(q.passage)pane.append(passageNode(q.passage));
  if(q.clock)pane.append(clockNode(q.clock));
  if(q.chart)pane.append(chartNode(q.chart));
  if(q.table)pane.append(tableNode(q.table));
  if(q.build)pane.append(buildChart(q,s.answers[s.index]));
  if(!test&&!s.feedback) {
    const hint=node('div','study-hint');
    const revealed=Boolean(s.hints?.[s.index]);
    const hintText=node('p','',TOPIC_HINTS[q.topic]);hintText.hidden=!revealed;hintText.id='study-hint-text';hintText.setAttribute('role','status');
    const reveal=button(revealed?'Pista aberta':'Preciso de uma pista',()=>{
      s.hints??={};s.hints[s.index]=true;save();hintText.hidden=false;reveal.disabled=true;reveal.textContent='Pista aberta';reveal.setAttribute('aria-expanded','true');
    });reveal.disabled=revealed;reveal.setAttribute('aria-expanded',String(revealed));reveal.setAttribute('aria-controls',hintText.id);
    hint.append(reveal,node('small','study-muted','Com pista, o acerto conta como feito com ajuda.'),hintText);pane.append(hint);
  }
  const scratch=node('details','study-scratch');scratch.append(node('summary','','O meu raciocínio (rascunho)'));
  const scratchLabel=node('label','',(course.writing||course.adaptive)?'Aponta a regra ou as palavras que te ajudaram. Este rascunho não recebe nota.':'Escreve os passos ou faz as contas no papel. Este rascunho não recebe nota.');const area=node('textarea');area.rows=3;area.value=s.notes?.[s.index]||'';area.maxLength=2000;area.addEventListener('input',()=>{s.notes??={};s.notes[s.index]=area.value;save();});scratchLabel.append(area);scratch.append(scratchLabel);pane.append(scratch);
  const form=node('form');form.id='study-answer-form';answerInputs(form,q,s.answers[s.index]);
  const message=node('p');message.id='answer-message';message.setAttribute('role','alert');form.append(message);
  form.addEventListener('input',()=>{s.answers[s.index]=values(form,q);save();if(q.build)updateBuild(q,s.answers[s.index]);});
  const controls=node('div','study-controls');
  if(test) {
    if(s.index>0)controls.append(button('Anterior',()=>{s.index--;save();renderSession();}));
    if(s.index<s.queue.length-1)controls.append(button('Seguinte',()=>{s.index++;save();renderSession();},true));
    else controls.append(button('Rever e entregar',confirmTest,true));
  } else if(!s.feedback) {
    const submit=node('button','study-primary','Verificar resposta');submit.type='submit';controls.append(submit);
  }
  if(test&&course.writing&&s.index===s.queue.length-1)form.append(writingEditor(s,'writing',false));
  form.append(controls);form.addEventListener('submit',event=>{event.preventDefault();if(!test&&!s.feedback)checkAnswer(form,q);});pane.append(form);
  let feedbackTitle=null;
  if(s.feedback) {
    form.querySelectorAll('input,button').forEach(n=>n.disabled=true);
    const feedback=feedbackNode(q,s.feedback);feedbackTitle=feedback.querySelector('h4');pane.append(feedback);
    pane.append(button(s.feedback.correct?'Continuar':s.mode==='game'?'Já li · tentar um novo desafio':'Já li a explicação · continuar',advance,true));
  }
  focusHeading(feedbackTitle||question);
}

function checkAnswer(form,q) {
  const s=state.active;const answers=values(form,q);const result=grade(q,answers);
  if(!result.valid) { $('answer-message').textContent=answerError(q);return; }
  const repair=Boolean(s.queue[s.index].repair),hinted=Boolean(s.hints?.[s.index]);
  const assisted=repair||hinted;
  s.answers[s.index]=answers;s.feedback={correct:result.correct,parts:result.parts};
  s.attempts.push({id:q.id,answers,correct:result.correct,assisted,repair,hinted});
  state.progress=recordAttempt(state.progress,q.id,result.correct,assisted);
  if(course.adaptive&&!result.correct)s.lastConceptError=q.topic+':'+q.skill;
  if(s.mode==='game'&&result.correct)s.keys=(s.keys||0)+1;
  save();renderSession();
}
function advance() {
  const s=state.active;const q=currentQuestion();const correct=s.feedback.correct;
  if(!correct) {
    const next=reinforcement(q,s.queue.map(item=>item.id),Math.random,QUESTIONS);
    const newItem={id:next.id,repair:true};
    if(s.mode==='game')s.queue.splice(s.index+1,0,newItem);
    else if(!s.queue[s.index].repair)s.queue.push(newItem);
  }
  s.feedback=null;
  if(s.mode==='game'&&(s.keys||0)>=s.goal)return finishSession();
  if(s.index+1>=s.queue.length)return finishSession();
  s.index++;save();renderSession();
}
function confirmTest() {
  const s=state.active;const missing=s.queue.findIndex((item,i)=>!grade(byId.get(item.id),s.answers[i]).valid);
  if(missing>=0) {s.index=missing;save();renderSession();$('answer-message').textContent=answerError(currentQuestion());return;}
  if(course.writing&&!s.writing?.trim()){s.index=s.queue.length-1;save();renderSession();$('answer-message').textContent='Falta a composição. Escreve o teu texto antes de entregar; a revisão da escrita será feita por grelha.';$('study-writing-text').focus();return;}
  const pane=$('study-session');pane.replaceChildren();
  const title=node('h2','','Entregar o teste?');title.id='session-title';pane.append(title,node('p','',`Respondeste aos ${s.queue.length} exercícios${course.writing?' e escreveste a composição':''}. Depois de entregar, vais ver a correção${course.writing?' e a grelha para rever a escrita':''}.`),button('Voltar e rever respostas',renderSession),button('Entregar e ver correção',()=>{
    s.attempts=s.queue.map((item,i)=>{
      const q=byId.get(item.id);const answers=s.answers[i];const {correct}=grade(q,answers);state.progress=recordAttempt(state.progress,q.id,correct);return {id:q.id,answers,correct,assisted:false};
    });finishSession();
  },true));focusHeading(title);
}
function finishSession() {
  const s=state.active;const first=s.attempts.filter(a=>a.repair===false||!a.assisted);const correct=first.filter(a=>a.correct&&!a.assisted).length;
  const score=course.adaptive&&s.mode==='test'?scoreTest(s.attempts,QUESTIONS):null;
  const report={...(score?{score}:{}),date:Date.now(),mode:s.mode,correct,total:first.length,attempts:s.attempts,minutes:Math.max(1,Math.round((Date.now()-s.startedAt)/60000)),...(s.writing?{writing:s.writing}:{})};
  state.history.unshift(report);state.history=state.history.slice(0,20);state.active=null;save();showReport(report);
}
function showReport(report) {
  openSession();const pane=$('study-session');pane.replaceChildren();
  const title=node('h2','',report.mode==='game'?'Missão cumprida!':'Sessão terminada');title.id='session-title';
  pane.append(node('p','study-eyebrow',studyLabel),title,node('p','study-result',report.score?`${report.score.earned} / ${report.score.total} pontos · ${Math.round(report.score.earned/report.score.total*100)}%`:`${report.correct} / ${report.total} sem ajuda${report.mode==='test'?` · ${Math.round(report.correct/report.total*100)}%`:''}`));
  pane.append(node('p','',report.score?'Cada pergunta vale 5 pontos, repartidos igualmente pelas suas alíneas. Revê também as justificações.':report.mode==='test'?'Cada pergunta vale o mesmo. Confere os passos abaixo, mesmo nas que acertaste.':'Os acertos depois de uma explicação ficam separados dos acertos sem ajuda. Continua a praticar os temas que ainda precisam de atenção.'));
  if(report.writing)pane.append(node('p','study-recommendation','Esta percentagem refere-se apenas aos 20 exercícios de correção automática. A composição fica por rever com a grelha abaixo e não está incluída na nota.'));
  const helped=report.attempts.filter(a=>a.correct&&a.assisted).length;
  if(helped)pane.append(node('p','study-recommendation',`Conseguiste resolver ${helped} ${helped===1?'desafio':'desafios'} com ajuda. Já deste um passo! Noutro dia, volta a tentar sem a pista nem a explicação.`));
  pane.append(node('p','study-muted','Antes de terminar, escolhe uma pergunta e explica em voz alta como chegaste à resposta. Volta a praticar noutro dia.'));
  const failedTopics=[...new Set(report.attempts.filter(a=>!a.correct).map(a=>byId.get(a.id)?.topic))].filter(Boolean);
  if(failedTopics.length)pane.append(node('p','study-recommendation','Na próxima sessão: '+failedTopics.map(id=>TOPICS.find(t=>t.id===id).title).join(' · ')));
  const controls=node('div','study-controls');controls.append(button('Voltar ao estudo',home,true));if(failedTopics.length)controls.append(button('Praticar dificuldades',()=>requestStart('review','all')));pane.append(controls);
  report.attempts.forEach((a,i)=>{
    const q=byId.get(a.id);if(!q)return;
    const details=node('details','study-correction');details.open=!a.correct;
    details.append(node('summary','',`${i+1}. ${a.correct?'Certo':'A rever'}${a.hinted?' · com pista':a.assisted?' · após explicação':''} · ${TOPICS.find(t=>t.id===q.topic).title}`),node('h3','',q.prompt));
    if(q.chart)details.append(chartNode(q.chart));if(q.table)details.append(tableNode(q.table));
    if(q.diagram)details.append(diagramNode(q.diagram));
    if(q.passage)details.append(passageNode(q.passage));if(q.clock)details.append(clockNode(q.clock));
    details.append(node('p','',`Respondeste: ${(a.answers||[]).join(' · ')}`),feedbackNode(q,grade(q,a.answers)));pane.append(details);
  });focusHeading(title);
  if(report.writing){const writing=node('section','study-writing');writing.append(node('h3','','A tua composição · revisão por grelha'),node('p','study-written-text',report.writing));appendWritingGuide(writing);pane.append(writing);}
}

function feedbackNode(q,result) {
  const panel=node('div',`study-feedback ${result.correct?'is-correct':'is-wrong'}`);panel.setAttribute('role','status');
  panel.append(node('h4','',result.correct?'Certo! Confirma o raciocínio.':'Ainda não. Vamos por partes.'));
  const answers=q.fields.map(f=>`${f.label||'Resposta'}: ${formatAnswer(f)}${f.suffix?' '+f.suffix:''}`);
  panel.append(node('p','study-solution',answers.join(' · ')));
  if(result.parts?.length>1)panel.append(node('p','',result.parts.map((p,i)=>`${q.fields[i].label||'Escolha'}: ${p.correct?'certo':'a rever'}`).join(' · ')));
  if(course.adaptive&&!result.correct)panel.append(node('p','study-recommendation','Conceito a rever: '+q.skill+'. Lê a explicação, fecha-a e tenta explicar o que muda na tua resposta. Vais receber outro exercício para aplicar a ideia.'));
  const steps=node('ol');q.steps.forEach(step=>steps.append(node('li','',step)));panel.append(steps);return panel;
}

function diagramNode({kind,chemical}) {
  const figure=node('figure','study-science-diagram');
  const caption=kind==='route'?'Percurso funcional simplificado — identifica A e B':kind==='particles'?'Modelo de transformação de substâncias':'Parede intestinal simplificada — observa a superfície';
  figure.append(node('figcaption','',caption));
  const svg=svgNode('svg',{viewBox:'0 0 500 370',role:'img','aria-label':kind==='route'?'Boca, faringe, esófago, A, B, intestino grosso e ânus, unidos por setas nesta ordem.':kind==='particles'?(chemical?'A origina B e C.':'A divide-se em pedaços A.'):'Pregas com projeções em forma de dedo. No interior das projeções há vasos sanguíneos e linfáticos.'});
  if(kind==='route'){
    ['Boca','Faringe','Esófago','A','B','Intestino grosso','Ânus'].forEach((label,i)=>{
      const y=8+i*51;svg.append(svgNode('rect',{x:100,y,width:300,height:36,rx:14,fill:'#243c4b',stroke:'#a3dbc5'}),svgNode('text',{x:250,y:y+24,'text-anchor':'middle',fill:'#fff','font-size':19},label));
      if(i<6)svg.append(svgNode('text',{x:250,y:y+50,'text-anchor':'middle',fill:'#a3dbc5','font-size':19},'↓'));
    });
  }else if(kind==='particles'){
    for(const [x,y,r,label] of [[95,170,55,'A'],[340,130,30,chemical?'B':'A'],[395,220,30,chemical?'C':'A']])svg.append(svgNode('circle',{cx:x,cy:y,r,fill:label==='A'?'#d9a363':label==='B'?'#8cb9fa':'#a3dbc5'}),svgNode('text',{x,y:y+7,'text-anchor':'middle',fill:'#101722','font-size':26},label));
    svg.append(svgNode('text',{x:210,y:180,fill:'currentColor','font-size':44},'→'),svgNode('text',{x:35,y:325,fill:'currentColor','font-size':18},'Cada letra representa uma substância.'));
  }else{
    svg.append(svgNode('path',{d:'M35 285 L35 160 Q35 65 75 65 Q115 65 115 160 L115 230 Q115 245 135 245 Q155 245 155 230 L155 160 Q155 65 195 65 Q235 65 235 160 L235 230 Q235 245 255 245 Q275 245 275 230 L275 160 Q275 65 315 65 Q355 65 355 160 L355 285 Z',fill:'#b88067',stroke:'#f8c899','stroke-width':4}));
    for(const x of [75,195,315]){svg.append(svgNode('path',{d:`M${x-13} 275 V155 Q${x-13} 105 ${x} 105 Q${x+13} 105 ${x+13} 155 V275`,fill:'none',stroke:'#8cb9fa','stroke-width':5}),svgNode('line',{x1:x,y1:275,x2:x,y2:140,stroke:'#a3dbc5','stroke-width':4}));}
    svg.append(svgNode('text',{x:25,y:325,fill:'currentColor','font-size':18},'Projeções da parede → maior superfície'),svgNode('text',{x:25,y:352,fill:'currentColor','font-size':16},'Azul: vasos sanguíneos · verde: linfáticos'));
  }
  figure.append(svg,node('p','study-muted',kind==='particles'?'Modelo original simplificado; as letras identificam substâncias, não tamanhos reais.':'Esquema original, sem escala; não representa todos os pormenores anatómicos.'));return figure;
}

function passageNode(passage) {
  const panel=node('section','study-reading');panel.lang='en-GB';panel.setAttribute('aria-label','Reading text');
  panel.append(node('h4','',passage.title));passage.paragraphs.forEach(text=>panel.append(node('p','',text)));return panel;
}
function clockNode({hour,minute}) {
  const figure=node('figure','study-clock');figure.append(node('figcaption','','Read the clock'));
  const svg=svgNode('svg',{viewBox:'0 0 240 240',role:'img','aria-label':`Clock: ${hour}:${String(minute).padStart(2,'0')}`});
  svg.append(svgNode('circle',{cx:120,cy:120,r:108,fill:'#182231',stroke:'#a3dbc5','stroke-width':4}));
  for(let n=1;n<=12;n++){const angle=n*Math.PI/6-Math.PI/2;svg.append(svgNode('text',{x:120+88*Math.cos(angle),y:126+88*Math.sin(angle),'text-anchor':'middle',fill:'#f0f4fa','font-size':18},n));}
  for(const [angle,length,width,color] of [[(hour%12+minute/60)*Math.PI/6,53,7,'#a3dbc5'],[minute*Math.PI/30,76,4,'#8cb9fa']])
    svg.append(svgNode('line',{x1:120,y1:120,x2:120+length*Math.sin(angle),y2:120-length*Math.cos(angle),stroke:color,'stroke-width':width,'stroke-linecap':'round'}));
  svg.append(svgNode('circle',{cx:120,cy:120,r:5,fill:'#f0f4fa'}));figure.append(svg);return figure;
}
function appendWritingGuide(panel) {
  const guide=node('div');guide.append(node('h4','','Revê o teu texto'));
  course.writing.checklist.forEach(item=>{const label=node('label','study-writing-check');const check=node('input');check.type='checkbox';label.append(check,document.createTextNode(item));guide.append(label);});
  const details=node('details');details.append(node('summary','','Ver um exemplo depois de tentar'));
  const model=node('p','study-example',course.writing.model);model.lang='en-GB';details.append(model,node('p','study-muted','Este é um exemplo possível. Compara a estrutura e as regras; mantém as tuas próprias ideias. A grelha não verifica automaticamente a gramática nem dá nota à composição.'));
  panel.append(guide,details);
}
function writingEditor(owner,key,withGuide) {
  const panel=node('section','study-writing');panel.append(node('h3','','Writing · '+course.writing.title));
  const prompt=node('p','',course.writing.prompt);prompt.lang='en-GB';panel.append(prompt);
  const plan=node('ol');course.writing.plan.forEach(item=>plan.append(node('li','',item)));panel.append(plan);
  const label=node('label','','O teu texto em inglês');label.htmlFor='study-writing-text';const area=node('textarea');area.id='study-writing-text';area.rows=8;area.lang='en-GB';area.spellcheck=false;area.maxLength=3000;area.value=owner[key]||'';
  const count=node('p','study-muted');count.setAttribute('aria-live','polite');
  const update=()=>{count.textContent=`${area.value.trim()?area.value.trim().split(/\s+/).length:0} palavras · objetivo: 40–60. O texto fica guardado neste navegador.`;};update();
  area.addEventListener('input',()=>{owner[key]=area.value;save();update();});panel.append(label,area,count);
  if(withGuide)appendWritingGuide(panel);else panel.append(node('p','study-muted','Escreve o teu próprio texto. A grelha e o exemplo só aparecem depois de entregar. A escrita fica fora da percentagem automática.'));
  return panel;
}
function writingWorkshop() {
  openSession();const pane=$('study-session');pane.replaceChildren();const title=node('h2','','Oficina de escrita');title.id='session-title';
  pane.append(node('p','study-eyebrow',studyLabel),title,node('p','','Faz um plano, escreve sem copiar e revê. No fim, lê o teu texto em voz alta: consegues perceber cada frase que escreveste?'),writingEditor(state,'writingDraft',true),button('Guardar e voltar ao estudo',home,true));focusHeading(title);
}

function tableNode(data) {
  const wrap=node('div','study-table-wrap');const table=node('table','study-table');
  const head=table.createTHead().insertRow();data.headers.forEach(h=>{const th=node('th','',h);th.scope='col';head.append(th);});
  const body=table.createTBody();data.rows.forEach(row=>{const tr=body.insertRow();row.forEach((v,i)=>{const td=node(i===0?'th':'td','',String(v));if(i===0)td.scope='row';tr.append(td);});});wrap.append(table);return wrap;
}
const NS='http://www.w3.org/2000/svg';
function svgNode(tag,attrs={},text) {const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=text;return n;}
function chartNode(chart) {
  const figure=node('figure','study-chart');figure.append(node('figcaption','',chart.title));
  const description=chart.labels.map((l,i)=>chart.second?`${l}: ${chart.series[0]} ${chart.values[i]}${chart.unit}; ${chart.series[1]} ${chart.second[i]}${chart.unit}`:`${l}: ${chart.values[i]} ${chart.unit}`).join('; ');
  const svg=svgNode('svg',{viewBox:`0 0 640 ${chart.type==='pie'?Math.max(290,chart.labels.length*44+65):290}`,role:'img','aria-label':`${chart.title}. ${description}`});
  const colors=['#8cb9fa','#c6a2eb','#e7b874','#75c8ae'];
  if(chart.type==='pie') {
    let angle=-Math.PI/2;
    chart.values.forEach((v,i)=>{
      const next=angle+v/100*2*Math.PI;const x=150+110*Math.cos(angle),y=145+110*Math.sin(angle);const nx=150+110*Math.cos(next),ny=145+110*Math.sin(next);
      svg.append(svgNode('path',{d:`M150,145 L${x},${y} A110,110 0 ${v>50?1:0},1 ${nx},${ny} Z`,fill:colors[i%4],stroke:'#182231','stroke-width':3}));
      const middle=(angle+next)/2;svg.append(svgNode('text',{x:150+75*Math.cos(middle),y:150+75*Math.sin(middle),'text-anchor':'middle',fill:'#101722','font-weight':700},`${v}%`));
      svg.append(svgNode('rect',{x:300,y:60+i*44,width:16,height:16,fill:colors[i%4]}),svgNode('text',{x:330,y:74+i*44,fill:'currentColor'},`${chart.labels[i]} · ${v}%`));angle=next;
    });
  } else {
    const max=Math.ceil(Math.max(...chart.values,...(chart.second||[]))/(chart.step*2))*chart.step*2||1;
    for(let value=0;value<=max;value+=chart.step){const y=232-value/max*190;svg.append(svgNode('line',{x1:55,x2:615,y1:y,y2:y,stroke:'currentColor',opacity:.16}),svgNode('text',{x:44,y:y+5,'text-anchor':'end',fill:'currentColor','font-size':13},value));}
    svg.append(svgNode('text',{x:55,y:21,fill:'currentColor','font-size':14},chart.unit));
    const cell=550/chart.labels.length;
    chart.values.forEach((v,i)=>{const hist=chart.type==='histogram';const grouped=Boolean(chart.second);const width=hist?cell:cell*(grouped?.3:.55);const x=55+i*cell+(hist?0:cell*.2);svg.append(svgNode('rect',{x,y:232-v/max*190,width,height:v/max*190,fill:grouped?colors[0]:colors[i%4],stroke:hist?'#182231':'none','stroke-width':2}),svgNode('text',{x:55+(i+.5)*cell,y:256,'text-anchor':'middle',fill:'currentColor','font-size':13},chart.labels[i]));if(grouped)svg.append(svgNode('rect',{x:x+width+3,y:232-chart.second[i]/max*190,width,height:chart.second[i]/max*190,fill:colors[1]}));});
    if(chart.second)chart.series.forEach((name,i)=>svg.append(svgNode('rect',{x:300+i*140,y:6,width:12,height:12,fill:colors[i]}),svgNode('text',{x:319+i*140,y:17,fill:'currentColor','font-size':13},name)));
    if(chart.axisLabel)svg.append(svgNode('text',{x:335,y:282,'text-anchor':'middle',fill:'currentColor','font-size':14},chart.axisLabel));
  }
  figure.append(svg);
  const details=node('details');details.append(node('summary','','Ver os dados em tabela'),tableNode({headers:chart.second?['Categoria',...chart.series.map(s=>`${s} (${chart.unit})`)]:['Categoria / classe',chart.unit],rows:chart.labels.map((l,i)=>chart.second?[l,chart.values[i],chart.second[i]]:[l,chart.values[i]])}));figure.append(details);return figure;
}
function buildChart(q,answers=[]) {
  const wrap=node('figure','study-chart');wrap.append(node('figcaption','',`O teu histograma · ${q.build.unit}`));
  const frame=node('div','study-build-frame');
  const axis=node('div','study-build-axis');axis.setAttribute('aria-hidden','true');
  const step=q.build.unit==='%'?20:2;
  for(let value=0;value<=q.build.max;value+=step){const tick=node('span','',String(value));tick.style.top=`${155*(1-value/q.build.max)}px`;axis.append(tick);}
  const grid=node('div','study-build');grid.id='study-build';
  q.build.labels.forEach((label,i)=>{const col=node('div');const rail=node('div','study-build-rail');const pixels=155*step/q.build.max;rail.style.background=`repeating-linear-gradient(to top,transparent,transparent ${pixels-1}px,#394b6340 ${pixels-1}px,#394b6340 ${pixels}px)`;const fill=node('div','study-build-fill');fill.dataset.bar=i;rail.append(fill);col.append(rail,node('span','',label));grid.append(col);});
  frame.append(axis,grid);wrap.append(frame,node('p','study-muted',`${q.build.axisLabel?`Eixo horizontal: ${q.build.axisLabel}. `:''}Escala vertical: 0 a ${q.build.max} ${q.build.unit}. As barras mostram os valores que escreves; são corrigidas quando verificares.`));
  queueMicrotask(()=>updateBuild(q,answers));return wrap;
}
function updateBuild(q,answers=[]) {
  $('study-build')?.querySelectorAll('[data-bar]').forEach((n,i)=>{const v=parseNumber(answers[i],q.fields[i].suffix)??0;n.style.height=`${Math.min(100,Math.max(0,v/q.build.max*100))}%`;n.title=`${q.build.labels[i]}: ${answers[i]||0} ${q.build.unit}`;});
}

function answerError(q) {
  if(q.fields.some(f=>f.type==='order'))return 'Usa todas as palavras para construir a frase. Podes desfazer e tentar outra ordem.';
  if(course.adaptive&&q.fields.some(f=>f.type==='text'))return 'Completa todas as alíneas. Escreve apenas o termo pedido. A correção aceita a ausência de acentos e mostra a grafia correta.';
  if(q.fields.some(f=>f.type==='text'))return 'Completa todas as respostas em inglês. Nas lacunas, escreve só a parte em falta; nas transformações, escreve a frase completa.';
  if(q.fields.some(f=>f.options))return q.fields.every(f=>f.options)?'Escolhe uma resposta antes de verificar.':'Escolhe uma opção e completa o resultado numérico. Podes usar vírgula decimal.';
  return q.fields.some(f=>f.type==='power')
    ? 'Completa todas as respostas. No campo da potência, escreve a base e o expoente: por exemplo, 2^3 ou 2³.'
    : 'Completa todas as respostas com o resultado numérico. Podes usar vírgula decimal.';
}

function renderPlan() {
  const list=$('study-plan-list');list.replaceChildren();
  const sorted=[...planState.plan].sort((a,b)=>a.date.localeCompare(b.date)||a.subject.localeCompare(b.subject));
  if(!sorted.length) { list.append(node('li','study-muted','Ainda não há tarefas. Escolhe um dia e uma pequena meta.'));return; }
  const today=localDateKey();
  sorted.forEach(task=>{
    const item=node('li',task.done?'is-done':'');const label=node('label');const check=node('input');check.type='checkbox';check.checked=Boolean(task.done);check.setAttribute('aria-label',`Concluir: ${task.task}`);check.addEventListener('change',()=>{task.done=check.checked;savePlan();renderPlan();});
    const content=node('span');const date=new Intl.DateTimeFormat('pt-PT',{day:'numeric',month:'short',timeZone:'Europe/Lisbon'}).format(new Date(`${task.date}T12:00:00Z`));
    content.append(node('strong','',task.task),node('small','',`${date} · ${task.subject} · ${task.minutes} min${!task.done&&task.date<today?' · Por fazer':''}`));label.append(check,content);
    item.append(label,button('Remover',()=>{planState.plan=planState.plan.filter(t=>t.id!==task.id);savePlan();renderPlan();}));list.append(item);
  });
}
function renderHistory() {
  $('study-history').replaceChildren();
  if(!state.history.length){$('study-history').append(node('p','study-muted','A tua primeira sessão começa aqui. Não precisas de acertar em tudo para aprender.'));return;}
  state.history.slice(0,8).forEach(report=>{
    const card=node('div','study-history-row');const date=new Intl.DateTimeFormat('pt-PT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Lisbon'}).format(new Date(report.date));
    card.append(node('span','',`${date} · ${studyLabel} · ${modeNames[report.mode]||'Sessão'}`),node('strong','',report.score?`${report.score.earned}/${report.score.total} pontos`:`${report.correct}/${report.total} sem ajuda`),button('Ver correção',()=>showReport(report)));$('study-history').append(card);
  });
}

// Também gravar uma mensagem clara se o armazenamento estiver bloqueado na leitura.
const access=await whenAccessResolved();
if(access.user&&access.mode!=='none') {
  for(const c of COURSES){
    storageKeys[c.id]=`francisca-study-v1:${access.user.uid}${c.id==='maths'?'':':'+c.id+'-test-1'}`;
    let raw=null;try{raw=localStorage.getItem(storageKeys[c.id]);}catch{$('study-storage').textContent='O armazenamento deste navegador está bloqueado. O plano e o progresso só duram enquanto esta página estiver aberta.';}
    states[c.id]=readState(raw,c.questions);
  }
  planState=states.maths;renderSubjects();chooseSubject('Matemática');
  $('plan-date').value=localDateKey();
  document.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>requestStart(b.dataset.start)));
  $('study-review').addEventListener('click',()=>requestStart('review','all'));
  $('study-resume').addEventListener('click',renderSession);
  $('study-writing-button').addEventListener('click',writingWorkshop);
  $('study-plan-form').addEventListener('submit',event=>{
    event.preventDefault();try {
      const task=normalizeTask($('plan-subject').value,$('plan-date').value,$('plan-task').value,$('plan-minutes').value,FRANCISCA_SUBJECTS);
      planState.plan.push({...task,id:crypto.randomUUID()});savePlan();renderPlan();$('plan-task').value='';$('plan-status').textContent='Tarefa acrescentada ao teu plano.';
    }catch(error){$('plan-status').textContent=error.message;}
  });
  $('study-content').setAttribute('aria-busy','false');
}
