import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HISTORY_COURSE as C} from '../js/francisca-estudar-courses.js';
import {grade,selectQuestions,scoreTest,reinforcement,recordAttempt,conceptEvidence} from '../js/francisca-estudar-core.js';
const Q=C.questions,find=p=>{const q=Q.find(q=>q.prompt.includes(p));assert.ok(q,p);return q;};
test('História: 69 desafios, fontes, variantes, cinco temas e todos os conceitos recuperáveis',()=>{
 assert.equal(Q.length,69);assert.equal(C.topics.length,5);assert.equal(new Set(Q.map(q=>q.id)).size,Q.length);
 for(const q of Q){assert.ok(q.source.includes('PDF'));assert.ok(q.steps.length>=2);assert.equal(q.points,10);assert.equal(grade(q,q.fields.map(f=>f.answer)).correct,true,q.id);const other=reinforcement(q,[q.id],Math.random,Q);assert.notEqual(other.id,q.id);assert.equal(other.skill,q.skill);for(const [i,f] of q.fields.entries()){if(f.options){assert.equal(new Set(f.options).size,f.options.length);const answers=q.fields.map(f=>f.answer);answers[i]=f.options.find(a=>a!==f.answer);assert.equal(grade(q,answers).correct,false,q.id);}for(const a of f.accept||[]){const answers=q.fields.map(f=>f.answer);answers[i]=a;assert.equal(grade(q,answers).correct,true,q.id);}}}
});
test('gabarito independente: datas, ordens, lugares, protagonistas e causa/consequência',()=>{
 for(const [p,a,w] of [
 ['Em que ano o manual',['1695'],['1755']],['Que região é associada',['Minas Gerais'],['Lisboa']],['Que percentagem',['20'],['50']],
 ['clero, nobreza e',['Terceiro Estado'],['Inquisição']],['Que grupo urbano',['burguesia'],['clero']],['judeus convertidos',['cristãos-novos'],['bandeirantes']],
 ['Como se chamava o tribunal',['Inquisição'],['Cortes']],['estilo artístico',['barroco'],['republicano']],['Em que cidade se encontra',['Coimbra'],['Évora']],
 ['Em que data ocorreu',['1 de novembro de 1755'],['1 de novembro de 1750']],['Quem sucedeu',['D. José I'],['Marquês de Pombal']],['estrutura antissísmica',['gaiola'],['aqueduto']],
 ['Que praça substituiu',['Praça do Comércio'],['Praça de Minas Gerais']],['crença que justificava',['Verdadeiro','Acreditava-se que o rei tinha sido escolhido por Deus'],['Falso','Era um resultado de eleições universais']]
 ]){const q=find(p);assert.equal(grade(q,a).correct,true,p);assert.equal(grade(q,w).correct,false,p);}
 assert.equal(grade(find('poderes às funções'),['Legislativo','Executivo','Judicial']).correct,true);
});
test('simulação equilibrada: 10 perguntas, 100 pontos e crédito por alínea',()=>{
 const seen=new Set();for(let i=0;i<100;i++){const qs=selectQuestions('test','all',{},Math.random,C);assert.equal(qs.length,10);assert.equal(new Set(qs.map(q=>q.id)).size,10);for(const t of C.topics){const sub=qs.filter(q=>q.topic===t.id);assert.equal(sub.length,2);assert.equal(new Set(sub.map(q=>q.skill)).size,2);assert.ok(sub.some(q=>q.level===3));assert.ok(sub.some(q=>q.level<3));}assert.deepEqual(scoreTest(qs.map(q=>({id:q.id,answers:q.fields.map(f=>f.answer)})),Q),{earned:100,total:100});seen.add(qs.map(q=>q.id).join());}assert.ok(seen.size>20);
 assert.equal(selectQuestions('train','all',{},Math.random,C).length,6);assert.equal(selectQuestions('game','all',{},Math.random,C).length,5);
 const q=find('poderes às funções');assert.deepEqual(scoreTest([{id:q.id,answers:['Legislativo','Judicial','Judicial']}],Q),{earned:6.67,total:10});
});
test('não confirmar compreensão por um acerto isolado ou com ajuda',()=>{
 const qs=Q.filter(q=>q.topic==='hgp-poder'&&q.skill==='origem');let p={};const day=Date.parse('2026-11-07T12:00Z');p=recordAttempt(p,qs[0].id,true,false,day);assert.equal(conceptEvidence(Q,p,day)['hgp-poder:origem'].secure,false);p=recordAttempt(p,qs[1].id,true,true,day+86400000);assert.equal(conceptEvidence(Q,p)['hgp-poder:origem'].secure,false);p=recordAttempt(p,qs[1].id,true,false,day+86400000);assert.equal(conceptEvidence(Q,p)['hgp-poder:origem'].secure,true);
});
test('cinco imagens WebP locais, com texto alternativo, versão textual e desafio de memória',async()=>{
 assert.equal(C.visuals.length,5);for(const v of C.visuals){assert.ok(v.alt.length>40);assert.ok(v.facts.length>=4);assert.ok(v.recall);assert.ok(v.answer);const b=await readFile(new URL('../'+v.src.replace('../',''),import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');}
});
