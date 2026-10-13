import {
  STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY, monthKey, shiftMonth, monthLabel, financialPeriod, periodLabel, dayIndex, inFinancialMonth, weekOfDate, rangeLabel,
  centsFromInput, brl, inputAmount, nowLocalInput, defaultGoals, newMonth,
  orderedSnapshots, position, openCash, spentSinceStart, pendingFuture, calculatePlan, freeForNewSpending,
  effectiveWeek, pastWeekPosition, actualWeekSpent, validateState, validatePreviousState, migratePreviousState, validateLegacyState, migrateLegacyState
} from './logic.js';

const main = document.querySelector('#main');
const modalRoot = document.querySelector('#modal-root');
const toastEl = document.querySelector('#toast');
const today = () => new Date();
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const labelDay = (at) => at ? `${at.slice(8,10)}/${at.slice(5,7)} às ${at.slice(11,16)}` : 'Posição inicial';
const fmt = (number) => brl(number);
const signed = (number) => `${number > 0 ? '+' : number < 0 ? '−' : ''}${fmt(Math.abs(number))}`;
const input = (name, label, value, help = '', attrs = '') => `<div class="field"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="text" inputmode="decimal" autocomplete="off" value="${esc(value)}" required ${attrs}>${help ? `<span class="helper">${help}</span>`:''}</div>`;

let state = { version: 3, months: {} };
let migratedAtStart = false;
try {
  const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (validateState(current)) state = current;
  else {
    const previous = JSON.parse(localStorage.getItem(PREVIOUS_STORAGE_KEY) || 'null');
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    if (validatePreviousState(previous) || validateLegacyState(legacy)) {
      state = validatePreviousState(previous) ? migratePreviousState(previous) : migrateLegacyState(legacy);
      migratedAtStart = true;
      // Os registros antigos permanecem no armazenamento anterior, intactos.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }
} catch (error) { console.warn('Não foi possível carregar ou migrar os dados.', error); }
let view = 'dashboard';
let chosenMonth = monthKey();
let chosenWeek = weekOfDate(nowLocalInput());
let historyWeek = -1;
let toastHandle = 0;

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { notify('Não foi possível salvar. Verifique o espaço do navegador.'); return false; }
}
function notify(message) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => toastEl.classList.remove('visible'), 3500);
}
function getMonth() { return state.months[chosenMonth] || null; }
function heading(title, hint = '') { return `<div class="section-head"><h2>${title}</h2>${hint ? `<span class="subheading">${hint}</span>` : ''}</div>`; }
function badge(text, style = '') { return `<span class="pill ${style}">${esc(text)}</span>`; }
function stat(label, value, tone = '') { return `<div class="small-stat"><span>${label}</span><b class="money ${tone}">${value}</b></div>`; }
function btn(action, text, clazz='secondary', extra='') { return `<button type="button" class="${clazz}" data-action="${action}" ${extra}>${text}</button>`; }
function weekTabs(selected, action) {
  return `<div class="week-tabs" role="group" aria-label="Selecionar semana">${[0,1,2,3].map(i =>
    `<button type="button" class="week ${selected === i ? 'active' : ''} ${chosenMonth === monthKey() && weekOfDate(nowLocalInput()) === i ? 'current' : ''}" data-action="${action}" data-week="${i}" aria-pressed="${selected === i}"><strong>S${i+1}</strong><span>${rangeLabel(chosenMonth,i)}</span><i class="dot"></i></button>`).join('')}</div>`;
}
function render() {
  document.querySelector('#month-title').textContent = monthLabel(chosenMonth);
  document.querySelector('#period-strip').textContent = `Mês financeiro: ${periodLabel(chosenMonth)}`;
  document.querySelectorAll('[data-tab]').forEach(node => {
    node.classList.toggle('active', node.dataset.tab === view);
    if (node.dataset.tab === view) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  const month = getMonth();
  main.innerHTML = !month ? renderMissing() : view === 'dashboard' ? renderDashboard(month) : view === 'goals' ? renderGoals(month) : renderHistory(month);
}
function renderMissing() {
  return `<div class="space"></div><div class="eyebrow">COMECE PELO PLANEJAMENTO</div><div class="space"></div><div class="empty"><div class="empty-icon">◎</div><h2>Seu caixa começa aqui</h2><p>Defina o orçamento do mês, o saldo inicial da conta e as metas das quatro semanas. Depois, atualize apenas a posição do cartão e do caixa. Cada mês financeiro começa no dia 26 e termina no dia 25.</p>${btn('open-setup','Criar planejamento mensal','primary')}</div><div class="space"></div><p class="center fine">Sem cadastro e sem conexão bancária. Seus registros ficam neste navegador.</p>`;
}
function activePlan(month) {
  const pos = position(month);
  const active = effectiveWeek(month.key, pos, today());
  return { pos, active, plan: calculatePlan(month, pos, active) };
}
function renderDashboard(month) {
  const { pos, active, plan } = activePlan(month);
  const past = chosenWeek < active;
  const historical = past ? pastWeekPosition(month, chosenWeek) : null;
  const visible = past && historical ? calculatePlan(month, historical, chosenWeek) : plan;
  const available = past && !historical ? null : visible.available[chosenWeek];
  const original = month.goals[chosenWeek];
  // O gasto já realizado na semana não é confundido com redução da meta.
  // A meta ajustada total da semana = gasto atribuído a ela + saldo que ainda pode gastar.
  const spentWeek = past
    ? (historical ? actualWeekSpent(month, chosenWeek) : null)
    : chosenWeek > active ? 0
    : (pos.at && weekOfDate(pos.at) === chosenWeek ? actualWeekSpent(month, chosenWeek) : 0);
  const adjustedGoal = available === null || spentWeek === null ? null : available + spentWeek;
  const difference = adjustedGoal === null ? null : adjustedGoal - original;
  const futureItemsInWeek = past ? 0 : (visible.commitments[chosenWeek]||0);
  const free = available === null ? null : past ? available : freeForNewSpending(visible,chosenWeek);
  const futureTotal = pendingFuture(month).filter(item=>(item.kind||'debit')==='debit').reduce((sum,item)=>sum+item.amount,0);
  const futureCreditTotal = pendingFuture(month).filter(item=>item.kind==='credit').reduce((sum,item)=>sum+item.amount,0);
  const covered = pos.cash >= pos.card;
  const coverageMargin = pos.cash - pos.card;
  const currentData = !orderedSnapshots(month).length;
  const pendingCreditsThisWeek=month.future.some(f=>!f.done&&f.kind==='credit'&&weekOfDate(f.date)===chosenWeek);
  const caption = past ? `Posição registrada na semana ${chosenWeek + 1}` : chosenWeek === active ? (pendingCreditsThisWeek ? 'Livre projetado para esta semana' : 'Livre para novos gastos nesta semana') : `Livre previsto para a semana ${chosenWeek + 1}`;
  const lastText = pos.at ? `Atualizado ${labelDay(pos.at)}` : 'Use “Atualizar posição” para registrar os gastos';
  const gap = visible.rawPool < 0 || visible.uncoveredFuture > 0 ? badge('Caixa insuficiente', 'bad') : difference === null ? badge('Compromissos cobertos', 'good') : difference < 0 ? badge('Meta ajustada', 'warn') : badge('Dentro do planejamento', 'good');
  return `
    <div class="spread"><div class="eyebrow">CONTROLE SEMANAL</div>${badge('Fechamento em zero')}</div>
    ${weekTabs(chosenWeek, 'select-week')}
    <section class="hero" aria-label="Meta da semana">
      <div class="eyebrow">${caption}</div>
      <div class="hero-value money">${free === null ? '—' : fmt(free)}</div>
      <div class="hero-note">${past && !historical ? 'Nenhuma atualização registrada nessa semana' : adjustedGoal === null ? 'Meta recalculada: falta posição da semana anterior' : `Meta recalculada (após previsões): ${fmt(adjustedGoal)}`}</div>
      <div class="hero-foot"><div><span class="foot-label">Original: ${fmt(original)} · Ajuste</span><b class="money ${difference < 0 ? 'warn-text' : difference > 0 ? 'accent' : ''}">${difference === null ? '—' : signed(difference)}</b></div><div><span class="foot-label">Situação</span>${gap}</div></div>
    </section>
    ${(futureTotal>0||futureCreditTotal>0)&&!past ? `<div class="card" style="margin-top:12px"><div class="indicator"><span class="indicator-label">Despesas previstas no mês</span><b class="indicator-value money">− ${fmt(futureTotal)}</b></div><div class="indicator"><span class="indicator-label">Créditos previstos no mês</span><b class="indicator-value money accent">+ ${fmt(futureCreditTotal)}</b></div><p class="fine">As saídas previstas são distribuídas desde já pelas semanas restantes. Créditos previstos entram na projeção a partir da semana de recebimento.</p></div>` : ''}
    ${month.migratedFromCalendar ? `<div class="notice">Dados da versão antiga preservados. Confira em Metas → Editar se o saldo e a fatura iniciais correspondem a <b>${financialPeriod(month.key).start.slice(8,10)}/${financialPeriod(month.key).start.slice(5,7)}</b>, início deste mês financeiro. As posições foram redistribuídas conforme a data.</div>` : ''}
    ${currentData ? '<div class="notice">Posição inicial registrada no planejamento. Para refletir os gastos do mês, atualize o saldo da conta e a fatura do cartão.</div>' : ''}
    ${past && !historical ? '<div class="notice">Não há atualização nessa semana. O aplicativo não inventa valores históricos.</div>' : ''}
    ${available !== null && spentWeek === null ? '<div class="notice">Sem posição bancária registrada na semana anterior, não é possível identificar quanto da fatura foi gasto especificamente nesta semana. O valor livre é calculado pela posição atual, mas a meta recalculada total e seu ajuste ficam sem comparação.</div>' : ''}
    ${futureTotal > 0 ? `<div class="notice">Despesas futuras pendentes no mês: <b>${fmt(futureTotal)}</b>. O valor principal já foi reduzido pela reserva distribuída entre as semanas restantes.</div>` : ''}
    ${visible.income.slice(active).some(x=>x>0) && !past ? '<div class="notice">O limite semanal considera créditos ainda previstos. Antes de gastar, confira se a entrada já ocorreu e se o saldo real está disponível.</div>' : ''}
    ${visible.uncoveredFuture > 0 ? `<div class="notice danger">Há ${fmt(visible.uncoveredFuture)} em compromissos futuros sem cobertura no planejamento restante. Reveja os valores ou as metas.</div>` : ''}
    ${heading('Posição financeira','Valores atuais')}
    <div class="card">
      <div class="indicator"><span class="indicator-label">Dinheiro na conta</span><span class="indicator-value money">${fmt(pos.cash)}</span></div>
      <div class="indicator"><span class="indicator-label">Fatura em aberto</span><span class="indicator-value money">${fmt(pos.card)}</span></div>
      <div class="indicator"><div><span class="indicator-label">Caixa depois da fatura</span><span class="tiny">Dinheiro reservado para pagar o cartão</span></div><span class="indicator-value money ${coverageMargin < 0 ? 'bad-text' : 'accent'}">${fmt(coverageMargin)}</span></div>
      <div class="rule"></div>
      <div class="spread"><div><span class="small">Cobertura da fatura</span><p class="fine">${covered ? 'Saldo suficiente para pagar o cartão atual' : 'O saldo atual não cobre a fatura'}</p></div>${badge(covered ? 'Coberta' : 'Insuficiente', covered ? 'good' : 'bad')}</div>
    </div>
    <div class="action">${btn('open-update','＋  Atualizar posição','primary wide')}<div class="buttons" style="margin-top:10px">${btn('open-credit','＋ Registrar crédito recebido','secondary wide')}</div></div>
    <p class="fine center" style="margin-top:9px">${lastText}</p>
    ${heading('Distribuição recalculada','Resta no mês')}
    <div class="goal-grid">${[0,1,2,3].map(i => {
      const isPast = i < active;
      const pastPos = isPast ? pastWeekPosition(month, i) : null;
      const value = isPast && pastPos ? calculatePlan(month, pastPos, i).available[i] : isPast ? null : freeForNewSpending(plan,i);
      const reserved = isPast ? 0 : plan.commitments[i];
      return `<button type="button" data-action="select-week" data-week="${i}" class="goal-tile ${chosenWeek===i?'selected':''}" style="color:var(--txt);text-align:left;cursor:pointer"><div class="eyebrow">Semana ${i+1} · Livre</div><div class="amount money">${value===null?'—':fmt(value)}</div><div class="compare">Original: ${fmt(month.goals[i])}${reserved>0?` · Pix/cartão previsto na semana: ${fmt(reserved)}`:''}</div></button>`;
    }).join('')}</div>
    <div class="space"></div><p class="hint">As metas originais permanecem fixas. Despesas futuras são abatidas de imediato e distribuídas entre as semanas abertas. Créditos futuros só entram na projeção a partir do recebimento previsto.</p>
    ${plan.insufficient ? `<div class="notice danger">Faltam ${fmt(plan.insufficient)} para cobrir a posição atual do cartão e cumprir o caixa.</div>` : ''}
  `;
}
function renderGoals(month) {
  const { pos, active, plan } = activePlan(month);
  const commitments = pendingFuture(month);
  return `
    <div class="spread"><div><div class="eyebrow">PLANEJAMENTO DO MÊS</div><h1 style="margin-top:8px">Metas</h1></div>${btn('open-setup','Editar','secondary compact')}</div>
    <div class="space"></div>
    <div class="card soft"><span class="small">Orçamento total</span><div class="money" style="font-size:32px;font-weight:750;margin-top:7px;letter-spacing:-.05em">${fmt(month.budget)}</div><p class="fine" style="margin-top:10px">Meta inicial fixa. Recalcular não altera o planejamento original.</p></div>
    ${heading('Metas por semana','Original × ajustada')}
    <div class="goal-grid">${month.goals.map((value, i) => {
      const historical = i < active ? pastWeekPosition(month, i) : null;
      const adjusted = i < active ? historical ? calculatePlan(month, historical, i).available[i] : null : plan.available[i];
      const free = i < active ? null : freeForNewSpending(plan,i);
      const reserved = i < active ? 0 : plan.commitments[i];
      return `<div class="goal-tile ${i===active?'selected':''}"><span class="eyebrow">Semana ${i+1} · ${rangeLabel(month.key,i)}</span><div class="amount money">${fmt(value)}</div><div class="compare">${adjusted === null ? 'Sem registro' : `Recalculada: ${fmt(adjusted)}`}${reserved>0?`<br>Futuros: ${fmt(reserved)}<br><strong>Livre: ${fmt(free)}</strong>`:''}</div></div>`;
    }).join('')}</div>
    ${heading('Lançamentos',`${month.future.length} registro(s) · ${commitments.length} previsto(s)`)}
    <div class="card">
      <div class="spread"><p class="hint" style="max-width:270px">Pix, cartão e créditos. Marque cada lançamento como realizado quando acontecer.</p>${btn('open-future','＋ Adicionar','secondary compact')}</div>
      ${month.future.length ? `<div style="margin-top:8px">${[...month.future].sort((a,b)=>a.date.localeCompare(b.date)).map(item=>`
        <div class="future-row ${item.done?'done':''}"><div class="icon">${item.kind==='credit'?'＋':item.type==='card'?'C':'P'}</div><div class="detail"><div class="spread"><h3>${esc(item.description)}</h3><b class="money ${item.kind==='credit'?'accent':''}" style="white-space:nowrap;font-size:13px">${item.kind==='credit'?'+ ':'− '}${fmt(item.amount)}</b></div><p class="small" style="margin-top:4px">${item.date.slice(8,10)}/${item.date.slice(5,7)} · ${item.kind==='credit'?'Crédito':item.type==='card'?'Cartão':'Pix'} · ${item.done?'Realizado'+(item.doneAt?' em '+item.doneAt.slice(8,10)+'/'+item.doneAt.slice(5,7):''):'Previsto'}</p><div class="future-actions"><button class="icon-button" data-action="toggle-future" data-id="${esc(item.id)}">${item.done?'Voltar a previsto':'Marcar realizado'}</button><button class="icon-button" data-action="delete-future" data-id="${esc(item.id)}">Excluir</button></div></div></div>`).join('')}</div>` : '<p class="hint" style="margin-top:16px">Nenhum lançamento futuro. Você pode adicioná-los quando precisar.</p>'}
    </div>
    <div class="notice">As saídas previstas são reservadas imediatamente e distribuídas entre as semanas restantes. <b>Marcar realizado</b> atualiza o caixa ou a fatura provisoriamente. Quando você atualizar a posição bancária depois, o saldo informado substitui o ajuste automático, evitando duplicidade.</div>
    ${heading('Base do planejamento')}
    <div class="card"><div class="indicator"><span class="indicator-label">Saldo inicial da conta</span><b class="indicator-value money">${fmt(month.startCash)}</b></div><div class="indicator"><span class="indicator-label">Fatura inicial</span><b class="indicator-value money">${fmt(month.startCard)}</b></div><div class="indicator"><span class="indicator-label">Gasto desde o início</span><b class="indicator-value money">${fmt(plan.spent)}</b></div></div>
  `;
}
function curvePath(points) { return points.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '); }
function renderGraph(month) {
  const snaps = orderedSnapshots(month);
  const dates = [...new Set([...snaps.map(s=>s.at),...month.future.filter(f=>f.done&&f.doneAt).map(f=>f.doneAt)])].sort();
  const period = financialPeriod(month.key);
  const W=400,H=204,left=40,right=10,top=15,bottom=31;
  const baseY=H-bottom;
  const maxIndex=Math.max(1,period.days-1);
  const toX = d=>left+(d/maxIndex)*(W-left-right);
  const maxV = Math.max(month.budget,...dates.map(at=>spentSinceStart(month,position(month,at))),1);
  const toY = v=>baseY-Math.max(0,v)/maxV*(baseY-top);
  const planned = [[0,0],...period.weeks.map((w,i)=>[w.endOffset,month.goals.slice(0,i+1).reduce((a,b)=>a+b,0)])].map(([d,v])=>[toX(d),toY(v)]);
  const real = dates.map(at=>[toX(dayIndex(month.key,at)),toY(spentSinceStart(month,position(month,at)))]);
  const ticks=[{at:0,label:period.start.slice(8,10)+'/'+period.start.slice(5,7)},...period.weeks.map(w=>({at:w.endOffset,label:w.end.slice(8,10)+'/'+w.end.slice(5,7)}))];
  return `<div class="graph"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de gastos acumulados ao longo do mês financeiro, planejado e registrado">
    ${[0,.5,1].map(n=>`<line class="gridline" x1="${left}" y1="${toY(maxV*n)}" x2="${W-right}" y2="${toY(maxV*n)}"/><text x="${left-5}" y="${toY(maxV*n)+4}" text-anchor="end">${(maxV*n/100/1000).toFixed(0)}k</text>`).join('')}
    ${ticks.map(t=>`<text x="${toX(t.at)}" y="${H-9}" text-anchor="${t.at===0?'start':t.at===maxIndex?'end':'middle'}">${t.label}</text>`).join('')}
    <path class="budgetline" d="${curvePath(planned)}"/>
    ${real.length > 1 ? `<path class="series" d="${curvePath(real)}"/>` : ''}
    ${real.map(point=>`<circle cx="${point[0]}" cy="${point[1]}" r="3.7" fill="#70d1af" stroke="#15231e" stroke-width="2"/>`).join('')}
  </svg><div class="chart-legend"><span><i class="swatch gold"></i>Planejado</span><span><i class="swatch"></i>Registrado</span></div></div>`;
}
function renderHistory(month) {
  const records = orderedSnapshots(month).reverse();
  const filtered = historyWeek === -1 ? records : records.filter(s => weekOfDate(s.at) === historyWeek);
  const { pos, plan } = activePlan(month);
  return `
    <div class="eyebrow">REGISTROS SALVOS</div><h1 style="margin-top:8px">Histórico</h1>
    <div class="space"></div>
    <div class="two-stats">${stat('Gasto líquido no mês',fmt(plan.spent))}${stat('Caixa após a fatura',fmt(openCash(month,pos)),openCash(month,pos)<0?'bad-text':'accent')}</div>
    ${heading('Evolução dos gastos','Atualizações e lançamentos realizados')}
    ${renderGraph(month)}
    ${heading('Posições registradas',`${records.length} atualização(ões)`)}
    <div class="week-tabs" role="group" aria-label="Filtrar histórico por semana" style="grid-template-columns:repeat(5,minmax(0,1fr));margin-top:0;margin-bottom:12px">
      ${[-1,0,1,2,3].map(i=>`<button type="button" data-action="select-history-week" data-week="${i}" class="week ${historyWeek===i?'active':''}" style="padding:12px 0"><strong>${i===-1?'Todas':`S${i+1}`}</strong></button>`).join('')}
    </div>
    ${filtered.length ? `<div class="history-list">${filtered.map(s => {
      const spent = spentSinceStart(month,s);
      const selected = weekOfDate(s.at);
      const r = calculatePlan(month,position(month,s.at),selected);
      return `<div class="history-item"><div class="spread"><div><b>Semana ${selected+1}</b><p class="meta">${labelDay(s.at)}${s.note?' · '+esc(s.note):''}</p></div>${btn('delete-snapshot','Excluir','ghost compact',`data-id="${esc(s.id)}"`)}</div>
      <div class="row-data"><span class="muted">Saldo / cartão</span><b>${fmt(s.cash)} / ${fmt(s.card)}</b></div>
      <div class="row-data"><span class="muted">Gasto acumulado</span><b>${fmt(spent)}</b></div>
      <div class="row-data"><span class="muted">Livre na semana</span><b class="accent">${fmt(r.available[selected] ?? 0)}</b></div></div>`;
    }).join('')}</div>` : '<div class="empty"><h2>Nenhuma atualização</h2><p>Registre uma posição para visualizar a evolução nesta semana.</p></div>'}
    ${heading('Segurança dos dados')}
    <div class="card"><p class="hint">Os dados ficam neste navegador e não são sincronizados com o GitHub. Exporte um arquivo para guardar ou migrar para outro aparelho.</p><div class="buttons" style="margin-top:16px">${btn('export','Exportar JSON','secondary')}<label class="secondary file-label">Importar JSON<input id="import-file" type="file" accept="application/json,.json"></label></div><button data-action="reset-month" class="subtle-link" style="color:var(--danger);margin-top:12px">Apagar este mês</button></div>
  `;
}
function modal(content, headingText) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-backdrop="true"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(headingText)}"><div class="modal-head"><h2>${esc(headingText)}</h2><button type="button" class="x-btn" data-action="close-modal" aria-label="Fechar">×</button></div><div class="modal-body">${content}</div></section></div>`;
  modalRoot.querySelector('input:not([type="hidden"])')?.focus({preventScroll:true});
}
function closeModal() { modalRoot.innerHTML = ''; }
function setupModal() {
  const current = getMonth();
  const budget = current?.budget ?? 1200000;
  const goals = current?.goals || defaultGoals(budget);
  modal(`<form data-form="setup" class="form-grid" novalidate>
    <p class="hint">Período: <b>${periodLabel(chosenMonth)}</b>. Informe o saldo e a fatura do dia 26, início deste mês financeiro, além das metas originais.</p>
    ${input('budget','Orçamento mensal (R$)',inputAmount(budget))}
    <div class="fieldrow">${input('startCash','Saldo inicial da conta',inputAmount(current?.startCash ?? budget))}${input('startCard','Fatura inicial',inputAmount(current?.startCard ?? 0))}</div>
    <div class="spread"><h3>Metas originais</h3>${btn('split-goals','Dividir igualmente','ghost compact')}</div>
    <div class="goal-grid">${goals.map((g,i)=>input(`goal${i}`,`Semana ${i+1} · ${rangeLabel(chosenMonth,i)}`,inputAmount(g))).join('')}</div>
    <p class="fine">A soma das quatro metas deve ser igual ao orçamento mensal. O saldo inicial é uma referência para acompanhar as alterações do caixa e da fatura.</p>
    ${current?.snapshots.length ? '<div class="notice">Atenção: mudar o saldo ou a fatura inicial também altera os cálculos históricos.</div>' : ''}
    <div class="modal-bottom"><button class="primary wide" type="submit">${current?'Salvar planejamento':'Criar planejamento'}</button></div>
  </form>`, current ? 'Editar planejamento' : 'Planejamento inicial');
}
function updateModal() {
  const m=getMonth(); if(!m){setupModal();return;}
  const pos=position(m);
  const period=financialPeriod(chosenMonth);
  const dateNow=monthKey()===chosenMonth?nowLocalInput():`${period.end}T18:00`;
  modal(`<form data-form="update" class="form-grid" novalidate>
    <p class="hint">Preencha os saldos atuais, não a diferença desde a atualização anterior.</p>
    <div class="field"><label for="field-at">Data e hora da posição</label><input id="field-at" name="at" type="datetime-local" min="${period.start}T00:00" max="${period.end}T23:59" value="${dateNow}" required><span class="helper">Período: ${periodLabel(chosenMonth)}</span></div>
    ${input('cash','Saldo atual da conta (R$)',inputAmount(pos.cash),'Pix já realizados estão refletidos aqui.')}
    ${input('card','Total da fatura em aberto (R$)',inputAmount(pos.card),'A fatura deve incluir os gastos no cartão ainda não pagos.')}
    <div class="field"><label for="field-note">Observação (opcional)</label><input id="field-note" name="note" type="text" maxlength="100" placeholder="Ex.: fechamento da semana"></div>
    <div class="notice">Quando você pagar a fatura, o saldo da conta e a fatura em aberto diminuem. Isso não cria uma nova despesa.</div>
    <div class="modal-bottom"><button type="submit" class="primary wide">Registrar atualização</button></div>
  </form>`,'Atualizar posição');
}
function futureModal() {
  const period=financialPeriod(chosenMonth);
  const d = monthKey()===chosenMonth?nowLocalInput().slice(0,10):period.start;
  modal(`<form data-form="future" class="form-grid" novalidate>
    <p class="hint">Registre despesas ou créditos previstos. Toda despesa futura reduz desde já o valor livre de todas as semanas restantes.</p>
    <div class="field"><label for="future-desc">Descrição</label><input id="future-desc" name="description" maxlength="90" placeholder="Ex.: energia, salário extra, transferência" required></div>
    <div class="fieldrow"><div class="field"><label for="future-date">Data prevista</label><input id="future-date" type="date" name="date" min="${period.start}" max="${period.end}" value="${d}" required></div><div class="field"><label for="future-type">Lançamento</label><select id="future-type" name="type"><option value="pix">Saída · Pix</option><option value="card">Saída · Cartão</option><option value="credit">Entrada · Crédito</option></select></div></div>
    ${input('amount','Valor (R$)','0,00')}
    <p class="fine">Use “Marcar realizado” quando acontecer. O aplicativo atualizará o cálculo automaticamente. Depois você poderá conferir o saldo real em “Atualizar posição”.</p>
    <div class="modal-bottom"><button type="submit" class="primary wide">Adicionar lançamento previsto</button></div>
  </form>`,'Novo lançamento');
}
function creditModal() {
  const period=financialPeriod(chosenMonth);
  const d=monthKey()===chosenMonth?nowLocalInput():`${period.end}T12:00`;
  modal(`<form data-form="credit" class="form-grid" novalidate>
    <p class="hint">Um crédito já recebido aumenta o caixa imediatamente nos cálculos. Na próxima atualização do saldo bancário, o valor será reconciliado automaticamente.</p>
    <div class="field"><label for="credit-desc">Descrição</label><input id="credit-desc" name="description" maxlength="90" placeholder="Ex.: reembolso, receita extra" required></div>
    <div class="field"><label for="credit-at">Recebido em</label><input id="credit-at" name="at" type="datetime-local" min="${period.start}T00:00" max="${period.end}T23:59" value="${d}" required></div>
    ${input('amount','Valor recebido (R$)','0,00')}
    <div class="modal-bottom"><button type="submit" class="primary wide">Registrar crédito realizado</button></div>
  </form>`,'Crédito recebido');
}
function monthModal() {
  modal(`<div class="stack" style="gap:19px"><p class="hint">Cada mês financeiro vai do dia 26 do mês anterior ao dia 25 do mês indicado. O planejamento e o histórico são independentes.</p><div class="month-arrows"><button data-action="prev-month" aria-label="Mês anterior">‹</button><b>${monthLabel(chosenMonth)}</b><button data-action="next-month" aria-label="Mês seguinte">›</button></div><div class="field"><label for="select-month">Ir para o mês</label><input type="month" id="select-month" value="${chosenMonth}"></div>${btn('go-month','Abrir mês','primary wide')}</div>`,'Selecionar mês');
}
function changeMonth(delta) {
  chosenMonth = shiftMonth(chosenMonth, delta);
  chosenWeek = chosenMonth === monthKey() ? weekOfDate(nowLocalInput()) : 0;
  historyWeek = -1;
  closeModal(); render();
}
function parseNonnegative(form, name, allowZero=true) {
  const value=centsFromInput(form.elements[name]?.value);
  if(!Number.isSafeInteger(value) || value<0 || (!allowZero && value===0)) throw new Error(`Informe um valor válido em “${name}”.`);
  return value;
}
function submitSetup(form) {
  const budget=parseNonnegative(form,'budget',false);
  const startCash=parseNonnegative(form,'startCash');
  const startCard=parseNonnegative(form,'startCard');
  const goals=[0,1,2,3].map(i=>parseNonnegative(form,`goal${i}`));
  if(goals.reduce((s,n)=>s+n,0)!==budget) throw new Error(`As quatro metas devem somar ${fmt(budget)}.`);
  const previous=getMonth();
  if(previous){Object.assign(previous,{budget,startCash,startCard,goals,migratedFromCalendar:false});}
  else state.months[chosenMonth]=newMonth(chosenMonth,budget,startCash,startCard,goals);
  save();closeModal();render();notify('Planejamento salvo.');
}
function submitUpdate(form) {
  const m=getMonth();if(!m)return;
  const at=form.elements.at.value;
  if(!at || !inFinancialMonth(at,chosenMonth) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at) || !Number.isFinite(Date.parse(at))) throw new Error('Selecione uma data válida dentro do mês financeiro aberto (26 a 25).');
  const cash=parseNonnegative(form,'cash');const card=parseNonnegative(form,'card');
  const note=(form.elements.note.value||'').trim().slice(0,100);
  m.snapshots.push({id:id(),at,cash,card,note});
  save();closeModal();chosenWeek=weekOfDate(at);render();notify('Posição registrada.');
}
function submitFuture(form) {
  const m=getMonth();if(!m)return;
  const date=form.elements.date.value;
  const description=form.elements.description.value.trim();
  const type=form.elements.type.value;
  const amount=parseNonnegative(form,'amount',false);
  if(!inFinancialMonth(date,chosenMonth)) throw new Error('A data deve pertencer ao mês financeiro selecionado (26 a 25).');
  if(!description || !['pix','card','credit'].includes(type)) throw new Error('Informe a descrição e o tipo.');
  m.future.push({id:id(),date,description,type:type==='credit'?'pix':type,kind:type==='credit'?'credit':'debit',amount,done:false});
  save();closeModal();render();notify('Lançamento adicionado.');
}
function submitCredit(form) {
  const m=getMonth();if(!m)return;
  const at=form.elements.at.value;
  const description=form.elements.description.value.trim();
  const amount=parseNonnegative(form,'amount',false);
  if(!description||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)||!inFinancialMonth(at,chosenMonth))throw new Error('Informe uma data e descrição válidas.');
  m.future.push({id:id(),date:at.slice(0,10),description,kind:'credit',type:'pix',amount,done:true,doneAt:at,snapshotCountAtDone:m.snapshots.length});
  save();closeModal();chosenWeek=weekOfDate(at);render();notify('Crédito realizado registrado.');
}
function exportData() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`caixa-backup-${chosenMonth}.json`;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
  notify('Backup exportado.');
}
async function importData(file) {
  if(!file)return;
  if(file.size>5_000_000) throw new Error('O arquivo é muito grande.');
  let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new Error('Arquivo JSON inválido.');}
  const legacy = validateLegacyState(parsed);
  const previous=validatePreviousState(parsed);
  if(!legacy && !previous && !validateState(parsed)) throw new Error('O arquivo não contém um backup válido deste aplicativo.');
  if(!confirm('Importar substituirá todos os dados deste navegador. Continuar?'))return;
  state = legacy ? migrateLegacyState(parsed) : previous ? migratePreviousState(parsed) : parsed;
  save();
  if(!state.months[chosenMonth])chosenMonth=Object.keys(state.months).sort().at(-1)||monthKey();
  chosenWeek=chosenMonth===monthKey()?weekOfDate(nowLocalInput()):0;
  historyWeek=-1;view='dashboard';closeModal();render();notify(legacy?'Backup antigo importado. Confira os saldos iniciais em Metas.':'Backup importado.');
}

document.addEventListener('click',event=>{
  const tab=event.target.closest('[data-tab]');
  if(tab){view=tab.dataset.tab;render();window.scrollTo({top:0,behavior:'instant'});return;}
  if(event.target.closest('#month-menu')){monthModal();return;}
  if(event.target.matches('[data-backdrop]')){closeModal();return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action;
  const m=getMonth();
  switch(action){
    case 'select-week': chosenWeek=Number(target.dataset.week);render();break;
    case 'select-history-week': historyWeek=Number(target.dataset.week);render();break;
    case 'open-setup':setupModal();break;
    case 'open-update':updateModal();break;
    case 'open-future':futureModal();break;
    case 'open-credit':creditModal();break;
    case 'close-modal':closeModal();break;
    case 'prev-month':changeMonth(-1);break;
    case 'next-month':changeMonth(1);break;
    case 'go-month':{
      const value=document.querySelector('#select-month')?.value;
      if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value)){chosenMonth=value;chosenWeek=chosenMonth===monthKey()?weekOfDate(nowLocalInput()):0;historyWeek=-1;closeModal();render();}
      break;
    }
    case 'split-goals':{
      const form=target.closest('form');const total=centsFromInput(form?.elements.budget.value);
      if(!Number.isSafeInteger(total)||total<0){notify('Informe um orçamento válido.');break;}
      defaultGoals(total).forEach((sum,i)=>{form.elements[`goal${i}`].value=inputAmount(sum);});notify('Metas divididas em quatro partes.');break;
    }
    case 'export':exportData();break;
    case 'delete-snapshot':{
      if(!m || !confirm('Excluir esta atualização do histórico?'))break;
      m.snapshots=m.snapshots.filter(s=>s.id!==target.dataset.id);save();render();notify('Atualização excluída.');break;
    }
    case 'delete-future':{
      if(!m || !confirm('Excluir este lançamento?'))break;
      m.future=m.future.filter(f=>f.id!==target.dataset.id);save();render();notify('Lançamento excluído.');break;
    }
    case 'toggle-future':{
      const item=m?.future.find(f=>f.id===target.dataset.id);if(!item)break;
      if(item.done){
        item.done=false;delete item.doneAt;delete item.snapshotCountAtDone;
      }else{
        const current=nowLocalInput();
        const period=financialPeriod(chosenMonth);
        const effectiveAt=inFinancialMonth(current,chosenMonth)?current:(current.slice(0,10)<period.start?`${period.start}T12:00`:`${period.end}T12:00`);
        item.done=true;item.doneAt=effectiveAt;item.snapshotCountAtDone=m.snapshots.length;
      }
      save();render();notify(item.done?'Realizado: valores recalculados.':'Voltou a previsto: valores recalculados.');break;
    }
    case 'reset-month':{
      if(!m || !confirm(`Apagar todo o planejamento e os registros de ${monthLabel(chosenMonth)}? Esta ação não pode ser desfeita.`))break;
      delete state.months[chosenMonth];save();render();notify('Mês apagado.');break;
    }
  }
});

document.addEventListener('submit', event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;
  event.preventDefault();
  try {
    if(form.dataset.form==='setup') submitSetup(form);
    else if(form.dataset.form==='update') submitUpdate(form);
    else if(form.dataset.form==='future') submitFuture(form);
    else if(form.dataset.form==='credit') submitCredit(form);
  } catch(err){notify(err.message||'Verifique os campos.');}
});

document.addEventListener('change',event=>{
  if(event.target.id==='import-file')importData(event.target.files?.[0]).catch(error=>notify(error.message));
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal();});
render();
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
}
