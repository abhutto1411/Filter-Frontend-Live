import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ClipboardList,
    PackageMinus,
    Plus,
    Receipt,
    Sparkles,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { connectScopeParams, getConnectHome } from '../../services/connectApi';
import ConnectAdherenceList from './ConnectAdherenceList';
import ConnectBudgetCategoryBars from './ConnectBudgetCategoryBars';
import ConnectRevenueChart, { ConnectSparkline } from './ConnectRevenueChart';
import ConnectTaskCard from './ConnectTaskCard';
import '../../styles/connect/ConnectHome.css';

const STARTERS = [
    'How much have we sold this month?',
    'Compare this month to our old income statements',
    'Analyse every department this month',
];

const sar = (n) =>
    `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function clockGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function ConnectHome() {
    const navigate = useNavigate();
    const { branchId, workshopId, scope } = useOutletContext() ?? {};

    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loadedBranch, setLoadedBranch] = useState(null);

    const scopeParams = useMemo(
        () => connectScopeParams({ workshopId, branchId }),
        [workshopId, branchId],
    );
    const branchKey = `${workshopId ?? ''}|${branchId ?? ''}`;
    const busy = loadedBranch !== branchKey;

    useEffect(() => {
        let cancelled = false;
        const key = branchKey;

        getConnectHome(scopeParams)
            .then((res) => {
                if (cancelled) return;
                setData(res);
                setError('');
            })
            .catch((e) => {
                if (!cancelled) setError(e?.message || 'Could not load the command center.');
            })
            .finally(() => {
                if (!cancelled) setLoadedBranch(key);
            });

        return () => {
            cancelled = true;
        };
    }, [branchKey, scopeParams]);

    const tiles = data?.tiles;
    const firstName = (data?.scope?.user || scope?.user || '').split(' ')[0];
    const branches = scope?.branches ?? data?.scope?.branches ?? [];
    const branchCount = data?.scope?.branchCount ?? branches.length;

    let scopeLine;
    if (scope?.allWorkshops) {
        scopeLine = 'Showing all franchise workshops.';
    } else if (branchId) {
        const name = branches.find((b) => String(b.id) === String(branchId))?.name;
        scopeLine = name ? `Showing ${name} only.` : 'Showing the selected branch only.';
    } else if (branches.length === 1) {
        scopeLine = `Showing ${branches[0].name}.`;
    } else {
        scopeLine = 'Showing every branch you have access to.';
    }

    const facts = [];
    if (tiles) {
        if (tiles.myTasks.open) {
            facts.push(`${tiles.myTasks.open} open workshop task${tiles.myTasks.open === 1 ? '' : 's'}`);
        } else if (tiles.myTasks.standing) {
            facts.push(`${tiles.myTasks.standing} standing budget line${tiles.myTasks.standing === 1 ? '' : 's'} this month`);
        }
        if (tiles.pendingApprovals) {
            facts.push(
                `${tiles.pendingApprovals} expense${tiles.pendingApprovals === 1 ? '' : 's'} waiting for approval`,
            );
        }
        if (branchCount) facts.push(`${branchCount} branch${branchCount === 1 ? '' : 'es'} in this view`);
    }

    const monthSub = (() => {
        if (!tiles) return null;
        if (tiles.salesThisMonth.deltaPct != null) {
            const d = tiles.salesThisMonth.deltaPct;
            const sign = d > 0 ? '+' : '';
            return `${tiles.salesThisMonth.invoiceCount} invoices · ${sign}${d}% vs last month`;
        }
        if (tiles.salesThisMonth.invoiceCount > 0) {
            return `${tiles.salesThisMonth.invoiceCount} invoices since ${tiles.salesThisMonth.since}`;
        }
        return tiles.lastInvoiceDate
            ? `No invoices yet · last one ${tiles.lastInvoiceDate}`
            : 'No invoices recorded';
    })();

    const budgetSub = (() => {
        if (!tiles?.budget) return null;
        if (!(tiles.budget.budget > 0)) return 'No budget set on assigned tasks';
        if (tiles.budget.over) return `${tiles.budget.over} task${tiles.budget.over === 1 ? '' : 's'} over budget`;
        return `${sar(tiles.budget.spent)} of ${sar(tiles.budget.budget)}`;
    })();

    const onTimeSub = (() => {
        const t = tiles?.tasksOnTime;
        if (!t) return null;
        if (!t.withDeadline) return 'No due dates on workshop tasks';
        return t.overdue ? `${t.overdue} overdue of ${t.withDeadline} dated` : `${t.withDeadline} with a due date`;
    })();

    const taskCards = data?.taskFeed?.length ? data.taskFeed : data?.attentionTasks || [];

    return (
        <div className="cn-home">
            <div className="cn-home-head">
                <h1>
                    {clockGreeting()}, {firstName || 'there'}
                </h1>
                <p>
                    {scopeLine}
                    {facts.length ? ` ${facts.join('. ')}.` : ''}
                </p>
            </div>

            {error && <div className="cn-home-error">{error}</div>}

            <div className="cn-actions">
                <button type="button" className="cn-action cn-action--gold" onClick={() => navigate('/connect/ai')}>
                    <Sparkles size={16} /> Ask the AI Assistant
                </button>
                <button type="button" className="cn-action" onClick={() => navigate('/connect/expenses')}>
                    <Receipt size={16} /> Review expenses
                </button>
                <button type="button" className="cn-action" onClick={() => navigate('/connect/tasks')}>
                    <ClipboardList size={16} /> Open tasks
                </button>
            </div>

            <div className="cn-tiles">
                <Tile
                    icon={<TrendingUp size={16} />}
                    label="Month sales"
                    loading={busy}
                    value={tiles ? sar(tiles.salesThisMonth.revenue) : null}
                    sub={monthSub}
                    spark={<ConnectSparkline points={data?.dailySeries} />}
                />
                <Tile
                    icon={<Wallet size={16} />}
                    label="Budget vs actual"
                    loading={busy}
                    value={
                        tiles?.budget?.usedPct != null
                            ? `${Math.round(tiles.budget.usedPct)}%`
                            : tiles
                              ? '0%'
                              : null
                    }
                    sub={budgetSub}
                    tone={!busy && tiles?.budget?.over > 0 ? 'warn' : undefined}
                    onClick={() => navigate('/connect/budget')}
                />
                <Tile
                    icon={<CheckCircle2 size={16} />}
                    label="Pending approvals"
                    loading={busy}
                    value={tiles ? String(tiles.pendingApprovals ?? 0) : null}
                    sub="Expense requests not yet approved"
                    tone={!busy && tiles?.pendingApprovals > 0 ? 'warn' : undefined}
                    onClick={() => navigate('/connect/expenses')}
                />
                <Tile
                    icon={<ClipboardList size={16} />}
                    label="Tasks on time"
                    loading={busy}
                    value={
                        tiles?.tasksOnTime?.pct != null ? `${Math.round(tiles.tasksOnTime.pct)}%` : tiles ? '—' : null
                    }
                    sub={onTimeSub}
                    tone={!busy && tiles?.tasksOnTime?.overdue > 0 ? 'warn' : undefined}
                    onClick={() => navigate('/connect/tasks')}
                />
            </div>

            <div className="cn-hero-grid">
                <section className="cn-panel cn-panel--chart">
                    <header className="cn-panel-head">
                        <span className="cn-panel-title">
                            <TrendingUp size={16} />
                            Month sales
                        </span>
                        <span className="cn-panel-legend">
                            <i className="cn-dot cn-dot--gold" /> This year
                            {data?.hasLastYear ? (
                                <>
                                    <i className="cn-dot cn-dot--muted" /> Last year
                                </>
                            ) : null}
                        </span>
                    </header>
                    <ConnectRevenueChart
                        loading={busy}
                        series={data?.revenueSeries}
                        hasLastYear={Boolean(data?.hasLastYear)}
                    />
                    <p className="cn-panel-hint">
                        Live FILTER POS invoices, including VAT. Last year is the same months from
                        POS — not a forecast.
                    </p>
                </section>

                <section className="cn-panel">
                    <header className="cn-panel-head">
                        <span className="cn-panel-title">
                            <Sparkles size={16} />
                            Live insights
                        </span>
                    </header>
                    {busy && <div className="cn-skeleton-rows" />}
                    {!busy &&
                        (data?.insights || []).map((item) => (
                            <article className={`cn-insight cn-insight--${item.tone}`} key={item.id}>
                                <strong>{item.title}</strong>
                                <p>{item.body}</p>
                            </article>
                        ))}
                </section>
            </div>

            <div className="cn-panels">
                <section className="cn-panel cn-panel--chart">
                    <header className="cn-panel-head">
                        <span className="cn-panel-title">
                            <Wallet size={16} />
                            Budget vs actual by task
                        </span>
                        <button type="button" className="cn-work-link" onClick={() => navigate('/connect/budget')}>
                            Open
                        </button>
                    </header>
                    {busy ? (
                        <div className="cn-skeleton-rows cn-chart-skeleton" />
                    ) : (
                        <ConnectBudgetCategoryBars categories={data?.budgetByCategory} />
                    )}
                    <p className="cn-panel-hint">
                        Gold is the task budget. Dark is approved spend linked to that task.
                    </p>
                </section>

                <section className="cn-panel">
                    <header className="cn-panel-head">
                        <span className="cn-panel-title">
                            <Wallet size={16} />
                            Budget used
                        </span>
                    </header>
                    {busy ? (
                        <div className="cn-skeleton-rows" />
                    ) : (
                        <ConnectAdherenceList categories={data?.budgetByCategory} />
                    )}
                </section>
            </div>

            <section className="cn-panel cn-panel--wide">
                <header className="cn-panel-head">
                    <span className="cn-panel-title">
                        <ClipboardList size={16} />
                        Tasks awaiting attention
                    </span>
                    <button type="button" className="cn-work-link" onClick={() => navigate('/connect/tasks')}>
                        All tasks
                    </button>
                </header>
                {busy && <div className="cn-skeleton-rows" />}
                {!busy && taskCards.length === 0 && (
                    <p className="cn-panel-empty">
                        No workshop tasks yet. Standing rent / electricity / salary lines live on
                        Tasks and Budget vs Actual.
                    </p>
                )}
                {!busy &&
                    taskCards.map((t) => <ConnectTaskCard key={t.id} task={t} />)}
                <button
                    type="button"
                    className="cn-action cn-action--gold cn-assign"
                    onClick={() => navigate('/connect/tasks/new')}
                >
                    <Plus size={16} /> Assign new task
                </button>
            </section>

            <div className="cn-panels">
                <section className="cn-panel">
                    <header className="cn-panel-head">
                        <span className="cn-panel-title">
                            <PackageMinus size={16} />
                            Low stock
                        </span>
                        {!busy && tiles?.lowStock.count > 0 && (
                            <span className="cn-pill cn-pill--warn">
                                <AlertTriangle size={12} />
                                {tiles.lowStock.count} item{tiles.lowStock.count === 1 ? '' : 's'}
                            </span>
                        )}
                    </header>
                    {busy && <div className="cn-skeleton-rows" />}
                    {!busy && tiles?.lowStock.items?.length === 0 && (
                        <p className="cn-panel-empty">
                            Nothing is below its critical stock point right now.
                            {tiles.lowStock.activeProducts > 0 && (
                                <span className="cn-panel-hint">
                                    {tiles.lowStock.withThreshold} of {tiles.lowStock.activeProducts}{' '}
                                    active products have a critical stock point set.
                                </span>
                            )}
                        </p>
                    )}
                    {!busy &&
                        tiles?.lowStock.items?.map((item, i) => (
                            <div className="cn-row" key={`${item.product}-${item.branch}-${i}`}>
                                <div className="cn-row-main">
                                    <strong>{item.product}</strong>
                                    <span>{item.branch}</span>
                                </div>
                                <div className="cn-row-side">
                                    <strong>{item.qtyOnHand}</strong>
                                    <span>of {item.criticalPoint}</span>
                                </div>
                            </div>
                        ))}
                </section>

                <section className="cn-panel cn-panel--ai">
                    <header className="cn-panel-head">
                        <span className="cn-panel-title">
                            <Sparkles size={16} />
                            Ask AI
                        </span>
                    </header>
                    <p className="cn-ai-blurb">
                        Sales, stock, departments and old income statements — from FILTER POS, not
                        a mock.
                    </p>
                    <div className="cn-ai-starters">
                        {STARTERS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className="cn-ai-starter"
                                onClick={() => navigate('/connect/ai', { state: { question: s } })}
                            >
                                {s}
                                <ArrowRight size={14} />
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

function Tile({ icon, label, value, sub, loading, tone, onClick, spark }) {
    const className = `cn-tile${tone ? ` cn-tile--${tone}` : ''}${onClick ? ' cn-tile--click' : ''}`;
    const inner = (
        <>
            <span className="cn-tile-icon">{icon}</span>
            <span className="cn-tile-label">{label}</span>
            {loading ? (
                <span className="cn-tile-skeleton" />
            ) : (
                <>
                    <strong className="cn-tile-value">{value ?? '—'}</strong>
                    {sub && <span className="cn-tile-sub">{sub}</span>}
                    {spark}
                </>
            )}
        </>
    );
    if (onClick) {
        return (
            <button type="button" className={className} onClick={onClick}>
                {inner}
            </button>
        );
    }
    return <div className={className}>{inner}</div>;
}
