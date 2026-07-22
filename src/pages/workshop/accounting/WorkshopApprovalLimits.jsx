import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Shield, RefreshCw } from 'lucide-react';
import {
    bulkUpsertApprovalLimits,
    listApprovalApprovers,
    listApprovalLimits,
    listApprovalRoles,
} from '../../../services/workshopApprovalLimitsApi';
import '../../../styles/admin/AccountingPage.css';

const ROLE_LABELS = {
    manager: 'Manager',
    supervisor: 'Supervisor',
    team_leader: 'Team Leader',
    cashier: 'Cashier',
    technician: 'Technician',
    accounting: 'Accounting',
    staff: 'Staff (other)',
};

export default function WorkshopApprovalLimits() {
    const [rows, setRows] = useState([]);
    const [approvers, setApprovers] = useState([]);
    const [approverRoles, setApproverRoles] = useState(['workshop_admin', 'accounting']);
    const [roleKeys, setRoleKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [limitsRes, rolesRes, apprRes] = await Promise.all([
                listApprovalLimits(),
                listApprovalRoles(),
                listApprovalApprovers(),
            ]);
            const rks = rolesRes?.roles ?? [];
            const existingByRole = new Map((limitsRes?.items ?? []).map((r) => [r.roleKey, r]));
            const merged = rks.map((rk) => existingByRole.get(rk) ?? {
                roleKey: rk,
                perRequestLimit: 0,
                dailyLimit: 0,
                approverUserId: null,
                approverRole: null,
            });
            setRoleKeys(rks);
            setRows(merged);
            setApprovers(apprRes?.users ?? []);
            setApproverRoles(rolesRes?.approverRoles ?? ['workshop_admin', 'accounting']);
        } catch (e) {
            setError(e?.message || 'Could not load approval matrix.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const updateRow = (idx, patch) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };

    const save = async () => {
        setMsg('');
        setError('');
        setSaving(true);
        try {
            const items = rows.map((r) => ({
                roleKey: r.roleKey,
                perRequestLimit: Number(r.perRequestLimit) || 0,
                dailyLimit: Number(r.dailyLimit) || 0,
                approverUserId: r.approverUserId ? String(r.approverUserId) : undefined,
                approverRole: r.approverRole || undefined,
            }));
            const res = await bulkUpsertApprovalLimits(items);
            setMsg(`Saved ${res?.count ?? items.length} role rules.`);
            await loadAll();
        } catch (e) {
            setError(e?.message || 'Could not save approval matrix.');
        } finally {
            setSaving(false);
        }
    };

    const summary = useMemo(() => {
        const configured = rows.filter((r) => Number(r.perRequestLimit) > 0 || Number(r.dailyLimit) > 0).length;
        return { configured, total: rows.length };
    }, [rows]);

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title"><Shield size={20} style={{ marginRight: 8 }} />Approval Limits</h2>
                <p className="cash-bank-desc">
                    Set per-request and daily approval limits per role, and designate the default approver.
                    Workshop owner and accounting can always approve in parallel.
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}
            {msg ? <p className="form-help-text" style={{ color: '#065F46' }}>{msg}</p> : null}

            <div className="cash-bank-actions" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button type="button" className="btn-portal" disabled={saving || loading} onClick={save}>
                    <Save size={16} style={{ marginRight: 6 }} /> {saving ? 'Saving…' : 'Save Matrix'}
                </button>
                <button type="button" className="btn-portal-outline" disabled={loading} onClick={loadAll}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Refresh
                </button>
                <span style={{ marginLeft: 'auto', color: '#64748B' }}>
                    {summary.configured}/{summary.total} roles configured
                </span>
            </div>

            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Role</th>
                            <th className="table-th">Per-Request Limit (SAR)</th>
                            <th className="table-th">Daily Limit (SAR)</th>
                            <th className="table-th">Designated Approver</th>
                            <th className="table-th">Fallback Approver Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="table-cell table-empty">Loading…</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={5} className="table-cell table-empty">No roles available.</td></tr>
                        ) : rows.map((r, idx) => (
                            <tr key={r.roleKey}>
                                <td className="table-cell">
                                    <strong>{ROLE_LABELS[r.roleKey] ?? r.roleKey}</strong>
                                    <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>{r.roleKey}</div>
                                </td>
                                <td className="table-cell">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input-field"
                                        value={r.perRequestLimit ?? 0}
                                        onChange={(e) => updateRow(idx, { perRequestLimit: e.target.value })}
                                    />
                                </td>
                                <td className="table-cell">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input-field"
                                        value={r.dailyLimit ?? 0}
                                        onChange={(e) => updateRow(idx, { dailyLimit: e.target.value })}
                                    />
                                </td>
                                <td className="table-cell">
                                    <select
                                        className="form-input-field"
                                        value={r.approverUserId ?? ''}
                                        onChange={(e) => updateRow(idx, { approverUserId: e.target.value || null })}
                                    >
                                        <option value="">— Use role fallback —</option>
                                        {approvers.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name || u.email} ({u.role || u.userType})
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="table-cell">
                                    <select
                                        className="form-input-field"
                                        value={r.approverRole ?? ''}
                                        onChange={(e) => updateRow(idx, { approverRole: e.target.value || null })}
                                    >
                                        <option value="">— None —</option>
                                        {approverRoles.map((role) => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <p className="form-help-text" style={{ marginTop: 12 }}>
                If a request is within the limits, the designated approver (or fallback role) handles it. Otherwise
                it escalates to the workshop admin. Accounting users may always approve in parallel.
            </p>
        </div>
    );
}
