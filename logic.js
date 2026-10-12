/* Motor financeiro — valores em centavos, sem dependências. */
export const STORAGE_KEY = 'caixa-semanal-v1';

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
export function lastDay(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
export function weekOfDate(dateStr) {
  const day = Number(String(dateStr).slice(8, 10));
  if (!day || day < 1 || day > 31) return 0;
  return day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
}
export function rangeLabel(key, index) {
  const starts = [1, 8, 15, 22];
  const ends = [7, 14, 21, lastDay(key)];
  return `${starts[index]}–${ends[index]}/${key.slice(5)}`;
}
export function centsFromInput(raw) {
  if (typeof raw === 'number') return Math.round(raw * 100);
  let text = String(raw ?? '').trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (!text) return NaN;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
  return Math.round(Number(text) * 100);
}
export function brl(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
export function inputAmount(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function nowLocalInput(date = new Date()) {
  const p = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}
export function defaultGoals(budget) {
  const base = Math.floor(budget / 4);
  return [base, base, base, budget - base * 3];
}
export function newMonth(key, budget, startCash, startCard, goals) {
  return { key, budget, startCash, startCard, goals, snapshots: [], future: [], createdAt: new Date().toISOString() };
}
export function orderedSnapshots(month) {
  return [...month.snapshots].sort((a, b) => a.at.localeCompare(b.at));
}
export function position(month, asOf = null) {
  const records = orderedSnapshots(month).filter(s => !asOf || s.at <= asOf);
  return records.at(-1) || { cash: month.startCash, card: month.startCard, at: null, initial: true };
}
export function openCash(month, pos) {
  return pos.cash - pos.card;
}
export function spentSinceStart(month, pos) {
  return (month.startCash - month.startCard) - openCash(month, pos);
}
export function pendingFuture(month) {
  return month.future.filter(item => !item.done);
}
export function pendingByWeek(month) {
  const pending = [0, 0, 0, 0];
  for (const item of pendingFuture(month)) {
    if (!item.date.startsWith(month.key)) continue;
    pending[weekOfDate(item.date)] += item.amount;
  }
  return pending;
}
// A reserva de cada semana JÁ inclui lançamentos previstos nela, para não descontá-los duas vezes.
// Prioriza semanas posteriores e direciona sobras das semanas encerradas à última semana.
export function calculatePlan(month, pos, activeWeek) {
  const spent = spentSinceStart(month, pos);
  const budgetLeft = month.budget - spent;
  const liquid = openCash(month, pos);
  const rawPool = Math.min(budgetLeft, liquid);
  let pool = Math.max(0, rawPool);
  const commitments = pendingByWeek(month);
  const start = Math.max(0, Math.min(3, activeWeek));
  const desired = month.goals.map((goal, i) => Math.max(goal, commitments[i]));
  // O que sobrou de semanas já encerradas vai para a última semana como potencial Pix de investimento.
  const surplus = Math.max(0, pool - desired.slice(start).reduce((sum, n) => sum + n, 0));
  desired[3] += surplus;
  const available = [null, null, null, null];
  for (let i = 3; i >= start; i--) {
    available[i] = Math.min(pool, desired[i]);
    pool -= available[i];
  }
  return {
    available, desired, commitments, spent, budgetLeft, liquid,
    rawPool, insufficient: Math.max(0, -rawPool),
    futureCard: pendingFuture(month).filter(e => e.type === 'card').reduce((s, e) => s + e.amount, 0),
    futurePix: pendingFuture(month).filter(e => e.type === 'pix').reduce((s, e) => s + e.amount, 0)
  };
}
export function effectiveWeek(key, pos, today = new Date()) {
  const current = monthKey(today);
  if (key > current) return 0;
  if (key < current) return 3;
  return weekOfDate(nowLocalInput(today));
}
export function pastWeekPosition(month, selectedWeek) {
  const last = [7, 14, 21, lastDay(month.key)][selectedWeek];
  const end = `${month.key}-${String(last).padStart(2, '0')}T23:59`;
  const records = orderedSnapshots(month).filter(s => s.at <= end && weekOfDate(s.at) === selectedWeek);
  return records.at(-1) || null;
}
export function actualWeekSpent(month, index) {
  const snapshots = orderedSnapshots(month);
  const inside = snapshots.filter(s => weekOfDate(s.at) === index);
  if (!inside.length) return null;
  const startDay = [1, 8, 15, 22][index];
  const cutoff = `${month.key}-${String(startDay).padStart(2, '0')}T00:00`;
  const prior = snapshots.filter(s => s.at < cutoff).at(-1);
  if (index > 0 && !prior) return null; // Não atribuir gasto de outras semanas sem referência.
  const baseline = prior || { cash: month.startCash, card: month.startCard };
  return openCash(month, baseline) - openCash(month, inside.at(-1));
}
export function validateMonth(value) {
  if (!value || typeof value !== 'object' || !/^\d{4}-\d{2}$/.test(value.key || '')) return false;
  if (![value.budget, value.startCash, value.startCard].every(n => Number.isSafeInteger(n) && n >= 0)) return false;
  if (!Array.isArray(value.goals) || value.goals.length !== 4 || value.goals.some(n => !Number.isSafeInteger(n) || n < 0)) return false;
  if (value.goals.reduce((s, n) => s + n, 0) !== value.budget) return false;
  if (!Array.isArray(value.snapshots) || !Array.isArray(value.future)) return false;
  if (!value.snapshots.every(s => s && typeof s.id === 'string' && typeof s.at === 'string' && s.at.startsWith(value.key) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s.at) && [s.cash, s.card].every(n => Number.isSafeInteger(n) && n >= 0))) return false;
  if (!value.future.every(f => f && typeof f.id === 'string' && typeof f.date === 'string' && f.date.startsWith(value.key) && /^(card|pix)$/.test(f.type) && typeof f.description === 'string' && Number.isSafeInteger(f.amount) && f.amount > 0 && typeof f.done === 'boolean')) return false;
  return true;
}
export function validateState(value) {
  return Boolean(value && value.version === 1 && value.months && typeof value.months === 'object' && !Array.isArray(value.months) &&
    Object.entries(value.months).every(([key, month]) => key === month.key && validateMonth(month)));
}
