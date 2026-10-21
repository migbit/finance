import test from 'node:test';
import assert from 'node:assert/strict';
import {ENGLISH_QUESTIONS as Q,ENGLISH_TOPICS as T,ENGLISH_HINTS,ENGLISH_WRITING} from '../js/francisca-estudar-english-data.js';
import {ENGLISH_COURSE,MATHS_COURSE} from '../js/francisca-estudar-courses.js';
import {grade,formatAnswer,normalizeEnglish,selectQuestions,reinforcement,readState,emptyState} from '../js/francisca-estudar-core.js';
const find=phrase=>{const q=Q.find(q=>q.prompt.includes(phrase));assert.ok(q,phrase);return q;};

test('Inglês cobre os nove temas das digitalizações, sem colidir com Matemática',()=>{
  assert.equal(Q.length,157);assert.equal(T.length,9);assert.equal(new Set(Q.map(q=>q.id)).size,Q.length);
  const mathIds=new Set(MATHS_COURSE.questions.map(q=>q.id));
  for(const topic of T){assert.ok(ENGLISH_HINTS[topic.id]);assert.ok(Q.filter(q=>q.topic===topic.id).length>=8);}
  for(const q of Q){assert.ok(!mathIds.has(q.id));assert.ok(T.some(t=>t.id===q.topic));assert.ok(q.steps.length>=2);assert.equal(grade(q,q.fields.map(f=>f.answer)).correct,true,q.id);
    for(const f of q.fields){assert.ok(formatAnswer(f));if(f.options)assert.equal(new Set(f.options).size,f.options.length,q.id);for(const accepted of f.accept||[]){const answers=q.fields.map(f=>f.answer);answers[q.fields.indexOf(f)]=accepted;assert.equal(grade(q,answers).correct,true,q.id);}}
  }
});

test('simulações: 20 exercícios, leitura coerente, vocabulário e todas as estruturas principais',()=>{
  const seen=new Set();
  for(let i=0;i<100;i++){
    const exam=selectQuestions('test','all',{},Math.random,ENGLISH_COURSE);
    assert.equal(exam.length,20);assert.equal(new Set(exam.map(q=>q.id)).size,20);
    const reading=exam.slice(0,4);assert.equal(new Set(reading.map(q=>q.readingSet)).size,1);assert.ok(reading.every(q=>q.passage));seen.add(reading[0].readingSet);
    assert.deepEqual(reading.map(q=>q.skill),['true-false-written','full-answer','short-answer','time']);
    assert.ok(reading[0].fields.some(f=>f.type==='text'));assert.equal(reading[1].fields[0].type,'text');
    for(const skill of ['affirmative','negative','question','frequency'])assert.ok(exam.some(q=>q.topic==='en-present'&&q.skill===skill));
    for(const skill of ['determiner','pronoun','case'])assert.ok(exam.some(q=>q.topic==='en-possessives'&&q.skill===skill));
    for(const topic of T)assert.ok(exam.some(q=>q.topic===topic.id),topic.id);
  }
  assert.equal(seen.size,2);
  assert.ok(ENGLISH_WRITING.prompt.includes('40–60'));assert.equal(ENGLISH_WRITING.checklist.length,5);
});

test('corrige gramática e formas alternativas sem aceitar palavras erradas',()=>{
  const cases=[
    ['My brother ____ happy.',['is'],['are']],
    ['She is late.',["She isn't late."],['She not is late.']],
    ['Are the children at home?',['No, they are not.'],['No, they is not.']],
    ['He has got a dog.',["He hasn't got a dog."],["He haven't got a dog."]],
    ['your sister ____ a pet?',['Has','got'],['Have','got']],
    ['She plays tennis.',["She doesn't play tennis."],["She doesn't plays tennis."]],
    ['He has lunch at home.',["He doesn't have lunch at home."],["He doesn't has lunch at home."]],
    ['your brother ____ (study)',['Does','study','does'],['Does','studies','does']],
    ['Put “never”',['She is never late.'],['She never is late.']],
    ['belonging to the girls',["the girls' bikes"],["the girl's bikes"]],
    ['belonging to the children',["the children's toys"],["the childrens' toys"]],
    ['Those are her shoes.',['hers'],["her's"]],
    ['The cat is black.',['Its'],["It's"]],
    ['from Portugal.',['Portuguese'],['portuguese']],
    ['birthday is ____ November.',['in','on'],['on','in']],
  ];
  for(const [phrase,correct,wrong] of cases){const q=find(phrase);assert.equal(grade(q,correct).correct,true,phrase);assert.equal(grade(q,wrong).correct,false,phrase);}
  assert.equal(normalizeEnglish(' No,they aren’t. '),"no they aren't");
  assert.equal(formatAnswer({type:'text',answer:'She is twelve.'}),'She is twelve.');
  assert.equal(grade(find('He has got a dog.'),['']).valid,false);
});

test('revisão: compreensão escrita, mistura de regras e alternativas válidas',()=>{
  const cases=[
    ['“Mia has lunch at home.”',['False','has lunch'],['False','have lunch']],
    ['then complete the correction using have got',['False','have not got'],['False','has not got']],
    ['Where does Mia have breakfast?',['She has breakfast in the kitchen.'],['She have breakfast in the kitchen.']],
    ['Where does Oliver have lunch?',['He has lunch with his friends at school.'],['He has lunch with my friends at school.']],
    ['Lara ____ (study)',['studies',"doesn't study",'play'],['studies',"doesn't studies",'plays']],
    ['How / your sister / go to school?',['How does your sister go to school?'],['How does your sister goes to school?']],
    ['Ben ____ (do)',['does','tries'],['do','trys']],
    ['“Mia goes to school on foot.”',['True','walks'],['True','walk']],
    ['“Oliver’s family has got a dog.”',['True','have got'],['False','have got']],
    ['Are the children at home?',["No they aren't"],["No they isn't"]]
  ];
  for(const [phrase,right,wrong] of cases){assert.equal(grade(find(phrase),right).correct,true,phrase);assert.equal(grade(find(phrase),wrong).correct,false,phrase);}
  const expected=['always','usually','often','sometimes','never'];
  Q.filter(q=>q.skill==='frequency-meaning').forEach((q,i)=>{assert.equal(grade(q,[expected[i]]).correct,true);assert.equal(grade(q,[expected[(i+1)%5]]).correct,false);});
  for(const answer of ['After breakfast I brush my teeth.','At half past one we have lunch.','After school he often plays football.']){
    const q=Q.find(q=>q.fields[0].accept?.includes(answer));assert.ok(q,answer);assert.equal(grade(q,[answer]).correct,true);
  }
  // Os oito exercícios antigos mantêm IDs e campos, para retomar sessões guardadas.
  assert.equal(Q.find(q=>q.id==='en-reading-2').fields[0].options.length,3);
  assert.equal(Q.find(q=>q.id==='en-reading-8').fields[0].answer,'at quarter to ten');
});

test('relógios, leitura e ordenação usam respostas verificadas pelos dados',()=>{
  const times=["seven o'clock",'quarter past eight','half past six','quarter to ten','ten past eight','ten to eleven','twenty past four','twenty to three'];
  Q.filter(q=>q.clock).forEach((q,i)=>assert.equal(grade(q,[times[i]]).correct,true));
  assert.equal(grade(Q.find(q=>q.clock?.hour===9),['quarter past nine']).correct,false);
  assert.equal(grade(find('What nationality is Mia?'),['Irish']).correct,true);
  assert.equal(grade(find('Has Mia got curly hair?'),["No, she hasn't."]).correct,true);
  assert.equal(grade(find('What is Oliver’s mum’s job?'),['nurse']).correct,true);
  assert.equal(grade(find('Does Ruby often read'),['Yes, she does.']).correct,true);
  for(const q of Q.filter(q=>q.fields.some(f=>f.type==='order'))){
    const f=q.fields[0];assert.equal(grade(q,[f.words.join(' ')]).correct,true);
    assert.equal(grade(q,[f.words.slice(1).join(' ')]).valid,false);
    assert.equal(grade(q,[[...f.words].reverse().join(' ')]).correct,false);
  }
});

test('treino, recuperação, histórico e rascunho respeitam a disciplina',()=>{
  for(const mode of ['train','game']){const qs=selectQuestions(mode,'all',{},Math.random,ENGLISH_COURSE);assert.equal(qs.length,mode==='train'?6:5);assert.ok(qs.every(q=>q.id.startsWith('en-')));}
  const q=Q.find(q=>q.skill==='nationality');const other=reinforcement(q,[q.id],Math.random,Q);assert.notEqual(other.id,q.id);assert.equal(other.skill,q.skill);
  const state=emptyState();state.progress[q.id]={attempts:1,lastCorrect:false};state.writingDraft='My routine.';
  state.active={mode:'train',queue:[{id:q.id}],index:0,answers:{0:['Irish']},attempts:[],startedAt:1,goal:1,hints:{0:true},writing:'A saved composition.'};
  const en=readState(JSON.stringify(state),Q);assert.equal(en.writingDraft,'My routine.');assert.equal(en.active.writing,'A saved composition.');assert.equal(en.active.hints[0],true);
  assert.equal(readState(JSON.stringify(state)).active,null);
  assert.deepEqual(selectQuestions('review','all',en.progress,Math.random,ENGLISH_COURSE).map(q=>q.id),[q.id]);
});
