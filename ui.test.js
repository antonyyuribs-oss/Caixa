import test from 'node:test';
import assert from 'node:assert/strict';
import {monthKey,financialPeriod,weekOfDate,nowLocalInput,newMonth,defaultGoals} from '../logic.js';

test('V7: navegação estrutural, posição e resumo após atualizar sem duplicar dados', async()=>{
  const key=monthKey(),period=financialPeriod(key);
  const m=newMonth(key,1200000,1200000,0,defaultGoals(1200000));
  const at=`${period.weeks[0].start}T10:00`;
  m.snapshots=[{id:'old',at,cash:1200000,card:30000}];
  m.future=[{id:'future',date:period.weeks[3].end,description:'Financiamento',kind:'debit',type:'pix',amount:20000,done:false}];
  const stored=new Map([['caixa-semanal-v3',JSON.stringify({version:3,months:{[key]:m}})]]);
  globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
  Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
  globalThis.window={scrollTo(){},addEventListener(){}};
  const events=new Map();
  const nodes=new Map();
  const node=(selector)=>{
    if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},querySelector(){return null;}});
    return nodes.get(selector);
  };
  globalThis.document={documentElement:{dataset:{}},querySelector:node,querySelectorAll:()=>[],addEventListener:(t,fn)=>events.set(t,fn)};
  await import('../app.js?ui-smoke');
  const main=node('#main'),modal=node('#modal-root');
  assert.match(main.innerHTML,/CONTROLE SEMANAL/);
  assert.match(main.innerHTML,/hero-value/);
  assert.doesNotMatch(main.innerHTML,/Saldo atual da conta/);
  const clickAction=(action,properties={})=>{
    const target={dataset:{action,...properties},closest(sel){return sel==='[data-action]'?target:null;},matches(){return false;}};
    events.get('click')({target});
  };
  const clickTab=(tab)=>{
    const target={dataset:{tab},closest(sel){return sel==='[data-tab]'?target:null;},matches(){return false;}};
    events.get('click')({target});
  };
  clickTab('history');
  assert.match(main.innerHTML,/Margem/);
  assert.match(main.innerHTML,/Conta × fatura/);
  assert.match(main.innerHTML,/Posição financeira/);
  clickAction('open-update');
  assert.match(modal.innerHTML,/Atualizar posição/);
  const current=nowLocalInput();
  const form={dataset:{form:'update'},elements:{at:{value:current},cash:{value:'12.000,00'},card:{value:'400,00'},note:{value:'Testando V7'}}};
  events.get('submit')({target:{closest(sel){return sel==='form[data-form]'?form:null;}},preventDefault(){}});
  assert.match(modal.innerHTML,/Resultado da atualização/);
  assert.match(modal.innerHTML,/Sem contar créditos/);
  const updated=JSON.parse(stored.get('caixa-semanal-v3'));
  assert.equal(updated.months[key].snapshots.length,2);
  assert.equal(updated.months[key].snapshots.at(-1).metrics.week,weekOfDate(current));
  clickTab('goals');
  assert.match(main.innerHTML,/Metas por semana/);
  assert.match(main.innerHTML,/Realizado · provisório|Previsto/);
  assert.match(main.innerHTML,/Aparência/);
});
