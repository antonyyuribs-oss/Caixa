import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newMonth,calculatePlan,spentSinceStart,defaultGoals,centsFromInput,brl,weekOfDate,
  validateState,validateLegacyState,migrateLegacyState,actualWeekSpent,orderedSnapshots,
  monthKey,shiftMonth,financialMonthOfDate,financialPeriod,rangeLabel,inFinancialMonth,
  dayIndex,periodLabel,pastWeekPosition,effectiveWeek,pendingByWeek
} from '../logic.js';
const money=n=>n*100;
const create=()=>newMonth('2026-10',money(12000),money(12000),0,defaultGoals(money(12000)));
const record=(id,at,cash,card)=>({id,at,cash:money(cash),card:money(card)});

test('outubro de 2026: 26/09–25/10, semanas de 8/8/7/7 dias',()=>{
  const p=financialPeriod('2026-10');
  assert.equal(p.start,'2026-09-26');
  assert.equal(p.end,'2026-10-25');
  assert.equal(p.days,30);
  assert.deepEqual(p.weeks.map(w=>[w.start,w.end,w.days]),[
    ['2026-09-26','2026-10-03',8],['2026-10-04','2026-10-11',8],
    ['2026-10-12','2026-10-18',7],['2026-10-19','2026-10-25',7]
  ]);
  assert.equal(rangeLabel('2026-10',0),'26/09–03/10');
  assert.equal(periodLabel('2026-10'),'26/09/2026 a 25/10/2026');
});
test('os 4 intervalos cobrem sem sobreposição meses de 28, 29, 30 e 31 dias',()=>{
  for(const [key,expected] of [['2027-03',28],['2024-03',29],['2026-10',30],['2026-08',31]]){
    const period=financialPeriod(key);
    assert.equal(period.days,expected);
    assert.equal(period.weeks.reduce((n,w)=>n+w.days,0),expected);
    assert.ok(Math.max(...period.weeks.map(w=>w.days))-Math.min(...period.weeks.map(w=>w.days))<=1);
    const d = new Date(`${period.start}T12:00:00Z`);
    for(let i=0;i<expected;i++){
      const day=d.toISOString().slice(0,10);
      const week=weekOfDate(day);
      assert.ok(week>=0&&week<=3);
      assert.equal(financialMonthOfDate(day),key);
      assert.equal(dayIndex(key,day),i);
      d.setUTCDate(d.getUTCDate()+1);
    }
    assert.equal(d.toISOString().slice(0,10),new Date(Date.parse(period.end+'T12:00:00Z')+86400000).toISOString().slice(0,10));
  }
});
test('virada 25/26 e troca de mês inclusive no ano novo',()=>{
  assert.equal(financialMonthOfDate('2026-09-25'),'2026-09');
  assert.equal(financialMonthOfDate('2026-09-26'),'2026-10');
  assert.equal(financialMonthOfDate('2026-10-25'),'2026-10');
  assert.equal(financialMonthOfDate('2026-10-26'),'2026-11');
  assert.equal(financialMonthOfDate('2026-12-26'),'2027-01');
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2027-01',-1),'2026-12');
  assert.equal(monthKey(new Date(2026,8,25,12)),'2026-09');
  assert.equal(monthKey(new Date(2026,8,26,12)),'2026-10');
  assert.equal(effectiveWeek('2026-10',null,new Date(2026,9,13,12)),2);
  assert.equal(effectiveWeek('2026-10',null,new Date(2026,9,26,12)),3);
  assert.equal(weekOfDate('2026-10-25'),3);
  assert.equal(weekOfDate('2026-10-26'),0);
  assert.equal(inFinancialMonth('2026-09-30','2026-10'),true);
  assert.equal(inFinancialMonth('2026-10-26','2026-10'),false);
  assert.equal(financialMonthOfDate('2026-02-30'),null);
});
test('R$ 12.000 iniciais, fatura R$ 8.000: S3 R$ 1.000, S4 R$ 3.000',()=>{
  const m=create(),p={cash:money(12000),card:money(8000)};
  const result=calculatePlan(m,p,2);
  assert.equal(result.available[2],money(1000));
  assert.equal(result.available[3],money(3000));
  assert.equal(spentSinceStart(m,p),money(8000));
});
test('Pix diminui caixa; fatura aumenta dívida, sem contar duas vezes pagamento',()=>{
  const m=create();
  assert.equal(spentSinceStart(m,{cash:money(11000),card:money(4000)}),money(5000));
  assert.equal(spentSinceStart(m,{cash:money(7000),card:0}),money(5000));
});
test('saldo insuficiente não permite prometer gasto adicional',()=>{
  const r=calculatePlan(create(),{cash:money(3000),card:money(3500)},2);
  assert.equal(r.rawPool,money(-500));
  assert.equal(r.insufficient,money(500));
  assert.equal(r.available[2],0);
});
test('sobra das semanas encerradas vai à última semana',()=>{
  const r=calculatePlan(create(),{cash:money(12000),card:money(2000)},1);
  assert.equal(r.available[1],money(3000));
  assert.equal(r.available[2],money(3000));
  assert.equal(r.available[3],money(4000));
});
test('futuros: 26/09 e 25/10 pertencem a outubro; 26/10 pertence a novembro',()=>{
  const m=create();
  m.future.push({id:'a',date:'2026-09-26',type:'pix',amount:money(500),description:'A',done:false});
  m.future.push({id:'b',date:'2026-10-25',type:'pix',amount:money(2000),description:'B',done:false});
  m.future.push({id:'c',date:'2026-10-26',type:'card',amount:money(9000),description:'Fora',done:false});
  assert.deepEqual(pendingByWeek(m),[money(500),0,0,money(2000)]);
  const r=calculatePlan(m,{cash:money(12000),card:money(8000)},2);
  assert.equal(r.available[2],money(1000));
  assert.equal(r.available[3],money(3000));
  m.future.push({id:'d',date:'2026-10-25',type:'card',amount:money(1500),description:'Extra',done:false});
  const r2=calculatePlan(m,{cash:money(12000),card:money(8000)},2);
  assert.equal(r2.available[2],money(500));
  assert.equal(r2.available[3],money(3500));
});
test('entrada numérica pt-BR',()=>{
  assert.equal(centsFromInput('12.000,50'),1200050);
  assert.equal(centsFromInput('12.000'),1200000);
  assert.equal(centsFromInput('0,75'),75);
  assert.ok(Number.isNaN(centsFromInput('abc')));
  assert.equal(brl(123456),'R$ 1.234,56');
});
test('histórico atribui setembro e outubro à mesma semana, mas não inventa baseline',()=>{
  const m=create();
  m.snapshots=[record('x','2026-09-30T10:00',12000,1000),record('y','2026-10-03T15:00',12000,2000),record('z','2026-10-04T11:00',12000,2500)];
  assert.equal(actualWeekSpent(m,0),money(2000));
  assert.equal(actualWeekSpent(m,1),money(500));
  assert.equal(pastWeekPosition(m,0).id,'y');
  assert.equal(pastWeekPosition(m,1).id,'z');
  const n=create();n.snapshots=[record('y','2026-10-04T10:00',12000,5000)];
  assert.equal(actualWeekSpent(n,1),null);
});
test('validação de backup v2 e entrada de datas financeiras',()=>{
  const m=create();m.snapshots=[record('x','2026-09-26T18:00',12000,0)];
  assert.ok(validateState({version:2,months:{'2026-10':m}}));
  assert.equal(validateState({version:2,months:{'2026-10':{...m,goals:[0,0,0,0]}}}),false);
  assert.equal(validateState({version:2,months:{'2026-10':{...m,snapshots:[record('y','2026-10-26T18:00',12000,0)]}}}),false);
});
test('migração dos dados antigos por data, sem perder snapshots e futuros',()=>{
  const sep=newMonth('2026-09',money(12000),money(12000),0,defaultGoals(money(12000)));
  const oct=create();
  sep.snapshots=[record('set','2026-09-26T11:00',12000,300)];
  sep.future=[{id:'f1',date:'2026-09-30',type:'pix',description:'Luz',amount:money(200),done:false}];
  oct.snapshots=[record('out','2026-10-12T11:00',12000,8000),record('nov','2026-10-26T11:00',11000,8000)];
  const old={version:1,months:{'2026-09':sep,'2026-10':oct}};
  assert.ok(validateLegacyState(old));
  const newer=migrateLegacyState(old);
  assert.ok(validateState(newer));
  assert.deepEqual(newer.months['2026-10'].snapshots.map(s=>s.id),['set','out']);
  assert.deepEqual(newer.months['2026-10'].future.map(s=>s.id),['f1']);
  assert.deepEqual(newer.months['2026-11'].snapshots.map(s=>s.id),['nov']);
  assert.equal(newer.months['2026-10'].migratedFromCalendar,true);
  assert.deepEqual(oct.snapshots.map(s=>s.id),['out','nov']); // backup fonte intocado
});
test('na semana final toda sobra pode virar Pix para caixa zero',()=>{
  const r=calculatePlan(create(),{cash:money(6000),card:money(2000)},3);
  assert.equal(r.available[3],money(4000));
});
test('duas atualizações no mesmo minuto mantêm a ordem de registro',()=>{
  const m=create();
  m.snapshots.push(record('z','2026-10-12T15:00',12000,2000));
  m.snapshots.push(record('a','2026-10-12T15:00',12000,3000));
  assert.equal(orderedSnapshots(m).at(-1).card,money(3000));
});
