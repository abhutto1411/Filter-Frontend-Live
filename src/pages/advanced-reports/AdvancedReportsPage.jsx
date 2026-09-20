import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { arT } from '../../utils/advancedReportsI18n';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import {
    advancedReportsParams,
    getAdvancedReport,
    getAdvancedReportFilterOptions,
} from '../../services/advancedReportsApi';
import { getWorkshopOptions } from '../../services/superAdminApi';
import AdvancedReportsFilters from './AdvancedReportsFilters';
import '../../styles/AdvancedReports.css';

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toDatetimeLocalValue(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultPeriods() {
    const end = new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(-1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);
    prevStart.setHours(0, 0, 0, 0);
    return {
        mainFrom: toDatetimeLocalValue(start),
        mainTo: toDatetimeLocalValue(end),
        prevFrom: toDatetimeLocalValue(prevStart),
        prevTo: toDatetimeLocalValue(prevEnd),
    };
}

function localToIso(local) {
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date/time');
    return d.toISOString();
}

function money(t, n) {
    return t('common.sar', { n: Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
}

function ClickableKpi({ label, value, tone, onClick, hint }) {
    return (
        <button type="button" className={`adv-kpi${tone ? ` adv-kpi--${tone}` : ''}`} onClick={onClick}>
            <p className="adv-kpi__label">{label}</p>
            <p className="adv-kpi__value">{value}</p>
            {hint ? <p className="adv-kpi__hint">{hint}</p> : null}
        </button>
    );
}

function Num({ children, onClick }) {
    if (!onClick) return <span>{children}</span>;
    return (
        <button type="button" className="adv-num-link" onClick={onClick}>
            {children}
        </button>
    );
}

/**
 * @param {{ portal?: 'workshop'|'admin', selectedBranchId?: string|number }} props
 */
export default function AdvancedReportsPage({ portal = 'workshop', selectedBranchId } = {}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const outletCtx = useOutletContext() || {};
    const { hasPermission } = useAuth();

    const storageKey = portal === 'admin' ? 'portal-locale' : 'workshop-advanced-reports-locale';
    const [locale, setLocale] = useState(() => {
        if (portal === 'admin' && outletCtx.locale) return outletCtx.locale;
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(storageKey) || (portal === 'admin' ? (localStorage.getItem('portal-locale') || 'en') : 'en');
        }
        return 'en';
    });

    useEffect(() => {
        if (portal === 'admin' && outletCtx.locale) setLocale(outletCtx.locale);
    }, [portal, outletCtx.locale]);

    const t = useCallback((key, vars) => arT(locale, key, vars), [locale]);

    const canView = portal === 'admin'
        ? (hasPermission('sales.advanced-reports.view') || hasPermission('sales.sales-reports.view'))
        : (hasPermission('workshop.reports.advanced.view') || hasPermission('workshop.reports.view'));

    const defaults = useMemo(() => defaultPeriods(), []);
    const [filters, setFilters] = useState(() => {
        const itemTypesRaw = String(searchParams.get('itemTypes') || '').toLowerCase();
        const parts = itemTypesRaw.split(/[,+\s]+/).filter(Boolean);
        const hasParts = parts.length > 0;
        return {
            ...defaults,
            workshopId: searchParams.get('workshopId') || '',
            branchId: selectedBranchId && selectedBranchId !== 'all'
                ? String(selectedBranchId)
                : (searchParams.get('branchId') || 'all'),
            categoryId: searchParams.get('categoryId') || 'all',
            reportType: searchParams.get('reportType') || 'sales_comparison',
            departmentId: searchParams.get('departmentId') || 'all',
            compareDepartmentId: searchParams.get('compareDepartmentId') || 'all',
            includeProducts: hasParts
                ? parts.some((p) => p === 'product' || p === 'products')
                : true,
            includeServices: hasParts
                ? parts.some((p) => p === 'service' || p === 'services')
                : true,
        };
    });

    const [workshops, setWorkshops] = useState([]);
    const [filterOptions, setFilterOptions] = useState({
        branches: [],
        categories: [],
        departments: [],
        comparisonReportTypes: [],
    });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const switchLocale = (next) => {
        setLocale(next);
        try { localStorage.setItem(storageKey, next); } catch { /* ignore */ }
    };

    const isComparisonReport = useCallback(
        (reportType) => reportType === 'sales_comparison' || reportType === 'branch_comparison',
        [],
    );

    const buildApiParams = useCallback(() => {
        const comparison = isComparisonReport(filters.reportType);
        return advancedReportsParams({
            workshopId: portal === 'admin' ? filters.workshopId : undefined,
            branchId: filters.branchId,
            categoryId: filters.categoryId,
            mainFrom: localToIso(filters.mainFrom),
            mainTo: localToIso(filters.mainTo),
            ...(comparison
                ? {
                    prevFrom: localToIso(filters.prevFrom),
                    prevTo: localToIso(filters.prevTo),
                }
                : {}),
            reportType: filters.reportType,
            departmentId: filters.departmentId,
            compareDepartmentId: filters.compareDepartmentId,
            includeProducts: filters.includeProducts !== false,
            includeServices: filters.includeServices !== false,
        });
    }, [filters, isComparisonReport, portal]);

    const openDrilldown = useCallback((metric, extras = {}) => {
        const params = {
            ...buildApiParams(),
            metric,
            ...extras,
        };
        const sp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v != null && v !== '') sp.set(k, String(v));
        });
        const base = portal === 'admin'
            ? '/admin/sales/advanced-reports/drilldown'
            : '/workshop/advanced-reports/drilldown';
        navigate(`${base}?${sp.toString()}`);
    }, [buildApiParams, navigate, portal]);

    const loadFilterOptions = useCallback(async () => {
        if (portal === 'admin' && !filters.workshopId) {
            setFilterOptions({
                branches: [],
                categories: [],
                departments: [],
                comparisonReportTypes: [],
            });
            return;
        }
        try {
            const res = await getAdvancedReportFilterOptions(
                portal === 'admin' ? 'admin' : 'workshop',
                portal === 'admin' ? { workshopId: filters.workshopId } : {},
            );
            setFilterOptions({
                branches: res?.branches || [],
                categories: res?.categories || [],
                departments: res?.departments || [],
                comparisonReportTypes:
                    res?.comparisonReportTypes
                    || (res?.reportTypes || []).filter((r) =>
                        r.id === 'sales_comparison' || r.id === 'branch_comparison'),
            });
        } catch (e) {
            console.warn('[advanced-reports] filter options', e);
        }
    }, [filters.workshopId, portal]);

    const loadReport = useCallback(async () => {
        if (!canView) return;
        if (portal === 'admin' && !filters.workshopId) {
            setData(null);
            setErr('');
            return;
        }
        setLoading(true);
        setErr('');
        try {
            const res = await getAdvancedReport(
                portal === 'admin' ? 'admin' : 'workshop',
                buildApiParams(),
            );
            setData(res);
        } catch (e) {
            setErr(e?.message || t('page.error'));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [buildApiParams, canView, filters.workshopId, portal, t]);

    useEffect(() => {
        if (portal !== 'admin') return;
        (async () => {
            try {
                const res = await getWorkshopOptions();
                const list =
                    res?.workshops
                    || res?.options
                    || res?.data
                    || res
                    || [];
                setWorkshops(Array.isArray(list) ? list : []);
            } catch (e) {
                console.warn('[advanced-reports] workshops', e);
            }
        })();
    }, [portal]);

    useEffect(() => {
        void loadFilterOptions();
    }, [loadFilterOptions]);

    useEffect(() => {
        if (portal === 'workshop' || filters.workshopId) {
            void loadReport();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [portal]);

    const exportCurrent = (kind) => {
        if (!data) return;
        const headers = ['Field', 'Value'];
        const rows = [];
        const push = (k, v) => rows.push([k, String(v ?? '')]);
        if (data.summary) {
            Object.entries(data.summary).forEach(([k, v]) => {
                if (v && typeof v === 'object') push(k, v.name || JSON.stringify(v));
                else push(k, v);
            });
        }
        const title = t(`type.${filters.reportType}`);
        if (kind === 'pdf') exportRowsToPdf({ title, headers, rows, filenameBase: `advanced-report-${filters.reportType}` });
        else exportRowsToExcel({ sheetName: title, headers, rows, filenameBase: `advanced-report-${filters.reportType}` });
    };

    const hint = t('kpi.clickHint');
    const reportType = data?.reportType || filters.reportType;

    const COMPARISON_IDS = useMemo(
        () => ['sales_comparison', 'branch_comparison'],
        [],
    );

    const REPORT_TABS = useMemo(
        () => [
            { id: 'comparison', label: t('tab.comparison_reports') },
            { id: 'gross_margin', label: t('type.gross_margin') },
            { id: 'purchase_price_change', label: t('type.purchase_price_change') },
            { id: 'product_profitability', label: t('type.product_profitability') },
        ],
        [t],
    );

    const activeTabId = COMPARISON_IDS.includes(filters.reportType)
        ? 'comparison'
        : filters.reportType;

    const selectTab = (tabId) => {
        const nextType = tabId === 'comparison'
            ? (COMPARISON_IDS.includes(filters.reportType)
                ? filters.reportType
                : 'sales_comparison')
            : tabId;
        const next = { ...filters, reportType: nextType };
        setFilters(next);
        void (async () => {
            if (portal === 'admin' && !next.workshopId) return;
            setLoading(true);
            setErr('');
            try {
                const comparison = isComparisonReport(nextType);
                const params = advancedReportsParams({
                    workshopId: portal === 'admin' ? next.workshopId : undefined,
                    branchId: next.branchId,
                    categoryId: next.categoryId,
                    mainFrom: localToIso(next.mainFrom),
                    mainTo: localToIso(next.mainTo),
                    ...(comparison
                        ? {
                            prevFrom: localToIso(next.prevFrom),
                            prevTo: localToIso(next.prevTo),
                        }
                        : {}),
                    reportType: nextType,
                    departmentId: next.departmentId,
                    compareDepartmentId: next.compareDepartmentId,
                    includeProducts: next.includeProducts !== false,
                    includeServices: next.includeServices !== false,
                });
                const res = await getAdvancedReport(
                    portal === 'admin' ? 'admin' : 'workshop',
                    params,
                );
                setData(res);
            } catch (e) {
                setErr(e?.message || t('page.error'));
                setData(null);
            } finally {
                setLoading(false);
            }
        })();
    };

    if (!canView) {
        return (
            <div className="adv-reports" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <p className="adv-reports__status">{t('page.error')}</p>
            </div>
        );
    }

    return (
        <div className="adv-reports" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="adv-reports__header">
                <div>
                    <h1 className="adv-reports__title">{t('page.title')}</h1>
                    <p className="adv-reports__subtitle">{t('page.subtitle')}</p>
                </div>
                <div className="adv-reports__header-actions">
                    <div className="adv-reports__lang" aria-label={t('page.lang')}>
                        <button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => switchLocale('en')}>{t('page.en')}</button>
                        <button type="button" className={locale === 'ar' ? 'active' : ''} onClick={() => switchLocale('ar')}>{t('page.ar')}</button>
                    </div>
                    <button type="button" className="adv-reports__btn adv-reports__btn--ghost" disabled={!data || loading} onClick={() => exportCurrent('pdf')}>{t('page.exportPdf')}</button>
                    <button type="button" className="adv-reports__btn adv-reports__btn--ghost" disabled={!data || loading} onClick={() => exportCurrent('excel')}>{t('page.exportExcel')}</button>
                </div>
            </div>

            <div className="adv-reports__tabs" role="tablist" aria-label={t('page.title')}>
                {REPORT_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTabId === tab.id}
                        className={`adv-reports__tab${activeTabId === tab.id ? ' active' : ''}`}
                        onClick={() => selectTab(tab.id)}
                        disabled={loading}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <AdvancedReportsFilters
                t={t}
                portal={portal}
                showWorkshop={portal === 'admin'}
                workshops={workshops}
                branches={filterOptions.branches}
                categories={filterOptions.categories}
                departments={filterOptions.departments}
                comparisonReportTypes={filterOptions.comparisonReportTypes}
                values={filters}
                onChange={(next) => {
                    setFilters(next);
                    // Changing comparison report type via combo should reload
                    if (next.reportType !== filters.reportType) {
                        void (async () => {
                            if (portal === 'admin' && !next.workshopId) return;
                            setLoading(true);
                            setErr('');
                            try {
                                const comparison = isComparisonReport(next.reportType);
                                const params = advancedReportsParams({
                                    workshopId: portal === 'admin' ? next.workshopId : undefined,
                                    branchId: next.branchId,
                                    categoryId: next.categoryId,
                                    mainFrom: localToIso(next.mainFrom),
                                    mainTo: localToIso(next.mainTo),
                                    ...(comparison
                                        ? {
                                            prevFrom: localToIso(next.prevFrom),
                                            prevTo: localToIso(next.prevTo),
                                        }
                                        : {}),
                                    reportType: next.reportType,
                                    departmentId: next.departmentId,
                                    compareDepartmentId: next.compareDepartmentId,
                                    includeProducts: next.includeProducts !== false,
                                    includeServices: next.includeServices !== false,
                                });
                                const res = await getAdvancedReport(
                                    portal === 'admin' ? 'admin' : 'workshop',
                                    params,
                                );
                                setData(res);
                            } catch (e) {
                                setErr(e?.message || t('page.error'));
                                setData(null);
                            } finally {
                                setLoading(false);
                            }
                        })();
                    }
                }}
                onApply={() => { void loadFilterOptions(); void loadReport(); }}
                loading={loading}
                showComparisonReportType={activeTabId === 'comparison'}
                showPreviousPeriod={activeTabId === 'comparison'}
                showItemTypes={filters.reportType !== 'purchase_price_change'}
            />

            {portal === 'admin' && !filters.workshopId ? (
                <p className="adv-reports__status">{t('page.selectWorkshop')}</p>
            ) : null}

            {err ? <div className="adv-reports__error">{err}</div> : null}
            {loading ? <p className="adv-reports__status">{t('page.loading')}</p> : null}

            {!loading && data && reportType === 'sales_comparison' ? (
                <>
                    <div className="adv-reports__kpis">
                        <ClickableKpi label={t('kpi.currentRevenue')} value={money(t, data.summary?.currentPeriodRevenue)} hint={hint} onClick={() => openDrilldown('current_revenue', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.previousRevenue')} value={money(t, data.summary?.previousPeriodRevenue)} hint={hint} onClick={() => openDrilldown('previous_revenue', { period: 'previous' })} />
                        <ClickableKpi
                            label={t('kpi.growthAmount')}
                            value={money(t, data.summary?.growthAmount)}
                            tone={(data.summary?.growthAmount || 0) >= 0 ? 'good' : 'bad'}
                            hint={hint}
                            onClick={() => openDrilldown('growth_amount', { period: 'main' })}
                        />
                        <ClickableKpi
                            label={t('kpi.growthPercent')}
                            value={`${Number(data.summary?.growthPercent || 0).toFixed(2)}%`}
                            tone={(data.summary?.growthPercent || 0) >= 0 ? 'good' : 'bad'}
                            hint={hint}
                            onClick={() => openDrilldown('growth_percent', { period: 'main' })}
                        />
                    </div>

                    <div className="adv-reports__panel">
                        <h3>{t('chart.revenueTrend')}</h3>
                        <div className="adv-reports__chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={mergeTrend(data.charts?.revenueTrend)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="main" name={t('chart.main')} stroke="#0b3d5c" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="previous" name={t('chart.previous')} stroke="#94a3b8" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="adv-reports__panel">
                        <h3>{t('table.comparison')}</h3>
                        <div className="adv-reports__table-wrap">
                            <table className="adv-reports__table">
                                <thead>
                                    <tr>
                                        <th>{t('table.label')}</th>
                                        <th>{t('table.invoices')}</th>
                                        <th>{t('table.revenue')}</th>
                                        <th>{t('table.avgTicket')}</th>
                                        <th>{t('table.growth')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.comparisonTable || []).map((row) => (
                                        <tr key={row.label}>
                                            <td>{row.label}</td>
                                            <td>
                                                <Num onClick={() => openDrilldown('current_invoices', { period: 'main' })}>{row.currentInvoices}</Num>
                                                {' / '}
                                                <Num onClick={() => openDrilldown('previous_invoices', { period: 'previous' })}>{row.previousInvoices}</Num>
                                            </td>
                                            <td>
                                                <Num onClick={() => openDrilldown('current_revenue', { period: 'main' })}>{money(t, row.currentRevenue)}</Num>
                                                {' / '}
                                                <Num onClick={() => openDrilldown('previous_revenue', { period: 'previous' })}>{money(t, row.previousRevenue)}</Num>
                                            </td>
                                            <td>{money(t, row.currentAvgTicket)} / {money(t, row.previousAvgTicket)}</td>
                                            <td>
                                                <Num onClick={() => openDrilldown('growth_percent', { period: 'main' })}>{Number(row.growthPercent || 0).toFixed(2)}%</Num>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="adv-reports__panel">
                        <h3>{t('table.departments')}</h3>
                        <div className="adv-reports__table-wrap">
                            <table className="adv-reports__table">
                                <thead>
                                    <tr>
                                        <th>{t('table.department')}</th>
                                        <th>{t('table.current')}</th>
                                        <th>{t('table.previous')}</th>
                                        <th>{t('table.growth')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.departmentRows || []).map((row) => (
                                        <tr key={row.id}>
                                            <td>{row.name}</td>
                                            <td>
                                                <Num onClick={() => openDrilldown('department_revenue', { period: 'main', departmentId: row.id, entityType: 'department', entityId: row.id })}>
                                                    {money(t, row.currentRevenue)}
                                                </Num>
                                            </td>
                                            <td>
                                                <Num onClick={() => openDrilldown('department_revenue', { period: 'previous', departmentId: row.id, entityType: 'department', entityId: row.id })}>
                                                    {money(t, row.previousRevenue)}
                                                </Num>
                                            </td>
                                            <td>{Number(row.growthPercent || 0).toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                    {!data.departmentRows?.length ? (
                                        <tr><td colSpan={4}>{t('page.empty')}</td></tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}

            {!loading && data && reportType === 'gross_margin' ? (
                <>
                    <div className="adv-reports__kpis">
                        <ClickableKpi label={t('kpi.totalSales')} value={money(t, data.summary?.totalSales)} hint={hint} onClick={() => openDrilldown('total_sales', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.totalCogs')} value={money(t, data.summary?.totalCogs)} hint={hint} onClick={() => openDrilldown('total_cogs', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.grossProfit')} value={money(t, data.summary?.grossProfit)} hint={hint} tone="good" onClick={() => openDrilldown('gross_profit', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.grossMarginPercent')} value={`${Number(data.summary?.grossMarginPercent || 0).toFixed(2)}%`} hint={hint} onClick={() => openDrilldown('gross_margin_percent', { period: 'main' })} />
                    </div>
                    <div className="adv-reports__panel">
                        <h3>{t('chart.marginByCategory')}</h3>
                        <div className="adv-reports__chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.charts?.marginByCategory || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" hide={(data.charts?.marginByCategory || []).length > 8} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="marginPercent" name={t('table.margin')} fill="#0b3d5c" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <MarginTable
                        t={t}
                        title={t('table.categories')}
                        rows={data.categoryRows}
                        money={money}
                        showQty
                        onNum={(metric, row) => openDrilldown(metric, { period: 'main', entityType: 'category', entityId: row.id, categoryId: row.id })}
                    />
                    <MarginTable
                        t={t}
                        title={t('table.products')}
                        rows={data.productRows}
                        money={money}
                        showQty
                        showUnitPricing
                        onNum={(metric, row) => openDrilldown(metric, { period: 'main', entityType: row.kind, entityId: row.id })}
                    />
                </>
            ) : null}

            {!loading && data && reportType === 'purchase_price_change' ? (
                <>
                    <div className="adv-reports__kpis">
                        <ClickableKpi label={t('kpi.productsChanged')} value={String(data.summary?.productsWithPriceChange ?? 0)} hint={hint} onClick={() => openDrilldown('price_products_changed', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.avgIncrease')} value={`${Number(data.summary?.averagePriceIncreasePercent || 0).toFixed(2)}%`} hint={hint} onClick={() => openDrilldown('price_avg_increase', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.highestIncrease')} value={`${Number(data.summary?.highestIncreasePercent || 0).toFixed(2)}%`} hint={hint} onClick={() => openDrilldown('price_highest_increase', { period: 'main' })} />
                    </div>
                    <div className="adv-reports__panel">
                        <h3>{t('chart.priceTrend')}{data.charts?.trendProductName ? ` — ${data.charts.trendProductName}` : ''}</h3>
                        <div className="adv-reports__chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.charts?.priceTrend || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="price" stroke="#0b3d5c" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="adv-reports__panel">
                        <h3>{t('table.priceChanges')}</h3>
                        <div className="adv-reports__table-wrap">
                            <table className="adv-reports__table">
                                <thead>
                                    <tr>
                                        <th>{t('table.product')}</th>
                                        <th>{t('table.supplier')}</th>
                                        <th>{t('table.oldPriceInclVat')}</th>
                                        <th>{t('table.newPriceInclVat')}</th>
                                        <th>{t('table.priceDifference')}</th>
                                        <th>{t('table.changePct')}</th>
                                        <th>{t('table.changeDate')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.rows || []).map((row, idx) => {
                                        const diff = row.priceDifference != null
                                            ? Number(row.priceDifference)
                                            : Number(row.newPrice || 0) - Number(row.oldPrice || 0);
                                        return (
                                        <tr key={`${row.productId}-${row.changeDate}-${idx}`}>
                                            <td>
                                                <Num onClick={() => openDrilldown('price_product', { period: 'main', productId: row.productId, entityId: row.productId, entityType: 'product' })}>
                                                    {row.productName}
                                                </Num>
                                            </td>
                                            <td>{row.supplierName}</td>
                                            <td>{money(t, row.oldPrice)}</td>
                                            <td>
                                                <Num onClick={() => openDrilldown('price_product', { period: 'main', productId: row.productId, entityId: row.productId })}>
                                                    {money(t, row.newPrice)}
                                                </Num>
                                            </td>
                                            <td>{money(t, diff)}</td>
                                            <td>{Number(row.changePercent || 0).toFixed(2)}%</td>
                                            <td>{row.changeDate}</td>
                                        </tr>
                                        );
                                    })}
                                    {!data.rows?.length ? <tr><td colSpan={7}>{t('page.empty')}</td></tr> : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}

            {!loading && data && reportType === 'product_profitability' ? (
                <>
                    <div className="adv-reports__summary-grid" style={{ marginBottom: '1.1rem' }}>
                        {[
                            ['summary.bestProfit', data.summary?.bestByProfit],
                            ['summary.worstProfit', data.summary?.worstByProfit],
                            ['summary.bestMargin', data.summary?.bestByMargin],
                            ['summary.worstMargin', data.summary?.worstByMargin],
                            ['summary.mostProduct', data.summary?.mostSellingProduct],
                            ['summary.mostService', data.summary?.mostSellingService],
                            ['summary.worstProduct', data.summary?.worstSellingProduct],
                            ['summary.worstService', data.summary?.worstSellingService],
                        ].map(([key, item]) => (
                            <button
                                key={key}
                                type="button"
                                className="adv-summary-card"
                                onClick={() => item && openDrilldown('product_sales', {
                                    period: 'main',
                                    entityType: item.kind,
                                    entityId: item.id,
                                })}
                                style={{ cursor: item ? 'pointer' : 'default', textAlign: 'inherit' }}
                            >
                                <h4>{t(key)}</h4>
                                <p>{item?.name || t('common.emDash')}</p>
                                <p style={{ marginTop: 4, color: '#64748b', fontWeight: 600 }}>
                                    {item ? `${money(t, item.grossProfit)} · ${Number(item.marginPercent || 0).toFixed(1)}%` : ''}
                                </p>
                            </button>
                        ))}
                    </div>
                    <div className="adv-reports__panel">
                        <h3>{t('chart.topProfit')}</h3>
                        <div className="adv-reports__chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.charts?.topProfit || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" hide />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="grossProfit" name={t('table.profit')} fill="#047857" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <MarginTable t={t} title={t('table.rankProfit')} rows={data.rankingByGrossProfit} money={money} onNum={(metric, row) => openDrilldown(metric, { period: 'main', entityType: row.kind, entityId: row.id })} />
                    <MarginTable t={t} title={t('table.rankMargin')} rows={data.rankingByMargin} money={money} onNum={(metric, row) => openDrilldown(metric, { period: 'main', entityType: row.kind, entityId: row.id })} />
                </>
            ) : null}

            {!loading && data && reportType === 'branch_comparison' ? (
                <>
                    <div className="adv-reports__kpis">
                        <ClickableKpi label={t('kpi.branchCount')} value={String(data.summary?.branchCount ?? 0)} hint={hint} onClick={() => openDrilldown('branch_all', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.currentRevenue')} value={money(t, data.summary?.totalCurrentRevenue)} hint={hint} onClick={() => openDrilldown('current_revenue', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.previousRevenue')} value={money(t, data.summary?.totalPreviousRevenue)} hint={hint} onClick={() => openDrilldown('previous_revenue', { period: 'previous' })} />
                        <ClickableKpi
                            label={t('kpi.topBranch')}
                            value={data.summary?.topBranch ? money(t, data.summary.topBranch.currentRevenue) : t('common.emDash')}
                            hint={data.summary?.topBranch?.name || hint}
                            onClick={() => data.summary?.topBranch && openDrilldown('branch_revenue', {
                                period: 'main',
                                entityType: 'branch',
                                entityId: data.summary.topBranch.id,
                            })}
                        />
                    </div>
                    <div className="adv-reports__panel">
                        <h3>{t('chart.branchRevenue')}</h3>
                        <div className="adv-reports__chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.charts?.branchRevenue || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="current" name={t('chart.main')} fill="#0b3d5c" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="previous" name={t('chart.previous')} fill="#94a3b8" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="adv-reports__panel">
                        <h3>{t('table.branches')}</h3>
                        <div className="adv-reports__table-wrap">
                            <table className="adv-reports__table">
                                <thead>
                                    <tr>
                                        <th>{t('table.branch')}</th>
                                        <th>{t('table.current')}</th>
                                        <th>{t('table.previous')}</th>
                                        <th>{t('table.growth')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.rows || []).map((row) => (
                                        <tr key={row.id}>
                                            <td>{row.name}</td>
                                            <td>
                                                <Num onClick={() => openDrilldown('branch_revenue', { period: 'main', entityType: 'branch', entityId: row.id })}>
                                                    {money(t, row.currentRevenue)}
                                                </Num>
                                            </td>
                                            <td>
                                                <Num onClick={() => openDrilldown('branch_revenue', { period: 'previous', entityType: 'branch', entityId: row.id })}>
                                                    {money(t, row.previousRevenue)}
                                                </Num>
                                            </td>
                                            <td>
                                                <Num onClick={() => openDrilldown('growth_percent', { period: 'main', entityType: 'branch', entityId: row.id })}>
                                                    {Number(row.growthPercent || 0).toFixed(2)}%
                                                </Num>
                                            </td>
                                        </tr>
                                    ))}
                                    {!data.rows?.length ? <tr><td colSpan={4}>{t('page.empty')}</td></tr> : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function mergeTrend(trend) {
    const main = trend?.main || [];
    const previous = trend?.previous || [];
    const map = new Map();
    main.forEach((r, i) => {
        map.set(`m-${r.date}-${i}`, { date: r.date, main: r.revenue, previous: null });
    });
    previous.forEach((r, i) => {
        const key = `p-${r.date}-${i}`;
        const existing = [...map.values()].find((x) => x.date === r.date && x.previous == null);
        if (existing) existing.previous = r.revenue;
        else map.set(key, { date: r.date, main: null, previous: r.revenue });
    });
    // Align by index for unequal calendar ranges (side-by-side trend)
    const len = Math.max(main.length, previous.length);
    const rows = [];
    for (let i = 0; i < len; i++) {
        rows.push({
            date: main[i]?.date || previous[i]?.date || String(i + 1),
            main: main[i]?.revenue ?? null,
            previous: previous[i]?.revenue ?? null,
        });
    }
    return rows;
}

function MarginTable({ t, title, rows, money, onNum, showQty = false, showUnitPricing = false }) {
    const colSpan = 6 + (showQty ? 1 : 0) + (showUnitPricing ? 2 : 0);
    const list = rows || [];
    const totals = list.reduce(
        (acc, row) => {
            acc.qty += Number(row.qty || 0);
            acc.sales += Number(row.sales || 0);
            acc.cogs += Number(row.cogs || 0);
            acc.grossProfit += Number(row.grossProfit || 0);
            return acc;
        },
        { qty: 0, sales: 0, cogs: 0, grossProfit: 0 },
    );
    const marginPercent = totals.sales
        ? Math.round((totals.grossProfit / totals.sales) * 10000) / 100
        : 0;

    return (
        <div className="adv-reports__panel">
            <h3>{title}</h3>
            <div className="adv-reports__table-wrap">
                <table className="adv-reports__table">
                    <thead>
                        <tr>
                            <th>{t('table.name')}</th>
                            <th>{t('table.kind')}</th>
                            {showQty ? <th>{t('table.qty')}</th> : null}
                            {showUnitPricing ? <th>{t('table.unitPurchasePrice')}</th> : null}
                            {showUnitPricing ? <th>{t('table.unitSalesPrice')}</th> : null}
                            <th>{t('table.sales')}</th>
                            <th>{t('table.cogs')}</th>
                            <th>{t('table.profit')}</th>
                            <th>{t('table.margin')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((row) => (
                            <tr key={`${row.kind}-${row.id}`}>
                                <td>
                                    <Num onClick={() => onNum?.('product_sales', row)}>{row.name}</Num>
                                </td>
                                <td>{row.kind}</td>
                                {showQty ? (
                                    <td>{Number(row.qty || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                                ) : null}
                                {showUnitPricing ? (
                                    <td>
                                        {row.unitPurchasePrice != null
                                            ? money(t, row.unitPurchasePrice)
                                            : t('common.emDash')}
                                    </td>
                                ) : null}
                                {showUnitPricing ? (
                                    <td>
                                        {row.unitSalesPrice != null
                                            ? money(t, row.unitSalesPrice)
                                            : t('common.emDash')}
                                    </td>
                                ) : null}
                                <td><Num onClick={() => onNum?.('product_sales', row)}>{money(t, row.sales)}</Num></td>
                                <td><Num onClick={() => onNum?.('product_cogs', row)}>{money(t, row.cogs)}</Num></td>
                                <td><Num onClick={() => onNum?.('product_profit', row)}>{money(t, row.grossProfit)}</Num></td>
                                <td><Num onClick={() => onNum?.('product_margin', row)}>{Number(row.marginPercent || 0).toFixed(2)}%</Num></td>
                            </tr>
                        ))}
                        {!list.length ? <tr><td colSpan={colSpan}>{t('page.empty')}</td></tr> : null}
                    </tbody>
                    {list.length ? (
                        <tfoot>
                            <tr className="adv-reports__total-row">
                                <td>{t('table.total')}</td>
                                <td>{t('common.emDash')}</td>
                                {showQty ? (
                                    <td>{totals.qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                                ) : null}
                                {showUnitPricing ? <td>{t('common.emDash')}</td> : null}
                                {showUnitPricing ? <td>{t('common.emDash')}</td> : null}
                                <td>{money(t, totals.sales)}</td>
                                <td>{money(t, totals.cogs)}</td>
                                <td>{money(t, totals.grossProfit)}</td>
                                <td>{marginPercent.toFixed(2)}%</td>
                            </tr>
                        </tfoot>
                    ) : null}
                </table>
            </div>
        </div>
    );
}
