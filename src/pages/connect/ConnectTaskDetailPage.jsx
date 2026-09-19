import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Trash2 } from 'lucide-react';
import {
    connectScopeParams,
    deleteConnectTask,
    getConnectTask,
    logConnectSpend,
    patchConnectTask,
} from '../../services/connectApi';
import { assigneeLine } from './assigneeLine';
import '../../styles/connect/ConnectHome.css';

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConnectTaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { workshopId, branchId } = useOutletContext() ?? {};
    const params = connectScopeParams({ workshopId, branchId });
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [busy, setBusy] = useState(false);

    const load = () => {
        getConnectTask(id, params)
            .then((res) => {
                setData(res);
                setBudget(res?.task?.budget != null ? String(res.task.budget) : '');
            })
            .catch((e) => setError(e?.message || 'Could not load the task.'));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, workshopId, branchId]);

    const task = data?.task;
    const spend = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await logConnectSpend(
                id,
                { amount: Number(amount), description: description.trim() || undefined },
                params,
            );
            setAmount('');
            setDescription('');
            load();
        } catch (err) {
            setError(err?.message || 'Could not log spend.');
        } finally {
            setBusy(false);
        }
    };

    const saveBudget = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await patchConnectTask(id, { budget: Number(budget) || 0 }, params);
            load();
        } catch (err) {
            setError(err?.message || 'Could not save budget.');
        } finally {
            setBusy(false);
        }
    };

    const cancelTask = async () => {
        if (
            !window.confirm(
                `Cancel “${task.title}”? It will leave the active list. Linked expenses stay in Expenses.`,
            )
        ) {
            return;
        }
        setBusy(true);
        try {
            await patchConnectTask(id, { status: 'Cancelled' }, params);
            load();
        } catch (err) {
            setError(err?.message || 'Could not cancel the task.');
        } finally {
            setBusy(false);
        }
    };

    const deleteTask = async () => {
        if (
            !window.confirm(
                `Delete “${task.title}”? This cannot be undone. Linked expenses stay in Expenses, unlinked from this task.`,
            )
        ) {
            return;
        }
        setBusy(true);
        try {
            await deleteConnectTask(id, params);
            navigate('/connect/tasks');
        } catch (err) {
            setError(err?.message || 'Could not delete the task.');
            setBusy(false);
        }
    };

    return (
        <div className="cn-home">
            <button type="button" className="cn-work-back" onClick={() => navigate('/connect/tasks')}>
                <ArrowLeft size={16} /> Back to tasks
            </button>
            {error && <div className="cn-home-error">{error}</div>}
            {!task && !error && <p className="cn-panel-empty">Loading…</p>}
            {task && (
                <>
                    <div className="cn-home-head">
                        <h1>{task.title}</h1>
                        <p>
                            {task.isStanding ? 'Standing opex line · ' : ''}
                            {task.status}
                            {task.deadline ? ` · due ${task.deadline}` : ''}
                            {assigneeLine(task) ? ` · ${assigneeLine(task)}` : ''}
                            {task.branchName || task.workshopName
                                ? ` · ${task.branchName || task.workshopName}`
                                : ''}
                        </p>
                        <div className="cn-task-actions" style={{ marginTop: 12 }}>
                            {task.status !== 'Cancelled' && (
                                <button
                                    type="button"
                                    className="cn-task-act"
                                    disabled={busy}
                                    onClick={cancelTask}
                                >
                                    <Ban size={14} /> Cancel task
                                </button>
                            )}
                            {!task.isStanding && (
                                <button
                                    type="button"
                                    className="cn-task-act cn-task-act--danger"
                                    disabled={busy}
                                    onClick={deleteTask}
                                >
                                    <Trash2 size={14} /> Delete task
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="cn-tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <div className="cn-tile">
                            <span className="cn-tile-label">Budget</span>
                            <strong className="cn-tile-value">{task.budget ? sar(task.budget) : 'Not set'}</strong>
                        </div>
                        <div className="cn-tile">
                            <span className="cn-tile-label">Approved spend</span>
                            <strong className="cn-tile-value">{sar(task.spent)}</strong>
                        </div>
                        <div className={`cn-tile${task.budgetStatus === 'over' ? ' cn-tile--warn' : ''}`}>
                            <span className="cn-tile-label">Remaining</span>
                            <strong className="cn-tile-value">
                                {task.remaining == null ? '—' : sar(task.remaining)}
                            </strong>
                            <span className="cn-tile-sub">
                                {task.pending ? `${sar(task.pending)} pending approval` : task.budgetStatus}
                            </span>
                        </div>
                    </div>

                    <form onSubmit={saveBudget} className="cn-card cn-work-form">
                        <label>
                            Budget (SAR)
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                            />
                        </label>
                        <button type="submit" disabled={busy}>
                            Save budget
                        </button>
                    </form>

                    <form onSubmit={spend} className="cn-card cn-work-form">
                        <strong style={{ gridColumn: '1 / -1' }}>Log spend against this task</strong>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Amount SAR"
                        />
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What was this for?"
                        />
                        <button type="submit" disabled={busy}>
                            {busy ? 'Saving…' : 'Log spend (pending)'}
                        </button>
                        <p className="cn-work-meta" style={{ gridColumn: '1 / -1', margin: 0 }}>
                            Pending until approved in workshop expenses. CONNECT does not post the
                            ledger. Approved amounts become Spent on Budget vs Actual.
                        </p>
                    </form>

                    <div className="cn-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="cn-work-table">
                            <thead>
                                <tr>
                                    <th>Expense</th>
                                    <th>Status</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.expenses || []).map((x) => (
                                    <tr key={x.id}>
                                        <td>
                                            <strong>{x.description || x.category || 'Expense'}</strong>
                                            <div className="cn-work-meta">{x.expenseDate || x.createdAt}</div>
                                        </td>
                                        <td>{x.status}</td>
                                        <td>{sar(x.amount)}</td>
                                    </tr>
                                ))}
                                {(data.expenses || []).length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="cn-panel-empty">
                                            No expenses linked yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
