import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Building2 } from 'lucide-react';
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
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

/**
 * Recharts takes literal colour strings, not CSS variables, so the series
 * colours are the ui.css token values written out: info, neutral-400, ok.
 */
const CHART = { main: '#175cd3', prev: '#98a2b3', profit: '#067647' };

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

function pct(n) {
    return `${Number(n || 0).toFixed(2)}%`;
}

/** A KPI tile that is also the way into the lines behind its figure. */
function ClickableKpi({ label, value, tone, onClick, hint }) {
    return (
        <button
            type="button"
            className={`ui-metric${tone ? ` ui-metric--${tone}` : ''}`}
            onClick={onClick}
            disabled={!onClick}
        >
            <div className="ui-metric-label">{label}</div>
            <div className="ui-metric-value">{value}</div>
            {hint ? <div className="ui-metric-foot">{hint}</div> : null}
        </button>
    );
}

/** A figure in a cell that opens its own transaction list. */
function Num({ children, onClick }) {
    if (!onClick) return <span>{children}</span>;
    return (
        <button type="button" className="ui-link" onClick={onClick}>
            {children}
        </button>
    );
}

/** Panel chrome shared by every chart and table block on the screen. */
function Block({ title, children }) {
    return (
        <section className="ui-panel">
            <div className="ui-panel-head">
                <span className="ui-panel-title">{title}</span>
            </div>
            {children}
        </section>
    );
}

function Chart({ title, children }) {
    return (
        <Block title={title}>
            <div className="ui-panel-pad">
                <div className="ui-chart">
                    <ResponsiveContainer width="100%" height="100%">
                        {children}
                    </ResponsiveContainer>
                </div>
            </div>
        </Block>
    );
}

/**
 * While a report is in flight the screen shows the shape it is about to
 * fill — four figures, a chart and a list — rather than the word "loading".
 */
function ReportSkeleton() {
    return (
        <div className="ui-stack" aria-busy="true">
            <div className="ui-kpis">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`sk-kpi-${i}`} className="ui-metric ui-stack-sm">
                        <div className="ui-sk ui-sk--label ui-sk--w55" />
                        <div className="ui-sk ui-sk--title ui-sk--w90" />
                    </div>
                ))}
            </div>
            <section className="ui-panel">
                <div className="ui-panel-head">
                    <span className="ui-panel-title">
                        <span className="ui-sk ui-sk--strong ui-sk--w40" />
                    </span>
                </div>
                <div className="ui-panel-pad">
                    <div className="ui-sk ui-chart" />
                </div>
            </section>
            <section className="ui-panel">
                <div className="ui-panel-pad ui-stack-sm">
                    {Array.from({ length: 6 }).map((_, i) => (
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
 * @param {{ portal?: 'workshop'|'admin', selectedBranchId?: string|number }} props
 */
export default function AdvancedReportsPage({ portal = 'workshop', selectedBranchId } = {}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const outletCtx = useOutletContext() || {};
    const { hasPermission } = useAuth();

    // The workshop portal renders this page as a direct child, so there is no
    // outlet context and no layout language switch: it keeps its own key and
    // its own control. The admin layout owns both, so admin follows it.
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

    /** Request params for an explicit filter set — throws on an unparsable date. */
    const paramsFor = useCallback((f) => {
        const comparison = isComparisonReport(f.reportType);
        return advancedReportsParams({
            workshopId: portal === 'admin' ? f.workshopId : undefined,
            branchId: f.branchId,
            categoryId: f.categoryId,
            mainFrom: localToIso(f.mainFrom),
            mainTo: localToIso(f.mainTo),
            ...(comparison
                ? {
                    prevFrom: localToIso(f.prevFrom),
                    prevTo: localToIso(f.prevTo),
                }
                : {}),
            reportType: f.reportType,
            departmentId: f.departmentId,
            compareDepartmentId: f.compareDepartmentId,
            includeProducts: f.includeProducts !== false,
            includeServices: f.includeServices !== false,
        });
    }, [isComparisonReport, portal]);

    const buildApiParams = useCallback(() => paramsFor(filters), [paramsFor, filters]);

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

    /**
     * Fetch a report for an explicit filter set. Switching tabs and picking a
     * comparison type both have to reload before `filters` state has settled,
     * so they pass the next filters in rather than waiting a render.
     */
    const runReport = useCallback(async (f) => {
        if (!canView) return;
        if (portal === 'admin' && !f.workshopId) {
            setData(null);
            setErr('');
            return;
        }
        setLoading(true);
        setErr('');
        try {
            const res = await getAdvancedReport(
                portal === 'admin' ? 'admin' : 'workshop',
                paramsFor(f),
            );
            setData(res);
        } catch (e) {
            setErr(e?.message || t('page.error'));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [canView, paramsFor, portal, t]);

    const loadReport = useCallback(() => runReport(filters), [runReport, filters]);

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

    // Paging goes back to page 1 whenever the filters change, whatever the
    // row counts happen to be.
    const filterKey = JSON.stringify(filters);

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
        void runReport(next);
    };

    if (!canView) {
        return (
            <div className="ui-root ui-root--flush" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <div className="ui-empty">
                    <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                    <div className="ui-empty-title">{t('page.error')}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="ui-row">
                <div className="ui-head">
                    <h1>{t('page.title')}</h1>
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
                    <button
                        type="button"
                        className="ui-btn ui-btn--default"
                        disabled={!data || loading}
                        onClick={() => exportCurrent('pdf')}
                    >
                        {t('page.exportPdf')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default"
                        disabled={!data || loading}
                        onClick={() => exportCurrent('excel')}
                    >
                        {t('page.exportExcel')}
                    </button>
                </div>
            </div>

            <div className="ui-tabs ui-tabs--scroll" role="tablist" aria-label={t('page.title')}>
                {REPORT_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTabId === tab.id}
                        className="ui-tab"
                        onClick={() => selectTab(tab.id)}
                        disabled={loading}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <AdvancedReportsFilters
                t={t}
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
                    if (next.reportType !== filters.reportType) void runReport(next);
                }}
                onApply={() => { void loadFilterOptions(); void loadReport(); }}
                loading={loading}
                showComparisonReportType={activeTabId === 'comparison'}
                showPreviousPeriod={activeTabId === 'comparison'}
                showItemTypes={filters.reportType !== 'purchase_price_change'}
            />

            {portal === 'admin' && !filters.workshopId ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Building2 size={18} /></div>
                    <div className="ui-empty-title">{t('page.selectWorkshop')}</div>
                </div>
            ) : null}

            {err ? (
                <div className="ui-banner ui-banner--dang">
                    <AlertTriangle size={14} />
                    <span>{err}</span>
                </div>
            ) : null}

            {loading ? <ReportSkeleton /> : null}

            {!loading && data && reportType === 'sales_comparison' ? (
                <>
                    <div className="ui-kpis">
                        <ClickableKpi label={t('kpi.currentRevenue')} value={money(t, data.summary?.currentPeriodRevenue)} hint={hint} onClick={() => openDrilldown('current_revenue', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.previousRevenue')} value={money(t, data.summary?.previousPeriodRevenue)} hint={hint} onClick={() => openDrilldown('previous_revenue', { period: 'previous' })} />
                        <ClickableKpi
                            label={t('kpi.growthAmount')}
                            value={money(t, data.summary?.growthAmount)}
                            tone={(data.summary?.growthAmount || 0) >= 0 ? 'ok' : 'dang'}
                            hint={hint}
                            onClick={() => openDrilldown('growth_amount', { period: 'main' })}
                        />
                        <ClickableKpi
                            label={t('kpi.growthPercent')}
                            value={pct(data.summary?.growthPercent)}
                            tone={(data.summary?.growthPercent || 0) >= 0 ? 'ok' : 'dang'}
                            hint={hint}
                            onClick={() => openDrilldown('growth_percent', { period: 'main' })}
                        />
                    </div>

                    <Chart title={t('chart.revenueTrend')}>
                        <LineChart data={mergeTrend(data.charts?.revenueTrend)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="main" name={t('chart.main')} stroke={CHART.main} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="previous" name={t('chart.previous')} stroke={CHART.prev} strokeWidth={2} dot={false} />
                        </LineChart>
                    </Chart>

                    <ComparisonTable
                        t={t}
                        rows={data.comparisonTable}
                        resetKey={filterKey}
                        onDrill={openDrilldown}
                    />

                    <DepartmentTable
                        t={t}
                        rows={data.departmentRows}
                        resetKey={filterKey}
                        onDrill={openDrilldown}
                    />
                </>
            ) : null}

            {!loading && data && reportType === 'gross_margin' ? (
                <>
                    <div className="ui-kpis">
                        <ClickableKpi label={t('kpi.totalSales')} value={money(t, data.summary?.totalSales)} hint={hint} onClick={() => openDrilldown('total_sales', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.totalCogs')} value={money(t, data.summary?.totalCogs)} hint={hint} onClick={() => openDrilldown('total_cogs', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.grossProfit')} value={money(t, data.summary?.grossProfit)} hint={hint} tone="ok" onClick={() => openDrilldown('gross_profit', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.grossMarginPercent')} value={pct(data.summary?.grossMarginPercent)} hint={hint} onClick={() => openDrilldown('gross_margin_percent', { period: 'main' })} />
                    </div>

                    <Chart title={t('chart.marginByCategory')}>
                        <BarChart data={data.charts?.marginByCategory || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" hide={(data.charts?.marginByCategory || []).length > 8} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="marginPercent" name={t('table.margin')} fill={CHART.main} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </Chart>

                    <MarginTable
                        t={t}
                        title={t('table.categories')}
                        rows={data.categoryRows}
                        resetKey={filterKey}
                        showQty
                        onNum={(metric, row) => openDrilldown(metric, { period: 'main', entityType: 'category', entityId: row.id, categoryId: row.id })}
                    />
                    <MarginTable
                        t={t}
                        title={t('table.products')}
                        rows={data.productRows}
                        resetKey={filterKey}
                        showQty
                        showUnitPricing
                        onNum={(metric, row) => openDrilldown(metric, { period: 'main', entityType: row.kind, entityId: row.id })}
                    />
                </>
            ) : null}

            {!loading && data && reportType === 'purchase_price_change' ? (
                <>
                    <div className="ui-kpis">
                        <ClickableKpi label={t('kpi.productsChanged')} value={String(data.summary?.productsWithPriceChange ?? 0)} hint={hint} onClick={() => openDrilldown('price_products_changed', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.avgIncrease')} value={pct(data.summary?.averagePriceIncreasePercent)} hint={hint} onClick={() => openDrilldown('price_avg_increase', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.highestIncrease')} value={pct(data.summary?.highestIncreasePercent)} hint={hint} onClick={() => openDrilldown('price_highest_increase', { period: 'main' })} />
                    </div>

                    <Chart title={`${t('chart.priceTrend')}${data.charts?.trendProductName ? ` — ${data.charts.trendProductName}` : ''}`}>
                        <LineChart data={data.charts?.priceTrend || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="price" stroke={CHART.main} strokeWidth={2} />
                        </LineChart>
                    </Chart>

                    <PriceChangeTable
                        t={t}
                        rows={data.rows}
                        resetKey={filterKey}
                        onDrill={openDrilldown}
                    />
                </>
            ) : null}

            {!loading && data && reportType === 'product_profitability' ? (
                <>
                    <div className="ui-kpis">
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
                            <ClickableKpi
                                key={key}
                                label={t(key)}
                                value={item?.name || t('common.emDash')}
                                hint={item ? `${money(t, item.grossProfit)} · ${Number(item.marginPercent || 0).toFixed(1)}%` : ''}
                                onClick={item
                                    ? () => openDrilldown('product_sales', {
                                        period: 'main',
                                        entityType: item.kind,
                                        entityId: item.id,
                                    })
                                    : undefined}
                            />
                        ))}
                    </div>

                    <Chart title={t('chart.topProfit')}>
                        <BarChart data={data.charts?.topProfit || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" hide />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="grossProfit" name={t('table.profit')} fill={CHART.profit} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </Chart>

                    <MarginTable
                        t={t}
                        title={t('table.rankProfit')}
                        rows={data.rankingByGrossProfit}
                        resetKey={filterKey}
                        onNum={(metric, row) => openDrilldown(metric, { period: 'main', entityType: row.kind, entityId: row.id })}
                    />
                    <MarginTable
                        t={t}
                        title={t('table.rankMargin')}
                        rows={data.rankingByMargin}
                        resetKey={filterKey}
                        onNum={(metric, row) => openDrilldown(metric, { period: 'main', entityType: row.kind, entityId: row.id })}
                    />
                </>
            ) : null}

            {!loading && data && reportType === 'branch_comparison' ? (
                <>
                    <div className="ui-kpis">
                        <ClickableKpi label={t('kpi.branchCount')} value={String(data.summary?.branchCount ?? 0)} hint={hint} onClick={() => openDrilldown('branch_all', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.currentRevenue')} value={money(t, data.summary?.totalCurrentRevenue)} hint={hint} onClick={() => openDrilldown('current_revenue', { period: 'main' })} />
                        <ClickableKpi label={t('kpi.previousRevenue')} value={money(t, data.summary?.totalPreviousRevenue)} hint={hint} onClick={() => openDrilldown('previous_revenue', { period: 'previous' })} />
                        <ClickableKpi
                            label={t('kpi.topBranch')}
                            value={data.summary?.topBranch ? money(t, data.summary.topBranch.currentRevenue) : t('common.emDash')}
                            hint={data.summary?.topBranch?.name || hint}
                            onClick={data.summary?.topBranch
                                ? () => openDrilldown('branch_revenue', {
                                    period: 'main',
                                    entityType: 'branch',
                                    entityId: data.summary.topBranch.id,
                                })
                                : undefined}
                        />
                    </div>

                    <Chart title={t('chart.branchRevenue')}>
                        <BarChart data={data.charts?.branchRevenue || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="current" name={t('chart.main')} fill={CHART.main} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="previous" name={t('chart.previous')} fill={CHART.prev} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </Chart>

                    <BranchTable
                        t={t}
                        rows={data.rows}
                        resetKey={filterKey}
                        onDrill={openDrilldown}
                    />
                </>
            ) : null}
        </div>
    );
}

/**
 * Two periods side by side on one axis. The ranges need not be the same
 * length or the same calendar days, so the two series are aligned by index
 * and the label comes from whichever side has a point at that index.
 */
function mergeTrend(trend) {
    const main = trend?.main || [];
    const previous = trend?.previous || [];
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

function ComparisonTable({ t, rows, resetKey, onDrill }) {
    const { pagedRows, pagerProps } = usePagedRows(rows, { resetKey });
    return (
        <Block title={t('table.comparison')}>
            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                <table className="ui-table">
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
                        {pagedRows.map((row) => (
                            <tr key={row.label}>
                                <td>{row.label}</td>
                                <td>
                                    <Num onClick={() => onDrill('current_invoices', { period: 'main' })}>{row.currentInvoices}</Num>
                                    {' / '}
                                    <Num onClick={() => onDrill('previous_invoices', { period: 'previous' })}>{row.previousInvoices}</Num>
                                </td>
                                <td>
                                    <Num onClick={() => onDrill('current_revenue', { period: 'main' })}>{money(t, row.currentRevenue)}</Num>
                                    {' / '}
                                    <Num onClick={() => onDrill('previous_revenue', { period: 'previous' })}>{money(t, row.previousRevenue)}</Num>
                                </td>
                                <td>{money(t, row.currentAvgTicket)} / {money(t, row.previousAvgTicket)}</td>
                                <td>
                                    <Num onClick={() => onDrill('growth_percent', { period: 'main' })}>{pct(row.growthPercent)}</Num>
                                </td>
                            </tr>
                        ))}
                        {!pagedRows.length ? (
                            <tr><td colSpan={5}>{t('page.empty')}</td></tr>
                        ) : null}
                    </tbody>
                </table>
                <UiPager {...pagerProps} />
            </div>
        </Block>
    );
}

function DepartmentTable({ t, rows, resetKey, onDrill }) {
    const { pagedRows, pagerProps } = usePagedRows(rows, { resetKey });
    return (
        <Block title={t('table.departments')}>
            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('table.department')}</th>
                            <th>{t('table.current')}</th>
                            <th>{t('table.previous')}</th>
                            <th>{t('table.growth')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedRows.map((row) => (
                            <tr key={row.id}>
                                <td>{row.name}</td>
                                <td>
                                    <Num onClick={() => onDrill('department_revenue', { period: 'main', departmentId: row.id, entityType: 'department', entityId: row.id })}>
                                        {money(t, row.currentRevenue)}
                                    </Num>
                                </td>
                                <td>
                                    <Num onClick={() => onDrill('department_revenue', { period: 'previous', departmentId: row.id, entityType: 'department', entityId: row.id })}>
                                        {money(t, row.previousRevenue)}
                                    </Num>
                                </td>
                                <td>{pct(row.growthPercent)}</td>
                            </tr>
                        ))}
                        {!pagedRows.length ? (
                            <tr><td colSpan={4}>{t('page.empty')}</td></tr>
                        ) : null}
                    </tbody>
                </table>
                <UiPager {...pagerProps} />
            </div>
        </Block>
    );
}

function PriceChangeTable({ t, rows, resetKey, onDrill }) {
    const { pagedRows, pagerProps } = usePagedRows(rows, { resetKey });
    return (
        <Block title={t('table.priceChanges')}>
            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                <table className="ui-table">
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
                        {pagedRows.map((row, idx) => {
                            const diff = row.priceDifference != null
                                ? Number(row.priceDifference)
                                : Number(row.newPrice || 0) - Number(row.oldPrice || 0);
                            return (
                                <tr key={`${row.productId}-${row.changeDate}-${idx}`}>
                                    <td>
                                        <Num onClick={() => onDrill('price_product', { period: 'main', productId: row.productId, entityId: row.productId, entityType: 'product' })}>
                                            {row.productName}
                                        </Num>
                                    </td>
                                    <td>{row.supplierName}</td>
                                    <td>{money(t, row.oldPrice)}</td>
                                    <td>
                                        <Num onClick={() => onDrill('price_product', { period: 'main', productId: row.productId, entityId: row.productId })}>
                                            {money(t, row.newPrice)}
                                        </Num>
                                    </td>
                                    <td>{money(t, diff)}</td>
                                    <td>{pct(row.changePercent)}</td>
                                    <td>{row.changeDate}</td>
                                </tr>
                            );
                        })}
                        {!pagedRows.length ? (
                            <tr><td colSpan={7}>{t('page.empty')}</td></tr>
                        ) : null}
                    </tbody>
                </table>
                <UiPager {...pagerProps} />
            </div>
        </Block>
    );
}

function BranchTable({ t, rows, resetKey, onDrill }) {
    const { pagedRows, pagerProps } = usePagedRows(rows, { resetKey });
    return (
        <Block title={t('table.branches')}>
            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('table.branch')}</th>
                            <th>{t('table.current')}</th>
                            <th>{t('table.previous')}</th>
                            <th>{t('table.growth')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedRows.map((row) => (
                            <tr key={row.id}>
                                <td>{row.name}</td>
                                <td>
                                    <Num onClick={() => onDrill('branch_revenue', { period: 'main', entityType: 'branch', entityId: row.id })}>
                                        {money(t, row.currentRevenue)}
                                    </Num>
                                </td>
                                <td>
                                    <Num onClick={() => onDrill('branch_revenue', { period: 'previous', entityType: 'branch', entityId: row.id })}>
                                        {money(t, row.previousRevenue)}
                                    </Num>
                                </td>
                                <td>
                                    <Num onClick={() => onDrill('growth_percent', { period: 'main', entityType: 'branch', entityId: row.id })}>
                                        {pct(row.growthPercent)}
                                    </Num>
                                </td>
                            </tr>
                        ))}
                        {!pagedRows.length ? (
                            <tr><td colSpan={4}>{t('page.empty')}</td></tr>
                        ) : null}
                    </tbody>
                </table>
                <UiPager {...pagerProps} />
            </div>
        </Block>
    );
}

/**
 * Sales / COGS / profit / margin for a ranked list. The closing row is the
 * grand total over every row, not the page on screen — it is the report's
 * bottom line, so it must not change as you page through.
 */
function MarginTable({ t, title, rows, resetKey, onNum, showQty = false, showUnitPricing = false }) {
    const colSpan = 6 + (showQty ? 1 : 0) + (showUnitPricing ? 2 : 0);
    const list = useMemo(() => rows || [], [rows]);
    const { pagedRows, pagerProps } = usePagedRows(list, { resetKey });

    const totals = useMemo(
        () => list.reduce(
            (acc, row) => {
                acc.qty += Number(row.qty || 0);
                acc.sales += Number(row.sales || 0);
                acc.cogs += Number(row.cogs || 0);
                acc.grossProfit += Number(row.grossProfit || 0);
                return acc;
            },
            { qty: 0, sales: 0, cogs: 0, grossProfit: 0 },
        ),
        [list],
    );
    const marginPercent = totals.sales
        ? Math.round((totals.grossProfit / totals.sales) * 10000) / 100
        : 0;

    return (
        <Block title={title}>
            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                <table className="ui-table">
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
                        {pagedRows.map((row) => (
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
                                <td><Num onClick={() => onNum?.('product_margin', row)}>{pct(row.marginPercent)}</Num></td>
                            </tr>
                        ))}
                        {!list.length ? <tr><td colSpan={colSpan}>{t('page.empty')}</td></tr> : null}
                    </tbody>
                    {list.length ? (
                        <tfoot>
                            <tr className="ui-row-sum ui-row-sum--close">
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
                <UiPager {...pagerProps} />
            </div>
        </Block>
    );
}
