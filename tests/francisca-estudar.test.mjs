import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS,TOPICS } from '../js/francisca-estudar-data.js';
import { parseNumber,parsePower,formatAnswer,grade,selectQuestions,reinforcement,recordAttempt,readState,emptyState,localDateKey,normalizeTask } from '../js/francisca-estudar-core.js';
import { FRANCISCA_SUBJECTS } from '../js/francisca-calendar-core.js';
import { getModuleAccess,filterNavigation,FRANCISCA_UID,FILIPA_UID,LEONOR_UID } from '../js/access-control.js';

test('cada teste cobre os seis temas, sem repetir perguntas; todos os temas têm material de treino',()=>{
  assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,QUESTIONS.length);
  for(let i=0;i<100;i++) {
    const exam=selectQuestions('test');assert.equal(exam.length,12);assert.equal(new Set(exam.map(q=>q.id)).size,12);
    for(const topic of TOPICS) {assert.equal(exam.filter(q=>q.topic===topic.id).length,2);assert.equal(new Set(exam.filter(q=>q.topic===topic.id).map(q=>q.skill)).size,2);assert.ok(QUESTIONS.filter(q=>q.topic===topic.id).length>=8);}
    assert.equal(new Set(selectQuestions('train').map(q=>q.topic)).size,6);
  }
});
test('a validação aceita vírgula e percentagem, recusa campos vazios, texto parcial e expressões',()=>{
  assert.equal(parseNumber(' 12,5 '),12.5);assert.equal(parseNumber('28 %','%'),28);
  for(const text of ['', '   ','2+3','28 alunos','28%','Infinity','12,4.5','0x10']) assert.equal(parseNumber(text),null);
  const q=QUESTIONS.find(q=>q.id==='classes-8');
  assert.equal(grade(q,['24','40','36']).correct,true);
  assert.equal(grade(q,['24','40','35']).correct,false);
  assert.equal(grade(q,['24','40','']).valid,false);
  assert.equal(grade(q,['24']).valid,false);
});
test('resultados revistos independentemente: potências, prioridade e contexto',()=>{
  const lookup=prompt=>QUESTIONS.find(q=>q.prompt.includes(prompt));
  assert.equal(grade(lookup('Calcula 3⁴'),['81']).correct,true);
  assert.equal(grade(lookup('Calcula 3⁴'),['12']).correct,false);
  assert.equal(grade(lookup('18 ÷ 3 × 2'),['12']).correct,true);
  assert.equal(grade(lookup('20 − 6 + 2'),['16']).correct,true);
  assert.equal(grade(lookup('perímetro'),['32']).correct,true);
  assert.equal(grade(lookup('Pontos')||lookup('Num jogo'),['38','35']).correct,true);
  assert.equal(grade(lookup('Cada mesa leva 3'),['27']).correct,true);
  assert.equal(grade(lookup('3² + (5 − 2)² + 7'),['25','5^2']).correct,true);
  assert.equal(grade(lookup('18 − 2³ − 1'),['9','3²']).correct,true);
  assert.equal(grade(lookup('2² × (3² − 5)'),['16','2⁴']).correct,true);
  assert.equal(grade(lookup('quantos alunos de cada turma')||lookup('O gráfico usa percentagens'),['10','9']).correct,true);
});

test('potências podem ser escritas com ^, ** ou expoentes elevados, sem executar expressões',()=>{
  for(const text of ['2^3','2 ** 3','2³',' 2 ^ 3 '])assert.deepEqual(parsePower(text),{base:2,exponent:3,value:8});
  assert.deepEqual(parsePower('0,5²'),{base:.5,exponent:2,value:.25});
  assert.equal(parsePower('2¹⁰').value,1024);
  for(const text of ['','2','2^','^3','2^3+1','2^(1+2)','Math.pow(2,3)','2^3^2','2^-3','2^1.5','2^9999','0^0','<script>','2e3^2'])assert.equal(parsePower(text),null,text);
  // «Calcula» exige efetuar a conta: copiar a potência do enunciado não basta.
  assert.equal(grade(QUESTIONS.find(q=>q.id==='powers-1'),['3⁴']).valid,false);
  assert.equal(grade(QUESTIONS.find(q=>q.id==='powers-1'),['81']).correct,true);
});

test('auditoria das 80 perguntas: todas aceitam a resposta prevista e as seis que pedem potência aceitam a forma completa',()=>{
  assert.equal(QUESTIONS.length,80);
  for(const q of QUESTIONS)assert.equal(grade(q,q.fields.map(f=>String(f.answer))).correct,true,q.id);
  const powerQuestions=QUESTIONS.filter(q=>q.fields.some(f=>f.type==='power'));
  assert.equal(powerQuestions.length,6);
  for(const q of powerQuestions) {
    const canonical=q.fields.map(f=>String(f.answer));
    const superscripts=q.fields.map(formatAnswer);
    assert.equal(grade(q,canonical).correct,true,q.id);
    assert.equal(grade(q,superscripts).correct,true,q.id);
    const i=q.fields.findIndex(f=>f.type==='power');
    const incomplete=[...canonical];incomplete[i]=String(q.fields[i].exponent);
    assert.equal(grade(q,incomplete).valid,false,q.id);
    const wrongBase=[...canonical];wrongBase[i]=`${q.fields[i].base+1}^${q.fields[i].exponent}`;
    assert.equal(grade(q,wrongBase).valid,true,q.id);
    assert.equal(grade(q,wrongBase).correct,false,q.id);
  }
});

test('sessões antigas conservam as respostas quando o campo passa de expoente para potência',()=>{
  const q=QUESTIONS.find(q=>q.skill==='power-result');
  const state=emptyState();delete state.answerFormat;
  state.active={mode:'test',queue:[{id:q.id}],index:0,answers:{0:['25','2']},attempts:[],startedAt:1,goal:1};
  state.history=[{date:1,attempts:[{id:q.id,answers:['25','2'],correct:true}]}];
  const migrated=readState(JSON.stringify(state));
  assert.deepEqual(migrated.active.answers[0],['25','5^2']);
  assert.deepEqual(migrated.history[0].attempts[0].answers,['25','5^2']);
  assert.equal(migrated.answerFormat,2);
  migrated.active.answers[0][1]='2';
  const current=readState(JSON.stringify(migrated));
  assert.equal(current.active.answers[0][1],'2');
  assert.equal(grade(q,current.active.answers[0]).valid,false);
});
test('classes e histogramas respeitam os limites e os totais',()=>{
  const leaves=QUESTIONS.filter(q=>q.topic==='classes'&&q.skill==='count');
  assert.deepEqual(leaves.map(q=>q.fields[0].answer),[3,4,5,5]);
  const builds=QUESTIONS.filter(q=>q.build);
  assert.deepEqual(builds[0].fields.map(f=>f.answer),[2,4,3,1]);
  assert.deepEqual(builds[2].fields.map(f=>f.answer),[3,3,4]);
  for(const q of builds)assert.equal(q.fields.reduce((sum,f)=>sum+f.answer,0),q.build.unit==='%'?100:10);
  const boundary=QUESTIONS.find(q=>q.skill==='boundary');assert.equal(grade(boundary,['140 a < 150']).correct,true);
});
test('a recuperação propõe outra pergunta; a revisão limita-se às dificuldades',()=>{
  const q=QUESTIONS[0];const next=reinforcement(q,[q.id]);assert.notEqual(next.id,q.id);assert.equal(next.skill,q.skill);
  const progress={[q.id]:{lastCorrect:false},[QUESTIONS[1].id]:{lastCorrect:true}};
  assert.deepEqual(selectQuestions('review','all',progress).map(q=>q.id),[q.id]);
  assert.equal(selectQuestions('review','all',{}).length,0);
});
test('acertar após ajuda não aumenta os acertos independentes',()=>{
  let progress=recordAttempt({},'powers-1',false);
  progress=recordAttempt(progress,'powers-1',true,true);
  assert.equal(progress['powers-1'].attempts,2);assert.equal(progress['powers-1'].independent,0);
  progress=recordAttempt(progress,'powers-1',true,false);assert.equal(progress['powers-1'].independent,1);
});
test('estado danificado e sessões antigas inválidas não bloqueiam a página',()=>{
  for(const raw of ['broken','null','{}','{"version":1,"progress":[],"plan":[],"history":[]}'])assert.deepEqual(readState(raw),emptyState());
  const state=emptyState();state.active={mode:'test',queue:[{id:'missing'}],index:0};assert.equal(readState(JSON.stringify(state)).active,null);
  state.plan=[{id:'x',subject:'Matemática',task:'Rever',date:'2026-10-20',minutes:15,done:false}];assert.equal(readState(JSON.stringify(state)).plan[0].task,'Rever');
});
test('plano valida datas reais e durações; o dia usa Lisboa na mudança de UTC',()=>{
  assert.equal(localDateKey(new Date('2026-10-20T23:30:00Z')),'2026-10-21');
  const task=normalizeTask('Matemática','2026-10-21',' Potências ',15,FRANCISCA_SUBJECTS);assert.equal(task.task,'Potências');
  for(const [date,minutes] of [['2026-02-30',15],['2026-10-21',0],['2026-10-21',12]])assert.throws(()=>normalizeTask('Matemática',date,'Rever',minutes,FRANCISCA_SUBJECTS));
});
test('Estudar integra os acessos da família e exige sessão iniciada',()=>{
  const groups=[{key:'francisca',links:[{key:'francisca-estudar'}]}];
  for(const uid of [FRANCISCA_UID,FILIPA_UID,LEONOR_UID,'parent']) {assert.equal(getModuleAccess(uid,'francisca-estudar','francisca'),'write');assert.equal(filterNavigation(groups,uid)[0].links[0].key,'francisca-estudar');}
  assert.equal(getModuleAccess(null,'francisca-estudar','francisca'),'none');
});
