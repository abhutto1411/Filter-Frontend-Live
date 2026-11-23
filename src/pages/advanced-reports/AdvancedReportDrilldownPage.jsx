import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { arT } from '../../utils/advancedReportsI18n';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import { getAdvancedReportDrilldown } from '../../services/advancedReportsApi';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

/** Localised, so Arabic shows ر.س rather than a hardcoded "SAR". */
function money(t, n) {
    return t('common.sar', { n: Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
}

/** Column keys that carry an amount, by name — the API sends no types. */
const MONEY_KEY = /amount|cogs|profit|price|total|subtotal|vat|unitCost|unitPrice/i;
const TOTAL_MONEY_KEY = /amount|cogs|profit|price|total/i;

function DrilldownSkeleton() {
    return (
        <div className="ui-stack" aria-busy="true">
            <div className="ui-kpis">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`sk-kpi-${i}`} className="ui-metric ui-stack-sm">
                        <div className="ui-sk ui-sk--label ui-sk--w55" />
                        <div className="ui-sk ui-sk--title ui-sk--w90" />
                    </div>
                ))}
            </div>
            <section className="ui-panel">
                <div className="ui-panel-pad ui-stack-sm">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={`sk-row-${i}`} className="ui-sk-row">
                            <div className="ui-sk ui-sk--text ui-sk--w90" />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

/**
 * Full-page transaction history for a clicked KPI / total.
 * @param {{ portal?: 'workshop'|'admin' }} props
 */
export default function AdvancedReportDrilldownPage({ portal = 'workshop' } = {}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const outletCtx = useOutletContext() || {};
    // Same split as the report page: the admin layout owns the language, the
    // workshop portal renders this directly and keeps its own.
    const storageKey = portal === 'admin' ? 'portal-locale' : 'workshop-advanced-reports-locale';
    const [locale, setLocale] = useState(() => {
        if (portal === 'admin' && outletCtx.locale) return outletCtx.locale;
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(storageKey)
                || (portal === 'admin' ? localStorage.getItem('portal-locale') : null)
                || 'en';
        }
        return 'en';
    });
    const t = useCallback((key, vars) => arT(locale, key, vars), [locale]);

    const switchLocale = (next) => {
        setLocale(next);
        try { localStorage.setItem(storageKey, next); } catch { /* ignore */ }
    };

    const queryKey = searchParams.toString();
    const query = useMemo(() => {
        const o = {};
        searchParams.forEach((v, k) => { o[k] = v; });
        return o;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey captures param values
    }, [queryKey]);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await getAdvancedReportDrilldown(
                    portal === 'admin' ? 'admin' : 'workshop',
                    query,
                );
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) {
                    setErr(e?.message || t('page.error'));
                    setData(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // Intentionally depend on queryKey (stable string) + portal; avoid re-fetch loops.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [portal, queryKey]);

    const backTo = portal === 'admin'
        ? '/admin/sales/advanced-reports'
        : '/workshop/advanced-reports';

    const columns = data?.columns || [];
    const rows = useMemo(() => data?.rows || [], [data]);
    const { pagedRows, pagerProps } = usePagedRows(rows, { resetKey: queryKey });

    const exportRows = (kind) => {
        const headers = columns.map((c) => c.label);
        const body = rows.map((r) => columns.map((c) => {
            const v = r[c.key];
            if (typeof v === 'number') return v;
            return v ?? '';
        }));
        const title = `${t('page.drilldownTitle')} — ${query.metric || ''}`;
        if (kind === 'pdf') exportRowsToPdf({ title, headers, rows: body, filenameBase: `drilldown-${query.metric || 'report'}` });
        else exportRowsToExcel({ sheetName: 'Drilldown', headers, rows: body, filenameBase: `drilldown-${query.metric || 'report'}` });
    };

    return (
        <div className="ui-root ui-root--flush ui-stack" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="ui-row">
                <div className="ui-head">
                    <h1>{t('page.drilldownTitle')}</h1>
                    <p>
                        {t('drill.metric')}: {query.metric || t('common.emDash')}
                        {data?.periodRange
                            ? ` · ${data.periodRange.from?.slice(0, 16)} → ${data.periodRange.to?.slice(0, 16)}`
                            : ''}
                    </p>
                </div>
                <div className="ui-toolbar-end">
                    {portal === 'admin' ? null : (
                        <div className="ui-seg" role="group" aria-label={t('page.lang')}>
                            <button
                                type="button"
                                className="ui-seg-btn"
                                aria-pressed={locale === 'en'}
                                onClick={() => switchLocale('en')}
                            >
                                {t('page.en')}
                            </button>
                            <button
                                type="button"
                                className="ui-seg-btn"
                                aria-pressed={locale === 'ar'}
                                onClick={() => switchLocale('ar')}
                            >
                                {t('page.ar')}
                            </button>
                        </div>
                    )}
                    <button type="button" className="ui-btn ui-btn--default" onClick={() => navigate(backTo)}>
                        <ArrowLeft size={14} /> {t('page.back')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default"
                        disabled={!rows.length}
                        onClick={() => exportRows('pdf')}
                    >
                        {t('page.exportPdf')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        disabled={!rows.length}
                        onClick={() => exportRows('excel')}
                    >
                        {t('page.exportExcel')}
                    </button>
                </div>
            </div>

            {err ? (
                <div className="ui-banner ui-banner--dang">
                    <AlertTriangle size={14} />
                    <span>{err}</span>
                </div>
            ) : null}

            {loading ? <DrilldownSkeleton /> : null}

            {!loading && data?.totals ? (
                <div className="ui-kpis">
                    {Object.entries(data.totals).map(([k, v]) => (
                        <div key={k} className="ui-metric">
                            <div className="ui-metric-label">{k}</div>
                            <div className="ui-metric-value">
                                {typeof v === 'number' && TOTAL_MONEY_KEY.test(k)
                                    ? money(t, v)
                                    : String(v)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {!loading && data ? (
                <section className="ui-panel">
                    <div className="ui-panel-head">
                        <span className="ui-panel-title">{t('drill.rows', { n: rows.length })}</span>
                    </div>
                    <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    {columns.map((c) => (
                                        <th key={c.key}>{c.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pagedRows.map((r) => (
                                    <tr key={r.id}>
                                        {columns.map((c) => {
                                            const v = r[c.key];
                                            if (typeof v === 'number' && MONEY_KEY.test(c.key)) {
                                                return <td key={c.key}>{money(t, v)}</td>;
                                            }
                                            if (typeof v === 'number' && c.key === 'qty') {
                                                return (
                                                    <td key={c.key}>
                                                        {v.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                                    </td>
                                                );
                                            }
                                            return <td key={c.key}>{v ?? t('common.emDash')}</td>;
                                        })}
                                    </tr>
                                ))}
                                {!rows.length ? (
                                    <tr>
                                        <td colSpan={Math.max(columns.length, 1)}>{t('page.empty')}</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                        <UiPager {...pagerProps} />
                    </div>
                </section>
            ) : null}
        </div>
    );
}
