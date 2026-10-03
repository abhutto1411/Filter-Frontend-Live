import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Trash2 } from 'lucide-react';
import { assigneeLine } from './assigneeLine';

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(status) {
    if (status === 'Open') return 'Pending';
    if (status === 'InProgress') return 'In Progress';
    if (status === 'Verified' || status === 'Done') return 'Completed';
    return status;
}

export default function ConnectTaskCard({
    task,
    onStatus,
    onCancel,
    onDelete,
    statuses,
    variant = 'compact',
}) {
    const navigate = useNavigate();
    if (!task) return null;
    const over = task.budgetStatus === 'over';
    const warn = task.budgetStatus === 'warning';
    const noBudget = !task.budget;
    const todayIso = new Date().toISOString().slice(0, 10);
    const overdue = Boolean(
        task.deadline &&
            task.deadline < todayIso &&
            !['Completed', 'Verified', 'Cancelled', 'Done'].includes(task.status),
    );
    const cancelled = task.status === 'Cancelled';
    const canCancel = Boolean(onCancel) && !cancelled;
    const canDelete = Boolean(onDelete) && !task.isStanding;

    const actions = (canCancel || canDelete || (onStatus && statuses)) && (
        <div className="cn-task-actions" onClick={(e) => e.stopPropagation()}>
            {onStatus && statuses ? (
                <select
                    className="cn-task-status"
                    value={task.status}
                    onChange={(e) => onStatus(task.id, e.target.value)}
                >
                    {statuses.map((s) => (
                        <option key={s} value={s}>
                            {statusLabel(s)}
                        </option>
                    ))}
                    {!statuses.includes(task.status) && (
                        <option value={task.status}>{statusLabel(task.status)}</option>
                    )}
                </select>
            ) : null}
            {canCancel && (
                <button
                    type="button"
                    className="cn-task-act"
                    onClick={() => onCancel(task)}
                >
                    <Ban size={14} /> Cancel
                </button>
            )}
            {canDelete && (
                <button
                    type="button"
                    className="cn-task-act cn-task-act--danger"
                    onClick={() => onDelete(task)}
                >
                    <Trash2 size={14} /> Delete
                </button>
            )}
        </div>
    );

    if (variant === 'full') {
        const max = Math.max(task.budget || 0, task.spent || 0, 1);
        const remainingCopy = noBudget
            ? 'Budget vs actual unavailable for this task.'
            : over
              ? `Over by ${sar(Math.abs(task.remaining ?? 0))}`
              : `${sar(task.remaining)} remaining`;
        return (
            <article
                className={`cn-task-full${over ? ' is-over' : warn ? ' is-warn' : ''}${cancelled ? ' is-cancelled' : ''}`}
                onClick={() => navigate(`/connect/tasks/${task.id}`)}
            >
                <div className="cn-task-kicker">
                    <span className="cn-task-code">{task.code || `TSK-${task.id}`}</span>
                    {task.priority === 'High' && <span className="cn-pill cn-pill--warn">High</span>}
                    {task.priority === 'Medium' && <span className="cn-pill">{task.priority}</span>}
                    {task.priority === 'Low' && <span className="cn-pill">{task.priority}</span>}
                    {over && <span className="cn-pill cn-pill--danger">Over budget</span>}
                    {overdue && <span className="cn-pill cn-pill--danger">Overdue</span>}
                    {task.isStanding && <span className="cn-pill">Standing</span>}
                    <span className="cn-pill">{statusLabel(task.status)}</span>
                </div>
                <h2>{task.title}</h2>
                {task.description ? <p className="cn-task-desc">{task.description}</p> : null}
                <dl className="cn-task-grid">
                    <div>
                        <dt>{(task.assignees?.length || 0) > 1 ? 'Assignees' : 'Assignee'}</dt>
                        <dd>{assigneeLine(task) || 'Unassigned'}</dd>
                    </div>
                    <div>
                        <dt>Branch</dt>
                        <dd>{task.branchName || task.workshopName || '—'}</dd>
                    </div>
                    <div>
                        <dt>Due</dt>
                        <dd>{task.deadline || '—'}</dd>
                    </div>
                    <div>
                        <dt>Expenses</dt>
                        <dd>
                            {task.expenseCount || 0} linked
                        </dd>
                    </div>
                </dl>
                <div className="cn-task-bva">
                    <div className="cn-task-bva-head">
                        <span>Budget vs actual</span>
                        <strong className={over ? 'cn-work-over' : ''}>{remainingCopy}</strong>
                    </div>
                    <span className="cn-mini-bars cn-mini-bars--wide" aria-hidden="true">
                        {task.budget > 0 && (
                            <span className="cn-mini-budget" style={{ width: `${(task.budget / max) * 100}%` }} />
                        )}
                        <span
                            className={`cn-mini-spent${over ? ' is-over' : ''}`}
                            style={{ width: `${(task.spent / max) * 100}%` }}
                        />
                    </span>
                    <p>
                        {noBudget
                            ? 'No budget set'
                            : `Spent ${sar(task.spent)} · Budget ${sar(task.budget)}`}
                        {task.pending ? ` · ${sar(task.pending)} pending` : ''}
                    </p>
                </div>
                {task.relatedLabel ? (
                    <p className="cn-task-related">Linked customer: {task.relatedLabel}</p>
                ) : null}
                {actions}
            </article>
        );
    }

    const meta = [
        assigneeLine(task) || null,
        task.branchName || task.workshopName,
        task.deadline ? `due ${task.deadline}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <article
            className={`cn-task-card${over ? ' is-over' : warn ? ' is-warn' : ''}${cancelled ? ' is-cancelled' : ''}`}
            onClick={() => navigate(`/connect/tasks/${task.id}`)}
        >
            <header className="cn-task-card-head">
                <div>
                    <strong>{task.title}</strong>
                    {meta ? <p>{meta}</p> : null}
                </div>
                <div className="cn-task-card-tags">
                    {over && <span className="cn-pill cn-pill--danger">Over budget</span>}
                    {overdue && <span className="cn-pill cn-pill--danger">Overdue</span>}
                    {task.priority === 'High' && !over && (
                        <span className="cn-pill cn-pill--warn">{task.priority}</span>
                    )}
                    {task.isStanding && <span className="cn-pill">Standing</span>}
                    <span className="cn-pill">{statusLabel(task.status)}</span>
                </div>
            </header>
            <footer className="cn-task-card-foot">
                <span className={over ? 'cn-work-over' : ''}>
                    {sar(task.spent)}
                    {noBudget ? ' · No budget set' : ` of ${sar(task.budget)}`}
                    {task.pending ? ` · ${sar(task.pending)} pending` : ''}
                </span>
                {actions || <MiniSpend budget={task.budget} spent={task.spent} over={over} />}
            </footer>
        </article>
    );
}

function MiniSpend({ budget, spent, over }) {
    const max = Math.max(budget || 0, spent || 0, 1);
    return (
        <span className="cn-mini-bars" aria-hidden="true">
            {budget > 0 && (
                <span className="cn-mini-budget" style={{ width: `${(budget / max) * 100}%` }} />
            )}
            <span
                className={`cn-mini-spent${over ? ' is-over' : ''}`}
                style={{ width: `${(spent / max) * 100}%` }}
            />
        </span>
    );
}
