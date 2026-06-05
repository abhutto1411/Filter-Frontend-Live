import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, FileText, Plus } from 'lucide-react';
import Modal from '../../components/Modal';
import {
    bulkAddSupplierAffiliatedWorkshops,
    getSupplierAffiliatedBranchTransactions,
    getSupplierAffiliatedWorkshopTransactions,
    getSupplierFinancePlatformWorkshops,
    listSupplierAffiliatedWorkshops,
    patchSupplierAffiliatedBranchActive,
    patchSupplierAffiliatedWorkshopActive,
} from '../../services/supplierApi';
import {
    exportAffiliatedTransactionLedgerExcel,
    exportAffiliatedTransactionLedgerPdf,
} from './supplierInventoryExport';

const logToolbarExportBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--color-text-dark)',
};

function fmtMoney(amount, currencyCode = 'SAR') {
    const n = Number(amount || 0);
    const formatted = Math.abs(n).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    if (n > 0.005) return `${currencyCode} ${formatted} (they owe you)`;
    if (n < -0.005) return `−${currencyCode} ${formatted} (you owe them)`;
    return `${currencyCode} 0.00`;
}

function rowIsBranch(row) {
    return row.scope === 'branch' || (row.branchId != null && row.branchId !== '');
}

/** Stable id for Activate/Deactivate in-flight guarding (branch row vs workshop-only row). */
function rowActivePatchKey(row) {
    return rowIsBranch(row) ? `b:${String(row.branchId)}` : `w:${String(row.workshopId)}`;
}

function mergeAffiliatedRowsActive(rows, target, isActive) {
    return rows.map((row) => {
        if (rowIsBranch(target)) {
            if (!rowIsBranch(row) || String(row.branchId) !== String(target.branchId)) {
                return row;
            }
            return { ...row, isActive };
        }
        if (rowIsBranch(row) || String(row.workshopId) !== String(target.workshopId)) {
            return row;
        }
        return { ...row, isActive };
    });
}

function rowIsActive(row) {
    return row.isActive !== false;
}

async function fetchAffiliatedLog(row, params = {}) {
    if (rowIsBranch(row)) {
        return getSupplierAffiliatedBranchTransactions(row.branchId, params);
    }
    return getSupplierAffiliatedWorkshopTransactions(row.workshopId, params);
}

import {
    buildSalesArLedgerRows,
    isSupplierCustomerFinancialTx,
} from './supplierFinanceTransactionUtils';
import {
    formatAffiliatedBranchCustomerLabel,
    formatAffiliatedWorkshopCustomerLabel,
} from '../../utils/affiliatedCustomerLabels';

function fmtLedgerAmt(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function SupplierAffiliatedWorkshops() {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [pickerOpen, setPickerOpen] = useState(false);
    const [platform, setPlatform] = useState([]);
    const [pickerFilter, setPickerFilter] = useState('');
    const [pickedBranchIds, setPickedBranchIds] = useState(() => new Set());
    const [pickedWorkshopOnlyIds, setPickedWorkshopOnlyIds] = useState(() => new Set());
    const [adding, setAdding] = useState(false);

    const [logRow, setLogRow] = useState(null);
    const [logFrom, setLogFrom] = useState('');
    const [logTo, setLogTo] = useState('');
    const [logTx, setLogTx] = useState([]);
    const [logLoading, setLogLoading] = useState(false);

    const activePatchBusyRef = useRef(new Set());
    const [activePatchBusyKeys, setActivePatchBusyKeys] = useState(() => new Set());

    const affiliatedLedgerLines = useMemo(
        () => buildSalesArLedgerRows(logTx),
        [logTx],
    );

    const logExportSubtitle = useMemo(() => {
        if (!logRow) return '';
        const scopeLabel = rowIsBranch(logRow)
            ? formatAffiliatedBranchCustomerLabel(
                  logRow.workshopName,
                  logRow.branchName || logRow.branchId,
              )
            : formatAffiliatedWorkshopCustomerLabel(
                  logRow.workshopName || logRow.workshopId,
              );
        let rangeBit = 'All dates';
        if (logFrom && logTo) rangeBit = `${logFrom} → ${logTo}`;
        else if (logFrom) rangeBit = `From ${logFrom}`;
        else if (logTo) rangeBit = `To ${logTo}`;
        return `${scopeLabel} · ${rangeBit} · ${affiliatedLedgerLines.length} row(s)`;
    }, [logRow, logFrom, logTo, affiliatedLedgerLines.length]);

    const logExportFilenameBase = useMemo(() => {
        if (!logRow) return 'supplier-affiliated-transaction-log';
        if (rowIsBranch(logRow)) {
            return `supplier-affiliated-log-branch-${String(logRow.branchId || '').slice(0, 40)}`;
        }
        return `supplier-affiliated-log-workshop-${String(logRow.workshopId || '').slice(0, 40)}`;
    }, [logRow]);

    const loadList = useCallback(async () => {
        setErr('');
        setLoading(true);
        try {
            const res = await listSupplierAffiliatedWorkshops();
            setRows(Array.isArray(res?.rows) ? res.rows : []);
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Failed to load list');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const trackedBranchIds = useMemo(() => {
        const s = new Set();
        for (const r of rows) {
            if (rowIsBranch(r)) s.add(String(r.branchId));
        }
        return s;
    }, [rows]);

    const trackedWorkshopOnlyIds = useMemo(() => {
        const s = new Set();
        for (const r of rows) {
            if (r.scope === 'workshop') s.add(String(r.workshopId));
        }
        return s;
    }, [rows]);

    const pickCount = pickedBranchIds.size + pickedWorkshopOnlyIds.size;

    const openPicker = async () => {
        setPickerFilter('');
        setPickedBranchIds(new Set());
        setPickedWorkshopOnlyIds(new Set());
        setPickerOpen(true);
        try {
            const res = await getSupplierFinancePlatformWorkshops();
            setPlatform(Array.isArray(res?.workshops) ? res.workshops : []);
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Failed to load workshops');
        }
    };

    const filteredPlatform = useMemo(() => {
        const q = pickerFilter.trim().toLowerCase();
        if (!q) return platform;
        return platform.filter((w) => {
            if (
                String(w.name || '')
                    .toLowerCase()
                    .includes(q) ||
                String(w.id).includes(q)
            ) {
                return true;
            }
            const branches = Array.isArray(w.branches) ? w.branches : [];
            return branches.some(
                (b) =>
                    String(b.name || '')
                        .toLowerCase()
                        .includes(q) || String(b.id || '').includes(q),
            );
        });
    }, [platform, pickerFilter]);

    const toggleBranchPick = (branchIdStr) => {
        setPickedBranchIds((prev) => {
            const next = new Set(prev);
            const k = String(branchIdStr);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    };

    const toggleWorkshopOnlyPick = (workshopIdStr) => {
        setPickedWorkshopOnlyIds((prev) => {
            const next = new Set(prev);
            const k = String(workshopIdStr);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    };

    const toggleAllBranchesUnderWorkshop = (branches) => {
        const eligible = branches.filter((b) => !trackedBranchIds.has(String(b.id)));
        const allPicked =
            eligible.length > 0 &&
            eligible.every((b) => pickedBranchIds.has(String(b.id)));
        setPickedBranchIds((prev) => {
            const next = new Set(prev);
            if (allPicked) {
                eligible.forEach((b) => next.delete(String(b.id)));
            } else {
                eligible.forEach((b) => next.add(String(b.id)));
            }
            return next;
        });
    };

    const confirmAdd = async () => {
        const branchIds = [...pickedBranchIds];
        const workshopIds = [...pickedWorkshopOnlyIds];
        const body = {};
        if (branchIds.length) body.branchIds = branchIds;
        if (workshopIds.length) body.workshopIds = workshopIds;
        if (!branchIds.length && !workshopIds.length) return;
        setAdding(true);
        try {
            const res = await bulkAddSupplierAffiliatedWorkshops(body);
            setRows(Array.isArray(res?.rows) ? res.rows : []);
            setPickerOpen(false);
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Could not add selections');
        } finally {
            setAdding(false);
        }
    };

    const onSetRowActive = async (r, isActive) => {
        const k = rowActivePatchKey(r);
        if (activePatchBusyRef.current.has(k)) return;
        activePatchBusyRef.current.add(k);
        setActivePatchBusyKeys((prev) => new Set(prev).add(k));
        setErr('');
        try {
            if (rowIsBranch(r)) {
                await patchSupplierAffiliatedBranchActive(r.branchId, { isActive });
            } else {
                await patchSupplierAffiliatedWorkshopActive(r.workshopId, {
                    isActive,
                });
            }
            setRows((prev) => mergeAffiliatedRowsActive(prev, r, isActive));
            setLogRow((prev) => {
                if (!prev || rowActivePatchKey(prev) !== k) return prev;
                return { ...prev, isActive };
            });
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Could not update status');
        } finally {
            activePatchBusyRef.current.delete(k);
            setActivePatchBusyKeys((prev) => {
                const next = new Set(prev);
                next.delete(k);
                return next;
            });
        }
    };

    const openLog = async (row) => {
        setLogRow(row);
        setLogFrom('');
        setLogTo('');
        setLogTx([]);
        setLogLoading(true);
        try {
            const res = await fetchAffiliatedLog(row, {});
            const txs = Array.isArray(res?.transactions) ? res.transactions : [];
            setLogTx(txs.filter(isSupplierCustomerFinancialTx));
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Failed to load transactions');
        } finally {
            setLogLoading(false);
        }
    };

    const applyLogFilter = async () => {
        if (!logRow) return;
        setLogLoading(true);
        try {
            const params = {};
            if (logFrom.trim()) params.from = logFrom.trim();
            if (logTo.trim()) params.to = logTo.trim();
            const res = await fetchAffiliatedLog(logRow, params);
            const txs = Array.isArray(res?.transactions) ? res.transactions : [];
            setLogTx(txs.filter(isSupplierCustomerFinancialTx));
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Failed to filter');
        } finally {
            setLogLoading(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Affiliated Filter workshops</h2>
                    <p className="ws-page-sub">
                        Pin specific branches (or a whole workshop when it has no branches). Use{' '}
                        <strong>Deactivate</strong> to soft-hide a row without losing history;{' '}
                        <strong>Activate</strong> to show it again. Balance and logs still reflect real AR.
                    </p>
                    <p className="ws-page-sub" style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.88 }}>
                        The same balance is posted to <strong>Accounting → Chart of Accounts → AR Affiliated</strong>.
                        Open a transaction log row, then use <strong>Chart of Accounts (ledger)</strong> to see matching
                        GL lines (incl. sales invoices), or go to COA and filter the ledger by party type{' '}
                        <code>workshop</code> and the workshop id.
                    </p>
                </div>
                <button type="button" className="btn-portal" onClick={openPicker}>
                    <Plus size={16} />
                    Add workshops / branches
                </button>
            </div>

            {err ? (
                <div className="ws-section" style={{ color: '#b91c1c', fontWeight: 600 }}>
                    {err}
                </div>
            ) : null}

            <div className="ws-section">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Workshop</th>
                            <th>Branch</th>
                            <th>Balance</th>
                            <th style={{ width: 220 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4}>Loading…</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={4}>
                                    No rows yet — use “Add workshops / branches”.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => {
                                const rk = rowActivePatchKey(r);
                                const patching = activePatchBusyKeys.has(rk);
                                return (
                                <tr
                                    key={`${r.scope || 'row'}-${r.id}`}
                                    style={{
                                        cursor: 'pointer',
                                        opacity: rowIsActive(r) ? 1 : 0.55,
                                    }}
                                    onClick={() => openLog(r)}
                                >
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{r.workshopName || '—'}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>
                                            Workshop {r.workshopId}
                                        </div>
                                        {!rowIsActive(r) ? (
                                            <div
                                                style={{
                                                    marginTop: 6,
                                                    fontSize: '0.65rem',
                                                    fontWeight: 800,
                                                    color: '#b45309',
                                                    letterSpacing: '0.04em',
                                                }}
                                            >
                                                INACTIVE
                                            </div>
                                        ) : null}
                                    </td>
                                    <td>
                                        {rowIsBranch(r) ? (
                                            <>
                                                <div style={{ fontWeight: 600 }}>
                                                    {r.branchName || '—'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>
                                                    Branch {r.branchId}
                                                </div>
                                            </>
                                        ) : (
                                            <span style={{ opacity: 0.7, fontStyle: 'italic' }}>
                                                Workshop only (no branches)
                                            </span>
                                        )}
                                    </td>
                                    <td>{fmtMoney(r.balanceOutstanding, r.currencyCode)}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <div
                                            className="ws-branch-active-toggle"
                                            title={
                                                rowIsActive(r)
                                                    ? 'Listed on this page; logs and AR unchanged'
                                                    : 'Soft-hidden; balance and transaction log still reflect real AR'
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ justifyContent: 'flex-start', flexWrap: 'nowrap' }}
                                        >
                                            <span
                                                className={`ws-branch-active-toggle-label ${!rowIsActive(r) ? 'is-on' : ''}`}
                                            >
                                                Inactive
                                            </span>
                                            <label
                                                className={`ws-duty-toggle ${patching ? 'ws-duty-toggle--disabled' : ''}`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={rowIsActive(r)}
                                                    disabled={patching}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        onSetRowActive(r, e.target.checked);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    aria-label={
                                                        rowIsActive(r)
                                                            ? 'Turn off listing (inactive)'
                                                            : 'Turn on listing (active)'
                                                    }
                                                />
                                                <span className="ws-toggle-slider" />
                                            </label>
                                            <span
                                                className={`ws-branch-active-toggle-label ${rowIsActive(r) ? 'is-on' : ''}`}
                                            >
                                                Active
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {pickerOpen ? (
                <Modal
                    title="Add workshops / branches"
                    onClose={() => !adding && setPickerOpen(false)}
                    width={600}
                    disableClose={adding}
                    footer={
                        <>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setPickerOpen(false)}
                                disabled={adding}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={confirmAdd}
                                disabled={adding || pickCount === 0}
                            >
                                {adding ? 'Adding…' : `Add (${pickCount})`}
                            </button>
                        </>
                    }
                >
                    <p style={{ marginTop: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                        Only <strong>approved</strong> workshops. Select <strong>branches</strong> individually or
                        use the workshop checkbox to select <strong>all branches</strong> at once. Workshops with{' '}
                        <strong>no branches</strong> can be pinned as a whole. Search matches names or IDs.
                    </p>
                    <input
                        type="search"
                        className="ws-input-like"
                        placeholder="Search name or ID…"
                        value={pickerFilter}
                        onChange={(e) => setPickerFilter(e.target.value)}
                        style={{
                            width: '100%',
                            marginBottom: 12,
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.12)',
                        }}
                    />
                    <div
                        style={{
                            maxHeight: 360,
                            overflowY: 'auto',
                            border: '1px solid rgba(0,0,0,0.08)',
                            borderRadius: 8,
                        }}
                    >
                        {filteredPlatform.map((w) => {
                            const wid = String(w.id);
                            const branches = Array.isArray(w.branches) ? w.branches : [];

                            if (branches.length === 0) {
                                const trackedWo = trackedWorkshopOnlyIds.has(wid);
                                const checked = pickedWorkshopOnlyIds.has(wid);
                                return (
                                    <div
                                        key={wid}
                                        style={{
                                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                                            opacity: trackedWo ? 0.45 : 1,
                                        }}
                                    >
                                        <label
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                padding: '10px 12px',
                                                cursor: trackedWo ? 'not-allowed' : 'pointer',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={trackedWo}
                                                onChange={() =>
                                                    !trackedWo && toggleWorkshopOnlyPick(wid)
                                                }
                                            />
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontWeight: 600 }}>{w.name}</span>
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        opacity: 0.6,
                                                        marginLeft: 8,
                                                    }}
                                                >
                                                    {wid}
                                                </span>
                                            </span>
                                            {trackedWo ? (
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                                                    Already listed
                                                </span>
                                            ) : null}
                                        </label>
                                        <div
                                            style={{
                                                padding: '0 12px 10px 44px',
                                                fontSize: '0.8rem',
                                                opacity: 0.55,
                                                fontStyle: 'italic',
                                            }}
                                        >
                                            No branches — pin whole workshop
                                        </div>
                                    </div>
                                );
                            }

                            const eligible = branches.filter(
                                (b) => !trackedBranchIds.has(String(b.id)),
                            );
                            const workshopAllTracked = eligible.length === 0;
                            const allPicked =
                                eligible.length > 0 &&
                                eligible.every((b) =>
                                    pickedBranchIds.has(String(b.id)),
                                );
                            const pickedPartial =
                                eligible.length > 0 &&
                                eligible.some((b) =>
                                    pickedBranchIds.has(String(b.id)),
                                ) &&
                                !allPicked;

                            return (
                                <div
                                    key={wid}
                                    style={{
                                        borderBottom: '1px solid rgba(0,0,0,0.06)',
                                        opacity: workshopAllTracked ? 0.45 : 1,
                                    }}
                                >
                                    <label
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 12px',
                                            cursor: workshopAllTracked ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={allPicked}
                                            disabled={workshopAllTracked}
                                            ref={(el) => {
                                                if (el) el.indeterminate = pickedPartial;
                                            }}
                                            onChange={() =>
                                                !workshopAllTracked &&
                                                toggleAllBranchesUnderWorkshop(branches)
                                            }
                                        />
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 600 }}>{w.name}</span>
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    opacity: 0.6,
                                                    marginLeft: 8,
                                                }}
                                            >
                                                {wid}
                                            </span>
                                        </span>
                                        {workshopAllTracked ? (
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                                                All branches listed
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.65rem', opacity: 0.55 }}>
                                                Select all branches
                                            </span>
                                        )}
                                    </label>
                                    <ul
                                        style={{
                                            margin: 0,
                                            padding: '4px 12px 10px 44px',
                                            listStyle: 'none',
                                        }}
                                    >
                                        {branches.map((b, idx) => {
                                            const bid = String(b.id);
                                            const bTracked = trackedBranchIds.has(bid);
                                            const bPicked = pickedBranchIds.has(bid);
                                            return (
                                                <li
                                                    key={bid}
                                                    style={{
                                                        padding: '6px 0',
                                                        borderTop:
                                                            idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.06)',
                                                    }}
                                                >
                                                    <label
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 10,
                                                            cursor: bTracked ? 'not-allowed' : 'pointer',
                                                            opacity: bTracked ? 0.5 : 1,
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={bPicked}
                                                            disabled={bTracked}
                                                            onChange={() =>
                                                                !bTracked && toggleBranchPick(bid)
                                                            }
                                                        />
                                                        <span style={{ flex: 1 }}>
                                                            <span style={{ fontWeight: 600 }}>
                                                                {b.name}
                                                            </span>
                                                            <span
                                                                style={{
                                                                    fontSize: '0.72rem',
                                                                    opacity: 0.55,
                                                                    marginLeft: 8,
                                                                }}
                                                            >
                                                                Branch {bid}
                                                            </span>
                                                            {!b.isActive ? (
                                                                <span
                                                                    style={{
                                                                        marginLeft: 8,
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 700,
                                                                        color: '#b45309',
                                                                    }}
                                                                >
                                                                    inactive
                                                                </span>
                                                            ) : null}
                                                            {bTracked ? (
                                                                <span
                                                                    style={{
                                                                        marginLeft: 8,
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 700,
                                                                    }}
                                                                >
                                                                    Listed
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    </label>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </Modal>
            ) : null}

            {logRow ? (
                <Modal
                    title={
                        rowIsBranch(logRow)
                            ? `Transaction log — ${formatAffiliatedBranchCustomerLabel(
                                  logRow.workshopName,
                                  logRow.branchName || logRow.branchId,
                              )}`
                            : `Transaction log — ${formatAffiliatedWorkshopCustomerLabel(
                                  logRow.workshopName || logRow.workshopId,
                              )}`
                    }
                    onClose={() => setLogRow(null)}
                    width={980}
                    footer={
                        <button type="button" className="btn-portal-outline" onClick={() => setLogRow(null)}>
                            Close
                        </button>
                    }
                >
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 10,
                            alignItems: 'flex-end',
                            marginBottom: 14,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>From</div>
                            <input
                                type="date"
                                value={logFrom}
                                onChange={(e) => setLogFrom(e.target.value)}
                                style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>To</div>
                            <input
                                type="date"
                                value={logTo}
                                onChange={(e) => setLogTo(e.target.value)}
                                style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
                            />
                        </div>
                        <button type="button" className="btn-portal" onClick={applyLogFilter} disabled={logLoading}>
                            {logLoading ? 'Loading…' : 'Apply range'}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={async () => {
                                setLogFrom('');
                                setLogTo('');
                                if (!logRow) return;
                                setLogLoading(true);
                                try {
                                    const res = await fetchAffiliatedLog(logRow, {});
                                    const txs = Array.isArray(res?.transactions) ? res.transactions : [];
                                    setLogTx(txs.filter(isSupplierCustomerFinancialTx));
                                } finally {
                                    setLogLoading(false);
                                }
                            }}
                            disabled={logLoading}
                        >
                            Clear filter
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => {
                                const params = new URLSearchParams({
                                    openLedgerSeed: 'AR_AFFILIATED',
                                });
                                if (rowIsBranch(logRow) && logRow.branchId) {
                                    params.set('partyType', 'branch');
                                    params.set('partyId', String(logRow.branchId));
                                } else {
                                    const ws = String(logRow?.workshopId ?? '').trim();
                                    if (!ws) return;
                                    params.set('partyType', 'workshop');
                                    params.set('partyId', ws);
                                }
                                navigate(`/supplier/accounting/coa?${params.toString()}`);
                                setLogRow(null);
                            }}
                            disabled={
                                rowIsBranch(logRow)
                                    ? !logRow?.branchId
                                    : !logRow?.workshopId
                            }
                            title="Opens Chart of Accounts with AR Affiliated ledger filtered to this customer"
                        >
                            Chart of Accounts (ledger)
                        </button>
                        <div
                            style={{
                                display: 'inline-flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: 8,
                                marginLeft: 'auto',
                            }}
                        >
                            <button
                                type="button"
                                disabled={logLoading || affiliatedLedgerLines.length === 0}
                                title={
                                    logLoading || affiliatedLedgerLines.length === 0
                                        ? 'Nothing to export'
                                        : 'Download PDF'
                                }
                                onClick={() => {
                                    exportAffiliatedTransactionLedgerPdf(
                                        affiliatedLedgerLines,
                                        logExportSubtitle,
                                        logExportFilenameBase,
                                    );
                                }}
                                style={{
                                    ...logToolbarExportBtnStyle,
                                    opacity:
                                        logLoading || affiliatedLedgerLines.length === 0 ? 0.5 : 1,
                                    cursor:
                                        logLoading || affiliatedLedgerLines.length === 0
                                            ? 'not-allowed'
                                            : 'pointer',
                                }}
                            >
                                <FileText size={14} aria-hidden /> PDF
                            </button>
                            <button
                                type="button"
                                disabled={logLoading || affiliatedLedgerLines.length === 0}
                                title={
                                    logLoading || affiliatedLedgerLines.length === 0
                                        ? 'Nothing to export for the current range'
                                        : 'Download spreadsheet (.xlsx)'
                                }
                                onClick={() => {
                                    exportAffiliatedTransactionLedgerExcel(
                                        affiliatedLedgerLines,
                                        logExportFilenameBase,
                                    );
                                }}
                                style={{
                                    ...logToolbarExportBtnStyle,
                                    opacity:
                                        logLoading || affiliatedLedgerLines.length === 0 ? 0.5 : 1,
                                    cursor:
                                        logLoading || affiliatedLedgerLines.length === 0
                                            ? 'not-allowed'
                                            : 'pointer',
                                }}
                            >
                                <FileSpreadsheet size={14} aria-hidden /> Excel
                            </button>
                        </div>
                    </div>
                    <p
                        style={{
                            margin: '0 0 10px',
                            fontSize: '0.78rem',
                            opacity: 0.75,
                            lineHeight: 1.45,
                        }}
                    >
                        Sorted <strong>oldest → newest</strong> for running balance.&nbsp;
                        <strong>Debt (Dr)</strong> increases collectible AR (sales invoices).&nbsp;
                        <strong>Credit (Cr)</strong> lowers it (payments, returns). Other activity
                        (e.g. stock) stays in Title with no Debt/Credit.&nbsp;
                        Balance is cumulative for rows in this date range only.
                    </p>
                    <div style={{ maxHeight: 420, overflow: 'auto' }}>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Type</th>
                                    <th>Title</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Debt (Dr)</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Credit (Cr)</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logLoading ? (
                                    <tr>
                                        <td colSpan={6}>Loading…</td>
                                    </tr>
                                ) : affiliatedLedgerLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>No rows in this range.</td>
                                    </tr>
                                ) : (
                                    affiliatedLedgerLines.map((line) => {
                                        const t = line.raw;
                                        return (
                                            <tr key={t.id}>
                                                <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                                    {new Date(t.createdAt).toLocaleString()}
                                                </td>
                                                <td style={{ fontSize: '0.8rem' }}>{t.transactionType}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                                                    {t.description ? (
                                                        <div
                                                            style={{
                                                                fontSize: '0.78rem',
                                                                opacity: 0.75,
                                                            }}
                                                        >
                                                            {t.description}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td
                                                    style={{
                                                        whiteSpace: 'nowrap',
                                                        textAlign: 'right',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {line.debit != null ? (
                                                        <>
                                                            {fmtLedgerAmt(line.debit)}{' '}
                                                            <span style={{ opacity: 0.65 }}>
                                                                {line.currencyCode}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td
                                                    style={{
                                                        whiteSpace: 'nowrap',
                                                        textAlign: 'right',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {line.credit != null ? (
                                                        <>
                                                            {fmtLedgerAmt(line.credit)}{' '}
                                                            <span style={{ opacity: 0.65 }}>
                                                                {line.currencyCode}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td
                                                    style={{
                                                        whiteSpace: 'nowrap',
                                                        textAlign: 'right',
                                                        fontWeight: 700,
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {fmtLedgerAmt(line.balance)}{' '}
                                                    <span style={{ opacity: 0.65 }}>
                                                        {line.currencyCode}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Modal>
            ) : null}
        </div>
    );
}
