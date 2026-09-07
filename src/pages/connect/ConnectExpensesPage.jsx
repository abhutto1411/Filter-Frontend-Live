import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronRight, Receipt } from 'lucide-react';
import {
    connectScopeParams,
    linkConnectExpense,
    listConnectExpenses,
    listConnectTasks,
} from '../../services/connectApi';
import ConnectExpenseTaskLink from './ConnectExpenseTaskLink';
import '../../styles/connect/ConnectHome.css';

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConnectExpensesPage() {
    const navigate = useNavigate();
    const { workshopId, branchId } = useOutletContext() ?? {};
    const params = connectScopeParams({ workshopId, branchId });
    const [items, setItems] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState('');
    const [unlinkedOnly, setUnlinkedOnly] = useState(false);

    const load = (attempt = 0) => {
        listConnectExpenses({ ...params, unlinked: unlinkedOnly ? 'yes' : undefined })
            .then((res) => {
                setItems(res?.items || res?.data?.items || []);
                setError('');
            })
            .catch((e) => {
                const msg = e?.message || 'Could not load expenses.';
                const unreachable = /cannot reach api/i.test(msg);
                if (unreachable && attempt < 4) {
                    window.setTimeout(() => load(attempt + 1), Math.min(8000, 1000 * (attempt + 1)));
                    if (attempt === 0) setError(msg);
                    return;
                }
                setError(msg);
            });
        listConnectTasks({ ...params, status: 'open', standing: 'no' })
            .then((res) => {
                const rows = res?.items || res?.data?.items || [];
                setTasks(rows.filter((t) => !t.isStanding));
            })
            .catch(() => {});
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId, branchId, unlinkedOnly]);

    return (
        <div className="cn-home">
            <div className="cn-home-head">
                <h1>
                    <Receipt size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    Expenses
                </h1>
                <p>
                    Link an existing expense to a CONNECT task so Budget vs Actual can count it.
                    New spend is logged from the task page. Approval still happens in workshop
                    expenses — CONNECT does not post the ledger.
                </p>
            </div>
            {error && (
                <div className="cn-home-error cn-home-error--row">
                    <span>{error}</span>
                    <button type="button" className="cn-action" onClick={() => load()}>
                        Retry
                    </button>
                </div>
            )}
            <label className="cn-work-meta" style={{ display: 'block', marginBottom: 12 }}>
                <input
                    type="checkbox"
                    checked={unlinkedOnly}
                    onChange={(e) => setUnlinkedOnly(e.target.checked)}
                />{' '}
                Show unlinked only
            </label>
            <div className="cn-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="cn-work-table">
                    <thead>
                        <tr>
                            <th>Expense</th>
                            <th>Status</th>
                            <th>Amount</th>
                            <th>Task</th>
                            <th aria-hidden="true" />
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((x) => (
                            <tr
                                key={x.id}
                                className="cn-work-row"
                                onClick={() => navigate(`/connect/expenses/${x.id}`)}
                            >
                                <td>
                                    <strong>{x.description || x.category || 'Expense'}</strong>
                                    <div className="cn-work-meta">
                                        {x.branchName || ''} {x.expenseDate || ''}
                                    </div>
                                </td>
                                <td>{x.status}</td>
                                <td>{sar(x.amount)}</td>
                                <td>
                                    <ConnectExpenseTaskLink
                                        expense={x}
                                        tasks={tasks}
                                        onLink={async (taskId) => {
                                            try {
                                                await linkConnectExpense(x.id, taskId, params);
                                                load();
                                            } catch (err) {
                                                setError(err?.message || 'Could not link.');
                                            }
                                        }}
                                    />
                                </td>
                                <td className="cn-work-row-go">
                                    <ChevronRight size={16} aria-hidden />
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="cn-panel-empty">
                                    No expenses in this scope. Log spend from a task.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
