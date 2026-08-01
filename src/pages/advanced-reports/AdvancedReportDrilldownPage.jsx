import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { arT } from '../../utils/advancedReportsI18n';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import { getAdvancedReportDrilldown } from '../../services/advancedReportsApi';
import '../../styles/AdvancedReports.css';

function money(n) {
    return `SAR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Full-page transaction history for a clicked KPI / total.
 * @param {{ portal?: 'workshop'|'admin' }} props
 */
export default function AdvancedReportDrilldownPage({ portal = 'workshop' } = {}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const outletCtx = useOutletContext() || {};
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

    const query = useMemo(() => {
        const o = {};
        searchParams.forEach((v, k) => { o[k] = v; });
        return o;
    }, [searchParams]);

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
    }, [portal, query, t]);

    const backTo = portal === 'admin'
        ? '/admin/sales/advanced-reports'
        : '/workshop/advanced-reports';

    const columns = data?.columns || [];
    const rows = data?.rows || [];

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
        <div className="adv-reports" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="adv-reports__header">
                <div>
                    <h1 className="adv-reports__title">{t('page.drilldownTitle')}</h1>
                    <p className="adv-reports__subtitle">
                        {t('drill.metric')}: {query.metric || t('common.emDash')}
                        {data?.periodRange
                            ? ` · ${data.periodRange.from?.slice(0, 16)} → ${data.periodRange.to?.slice(0, 16)}`
                            : ''}
                    </p>
                </div>
                <div className="adv-reports__header-actions">
                    <div className="adv-reports__lang">
                        <button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => { setLocale('en'); try { localStorage.setItem(storageKey, 'en'); } catch { /* */ } }}>{t('page.en')}</button>
                        <button type="button" className={locale === 'ar' ? 'active' : ''} onClick={() => { setLocale('ar'); try { localStorage.setItem(storageKey, 'ar'); } catch { /* */ } }}>{t('page.ar')}</button>
                    </div>
                    <button type="button" className="adv-reports__btn adv-reports__btn--ghost" onClick={() => navigate(backTo)}>{t('page.back')}</button>
                    <button type="button" className="adv-reports__btn adv-reports__btn--ghost" disabled={!rows.length} onClick={() => exportRows('pdf')}>{t('page.exportPdf')}</button>
                    <button type="button" className="adv-reports__btn" disabled={!rows.length} onClick={() => exportRows('excel')}>{t('page.exportExcel')}</button>
                </div>
            </div>

            {err ? <div className="adv-reports__error">{err}</div> : null}
            {loading ? <p className="adv-reports__status">{t('common.loading')}</p> : null}

            {!loading && data?.totals ? (
                <div className="adv-reports__kpis">
                    {Object.entries(data.totals).map(([k, v]) => (
                        <div key={k} className="adv-kpi" style={{ cursor: 'default' }}>
                            <p className="adv-kpi__label">{k}</p>
                            <p className="adv-kpi__value">
                                {typeof v === 'number' && /amount|cogs|profit|price|total/i.test(k)
                                    ? money(v)
                                    : String(v)}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}

            {!loading && data ? (
                <div className="adv-reports__panel">
                    <h3>{t('drill.rows', { n: rows.length })}</h3>
                    <div className="adv-reports__table-wrap">
                        <table className="adv-reports__table">
                            <thead>
                                <tr>
                                    {columns.map((c) => (
                                        <th key={c.key}>{c.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id}>
                                        {columns.map((c) => {
                                            const v = r[c.key];
                                            const isMoney = /amount|cogs|profit|price|total|subtotal|vat/i.test(c.key);
                                            return (
                                                <td key={c.key}>
                                                    {typeof v === 'number' && isMoney ? money(v) : (v ?? t('common.emDash'))}
                                                </td>
                                            );
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
                    </div>
                </div>
            ) : null}
        </div>
    );
}
