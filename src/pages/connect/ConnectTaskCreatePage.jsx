import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
    connectScopeParams,
    createConnectTask,
    listConnectAssignees,
} from '../../services/connectApi';
import ConnectAssigneePicker from './ConnectAssigneePicker';
import '../../styles/connect/ConnectHome.css';

const PRIORITIES = ['High', 'Medium', 'Low'];

const empty = {
    title: '',
    description: '',
    deadline: '',
    priority: 'Medium',
    budget: '0',
    relatedLabel: '',
};

export default function ConnectTaskCreatePage() {
    const navigate = useNavigate();
    const { workshopId, branchId, scope } = useOutletContext() ?? {};
    const params = connectScopeParams({ workshopId, branchId });
    const [form, setForm] = useState(empty);
    const [employees, setEmployees] = useState([]);
    const [assignees, setAssignees] = useState([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const allWorkshops = Boolean(scope?.allWorkshops);

    useEffect(() => {
        if (allWorkshops) {
            setEmployees([]);
            return;
        }
        listConnectAssignees(params)
            .then((res) => setEmployees(res?.items || res?.data?.items || []))
            .catch(() => setEmployees([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId, branchId, allWorkshops]);

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) {
            setError('Task title is required.');
            return;
        }
        if (!form.deadline) {
            setError('Due date is required.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const created = await createConnectTask(
                {
                    title: form.title.trim(),
                    description: form.description.trim() || undefined,
                    deadline: form.deadline,
                    priority: form.priority,
                    budget: form.budget ? Number(form.budget) : 0,
                    relatedLabel: form.relatedLabel.trim() || undefined,
                    assignees: assignees.map((a) => ({
                        id: a.id,
                        userId: a.userId || undefined,
                        name: a.name,
                    })),
                    branchId: assignees.find((a) => a.branchId)?.branchId,
                },
                params,
            );
            navigate(created?.id ? `/connect/tasks/${created.id}` : '/connect/tasks');
        } catch (err) {
            setError(
                err?.message ||
                    'Could not create the task. Pick one workshop in the header if you are on All workshops.',
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="cn-create-page" onSubmit={submit}>
            <div className="cn-create-scroll">
                <button
                    type="button"
                    className="cn-work-back"
                    onClick={() => navigate('/connect/tasks')}
                >
                    <ArrowLeft size={16} /> Back to tasks
                </button>

                <div className="cn-home-head">
                    <p className="cn-kicker">Task management</p>
                    <h1>Create new task</h1>
                    <p>
                        Budget is optional. If set, spent and remaining amounts are tracked
                        automatically. Title and due date are required.
                    </p>
                </div>

                {error && <div className="cn-home-error">{error}</div>}
                {allWorkshops && (
                    <p className="cn-banner-warn">
                        Pick one workshop in the header before saving a task.
                    </p>
                )}

                <div className="cn-card cn-card--pad cn-create-form">
                    <label htmlFor="cn-task-title">
                        Task title <span aria-hidden="true">*</span>
                        <input
                            id="cn-task-title"
                            autoFocus
                            value={form.title}
                            onChange={set('title')}
                            placeholder="e.g. Fleet oil service — 12 vehicles"
                            required
                        />
                    </label>

                    <label htmlFor="cn-task-description">
                        Description
                        <textarea
                            id="cn-task-description"
                            rows={5}
                            value={form.description}
                            onChange={set('description')}
                            placeholder="What needs to be done?"
                        />
                    </label>

                    <div className="cn-create-field">
                        <label htmlFor="cn-task-assignees">Assign to</label>
                        <ConnectAssigneePicker
                            inputId="cn-task-assignees"
                            employees={employees}
                            selected={assignees}
                            onChange={setAssignees}
                            disabled={allWorkshops}
                            placeholder={
                                allWorkshops
                                    ? 'Pick a workshop first'
                                    : assignees.length
                                      ? 'Add another employee'
                                      : 'Type to search employees'
                            }
                        />
                    </div>

                    <div className="cn-create-row">
                        <label htmlFor="cn-task-deadline">
                            Due date <span aria-hidden="true">*</span>
                            <input
                                id="cn-task-deadline"
                                type="date"
                                value={form.deadline}
                                onChange={set('deadline')}
                                required
                            />
                        </label>
                        <label htmlFor="cn-task-priority">
                            Priority
                            <select
                                id="cn-task-priority"
                                value={form.priority}
                                onChange={set('priority')}
                            >
                                {PRIORITIES.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label htmlFor="cn-task-budget">
                        Budget (SAR) — optional
                        <input
                            id="cn-task-budget"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.budget}
                            onChange={set('budget')}
                        />
                    </label>

                    <label htmlFor="cn-task-related">
                        Related customer / vehicle — optional
                        <input
                            id="cn-task-related"
                            value={form.relatedLabel}
                            onChange={set('relatedLabel')}
                            placeholder="e.g. Al Rajhi Logistics · Fleet 12 units"
                        />
                    </label>
                </div>
            </div>

            <div className="cn-create-footer">
                <button type="button" className="cn-action" onClick={() => navigate('/connect/tasks')}>
                    Cancel
                </button>
                <button
                    type="submit"
                    className="cn-action cn-action--gold"
                    disabled={busy || allWorkshops}
                >
                    {busy ? 'Saving…' : 'Save task'}
                </button>
            </div>
        </form>
    );
}
