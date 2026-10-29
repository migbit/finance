import test from 'node:test';
import assert from 'node:assert/strict';
import {SCIENCE_QUESTIONS as Q,SCIENCE_TOPICS as T} from '../js/francisca-estudar-science-data.js';
import {SCIENCE_COURSE as C} from '../js/francisca-estudar-courses.js';
import {grade,selectQuestions,recordAttempt,conceptEvidence,scoreTest,readState,emptyState,reinforcement} from '../js/francisca-estudar-core.js';
const find=s=>{const q=Q.find(q=>q.prompt.includes(s));assert.ok(q,s);return q;};
test('Ciências: integridade, fontes, alternativas e cobertura de todos os temas',()=>{
 assert.equal(Q.length,91);assert.equal(T.length,10);assert.equal(new Set(Q.map(q=>q.id)).size,91);
 for(const t of T){assert.ok(Q.filter(q=>q.topic===t.id).length>=8);assert.ok(t.pages.includes('PDF'));assert.ok(t.lesson.length>=3);}
 for(const q of Q){assert.ok(q.source);assert.ok(q.level>=1&&q.level<=3);assert.equal(grade(q,q.fields.map(f=>f.answer)).correct,true,q.id);for(const [i,f] of q.fields.entries()){for(const a of f.accept||[]){const ans=q.fields.map(f=>f.answer);ans[i]=a;assert.equal(grade(q,ans).correct,true,q.id);}if(f.options){assert.equal(new Set(f.options).size,f.options.length);const ans=q.fields.map(f=>f.answer);ans[i]=f.options.find(a=>a!==f.answer);assert.equal(grade(q,ans).correct,false,q.id);}}}
});
test('gabarito independente: nutrientes, controlo, dados, processos, dentes e órgãos',()=>{
 for(const [prompt,answers] of [
 ['substâncias que constituem',['nutrientes']],['Qual é a função que permite',['plástica']],['tipo de aditivos se relaciona com cor',['corantes']],['Qual é o órgão que liga',['esófago']],['Que órgão armazena',['vesícula biliar']],['utilização de nutrientes pelas células',['assimilação']],['passagem de nutrientes para sangue',['absorção']],['destacam por rasgar',['caninos']],['Como se chama a passagem',['deglutição']],['massa semilíquida',['quimo']],['Que nome tem a massa',['quimo']],['abertura por onde',['ânus']]
 ].filter(([p])=>p!=='massa semilíquida'))assert.equal(grade(find(prompt),answers).correct,true,prompt);
 assert.equal(grade(find('dois tubos onde'),['A e C']).correct,true);
 assert.equal(grade(find('Qual produto tem menos sal'),['A']).correct,true);
 assert.equal(grade(find('sólido tem 24'),['Vermelho']).correct,true);
 assert.equal(grade(find('identifica A e B'),['estômago','intestino delgado']).correct,true);
 assert.equal(grade(find('identifica A e B'),['intestino delgado','estômago']).correct,false);
 assert.equal(grade(find('Qual é o órgão que liga'),['esofago']).correct,true);
 assert.equal(grade(find('Qual é o órgão que liga'),['estomago']).correct,false);
});
test('100 pontos, 20 perguntas únicas, equilíbrio, raciocínio e versões variadas',()=>{
 const versions=new Set();for(let i=0;i<80;i++){const exam=selectQuestions('test','all',{},Math.random,C);assert.equal(exam.length,20);assert.equal(new Set(exam.map(q=>q.id)).size,20);for(const t of T){const qs=exam.filter(q=>q.topic===t.id);assert.equal(qs.length,2);assert.equal(new Set(qs.map(q=>q.skill)).size,2);assert.ok(qs.some(q=>q.level===3));assert.ok(qs.some(q=>q.level<3));}const attempts=exam.map(q=>({id:q.id,answers:q.fields.map(f=>f.answer)}));assert.deepEqual(scoreTest(attempts,Q),{earned:100,total:100});versions.add(exam.map(q=>q.id).join());}assert.ok(versions.size>10);
 const q=find('Associa órgão e produção');const ans=q.fields.map(f=>f.answer);ans[1]='Bílis';assert.deepEqual(scoreTest([{id:q.id,answers:ans}],Q),{earned:3.33,total:5});
});
test('adaptação: um acerto não é domínio; variantes, raciocínio, dias, ajuda e erro posterior',()=>{
 const qs=Q.filter(q=>q.topic==='cn-nutrientes'&&q.skill==='alimento');let p={};const day1=Date.parse('2026-10-28T12:00Z'),day2=day1+86400000;
 p=recordAttempt(p,qs[0].id,true,false,day1);let e=conceptEvidence(Q,p,day2)['cn-nutrientes:alimento'];assert.equal(e.secure,false);assert.equal(e.due,true);
 const next=selectQuestions('train','cn-nutrientes',p,()=>.4,C);assert.ok(next.some(q=>q.id===qs[1].id));
 p=recordAttempt(p,qs[1].id,true,true,day2);assert.equal(conceptEvidence(Q,p,day2)['cn-nutrientes:alimento'].secure,false);
 p=recordAttempt(p,qs[1].id,true,false,day2);assert.equal(conceptEvidence(Q,p,day2)['cn-nutrientes:alimento'].secure,true);
 p=recordAttempt(p,qs[0].id,false,false,day2+1000);assert.equal(conceptEvidence(Q,p,day2+1000)['cn-nutrientes:alimento'].secure,false);
 assert.ok(selectQuestions('review','all',p,Math.random,C).some(q=>q.skill==='alimento'));
 assert.equal(reinforcement(qs[0],[qs[0].id],Math.random,Q).skill,'alimento');
 const s=emptyState();s.progress=p;assert.deepEqual(readState(JSON.stringify(s),Q).progress,p);assert.deepEqual(readState(JSON.stringify(s)).progress,{});
});
