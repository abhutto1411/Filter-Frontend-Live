import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { getStaffAppSettings, updateStaffAppSettings } from '../../../services/staffAppApi';
import { listExpenseCategories } from '../../../services/employeeExpenseApi';
import { useStaffAppScope } from '../../../context/StaffAppScopeContext';

export default function StaffAppSettings() {
    const scope = useStaffAppScope();
    const [categories, setCategories] = useState([]);
    const [allowedCategoryIds, setAllowedCategoryIds] = useState([]);
    const [defaultApproverRole, setDefaultApproverRole] = useState('accounting');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [catRes, settingsRes] = await Promise.all([
                listExpenseCategories(scope.scopeParams()),
                getStaffAppSettings(scope.scopeParams()),
            ]);
            setCategories(catRes?.categories ?? []);
            const settings = settingsRes?.settings ?? settingsRes?.data ?? settingsRes ?? {};
            setAllowedCategoryIds(settings.allowedCategoryIds ?? []);
            setDefaultApproverRole(settings.defaultApproverRole ?? 'accounting');
        } catch (e) {
            setError(e?.message || 'Could not load settings.');
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => { load(); }, [load]);

    const toggleCategory = (id) => {
        const sid = String(id);
        setAllowedCategoryIds((prev) =>
            prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
        );
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        setError('');
        try {
            await updateStaffAppSettings({
                allowedCategoryIds,
                defaultApproverRole,
            }, scope.scopeParams());
            setMessage('Settings saved.');
        } catch (e) {
            setError(e?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="staff-app-empty">Loading settings…</p>;

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>App Settings</h2>
                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleSave} disabled={saving}>
                    <Save size={14} /> Save
                </button>
                <button type="button" className="staff-app-btn" onClick={load}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
            {message && <p style={{ color: '#065f46' }}>{message}</p>}
            <div className="staff-app-table-wrap" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>Expense COA categories (staff app)</h3>
                <p style={{ fontSize: '0.8125rem', color: '#666', marginBottom: 12 }}>
                    Select which expense accounts outdoor staff can use in the Flutter app.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {categories.map((c) => {
                        const id = String(c.id ?? c.categoryId);
                        const checked = allowedCategoryIds.includes(id);
                        return (
                            <label key={id} className="staff-app-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={checked} onChange={() => toggleCategory(id)} />
                                {c.name || c.label}
                            </label>
                        );
                    })}
                </div>
                <h3 style={{ marginTop: 24 }}>Default approver role</h3>
                <select className="staff-app-btn" value={defaultApproverRole} onChange={(e) => setDefaultApproverRole(e.target.value)}>
                    <option value="workshop_admin">Workshop admin</option>
                    <option value="accounting">Accounting</option>
                    <option value="manager">Manager</option>
                </select>
            </div>
        </div>
    );
}
