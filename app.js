import {
  STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY, monthKey, shiftMonth, monthLabel, financialPeriod, periodLabel, dayIndex, inFinancialMonth, weekOfDate, rangeLabel,
  centsFromInput, brl, inputAmount, nowLocalInput, defaultGoals, newMonth,
  orderedSnapshots, position, openCash, spentSinceStart, pendingFuture, calculatePlan, freeForNewSpending,
  cashTimeline, availableBeforeCredits, planAtSnapshot, reconciliationStatus,
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
let historyChart = 'margin';
let toastHandle = 0;
const THEME_KEY='rastro-c-appearance-v1';
const BACKUP_KEY='rastro-c-last-export-v1';
const THEMES=[
  {id:'graphite',name:'Grafite',group:'escuros',swatches:['#10141b','#202836','#70d1af']},
  {id:'navy',name:'Marinho',group:'escuros',swatches:['#101c30','#1e3250','#83b9eb']},
  {id:'olive',name:'Oliva',group:'escuros',swatches:['#171e18','#303e30','#a8ca87']},
  {id:'nude',name:'Nude',group:'claros',swatches:['#f7f1ea','#e9d9cb','#94694f']},
  {id:'rose',name:'Rosé',group:'claros',swatches:['#f9f1f5','#eadde7','#936581']}
];
let theme='graphite';
try { const value=localStorage.getItem(THEME_KEY); if(THEMES.some(t=>t.id===value))theme=value; }catch{}
function setTheme(next) {
  if(!THEMES.some(t=>t.id===next))return;
  theme=next;
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',THEMES.find(t=>t.id===theme).swatches[0]);
  try { localStorage.setItem(THEME_KEY,theme); }catch{}
  render();
}
document.documentElement.dataset.theme=theme;


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
  const preceding=state.months[shiftMonth(chosenMonth,-1)];
  return `<div class="space"></div><div class="eyebrow">COMECE PELO PLANEJAMENTO</div><div class="space"></div><div class="empty"><div class="empty-icon">◎</div><h2>Seu caixa começa aqui</h2><p>Defina o orçamento do mês, o saldo inicial da conta e as metas das quatro semanas. Depois, atualize apenas a posição do cartão e do caixa. Cada mês financeiro começa no dia 26 e termina no dia 25.</p>${btn('open-setup','Criar planejamento mensal','primary')}${preceding?`<div class="action" style="margin-top:11px">${btn('start-from-previous','Usar o mês anterior como referência','secondary wide')}</div>`:''}</div><div class="space"></div><p class="center fine">Sem cadastro e sem conexão bancária. Seus registros ficam neste navegador.</p>`;
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
  // Só é possível comparar a meta total após conhecer a referência da semana anterior.
  const spentWeek = past
    ? (historical ? actualWeekSpent(month, chosenWeek) : null)
    : chosenWeek > active ? 0
    : (pos.at && weekOfDate(pos.at) === chosenWeek ? actualWeekSpent(month, chosenWeek) : 0);
  const adjustedGoal = available === null || spentWeek === null ? null : available + spentWeek;
  const difference = adjustedGoal === null ? null : adjustedGoal - original;
  const free = available === null ? null : past ? available : freeForNewSpending(visible,chosenWeek);
  const pendingCreditsThisWeek = month.future.some(f => !f.done && f.kind === 'credit' && weekOfDate(f.date) === chosenWeek);
  const caption = past ? `Posição registrada na semana ${chosenWeek + 1}` : chosenWeek === active ? (pendingCreditsThisWeek ? 'Livre projetado para esta semana' : 'Livre para novos gastos nesta semana') : `Livre previsto para a semana ${chosenWeek + 1}`;
  const timeline=cashTimeline(month,pos);
  const releaseNow = !past && chosenWeek===active ? availableBeforeCredits(month,pos,active) : null;
  const comparable=orderedSnapshots(month).filter(s=>s.metrics&&s.metrics.week===chosenWeek);
  const movement=comparable.length>=2&&chosenWeek===active?comparable.at(-1).metrics.free-comparable.at(-2).metrics.free:null;
  const status = visible.rawPool < 0 || timeline.shortfall > 0 ? badge('Caixa insuficiente', 'bad') : difference === null ? badge('Compromissos cobertos', 'good') : difference < 0 ? badge('Meta ajustada', 'warn') : badge('Dentro do planejamento', 'good');
  // O Painel mostra exclusivamente o cabeçalho semanal e o quadro principal.
  // Posição bancária e ações de registro ficam em Histórico; planejamento e previsões, em Metas.
  return `
    <div class="spread"><div class="eyebrow">CONTROLE SEMANAL</div>${badge('Fechamento em zero')}</div>
    ${weekTabs(chosenWeek, 'select-week')}
    <section class="hero" aria-label="Meta da semana">
      <div class="eyebrow">${caption}</div>
      <div class="hero-value money">${free === null ? '—' : fmt(free)}</div>
      <div class="hero-note">${past && !historical ? 'Nenhuma atualização registrada nessa semana' : adjustedGoal === null ? 'Meta recalculada: falta posição da semana anterior' : `Meta recalculada (após previsões): ${fmt(adjustedGoal)}`}</div>
      ${releaseNow!==null && releaseNow<free ? `<div class="hero-availability"><span>Antes dos créditos previstos</span><strong class="money">${fmt(releaseNow)}</strong></div>`:''}
      ${movement!==null?`<div class="hero-movement">Desde a atualização anterior desta semana: <b class="money ${movement<0?'warn-text':'accent'}">${signed(movement)}</b></div>`:''}
      <div class="hero-foot"><div><span class="foot-label">Original: ${fmt(original)} · Ajuste</span><b class="money ${difference < 0 ? 'warn-text' : difference > 0 ? 'accent' : ''}">${difference === null ? '—' : signed(difference)}</b></div><div><span class="foot-label">Situação</span>${status}</div></div>
    </section>
  `;
}
function renderForecastSummary(month) {
  const futures = pendingFuture(month);
  const debit = futures.filter(item => (item.kind || 'debit') === 'debit').reduce((sum, item) => sum + item.amount, 0);
  const credit = futures.filter(item => item.kind === 'credit').reduce((sum, item) => sum + item.amount, 0);
  if (!debit && !credit) return '';
  return `${heading('Previsão do mês', 'Valores ainda pendentes')}
    <div class="card">
      <div class="indicator"><span class="indicator-label">Despesas previstas</span><b class="indicator-value money">− ${fmt(debit)}</b></div>
      <div class="indicator"><span class="indicator-label">Créditos previstos</span><b class="indicator-value money accent">+ ${fmt(credit)}</b></div>
      <p class="fine">As despesas já reduzem a margem das semanas abertas. Os créditos entram na projeção a partir da semana de recebimento.</p>
    </div>`;
}
function renderFinancialPosition(month) {
  const { pos, plan, active } = activePlan(month);
  const coverageMargin = pos.cash - pos.card;
  const timeline=cashTimeline(month,pos);
  const covered = coverageMargin >= 0;
  const lastText = pos.at ? `Atualizado ${labelDay(pos.at)}` : 'Ainda não há atualização bancária neste mês';
  return `${heading('Posição financeira','Valores atuais')}
    <div class="card">
      <div class="indicator"><span class="indicator-label">Dinheiro na conta</span><span class="indicator-value money">${fmt(pos.cash)}</span></div>
      <div class="indicator"><span class="indicator-label">Fatura em aberto</span><span class="indicator-value money">${fmt(pos.card)}</span></div>
      <div class="indicator"><div><span class="indicator-label">Caixa após a fatura</span><span class="tiny">Saldo após descontar a fatura</span></div><span class="indicator-value money ${coverageMargin < 0 ? 'bad-text' : 'accent'}">${fmt(coverageMargin)}</span></div>
      <div class="indicator"><span class="indicator-label">Caixa projetado após lançamentos pendentes</span><b class="indicator-value money ${timeline.final<0?'bad-text':'accent'}">${fmt(timeline.final)}</b></div>
      <div class="indicator"><div><span class="indicator-label">Disponível antes de créditos futuros</span><span class="tiny">Após proteger todos os pagamentos previstos</span></div><b class="indicator-value money">${fmt(Math.max(0,Math.min(timeline.safeBeforeNewSpending,plan.budgetLeft)))}</b></div>
      <div class="rule"></div>
      <div class="spread"><div><span class="small">Cobertura da fatura</span><p class="fine">${covered ? 'Saldo suficiente para pagar a fatura atual' : 'O saldo atual não cobre a fatura'}</p></div>${badge(covered ? 'Coberta' : 'Insuficiente', covered ? 'good' : 'bad')}</div>
    </div>
    <div class="action">${btn('open-update','＋  Atualizar posição','primary wide')}<div class="buttons" style="margin-top:10px">${btn('open-credit','＋ Registrar crédito recebido','secondary wide')}</div></div>
    <p class="fine center" style="margin-top:9px">${lastText}</p>
    ${!orderedSnapshots(month).length ? '<div class="notice">Para acompanhar os gastos e a fatura, registre sua primeira posição bancária.</div>' : ''}
    ${plan.insufficient > 0 ? `<div class="notice danger">Faltam ${fmt(plan.insufficient)} para cobrir a posição do cartão e cumprir o caixa.</div>` : ''}
    ${timeline.shortfall > 0 ? `<div class="notice danger">Faltam ${fmt(timeline.shortfall)} para cobrir compromissos previstos${timeline.shortfallDate?` até ${timeline.shortfallDate.slice(8,10)}/${timeline.shortfallDate.slice(5,7)}`:''}, mesmo que o saldo final fique positivo.</div>` : ''}
    ${plan.income.some(x => x > 0) ? '<div class="notice">O saldo projetado inclui créditos ainda não recebidos. A disponibilidade imediata não depende dessas entradas.</div>' : ''}`;
}
function renderGoals(month) {
  const { pos, active, plan } = activePlan(month);
  const commitments = pendingFuture(month);
  return `
    <div class="spread"><div><div class="eyebrow">PLANEJAMENTO E PREVISÕES</div><h1 style="margin-top:8px">Metas</h1></div>${btn('open-setup','Editar','secondary compact')}</div>
    <div class="space"></div>
    <div class="card soft"><span class="small">Orçamento total</span><div class="money" style="font-size:32px;font-weight:750;margin-top:7px;letter-spacing:-.05em">${fmt(month.budget)}</div><p class="fine" style="margin-top:10px">Meta inicial fixa. Recalcular não altera o planejamento original.</p></div>
    <div class="notice">Defina metas originais realistas: distribua o orçamento entre as quatro semanas e cadastre compromissos conhecidos antes de gastar. O recálculo preserva as metas originais para comparação.</div>
    ${heading('Metas por semana','Original × ajustada')}
    <div class="goal-grid">${month.goals.map((value, i) => {
      const historical = i < active ? pastWeekPosition(month, i) : null;
      const adjusted = i < active ? historical ? calculatePlan(month, historical, i).available[i] : null : plan.available[i];
      const free = i < active ? null : freeForNewSpending(plan,i);
      const reserved = i < active ? 0 : plan.commitments[i];
      return `<button type="button" class="goal-tile ${i===active?'selected':''} editable-tile" data-action="edit-goal" data-week="${i}" aria-label="Editar meta original da semana ${i+1}"><span class="eyebrow">Semana ${i+1} · ${rangeLabel(month.key,i)}</span><div class="amount money">${fmt(value)}</div><div class="compare">${adjusted === null ? 'Sem registro' : `Recalculada: ${fmt(adjusted)}`}${reserved>0?`<br>Vencimentos: ${fmt(reserved)}<br><strong>Livre: ${fmt(free)}</strong>`:''}</div><span class="tap-hint">Toque para editar ↗</span></button>`;
    }).join('')}</div>
    ${renderForecastSummary(month)}
    ${heading('Lançamentos',`${month.future.length} registro(s) · ${commitments.length} previsto(s)`)}
    <div class="card">
      <div class="spread"><p class="hint" style="max-width:270px">Pix, cartão e créditos. Marque cada lançamento como realizado quando acontecer.</p>${btn('open-future','＋ Adicionar','secondary compact')}</div>
      ${month.future.length ? `<div style="margin-top:8px">${[...month.future].sort((a,b)=>b.date.localeCompare(a.date) || (b.doneAt||'').localeCompare(a.doneAt||'')).map(item=>`
        <div class="future-row ${item.done?'done':''}"><div class="icon">${item.kind==='credit'?'＋':item.type==='card'?'C':'P'}</div><div class="detail"><button type="button" class="record-main" data-action="edit-future" data-id="${esc(item.id)}" aria-label="Editar ${esc(item.description)}"><span class="spread"><strong class="record-name">${esc(item.description)}</strong><b class="money ${item.kind==='credit'?'accent':''}" style="white-space:nowrap;font-size:13px">${item.kind==='credit'?'+ ':'− '}${fmt(item.amount)}</b></span><span class="small record-date">${item.date.slice(8,10)}/${item.date.slice(5,7)} · ${item.kind==='credit'?'Crédito':item.type==='card'?'Cartão':'Pix'} · ${item.done?(reconciliationStatus(month,item)==='conciliado'?'Realizado · conciliado':'Realizado · provisório'):'Previsto'} <span class="edit-glyph">✎</span></span></button><div class="future-actions"><button class="icon-button" data-action="toggle-future" data-id="${esc(item.id)}">${item.done?'Voltar a previsto':'Marcar realizado'}</button><button class="icon-button" data-action="delete-future" data-id="${esc(item.id)}">Excluir</button></div></div></div>`).join('')}</div>` : '<p class="hint" style="margin-top:16px">Nenhum lançamento futuro. Você pode adicioná-los quando precisar.</p>'}
    </div>
    <div class="notice">As despesas futuras reduzem a margem imediatamente. <b>Realizado · provisório</b> já interfere no caixa ou na fatura; <b>Realizado · conciliado</b> está coberto por uma posição bancária posterior e não é contado novamente. Confira a data dos lançamentos ao editar.</div>
    ${month.migratedFromCalendar ? `<div class="notice">Dados da versão antiga preservados. Confira o saldo e a fatura do início do mês financeiro em Metas → Editar (${financialPeriod(month.key).start.slice(8,10)}/${financialPeriod(month.key).start.slice(5,7)}).</div>` : ''}
    ${heading('Aparência', 'Escolha seu tema')}
    <div class="card"><p class="hint" style="margin-bottom:14px">Cinco paletas. A alteração vale para todo o aplicativo e não muda seus registros.</p>
      ${[['claros','Tons suaves'],['escuros','Tons escuros']].map(([group,label])=>`<div class="theme-section"><h3>${label}</h3><div class="theme-grid">${THEMES.filter(t=>t.group===group).map(t=>`<button type="button" class="theme-choice ${theme===t.id?'is-active':''}" data-action="change-theme" data-theme="${t.id}" aria-pressed="${theme===t.id}" aria-label="Tema ${t.name}"><span class="theme-swatches">${t.swatches.map(c=>`<i style="background:${c}"></i>`).join('')}</span><span>${t.name}</span>${theme===t.id?'<small>✓</small>':''}</button>`).join('')}</div></div>`).join('')}
    </div>
    ${heading('Base do planejamento')}
    <div class="card"><div class="indicator"><span class="indicator-label">Saldo inicial da conta</span><b class="indicator-value money">${fmt(month.startCash)}</b></div><div class="indicator"><span class="indicator-label">Fatura inicial</span><b class="indicator-value money">${fmt(month.startCard)}</b></div><div class="indicator"><span class="indicator-label">Gasto desde o início</span><b class="indicator-value money">${fmt(plan.spent)}</b></div></div>
  `;
}
function curvePath(points) {
  return points.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}
function chartAmount(v) {
  return Math.abs(v)>=100000 ? `${(v/100000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mil` : (v/100).toLocaleString('pt-BR',{maximumFractionDigits:0});
}
function renderGraph(month,mode='spending') {
  const snaps=orderedSnapshots(month), period=financialPeriod(month.key);
  const W=390,H=244,left=57,right=13,top=22,bottom=34;
  const maxIndex=Math.max(1,period.days-1);
  const xOf=at=>left+(Math.max(0,Math.min(maxIndex,dayIndex(month.key,at)))/maxIndex)*(W-left-right);
  const actual=snaps.map(s=>{
    const value=mode==='spending'?spentSinceStart(month,position(month,s.at)):s.cash;
    return {date:s.at,value,label:`${labelDay(s.at)}: ${fmt(value)}`};
  });
  let sets;
  if(mode==='spending'){
    const goals=[{date:period.start,value:0,label:'Início: R$ 0,00'}];
    let running=0;
    period.weeks.forEach((w,i)=>{running+=month.goals[i]; goals.push({date:w.end,value:running,label:`Meta até ${w.end.slice(8,10)}/${w.end.slice(5,7)}: ${fmt(running)}`});});
    sets=[{data:goals,style:'budgetline',name:'Planejado',color:'gold'},{data:[{date:period.start,value:0,label:'Início: R$ 0,00'},...actual],style:'series',name:'Registrado',color:'mint'}];
  }else{
    sets=[
      {data:[{date:period.start,value:month.startCash,label:`Saldo inicial: ${fmt(month.startCash)}`},...snaps.map(s=>({date:s.at,value:s.cash,label:`Conta · ${labelDay(s.at)}: ${fmt(s.cash)}`}))],style:'series',name:'Saldo em conta',color:'mint'},
      {data:[{date:period.start,value:month.startCard,label:`Fatura inicial: ${fmt(month.startCard)}`},...snaps.map(s=>({date:s.at,value:s.card,label:`Fatura · ${labelDay(s.at)}: ${fmt(s.card)}`}))],style:'budgetline',name:'Fatura em aberto',color:'gold'}
    ];
  }
  const values=sets.flatMap(s=>s.data.map(d=>d.value));
  const min=Math.min(0,...values),max=Math.max(1,...values),range=Math.max(1,max-min);
  const yOf=v=>H-bottom-(v-min)/range*(H-top-bottom);
  const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
  const markerId=mode==='spending'?'spending-area':'cash-area';
  return `<div class="graph" role="group" aria-label="${mode==='spending'?'Despesas acumuladas em relação às metas':'Histórico do saldo da conta e fatura do cartão'}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${mode==='spending'?'Gráfico comparativo do gasto acumulado e da meta':'Gráfico comparativo do saldo e da fatura'}">
      <defs><linearGradient id="${markerId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--mint)" stop-opacity=".23"/><stop offset="1" stop-color="var(--mint)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(v=>`<line class="gridline" x1="${left}" y1="${yOf(v)}" x2="${W-right}" y2="${yOf(v)}"/><text x="${left-8}" y="${yOf(v)+4}" text-anchor="end">${chartAmount(v)}</text>`).join('')}
      ${period.weeks.slice(0,3).map(w=>`<line class="week-divider" x1="${xOf(w.end)}" y1="${top}" x2="${xOf(w.end)}" y2="${H-bottom}"/>`).join('')}
      ${[period.start,...period.weeks.map(w=>w.end)].map((d,i)=>`<text x="${xOf(d)}" y="${H-10}" text-anchor="${i===0?'start':i===4?'end':'middle'}">${d.slice(8,10)}/${d.slice(5,7)}</text>`).join('')}
      ${sets.map((series,i)=>{
        const pts=series.data.map(d=>[xOf(d.date),yOf(d.value)]);
        const area=series.color==='mint'&&pts.length>1?`<path d="${curvePath(pts)} L${pts.at(-1)[0].toFixed(1)},${yOf(Math.max(0,min)).toFixed(1)} L${pts[0][0].toFixed(1)},${yOf(Math.max(0,min)).toFixed(1)} Z" fill="url(#${markerId})"/>`:'';
        return area+`<path class="${series.style}" d="${curvePath(pts)}"/>`+series.data.map((d,j)=>`<circle class="plot-dot ${series.color}" cx="${pts[j][0].toFixed(1)}" cy="${pts[j][1].toFixed(1)}" r="${j===series.data.length-1?4.4:3.1}"><title>${esc(d.label)}</title></circle>`).join('');
      }).join('')}
    </svg>
    <div class="chart-legend">${sets.map(s=>`<span><i class="swatch ${s.color==='gold'?'gold':''}"></i>${s.name}</span>`).join('')}</div>
    <p class="fine chart-help">${snaps.length?'Pontos baseados nos saldos e faturas que você registrou. Toque nos pontos para detalhes.':'Sem atualizações ainda; a referência inicial está indicada no gráfico.'}</p>
  </div>`;
}
function renderWeeklyGraph(month) {
  const weekly=month.goals.map((goal,i)=>({goal,value:actualWeekSpent(month,i),label:rangeLabel(month.key,i)}));
  const scale=Math.max(1,...weekly.flatMap(w=>[w.goal,w.value===null?0:Math.max(0,w.value)]));
  return `<div class="card weekly-chart" role="group" aria-label="Comparação por semana com metas originais">
    <div class="chart-legend" style="padding:0 0 15px"><span><i class="swatch gold"></i>Meta original</span><span><i class="swatch"></i>Realizado identificável</span></div>
    ${weekly.map((w,i)=>`<div class="week-chart-row"><div class="spread"><strong>Semana ${i+1}</strong><span class="small">${w.label}</span></div><div class="bar-track"><span class="bar-fill goal" style="width:${Math.min(100,w.goal/scale*100).toFixed(2)}%"></span></div><div class="bar-track"><span class="bar-fill actual" style="width:${w.value===null?0:Math.min(100,Math.max(0,w.value)/scale*100).toFixed(2)}%"></span></div><div class="spread compare-numbers"><span>Meta ${fmt(w.goal)}</span><span>${w.value===null?'Realizado: sem referência':`Realizado ${fmt(w.value)}`}</span></div></div>`).join('')}
    <p class="fine" style="margin-top:14px">Se não há posição anterior suficiente para isolar uma semana, o realizado fica sem referência em vez de ser estimado.</p>
  </div>`;
}
function renderMarginGraph(month) {
  const records=orderedSnapshots(month).filter(s=>s.metrics && Number.isSafeInteger(s.metrics.free));
  if(!records.length)return `<div class="empty"><h2>Sem fotografias da margem ainda</h2><p>O gráfico começa com as próximas atualizações. Posições antigas não recebem valores reconstruídos artificialmente.</p></div>`;
  const period=financialPeriod(month.key),W=390,H=238,left=57,right=14,top=22,bottom=32;
  const values=records.map(s=>s.metrics.free);
  const lowest=Math.min(0,...values),highest=Math.max(1,...values),range=Math.max(1,highest-lowest);
  const x=at=>left+dayIndex(month.key,at)/Math.max(1,period.days-1)*(W-left-right);
  const y=v=>H-bottom-(v-lowest)/range*(H-top-bottom);
  const guide=Array.from({length:5},(_,i)=>lowest+(highest-lowest)*i/4);
  const grouped=period.weeks.map((w,i)=>records.filter(s=>s.metrics.week===i));
  return `<div class="graph" role="group" aria-label="Evolução da margem semanal por atualização">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Margens registradas, com traços interrompidos entre semanas">
      ${guide.map(v=>`<line class="gridline" x1="${left}" x2="${W-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-7}" y="${y(v)+3}" text-anchor="end">${chartAmount(v)}</text>`).join('')}
      ${period.weeks.slice(0,3).map(w=>`<line class="week-divider" x1="${x(w.end)}" x2="${x(w.end)}" y1="${top}" y2="${H-bottom}"/>`).join('')}
      ${period.weeks.map(w=>`<text x="${x(w.start)}" y="${H-9}" text-anchor="start">S${w.index+1}</text>`).join('')}
      ${grouped.map(series=>series.length>1?`<path class="series" d="${curvePath(series.map(s=>[x(s.at),y(s.metrics.free)]))}"/>`:'').join('')}
      ${records.map(s=>`<circle class="plot-dot mint" cx="${x(s.at)}" cy="${y(s.metrics.free)}" r="4"><title>${esc(labelDay(s.at))}: ${fmt(s.metrics.free)}</title></circle>`).join('')}
    </svg>
    <p class="fine chart-help">Cada ponto é a margem preservada na atualização. Linhas não conectam semanas diferentes. Edições de posições são assinaladas no histórico.</p>
  </div>`;
}
function historyDelta(records,index) {
  const current=records[index],old=records[index+1];
  if(!current?.metrics || !old?.metrics || current.metrics.week!==old.metrics.week)return null;
  return current.metrics.free-old.metrics.free;
}
function backupReminder(month) {
  if(month.snapshots.length+month.future.length<3)return '';
  let last=0;
  try{last=Number(localStorage.getItem(BACKUP_KEY)||0);}catch{}
  if(last && Date.now()-last<7*86400000)return '';
  return `<div class="notice">${last?'Mais de 7 dias desde o último backup deste navegador.':'Nenhum backup exportado neste navegador.'} Use <b>Exportar JSON</b> para preservar os registros.</div>`;
}
function renderHistory(month) {
  const records = orderedSnapshots(month).reverse();
  const filtered = historyWeek === -1 ? records : records.filter(s => weekOfDate(s.at) === historyWeek);
  const { pos, plan } = activePlan(month);
  return `
    <div class="eyebrow">POSIÇÃO E REGISTROS</div><h1 style="margin-top:8px">Histórico</h1>
    <div class="space"></div>
    ${renderFinancialPosition(month)}
    ${heading('Gasto acumulado no mês')}
    <div class="two-stats">${stat('Gasto líquido no mês',fmt(plan.spent))}</div>
    ${heading('Evolução financeira','Comparação baseada em posições registradas')}
    <div class="chart-switch" role="group" aria-label="Selecionar gráfico">
      <button type="button" data-action="chart-view" data-chart="margin" aria-pressed="${historyChart==='margin'}" class="${historyChart==='margin'?'active':''}">Margem</button>
      <button type="button" data-action="chart-view" data-chart="spending" aria-pressed="${historyChart==='spending'}" class="${historyChart==='spending'?'active':''}">Gastos</button>
      <button type="button" data-action="chart-view" data-chart="cash" aria-pressed="${historyChart==='cash'}" class="${historyChart==='cash'?'active':''}">Conta × fatura</button>
    </div>
    ${historyChart==='margin'?renderMarginGraph(month):renderGraph(month,historyChart)}
    ${heading('Desempenho semanal','Meta × realizado')}
    ${renderWeeklyGraph(month)}
    ${heading('Posições registradas',`${records.length} atualização(ões)`)}
    <div class="week-tabs" role="group" aria-label="Filtrar histórico por semana" style="grid-template-columns:repeat(5,minmax(0,1fr));margin-top:0;margin-bottom:12px">
      ${[-1,0,1,2,3].map(i=>`<button type="button" data-action="select-history-week" data-week="${i}" class="week ${historyWeek===i?'active':''}" style="padding:12px 0"><strong>${i===-1?'Todas':`S${i+1}`}</strong></button>`).join('')}
    </div>
    ${filtered.length ? `<div class="history-list">${filtered.map(s => {
      const spent = spentSinceStart(month,s);
      const selected = weekOfDate(s.at);
      const r = calculatePlan(month,position(month,s.at),selected);
      const change=historyDelta(records,records.indexOf(s));
      return `<div class="history-item"><button type="button" class="history-main" data-action="edit-snapshot" data-id="${esc(s.id)}" aria-label="Editar posição de ${labelDay(s.at)}"><span class="spread"><span><strong>Semana ${selected+1}</strong><span class="meta" style="display:block">${labelDay(s.at)}${s.note?' · '+esc(s.note):''}</span></span><span class="edit-glyph">✎ Editar</span></span>
      <span class="row-data"><span class="muted">Saldo / cartão</span><b>${fmt(s.cash)} / ${fmt(s.card)}</b></span>
      <span class="row-data"><span class="muted">Gasto acumulado</span><b>${fmt(spent)}</b></span>
      <span class="row-data"><span class="muted">Margem naquela atualização</span><b class="accent">${s.metrics?fmt(s.metrics.free):'Sem fotografia histórica'}</b></span>
      ${s.metrics ? `<span class="row-data"><span class="muted">Disponível antes dos créditos</span><b>${fmt(s.metrics.safeNow)}</b></span>`:''}
      ${change!==null?`<span class="row-data"><span class="muted">Desde a atualização anterior</span><b class="money ${change<0?'warn-text':'accent'}">${signed(change)}</b></span>`:''}
      ${s.metrics?.edited ? '<span class="fine">Fotografia recalculada após edição</span>':''}</button><div class="record-bottom">${btn('delete-snapshot','Excluir registro','ghost compact',`data-id="${esc(s.id)}"`)}</div></div>`;
    }).join('')}</div>` : '<div class="empty"><h2>Nenhuma atualização</h2><p>Registre uma posição para visualizar a evolução nesta semana.</p></div>'}
    ${backupReminder(month)}
    ${heading('Segurança dos dados')}
    <div class="card"><p class="hint">Os dados ficam neste navegador, sem sincronização automática. Importe somente após conferir o resumo do arquivo. Faça backup semanal ou antes de atualizar o aplicativo.</p><div class="buttons" style="margin-top:16px">${btn('export','Exportar JSON','secondary')}<label class="secondary file-label">Importar JSON<input id="import-file" type="file" accept="application/json,.json"></label></div><button data-action="reset-month" class="subtle-link" style="color:var(--danger);margin-top:12px">Apagar este mês</button></div>
  `;
}
function modal(content, headingText) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-backdrop="true"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(headingText)}"><div class="modal-head"><h2>${esc(headingText)}</h2><button type="button" class="x-btn" data-action="close-modal" aria-label="Fechar">×</button></div><div class="modal-body">${content}</div></section></div>`;
  modalRoot.querySelector('input:not([type="hidden"])')?.focus({preventScroll:true});
}
function closeModal() { modalRoot.innerHTML = ''; }
function setupModal(usePrevious=false) {
  const current = getMonth();
  const older=usePrevious&&!current?state.months[shiftMonth(chosenMonth,-1)]:null;
  const lastPosition=older?position(older):null;
  const budget = current?.budget ?? older?.budget ?? 1200000;
  const goals = current?.goals || older?.goals || defaultGoals(budget);
  modal(`<form data-form="setup" class="form-grid" novalidate>
    <p class="hint">Período: <b>${periodLabel(chosenMonth)}</b>. Informe o saldo e a fatura do dia 26, início deste mês financeiro, além das metas originais.</p>
    ${older?`<div class="notice">Valores copiados do mês anterior, cuja última posição é de ${esc(lastPosition.at?labelDay(lastPosition.at):'início do mês')}. <b>Confirme o saldo real e a fatura do novo dia 26</b> antes de salvar. Previsões antigas não serão replicadas.</div>`:''}
    ${input('budget','Orçamento mensal (R$)',inputAmount(budget))}
    <div class="fieldrow">${input('startCash','Saldo inicial da conta',inputAmount(current?.startCash ?? lastPosition?.cash ?? budget))}${input('startCard','Fatura inicial',inputAmount(current?.startCard ?? lastPosition?.card ?? 0))}</div>
    <div class="spread"><h3>Metas originais</h3>${btn('split-goals','Dividir igualmente','ghost compact')}</div>
    <div class="goal-grid">${goals.map((g,i)=>input(`goal${i}`,`Semana ${i+1} · ${rangeLabel(chosenMonth,i)}`,inputAmount(g))).join('')}</div>
    <p class="fine">A soma das quatro metas deve ser igual ao orçamento mensal. O saldo inicial é uma referência para acompanhar as alterações do caixa e da fatura.</p>
    ${current?.future.length?`<div class="notice">Já existem ${current.future.filter(x=>!x.done).length} lançamentos futuros pendentes neste mês. Eles são reservados além das metas originais, sem necessidade de reduzi-las manualmente.</div>`:''}
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
function editSnapshotModal(snapId) {
  const m=getMonth(); const snap=m?.snapshots.find(s=>s.id===snapId); if(!snap)return;
  const period=financialPeriod(chosenMonth);
  modal(`<form data-form="edit-snapshot" class="form-grid" novalidate>
    <input type="hidden" name="recordId" value="${esc(snap.id)}">
    <div class="field"><label for="edit-snapshot-at">Data e hora da posição</label><input type="datetime-local" id="edit-snapshot-at" name="at" min="${period.start}T00:00" max="${period.end}T23:59" value="${snap.at}" required></div>
    ${input('cash','Saldo registrado da conta (R$)',inputAmount(snap.cash))}
    ${input('card','Fatura registrada (R$)',inputAmount(snap.card))}
    <div class="field"><label for="edit-snapshot-note">Observação (opcional)</label><input id="edit-snapshot-note" name="note" maxlength="100" value="${esc(snap.note||'')}"></div>
    <p class="fine">Esta edição substitui o registro existente, sem criar uma nova atualização. Pode modificar os cálculos históricos.</p>
    <div class="modal-bottom"><button type="submit" class="primary wide">Salvar alterações</button></div>
  </form>`,'Editar posição');
}
function editFutureModal(itemId) {
  const m=getMonth(); const item=m?.future.find(f=>f.id===itemId); if(!item)return;
  const period=financialPeriod(chosenMonth);
  const type=item.kind==='credit'?'credit':item.type;
  modal(`<form data-form="edit-future" class="form-grid" novalidate>
    <input type="hidden" name="recordId" value="${esc(item.id)}">
    <p class="hint">Modifique os dados do lançamento. A situação Previsto/Realizado será preservada.</p>
    <div class="field"><label for="edit-future-desc">Descrição</label><input type="text" id="edit-future-desc" name="description" maxlength="90" value="${esc(item.description)}" required></div>
    <div class="fieldrow"><div class="field"><label for="edit-future-date">Data prevista</label><input type="date" id="edit-future-date" name="date" min="${period.start}" max="${period.end}" value="${item.date}" required></div>
    <div class="field"><label for="edit-future-type">Tipo</label><select id="edit-future-type" name="type"><option value="pix" ${type==='pix'?'selected':''}>Saída · Pix</option><option value="card" ${type==='card'?'selected':''}>Saída · Cartão</option><option value="credit" ${type==='credit'?'selected':''}>Entrada · Crédito</option></select></div></div>
    ${input('amount','Valor (R$)',inputAmount(item.amount))}
    ${item.done ? `<div class="field"><label for="edit-future-doneAt">Data e hora da realização</label><input type="datetime-local" id="edit-future-doneAt" name="doneAt" min="${period.start}T00:00" max="${period.end}T23:59" value="${esc(item.doneAt||item.date+'T12:00')}" required></div>`:''}
    <div class="notice">Situação atual: <b>${item.done?'Realizado':'Previsto'}</b>. Para alterá-la, use o botão do registro na lista de Metas.</div>
    <div class="modal-bottom"><button type="submit" class="primary wide">Salvar alterações</button></div>
  </form>`,'Editar lançamento');
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
  const previous=orderedSnapshots(m).filter(item=>item.at<=at).at(-1);
  const snap={id:id(),at,cash,card,note};
  m.snapshots.push(snap);
  snap.metrics=planAtSnapshot(m,snap);
  save();closeModal();chosenWeek=weekOfDate(at);render();
  updateFeedback(snap,previous);
}
function updateFeedback(current,previous) {
  const metrics=current.metrics;
  const previousMetrics=previous?.metrics;
  const comparable=previousMetrics&&previousMetrics.week===metrics.week;
  const difference=comparable?metrics.free-previousMetrics.free:null;
  const changes=previous?{cash:current.cash-previous.cash,card:current.card-previous.card}:null;
  modal(`<div class="stack" style="gap:14px">
    <p class="hint">Posição de ${labelDay(current.at)} registrada. O resultado abaixo conserva os valores calculados no momento desta atualização.</p>
    <div class="card soft"><span class="small">Disponível projetado · semana ${metrics.week+1}</span><div class="summary-large money accent">${fmt(metrics.free)}</div>
      <p class="fine">Sem contar créditos ainda não recebidos: <b>${fmt(metrics.safeNow)}</b></p></div>
    ${difference===null?'<div class="notice">Ainda não há duas atualizações comparáveis na mesma semana. A evolução da margem começa com a próxima.</div>':`<div class="indicator"><span class="indicator-label">Variação desde a atualização anterior</span><b class="indicator-value money ${difference<0?'warn-text':'accent'}">${signed(difference)}</b></div>`}
    ${changes?`<div class="card"><div class="indicator"><span class="indicator-label">Variação do saldo bancário</span><b class="money">${signed(changes.cash)}</b></div><div class="indicator"><span class="indicator-label">Variação da fatura</span><b class="money">${signed(changes.card)}</b></div></div>`:''}
    ${metrics.shortfall>0?`<div class="notice danger">Compromissos descobertos: ${fmt(metrics.shortfall)}. Verifique as datas de vencimento.</div>`:'<div class="notice good">Compromissos cadastrados cobertos na sequência prevista, desde que os créditos futuros sejam recebidos nas datas informadas.</div>'}
    <div class="modal-bottom">${btn('close-modal','Voltar ao Histórico','primary wide')}</div>
  </div>`,'Resultado da atualização');
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
function submitEditSnapshot(form) {
  const m=getMonth(); const original=m?.snapshots.find(s=>s.id===form.elements.recordId.value); if(!original)throw new Error('Registro não localizado.');
  const at=form.elements.at.value;
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)||!inFinancialMonth(at,chosenMonth)||!Number.isFinite(Date.parse(at)))throw new Error('Informe uma data válida no mês financeiro.');
  const cash=parseNonnegative(form,'cash'), card=parseNonnegative(form,'card');
  const note=(form.elements.note.value||'').trim().slice(0,100);
  const backup={...original};
  Object.assign(original,{at,cash,card,note});
  original.metrics={...planAtSnapshot(m,original),edited:true};
  if(!validateState(state)){Object.assign(original,backup);throw new Error('Os dados editados são inválidos.');}
  save();closeModal();chosenWeek=weekOfDate(at);render();notify('Posição corrigida; a fotografia editada foi recalculada.');
}
function submitEditFuture(form) {
  const m=getMonth(); const original=m?.future.find(f=>f.id===form.elements.recordId.value); if(!original)throw new Error('Lançamento não localizado.');
  const date=form.elements.date.value, description=form.elements.description.value.trim();
  const type=form.elements.type.value, amount=parseNonnegative(form,'amount',false);
  if(!inFinancialMonth(date,chosenMonth)||!description||!['pix','card','credit'].includes(type))throw new Error('Informe data, descrição e tipo válidos.');
  const doneAt=original.done?form.elements.doneAt.value:null;
  if(original.done && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(doneAt)||!inFinancialMonth(doneAt,chosenMonth)||!Number.isFinite(Date.parse(doneAt))))throw new Error('Data da realização inválida.');
  const backup={...original};
  Object.assign(original,{date,description,amount,type:type==='credit'?'pix':type,kind:type==='credit'?'credit':'debit'});
  if(original.done) {
    original.doneAt=doneAt;
    // Se o instante da realização mudou, recalcula a referência para não
    // lançar novamente sobre uma posição bancária posterior.
    if(backup.doneAt!==doneAt)original.snapshotCountAtDone=orderedSnapshots(m).filter(s=>s.at<=doneAt).length;
  }
  if(!validateState(state)){Object.assign(original,backup);throw new Error('O lançamento editado é inválido.');}
  save();closeModal();render();notify('Lançamento atualizado.');
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
  const a=document.createElement('a');a.href=url;a.download=`rastro-c-backup-${chosenMonth}.json`;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
  try{localStorage.setItem(BACKUP_KEY,String(Date.now()));}catch{}
  render();notify('Backup exportado.');
}
async function importData(file) {
  if(!file)return;
  if(file.size>5_000_000) throw new Error('O arquivo é muito grande.');
  let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new Error('Arquivo JSON inválido.');}
  const legacy = validateLegacyState(parsed);
  const previous=validatePreviousState(parsed);
  if(!legacy && !previous && !validateState(parsed)) throw new Error('O arquivo não contém um backup válido deste aplicativo.');
  const incoming=legacy?migrateLegacyState(parsed):previous?migratePreviousState(parsed):parsed;
  const count=(data)=>Object.values(data.months).reduce((acc,m)=>({snapshots:acc.snapshots+m.snapshots.length,entries:acc.entries+m.future.length}),{snapshots:0,entries:0});
  const n=count(incoming),old=count(state);
  if(!confirm(`CONFIRMAR IMPORTAÇÃO\n\nArquivo: ${Object.keys(incoming.months).length} mês(es), ${n.snapshots} posição(ões), ${n.entries} lançamento(s).\n\nSerão SUBSTITUÍDOS neste navegador: ${old.snapshots} posição(ões), ${old.entries} lançamento(s).\n\nExporte um backup antes de prosseguir. Continuar?`))return;
  state=incoming;
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
    case 'chart-view':historyChart=['cash','margin','spending'].includes(target.dataset.chart)?target.dataset.chart:'margin';render();break;
    case 'open-setup':setupModal();break;
    case 'start-from-previous':setupModal(true);break;
    case 'edit-goal':{
      setupModal();
      modalRoot.querySelector(`[name="goal${Number(target.dataset.week)}"]`)?.focus({preventScroll:true});
      break;
    }
    case 'edit-snapshot':editSnapshotModal(target.dataset.id);break;
    case 'edit-future':editFutureModal(target.dataset.id);break;
    case 'change-theme':setTheme(target.dataset.theme);break;
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
    else if(form.dataset.form==='edit-snapshot') submitEditSnapshot(form);
    else if(form.dataset.form==='edit-future') submitEditFuture(form);
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
