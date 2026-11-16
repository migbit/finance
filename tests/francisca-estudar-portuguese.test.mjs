import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PORTUGUESE_COURSE as C} from '../js/francisca-estudar-courses.js';
import {grade,selectQuestions,scoreTest,reinforcement,recordAttempt,conceptEvidence,readState,emptyState} from '../js/francisca-estudar-core.js';
const Q=C.questions,find=p=>{const q=Q.find(q=>q.prompt.includes(p));assert.ok(q,p);return q;};
test('Português: matéria, soluções, alternativas, acentos e recuperação por conceito',()=>{
 assert.equal(Q.length,92);assert.equal(C.topics.length,10);assert.equal(new Set(Q.map(q=>q.id)).size,Q.length);
 for(const q of Q){assert.ok(q.source);assert.ok(q.steps.length>=2);assert.equal(grade(q,q.fields.map(f=>f.answer)).correct,true,q.id);const r=reinforcement(q,[q.id],Math.random,Q);assert.notEqual(r.id,q.id);assert.equal(r.skill,q.skill);for(const [i,f] of q.fields.entries()){if(f.options){assert.equal(new Set(f.options).size,f.options.length);const a=q.fields.map(f=>f.answer);a[i]=f.options.find(v=>v!==f.answer);assert.equal(grade(q,a).correct,false,q.id);}for(const v of f.accept||[]){const a=q.fields.map(f=>f.answer);a[i]=v;assert.equal(grade(q,a).correct,true,q.id);}}}
 const groups=Object.groupBy(Q,q=>q.topic+':'+q.skill);for(const [key,qs] of Object.entries(groups)){assert.ok(qs.length>=2,key);assert.ok(qs.some(q=>q.level>=2),key);}
 assert.equal(grade(find('os alunos ____ (ser)'),['serão']).correct,true);assert.equal(grade(find('os alunos ____ (ser)'),['serao']).correct,false);
});
test('gabarito independente de gramática e distinções essenciais',()=>{
 for(const [prompt,right,wrong] of [
 ['Em “O jardim floresceu.”',['Nome'],['Verbo']],['Em “O jardim é bonito.”',['Adjetivo'],['Nome']],['Como se chama o primeiro parágrafo',['lead'],['corpo']],
 ['Qual é uma família',['Livro, livraria, livreiro'],['Livro, papel, escola']],['Associa os quantificadores',['Cardinal','Multiplicativo','Fracionário'],['Fracionário','Cardinal','Multiplicativo']],
 ['Compara outros',['Determinante indefinido','Pronome indefinido'],['Pronome indefinido','Determinante indefinido']],
 ['indefinido derivado de outro',['outras'],['outros']],['Rita ____ (decidir)',['decidiu'],['decidia']],['já ____ (terminar)',['tinha terminado'],['terminará']],
 ['identifica o sujeito',['A Rita'],['um livro']],['predicado completo de',['ofereceu um livro ao Tiago'],['ofereceu']],['associa os complementos',['Complemento direto','Complemento indireto'],['Complemento indireto','Complemento direto']],
 ['função de Rita?',['Vocativo'],['Sujeito']],['Qual pontua corretamente',['Rita, traz o livro!'],['Rita traz, o livro!']],['Quantos aquários tem?',['18'],['450']]
 ]){const q=find(prompt);assert.equal(grade(q,right).correct,true,prompt);assert.equal(grade(q,wrong).correct,false,prompt);}
});
test('simulações: 20 exercícios/80 pontos, textos coerentes e 20 pontos de escrita acompanhada',()=>{
 const versions=new Set();for(let i=0;i<100;i++){const qs=selectQuestions('test','all',{},Math.random,C);assert.equal(qs.length,20);assert.equal(new Set(qs.map(q=>q.id)).size,20);for(const t of C.topics){const pair=qs.filter(q=>q.topic===t.id);assert.equal(pair.length,2);assert.equal(new Set(pair.map(q=>q.skill)).size,2);assert.ok(pair.some(q=>q.level===3));assert.ok(pair.some(q=>q.level<3));assert.ok(new Set(pair.map(q=>q.readingSet).filter(Boolean)).size<=1);}assert.deepEqual(scoreTest(qs.map(q=>({id:q.id,answers:q.fields.map(f=>f.answer)})),Q),{earned:80,total:80});versions.add(qs.map(q=>q.id).join());}assert.ok(versions.size>20);assert.equal(C.writing.manualPoints,20);assert.equal(C.writing.checklist.length,5);assert.equal(C.writing.wordGoal,'120–200');const words=C.writing.model.trim().split(/\s+/).length;assert.ok(words>=120&&words<=200,words);
});
test('progresso, rascunho e revisão acompanhada persistem sem se misturar com outras disciplinas',()=>{
 const q=Q.find(q=>q.skill==='estrutura'),r=reinforcement(q,[q.id],Math.random,Q);let p={};const now=Date.parse('2026-11-16T12:00Z');p=recordAttempt(p,q.id,true,false,now);assert.equal(conceptEvidence(Q,p)[q.topic+':'+q.skill].secure,false);p=recordAttempt(p,r.id,true,false,now+86400000);assert.equal(conceptEvidence(Q,p)[q.topic+':'+q.skill].secure,true);
 const s=emptyState();s.progress=p;s.writingDraft='Rascunho';s.history=[{date:now,score:{earned:70,total:80},manualScore:16,writingMarks:[4,4,3,3,2],writing:'Texto da aluna'}];const saved=readState(JSON.stringify(s),Q);assert.equal(saved.writingDraft,'Rascunho');assert.equal(saved.history[0].manualScore,16);assert.deepEqual(readState(JSON.stringify(s)).progress,{});
});
test('seis imagens WebP com alternativa textual e desafio de memória',async()=>{
 assert.equal(C.visuals.length,6);for(const v of C.visuals){assert.ok(v.alt);assert.ok(v.facts.length>=4);assert.ok(v.recall);assert.ok(v.answer);const b=await readFile(new URL('../'+v.src.replace('../',''),import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');}
});
