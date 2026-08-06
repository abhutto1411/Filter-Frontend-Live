import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Percent, RefreshCw, Eye, FileText } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import WorkshopDiscountTimelineScreen from './WorkshopDiscountTimelineScreen';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import { branchScopeParams, getWorkshopDiscounts } from '../../services/workshopStaffApi';
import { getMyDepartments } from '../../services/workshopCatalogApi';
import { useAuth } from '../../context/AuthContext';
import { wdscT } from '../../utils/workshopDiscountsI18n';
import './Workshop.css';

function fmtDt(iso, locale) {
    if (!iso) return null;
    try {
        const loc = locale === 'ar' ? 'ar-SA' : undefined;
        return new Date(iso).toLocaleString(loc);
    } catch {
        return null;
    }
}

function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0.00';
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TIMELINE_KEYS = {
    line: 'timeline.line',
    invoice: 'timeline.invoice',
    promo: 'timeline.promo',
    total: 'timeline.total',
};

export default function WorkshopDiscounts({ selectedBranchId = 'all', branches = [], locale: localeProp }) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wdscT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const canView = hasPermission('workshop.reports.view');

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        lineDiscount: 0,
        invoiceDiscount: 0,
        promoDiscount: 0,
        totalDiscount: 0,
        invoiceCount: 0,
    });
    const [timeline, setTimeline] = useState({ line: [], invoice: [], promo: [], total: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [departmentId, setDepartmentId] = useState('all');
    const [departments, setDepartments] = useState([]);

    const [timelineOpen, setTimelineOpen] = useState(null);
    const [detail, setDetail] = useState(null);

    const branchParams = useMemo(
        () => branchScopeParams(selectedBranchId),
        [selectedBranchId],
    );

    const selectedBranchName = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return t('branch.all');
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || t('branch.withId', { id: selectedBranchId });
    }, [branches, selectedBranchId, t]);

    useEffect(() => {
        let cancelled = false;
        getMyDepartments()
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.departments) ? res.departments : [];
                setDepartments(
                    list.map((d) => ({
                        id: String(d.id),
                        name: d.name || d.department?.name || t('dept.fallback'),
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) setDepartments([]);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    const load = useCallback(async () => {
        if (!canView) {
            setRows([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await getWorkshopDiscounts({
                ...branchParams,
                departmentId: departmentId === 'all' ? undefined : departmentId,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                limit: 200,
                offset: 0,
            });
            setRows(Array.isArray(res?.invoices) ? res.invoices : []);
            setTotal(Number(res?.total) || 0);
            setSummary({
                lineDiscount: Number(res?.summary?.lineDiscount) || 0,
                invoiceDiscount: Number(res?.summary?.invoiceDiscount) || 0,
                promoDiscount: Number(res?.summary?.promoDiscount) || 0,
                totalDiscount: Number(res?.summary?.totalDiscount) || 0,
                invoiceCount: Number(res?.summary?.invoiceCount) || 0,
            });
            setTimeline({
                line: Array.isArray(res?.timeline?.line) ? res.timeline.line : [],
                invoice: Array.isArray(res?.timeline?.invoice) ? res.timeline.invoice : [],
                promo: Array.isArray(res?.timeline?.promo) ? res.timeline.promo : [],
                total: Array.isArray(res?.timeline?.total) ? res.timeline.total : [],
            });
        } catch (e) {
            setRows([]);
            setError(e.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [canView, branchParams, departmentId, dateFrom, dateTo, t]);

    useEffect(() => {
        load();
    }, [load]);

    const selectedDepartmentName = useMemo(() => {
        if (departmentId === 'all') return t('dept.all');
        return departments.find((d) => String(d.id) === String(departmentId))?.name || t('dept.fallback');
    }, [departmentId, departments, t]);

    const timelineRows = timelineOpen ? timeline[timelineOpen] || [] : [];

    const money = (n) => t('money.sar', { amount: fmtMoney(n) });
    const dash = t('emdash');

    if (!canView) {
        return (
            <div className="ws-section" style={{ padding: 24 }}>
                <p>{t('perm.denied')}</p>
            </div>
        );
    }

    if (timelineOpen) {
        return (
            <WorkshopDiscountTimelineScreen
                kind={timelineOpen}
                title={t(TIMELINE_KEYS[timelineOpen])}
                rows={timelineRows}
                branchName={selectedBranchName}
                departmentName={selectedDepartmentName}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onBack={() => setTimelineOpen(null)}
            />
        );
    }

    if (detail) {
        return (
            <WorkshopSubScreen
                title={t('detail.invoiceTitle', { no: detail.invoiceNo || detail.invoiceId })}
                onBack={() => setDetail(null)}
                size="wide"
            >
                {detail ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: 12,
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>{t('detail.date')}</div>
                                <div style={{ fontWeight: 700 }}>{fmtDt(detail.issuedAt || detail.invoiceDate, locale) || dash}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>{t('detail.branch')}</div>
                                <div style={{ fontWeight: 700 }}>{detail.branchName || dash}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>{t('detail.customer')}</div>
                                <div style={{ fontWeight: 700 }}>{detail.customerName || dash}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>{t('detail.cashier')}</div>
                                <div style={{ fontWeight: 700 }}>{detail.cashierName || dash}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>{t('detail.invoiceTotal')}</div>
                                <div style={{ fontWeight: 900 }}>{money(detail.invoiceTotal)}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <div className="ws-sr-kpi">
                                <div className="ws-sr-kpi-label">{t('detail.lineDiscount')}</div>
                                <div className="ws-sr-kpi-value">{money(detail.lineDiscount)}</div>
                            </div>
                            <div className="ws-sr-kpi">
                                <div className="ws-sr-kpi-label">{t('detail.invoiceDiscount')}</div>
                                <div className="ws-sr-kpi-value">{money(detail.invoiceDiscount)}</div>
                            </div>
                            <div className="ws-sr-kpi">
                                <div className="ws-sr-kpi-label">{t('detail.promoCode')}</div>
                                <div className="ws-sr-kpi-value">{money(detail.promoDiscount)}</div>
                            </div>
                            <div className="ws-sr-kpi">
                                <div className="ws-sr-kpi-label">{t('detail.totalDiscount')}</div>
                                <div className="ws-sr-kpi-value">{money(detail.totalDiscount)}</div>
                            </div>
                        </div>

                        {(detail.lineDetails?.length ?? 0) > 0 ? (
                            <div>
                                <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>{t('detail.lineSection')}</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                                            <th style={{ padding: '8px 12px' }}>{t('detail.th.item')}</th>
                                            <th style={{ padding: '8px 12px' }}>{t('detail.th.department')}</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('detail.th.discount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.lineDetails.map((ld, idx) => (
                                            <tr key={idx} style={{ borderTop: '1px solid #E5E7EB' }}>
                                                <td style={{ padding: '8px 12px' }}>{ld.name}</td>
                                                <td style={{ padding: '8px 12px' }}>{ld.departmentName || dash}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                                                    {money(ld.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}

                        {(detail.jobDetails?.length ?? 0) > 0 ? (
                            <div>
                                <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>{t('detail.jobSection')}</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                                            <th style={{ padding: '8px 12px' }}>{t('detail.th.department')}</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('detail.th.jobDiscount')}</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('detail.th.promo')}</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('detail.th.total')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.jobDetails.map((jd, idx) => (
                                            <tr key={idx} style={{ borderTop: '1px solid #E5E7EB' }}>
                                                <td style={{ padding: '8px 12px' }}>{jd.departmentName || dash}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                    {money(jd.jobDiscount)}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                    {money(jd.promoDiscount)}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                                                    {money(jd.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </WorkshopSubScreen>
        );
    }

    return (
        <div>
            <style>{`
              .ws-sr-kpi {
                background: #fff;
                border: 1px solid var(--color-border-light, #E5E7EB);
                border-radius: 10px;
                padding: 10px 14px;
                min-width: 140px;
              }
              .ws-sr-kpi-label {
                font-size: 0.68rem;
                font-weight: 800;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: #64748b;
              }
              .ws-sr-kpi-value {
                margin-top: 4px;
                font-size: 1.05rem;
                font-weight: 900;
                color: #111827;
              }
              .ws-sr-kpi-clickable {
                cursor: pointer;
                transition: border-color 0.15s, box-shadow 0.15s;
              }
              .ws-sr-kpi-clickable:hover {
                border-color: #FCC247;
                box-shadow: 0 0 0 1px #FCC24733;
              }
              .ws-sr-row:hover {
                background: #FFFBEB;
              }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 320px' }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: '#FFF7ED',
                            border: '1px solid #FED7AA',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Percent size={18} color="#9A3412" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#111827' }}>{t('page.title')}</h1>
                        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                            {t('page.subtitle', { branch: selectedBranchName })}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div className="ws-sr-kpi" title={t('kpi.discountedInvoicesTitle')}>
                        <div className="ws-sr-kpi-label">{t('kpi.discountedInvoices')}</div>
                        <div className="ws-sr-kpi-value">{loading ? dash : summary.invoiceCount}</div>
                    </div>
                    <button
                        type="button"
                        className="ws-sr-kpi ws-sr-kpi-clickable"
                        onClick={() => setTimelineOpen('line')}
                        title={t('kpi.lineTitle')}
                    >
                        <div className="ws-sr-kpi-label">{t('kpi.line')}</div>
                        <div className="ws-sr-kpi-value">{loading ? t('money.sarDash') : money(summary.lineDiscount)}</div>
                    </button>
                    <button
                        type="button"
                        className="ws-sr-kpi ws-sr-kpi-clickable"
                        onClick={() => setTimelineOpen('invoice')}
                        title={t('kpi.invoiceTitle')}
                    >
                        <div className="ws-sr-kpi-label">{t('kpi.invoice')}</div>
                        <div className="ws-sr-kpi-value">{loading ? t('money.sarDash') : money(summary.invoiceDiscount)}</div>
                    </button>
                    <button
                        type="button"
                        className="ws-sr-kpi ws-sr-kpi-clickable"
                        onClick={() => setTimelineOpen('promo')}
                        title={t('kpi.promoTitle')}
                    >
                        <div className="ws-sr-kpi-label">{t('kpi.promo')}</div>
                        <div className="ws-sr-kpi-value">{loading ? t('money.sarDash') : money(summary.promoDiscount)}</div>
                    </button>
                    <button
                        type="button"
                        className="ws-sr-kpi ws-sr-kpi-clickable"
                        onClick={() => setTimelineOpen('total')}
                        title={t('kpi.totalTitle')}
                    >
                        <div className="ws-sr-kpi-label">{t('kpi.total')}</div>
                        <div className="ws-sr-kpi-value">{loading ? t('money.sarDash') : money(summary.totalDiscount)}</div>
                    </button>
                    <button
                        type="button"
                        className="mc-btn-ghost"
                        onClick={load}
                        disabled={loading}
                        style={{ height: 40, alignSelf: 'stretch' }}
                    >
                        <RefreshCw size={16} style={{ opacity: loading ? 0.5 : 1 }} /> {t('btn.refresh')}
                    </button>
                </div>
            </div>

            <div className="ws-section" style={{ marginBottom: 18 }}>
                <div style={{ padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12, alignItems: 'end' }}>
                        <div style={{ gridColumn: 'span 3', minWidth: 200 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                                {t('filter.from')}
                            </label>
                            <input
                                type="datetime-local"
                                className="mc-filter-select"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 3', minWidth: 200 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                                {t('filter.to')}
                            </label>
                            <input
                                type="datetime-local"
                                className="mc-filter-select"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 4', minWidth: 200 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                                {t('filter.department')}
                            </label>
                            <select
                                className="mc-filter-select"
                                value={departmentId}
                                onChange={(e) => setDepartmentId(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="all">{t('dept.all')}</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 2', minWidth: 120, display: 'flex' }}>
                            <button
                                type="button"
                                className="mc-btn-primary"
                                onClick={load}
                                disabled={loading}
                                style={{ width: '100%', height: 40 }}
                            >
                                {loading ? t('btn.loading') : t('btn.apply')}
                            </button>
                        </div>
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                        {t('filter.branchHint', { branch: selectedBranchName })}
                    </p>
                </div>
            </div>

            {error ? <p style={{ color: '#B91C1C', marginBottom: 16 }}>{error}</p> : null}

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px' }}>{t('th.dateTime')}</th>
                            <th style={{ padding: '12px 16px' }}>{t('th.invoiceNo')}</th>
                            <th style={{ padding: '12px 16px' }}>{t('th.customer')}</th>
                            <th style={{ padding: '12px 16px' }}>{t('th.vehicle')}</th>
                            <th style={{ padding: '12px 16px' }}>{t('th.cashier')}</th>
                            <th style={{ padding: '12px 16px' }}>{t('th.branch')}</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('th.lineDiscount')}</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('th.invoiceDiscount')}</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('th.promoCode')}</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('th.totalDiscount')}</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('th.invoiceTotal')}</th>
                            <th style={{ padding: '12px 16px' }} />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <ShimmerTableBodyRows cols={12} rows={8} />
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={12} style={{ padding: 44, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                        <div
                                            style={{
                                                width: 54,
                                                height: 54,
                                                borderRadius: 16,
                                                background: '#F9FAFB',
                                                border: '1px solid #E5E7EB',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <FileText size={22} color="#64748b" />
                                        </div>
                                        <div style={{ fontWeight: 800, color: '#111827' }}>{t('empty.title')}</div>
                                        <div style={{ fontSize: '0.85rem' }}>{t('empty.hint')}</div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.invoiceId} className="ws-sr-row" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{fmtDt(r.issuedAt || r.invoiceDate, locale) || dash}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.invoiceNo}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div>{r.customerName || dash}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.customerPhone || ''}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>{r.vehicleNumber || dash}</td>
                                    <td style={{ padding: '12px 16px' }}>{r.cashierName || dash}</td>
                                    <td style={{ padding: '12px 16px' }}>{r.branchName || dash}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{money(r.lineDiscount)}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{money(r.invoiceDiscount)}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{money(r.promoDiscount)}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900 }}>{money(r.totalDiscount)}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{money(r.invoiceTotal)}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <button
                                            type="button"
                                            className="mc-btn-ghost"
                                            style={{ padding: '6px 10px' }}
                                            onClick={() => setDetail(r)}
                                        >
                                            <Eye size={14} /> {t('btn.view')}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!loading && total > rows.length ? (
                <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {t('footer.showing', { shown: rows.length, total })}
                </p>
            ) : null}
        </div>
    );
}
