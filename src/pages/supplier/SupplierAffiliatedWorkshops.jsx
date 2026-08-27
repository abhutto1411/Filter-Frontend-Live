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
import { sawT } from '../../utils/supplierAffiliatedWorkshopsI18n';

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

function fmtMoney(amount, currencyCode = 'SAR', t) {
    const n = Number(amount || 0);
    const formatted = Math.abs(n).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    if (n > 0.005) return t('money.theyOwe', { currency: currencyCode, amount: formatted });
    if (n < -0.005) return t('money.youOwe', { currency: currencyCode, amount: formatted });
    return t('money.zero', { currency: currencyCode });
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

function fmtLedgerAmt(value, t) {
    if (value == null || Number.isNaN(value)) return t('emdash');
    return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/** Wrap known phrase fragments in <strong> / <code> inside a localized full string. */
function decoratePhrases(text, specs) {
    if (!text || !specs?.length) return text;
    const phrases = specs.map((s) => s.phrase).filter(Boolean);
    if (!phrases.length) return text;
    const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${escaped.join('|')})`, 'g');
    const tagFor = Object.fromEntries(specs.map((s) => [s.phrase, s.as]));
    return String(text)
        .split(re)
        .map((bit, i) => {
            const tag = tagFor[bit];
            if (tag === 'strong') return <strong key={i}>{bit}</strong>;
            if (tag === 'code') return <code key={i}>{bit}</code>;
            return bit;
        });
}

export default function SupplierAffiliatedWorkshops({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sawT(locale, key, vars), [locale]);
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
        let rangeBit = t('export.allDates');
        if (logFrom && logTo) rangeBit = `${logFrom} → ${logTo}`;
        else if (logFrom) rangeBit = t('export.from', { date: logFrom });
        else if (logTo) rangeBit = t('export.to', { date: logTo });
        return `${scopeLabel} · ${rangeBit} · ${t('export.rows', { n: affiliatedLedgerLines.length })}`;
    }, [logRow, logFrom, logTo, affiliatedLedgerLines.length, t]);

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
            setErr(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

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
            setErr(e?.message || t('err.loadWorkshops'));
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
            setErr(e?.message || t('err.add'));
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
            setErr(e?.message || t('err.status'));
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
            setErr(e?.message || t('err.tx'));
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
            setErr(e?.message || t('err.filter'));
        } finally {
            setLogLoading(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">
                        {decoratePhrases(t('page.sub'), [
                            { phrase: t('page.sub.deactivate'), as: 'strong' },
                            { phrase: t('page.sub.activate'), as: 'strong' },
                        ])}
                    </p>
                    <p className="ws-page-sub" style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.88 }}>
                        {decoratePhrases(t('page.sub2'), [
                            { phrase: t('page.sub2.coa'), as: 'strong' },
                            { phrase: t('page.sub2.ledger'), as: 'strong' },
                            { phrase: t('page.sub2.workshop'), as: 'code' },
                        ])}
                    </p>
                </div>
                <button type="button" className="btn-portal" onClick={openPicker}>
                    <Plus size={16} />
                    {t('btn.add')}
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
                            <th>{t('th.workshop')}</th>
                            <th>{t('th.branch')}</th>
                            <th>{t('th.balance')}</th>
                            <th style={{ width: 220 }}>{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4}>{t('loading')}</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={4}>
                                    {t('empty')}
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
                                        <div style={{ fontWeight: 700 }}>{r.workshopName || t('emdash')}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>
                                            {t('workshopId', { id: r.workshopId })}
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
                                                {t('inactive')}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td>
                                        {rowIsBranch(r) ? (
                                            <>
                                                <div style={{ fontWeight: 600 }}>
                                                    {r.branchName || t('emdash')}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>
                                                    {t('branchId', { id: r.branchId })}
                                                </div>
                                            </>
                                        ) : (
                                            <span style={{ opacity: 0.7, fontStyle: 'italic' }}>
                                                {t('workshopOnly')}
                                            </span>
                                        )}
                                    </td>
                                    <td>{fmtMoney(r.balanceOutstanding, r.currencyCode, t)}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <div
                                            className="ws-branch-active-toggle"
                                            title={
                                                rowIsActive(r)
                                                    ? t('toggle.titleOn')
                                                    : t('toggle.titleOff')
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ justifyContent: 'flex-start', flexWrap: 'nowrap' }}
                                        >
                                            <span
                                                className={`ws-branch-active-toggle-label ${!rowIsActive(r) ? 'is-on' : ''}`}
                                            >
                                                {t('toggle.inactive')}
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
                                                            ? t('aria.turnOff')
                                                            : t('aria.turnOn')
                                                    }
                                                />
                                                <span className="ws-toggle-slider" />
                                            </label>
                                            <span
                                                className={`ws-branch-active-toggle-label ${rowIsActive(r) ? 'is-on' : ''}`}
                                            >
                                                {t('toggle.active')}
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
                    title={t('picker.title')}
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
                                {t('btn.cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={confirmAdd}
                                disabled={adding || pickCount === 0}
                            >
                                {adding ? t('btn.adding') : t('btn.addCount', { n: pickCount })}
                            </button>
                        </>
                    }
                >
                    <p style={{ marginTop: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                        {decoratePhrases(t('picker.hint'), [
                            { phrase: t('picker.hint.approved'), as: 'strong' },
                            { phrase: t('picker.hint.allBranches'), as: 'strong' },
                            { phrase: t('picker.hint.noBranches'), as: 'strong' },
                            { phrase: t('picker.hint.branches'), as: 'strong' },
                        ])}
                    </p>
                    <input
                        type="search"
                        className="ws-input-like"
                        placeholder={t('picker.searchPh')}
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
                                                    {t('picker.alreadyListed')}
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
                                            {t('picker.noBranchesPin')}
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
                                                {t('picker.allBranchesListed')}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.65rem', opacity: 0.55 }}>
                                                {t('picker.selectAllBranches')}
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
                                                                {t('branchId', { id: bid })}
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
                                                                    {t('inactive.short')}
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
                                                                    {t('picker.listed')}
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
                    title={t('log.title', {
                        name: rowIsBranch(logRow)
                            ? formatAffiliatedBranchCustomerLabel(
                                  logRow.workshopName,
                                  logRow.branchName || logRow.branchId,
                              )
                            : formatAffiliatedWorkshopCustomerLabel(
                                  logRow.workshopName || logRow.workshopId,
                              ),
                    })}
                    onClose={() => setLogRow(null)}
                    width={980}
                    footer={
                        <button type="button" className="btn-portal-outline" onClick={() => setLogRow(null)}>
                            {t('btn.close')}
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
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>{t('log.from')}</div>
                            <input
                                type="date"
                                value={logFrom}
                                onChange={(e) => setLogFrom(e.target.value)}
                                style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>{t('log.to')}</div>
                            <input
                                type="date"
                                value={logTo}
                                onChange={(e) => setLogTo(e.target.value)}
                                style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
                            />
                        </div>
                        <button type="button" className="btn-portal" onClick={applyLogFilter} disabled={logLoading}>
                            {logLoading ? t('btn.loading') : t('btn.applyRange')}
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
                            {t('btn.clearFilter')}
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
                            title={t('log.coaTitle')}
                        >
                            {t('btn.coaLedger')}
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
                                        ? t('log.exportNothing')
                                        : t('log.exportPdf')
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
                                <FileText size={14} aria-hidden /> {t('btn.pdf')}
                            </button>
                            <button
                                type="button"
                                disabled={logLoading || affiliatedLedgerLines.length === 0}
                                title={
                                    logLoading || affiliatedLedgerLines.length === 0
                                        ? t('log.exportNothingRange')
                                        : t('log.exportExcel')
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
                                <FileSpreadsheet size={14} aria-hidden /> {t('btn.excel')}
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
                        {decoratePhrases(t('log.hint'), [
                            { phrase: t('log.hint.oldest'), as: 'strong' },
                            { phrase: t('log.hint.debt'), as: 'strong' },
                            { phrase: t('log.hint.credit'), as: 'strong' },
                        ])}
                    </p>
                    <div style={{ maxHeight: 420, overflow: 'auto' }}>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>{t('log.th.when')}</th>
                                    <th>{t('log.th.type')}</th>
                                    <th>{t('log.th.title')}</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>{t('log.th.debt')}</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>{t('log.th.credit')}</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>{t('log.th.balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logLoading ? (
                                    <tr>
                                        <td colSpan={6}>{t('loading')}</td>
                                    </tr>
                                ) : affiliatedLedgerLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>{t('log.empty')}</td>
                                    </tr>
                                ) : (
                                    affiliatedLedgerLines.map((line) => {
                                        const raw = line.raw;
                                        return (
                                            <tr key={raw.id}>
                                                <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                                    {new Date(raw.createdAt).toLocaleString()}
                                                </td>
                                                <td style={{ fontSize: '0.8rem' }}>{raw.transactionType}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{raw.title}</div>
                                                    {raw.description ? (
                                                        <div
                                                            style={{
                                                                fontSize: '0.78rem',
                                                                opacity: 0.75,
                                                            }}
                                                        >
                                                            {raw.description}
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
                                                            {fmtLedgerAmt(line.debit, t)}{' '}
                                                            <span style={{ opacity: 0.65 }}>
                                                                {line.currencyCode}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        t('emdash')
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
                                                            {fmtLedgerAmt(line.credit, t)}{' '}
                                                            <span style={{ opacity: 0.65 }}>
                                                                {line.currencyCode}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        t('emdash')
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
                                                    {fmtLedgerAmt(line.balance, t)}{' '}
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
