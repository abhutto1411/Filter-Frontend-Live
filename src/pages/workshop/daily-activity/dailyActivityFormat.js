/**
 * DAR v6 display + contract helpers. Format API strings only.
 * Never Number(null), parseFloat(value||0), or invent zeros.
 */

export const DAR_V6_SCHEMA = 'dar.v6';
export const DAR_V6_PROOF_SCHEMA = 'dar.v6.proof';
export const DAR_V6_PAGE_PATH = '/workshop/daily-activity';
export const DAR_V6_PROOF_PATH = '/workshop/daily-activity/proof';
export const DAR_V6_TIME_ZONE = 'Asia/Riyadh';
export const DAR_V6_UNAVAILABLE = '—';
export const DAR_V6_OWNED_QUERY_KEYS = [
  'from',
  'to',
  'branchIds',
  'sessionIds',
  'actorSource',
];
export const DAR_V6_REPORT_KEYS = [
  'schemaVersion',
  'meta',
  'filters',
  'kpis',
  'summary',
  'departments',
  'sessions',
  'money',
  'operations',
  'technicians',
  'coverage',
  'reconciliation',
];

/** Screen section tabs. PDF still exports every section regardless of the active tab. */
export const DAR_V6_SECTION_TABS = [
  { id: 'accumulated', labelKey: 'jump.00' },
  { id: 'depts', labelKey: 'jump.01' },
  { id: 'sessions', labelKey: 'jump.02' },
  { id: 'finance', labelKey: 'jump.03' },
  { id: 'operations', labelKey: 'jump.04' },
];

const DAR_V6_SECTION_TAB_IDS = new Set(DAR_V6_SECTION_TABS.map((tab) => tab.id));
const DAR_V6_SECTION_TAB_ALIASES = {
  technicians: 'operations',
  coverage: 'operations',
};

/** Hash `#sessions` → Cashier sessions tab. Missing/unknown hash → Accumulated (00). */
export function readDarSectionTab(hash) {
  const id = String(hash || '')
    .replace(/^#/, '')
    .split(/[/?]/)[0]
    .trim();
  if (DAR_V6_SECTION_TAB_IDS.has(id)) return id;
  if (DAR_V6_SECTION_TAB_ALIASES[id]) return DAR_V6_SECTION_TAB_ALIASES[id];
  return 'accumulated';
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ID_LIST = /^\d+(,\d+)*$/;

export function isYmd(value) {
  return typeof value === 'string' && YMD.test(value);
}

export function todayRiyadhYmd(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DAR_V6_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const y = get('year');
  const m = get('month');
  const d = get('day');
  if (!y || !m || !d) return '';
  return `${y}-${m}-${d}`;
}

/** Date-only business dates stay calendar strings — not converted as instants. */
export function formatBusinessDate(ymd, locale = 'en') {
  if (!isYmd(ymd)) return ymd ? String(ymd) : DAR_V6_UNAVAILABLE;
  const [y, mo, d] = ymd.split('-');
  if (locale === 'ar') return `${Number(d)} ${arMonth(mo)} ${y}`;
  return `${d} ${enMonth(mo)} ${y}`;
}

function enMonth(mo) {
  return (
    {
      '01': 'Jan',
      '02': 'Feb',
      '03': 'Mar',
      '04': 'Apr',
      '05': 'May',
      '06': 'Jun',
      '07': 'Jul',
      '08': 'Aug',
      '09': 'Sep',
      10: 'Oct',
      11: 'Nov',
      12: 'Dec',
    }[mo] || mo
  );
}

function arMonth(mo) {
  return (
    {
      '01': 'يناير',
      '02': 'فبراير',
      '03': 'مارس',
      '04': 'أبريل',
      '05': 'مايو',
      '06': 'يونيو',
      '07': 'يوليو',
      '08': 'أغسطس',
      '09': 'سبتمبر',
      10: 'أكتوبر',
      11: 'نوفمبر',
      12: 'ديسمبر',
    }[mo] || mo
  );
}

/** Server ISO Z → Asia/Riyadh wall clock. Never browser TZ. */
export function formatRiyadhInstant(iso, locale = 'en') {
  if (iso == null || iso === '') return DAR_V6_UNAVAILABLE;
  const d = iso instanceof Date ? iso : new Date(String(iso));
  if (Number.isNaN(d.getTime())) return DAR_V6_UNAVAILABLE;
  const text = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    timeZone: DAR_V6_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${text} ${DAR_V6_TIME_ZONE}`;
}

export function formatRiyadhClock(iso) {
  if (iso == null || iso === '') return DAR_V6_UNAVAILABLE;
  const d = iso instanceof Date ? iso : new Date(String(iso));
  if (Number.isNaN(d.getTime())) return DAR_V6_UNAVAILABLE;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DAR_V6_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value;
  const m = parts.find((p) => p.type === 'minute')?.value;
  return h && m ? `${h === '24' ? '00' : h}:${m}` : DAR_V6_UNAVAILABLE;
}

export function formatRiyadhDate(iso, locale = 'en') {
  if (iso == null || iso === '') return DAR_V6_UNAVAILABLE;
  const d = iso instanceof Date ? iso : new Date(String(iso));
  if (Number.isNaN(d.getTime())) return DAR_V6_UNAVAILABLE;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    timeZone: DAR_V6_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

/** Opening stamp: `08 Sep 2026 17:11` Asia/Riyadh. Never inferred from session id. */
export function formatRiyadhDateClock(iso, locale = 'en') {
  if (iso == null || iso === '') return DAR_V6_UNAVAILABLE;
  const d = iso instanceof Date ? iso : new Date(String(iso));
  if (Number.isNaN(d.getTime())) return DAR_V6_UNAVAILABLE;
  const date = formatRiyadhDate(d, locale);
  const clock = formatRiyadhClock(d);
  if (date === DAR_V6_UNAVAILABLE && clock === DAR_V6_UNAVAILABLE) return DAR_V6_UNAVAILABLE;
  return `${date} ${clock}`;
}

/** Inclusive start → exclusive end, labeled Asia/Riyadh (UTC+3). Does not change query bounds. */
export function formatRiyadhExclusiveWindow(startIso, endExclusiveIso, locale = 'en') {
  const start = formatRiyadhDateClock(startIso, locale);
  const end = formatRiyadhDateClock(endExclusiveIso, locale);
  if (start === DAR_V6_UNAVAILABLE && end === DAR_V6_UNAVAILABLE) return DAR_V6_UNAVAILABLE;
  return `${start} → ${end} (end exclusive)`;
}

export function formatOwnerScopeLine(meta, locale = 'en') {
  const from = formatBusinessDate(meta?.from, locale);
  const to =
    meta?.to && meta.to !== meta.from ? ` – ${formatBusinessDate(meta.to, locale)}` : '';
  return `${from}${to} · Asia/Riyadh (UTC+3)`;
}

export function groupIntegerDigits(intPart) {
  const raw = String(intPart || '0').replace(/^0+(?=\d)/, '') || '0';
  let grouped = '';
  for (let i = raw.length - 1, n = 0; i >= 0; i -= 1, n += 1) {
    if (n > 0 && n % 3 === 0) grouped = `,${grouped}`;
    grouped = `${raw[i]}${grouped}`;
  }
  return grouped;
}

/**
 * Exact-string grouping. Null/blank → —. Does not use Number().
 * money: keep fractional digits from the API (usually 2).
 * quantity/count/percent/duration: keep documented precision.
 */
export function formatExactDecimal(value, { kind = 'money' } = {}) {
  if (value == null || value === '') return DAR_V6_UNAVAILABLE;
  const raw = String(value).trim();
  if (raw === '') return DAR_V6_UNAVAILABLE;
  const neg = raw.startsWith('-');
  const body = (neg ? raw.slice(1) : raw).replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(body)) return DAR_V6_UNAVAILABLE;
  const dot = body.indexOf('.');
  const intPart = dot === -1 ? body : body.slice(0, dot);
  let frac = dot === -1 ? '' : body.slice(dot + 1);
  if (kind === 'money') {
    if (frac.length === 0) frac = '00';
    else if (frac.length === 1) frac = `${frac}0`;
    // Keep extra cents if BE sent them; do not Number-round.
  }
  const grouped = groupIntegerDigits(intPart);
  const shown = frac === '' ? grouped : `${grouped}.${frac}`;
  return `${neg ? '-' : ''}${shown}`;
}

export function formatMetricValue(metric) {
  if (!metric || typeof metric !== 'object') return DAR_V6_UNAVAILABLE;
  if (metric.value == null || metric.status === 'unavailable') {
    return DAR_V6_UNAVAILABLE;
  }
  return formatExactDecimal(metric.value, { kind: metric.kind || 'money' });
}

export function isUnavailableMetric(metric) {
  if (!metric || typeof metric !== 'object') return true;
  return metric.value == null || metric.status === 'unavailable';
}

export function parseIdList(raw) {
  if (raw == null || raw === '' || raw === 'all') return [];
  const parts = String(raw)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function joinIdList(ids) {
  return (ids || []).map(String).filter((id) => /^\d+$/.test(id)).join(',');
}

export function defaultOwnedQuery(now = new Date()) {
  const today = todayRiyadhYmd(now);
  return {
    from: today,
    to: today,
    branchIds: [],
    sessionIds: [],
    actorSource: 'all',
  };
}

export function readOwnedSearch(search) {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  return {
    from: isYmd(from) ? from : '',
    to: isYmd(to) ? to : '',
    branchIds: parseIdList(params.get('branchIds')),
    sessionIds: parseIdList(params.get('sessionIds')),
    actorSource: normalizeActorSource(params.get('actorSource')),
  };
}

export function normalizeActorSource(raw) {
  const v = String(raw || 'all').trim().toLowerCase();
  return ['all', 'pos', 'web', 'other', 'unknown'].includes(v) ? v : 'all';
}

export function writeOwnedSearch(query, currentSearch) {
  const next = new URLSearchParams();
  if (currentSearch) {
    const cur =
      currentSearch instanceof URLSearchParams
        ? currentSearch
        : new URLSearchParams(String(currentSearch).replace(/^\?/, ''));
    for (const [k, v] of cur.entries()) {
      if (!DAR_V6_OWNED_QUERY_KEYS.includes(k)) next.set(k, v);
    }
  }
  if (isYmd(query.from)) next.set('from', query.from);
  if (isYmd(query.to)) next.set('to', query.to);
  const branches = joinIdList(query.branchIds);
  if (branches) next.set('branchIds', branches);
  const sessions = joinIdList(query.sessionIds);
  if (sessions) next.set('sessionIds', sessions);
  if (query.actorSource && query.actorSource !== 'all') {
    next.set('actorSource', query.actorSource);
  }
  return next;
}

export function buildRequestKey(query) {
  return [
    query.from || '',
    query.to || '',
    joinIdList(query.branchIds),
    joinIdList(query.sessionIds),
    query.actorSource || 'all',
  ].join('|');
}

export function serializeDarQuery(query) {
  const p = new URLSearchParams();
  if (query.from) p.set('from', query.from);
  if (query.to) p.set('to', query.to);
  const branches = joinIdList(query.branchIds);
  if (branches) p.set('branchIds', branches);
  const sessions = joinIdList(query.sessionIds);
  if (sessions) p.set('sessionIds', sessions);
  if (query.actorSource && query.actorSource !== 'all') {
    p.set('actorSource', query.actorSource);
  }
  if (query.metricKey) p.set('metricKey', query.metricKey);
  if (query.snapshotToken) p.set('snapshotToken', query.snapshotToken);
  if (query.sourceFingerprint) p.set('sourceFingerprint', query.sourceFingerprint);
  if (query.clickedValue) p.set('clickedValue', String(query.clickedValue));
  if (query.asOf) p.set('asOf', query.asOf);
  if (query.cursor) p.set('cursor', query.cursor);
  if (query.limit != null) p.set('limit', String(query.limit));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Discard out-of-order responses: only the latest Apply key may commit. */
export function isStaleRequest(activeKey, responseKey) {
  return Boolean(activeKey) && Boolean(responseKey) && activeKey !== responseKey;
}

export function shouldSyncDarUrl(pathname) {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '');
  return path === DAR_V6_PAGE_PATH || path.endsWith(DAR_V6_PAGE_PATH);
}

/** Options/list must follow selected branch ids (equality), never display-name matching. */
export function sessionsForSelectedBranches(sessions, branchIds) {
  const list = Array.isArray(sessions) ? sessions : [];
  const wanted = (branchIds || []).map(String).filter((id) => /^\d+$/.test(id));
  if (!wanted.length) return list;
  const allow = new Set(wanted);
  return list.filter((s) => allow.has(String(s.branchId)));
}

export function pruneStaleSessionIds(selectedIds, availableSessions, branchIds) {
  const scoped = sessionsForSelectedBranches(availableSessions, branchIds);
  const allowed = new Set(
    scoped.map((s) => String(s.id)).filter((id) => /^\d+$/.test(id)),
  );
  const kept = (selectedIds || []).map(String).filter((id) => allowed.has(id));
  return {
    ids: kept,
    cleared: (selectedIds || []).length > 0 && kept.length !== (selectedIds || []).length,
  };
}

export function validateReportPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'empty', code: 'BACKEND_UPDATE_REQUIRED' };
  }
  if (payload.schemaVersion !== DAR_V6_SCHEMA) {
    return { ok: false, reason: 'schema', code: 'BACKEND_UPDATE_REQUIRED' };
  }
  for (const key of DAR_V6_REPORT_KEYS) {
    if (!(key in payload)) {
      return { ok: false, reason: `missing:${key}`, code: 'BACKEND_UPDATE_REQUIRED' };
    }
  }
  return { ok: true, reason: null, code: null };
}

export function classifyDarError(err) {
  const status = err?.status;
  const code = err?.code;
  if (err?.name === 'AbortError') return { kind: 'aborted', status, code };
  if (status === 401 || status === 403) return { kind: 'forbidden', status, code };
  if (status === 409 || code === 'REPORT_SNAPSHOT_CHANGED') {
    return { kind: 'snapshot', status, code: 'REPORT_SNAPSHOT_CHANGED' };
  }
  if (status === 404) return { kind: 'backend', status, code: 'BACKEND_UPDATE_REQUIRED' };
  if (status >= 400 && status < 500) return { kind: 'invalid', status, code };
  if (!status && /Failed to fetch|Cannot reach API|Network/i.test(String(err?.message || ''))) {
    return { kind: 'network', status, code };
  }
  return { kind: 'unknown', status, code };
}

/** Extra Nest status/code/message for invalid/unknown banners. Does not replace i18n keys. */
export function formatDarErrorDetail(err) {
  const status = err?.status;
  const code = err?.code != null && String(err.code).trim() !== '' ? String(err.code).trim() : '';
  let message = String(err?.message || '').replace(/\s+/g, ' ').trim();
  if (message.length > 220) message = `${message.slice(0, 217)}…`;
  const parts = [];
  if (status) parts.push(`HTTP ${status}`);
  if (code) parts.push(code);
  if (
    message &&
    !/^(Could not load Daily Activity|The selected filters were rejected)\.?$/i.test(message)
  ) {
    parts.push(message);
  }
  return parts.join(' · ');
}

const DAR_V6_PROOF_API_PATH = '/workshop-staff/reports/daily-activity/v6/proof';

/** Path-absolute DAR v6 proof API only. Rejects schemes, hosts, and other paths. */
export function allowlistedProofApiHref(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s || s.startsWith('//') || /[\s<>'"\\]/.test(s)) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return '';
  const path = s.split('?')[0];
  if (path !== DAR_V6_PROOF_API_PATH) return '';
  return s;
}

/** Same-origin workshop document paths only. */
export function allowlistedSourceHref(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s || s.startsWith('//') || /[\s<>'"\\]/.test(s)) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return '';
  if (s.startsWith('/workshop/') || s.startsWith('/workshop-staff/')) return s;
  return '';
}

const DAR_V6_PROOF_QUERY_KEYS = [
  'from',
  'to',
  'branchIds',
  'sessionIds',
  'actorSource',
  'metricKey',
  'snapshotToken',
  'sourceFingerprint',
  'clickedValue',
  'returnTab',
  'asOf',
  'cursor',
  'limit',
];

export function copyAllowlistedProofQuery(rawQuery) {
  const src = new URLSearchParams(String(rawQuery || '').replace(/^\?/, ''));
  const next = new URLSearchParams();
  for (const key of DAR_V6_PROOF_QUERY_KEYS) {
    const v = src.get(key);
    if (v == null || v === '') continue;
    if (key === 'from' || key === 'to') {
      if (isYmd(v)) next.set(key, v);
      continue;
    }
    if (key === 'branchIds' || key === 'sessionIds') {
      const ids = joinIdList(parseIdList(v));
      if (ids) next.set(key, ids);
      continue;
    }
    if (key === 'actorSource') {
      const actor = normalizeActorSource(v);
      if (actor !== 'all') next.set(key, actor);
      continue;
    }
    if (key === 'limit') {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) next.set(key, String(Math.min(Math.floor(n), 200)));
      continue;
    }
    if (key === 'asOf') {
      const iso = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !Number.isNaN(Date.parse(iso))) {
        next.set(key, new Date(iso).toISOString());
      }
      continue;
    }
    const cleaned = String(v).replace(/[<>'"\\]/g, '').trim();
    if (cleaned) next.set(key, cleaned);
  }
  return next;
}

export function wrapProofHref(metric, fallbackQuery = {}) {
  const be = allowlistedProofApiHref(metric?.proof?.href);
  if (be.includes('?')) {
    const copied = copyAllowlistedProofQuery(be.slice(be.indexOf('?') + 1));
    if (copied.toString()) {
      return `${DAR_V6_PROOF_PATH}?${copied.toString()}`;
    }
  }
  const params = copyAllowlistedProofQuery('');
  const key = metric?.proof?.metricKey || metric?.key;
  if (key) params.set('metricKey', String(key).replace(/[<>'"\\]/g, '').trim());
  if (fallbackQuery.snapshotToken) params.set('snapshotToken', String(fallbackQuery.snapshotToken));
  if (fallbackQuery.asOf) {
    const iso = String(fallbackQuery.asOf).trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !Number.isNaN(Date.parse(iso))) {
      params.set('asOf', new Date(iso).toISOString());
    }
  }
  if (isYmd(fallbackQuery.from)) params.set('from', fallbackQuery.from);
  if (isYmd(fallbackQuery.to)) params.set('to', fallbackQuery.to);
  const branches = joinIdList(fallbackQuery.branchIds);
  if (branches) params.set('branchIds', branches);
  const sessions = joinIdList(fallbackQuery.sessionIds);
  if (sessions) params.set('sessionIds', sessions);
  if (fallbackQuery.actorSource && fallbackQuery.actorSource !== 'all') {
    params.set('actorSource', normalizeActorSource(fallbackQuery.actorSource));
  }
  if (fallbackQuery.sourceFingerprint) {
    params.set('sourceFingerprint', String(fallbackQuery.sourceFingerprint));
  }
  if (metric?.value != null && metric.value !== '') {
    params.set(
      'clickedValue',
      String(metric.value).replace(/[<>'"\\]/g, '').trim().slice(0, 64),
    );
  }
  if (fallbackQuery.returnTab) {
    params.set('returnTab', String(fallbackQuery.returnTab).replace(/[<>'"\\]/g, '').trim());
  }
  const qs = params.toString();
  return qs ? `${DAR_V6_PROOF_PATH}?${qs}` : DAR_V6_PROOF_PATH;
}

export function sessionChipLabel(session, locale = 'en') {
  if (!session) return '';
  const tz = 'Asia/Riyadh';
  const open = formatRiyadhDateClock(session.openedAt, locale);
  const close = session.closedAt
    ? formatRiyadhDateClock(session.closedAt, locale)
    : locale === 'ar'
      ? 'مفتوحة'
      : 'open';
  const status = session.status || (session.closedAt ? 'closed' : 'open');
  const cashier = session.cashierName || (locale === 'ar' ? 'أمين الصندوق' : 'Cashier');
  const branch = session.branchId || '';
  return `${session.id} · ${cashier} · ${branch} · ${open} → ${close} ${tz} · ${status}`;
}

export function sessionSelectedChipLabel(session, locale = 'en') {
  if (!session) return '';
  const open = formatRiyadhDateClock(session.openedAt, locale);
  return `${session.id} · ${open}`;
}

export function sessionOpenedGroupLabel(session, locale = 'en') {
  const day = formatRiyadhDate(session?.openedAt, locale);
  if (!day || day === DAR_V6_UNAVAILABLE) {
    return locale === 'ar' ? 'افتتاح غير معروف' : 'Opening unknown';
  }
  return locale === 'ar' ? `افتتحت ${day}` : `Opened ${day}`;
}

export function isValidIdListRaw(raw) {
  if (raw == null || raw === '') return true;
  return ID_LIST.test(String(raw));
}
