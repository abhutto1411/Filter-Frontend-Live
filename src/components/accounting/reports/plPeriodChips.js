import { addCalendarDaysYmd, toRiyadhDateISO } from '../../../utils/riyadhBusinessRange.js';

export const PL_PERIOD_CHIPS = ['today', 'yesterday', 'thisMonth', 'lastMonth', 'custom'];

export function plChipRange(chip, now = new Date()) {
  const today = toRiyadhDateISO(now);
  if (!today) return null;
  if (chip === 'today') return { dateFrom: today, dateTo: today };
  if (chip === 'yesterday') {
    const y = addCalendarDaysYmd(today, -1);
    return { dateFrom: y, dateTo: y };
  }
  if (chip === 'thisMonth') {
    return { dateFrom: `${today.slice(0, 8)}01`, dateTo: today };
  }
  if (chip === 'lastMonth') {
    const [yy, mm] = today.split('-').map(Number);
    const ly = mm === 1 ? yy - 1 : yy;
    const lm = mm === 1 ? 12 : mm - 1;
    const from = `${ly}-${String(lm).padStart(2, '0')}-01`;
    const last = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
    const to = `${ly}-${String(lm).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { dateFrom: from, dateTo: to };
  }
  return null;
}

export function detectPlChip(dateFrom, dateTo, now = new Date()) {
  const from = String(dateFrom || '').slice(0, 10);
  const to = String(dateTo || '').slice(0, 10);
  if (!from || !to) return 'custom';
  for (const chip of ['today', 'yesterday', 'thisMonth', 'lastMonth']) {
    const r = plChipRange(chip, now);
    if (r && r.dateFrom === from && r.dateTo === to) return chip;
  }
  return 'custom';
}
