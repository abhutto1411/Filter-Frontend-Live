import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Printer, RefreshCw } from 'lucide-react';
import Money from '../../components/Money';
import { formatMoney2 } from '../../utils/formatMoney2';
import { riyalPrintSvg } from '../../utils/riyalPrintMarkup';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import { getWorkshopCorporateHqSettlement } from '../../services/workshopStaffApi';
import { buildSettlementStatementRows, cfx02T } from '../../utils/corporateFix02I18n';

const money2 = formatMoney2;

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** G5: printable settlement statement (accounting-flow table layout). */
async function printSettlementStatement({ rows, data, locale, t, from, to }) {
    // Open synchronously (user gesture) so popup blockers allow it; fill after.
    const w = window.open('', '_blank');
    if (!w) return;
    // F2: ⃁ on every printed amount (shared RiyalIcon markup).
    const svg = await riyalPrintSvg(10);
    const m = (v) => `<span class="m">${svg}<bdi dir="ltr">${money2(v)}</bdi></span>`;
    const dir = String(locale).startsWith('ar') ? 'rtl' : 'ltr';
    const body = rows
        .map(
            (r) => `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.description)}</td>
<td class="n">${r.debit ? m(r.debit) : ''}</td><td class="n">${r.credit ? m(r.credit) : ''}</td>
<td class="n">${m(r.balance)}</td></tr>`,
        )
        .join('');
    const html = `<!doctype html><html dir="${dir}" lang="${dir === 'rtl' ? 'ar' : 'en'}"><head><meta charset="utf-8">
<title>${escapeHtml(t('stmt.title'))}</title>
<style>body{font-family:"Noto Naskh Arabic",Arial,sans-serif;padding:24px;color:#111827}
h1{font-size:18px;margin:0 0 4px}p{margin:2px 0;color:#475569;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:start}th{background:#f1f5f9}
td.n{text-align:end;font-variant-numeric:tabular-nums}
.m{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}</style></head><body>
<h1>${escapeHtml(t('stmt.title'))}</h1>
<p>${escapeHtml(t('settle.subtitle'))}</p>
<p>${escapeHtml(t('settle.from'))} ${escapeHtml(from || '—')} · ${escapeHtml(t('settle.to'))} ${escapeHtml(to || '—')}</p>
<table><thead><tr><th>${escapeHtml(t('stmt.date'))}</th><th>${escapeHtml(t('stmt.description'))}</th>
<th>${escapeHtml(t('stmt.debit'))}</th><th>${escapeHtml(t('stmt.credit'))}</th><th>${escapeHtml(t('stmt.balance'))}</th></tr></thead>
<tbody>${body}</tbody></table>
${data?.ledger1340 != null ? `<p style="margin-top:10px">${escapeHtml(t('stmt.reconciles', { amount: '__AMT__' })).replace('__AMT__', m(data.ledger1340))}</p>` : ''}
<script>window.onload=function(){window.print();}</script></body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
}

/**
 * CORPORATE-FIX-02 G3: Workshop → Corporate → Due from Super Admin (1340).
 * Read only. KPIs, one row per HQ bill, link to the 1340 ledger, settlement statement.
 */
export default function WorkshopCorporateHqSettlementPage({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => cfx02T(locale, key, vars), [locale]);
    const dir = String(locale).startsWith('ar') ? 'rtl' : 'ltr';
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const today = toRiyadhDateISO(new Date()) || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || today;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getWorkshopCorporateHqSettlement({ from, to });
            setData(res || null);
        } catch (e) {
            setError(e?.message || 'Error');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    useEffect(() => {
        Promise.resolve().then(load);
    }, [load]);

    const setRange = (key, value) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value);
        else next.delete(key);
        setSearchParams(next, { replace: true });
    };

    const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);
    const totals = data?.totals || {};
    const statementRows = useMemo(() => buildSettlementStatementRows(rows, locale), [rows, locale]);
    const ledgerHref = data?.ledger1340AccountId
        ? `/workshop/accounting/ledger/${encodeURIComponent(data.ledger1340AccountId)}${from || to ? `?${new URLSearchParams({ ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}) }).toString()}` : ''}`
        : null;

    return (
        <div dir={dir} data-testid="wcorp-hq-settlement">
            <div className="ws-page-header">
                <div>
                    <button type="button" className="btn-portal-outline" onClick={() => navigate('/workshop/corporate-management')}>
                        <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {t('settle.back')}
                    </button>
                    <h2 className="ws-page-title" style={{ marginTop: 10 }}>{t('settle.title')}</h2>
                    <p className="ws-page-sub">{t('settle.subtitle')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label className="ws-page-sub">
                        {t('settle.from')}{' '}
                        <input type="date" className="ui-input" value={from} onChange={(e) => setRange('from', e.target.value)} />
                    </label>
                    <label className="ws-page-sub">
                        {t('settle.to')}{' '}
                        <input type="date" className="ui-input" value={to} onChange={(e) => setRange('to', e.target.value)} />
                    </label>
                    <button type="button" className="btn-portal-outline" onClick={load} disabled={loading}>
                        <RefreshCw size={14} /> {t('payout.refresh')}
                    </button>
                    {ledgerHref ? (
                        <button type="button" className="btn-portal-outline" onClick={() => navigate(ledgerHref)} data-testid="wcorp-hq-ledger">
                            <BookOpen size={14} /> {t('settle.ledger')}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={!statementRows.length}
                        onClick={() => { void printSettlementStatement({ rows: statementRows, data, locale, t, from, to }); }}
                        data-testid="wcorp-hq-statement"
                    >
                        <Printer size={14} /> {t('settle.statement')}
                    </button>
                </div>
            </div>

            {error ? <div className="ws-section" role="alert" style={{ color: '#b91c1c' }}>{error}</div> : null}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginTop: 12 }}>
                {[
                    { id: 'billed', label: t('settle.billed'), value: totals.billed },
                    { id: 'received', label: t('settle.received'), value: totals.paidOut },
                    { id: 'open', label: t('settle.open'), value: totals.open },
                ].map((card) => (
                    <div className="ws-kpi-card" key={card.id} data-testid={`wcorp-hq-kpi-${card.id}`}>
                        <p className="ws-kpi-label">{card.label}</p>
                        <p className="ws-kpi-value"><Money amount={card.value} /></p>
                    </div>
                ))}
            </div>

            <div className="ws-section" style={{ marginTop: 16, overflowX: 'auto' }}>
                {loading ? (
                    <p>{t('settle.loading')}</p>
                ) : rows.length === 0 ? (
                    <p>{t('settle.empty')}</p>
                ) : (
                    <table className="ws-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>{t('settle.bill')}</th>
                                <th>{t('settle.corporate')}</th>
                                <th style={{ textAlign: 'end' }}>{t('settle.billed')}</th>
                                <th style={{ textAlign: 'end' }}>{t('settle.received')}</th>
                                <th style={{ textAlign: 'end' }}>{t('settle.open')}</th>
                                <th>{t('settle.lastPayout')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.billId}>
                                    <td>{r.billNo}</td>
                                    <td>{r.corporate?.companyName || '—'}</td>
                                    <td style={{ textAlign: 'end' }}><Money amount={r.billed} /></td>
                                    <td style={{ textAlign: 'end' }}><Money amount={r.paidOut} /></td>
                                    <td style={{ textAlign: 'end' }}><Money amount={r.open} /></td>
                                    <td>{r.lastPayoutDate || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
