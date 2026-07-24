import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, FileText } from 'lucide-react';
import Modal from '../../components/Modal';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import {
    listAffiliatedSuppliers,
    listAvailableAffiliatedSuppliers,
    addAffiliatedSuppliers,
    updateAffiliatedSupplier,
} from '../../services/workshopSuppliersApi';
import { useAuth } from '../../context/AuthContext';

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function AddAffiliatedSupplierModal({ branches = [], onClose, onSubmit, isSaving, selectedBranchId = 'all' }) {
    // If a specific branch is scoped from the sidebar → pre-fill it and limit
    // the dropdown to that branch (admin can't accidentally link to another).
    const isAll = !selectedBranchId || selectedBranchId === 'all';
    const visibleBranches = isAll
        ? branches
        : branches.filter((b) => String(b.id) === String(selectedBranchId));
    const [branchId, setBranchId] = useState(
        !isAll ? String(selectedBranchId) : (branches?.[0]?.id ? String(branches[0].id) : ''),
    );
    const [search, setSearch] = useState('');
    const [available, setAvailable] = useState([]);
    const [loading, setLoading] = useState(true);
    const [picked, setPicked] = useState({}); // { supplierId: { openingBalance, openingBalanceDate, name } }
    const [hideLinked, setHideLinked] = useState(false);
    const [error, setError] = useState('');

    const reload = useCallback(async (q) => {
        setLoading(true);
        try {
            const res = await listAvailableAffiliatedSuppliers({ q, limit: 500 });
            setAvailable(res?.suppliers ?? []);
            setError('');
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Failed to load registered suppliers');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload('');
    }, [reload]);

    useEffect(() => {
        const t = setTimeout(() => reload(search), 250);
        return () => clearTimeout(t);
    }, [search, reload]);

    const visibleRows = useMemo(() => {
        if (!hideLinked) return available;
        return available.filter((s) => !s.isLinkedToWorkshop);
    }, [available, hideLinked]);

    const linkedCount = useMemo(
        () => available.filter((s) => s.isLinkedToWorkshop).length,
        [available],
    );

    const togglePick = (s) => {
        if (s.isLinkedToWorkshop) return;
        setPicked((p) => {
            if (p[s.id]) {
                const next = { ...p };
                delete next[s.id];
                return next;
            }
            return {
                ...p,
                [s.id]: {
                    openingBalance: '',
                    openingBalanceDate: todayIso(),
                    name: s.name,
                },
            };
        });
    };

    const allSelectableIds = useMemo(
        () => visibleRows.filter((s) => !s.isLinkedToWorkshop).map((s) => s.id),
        [visibleRows],
    );
    const allVisibleSelected =
        allSelectableIds.length > 0 &&
        allSelectableIds.every((id) => picked[id]);

    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            setPicked((p) => {
                const next = { ...p };
                for (const id of allSelectableIds) delete next[id];
                return next;
            });
        } else {
            setPicked((p) => {
                const next = { ...p };
                for (const s of visibleRows) {
                    if (s.isLinkedToWorkshop) continue;
                    if (!next[s.id]) {
                        next[s.id] = {
                            openingBalance: '',
                            openingBalanceDate: todayIso(),
                            name: s.name,
                        };
                    }
                }
                return next;
            });
        }
    };

    const setPickedField = (id, k, v) => {
        setPicked((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
    };

    const pickedIds = Object.keys(picked);

    const handleSave = async () => {
        if (!pickedIds.length) {
            setError('Pick at least one supplier from the list');
            return;
        }
        const items = pickedIds.map((id) => ({
            supplierId: id,
            openingBalance: Number(picked[id].openingBalance || 0) || 0,
            openingBalanceDate: picked[id].openingBalanceDate || todayIso(),
        }));
        try {
            await onSubmit({ branchId: branchId || undefined, items });
        } catch (e) {
            setError(e?.message || 'Failed to add suppliers');
        }
    };

    return (
        <Modal
            title="Add Affiliated Supplier(s)"
            onClose={isSaving ? () => {} : onClose}
            width="min(880px, 96vw)"
            contentClassName="ws-aff-modal"
            footer={
                <div className="ws-aff-modal-footer">
                    <button className="btn-portal-outline" type="button" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </button>
                    <button
                        className="btn-portal"
                        type="button"
                        disabled={isSaving || pickedIds.length === 0}
                        onClick={handleSave}
                    >
                        {isSaving ? 'Adding...' : `Add ${pickedIds.length || ''} supplier(s)`}
                    </button>
                </div>
            }
        >
            <form
                autoComplete="off"
                onSubmit={(e) => e.preventDefault()}
                className="ws-aff-modal-form"
            >
                {/* Hidden dummy fields neutralize Chrome / Safari "save email" autofill on the search box. */}
                <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    style={{ display: 'none' }}
                    readOnly
                />
                <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    style={{ display: 'none' }}
                    readOnly
                />

                <div className="ws-aff-modal-toolbar">
                    <div className="ws-aff-modal-field">
                        <label>Default branch</label>
                        <select
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            disabled={!isAll}
                            className="ws-aff-modal-input"
                        >
                            {isAll && <option value="">— None (workshop-wide) —</option>}
                            {visibleBranches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="ws-aff-modal-field ws-aff-modal-field--search">
                        <label>Search registered suppliers</label>
                        <div className="ws-aff-modal-search">
                            <Search size={14} className="ws-aff-modal-search-icon" />
                            <input
                                type="search"
                                name="affiliatedSupplierSearch"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Name, phone, email, VAT, CR..."
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                                className="ws-aff-modal-input ws-aff-modal-input--search"
                            />
                        </div>
                    </div>
                </div>

                <div className="ws-aff-modal-meta">
                    <span>
                        Showing <strong>{visibleRows.length}</strong> of {available.length} registered
                        {linkedCount > 0 && ` • ${linkedCount} already linked`}
                        {pickedIds.length > 0 && ` • ${pickedIds.length} selected`}
                    </span>
                    {linkedCount > 0 && (
                        <label className="ws-aff-modal-hide-linked">
                            <input
                                type="checkbox"
                                checked={hideLinked}
                                onChange={(e) => setHideLinked(e.target.checked)}
                            />
                            Hide already linked
                        </label>
                    )}
                </div>

                <div className="ws-aff-modal-table-wrap">
                    {loading ? (
                        <div className="ws-aff-modal-empty">Loading registered suppliers...</div>
                    ) : visibleRows.length === 0 ? (
                        <div className="ws-aff-modal-empty">
                            {available.length === 0
                                ? 'No suppliers are registered with the platform yet. Ask the super-admin to register suppliers first.'
                                : 'No registered suppliers match your filter.'}
                        </div>
                    ) : (
                        <WsTableScroll bodyClassName="ws-aff-modal-table-scroll">
                        <table className="ws-aff-modal-table">
                            <thead>
                                <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                                    <th style={{ padding: 10, width: 36 }}>
                                        <input
                                            type="checkbox"
                                            checked={allVisibleSelected}
                                            onChange={toggleSelectAllVisible}
                                            disabled={allSelectableIds.length === 0}
                                            title="Select all visible"
                                        />
                                    </th>
                                    <th style={{ padding: 10 }}>Supplier</th>
                                    <th style={{ padding: 10 }}>Mobile</th>
                                    <th style={{ padding: 10 }}>VAT ID</th>
                                    <th style={{ padding: 10, width: 180 }}>Opening balance (SAR)</th>
                                    <th style={{ padding: 10, width: 150 }}>As of date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((s) => {
                                    const sel = picked[s.id];
                                    const linked = Boolean(s.isLinkedToWorkshop);
                                    return (
                                        <tr
                                            key={s.id}
                                            style={{
                                                borderTop: '1px solid #F1F5F9',
                                                background: linked
                                                    ? '#F8FAFC'
                                                    : sel
                                                      ? '#EFF6FF'
                                                      : 'transparent',
                                                opacity: linked ? 0.7 : 1,
                                            }}
                                        >
                                            <td style={{ padding: 10 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(sel)}
                                                    onChange={() => togglePick(s)}
                                                    disabled={linked}
                                                />
                                            </td>
                                            <td style={{ padding: 10 }}>
                                                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {s.name}
                                                    {linked && (
                                                        <span
                                                            style={{
                                                                fontSize: 10,
                                                                fontWeight: 700,
                                                                background: '#DCFCE7',
                                                                color: '#166534',
                                                                padding: '2px 6px',
                                                                borderRadius: 999,
                                                                textTransform: 'uppercase',
                                                            }}
                                                        >
                                                            Already linked
                                                        </span>
                                                    )}
                                                    {s.isActive === false && (
                                                        <span
                                                            style={{
                                                                fontSize: 10,
                                                                fontWeight: 700,
                                                                background: '#FEE2E2',
                                                                color: '#991B1B',
                                                                padding: '2px 6px',
                                                                borderRadius: 999,
                                                                textTransform: 'uppercase',
                                                            }}
                                                        >
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#64748B' }}>
                                                    {s.email || '—'} {s.contactPerson ? `• ${s.contactPerson}` : ''}
                                                </div>
                                            </td>
                                            <td style={{ padding: 10 }}>{s.mobile || '—'}</td>
                                            <td style={{ padding: 10 }}>{s.vatId || '—'}</td>
                                            <td style={{ padding: 10 }}>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={sel?.openingBalance ?? ''}
                                                    onChange={(e) => setPickedField(s.id, 'openingBalance', e.target.value)}
                                                    disabled={!sel}
                                                    placeholder="0.00"
                                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                                                />
                                            </td>
                                            <td style={{ padding: 10 }}>
                                                <input
                                                    type="date"
                                                    value={sel?.openingBalanceDate ?? todayIso()}
                                                    onChange={(e) => setPickedField(s.id, 'openingBalanceDate', e.target.value)}
                                                    disabled={!sel}
                                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </WsTableScroll>
                    )}
                </div>

                {error && (
                    <p className="ws-aff-modal-error">{error}</p>
                )}
            </form>
        </Modal>
    );
}

export default function WorkshopAffiliatedSuppliers({
    selectedBranchId = 'all',
    branches = [],
    onTabChange,
}) {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('workshop.affiliated-suppliers.create');
    const canEdit   = hasPermission('workshop.affiliated-suppliers.edit');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [savingAdd, setSavingAdd] = useState(false);
    const [error, setError] = useState('');

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedBranchId && selectedBranchId !== 'all') {
                params.branchId = selectedBranchId;
            }
            const res = await listAffiliatedSuppliers(params);
            setRows(res?.suppliers ?? []);
            setError('');
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Failed to load suppliers');
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const onAdd = async (payload) => {
        setSavingAdd(true);
        try {
            await addAffiliatedSuppliers(payload);
            setShowAdd(false);
            await loadList();
        } finally {
            setSavingAdd(false);
        }
    };

    const onToggleActive = async (row) => {
        try {
            await updateAffiliatedSupplier(row.id, { isActive: !row.isActive });
            setRows((rs) =>
                rs.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)),
            );
        } catch (e) {
            alert(e?.message || 'Failed to update supplier');
        }
    };

    const totalBalance = useMemo(
        () => rows.reduce((s, r) => s + Number(r.finalBalance || 0), 0),
        [rows],
    );

    return (
        <div className="ws-suppliers-page">
            <div className="ws-suppliers-header">
                <h2 className="ws-suppliers-title">Filter Affiliated Suppliers</h2>
                <div className="ws-suppliers-header-actions">
                    <button type="button" className="btn-portal-outline" onClick={loadList} disabled={loading}>
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                    {canCreate && (
                        <button type="button" className="btn-portal" onClick={() => setShowAdd(true)}>
                            <Plus size={14} />
                            Add new supplier
                        </button>
                    )}
                </div>
            </div>

            <div className="ws-suppliers-stats">
                <div className="ws-suppliers-stat ws-suppliers-stat--neutral">
                    Total suppliers: <strong>{rows.length}</strong>
                </div>
                <div className="ws-suppliers-stat ws-suppliers-stat--balance">
                    Aggregate payable balance: <strong>{fmtMoney(totalBalance)} SAR</strong>
                </div>
            </div>

            <div className="ws-suppliers-table-wrap">
                <WsTableScroll>
                <table className="ws-suppliers-table">
                    <thead>
                        <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                            <th style={{ padding: 12, width: 60 }}>S.No.</th>
                            <th style={{ padding: 12 }}>Supplier name</th>
                            <th style={{ padding: 12 }}>Branch</th>
                            <th style={{ padding: 12 }}>Opening</th>
                            <th style={{ padding: 12 }}>Final balance (SAR)</th>
                            <th style={{ padding: 12, width: 110, textAlign: 'center' }}>Active</th>
                            <th style={{ padding: 12, width: 130 }}>Statement</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                                    Loading suppliers...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                                    No affiliated suppliers yet. Click "Add new supplier" to link one.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: 12 }}>{r.serial}</td>
                                    <td
                                        style={{ padding: 12, cursor: 'pointer', color: '#2563EB', fontWeight: 600 }}
                                        onClick={() =>
                                            onTabChange?.('supplier-ledger', {
                                                type: 'affiliated',
                                                id: r.supplierId,
                                                name: r.supplierName,
                                            })
                                        }
                                    >
                                        {r.supplierName}
                                    </td>
                                    <td style={{ padding: 12 }}>{r.branchName || '—'}</td>
                                    <td style={{ padding: 12 }}>{fmtMoney(r.openingBalance)}</td>
                                    <td style={{ padding: 12 }}>{fmtMoney(r.finalBalance)}</td>
                                    <td style={{ padding: 12, textAlign: 'center' }}>
                                        <label className="ws-suppliers-toggle" title={canEdit ? undefined : 'No edit permission'} style={{ opacity: canEdit ? 1 : 0.55, cursor: canEdit ? 'pointer' : 'not-allowed' }}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(r.isActive)}
                                                onChange={() => { if (canEdit) onToggleActive(r); }}
                                                disabled={!canEdit}
                                            />
                                            <span className="ws-suppliers-toggle-track" data-on={r.isActive ? '1' : '0'} />
                                            <span className="ws-suppliers-toggle-thumb" data-on={r.isActive ? '1' : '0'} />
                                        </label>
                                    </td>
                                    <td style={{ padding: 12 }}>
                                        <button
                                            type="button"
                                            className="btn-portal-outline ws-suppliers-ledger-btn"
                                            onClick={() =>
                                                onTabChange?.('supplier-ledger', {
                                                    type: 'affiliated',
                                                    id: r.supplierId,
                                                    name: r.supplierName,
                                                })
                                            }
                                        >
                                            <FileText size={12} />
                                            Open ledger
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
            </div>

            {error && (
                <p className="ws-suppliers-error">{error}</p>
            )}

            {showAdd && (
                <AddAffiliatedSupplierModal
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    onClose={() => setShowAdd(false)}
                    onSubmit={onAdd}
                    isSaving={savingAdd}
                />
            )}
        </div>
    );
}
