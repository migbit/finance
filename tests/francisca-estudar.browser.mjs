// Regressão local: respostas com potências, botão xʸ, retoma e correção do teste.
// Conta e estado fictícios; não acede a Firebase nem a dados da utilizadora.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,mkdir } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { createRequire } from 'node:module';
import { QUESTIONS } from '../js/francisca-estudar-data.js';
import { emptyState } from '../js/francisca-estudar-core.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(import.meta.dirname,'..');
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/js/script.js'){res.setHeader('Content-Type','text/javascript');res.end('export async function whenAccessResolved(){return {user:{uid:"power-browser-test"},mode:"write"};}');return;}
  const path=resolve(root,'.'+decodeURIComponent(pathname));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const ids=['powers-1','expressions-1','expressions-13','bars-1','circle-2','classes-1','histogram-1','powers-2','expressions-14','circle-3','classes-6','histogram-5'];
  const state=emptyState();state.active={mode:'test',queue:ids.map(id=>({id,repair:false})),index:0,answers:{},attempts:[],startedAt:Date.now(),goal:12,keys:0,feedback:null};
  await page.addInitScript(seed=>{
    const key='francisca-study-v1:power-browser-test';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));
  },state);
  await page.goto(`http://127.0.0.1:${server.address().port}/modules/francisca-estudar.html`);
  await page.getByRole('button',{name:'Retomar sessão',exact:true}).click();
  for(let i=0;i<ids.length;i++) {
    console.log(`Pergunta ${i+1}: ${ids[i]}`);
    const question=QUESTIONS.find(q=>q.id===ids[i]);
    await page.locator('.study-question').filter({hasText:question.prompt}).waitFor();
    const fields=page.locator('#study-answer-form input[type="text"]');
    assert.equal(await fields.count(),question.fields.length);
    for(let j=0;j<question.fields.length;j++) {
      const field=question.fields[j];const input=fields.nth(j);
      if(i===2&&field.type==='power') {
        assert.equal(await input.getAttribute('inputmode'),'text');
        await input.fill('5');
        await page.getByRole('button',{name:`Inserir expoente em ${field.label}`,exact:true}).click();
        await input.press('2');assert.equal(await input.inputValue(),'5^2');
        await page.reload();await page.getByRole('button',{name:'Retomar sessão',exact:true}).click();
        assert.equal(await page.getByRole('textbox',{name:field.label,exact:true}).inputValue(),'5^2');
        await mkdir(resolve(root,'tests/.runtime'),{recursive:true});
        await page.screenshot({path:resolve(root,'tests/.runtime/francisca-potencias-390.png')});
      } else await input.fill(i===8&&field.type==='power'?'3²':String(field.answer));
    }
    assert.equal(await page.locator('.study-feedback').count(),0,'O teste não revela a correção antes da entrega');
    assert.equal(await page.locator('.study-hint').count(),0,'O teste não oferece pistas');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    assert.equal(overflow,false,`A pergunta ${i+1} não deve alargar o ecrã`);
    await page.getByRole('button',{name:i===ids.length-1?'Rever e entregar':'Seguinte',exact:true}).click();
  }
  await page.getByRole('button',{name:'Entregar e ver correção',exact:true}).click();
  assert.match(await page.locator('.study-result').innerText(),/12 \/ 12.*100%/);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.setViewportSize({width:1280,height:900});
  await page.locator('.study-correction summary').nth(2).click();
  await page.getByText('Potência de base 5: 5²',{exact:false}).waitFor();
  await page.screenshot({path:resolve(root,'tests/.runtime/francisca-potencias-correcao.png')});
  console.log('OK: potências nas perguntas 3 e 9; inserção de expoente; retoma; 12/12 corretas; sem transbordo a 390 px.');

  async function seedTraining(ids) {
    const seed=emptyState();seed.active={mode:'train',queue:ids.map(id=>({id,repair:false})),index:0,answers:{},attempts:[],startedAt:Date.now(),goal:ids.length,keys:0,feedback:null};
    await page.evaluate(seed=>localStorage.setItem('francisca-study-v1:power-browser-test',JSON.stringify(seed)),seed);
    await page.reload();await page.getByRole('button',{name:'Retomar sessão',exact:true}).click();
  }
  async function answer(q) {
    for(let i=0;i<q.fields.length;i++) {
      const field=q.fields[i],inputs=page.locator(`#study-answer-form input[name="answer-${i}"]`);
      if(field.options){const values=await inputs.evaluateAll(ns=>ns.map(n=>n.value));await inputs.nth(values.indexOf(field.answer)).check();}
      else await inputs.fill(String(field.answer).replace('.',','));
    }
    await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();
    await page.locator('.study-feedback.is-correct').waitFor();
  }
  await page.setViewportSize({width:390,height:844});
  await seedTraining(['expressions-16']);
  await page.getByRole('button',{name:'Preciso de uma pista',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'Retomar sessão',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Pista aberta',exact:true}).isDisabled(),true);
  assert.equal(await page.locator('.study-skip').evaluate(n=>n.getBoundingClientRect().bottom<=0),true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:resolve(root,'tests/.runtime/francisca-pista-390.png'),fullPage:true});
  await answer(QUESTIONS.find(q=>q.id==='expressions-16'));
  assert.doesNotMatch(await page.locator('.study-feedback').innerText(),/undefined/);
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  assert.match(await page.locator('.study-result').innerText(),/0 \/ 1 sem ajuda/);
  await page.getByText('Conseguiste resolver 1 desafio com ajuda.',{exact:false}).waitFor();
  const hinted=await page.evaluate(()=>JSON.parse(localStorage.getItem('francisca-study-v1:power-browser-test')));
  assert.equal(hinted.progress['expressions-16'].independent,0);
  assert.equal(hinted.history[0].attempts[0].hinted,true);

  await seedTraining(['powers-1']);
  await page.locator('#study-answer-0').fill('12');
  await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();
  await page.locator('.study-feedback.is-wrong').waitFor();
  await page.getByRole('button',{name:'Já li a explicação · continuar',exact:true}).click();
  const repairState=await page.evaluate(()=>JSON.parse(localStorage.getItem('francisca-study-v1:power-browser-test')));
  const repair=QUESTIONS.find(q=>q.id===repairState.active.queue[1].id);
  assert.equal(repair.topic,'powers');assert.equal(repair.skill,'value');assert.notEqual(repair.id,'powers-1');
  await answer(repair);await page.getByRole('button',{name:'Continuar',exact:true}).click();
  assert.match(await page.locator('.study-result').innerText(),/0 \/ 1 sem ajuda/);
  await page.getByText('Conseguiste resolver 1 desafio com ajuda.',{exact:false}).waitFor();
  console.log('OK: pista persistente, escolha + cálculo, recuperação após erro e contagem sem ajuda.');

  await seedTraining(QUESTIONS.map(q=>q.id));
  for(const [i,q] of QUESTIONS.entries()) {
    await page.locator('.study-question').filter({hasText:q.prompt}).waitFor();
    await answer(q);
    assert.equal(await page.locator('.study-feedback ol li').count(),q.steps.length,q.id);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,q.id);
    if(q.id==='histogram-10'){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(root,'tests/.runtime/francisca-histograma-390.png'),fullPage:true});}
    await page.getByRole('button',{name:'Continuar',exact:true}).click();
    if((i+1)%20===0)console.log(`Verificação no navegador: ${i+1}/${QUESTIONS.length}`);
  }
  assert.match(await page.locator('.study-result').innerText(),/80 \/ 80 sem ajuda/);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('OK: todas as 80 perguntas aceitam resposta, mostram explicação e cabem a 390 px.');
} finally {await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
