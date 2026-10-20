import { whenAccessResolved } from './script.js';
import { FRANCISCA_SUBJECTS } from './francisca-calendar-core.js';
import { QUESTIONS, TOPICS } from './francisca-estudar-data.js';
import { grade, shuffle, selectQuestions, reinforcement, readState, recordAttempt, localDateKey, normalizeTask } from './francisca-estudar-core.js';

const $=id=>document.getElementById(id);
const byId=new Map(QUESTIONS.map(q=>[q.id,q]));
const modeNames={train:'Treino com ajuda',game:'Missão: 5 chaves',test:'Como num teste',review:'Rever dificuldades'};
const studyLabel='Matemática · 1.º Teste';
let state, storageKey, selectedSubject='Matemática';
function node(tag,className,text) { const n=document.createElement(tag); if(className)n.className=className; if(text!==undefined)n.textContent=text; return n; }
function button(text,handler,primary=false) { const n=node('button',primary?'study-primary':'',text);n.type='button';n.addEventListener('click',handler);return n; }
function save() {
  try { localStorage.setItem(storageKey,JSON.stringify(state)); }
  catch { $('study-storage').textContent='Não foi possível guardar neste navegador. Mantém esta página aberta para não perderes o progresso e o plano.'; $('study-storage').setAttribute('role','alert'); }
}
function focusHeading(n) { n.tabIndex=-1; n.focus({preventScroll:true}); n.scrollIntoView({block:'start',behavior:'instant'}); }
function openSession() { $('study-dashboard').hidden=true;$('study-session').hidden=false; }
function home() { $('study-dashboard').hidden=false;$('study-session').hidden=true;renderDashboard();focusHeading($('maths-title')); }
function currentQuestion() { return byId.get(state.active.queue[state.active.index].id); }

function renderDashboard() {
  const attempted=Object.values(state.progress).filter(p=>p.attempts>0).length;
  const independent=Object.values(state.progress).filter(p=>p.independent>0).length;
  const difficult=Object.values(state.progress).filter(p=>p.lastCorrect===false).length;
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
    article.append(details,button('Praticar este tema',()=>requestStart('train',topic.id)));$('study-topics').append(article);
  });
  renderPlan();renderHistory();
}

function renderSubjects() {
  const icons=['∑','Aa','⌛','✎','❧','En','◎','♧','✧','♫'];
  FRANCISCA_SUBJECTS.forEach((subject,i)=>{
    const b=button('',()=>{
      selectedSubject=subject;
      for(const child of $('study-subjects').children)child.setAttribute('aria-pressed',String(child.dataset.subject===subject));
      $('study-maths').hidden=subject!=='Matemática';
      $('study-subject-note').textContent=subject==='Matemática'?'':'Ainda não há material de estudo de '+subject+'. Já podes organizar esta disciplina no plano. Os exercícios serão acrescentados quando houver páginas do livro.';
      $('plan-subject').value=subject;
    });
    b.dataset.subject=subject;b.setAttribute('aria-pressed',String(subject===selectedSubject));
    b.append(node('span','study-subject-icon',icons[i]),node('strong','',subject),node('small','',i===0?'1.º Teste disponível':'Aguarda material'));
    $('study-subjects').append(b);
    $('plan-subject').append(new Option(subject,subject));
  });
  TOPICS.forEach(t=>$('study-topic').append(new Option(t.title,t.id)));
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
  const qs=selectQuestions(mode,mode==='review'?'all':topic,state.progress);
  if(!qs.length)return;
  state.active={mode,queue:qs.map(q=>({id:q.id,repair:false})),index:0,answers:{},attempts:[],startedAt:Date.now(),goal:qs.length,keys:0,feedback:null};save();renderSession();
}
function answerInputs(form,q,answers=[]) {
  const fields=node('div','study-answer-fields');
  q.fields.forEach((field,i)=>{
    if(field.options) {
      const fieldset=node('fieldset','study-choices');fieldset.append(node('legend','',field.label||'Escolhe uma resposta'));
      // A ordem fica estável ao regressar à pergunta e não denuncia a opção correta.
      const seed=[...q.id].reduce((n,c)=>n+c.charCodeAt(0),0);
      let s=seed;const options=shuffle(field.options,()=>{s=(s*9301+49297)%233280;return s/233280;});
      options.forEach((option,j)=>{
        const label=node('label','study-choice');const input=node('input');input.type='radio';input.name=`answer-${i}`;input.value=option;input.checked=answers[i]===option;input.required=false;
        label.append(input,node('span','study-choice-letter',String.fromCharCode(65+j)),node('span','',option));fieldset.append(label);
      });fields.append(fieldset);
    } else {
      const label=node('label','study-number-label');label.append(node('span','',field.label));
      const wrap=node('span','study-input-wrap');const input=node('input');input.name=`answer-${i}`;input.type='text';input.inputMode='decimal';input.autocomplete='off';input.value=answers[i]??'';input.setAttribute('aria-label',`${field.label}${field.suffix?' em '+field.suffix:''}`);
      wrap.append(input);if(field.suffix)wrap.append(node('span','',field.suffix));label.append(wrap);fields.append(label);
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
  if(q.chart)pane.append(chartNode(q.chart));
  if(q.table)pane.append(tableNode(q.table));
  if(q.build)pane.append(buildChart(q,s.answers[s.index]));
  const scratch=node('details','study-scratch');scratch.append(node('summary','','O meu raciocínio (rascunho)'));
  const scratchLabel=node('label','','Escreve os passos ou faz as contas no papel. Este rascunho não recebe nota.');const area=node('textarea');area.rows=3;area.value=s.notes?.[s.index]||'';area.maxLength=2000;area.addEventListener('input',()=>{s.notes??={};s.notes[s.index]=area.value;save();});scratchLabel.append(area);scratch.append(scratchLabel);pane.append(scratch);
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
  form.append(controls);form.addEventListener('submit',event=>{event.preventDefault();if(!test&&!s.feedback)checkAnswer(form,q);});pane.append(form);
  let feedbackTitle=null;
  if(s.feedback) {
    form.querySelectorAll('input').forEach(n=>n.disabled=true);
    const feedback=feedbackNode(q,s.feedback);feedbackTitle=feedback.querySelector('h4');pane.append(feedback);
    pane.append(button(s.feedback.correct?'Continuar':s.mode==='game'?'Já li · tentar um novo desafio':'Já li a explicação · continuar',advance,true));
  }
  focusHeading(feedbackTitle||question);
}

function checkAnswer(form,q) {
  const s=state.active;const answers=values(form,q);const result=grade(q,answers);
  if(!result.valid) { $('answer-message').textContent='Preenche todas as respostas. Nos números, usa apenas o valor (podes usar vírgula decimal).';return; }
  const assisted=Boolean(s.queue[s.index].repair);
  s.answers[s.index]=answers;s.feedback={correct:result.correct,parts:result.parts};
  s.attempts.push({id:q.id,answers,correct:result.correct,assisted});
  state.progress=recordAttempt(state.progress,q.id,result.correct,assisted);
  if(s.mode==='game'&&result.correct)s.keys=(s.keys||0)+1;
  save();renderSession();
}
function advance() {
  const s=state.active;const q=currentQuestion();const correct=s.feedback.correct;
  if(!correct) {
    const next=reinforcement(q,s.queue.map(item=>item.id));
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
  if(missing>=0) {s.index=missing;save();renderSession();$('answer-message').textContent='Falta completar esta pergunta antes de entregar o teste.';return;}
  const pane=$('study-session');pane.replaceChildren();
  const title=node('h2','','Entregar o teste?');title.id='session-title';pane.append(title,node('p','','Respondeste às 12 perguntas. Depois de entregar, vais ver a classificação e a resolução de cada exercício.'),button('Voltar e rever respostas',renderSession),button('Entregar e ver correção',()=>{
    s.attempts=s.queue.map((item,i)=>{
      const q=byId.get(item.id);const answers=s.answers[i];const {correct}=grade(q,answers);state.progress=recordAttempt(state.progress,q.id,correct);return {id:q.id,answers,correct,assisted:false};
    });finishSession();
  },true));focusHeading(title);
}
function finishSession() {
  const s=state.active;const first=s.attempts.filter(a=>!a.assisted);const correct=first.filter(a=>a.correct).length;
  const report={date:Date.now(),mode:s.mode,correct,total:first.length,attempts:s.attempts,minutes:Math.max(1,Math.round((Date.now()-s.startedAt)/60000))};
  state.history.unshift(report);state.history=state.history.slice(0,20);state.active=null;save();showReport(report);
}
function showReport(report) {
  openSession();const pane=$('study-session');pane.replaceChildren();
  const title=node('h2','',report.mode==='game'?'Missão cumprida!':'Sessão terminada');title.id='session-title';
  pane.append(node('p','study-eyebrow',studyLabel),title,node('p','study-result',`${report.correct} / ${report.total} à primeira${report.mode==='test'?` · ${Math.round(report.correct/report.total*100)}%`:''}`));
  pane.append(node('p','',report.mode==='test'?'Cada pergunta vale o mesmo. Confere os passos abaixo, mesmo nas que acertaste.':'Os acertos depois de uma explicação ficam separados dos acertos sem ajuda. Continua a praticar os temas que ainda precisam de atenção.'));
  const failedTopics=[...new Set(report.attempts.filter(a=>!a.correct).map(a=>byId.get(a.id)?.topic))].filter(Boolean);
  if(failedTopics.length)pane.append(node('p','study-recommendation','Na próxima sessão: '+failedTopics.map(id=>TOPICS.find(t=>t.id===id).title).join(' · ')));
  const controls=node('div','study-controls');controls.append(button('Voltar ao estudo',home,true));if(failedTopics.length)controls.append(button('Praticar dificuldades',()=>requestStart('review','all')));pane.append(controls);
  report.attempts.forEach((a,i)=>{
    const q=byId.get(a.id);if(!q)return;
    const details=node('details','study-correction');details.open=!a.correct;
    details.append(node('summary','',`${i+1}. ${a.correct?'Certo':'A rever'}${a.assisted?' · após explicação':''} · ${TOPICS.find(t=>t.id===q.topic).title}`),node('h3','',q.prompt));
    if(q.chart)details.append(chartNode(q.chart));if(q.table)details.append(tableNode(q.table));
    details.append(node('p','',`Respondeste: ${(a.answers||[]).join(' · ')}`),feedbackNode(q,grade(q,a.answers)));pane.append(details);
  });focusHeading(title);
}

function feedbackNode(q,result) {
  const panel=node('div',`study-feedback ${result.correct?'is-correct':'is-wrong'}`);panel.setAttribute('role','status');
  panel.append(node('h4','',result.correct?'Certo! Confirma o raciocínio.':'Ainda não. Vamos por partes.'));
  const answers=q.fields.map(f=>`${f.label||'Resposta'}: ${f.answer}${f.suffix?' '+f.suffix:''}`);
  panel.append(node('p','study-solution',answers.join(' · ')));
  if(result.parts?.length>1)panel.append(node('p','',result.parts.map((p,i)=>`${q.fields[i].label}: ${p.correct?'certo':'a rever'}`).join(' · ')));
  const steps=node('ol');q.steps.forEach(step=>steps.append(node('li','',step)));panel.append(steps);return panel;
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
  const svg=svgNode('svg',{viewBox:'0 0 640 290',role:'img','aria-label':`${chart.title}. ${description}`});
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
  frame.append(axis,grid);wrap.append(frame,node('p','study-muted',`Escala vertical: 0 a ${q.build.max} ${q.build.unit}. As barras mostram os valores que escreves; são corrigidas quando verificares.`));
  queueMicrotask(()=>updateBuild(q,answers));return wrap;
}
function updateBuild(q,answers=[]) {
  $('study-build')?.querySelectorAll('[data-bar]').forEach((n,i)=>{const v=Number(String(answers[i]||0).replace(',','.').replace('%',''));n.style.height=`${Math.min(100,Math.max(0,Number.isFinite(v)?v/q.build.max*100:0))}%`;n.title=`${q.build.labels[i]}: ${answers[i]||0} ${q.build.unit}`;});
}

function renderPlan() {
  const list=$('study-plan-list');list.replaceChildren();
  const sorted=[...state.plan].sort((a,b)=>a.date.localeCompare(b.date)||a.subject.localeCompare(b.subject));
  if(!sorted.length) { list.append(node('li','study-muted','Ainda não há tarefas. Escolhe um dia e uma pequena meta.'));return; }
  const today=localDateKey();
  sorted.forEach(task=>{
    const item=node('li',task.done?'is-done':'');const label=node('label');const check=node('input');check.type='checkbox';check.checked=Boolean(task.done);check.setAttribute('aria-label',`Concluir: ${task.task}`);check.addEventListener('change',()=>{task.done=check.checked;save();renderPlan();});
    const content=node('span');const date=new Intl.DateTimeFormat('pt-PT',{day:'numeric',month:'short',timeZone:'Europe/Lisbon'}).format(new Date(`${task.date}T12:00:00Z`));
    content.append(node('strong','',task.task),node('small','',`${date} · ${task.subject} · ${task.minutes} min${!task.done&&task.date<today?' · Por fazer':''}`));label.append(check,content);
    item.append(label,button('Remover',()=>{state.plan=state.plan.filter(t=>t.id!==task.id);save();renderPlan();}));list.append(item);
  });
}
function renderHistory() {
  $('study-history').replaceChildren();
  if(!state.history.length){$('study-history').append(node('p','study-muted','A tua primeira sessão começa aqui. Não precisas de acertar em tudo para aprender.'));return;}
  state.history.slice(0,8).forEach(report=>{
    const card=node('div','study-history-row');const date=new Intl.DateTimeFormat('pt-PT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Lisbon'}).format(new Date(report.date));
    card.append(node('span','',`${date} · ${studyLabel} · ${modeNames[report.mode]||'Sessão'}`),node('strong','',`${report.correct}/${report.total} à primeira`),button('Ver correção',()=>showReport(report)));$('study-history').append(card);
  });
}

// Também gravar uma mensagem clara se o armazenamento estiver bloqueado na leitura.
const access=await whenAccessResolved();
if(access.user&&access.mode!=='none') {
  storageKey=`francisca-study-v1:${access.user.uid}`;
  let raw=null;try{raw=localStorage.getItem(storageKey);}catch{$('study-storage').textContent='O armazenamento deste navegador está bloqueado. O plano e o progresso só duram enquanto esta página estiver aberta.';}
  state=readState(raw);renderSubjects();renderDashboard();
  $('plan-date').value=localDateKey();
  document.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>requestStart(b.dataset.start)));
  $('study-review').addEventListener('click',()=>requestStart('review','all'));
  $('study-resume').addEventListener('click',renderSession);
  $('study-plan-form').addEventListener('submit',event=>{
    event.preventDefault();try {
      const task=normalizeTask($('plan-subject').value,$('plan-date').value,$('plan-task').value,$('plan-minutes').value,FRANCISCA_SUBJECTS);
      state.plan.push({...task,id:crypto.randomUUID()});save();renderPlan();$('plan-task').value='';$('plan-status').textContent='Tarefa acrescentada ao teu plano.';
    }catch(error){$('plan-status').textContent=error.message;}
  });
  $('study-content').setAttribute('aria-busy','false');
}
