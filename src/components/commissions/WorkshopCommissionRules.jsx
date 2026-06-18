import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import WorkshopSubScreen from '../workshop/WorkshopSubScreen';
import {
    createWorkshopCommissionRule,
    deleteWorkshopCommissionRule,
    getWorkshopCommissionRuleServices,
    getWorkshopCommissionRules,
    updateWorkshopCommissionRule,
} from '../../services/workshopCommissionsApi';

const ROLE_OPTIONS = [
    'Technician',
    'Senior Technician',
    'Master Technician',
    'Supervisor',
    'Manager',
];

const TYPE_OPTIONS = [
    { value: 'Percentage', label: 'Percentage of total (%)' },
    { value: 'Fixed', label: 'Fixed amount per job (SAR)' },
];

const baseForm = {
    serviceId: '',
    serviceName: '',
    employeeRole: 'Technician',
    commissionType: 'Percentage',
    value: 0,
    priority: 1,
    status: 'active',
    notes: '',
};

function getErrorMessage(err) {
    return err?.message || 'Something went wrong, please try again.';
}

function parseRules(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

function parseServices(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.services)) return res.services;
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

/** A self-contained Commission Rules CRUD panel (workshop-scoped). */
export default function WorkshopCommissionRules() {
    const [rules, setRules] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadTick, setReloadTick] = useState(0);
    const [search, setSearch] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [form, setForm] = useState(baseForm);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [deleteLoadingId, setDeleteLoadingId] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getWorkshopCommissionRuleServices();
                if (!cancelled) setServices(parseServices(res));
            } catch {
                /* services dropdown is optional */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await getWorkshopCommissionRules(search);
                if (cancelled) return;
                setRules(parseRules(res));
            } catch (err) {
                if (!cancelled) setError(getErrorMessage(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [reloadTick, search]);

    const openCreate = () => {
        setEditingId('');
        setForm(baseForm);
        setSubmitError('');
        setModalOpen(true);
    };

    const openEdit = (rule) => {
        setEditingId(String(rule.id));
        setForm({
            serviceId: rule.serviceId ? String(rule.serviceId) : '',
            serviceName: rule.serviceName || '',
            employeeRole: rule.employeeRole || 'Technician',
            commissionType: rule.commissionType || 'Percentage',
            value: Number(rule.value || 0),
            priority: Number(rule.priority || 1),
            status: rule.status || 'active',
            notes: rule.notes || '',
        });
        setSubmitError('');
        setModalOpen(true);
    };

    const closeModal = () => {
        if (submitting) return;
        setModalOpen(false);
        setSubmitError('');
    };

    const onSubmit = async () => {
        if (!form.serviceName.trim()) {
            setSubmitError('Service name is required (or pick a service from the list).');
            return;
        }
        if (form.value === '' || form.value === null || Number.isNaN(Number(form.value))) {
            setSubmitError('Value is required.');
            return;
        }
        setSubmitting(true);
        setSubmitError('');
        try {
            const payload = {
                serviceId: form.serviceId || undefined,
                serviceName: form.serviceName.trim(),
                employeeRole: form.employeeRole,
                commissionType: form.commissionType,
                value: Number(form.value),
                priority: Number(form.priority || 1),
                status: form.status,
                notes: form.notes?.trim() || undefined,
            };
            if (editingId) {
                await updateWorkshopCommissionRule(editingId, payload);
            } else {
                await createWorkshopCommissionRule(payload);
            }
            setModalOpen(false);
            setReloadTick((x) => x + 1);
        } catch (err) {
            setSubmitError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const onDelete = async (id) => {
        setDeleteLoadingId(id);
        try {
            await deleteWorkshopCommissionRule(id);
            setPendingDeleteId('');
            setReloadTick((x) => x + 1);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDeleteLoadingId('');
        }
    };

    const onServicePick = (id) => {
        const svc = services.find((s) => String(s.id) === String(id));
        setForm((p) => ({
            ...p,
            serviceId: id,
            serviceName: svc?.name || svc?.serviceName || p.serviceName,
        }));
    };

    const sortedRules = useMemo(() => {
        return [...rules].sort((a, b) => {
            const pri = Number(a.priority || 0) - Number(b.priority || 0);
            if (pri !== 0) return pri;
            return String(a.serviceName || '').localeCompare(String(b.serviceName || ''));
        });
    }, [rules]);

    if (modalOpen) {
        return (
            <WorkshopSubScreen
                title={editingId ? 'Edit Commission Rule' : 'New Commission Rule'}
                subtitle="Service, role, and commission rate for the priority engine."
                backLabel="Back to Commission Rules"
                onBack={closeModal}
                backDisabled={submitting}
                size="form"
                maxWidth="600px"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={submitting}
                            className="ws-btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={submitting}
                            className="ws-btn-confirm"
                        >
                            {submitting ? 'Saving...' : editingId ? 'Update Rule' : 'Create Rule'}
                        </button>
                    </div>
                )}
            >
                <div className="ws-section" style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Priority *</label>
                            <input
                                type="number"
                                min={1}
                                value={form.priority}
                                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                                style={inputStyle}
                            >
                                <option value="active">active</option>
                                <option value="inactive">inactive</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Service *</label>
                            <select
                                value={form.serviceId}
                                onChange={(e) => onServicePick(e.target.value)}
                                style={inputStyle}
                            >
                                <option value="">Custom service name (no link)</option>
                                {services.map((s) => (
                                    <option key={String(s.id)} value={String(s.id)}>
                                        {s.name || s.serviceName}
                                    </option>
                                ))}
                            </select>
                            <input
                                placeholder="Service name (e.g. Oil Change)"
                                value={form.serviceName}
                                onChange={(e) => setForm((p) => ({ ...p, serviceName: e.target.value }))}
                                style={{ ...inputStyle, marginTop: 8 }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Employee role</label>
                            <select
                                value={form.employeeRole}
                                onChange={(e) => setForm((p) => ({ ...p, employeeRole: e.target.value }))}
                                style={inputStyle}
                            >
                                {ROLE_OPTIONS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Type</label>
                            <select
                                value={form.commissionType}
                                onChange={(e) => setForm((p) => ({ ...p, commissionType: e.target.value }))}
                                style={inputStyle}
                            >
                                {TYPE_OPTIONS.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                Value {form.commissionType === 'Percentage' ? '(%)' : '(SAR)'}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.value}
                                onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>
                        <div></div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Notes</label>
                            <textarea
                                rows={3}
                                value={form.notes}
                                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                            />
                        </div>
                        {submitError && (
                            <div style={{ gridColumn: 'span 2', color: '#dc2626', fontSize: 13 }}>{submitError}</div>
                        )}
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    return (
        <div style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>Commission Rules</h3>
                <span style={{ color: '#6b7280', fontSize: 13 }}>
                    Priority engine: smaller priority value wins. Falls back to employee default percent if nothing matches.
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} color="#6b7280" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search rules"
                            style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: 6,
                                padding: '8px 12px 8px 30px',
                                fontSize: 13,
                                outline: 'none',
                            }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={openCreate}
                        style={{
                            border: 'none',
                            background: '#D4A017',
                            color: '#fff',
                            borderRadius: 6,
                            padding: '8px 14px',
                            display: 'inline-flex',
                            gap: 6,
                            alignItems: 'center',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        <Plus size={14} /> New Rule
                    </button>
                </div>
            </div>

            {error && <div style={{ color: '#dc2626', marginBottom: 8, fontSize: 13 }}>{error}</div>}

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Priority', 'Service', 'Role', 'Type', 'Value', 'Status', 'Actions'].map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        textAlign: 'left',
                                        padding: '10px 8px',
                                        fontSize: 12,
                                        color: '#6b7280',
                                        borderBottom: '1px solid #e5e7eb',
                                    }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : sortedRules.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    No commission rules yet — start by creating one.
                                </td>
                            </tr>
                        ) : (
                            sortedRules.map((r) => {
                                const id = String(r.id);
                                const value =
                                    r.commissionType === 'Percentage'
                                        ? `${Number(r.value || 0)}%`
                                        : `SAR ${Number(r.value || 0).toLocaleString()}`;
                                return (
                                    <tr key={id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.priority || 1}</td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <div style={{ fontWeight: 600 }}>{r.serviceName || '—'}</div>
                                            {r.notes && (
                                                <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{r.notes}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{r.employeeRole || 'Technician'}</td>
                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{r.commissionType || 'Percentage'}</td>
                                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{value}</td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <span
                                                style={{
                                                    background: (r.status || 'active') === 'active' ? '#dcfce7' : '#fee2e2',
                                                    color: (r.status || 'active') === 'active' ? '#16a34a' : '#dc2626',
                                                    padding: '2px 8px',
                                                    borderRadius: 999,
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {(r.status || 'active').toLowerCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                            {pendingDeleteId === id ? (
                                                <span style={{ display: 'inline-flex', gap: 8, fontSize: 12 }}>
                                                    <span>Delete?</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(id)}
                                                        disabled={deleteLoadingId === id}
                                                        style={{
                                                            border: '1px solid #ef4444',
                                                            background: '#fff',
                                                            color: '#ef4444',
                                                            borderRadius: 4,
                                                            padding: '2px 8px',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        {deleteLoadingId === id ? 'Deleting...' : 'Yes'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPendingDeleteId('')}
                                                        style={{
                                                            border: '1px solid #e5e7eb',
                                                            background: '#fff',
                                                            borderRadius: 4,
                                                            padding: '2px 8px',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', gap: 12 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(r)}
                                                        title="Edit"
                                                        style={{
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: '#6b7280',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                        }}
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPendingDeleteId(id)}
                                                        title="Delete"
                                                        style={{
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: '#ef4444',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}

const inputStyle = {
    width: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
};
