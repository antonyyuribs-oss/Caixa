import test from 'node:test';
import assert from 'node:assert/strict';
import {newMonth,calculatePlan,spentSinceStart,defaultGoals,centsFromInput,brl,weekOfDate,validateState,actualWeekSpent,orderedSnapshots} from '../logic.js';
const money=n=>n*100;
const create=()=>newMonth('2026-10',money(12000),money(12000),0,defaultGoals(money(12000)));
test('R$ 12.000 iniciais, fatura de R$ 8.000: semana 3 recebe R$ 1.000; semana 4 mantém R$ 3.000',()=>{
  const m=create(); const p={cash:money(12000),card:money(8000)};
  const result=calculatePlan(m,p,2);
  assert.equal(result.available[2],money(1000));
  assert.equal(result.available[3],money(3000));
  assert.equal(spentSinceStart(m,p),money(8000));
});
test('Pix diminui caixa; fatura aumenta dívida, ambos afetam orçamento sem duplicar pagamentos',()=>{
  const m=create();
  const p1={cash:money(11000),card:money(4000)};
  assert.equal(spentSinceStart(m,p1),money(5000));
  const p2={cash:money(7000),card:0};
  assert.equal(spentSinceStart(m,p2),money(5000));
});
test('saldo não permite prometer mais do que a conta cobre',()=>{
  const m=create();
  const result=calculatePlan(m,{cash:money(3000),card:money(3500)},2);
  assert.equal(result.rawPool,money(-500));
  assert.equal(result.insufficient,money(500));
  assert.equal(result.available[2],0);
});
test('sobra das semanas encerradas vai à última semana',()=>{
  const m=create();
  const p={cash:money(12000),card:money(2000)};
  const result=calculatePlan(m,p,1);
  assert.equal(result.available[1],money(3000));
  assert.equal(result.available[2],money(3000));
  assert.equal(result.available[3],money(4000));
});
test('futuros pertencem à reserva da semana, não são subtraídos duas vezes',()=>{
  const m=create();
  m.future.push({id:'a',date:'2026-10-26',type:'pix',amount:money(2000),description:'Investimento',done:false});
  const r=calculatePlan(m,{cash:money(12000),card:money(8000)},2);
  assert.equal(r.available[2],money(1000));
  assert.equal(r.available[3],money(3000));
  m.future.push({id:'b',date:'2026-10-26',type:'card',amount:money(1500),description:'Extra',done:false});
  const r2=calculatePlan(m,{cash:money(12000),card:money(8000)},2);
  assert.equal(r2.available[2],money(500));
  assert.equal(r2.available[3],money(3500));
});
test('entrada numérica pt-BR e quatro intervalos de semana',()=>{
  assert.equal(centsFromInput('12.000,50'),1200050);
  assert.equal(centsFromInput('12.000'),1200000);
  assert.equal(centsFromInput('0,75'),75);
  assert.ok(Number.isNaN(centsFromInput('abc')));
  assert.equal(brl(123456),'R$ 1.234,56');
  assert.deepEqual([1,7,8,14,15,21,22,31].map(n=>weekOfDate(`2026-10-${String(n).padStart(2,'0')}`)),[0,0,1,1,2,2,3,3]);
});
test('histórico não inventa gasto semanal sem referência da semana anterior',()=>{
  const m=create();
  m.snapshots=[{id:'x',at:'2026-10-11T10:00',cash:money(12000),card:money(5000)}];
  assert.equal(actualWeekSpent(m,1),null);
});
test('backup valida um mês íntegro',()=>{
  const m=create();
  assert.ok(validateState({version:1,months:{'2026-10':m}}));
  assert.equal(validateState({version:1,months:{'2026-10':{...m,goals:[0,0,0,0]}}}),false);
});

test('na semana final toda sobra pode ser destinada a Pix, permitindo caixa zero',()=>{
  const m=create();
  const result=calculatePlan(m,{cash:money(6000),card:money(2000)},3);
  assert.equal(result.available[3],money(4000));
});

test('duas atualizações no mesmo minuto mantêm a ordem de registro',()=>{
 const m=create();
 m.snapshots.push({id:'z',at:'2026-10-12T15:00',cash:money(12000),card:money(2000)});
 m.snapshots.push({id:'a',at:'2026-10-12T15:00',cash:money(12000),card:money(3000)});
 assert.equal(orderedSnapshots(m).at(-1).card,money(3000));
});
