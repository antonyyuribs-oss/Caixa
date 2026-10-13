/* Motor financeiro — valores em centavos; mês financeiro de 26 a 25. */
export const STORAGE_KEY = 'caixa-semanal-v3';
export const PREVIOUS_STORAGE_KEY = 'caixa-semanal-v2';
export const LEGACY_STORAGE_KEY = 'caixa-semanal-v1';
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const isoDay = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
const formatMonth = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}`;
function parseDate(value) {
  const text = String(value ?? '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y,m,d] = text.split('-').map(Number);
  if (y < 100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d ? date : null;
}
function parseKey(key) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(key))) return null;
  const [y,m] = key.split('-').map(Number);
  return y >= 100 ? { y,m } : null;
}
export function monthKey(date = new Date()) {
  const y=date.getFullYear(), m=date.getMonth(), d=date.getDate();
  return formatMonth(new Date(Date.UTC(y,m+(d>=26?1:0),1)));
}
export function financialMonthOfDate(value) {
  const d = parseDate(value);
  return d ? formatMonth(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+(d.getUTCDate()>=26?1:0),1))) : null;
}
export function shiftMonth(key, delta) {
  const p=parseKey(key);
  if (!p) throw new Error('Mês inválido.');
  return formatMonth(new Date(Date.UTC(p.y,p.m-1+delta,1)));
}
export function monthLabel(key) {
  const p=parseKey(key);
  if (!p) return key;
  const label = new Date(p.y, p.m-1, 1).toLocaleDateString('pt-BR', { month:'long',year:'numeric' });
  return label.charAt(0).toUpperCase()+label.slice(1);
}
// Distribui os dias da forma mais uniforme possível; eventuais dias extras
// vão às semanas iniciais. Exemplo: 30 dias = 8/8/7/7.
export function financialPeriod(key) {
  const p=parseKey(key);
  if(!p) throw new Error('Mês inválido.');
  const start=new Date(Date.UTC(p.y,p.m-2,26));
  const end=new Date(Date.UTC(p.y,p.m-1,25));
  const days=Math.round((end-start)/DAY)+1;
  const base=Math.floor(days/4), extras=days%4;
  let offset=0;
  const weeks=Array.from({length:4},(_,index)=>{
    const length=base+(index<extras?1:0);
    const begin=new Date(start.getTime()+offset*DAY);
    const finish=new Date(start.getTime()+(offset+length-1)*DAY);
    const obj={index,start:isoDay(begin),end:isoDay(finish),days:length,startOffset:offset,endOffset:offset+length-1};
    offset+=length;
    return obj;
  });
  return {start:isoDay(start),end:isoDay(end),days,weeks};
}
export function inFinancialMonth(dateStr,key) {return financialMonthOfDate(dateStr)===key;}
export function dayIndex(key,dateStr) {
  const day=parseDate(dateStr);
  if (!day || !inFinancialMonth(dateStr,key)) return -1;
  return Math.round((day-parseDate(financialPeriod(key).start))/DAY);
}
export function weekOfDate(dateStr) {
  const key=financialMonthOfDate(dateStr);
  if(!key) return -1;
  const index=dayIndex(key,dateStr);
  return financialPeriod(key).weeks.findIndex(w=>index>=w.startOffset && index<=w.endOffset);
}
export function rangeLabel(key,index) {
  const w=financialPeriod(key).weeks[index];
  if(!w)return '';
  return `${w.start.slice(8,10)}/${w.start.slice(5,7)}–${w.end.slice(8,10)}/${w.end.slice(5,7)}`;
}
export function periodLabel(key) {
  const p=financialPeriod(key);
  return `${p.start.slice(8,10)}/${p.start.slice(5,7)}/${p.start.slice(0,4)} a ${p.end.slice(8,10)}/${p.end.slice(5,7)}/${p.end.slice(0,4)}`;
}
export function centsFromInput(raw) {
  if (typeof raw === 'number') return Math.round(raw*100);
  let text=String(raw??'').trim().replace(/\s/g,'').replace(/R\$/gi,'');
  if(!text)return NaN;
  if(text.includes(','))text=text.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(text))text=text.replace(/\./g,'');
  if(!/^\d+(\.\d{1,2})?$/.test(text))return NaN;
  return Math.round(Number(text)*100);
}
export function brl(cents) {
  return (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
export function inputAmount(cents) {
  return (Number(cents||0)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
export function nowLocalInput(date=new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function defaultGoals(budget) {
  const base=Math.floor(budget/4);
  return [base,base,base,budget-base*3];
}
export function newMonth(key,budget,startCash,startCard,goals) {
  return {key,budget,startCash,startCard,goals,snapshots:[],future:[],createdAt:new Date().toISOString()};
}
export function orderedSnapshots(month) {return [...month.snapshots].sort((a,b)=>a.at.localeCompare(b.at));}
// A última posição informada é a fonte de verdade. Um lançamento marcado como
// realizado depois dela atualiza a posição provisoriamente. Na atualização
// seguinte, o saldo/fatura informado substitui esse ajuste (sem duplicação).
export function position(month,asOf=null) {
  const records=orderedSnapshots(month).filter(s=>!asOf||s.at<=asOf);
  const last=records.at(-1);
  const base=last||{cash:month.startCash,card:month.startCard,at:null,initial:true};
  const pos={...base};
  const mark=base.at||`${financialPeriod(month.key).start}T00:00`;
  for(const f of month.future) {
    if(!f.done || !f.doneAt || (asOf && f.doneAt>asOf))continue;
    if(f.snapshotCountAtDone!==undefined && records.length>f.snapshotCountAtDone)continue;
    if(f.doneAt<mark || (f.doneAt===mark && f.snapshotCountAtDone===undefined))continue;
    if((f.kind||'debit')==='credit')pos.cash+=f.amount;
    else if(f.type==='card')pos.card+=f.amount;
    else pos.cash-=f.amount;
  }
  return pos;
}
export function openCash(month,pos) {return pos.cash-pos.card;}
export function spentSinceStart(month,pos) {return (month.startCash-month.startCard)-openCash(month,pos);}
export function pendingFuture(month) {return month.future.filter(item=>!item.done);}
export function pendingByWeek(month,kind='debit') {
  const pending=[0,0,0,0];
  for(const item of pendingFuture(month)) {
    if((item.kind||'debit')!==kind || !inFinancialMonth(item.date,month.key))continue;
    const w=weekOfDate(item.date);
    if(w>=0)pending[w]+=item.amount;
  }
  return pending;
}
function distribute(weights, amount) {
  const sum=weights.reduce((a,b)=>a+b,0);
  const result=weights.map(()=>0);
  if(!sum || amount<=0)return result;
  let allocated=0;
  for(let i=0;i<weights.length;i++) {
    result[i]=i===weights.length-1 ? amount-allocated : Math.min(amount-allocated,Math.round(amount*weights[i]/sum));
    allocated+=result[i];
  }
  return result;
}
function reduceProportionally(amounts, deduction) {
  const cut=distribute(amounts,Math.min(deduction,amounts.reduce((a,b)=>a+b,0)));
  return amounts.map((value,i)=>value-cut[i]);
}
// As despesas previstas reduzem o dinheiro LIVRE de todas as semanas ainda
// abertas, proporcionalmente ao espaço disponível. O vencimento só serve para
// calendário e histórico; não posterga a reserva.
// Créditos futuros entram na projeção a partir da semana de recebimento.
export function calculatePlan(month,pos,activeWeek) {
  const active=Math.max(0,Math.min(3,activeWeek));
  const spent=spentSinceStart(month,pos);
  const budgetLeft=month.budget-spent;
  const liquid=openCash(month,pos);
  const rawPool=Math.min(budgetLeft,liquid);
  const commitments=pendingByWeek(month,'debit');
  const income=pendingByWeek(month,'credit');
  const pendingDebit=commitments.reduce((a,b)=>a+b,0);
  const pendingCredit=income.reduce((a,b)=>a+b,0);
  // Valores realizados já afetam a posição. Para que o botão “Realizado” não
  // remova uma reserva previamente distribuída, podemos recompor esse montante
  // apenas como referência de distribuição e abatê-lo no mesmo cálculo.
  // Sem uma posição na semana anterior, porém, não é seguro reconstruir o gasto
  // semanal de uma fatura acumulada: usa-se somente o caixa líquido conhecido.
  const hasWeekBaseline=active===0 || actualWeekSpent(month,active)!==null;
  const completed=hasWeekBaseline ? month.future.filter(f=>f.done&&f.doneAt&&inFinancialMonth(f.doneAt,month.key)&&weekOfDate(f.doneAt)>=active) : [];
  const completedDebit=completed.filter(f=>(f.kind||'debit')==='debit').reduce((s,f)=>s+f.amount,0);
  const completedCredit=completed.filter(f=>f.kind==='credit').reduce((s,f)=>s+f.amount,0);
  const remaining=Math.max(0,rawPool+completedDebit-completedCredit);
  const desired=[...month.goals];
  const base=[null,null,null,null];
  let remainder=remaining;
  // Preserva prioritariamente as metas das semanas seguintes.
  for(let i=3;i>=active;i--){base[i]=Math.min(remainder,desired[i]);remainder-=base[i];}
  base[3]+=remainder;
  let adjusted=reduceProportionally(base.slice(active),pendingDebit+completedDebit);
  // Créditos previstos só liberam valores a partir da semana de recebimento.
  // Créditos já realizados podem ser redistribuídos a partir de sua semana.
  const incomeForAllocation=[...income];
  for(const f of completed.filter(f=>f.kind==='credit')) incomeForAllocation[Math.max(active,weekOfDate(f.doneAt))]+=f.amount;
  for(let w=active;w<4;w++) {
    const amount=incomeForAllocation[w];
    if(!amount)continue;
    const offset=w-active;
    const weights=adjusted.slice(offset).map((v,i)=>Math.max(v,month.goals[w+i]));
    const allocations=distribute(weights,amount);
    allocations.forEach((n,i)=>adjusted[offset+i]+=n);
  }
  const available=[null,null,null,null];
  adjusted.forEach((value,i)=>available[active+i]=value);
  // Além da suficiência ao final do mês, o caixa deve conseguir pagar cada
  // compromisso na data, sem antecipar um crédito que só chegará depois.
  let cashFlow=rawPool;
  let uncoveredFuture=Math.max(0,-cashFlow);
  const events=new Map();
  for(const item of pendingFuture(month)) {
    if(!inFinancialMonth(item.date,month.key))continue;
    const value=(item.kind||'debit')==='credit' ? item.amount : -item.amount;
    events.set(item.date,(events.get(item.date)||0)+value);
  }
  for(const day of [...events.keys()].sort()) {
    cashFlow+=events.get(day);
    uncoveredFuture=Math.max(uncoveredFuture,-cashFlow);
  }
  const projectedPool=rawPool-pendingDebit+pendingCredit;
  // Pode haver déficit temporário enquanto uma entrada ainda não ocorreu. Não
  // é permitido mostrar mais dinheiro distribuído que o saldo líquido final.
  const assigned=available.slice(active).reduce((a,b)=>a+b,0);
  const ceiling=Math.max(0,projectedPool);
  if(assigned>ceiling){
    const corrected=reduceProportionally(available.slice(active),assigned-ceiling);
    corrected.forEach((v,i)=>available[active+i]=v);
  }
  return {available,desired,commitments,income,uncoveredFuture,spent,budgetLeft,liquid,rawPool,
    projectedPool,insufficient:Math.max(0,-rawPool),
    futureCard:pendingFuture(month).filter(e=>(e.kind||'debit')==='debit'&&e.type==='card').reduce((s,e)=>s+e.amount,0),
    futurePix:pendingFuture(month).filter(e=>(e.kind||'debit')==='debit'&&e.type==='pix').reduce((s,e)=>s+e.amount,0),
    futureCredit:pendingCredit,totalDebit:pendingDebit};
}
// 'available' já é líquido das despesas previstas — nada é subtraído duas vezes.
export function freeForNewSpending(plan,index) {return plan.available[index];}
export function effectiveWeek(key,pos,today=new Date()) {
  const current=monthKey(today);
  if(key>current)return 0;
  if(key<current)return 3;
  return weekOfDate(nowLocalInput(today));
}
export function pastWeekPosition(month,selectedWeek) {
  const week=financialPeriod(month.key).weeks[selectedWeek];
  if(!week)return null;
  const end=`${week.end}T23:59`;
  const hasEvents=orderedSnapshots(month).some(s=>s.at<=end&&weekOfDate(s.at)===selectedWeek)
    ||month.future.some(f=>f.doneAt&&f.doneAt<=end&&weekOfDate(f.doneAt)===selectedWeek);
  return hasEvents ? position(month,end):null;
}
export function actualWeekSpent(month,index) {
  const week=financialPeriod(month.key).weeks[index];
  if(!week)return null;
  const end=`${week.end}T23:59`, start=`${week.start}T00:00`;
  const snaps=orderedSnapshots(month);
  const events=snaps.some(s=>s.at>=start&&s.at<=end)
    ||month.future.some(f=>f.doneAt&&f.doneAt>=start&&f.doneAt<=end);
  if(!events)return null;
  // Uma posição feita durante esta semana não revela quando ocorreram as
  // compras anteriores acumuladas na fatura. Sem posição na semana anterior,
  // o gasto real desta semana NÃO pode ser atribuído com confiança.
  const previousWeek=index>0 ? financialPeriod(month.key).weeks[index-1] : null;
  const hasPriorBaseline=index===0 || snaps.some(s=>s.at<start&&s.at.slice(0,10)>=previousWeek.start);
  if(!hasPriorBaseline)return null;
  const previous=new Date(Date.parse(start+'Z')-60000).toISOString().slice(0,16);
  return openCash(month,position(month,previous))-openCash(month,position(month,end));
}
function validNumbers(month){return [month.budget,month.startCash,month.startCard].every(n=>Number.isSafeInteger(n)&&n>=0)
 &&Array.isArray(month.goals)&&month.goals.length===4&&month.goals.every(n=>Number.isSafeInteger(n)&&n>=0)
 &&month.goals.reduce((s,n)=>s+n,0)===month.budget;}
function validEntries(month,acceptDate){
  if(!Array.isArray(month.snapshots)||!Array.isArray(month.future))return false;
  if(!month.snapshots.every(s=>s&&typeof s.id==='string'&&typeof s.at==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s.at)
    &&validLocalTime(s.at)&&acceptDate(s.at)&&[s.cash,s.card].every(n=>Number.isSafeInteger(n)&&n>=0)))return false;
  return month.future.every(f=>f&&typeof f.id==='string'&&typeof f.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(f.date)
    &&acceptDate(f.date)&&/^(card|pix)$/.test(f.type)&&['debit','credit'].includes(f.kind||'debit')
    &&(f.kind!=='credit'||f.type==='pix')&&typeof f.description==='string'&&Number.isSafeInteger(f.amount)&&f.amount>0
    &&typeof f.done==='boolean'&&(f.snapshotCountAtDone===undefined||(Number.isSafeInteger(f.snapshotCountAtDone)&&f.snapshotCountAtDone>=0))&&(!f.doneAt||(typeof f.doneAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(f.doneAt)&&validLocalTime(f.doneAt)&&acceptDate(f.doneAt))));
}
function validLocalTime(at){const hr=Number(at.slice(11,13)),min=Number(at.slice(14,16));return hr<24&&min<60;}
export function validateMonth(value){return Boolean(value&&typeof value==='object'&&parseKey(value.key)&&validNumbers(value)&&validEntries(value,date=>inFinancialMonth(date,value.key)));}
export function validateState(value){return Boolean(value&&value.version===3&&value.months&&typeof value.months==='object'&&!Array.isArray(value.months)
  &&Object.entries(value.months).every(([key,m])=>key===m.key&&validateMonth(m)));}
export function validatePreviousState(value){return Boolean(value&&value.version===2&&value.months&&typeof value.months==='object'&&!Array.isArray(value.months)
  &&Object.entries(value.months).every(([key,m])=>key===m.key&&validateMonth(m)));}
export function migratePreviousState(value){
  if(!validatePreviousState(value))throw new Error('Backup v2 inválido.');
  return {version:3,months:Object.fromEntries(Object.entries(value.months).map(([key,m])=>[key,{...m,future:m.future.map(f=>({...f,kind:f.kind||'debit'}))}]))};
}
export function validateLegacyState(value){return Boolean(value&&value.version===1&&value.months&&typeof value.months==='object'&&!Array.isArray(value.months)
  &&Object.entries(value.months).every(([key,m])=>m&&key===m.key&&parseKey(key)&&validNumbers(m)&&validEntries(m,date=>String(date).slice(0,7)===key)));}
// Cópia não destrutiva do armazenamento antigo. Os saldos iniciais precisam
// ser revisados pelo usuário, pois a base muda do dia 1 para o dia 26.
export function migrateLegacyState(old) {
  if(!validateLegacyState(old))throw new Error('Backup antigo inválido.');
  const output={version:3,months:{}};
  const template=(key,source)=>({...source,key,goals:[...source.goals],snapshots:[],future:[],migratedFromCalendar:true});
  for(const [key,m] of Object.entries(old.months))output.months[key]=template(key,m);
  for(const source of Object.values(old.months)) {
    for(const entry of source.snapshots){
      const key=financialMonthOfDate(entry.at);
      if(!output.months[key])output.months[key]=template(key,source);
      output.months[key].snapshots.push({...entry});
    }
    for(const entry of source.future){
      const key=financialMonthOfDate(entry.date);
      if(!output.months[key])output.months[key]=template(key,source);
      output.months[key].future.push({...entry,kind:'debit'});
    }
  }
  if(!validateState(output))throw new Error('Falha ao converter backup antigo.');
  return output;
}
