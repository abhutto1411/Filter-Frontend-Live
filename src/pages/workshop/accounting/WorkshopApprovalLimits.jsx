import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Shield, RefreshCw } from 'lucide-react';
import {
    bulkUpsertApprovalLimits,
    listApprovalApprovers,
    listApprovalLimits,
    listApprovalRoles,
} from '../../../services/workshopApprovalLimitsApi';
import { accT } from '../../../utils/accountingI18n';
import '../../../styles/admin/AccountingPage.css';

export default function WorkshopApprovalLimits({ locale: localeProp } = {}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const roleLabel = useCallback(
        (roleKey) => {
            const key = `approvalLimits.role.${roleKey}`;
            const translated = t(key);
            return translated === key ? roleKey : translated;
        },
        [t],
    );

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
            setError(e?.message || t('approvalLimits.err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

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
            setMsg(t('approvalLimits.saved', { n: res?.count ?? items.length }));
            await loadAll();
        } catch (e) {
            setError(e?.message || t('approvalLimits.err.save'));
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
                <h2 className="cash-bank-title"><Shield size={20} style={{ marginRight: 8 }} />{t('approvalLimits.title')}</h2>
                <p className="cash-bank-desc">
                    {t('approvalLimits.desc')}
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}
            {msg ? <p className="form-help-text" style={{ color: '#065F46' }}>{msg}</p> : null}

            <div className="cash-bank-actions" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button type="button" className="btn-portal" disabled={saving || loading} onClick={save}>
                    <Save size={16} style={{ marginRight: 6 }} /> {saving ? t('approvalLimits.saving') : t('approvalLimits.save')}
                </button>
                <button type="button" className="btn-portal-outline" disabled={loading} onClick={loadAll}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> {t('approvalLimits.refresh')}
                </button>
                <span style={{ marginLeft: 'auto', color: '#64748B' }}>
                    {t('approvalLimits.configured', { configured: summary.configured, total: summary.total })}
                </span>
            </div>

            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('approvalLimits.th.role')}</th>
                            <th className="table-th">{t('approvalLimits.th.perRequest')}</th>
                            <th className="table-th">{t('approvalLimits.th.daily')}</th>
                            <th className="table-th">{t('approvalLimits.th.approver')}</th>
                            <th className="table-th">{t('approvalLimits.th.fallbackRole')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="table-cell table-empty">{t('approvalLimits.loading')}</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={5} className="table-cell table-empty">{t('approvalLimits.empty')}</td></tr>
                        ) : rows.map((r, idx) => (
                            <tr key={r.roleKey}>
                                <td className="table-cell">
                                    <strong>{roleLabel(r.roleKey)}</strong>
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
                                        <option value="">{t('approvalLimits.useFallback')}</option>
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
                                        <option value="">{t('approvalLimits.none')}</option>
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
                {t('approvalLimits.footer')}
            </p>
        </div>
    );
}
