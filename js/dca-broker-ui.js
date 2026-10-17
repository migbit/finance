import { db } from './script.js';
import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { parseTradeRepublic, summarizeTransactions, VWCE, AGGH } from './dca-broker.js';
const ref=()=>doc(db,'dca_settings','tr_import');
let current=null,pending=null;
const fmt=n=>Number(n).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
const units=n=>Number(n).toLocaleString('pt-PT',{maximumFractionDigits:10});
export async function loadBrokerLedger() {
  const snap=await getDoc(ref());
  current=snap.exists()?{...snap.data(),...summarizeTransactions(snap.data().transactions)}:null;
  renderLedger();return current;
}
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function summary(root,l) {
  root.append(node('p',`${l.transactions.length} movimentos · período ${l.coverageStart} a ${l.coverageEnd} · último movimento ${l.lastTransaction}`));
  root.append(node('p',`VWCE: ${units(l.positions[VWCE]?.shares||0)} un. · AGGH: ${units(l.positions[AGGH]?.shares||0)} un. · custo das posições detidas (FIFO com encargos): ${fmt(l.heldCost)}.`));
  root.append(node('p',`Saldo reconstruído: ${fmt(l.balance)} · juros recebidos: ${fmt(l.interest)} · resultado das vendas após encargos: ${fmt(l.realized)}. Cálculo patrimonial; não é apuramento fiscal.`));
}
function renderLedger() {
  const root=document.getElementById('broker-import-current');if(!root)return;root.replaceChildren();
  if(!current){root.append(node('p','Importe o CSV completo da Trade Republic para conferir unidades, compras, vendas e encargos.'));return;}
  summary(root,current);
  root.append(node('p','Os movimentos importados substituem os montantes estimados do mesmo período. As valorizações mensais antigas continuam preservadas na base de dados e aguardam extratos datados. TWR indisponível sem avaliações nos fluxos.'));
  const details=document.createElement('details');details.append(node('summary','Todos os movimentos importados'));
  const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table');table.className='table-dca';
  const head=document.createElement('tr');['Data','Tipo','ISIN','Unidades','Montante','Comissão','Imposto'].forEach(s=>head.append(node('th',s)));table.append(head);
  for(const t of current.transactions){const tr=document.createElement('tr');[t.date,t.type,t.isin||'—',t.shares?units(t.shares):'—',fmt(t.amount),fmt(t.fee),fmt(t.tax)].forEach(s=>tr.append(node('td',s)));table.append(tr);}
  wrap.append(table);details.append(wrap);root.append(details);
}
export function initBrokerImport({readOnly=false,onChange}) {
  if(document.getElementById('broker-import-section'))return;
  const section=document.createElement('section');section.className='report-section';section.id='broker-import-section';
  section.innerHTML='<div class="viz-card"><h4>Movimentos Trade Republic</h4><div id="broker-import-current"></div><div id="broker-import-controls"><label>CSV completo da Trade Republic <input id="broker-import-file" type="file" accept=".csv,text/csv"></label><div id="broker-import-preview" aria-live="polite"></div><button type="button" id="broker-import-confirm" hidden>Confirmar importação</button></div><p id="broker-import-feedback" role="status"></p></div>';
  document.querySelector('main.dca-page').insertBefore(section,document.querySelector('#dca-etf-quotes').nextElementSibling);
  document.getElementById('broker-import-controls').hidden=readOnly;
  const feedback=document.getElementById('broker-import-feedback'),preview=document.getElementById('broker-import-preview'),button=document.getElementById('broker-import-confirm');
  document.getElementById('broker-import-file').addEventListener('change',async event=>{
    pending=null;button.hidden=true;preview.replaceChildren();feedback.textContent='';
    try{
      const file=event.target.files[0];if(!file)return;if(file.size>750000)throw Error('Ficheiro demasiado grande para esta importação.');
      const parsed=parseTradeRepublic(await file.text(),file.name);
      if(parsed.transactions.length>1500)throw Error('Mais de 1500 movimentos: dividir exige uma importação específica.');
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      parsed.sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      if(current&&parsed.coverageEnd<current.coverageEnd)throw Error('O período termina antes da importação atual.');
      if(current&&current.transactions.some(t=>!parsed.transactions.some(n=>n.id===t.id)))throw Error('O ficheiro omite movimentos já importados. Use o histórico completo.');
      summary(preview,parsed);
      preview.append(node('p','A confirmação atualiza unidades, saldo e custos a partir deste ficheiro. O histórico manual e a versão anterior ficam numa cópia de segurança. O CSV é lido localmente; só os campos da tabela são guardados na sua base de dados, sem nomes de contrapartes ou IBAN.'));
      if(parsed.duplicates)preview.append(node('p',`${parsed.duplicates} linhas idênticas repetidas foram ignoradas.`));
      pending=parsed;button.hidden=false;
    }catch(error){feedback.textContent=error.message;}
  });
  button.addEventListener('click',async()=>{
    if(!pending||readOnly)return;button.disabled=true;
    try{
      const allMonths=await getDocs(collection(db,'dca'));
      const oldReinforcements=await getDocs(collection(db,'dca_reinforcements'));
      const backupRows=allMonths.docs.filter(d=>d.id<=pending.coverageEnd.slice(0,7)).map(d=>({id:d.id,...d.data()}));
      const parsed=pending;
      await runTransaction(db,async tx=>{
        const sharesRef=doc(db,'dca_settings','shares'),cashRef=doc(db,'dca_juro','current');
        const [old,shares,cash]=await Promise.all([tx.get(ref()),tx.get(sharesRef),tx.get(cashRef)]);
        if(old.data()?.sha256===parsed.sha256)return;
        if(old.exists()&&old.data().coverageEnd>parsed.coverageEnd)throw Error('Outra importação mais recente já foi gravada. Recarregue a página.');
        if(old.exists()&&old.data().transactions.some(t=>!parsed.transactions.some(n=>n.id===t.id)))throw Error('A importação omite movimentos atuais.');
        const archive=doc(db,'dca_settings',`tr_backup_${parsed.sha256.slice(0,24)}`);
        tx.set(archive,{beforeImport:old.data()||null,shares:shares.data()||null,cash:cash.data()||null,months:backupRows,reinforcements:oldReinforcements.docs.map(d=>({id:d.id,...d.data()})),createdAt:serverTimestamp()});
        const stored={filename:parsed.filename,coverageStart:parsed.coverageStart,coverageEnd:parsed.coverageEnd,lastTransaction:parsed.lastTransaction,sha256:parsed.sha256,transactions:parsed.transactions,importedAt:serverTimestamp()};
        tx.set(ref(),stored);
        tx.set(sharesRef,{vwce:parsed.positions[VWCE]?.shares||0,aggh:parsed.positions[AGGH]?.shares||0,updatedAt:serverTimestamp(),brokerAsOf:parsed.coverageEnd},{merge:true});
        tx.set(cashRef,{saldo:parsed.balance,updatedAt:serverTimestamp(),brokerAsOf:parsed.coverageEnd},{merge:true});
      });
      pending=null;button.hidden=true;preview.replaceChildren();feedback.textContent='Importação concluída. Histórico anterior preservado; custos e unidades reconciliados.';
      await onChange();
    }catch(error){feedback.textContent=error.message||'Erro na importação. Nenhuma confirmação de sucesso.';}
    finally{button.disabled=false;}
  });
  renderLedger();
}
