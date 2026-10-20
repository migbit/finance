import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../js/francisca-estudar-data.js';
import { grade,formatAnswer } from '../js/francisca-estudar-core.js';

// Gabarito resolvido na auditoria dos enunciados e gráficos, separado dos campos
// answer. Cálculos explícitos onde ajudam a tornar a verificação independente.
const solutions={
  powers:[81,64,36,32,125,49,[7,4],[3,5],'5³','4⁵',['8^2',64],81/3,9,4/100,'10^5','4³ = 4 × 4 × 4 = 64','6^4'],
  expressions:[4+9*2,4*4+6,30-8*3,36/9,18/3*2,20-6+2,2*(3+16),25-9+2,8+12/4,16/4*2,'2 × (3 + 5²)',2*(11+5),[25,'5^2'],[9,'3^2'],[16,'2^4'],['O produto do cubo de dois por quatro',32],5+4*3,['6² ÷ 4',9]],
  bars:[12,'Futebol',8,'Cão',12,'Banana','Turma A',[10+4*3+8*2,8+5*3+6*2],40,[20/2,30*3/10],35],
  circle:['Morango',40/4,40*4/10,7/25*100,12/30*100,100-35-25,18*5,'Escola A',58.3],
  classes:[3,4,5,5,'140 a < 150',142-135,'140 a < 150',[24,40,36],'Diminui',5000,'5 a < 10 e 10 a < 15','A altura de uma planta em centímetros',[28,36,36,44],41.7,[24/8,24/4]],
  histogram:[[2,4,3,1],[20,40,30,10],[3,3,4],[30,30,40],7,'10 a < 20',(3+7)/20*100,6+4,'Histograma com barras encostadas',[20,35,45]]
};

test('as 80 respostas coincidem com o gabarito resolvido e alternativas erradas são recusadas',()=>{
  const covered=new Set();
  for(const [topic,rows] of Object.entries(solutions))rows.forEach((row,index)=>{
    const id=`${topic}-${index+1}`,q=QUESTIONS.find(q=>q.id===id);
    assert.ok(q,id);covered.add(id);
    const expected=(Array.isArray(row)?row:[row]).map(String);
    assert.equal(grade(q,expected).correct,true,id);
    q.fields.forEach((field,i)=>{
      const wrong=[...expected];
      if(field.options){assert.equal(new Set(field.options).size,field.options.length,id);wrong[i]=field.options.find(option=>option!==expected[i]);}
      else if(field.type==='power')wrong[i]=`${field.base}^${field.exponent+1}`;
      else wrong[i]=String(Number(expected[i])+1);
      assert.equal(grade(q,wrong).correct,false,`${id} campo ${i}`);
    });
  });
  assert.deepEqual(new Set(QUESTIONS.map(q=>q.id)),covered);
});

test('percentagens, valores decimais e arredondamentos usam a precisão pedida',()=>{
  const get=id=>QUESTIONS.find(q=>q.id===id);
  assert.equal(grade(get('powers-14'),['0,04']).correct,true);
  assert.equal(formatAnswer(get('powers-14').fields[0]),'0,04');
  assert.equal(grade(get('circle-9'),['58,3%']).correct,true);
  assert.equal(grade(get('circle-9'),['58,333']).correct,false);
  assert.equal(grade(get('classes-14'),['41,7']).correct,true);
  assert.equal(grade(get('classes-14'),['41,6']).correct,false);
});

test('gráficos e histogramas têm dados coerentes com as tabelas e os intervalos',()=>{
  for(const q of QUESTIONS){
    if(q.chart){
      const c=q.chart;assert.equal(c.labels.length,c.values.length,q.id);
      if(c.unit==='%')for(const series of [c.values,c.second].filter(Boolean))assert.equal(series.reduce((a,b)=>a+b,0),100,q.id);
      if(c.type==='histogram')assert.equal(c.values.reduce((a,b)=>a+b,0),20,q.id);
    }
    if(q.build){
      const intervals=q.build.labels.map(l=>l.split(' a < ').map(Number));
      const width=intervals[0][1]-intervals[0][0];
      intervals.forEach(([lo,hi],i)=>{assert.equal(hi-lo,width,q.id);if(i)assert.equal(lo,intervals[i-1][1],q.id);});
      if(q.table){const counts=q.table.rows.map(r=>r[1]),total=counts.reduce((a,b)=>a+b,0);assert.deepEqual(q.fields.map(f=>f.answer),counts.map(n=>n/total*100));}
    }
  }
});
