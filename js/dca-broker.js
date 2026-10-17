// Trade Republic export parser and FIFO accounting. No network or account access.
export const VWCE = 'IE00BK5BQT80';
export const AGGH = 'IE00BDBRDM35';
const SUPPORTED = new Set(['BUY','SELL','MIGRATION','CUSTOMER_INPAYMENT','TRANSFER_INBOUND','TRANSFER_INSTANT_INBOUND','INTEREST_PAYMENT']);
const cents = n => Math.round((Number(n) + Number.EPSILON) * 100);
const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const qty = n => Math.round(n * 1e10) / 1e10;
function csvRows(text) {
  const out=[]; let row=[],field='',quoted=false;
  text=String(text).replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){field+='"';i++;} else if(!quoted && field!=='') throw Error('Aspas CSV inválidas.'); else quoted=!quoted; }
    else if(c===',' && !quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))out.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw Error('Campo CSV sem fecho de aspas.');
  row.push(field);if(row.some(x=>x!==''))out.push(row);
  return out;
}
function number(value,label) {
  if(value==='')return 0;
  if(!/^-?\d+(\.\d+)?$/.test(value)||!Number.isFinite(Number(value)))throw Error(`Número inválido: ${label}.`);
  return Number(value);
}
export function parseTradeRepublic(text, filename, today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Lisbon'})) {
  const match=/^transactions_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.csv$/.exec(filename);
  if(!match)throw Error('Conserve o nome transactions_AAAA-MM-DD_AAAA-MM-DD.csv.');
  const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
  if(!valid(match[1])||!valid(match[2])||match[1]>match[2]||match[2]>today)throw Error('Período do ficheiro inválido ou futuro.');
  const records=csvRows(text);const headers=records.shift()||[];
  const required=['datetime','date','account_type','category','type','symbol','shares','price','amount','fee','tax','currency','description','transaction_id'];
  if(new Set(headers).size!==headers.length||required.some(k=>!headers.includes(k)))throw Error('Cabeçalhos Trade Republic em falta ou duplicados.');
  const seen=new Map();let duplicates=0;
  for(const fields of records) {
    if(fields.length!==headers.length)throw Error('Linha CSV com número de colunas inválido.');
    const raw=Object.fromEntries(headers.map((k,i)=>[k,fields[i]]));
    if(!SUPPORTED.has(raw.type))throw Error(`Tipo ainda não suportado: ${raw.type}. Nenhum dado foi alterado.`);
    if(raw.account_type!=='DEFAULT'||raw.currency!=='EUR')throw Error('A importação suporta apenas a conta pessoal DEFAULT em EUR.');
    if(!valid(raw.date)||raw.date<match[1]||raw.date>match[2]||raw.datetime.slice(0,10)!==raw.date||!Number.isFinite(Date.parse(raw.datetime)))throw Error('Data de movimento inválida ou fora do período.');
    if(!raw.transaction_id||!/^[a-zA-Z0-9_-]{8,100}$/.test(raw.transaction_id))throw Error('Identificador de movimento inválido.');
    const r={id:raw.transaction_id,datetime:raw.datetime,date:raw.date,type:raw.type,isin:raw.symbol,
      shares:number(raw.shares,'unidades'),price:number(raw.price,'preço'),amount:number(raw.amount,'montante'),fee:number(raw.fee,'comissão'),tax:number(raw.tax,'imposto'),
      scheduled:raw.description.startsWith('Savings plan execution ')};
    if(['BUY','SELL','MIGRATION'].includes(r.type)&&(!/^([A-Z]{2})[A-Z0-9]{10}$/.test(r.isin)||r.shares===0))throw Error('ISIN ou unidades inválidos.');
    if((r.type==='BUY'&&(r.shares<=0||r.amount>=0||r.price<=0))||(r.type==='SELL'&&(r.shares>=0||r.amount<=0||r.price<=0)))throw Error('Sinais de compra/venda inválidos.');
    if(r.fee>0||r.tax>0)throw Error('Reembolso de comissão/imposto exige revisão específica.');
    if(r.type==='MIGRATION'&&(r.amount!==0||r.fee!==0||r.tax!==0))throw Error('Migração com valor monetário exige revisão.');
    const serial=JSON.stringify(r);
    if(seen.has(r.id)){if(seen.get(r.id).serial!==serial)throw Error('ID repetido com dados contraditórios.');duplicates++;continue;}
    seen.set(r.id,{r,serial});
  }
  const transactions=[...seen.values()].map(x=>x.r).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime)||a.id.localeCompare(b.id));
  if(!transactions.length)throw Error('O ficheiro não contém movimentos.');
  const migrations=new Map();
  transactions.filter(r=>r.type==='MIGRATION').forEach(r=>{const k=r.date+':'+r.isin;migrations.set(k,qty((migrations.get(k)||0)+r.shares));});
  if([...migrations.values()].some(n=>Math.abs(n)>1e-8))throw Error('Migrações não emparelhadas; cobertura incompleta.');
  const result={filename,coverageStart:match[1],coverageEnd:match[2],lastTransaction:transactions.at(-1).date,transactions,duplicates};
  return {...result,...summarizeTransactions(transactions)};
}
export function summarizeTransactions(transactions) {
  const lots=new Map(),monthly=new Map();let balance=0,interest=0,realized=0;
  for(const r of transactions) {
    const month=r.date.slice(0,7);
    const m=monthly.get(month)||{month,buys:0,sales:0,fees:0,interest:0,scheduled:0};
    const net=cents(r.amount)+cents(r.fee)+cents(r.tax);
    balance+=net;m.fees+=-cents(r.fee)-cents(r.tax);
    if(r.type==='INTEREST_PAYMENT'){interest+=net;m.interest+=net;}
    if(r.type==='BUY') {
      if(!lots.has(r.isin))lots.set(r.isin,[]);
      lots.get(r.isin).push({shares:r.shares,cost:-net/100});m.buys+=-cents(r.amount);if(r.scheduled)m.scheduled+=-cents(r.amount);
    } else if(r.type==='SELL') {
      let left=-r.shares,cost=0;const ll=lots.get(r.isin)||[];m.sales+=cents(r.amount);
      while(left>1e-9) {
        if(!ll.length)throw Error('Venda sem unidades anteriores. É necessário o histórico desde a primeira compra.');
        const l=ll[0],take=Math.min(left,l.shares),part=l.cost*take/l.shares;
        cost+=part;l.shares=qty(l.shares-take);l.cost-=part;left=qty(left-take);
        if(l.shares<1e-9)ll.shift();
      }
      realized+=net/100-cost;
    }
    const positions=Object.fromEntries([...lots].map(([isin,ll])=>[isin,{shares:qty(ll.reduce((s,l)=>s+l.shares,0)),cost:ll.reduce((s,l)=>s+l.cost,0)}]));
    m.positions=positions;m.balance=balance/100;m.realized=realized;monthly.set(month,m);
  }
  const last=[...monthly.values()].at(-1);
  return {positions:last.positions,balance:balance/100,interest:interest/100,realized:money(realized),heldCost:money(Object.values(last.positions).reduce((s,p)=>s+p.cost,0)),monthly:[...monthly.values()].map(m=>({...m,buys:m.buys/100,sales:m.sales/100,fees:m.fees/100,interest:m.interest/100,scheduled:m.scheduled/100}))};
}
export function applyBrokerRows(rows, ledger) {
  if(!ledger)return rows;
  let latest=null;
  const oldAnchor=rows.find(row=>row.id===ledger.coverageEnd.slice(0,7));
  const delta=oldAnchor?ledger.heldCost-oldAnchor.investedCum:0;
  const deltaVW=oldAnchor?(ledger.positions[VWCE]?.cost||0)-oldAnchor.investedCumSWDA:0;
  const deltaAG=oldAnchor?(ledger.positions[AGGH]?.cost||0)-oldAnchor.investedCumAGGH:0;
  return rows.map(row=>{
    const exact=ledger.monthly.find(m=>m.month===row.id);
    if(exact)latest=exact;
    if(row.id>ledger.coverageEnd.slice(0,7))return {...row,investedCum:money(row.investedCum+delta),investedCumSWDA:money(row.investedCumSWDA+deltaVW),investedCumAGGH:money(row.investedCumAGGH+deltaAG)};
    if(row.id<ledger.coverageStart.slice(0,7)||!latest)return row;
    const p=latest.positions,cost=isin=>money(p[isin]?.cost||0);
    return {...row,brokerVerified:true,brokerSnapshot:ledger.coverageEnd,investedCum:money(Object.values(p).reduce((s,v)=>s+v.cost,0)),investedCumSWDA:cost(VWCE),investedCumAGGH:cost(AGGH),
      regularContributionUsed:exact?.buys||0,monthlyContributionUsed:exact?.buys||0,monthlySWUsed:0,monthlyAGUsed:0,legacyExtraUsed:0,reinforcementTotal:0,reinforcementCount:0,
      cash_interest:exact?.interest||0,swdaNow:null,agghNow:null,totalNow:0,etfTotalNow:0,hasCurrent:false,resTotal:null,resTotalPct:null,resSWDA:null,resSWDAPct:null,resAGGH:null,resAGGHPct:null};
  });
}
export function brokerXirr(ledger, finalValue, date) {
  const flows=ledger.transactions.filter(r=>r.type==='BUY'||r.type==='SELL').map(r=>({date:r.date,value:r.amount+r.fee+r.tax}));
  if(!flows.length||!Number.isFinite(finalValue)||finalValue<=0)return null;
  flows.push({date,value:finalValue});const start=Date.parse(flows[0].date);
  const npv=rate=>flows.reduce((s,f)=>s+f.value/Math.pow(1+rate,(Date.parse(f.date)-start)/86400000/365),0);
  let lo=-0.9999,hi=1;while(npv(lo)*npv(hi)>0&&hi<1024)hi*=2;
  if(npv(lo)*npv(hi)>0)return null;
  for(let i=0;i<160;i++){const mid=(lo+hi)/2;if(npv(lo)*npv(mid)>0)lo=mid;else hi=mid;}
  return (lo+hi)/2*100;
}
