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
import { wasT } from '../../utils/workshopAffiliatedSuppliersI18n';

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function AddAffiliatedSupplierModal({ branches = [], onClose, onSubmit, isSaving, selectedBranchId = 'all', t }) {
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
            setError(e?.message || t('err.loadRegistered'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        reload('');
    }, [reload]);

    useEffect(() => {
        const timer = setTimeout(() => reload(search), 250);
        return () => clearTimeout(timer);
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
    const dash = t('emdash');

    const handleSave = async () => {
        if (!pickedIds.length) {
            setError(t('err.pickOne'));
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
            setError(e?.message || t('err.add'));
        }
    };

    return (
        <Modal
            title={t('modal.title')}
            onClose={isSaving ? () => {} : onClose}
            width="min(880px, 96vw)"
            contentClassName="ws-aff-modal"
            footer={
                <div className="ws-aff-modal-footer">
                    <button className="btn-portal-outline" type="button" onClick={onClose} disabled={isSaving}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        className="btn-portal"
                        type="button"
                        disabled={isSaving || pickedIds.length === 0}
                        onClick={handleSave}
                    >
                        {isSaving ? t('btn.adding') : t('btn.addCount', { count: pickedIds.length || '' })}
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
                        <label>{t('modal.defaultBranch')}</label>
                        <select
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            disabled={!isAll}
                            className="ws-aff-modal-input"
                        >
                            {isAll && <option value="">{t('modal.branchNone')}</option>}
                            {visibleBranches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="ws-aff-modal-field ws-aff-modal-field--search">
                        <label>{t('modal.searchLabel')}</label>
                        <div className="ws-aff-modal-search">
                            <Search size={14} className="ws-aff-modal-search-icon" />
                            <input
                                type="search"
                                name="affiliatedSupplierSearch"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('modal.searchPlaceholder')}
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
                        {t('modal.showingPrefix')} <strong>{visibleRows.length}</strong> {t('modal.showingOf', { total: available.length })}
                        {linkedCount > 0 && ` ${t('modal.bulletLinked', { count: linkedCount })}`}
                        {pickedIds.length > 0 && ` ${t('modal.bulletSelected', { count: pickedIds.length })}`}
                    </span>
                    {linkedCount > 0 && (
                        <label className="ws-aff-modal-hide-linked">
                            <input
                                type="checkbox"
                                checked={hideLinked}
                                onChange={(e) => setHideLinked(e.target.checked)}
                            />
                            {t('modal.hideLinked')}
                        </label>
                    )}
                </div>

                <div className="ws-aff-modal-table-wrap">
                    {loading ? (
                        <div className="ws-aff-modal-empty">{t('modal.loading')}</div>
                    ) : visibleRows.length === 0 ? (
                        <div className="ws-aff-modal-empty">
                            {available.length === 0
                                ? t('modal.emptyNone')
                                : t('modal.emptyFilter')}
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
                                            title={t('modal.selectAllTitle')}
                                        />
                                    </th>
                                    <th style={{ padding: 10 }}>{t('modal.th.supplier')}</th>
                                    <th style={{ padding: 10 }}>{t('modal.th.mobile')}</th>
                                    <th style={{ padding: 10 }}>{t('modal.th.vatId')}</th>
                                    <th style={{ padding: 10, width: 180 }}>{t('modal.th.openingBalance')}</th>
                                    <th style={{ padding: 10, width: 150 }}>{t('modal.th.asOfDate')}</th>
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
                                                            {t('modal.badge.linked')}
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
                                                            {t('modal.badge.inactive')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#64748B' }}>
                                                    {s.email || dash} {s.contactPerson ? `• ${s.contactPerson}` : ''}
                                                </div>
                                            </td>
                                            <td style={{ padding: 10 }}>{s.mobile || dash}</td>
                                            <td style={{ padding: 10 }}>{s.vatId || dash}</td>
                                            <td style={{ padding: 10 }}>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={sel?.openingBalance ?? ''}
                                                    onChange={(e) => setPickedField(s.id, 'openingBalance', e.target.value)}
                                                    disabled={!sel}
                                                    placeholder={t('modal.placeholder.balance')}
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
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wasT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('workshop.affiliated-suppliers.create');
    const canEdit   = hasPermission('workshop.affiliated-suppliers.edit');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [savingAdd, setSavingAdd] = useState(false);
    const [error, setError] = useState('');
    const dash = t('emdash');

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
            setError(e?.message || t('err.loadList'));
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, t]);

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
            alert(e?.message || t('err.update'));
        }
    };

    const totalBalance = useMemo(
        () => rows.reduce((s, r) => s + Number(r.finalBalance || 0), 0),
        [rows],
    );

    return (
        <div className="ws-suppliers-page">
            <div className="ws-suppliers-header">
                <h2 className="ws-suppliers-title">{t('page.title')}</h2>
                <div className="ws-suppliers-header-actions">
                    <button type="button" className="btn-portal-outline" onClick={loadList} disabled={loading}>
                        <RefreshCw size={14} />
                        {t('btn.refresh')}
                    </button>
                    {canCreate && (
                        <button type="button" className="btn-portal" onClick={() => setShowAdd(true)}>
                            <Plus size={14} />
                            {t('btn.addNew')}
                        </button>
                    )}
                </div>
            </div>

            <div className="ws-suppliers-stats">
                <div className="ws-suppliers-stat ws-suppliers-stat--neutral">
                    {t('stat.totalSuppliers')} <strong>{rows.length}</strong>
                </div>
                <div className="ws-suppliers-stat ws-suppliers-stat--balance">
                    {t('stat.aggregateBalance')}{' '}
                    <strong>{t('money.sar', { amount: fmtMoney(totalBalance) })}</strong>
                </div>
            </div>

            <div className="ws-suppliers-table-wrap">
                <WsTableScroll>
                <table className="ws-suppliers-table">
                    <thead>
                        <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                            <th style={{ padding: 12, width: 60 }}>{t('th.sno')}</th>
                            <th style={{ padding: 12 }}>{t('th.supplierName')}</th>
                            <th style={{ padding: 12 }}>{t('th.branch')}</th>
                            <th style={{ padding: 12 }}>{t('th.opening')}</th>
                            <th style={{ padding: 12 }}>{t('th.finalBalance')}</th>
                            <th style={{ padding: 12, width: 110, textAlign: 'center' }}>{t('th.active')}</th>
                            <th style={{ padding: 12, width: 130 }}>{t('th.statement')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                                    {t('loading.list')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                                    {t('empty.list')}
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
                                    <td style={{ padding: 12 }}>{r.branchName || dash}</td>
                                    <td style={{ padding: 12 }}>{t('money.sar', { amount: fmtMoney(r.openingBalance) })}</td>
                                    <td style={{ padding: 12 }}>{t('money.sar', { amount: fmtMoney(r.finalBalance) })}</td>
                                    <td style={{ padding: 12, textAlign: 'center' }}>
                                        <label className="ws-suppliers-toggle" title={canEdit ? undefined : t('err.noEditPerm')} style={{ opacity: canEdit ? 1 : 0.55, cursor: canEdit ? 'pointer' : 'not-allowed' }}>
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
                                            {t('btn.openLedger')}
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
                    t={t}
                />
            )}
        </div>
    );
}
