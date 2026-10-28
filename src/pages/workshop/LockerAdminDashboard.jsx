import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    Banknote,
    UserCheck,
    AlertTriangle,
    Clock,
    CheckCircle,
    RefreshCw,
    Inbox,
    Activity,
    Bell,
    Wallet,
    ChevronRight,
    ChevronLeft,
    BarChart3,
    PieChart as PieIcon,
    Building2,
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const DAY_OPTIONS = [7, 14, 30];
const REFRESH_MS = 60_000;
const COLORS = {
    collected: '#16a34a',
    requested: '#f59e0b',
    open: '#f59e0b',
    awaitingPickup: '#f59e0b',
    assigned: '#3b82f6',
    awaitingApproval: '#8b5cf6',
    approved: '#16a34a',
    rejected: '#ef4444',
};
const PIPELINE_KEYS = ['awaitingPickup', 'assigned', 'awaitingApproval', 'approved', 'rejected'];

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function amountText(n, fractionDigits = 2) {
    return Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: 2,
    });
}

function relativeTime(iso, now, t) {
    const diff = Math.max(0, now - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return t('time.justNow');
    if (min < 60) return t('time.minutes', { n: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t('time.hours', { n: h });
    return t('time.days', { n: Math.floor(h / 24) });
}

function KpiCard({ icon, label, value, hint, tone = 'neutral', onClick }) {
    const Icon = icon;
    const content = (
        <>
            <span className={`wlk-kpi2__icon wlk-kpi2__icon--${tone}`}>
                <Icon size={18} />
            </span>
            <span className="wlk-kpi2__body">
                <span className="wlk-kpi2__label">{label}</span>
                <span className="wlk-kpi2__value">{value}</span>
                {hint ? <span className="wlk-kpi2__hint">{hint}</span> : null}
            </span>
        </>
    );
    if (!onClick) return <div className="wlk-kpi2">{content}</div>;
    return (
        <button type="button" className="wlk-kpi2 wlk-kpi2--link" onClick={onClick}>
            {content}
        </button>
    );
}

function Panel({ icon, title, subtitle, badge, actions, children, className = '' }) {
    const Icon = icon;
    return (
        <section className={`wlk-panel ${className}`}>
            <header className="wlk-panel__head">
                <span className="wlk-panel__icon">
                    <Icon size={16} />
                </span>
                <div className="wlk-panel__titles">
                    <h4>
                        {title}
                        {badge != null ? <span className="wlk-panel__badge">{badge}</span> : null}
                    </h4>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
                {actions ? <div className="wlk-panel__actions">{actions}</div> : null}
            </header>
            <div className="wlk-panel__body">{children}</div>
        </section>
    );
}

function FeedList({ items, empty, renderItem }) {
    if (!items.length) return <div className="wlk-feed__empty">{empty}</div>;
    return <ul className="wlk-feed">{items.map(renderItem)}</ul>;
}

function ViewMore({ label, onClick, isRtl }) {
    const Arrow = isRtl ? ChevronLeft : ChevronRight;
    return (
        <button type="button" className="wlk-feed__more" onClick={onClick}>
            {label}
            <Arrow size={15} />
        </button>
    );
}

function ChartTooltip({ active, payload, label, formatLabel, formatValue }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="wlk-chart-tip">
            <div className="wlk-chart-tip__label">{formatLabel ? formatLabel(label) : label}</div>
            {payload.map((p) => (
                <div key={p.dataKey} className="wlk-chart-tip__row">
                    <span className="wlk-dot" style={{ background: p.color || p.payload?.fill }} />
                    <span>{p.name}</span>
                    <strong>{formatValue(p.value, p)}</strong>
                </div>
            ))}
        </div>
    );
}

function Legend({ items }) {
    return (
        <div className="wlk-legend">
            {items.map((it) => (
                <span key={it.label} className="wlk-legend__item">
                    <span className="wlk-dot" style={{ background: it.color }} />
                    {it.label}
                </span>
            ))}
        </div>
    );
}

/**
 * Workshop Admin → Locker Management landing dashboard: KPI cards, the latest
 * pending / collected notifications (6 each, "View all" opens the full tab) and
 * trend / pipeline / branch charts. Data comes from `GET /locker/admin-dashboard`,
 * which applies the caller's branch scope and hides feeds they cannot open.
 */
export default function LockerAdminDashboard({ locale, t, branchId = 'all', onOpenTab, canOpenTab }) {
    const isRtl = locale === 'ar';
    const dateLocale = isRtl ? 'ar-SA' : 'en-US';
    const [days, setDays] = useState(14);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const [vouchersPending, setVouchersPending] = useState(null);
    const showVouchers = canOpenTab('vault_vouchers');

    const money = useCallback((n, digits = 2) => t('money.sar', { amount: amountText(n, digits) }), [t]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [res, vv] = await Promise.all([
                apiFetch(
                    `/locker/admin-dashboard${qs({
                        branchId: branchId && branchId !== 'all' ? branchId : undefined,
                        days,
                        _t: Date.now(),
                    })}`,
                ),
                showVouchers
                    ? apiFetch('/locker/vault-vouchers/pending-summary').catch(() => null)
                    : Promise.resolve(null),
            ]);
            if (res?.success === false) throw new Error(res?.message || t('err.load'));
            setData(res);
            setVouchersPending(vv?.success ? vv : null);
            setNow(Date.now());
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [branchId, days, showVouchers, t]);

    useEffect(() => {
        void load();
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') void load();
        }, REFRESH_MS);
        return () => clearInterval(id);
    }, [load]);

    const linkTo = (tabId) => (canOpenTab(tabId) ? () => onOpenTab(tabId) : undefined);
    const kpis = data?.kpis;
    const dash = t('emdash');
    const pendingFeed = data?.feeds?.pending ?? null;
    const collectedFeed = data?.feeds?.collected ?? null;

    const shortDay = useCallback(
        (ymd) =>
            new Date(`${ymd}T12:00:00`).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }),
        [dateLocale],
    );
    const longDay = useCallback(
        (ymd) =>
            new Date(`${ymd}T12:00:00`).toLocaleDateString(dateLocale, {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            }),
        [dateLocale],
    );

    const daily = useMemo(() => data?.charts?.daily ?? [], [data]);
    const periodTotals = useMemo(
        () =>
            daily.reduce(
                (acc, d) => ({
                    collected: acc.collected + d.collectedAmount,
                    requested: acc.requested + d.requestedAmount,
                }),
                { collected: 0, requested: 0 },
            ),
        [daily],
    );
    const dailyHasData = daily.some((d) => d.collectedAmount > 0 || d.requestedAmount > 0);

    const pipeline = useMemo(() => {
        const p = data?.charts?.pipeline || {};
        return PIPELINE_KEYS.map((key) => ({
            key,
            name: t(`pipe.${key}`),
            value: Number(p[key] || 0),
            fill: COLORS[key],
        }));
    }, [data, t]);
    const pipelineTotal = pipeline.reduce((s, x) => s + x.value, 0);

    const byBranch = useMemo(() => (data?.charts?.byBranch ?? []).slice(0, 8), [data]);

    const updatedAt = data?.generatedAt
        ? new Date(data.generatedAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
        : null;

    const openPendingItem = (item) => {
        if (canOpenTab('record')) onOpenTab(`record?requestId=${encodeURIComponent(item.id)}`);
        else onOpenTab('pending');
    };

    return (
        <div className="wlk-page wlk-dash">
            <div className="wlk-dash__toolbar">
                <div>
                    <h3 className="wlk-dash__title">{t('dash.title')}</h3>
                    <p className="wlk-dash__sub">
                        {t('dash.subtitle')}
                        {updatedAt ? <span className="wlk-dash__updated">{t('dash.updated', { time: updatedAt })}</span> : null}
                    </p>
                </div>
                <div className="wlk-dash__controls">
                    <div className="wlk-seg" role="group" aria-label={t('dash.period')}>
                        {DAY_OPTIONS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                className={`wlk-seg__btn${days === d ? ' wlk-seg__btn--active' : ''}`}
                                onClick={() => setDays(d)}
                                aria-pressed={days === d}
                            >
                                {t(`dash.days${d}`)}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="btn-secondary wlk-icon-btn" onClick={() => void load()} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                        {t('btn.refresh')}
                    </button>
                </div>
            </div>

            {error ? <div className="wlk-error">{error}</div> : null}

            <div className="wlk-dash__kpis">
                <KpiCard
                    icon={Inbox}
                    tone="amber"
                    label={t('kpi.pendingPickups')}
                    value={kpis ? kpis.pendingRequests : dash}
                    hint={kpis ? t('kpi.pendingPickupsAmount', { amount: money(kpis.openAmount) }) : null}
                    onClick={linkTo('pending')}
                />
                <KpiCard
                    icon={UserCheck}
                    tone="blue"
                    label={t('kpi.assigned')}
                    value={kpis ? kpis.assignedRequests : dash}
                    hint={t('kpi.assignedHint')}
                    onClick={linkTo('pending')}
                />
                <KpiCard
                    icon={AlertTriangle}
                    tone={kpis && kpis.overdueRequests > 0 ? 'red' : 'slate'}
                    label={t('kpi.overdue')}
                    value={kpis ? kpis.overdueRequests : dash}
                    hint={t('kpi.overdueHint')}
                    onClick={linkTo('pending')}
                />
                <KpiCard
                    icon={Clock}
                    tone="violet"
                    label={t('kpi.pendingApprovals')}
                    value={kpis ? kpis.pendingApprovals : dash}
                    hint={t('kpi.pendingApprovalsHint')}
                    onClick={linkTo('approvals')}
                />
                <KpiCard
                    icon={CheckCircle}
                    tone="green"
                    label={t('kpi.collectedToday')}
                    value={kpis ? kpis.collectionsToday : dash}
                    hint={kpis ? t('kpi.collectedTodayHint', { amount: money(kpis.collectedTodayAmount) }) : null}
                    onClick={linkTo('history')}
                />
                <KpiCard
                    icon={Banknote}
                    tone="green"
                    label={t('kpi.monthlyCollected')}
                    value={kpis ? money(kpis.monthlyCollected) : dash}
                    hint={t('kpi.monthlyCollectedHint')}
                    onClick={linkTo('history')}
                />
                <KpiCard
                    icon={Activity}
                    tone="slate"
                    label={t('kpi.openShiftVariance')}
                    value={kpis ? money(kpis.openShiftVariance) : dash}
                    hint={t('kpi.openShiftVarianceHint')}
                    onClick={linkTo('differences')}
                />
                <KpiCard
                    icon={Archive}
                    tone="gold"
                    label={t('kpi.vaultBalance')}
                    value={kpis ? money(kpis.lockerVaultBalance) : dash}
                    hint={t('kpi.vaultWorkshopHint')}
                    onClick={linkTo('transaction_log')}
                />
                {showVouchers ? (
                    <KpiCard
                        icon={Wallet}
                        tone={vouchersPending?.pendingCount > 0 ? 'violet' : 'slate'}
                        label={t('kpi.vaultVouchers')}
                        value={vouchersPending ? vouchersPending.pendingCount : dash}
                        hint={vouchersPending ? t('kpi.vaultVouchersHint', { amount: money(vouchersPending.pendingAmount) }) : null}
                        onClick={linkTo('vault_vouchers')}
                    />
                ) : null}
            </div>

            {pendingFeed || collectedFeed ? (
                <div className="wlk-dash__feeds">
                    {pendingFeed ? (
                        <Panel
                            icon={Bell}
                            title={t('feed.pendingTitle')}
                            subtitle={t('feed.pendingSub')}
                            badge={pendingFeed.total}
                            className="wlk-panel--amber"
                        >
                            <FeedList
                                items={pendingFeed.items}
                                empty={t('feed.emptyPending')}
                                renderItem={(r) => (
                                    <li key={r.id}>
                                        <button type="button" className="wlk-feed__item" onClick={() => openPendingItem(r)}>
                                            <span className={`wlk-feed__dot ${r.isOverdue ? 'wlk-feed__dot--red' : 'wlk-feed__dot--amber'}`} />
                                            <span className="wlk-feed__main">
                                                <span className="wlk-feed__line">
                                                    <code>{r.referenceCode}</code>
                                                    <span className={`wlk-tag ${r.isOverdue ? 'wlk-tag--red' : 'wlk-tag--amber'}`}>
                                                        {r.isOverdue ? t('feed.overdue') : t('feed.new')}
                                                    </span>
                                                </span>
                                                <span className="wlk-feed__meta">
                                                    {r.branchName} · {r.cashierName || dash} ·{' '}
                                                    {r.officerName || t('feed.unassigned')}
                                                </span>
                                            </span>
                                            <span className="wlk-feed__side">
                                                <strong>{money(r.expectedAmount)}</strong>
                                                <span>{relativeTime(r.createdAt, now, t)}</span>
                                            </span>
                                        </button>
                                    </li>
                                )}
                            />
                            {pendingFeed.total > 0 && canOpenTab('pending') ? (
                                <ViewMore
                                    isRtl={isRtl}
                                    label={t('feed.viewMore', { count: pendingFeed.total })}
                                    onClick={() => onOpenTab('pending')}
                                />
                            ) : null}
                        </Panel>
                    ) : null}

                    {collectedFeed ? (
                        <Panel
                            icon={Wallet}
                            title={t('feed.collectedTitle')}
                            subtitle={t('feed.collectedSub')}
                            badge={collectedFeed.total}
                            className="wlk-panel--green"
                        >
                            <FeedList
                                items={collectedFeed.items}
                                empty={t('feed.emptyCollected')}
                                renderItem={(c) => {
                                    const diff = Number(c.difference || 0);
                                    const diffTag =
                                        diff === 0
                                            ? { cls: 'wlk-tag--green', label: t('feed.exact') }
                                            : diff < 0
                                              ? { cls: 'wlk-tag--red', label: t('feed.short', { amount: amountText(Math.abs(diff)) }) }
                                              : { cls: 'wlk-tag--blue', label: t('feed.over', { amount: amountText(diff) }) };
                                    return (
                                        <li key={c.id}>
                                            <button type="button" className="wlk-feed__item" onClick={() => onOpenTab('history')}>
                                                <span className="wlk-feed__dot wlk-feed__dot--green" />
                                                <span className="wlk-feed__main">
                                                    <span className="wlk-feed__line">
                                                        <code>{c.referenceCode}</code>
                                                        <span className={`wlk-tag ${diffTag.cls}`}>{diffTag.label}</span>
                                                    </span>
                                                    <span className="wlk-feed__meta">
                                                        {c.branchName} · {t('feed.by', { name: c.officerName || dash })}
                                                    </span>
                                                </span>
                                                <span className="wlk-feed__side">
                                                    <strong>{money(c.receivedAmount)}</strong>
                                                    <span>{relativeTime(c.collectedAt, now, t)}</span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                }}
                            />
                            {collectedFeed.total > 0 && canOpenTab('history') ? (
                                <ViewMore
                                    isRtl={isRtl}
                                    label={t('feed.viewMore', { count: collectedFeed.total })}
                                    onClick={() => onOpenTab('history')}
                                />
                            ) : null}
                        </Panel>
                    ) : null}
                </div>
            ) : null}

            <div className="wlk-dash__charts">
                <Panel
                    icon={BarChart3}
                    title={t('chart.trendTitle')}
                    subtitle={t('chart.trendSub')}
                    className="wlk-panel--wide"
                    actions={
                        <Legend
                            items={[
                                { label: t('chart.collected'), color: COLORS.collected },
                                { label: t('chart.requested'), color: COLORS.requested },
                            ]}
                        />
                    }
                >
                    <div className="wlk-chart-total">
                        {t('chart.periodTotals', {
                            collected: money(periodTotals.collected),
                            requested: money(periodTotals.requested),
                        })}
                    </div>
                    {dailyHasData ? (
                        <div className="wlk-chart" style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={daily} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={shortDay}
                                        reversed={isRtl}
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval="preserveStartEnd"
                                        minTickGap={12}
                                    />
                                    <YAxis
                                        orientation={isRtl ? 'right' : 'left'}
                                        tickFormatter={(v) => compact.format(v)}
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={48}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                                        content={
                                            <ChartTooltip
                                                formatLabel={longDay}
                                                formatValue={(v) => money(v)}
                                            />
                                        }
                                    />
                                    <Bar dataKey="collectedAmount" name={t('chart.collected')} fill={COLORS.collected} radius={[4, 4, 0, 0]} maxBarSize={22} />
                                    <Bar dataKey="requestedAmount" name={t('chart.requested')} fill={COLORS.requested} radius={[4, 4, 0, 0]} maxBarSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="wlk-chart-empty">{t('chart.empty')}</div>
                    )}
                </Panel>

                <Panel icon={PieIcon} title={t('chart.pipelineTitle')} subtitle={t('chart.pipelineSub')}>
                    {pipelineTotal > 0 ? (
                        <div className="wlk-donut">
                            <div className="wlk-donut__chart">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pipeline.filter((p) => p.value > 0)}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius="62%"
                                            outerRadius="92%"
                                            paddingAngle={2}
                                            stroke="none"
                                        >
                                            {pipeline
                                                .filter((p) => p.value > 0)
                                                .map((p) => (
                                                    <Cell key={p.key} fill={p.fill} />
                                                ))}
                                        </Pie>
                                        <Tooltip
                                            content={<ChartTooltip formatValue={(v) => t('chart.items', { n: v })} />}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="wlk-donut__center">
                                    <strong>{pipelineTotal}</strong>
                                </div>
                            </div>
                            <ul className="wlk-donut__legend">
                                {pipeline.map((p) => (
                                    <li key={p.key}>
                                        <span className="wlk-dot" style={{ background: p.fill }} />
                                        <span>{p.name}</span>
                                        <strong>{p.value}</strong>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="wlk-chart-empty">{t('chart.empty')}</div>
                    )}
                </Panel>

                <Panel
                    icon={Building2}
                    title={t('chart.branchTitle')}
                    subtitle={t('chart.branchSub')}
                    actions={
                        <Legend
                            items={[
                                { label: t('chart.open'), color: COLORS.open },
                                { label: t('chart.collected'), color: COLORS.collected },
                            ]}
                        />
                    }
                >
                    {byBranch.length ? (
                        <div className="wlk-chart" style={{ height: Math.max(180, byBranch.length * 46 + 40) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byBranch} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f3" />
                                    <XAxis
                                        type="number"
                                        reversed={isRtl}
                                        tickFormatter={(v) => compact.format(v)}
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="branchName"
                                        orientation={isRtl ? 'right' : 'left'}
                                        width={120}
                                        tick={{ fontSize: 11, fill: '#374151' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                                        content={
                                            <ChartTooltip
                                                formatValue={(v, p) => {
                                                    const n =
                                                        p.dataKey === 'pendingAmount'
                                                            ? p.payload.pendingCount
                                                            : p.payload.collectedCount;
                                                    return `${money(v)} · ${t('chart.items', { n })}`;
                                                }}
                                            />
                                        }
                                    />
                                    <Bar dataKey="pendingAmount" name={t('chart.open')} fill={COLORS.open} radius={4} maxBarSize={14} />
                                    <Bar dataKey="collectedAmount" name={t('chart.collected')} fill={COLORS.collected} radius={4} maxBarSize={14} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="wlk-chart-empty">{t('chart.empty')}</div>
                    )}
                </Panel>
            </div>
        </div>
    );
}
