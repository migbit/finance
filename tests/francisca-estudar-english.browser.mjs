// Testes locais com conta fictícia. Nenhum pedido chega ao Firebase.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {ENGLISH_QUESTIONS as Q,ENGLISH_WRITING} from '../js/francisca-estudar-english-data.js';
import {ENGLISH_COURSE} from '../js/francisca-estudar-courses.js';
import {emptyState,selectQuestions} from '../js/francisca-estudar-core.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'tests/.runtime');await mkdir(out,{recursive:true});
const uid='english-browser-test',mathKey=`francisca-study-v1:${uid}`,enKey=mathKey+':english-test-1';
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/js/script.js'){res.setHeader('Content-Type','text/javascript');res.end(`export async function whenAccessResolved(){return {user:{uid:${JSON.stringify(uid)}},mode:'write'};}`);return;}
  const path=resolve(root,'.'+decodeURIComponent(pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const maths=emptyState();maths.progress['powers-1']={attempts:1,independent:1,lastCorrect:true};
  maths.active={mode:'train',queue:[{id:'powers-2',repair:false}],index:0,answers:{0:['64']},attempts:[],startedAt:1,goal:1};
  await page.addInitScript(({mathKey,maths})=>{if(!localStorage.getItem(mathKey))localStorage.setItem(mathKey,JSON.stringify(maths));},{mathKey,maths});
  await page.goto(`http://127.0.0.1:${server.address().port}/modules/francisca-estudar.html`);
  async function english(){await page.locator('[data-subject="Inglês"]').click();await page.getByRole('heading',{name:'Inglês',exact:true}).waitFor();}
  async function seed(mode,questions){const s=emptyState();s.active={mode,queue:questions.map(q=>({id:q.id,repair:false})),index:0,answers:{},attempts:[],startedAt:Date.now(),goal:questions.length,keys:0,feedback:null};await page.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key:enKey,s});await page.reload();await english();await page.getByRole('button',{name:'Retomar sessão',exact:true}).click();}
  async function fill(q){for(const [i,f] of q.fields.entries()){
    const input=page.locator(`#study-answer-form input[name="answer-${i}"]`);
    if(f.options){const values=await input.evaluateAll(ns=>ns.map(n=>n.value));await input.nth(values.indexOf(f.answer)).check();}
    else if(f.type==='order'){for(const word of f.words)await page.locator('.study-word-bank').getByRole('button',{name:word,exact:true,disabled:false}).first().click();}
    else{assert.equal(await input.getAttribute('inputmode'),'text');await input.fill(f.answer);}
  }}
  const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await english();assert.ok((await page.locator('#study-stats').innerText()).includes(`0/${Q.length}`));await overflow();
  await page.screenshot({path:resolve(out,'francisca-english-dashboard-390.png'),fullPage:true});
  await page.getByRole('button',{name:'Oficina de escrita e leitura em voz alta',exact:true}).click();
  await page.locator('#study-writing-text').fill('I get up at seven. I usually read after school.');
  await page.getByRole('button',{name:'Guardar e voltar ao estudo',exact:true}).click();
  await page.reload();await english();await page.getByRole('button',{name:'Oficina de escrita e leitura em voz alta',exact:true}).click();
  assert.match(await page.locator('#study-writing-text').inputValue(),/I usually read/);
  await page.getByRole('button',{name:'Guardar e voltar ao estudo',exact:true}).click();
  await page.locator('#plan-task').fill('Rever possessivos em Inglês');await page.locator('#study-plan-form button').click();
  await page.locator('[data-subject="Matemática"]').click();await page.getByText('Rever possessivos em Inglês',{exact:true}).waitFor();
  assert.match(await page.locator('#study-stats').innerText(),/1\/80/);await page.getByRole('button',{name:'Retomar sessão',exact:true}).click();assert.equal(await page.locator('#study-answer-0').inputValue(),'64');
  await page.getByRole('button',{name:'Guardar e sair',exact:true}).click();
  console.log('OK: disciplinas isoladas, retoma de Matemática, rascunho e plano partilhado.');

  const order=Q.find(q=>q.fields[0].type==='order');await seed('train',[order]);
  const first=order.fields[0].words[0];await page.locator('.study-word-bank').getByRole('button',{name:first,exact:true}).click();
  await page.locator('.study-word-game').getByRole('button',{name:'Desfazer',exact:true}).click();assert.equal(await page.locator('#study-answer-form input[type="hidden"]').inputValue(),'');
  await page.locator('.study-word-bank').getByRole('button',{name:first,exact:true}).click();await page.reload();await english();await page.getByRole('button',{name:'Retomar sessão',exact:true}).click();
  assert.equal(await page.locator('#study-answer-form input[type="hidden"]').inputValue(),first);
  await page.locator('.study-word-game').getByRole('button',{name:'Limpar frase',exact:true}).click();await fill(order);await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();await page.locator('.study-feedback.is-correct').waitFor();
  assert.equal(await page.locator('.study-word-bank button:enabled').count(),0);

  await seed('game',Q.filter(q=>q.topic==='en-be'&&q.skill==='affirmative').slice(0,5));
  await page.locator('#study-answer-0').fill('wrong');await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();await page.locator('.study-feedback.is-wrong').waitFor();
  await page.getByRole('button',{name:'Já li · tentar um novo desafio',exact:true}).click();
  for(let i=0;i<5;i++){const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),enKey);const q=Q.find(q=>q.id===saved.active.queue[saved.active.index].id);await fill(q);await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();}
  await page.getByRole('heading',{name:'Missão cumprida!',exact:true}).waitFor();
  console.log('OK: ordenar frases, desfazer, retoma e missão com recuperação após erro.');

  const exam=selectQuestions('test','all',{},Math.random,ENGLISH_COURSE);await seed('test',exam);
  for(const [i,q] of exam.entries()){
    await fill(q);assert.equal(await page.locator('.study-feedback,.study-hint').count(),0);await overflow();
    if(i===0){assert.equal(await page.locator('.study-reading').count(),1);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(out,'francisca-english-reading-390.png'),fullPage:true});}
    await page.getByRole('button',{name:i===19?'Rever e entregar':'Seguinte',exact:true}).click();
  }
  await page.getByText('Falta a composição.',{exact:false}).waitFor();assert.equal(await page.getByText('Ver um exemplo depois de tentar',{exact:true}).count(),0);
  await page.locator('#study-writing-text').fill(ENGLISH_WRITING.model);await page.reload();await english();await page.getByRole('button',{name:'Retomar sessão',exact:true}).click();assert.equal(await page.locator('#study-writing-text').inputValue(),ENGLISH_WRITING.model);
  await page.getByRole('button',{name:'Rever e entregar',exact:true}).click();await page.getByRole('button',{name:'Entregar e ver correção',exact:true}).click();
  assert.match(await page.locator('.study-result').innerText(),/20 \/ 20.*100%/);await page.getByText('A tua composição · revisão por grelha',{exact:true}).waitFor();assert.equal(await page.locator('.study-writing-check').count(),5);
  await page.getByText('Esta percentagem refere-se apenas',{exact:false}).waitFor();
  console.log('OK: teste de 20 exercícios, escrita obrigatória guardada, nota automática separada e revisão por grelha.');

  await seed('train',Q);
  for(const [i,q] of Q.entries()){
    await fill(q);await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();await page.locator('.study-feedback.is-correct').waitFor();
    assert.equal(await page.locator('.study-feedback ol li').count(),q.steps.length,q.id);await overflow();
    if(q.clock?.minute===45){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(out,'francisca-english-clock-390.png'),fullPage:true});}
    await page.getByRole('button',{name:'Continuar',exact:true}).click();if((i+1)%30===0)console.log(`Inglês no navegador: ${i+1}/${Q.length}`);
  }
  assert.ok((await page.locator('.study-result').innerText()).includes(`${Q.length} / ${Q.length} sem ajuda`));assert.equal(errors.length,0,errors.join('\n'));
  await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Voltar ao estudo',exact:true}).click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(out,'francisca-english-dashboard-1280.png'),fullPage:true});
  console.log(`OK: ${Q.length} perguntas, feedback e apresentação sem transbordo a 390 px.`);
}finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
