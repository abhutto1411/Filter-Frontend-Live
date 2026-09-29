import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
    connectScopeParams,
    deleteConnectTask,
    listConnectTasks,
    patchConnectTask,
} from '../../services/connectApi';
import ConnectTaskCard from './ConnectTaskCard';
import '../../styles/connect/ConnectHome.css';

const STATUSES = ['Open', 'InProgress', 'Completed', 'Verified'];

const FILTERS = [
    { id: 'all', label: 'All', standing: 'no' },
    { id: 'pending', label: 'Pending', standing: 'no' },
    { id: 'in_progress', label: 'In Progress', standing: 'no' },
    { id: 'completed', label: 'Completed', standing: 'no' },
    { id: 'over', label: 'Over budget', standing: 'no' },
    { id: 'standing', label: 'Standing', standing: 'yes' },
];

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConnectTasksPage() {
    const navigate = useNavigate();
    const { workshopId, branchId, scope } = useOutletContext() ?? {};
    const params = connectScopeParams({ workshopId, branchId });
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');

    const load = () => {
        const spec = FILTERS.find((f) => f.id === filter) || FILTERS[0];
        listConnectTasks({
            ...params,
            standing: spec.standing,
            status: spec.id === 'all' || spec.id === 'standing' ? undefined : spec.id,
        })
            .then((res) => {
                const payload = res?.items ? res : res?.data || {};
                setItems(payload.items || []);
                setSummary(payload.summary || null);
            })
            .catch((e) => setError(e?.message || 'Could not load tasks.'));
    };

    const confirmWrite = (message) => window.confirm(message);

    const cancelTask = async (task) => {
        if (
            !confirmWrite(
                `Cancel “${task.title}”? It will leave the active list. Linked expenses stay in Expenses.`,
            )
        ) {
            return;
        }
        try {
            await patchConnectTask(task.id, { status: 'Cancelled' }, params);
            load();
        } catch (err) {
            setError(err?.message || 'Could not cancel the task.');
        }
    };

    const deleteTask = async (task) => {
        if (
            !confirmWrite(
                `Delete “${task.title}”? This cannot be undone. Linked expenses stay in Expenses, unlinked from this task.`,
            )
        ) {
            return;
        }
        try {
            await deleteConnectTask(task.id, params);
            load();
        } catch (err) {
            setError(err?.message || 'Could not delete the task.');
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId, branchId, filter]);

    return (
        <div className="cn-home">
            <div className="cn-home-head cn-tasks-head">
                <div>
                    <p className="cn-kicker">Task management</p>
                    <h1>Tasks &amp; budget control</h1>
                    <p>
                        Budget is optional on a task. Expenses can still be linked — the task will
                        simply show “No budget set” in budget vs actual. Standing rent / electricity
                        / salary lines are under Standing.
                    </p>
                </div>
                <button
                    type="button"
                    className="cn-action cn-action--gold"
                    onClick={() => navigate('/connect/tasks/new')}
                >
                    <Plus size={16} /> Create new task
                </button>
            </div>

            {error && <div className="cn-home-error">{error}</div>}
            {scope?.allWorkshops && (
                <p className="cn-banner-warn">
                    Pick one workshop in the header to create a task or log spend. You can still
                    browse franchise tasks below.
                </p>
            )}

            {summary && (
                <div className="cn-tiles">
                    <div className="cn-tile">
                        <span className="cn-tile-label">Active tasks</span>
                        <strong className="cn-tile-value">{summary.active}</strong>
                        <span className="cn-tile-sub">{summary.dueThisWeek} due this week</span>
                    </div>
                    <div className="cn-tile">
                        <span className="cn-tile-label">Allocated budget</span>
                        <strong className="cn-tile-value">{sar(summary.budget)}</strong>
                    </div>
                    <div className="cn-tile">
                        <span className="cn-tile-label">Spent (approved)</span>
                        <strong className="cn-tile-value">{sar(summary.spent)}</strong>
                        <span className="cn-tile-sub">
                            {summary.usedPct != null
                                ? `${Math.round(summary.usedPct)}% of allocation`
                                : 'No budget set yet'}
                        </span>
                    </div>
                    <div className={`cn-tile${summary.over ? ' cn-tile--warn' : ''}`}>
                        <span className="cn-tile-label">Over budget</span>
                        <strong className="cn-tile-value">{summary.over}</strong>
                        {summary.overTitle ? (
                            <span className="cn-tile-sub">{summary.overTitle}</span>
                        ) : (
                            <span className="cn-tile-sub">None in this view</span>
                        )}
                    </div>
                </div>
            )}

            <div className="cn-work-filters">
                {FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        className={filter === f.id ? 'is-on' : ''}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="cn-task-list">
                {items.map((t) => (
                    <ConnectTaskCard
                        key={t.id}
                        variant="full"
                        task={t}
                        statuses={STATUSES}
                        onStatus={async (id, status) => {
                            try {
                                await patchConnectTask(id, { status }, params);
                                load();
                            } catch (err) {
                                setError(err?.message || 'Could not update status.');
                            }
                        }}
                        onCancel={cancelTask}
                        onDelete={deleteTask}
                    />
                ))}
                {items.length === 0 && (
                    <p className="cn-panel-empty">
                        {filter === 'standing'
                            ? 'Standing rent / electricity / salary lines appear here after this page loads.'
                            : 'No workshop tasks in this filter. Create one to start tracking spend. If you already created one, pick that workshop in the header — tasks with no branch show under every branch.'}
                    </p>
                )}
            </div>

            <section className="cn-card cn-card--pad cn-rules">
                <h2 className="cn-panel-title">Business rules</h2>
                <ul>
                    <li>Task title and due date are required; budget is optional.</li>
                    <li>Spent updates only after an expense linked to the task is approved.</li>
                    <li>
                        Pending spend is logged in CONNECT and not posted to the ledger until
                        workshop expenses approve it.
                    </li>
                    <li>Cancel keeps the task in Completed; Delete removes it from CONNECT.</li>
                </ul>
            </section>
        </div>
    );
}
