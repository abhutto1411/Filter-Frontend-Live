import React, { useMemo } from 'react';
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { activityChartRows, salesChartRows } from './workshopDashboardSeries';
import { formatDashKpiAmount } from './dashboardKpiMapper';

const AMBER = '#FCC245';
const AMBER_LINE = '#C49200';
const PREVIOUS = '#C4B59A';
const BAR_MUTED = '#D1D5DB';
const GRID = '#F3F4F6';
const TICK = '#9CA3AF';

function moneyTick(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
    return String(Math.round(n));
}

function SalesTooltip({ active, payload, label, t, vatLabel }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="wsd-tip">
            <p className="wsd-tip__h">{label}</p>
            {payload.map((p) => (
                <p key={p.dataKey} className="wsd-tip__row">
                    <span className="wsd-tip__swatch" style={{ background: p.color }} />
                    {p.name}: {p.value == null ? t('emdash') : t('money.sar', { amount: formatDashKpiAmount(p.value) })}
                    {p.dataKey === 'current' ? ` · ${vatLabel}` : ''}
                </p>
            ))}
        </div>
    );
}

function CountTooltip({ active, payload, label, t }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="wsd-tip">
            <p className="wsd-tip__h">{label}</p>
            {payload.map((p) => (
                <p key={p.dataKey} className="wsd-tip__row">
                    <span className="wsd-tip__swatch" style={{ background: p.color }} />
                    {p.name}: {p.value == null ? t('emdash') : p.value}
                </p>
            ))}
        </div>
    );
}

function AccessibleTable({ caption, columns, rows }) {
    return (
        <div className="wsd-sr-only">
            <table>
                <caption>{caption}</caption>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} scope="col">{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.key}>
                            {columns.map((c) => (
                                <td key={c.key}>{r[c.key] == null ? '—' : r[c.key]}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function GrainPills({ grain, allowedGrains, onGrain, t }) {
    return (
        <div className="wsd-seg" role="radiogroup" aria-label={t('charts.grainAria')}>
            {['hourly', 'daily', 'monthly'].map((id) => {
                const on = allowedGrains.includes(id);
                return (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={grain === id}
                        disabled={!on}
                        title={on ? t(`charts.grain.${id}`) : t('charts.grainDisabled')}
                        className={`wsd-seg__btn${grain === id ? ' wsd-seg__btn--active' : ''}`}
                        onClick={() => on && onGrain?.(id)}
                    >
                        {t(`charts.grain.${id}`)}
                    </button>
                );
            })}
        </div>
    );
}

export default function WorkshopDashboardCharts({
    series,
    grain,
    vatMode,
    onVatMode,
    locale,
    t,
    loading,
    error,
    allowedGrains,
    onGrain,
    compareMode,
    freshAt,
    stale = false,
    latencyMs,
}) {
    const salesRows = useMemo(
        () => salesChartRows(series?.sales?.buckets, grain, locale, vatMode),
        [series, grain, locale, vatMode],
    );
    const activityRows = useMemo(
        () => activityChartRows(series?.activity?.buckets, grain, locale),
        [series, grain, locale],
    );
    const vatLabel = vatMode === 'inc' ? t('charts.incVat') : t('charts.exVat');
    const hasPrevious = compareMode !== 'none' && series?.compare === 'previous';
    const salesIncomplete = series?.sales && !series.sales.coverageComplete;
    const jobsIncomplete = series?.activity && !series.activity.coverageComplete;
    const lastFilled = (() => {
        let idx = -1;
        activityRows.forEach((r, i) => {
            if (r.current != null) idx = i;
        });
        return idx;
    })();
    const openNow = series?.activity?.openJobsNow;

    return (
        <section className="wsd-charts" aria-labelledby="wsd-charts-title">
            <h3 id="wsd-charts-title" className="wsd-charts__kicker">{t('charts.section')}</h3>
            <div className="wsd-charts__grid">
                <div className="wsd-panel wsd-panel--chart wsd-panel--wide">
                    <div className="wsd-panel__head">
                        <div>
                            <h4 className="wsd-panel__title">{t('charts.salesTitle')}</h4>
                            <p className="wsd-panel__lede">{t(vatMode === 'inc' ? 'charts.salesSubInc' : 'charts.salesSub')}</p>
                        </div>
                        <div className="wsd-charts__controls">
                            <GrainPills grain={grain} allowedGrains={allowedGrains} onGrain={onGrain} t={t} />
                            <div className="wsd-seg" role="radiogroup" aria-label={t('charts.vatAria')}>
                                {['ex', 'inc'].map((id) => (
                                    <button
                                        key={id}
                                        type="button"
                                        role="radio"
                                        aria-checked={vatMode === id}
                                        className={`wsd-seg__btn${vatMode === id ? ' wsd-seg__btn--active' : ''}`}
                                        onClick={() => onVatMode?.(id)}
                                    >
                                        {id === 'ex' ? t('charts.exVat') : t('charts.incVat')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    {salesIncomplete ? (
                        <p className="wsd-warn" role="status">{t('charts.salesCoverage', { n: series.sales.missingIssuedAtCount })}</p>
                    ) : null}
                    {stale ? <p className="wsd-warn" role="status">{t('charts.stale')}</p> : null}
                    {error ? <p className="wsd-alert">{error}</p> : null}
                    {loading && !series ? (
                        <p className="wsd-empty">{t('charts.loading')}</p>
                    ) : stale ? (
                        null
                    ) : !salesRows.length ? (
                        <p className="wsd-empty">{t('charts.salesEmpty')}</p>
                    ) : (
                        <>
                            <div className="wsd-chart" role="img" aria-label={t('charts.salesAria')}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={salesRows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="wsdSalesFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={AMBER} stopOpacity={0.42} />
                                                <stop offset="100%" stopColor={AMBER} stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke={GRID} vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                                        <YAxis tick={{ fill: TICK, fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={moneyTick} />
                                        <Tooltip content={<SalesTooltip t={t} vatLabel={vatLabel} />} />
                                        <Legend
                                            verticalAlign="top"
                                            align="right"
                                            iconType="plainline"
                                            wrapperStyle={{ fontSize: 12, color: TICK, paddingBottom: 8 }}
                                            formatter={(v) => v}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="current"
                                            name={t('charts.legend.currentPeriod')}
                                            stroke={AMBER_LINE}
                                            strokeWidth={2.25}
                                            fill="url(#wsdSalesFill)"
                                            connectNulls={false}
                                            dot={false}
                                            activeDot={{ r: 4, fill: AMBER, stroke: '#111' }}
                                        />
                                        {hasPrevious ? (
                                            <Line
                                                type="monotone"
                                                dataKey="previous"
                                                name={t('charts.legend.previousPeriod')}
                                                stroke={PREVIOUS}
                                                strokeWidth={1.75}
                                                strokeDasharray="5 4"
                                                dot={false}
                                                connectNulls={false}
                                            />
                                        ) : null}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <AccessibleTable
                                caption={t('charts.salesTable')}
                                columns={[
                                    { key: 'label', label: t('charts.col.bucket') },
                                    { key: 'current', label: t('charts.legend.currentPeriod') },
                                    { key: 'previous', label: t('charts.legend.previousPeriod') },
                                ]}
                                rows={salesRows.map((r) => ({
                                    key: r.key,
                                    label: r.label,
                                    current: r.current == null ? '—' : formatDashKpiAmount(r.current),
                                    previous: r.previous == null ? '—' : formatDashKpiAmount(r.previous),
                                }))}
                            />
                        </>
                    )}
                </div>

                <div className="wsd-panel wsd-panel--chart">
                    <div className="wsd-panel__head">
                        <div>
                            <h4 className="wsd-panel__title">{t('charts.activityTitle')}</h4>
                            <p className="wsd-panel__lede">{t(`charts.activitySub.${grain}`)}</p>
                        </div>
                    </div>
                    {jobsIncomplete ? (
                        <p className="wsd-warn" role="status">{t('charts.jobsCoverage', { n: series.activity.missingCompletedAtCount })}</p>
                    ) : null}
                    {loading && !series ? (
                        <p className="wsd-empty">{t('charts.loading')}</p>
                    ) : stale ? (
                        null
                    ) : !activityRows.length ? (
                        <p className="wsd-empty">{t('charts.activityEmpty')}</p>
                    ) : (
                        <>
                            <div className="wsd-chart" role="img" aria-label={t('charts.activityAria')}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={activityRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                                        <CartesianGrid stroke={GRID} vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                                        <YAxis allowDecimals={false} tick={{ fill: TICK, fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                                        <Tooltip content={<CountTooltip t={t} />} />
                                        <Bar dataKey="current" name={t('charts.legend.completed')} maxBarSize={36} radius={[4, 4, 0, 0]}>
                                            {activityRows.map((row, i) => (
                                                <Cell key={row.key} fill={i === lastFilled ? AMBER : BAR_MUTED} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="wsd-chart-legend" aria-hidden="true">
                                <span><i className="wsd-chart-legend__swatch wsd-chart-legend__swatch--muted" />{t('charts.legend.completed')}</span>
                                {openNow ? (
                                    <span title={openNow.definition}>
                                        <i className="wsd-chart-legend__swatch wsd-chart-legend__swatch--amber" />
                                        {t('charts.openNow', { count: openNow.count })}
                                    </span>
                                ) : null}
                            </div>
                            <AccessibleTable
                                caption={t('charts.activityTable')}
                                columns={[
                                    { key: 'label', label: t('charts.col.bucket') },
                                    { key: 'current', label: t('charts.legend.completed') },
                                ]}
                                rows={activityRows.map((r) => ({
                                    key: r.key,
                                    label: r.label,
                                    current: r.current == null ? '—' : r.current,
                                }))}
                            />
                        </>
                    )}
                    {freshAt ? (
                        <p className="wsd-charts__foot">
                            {t('charts.freshness', {
                                time: freshAt,
                                ms: latencyMs == null ? '—' : String(latencyMs),
                            })}
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
