import React, { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Plus } from 'lucide-react';
import Modal from '../../components/Modal';
import RowActionsMenu from '../../components/RowActionsMenu';
import {
    addSupplierExternalPartyLedger,
    createSupplierExternalParty,
    deactivateSupplierExternalParty,
    getSupplierExternalPartyTransactions,
    listSupplierExternalParties,
    updateSupplierExternalParty,
} from '../../services/supplierApi';
import {
    exportCustomerLedgerExcel,
    exportCustomerLedgerPdf,
} from '../../utils/supplierLedgerExport';

function fmtMoney(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function fmtBalance(n) {
    const v = Number(n || 0);
    const abs = Math.abs(v).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    if (v > 0.005) return `SAR ${abs} — they owe you`;
    if (v < -0.005) return `SAR ${abs} — you owe them`;
    return 'SAR 0.00 — settled';
}

function todayYmd() {
    return new Date().toISOString().slice(0, 10);
}

function firstOfMonthYmd() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
}
export default function SupplierNonAffiliatedCustomers() {
    const [partyRows, setPartyRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [addOpen, setAddOpen] = useState(false);
    const [savingParty, setSavingParty] = useState(false);
    const [partyForm, setPartyForm] = useState({
        displayName: '',
        phone: '',
        email: '',
        notes: '',
    });

    const [editParty, setEditParty] = useState(null);

    const [detail, setDetail] = useState(null);
    const [logFrom, setLogFrom] = useState('');
    const [logTo, setLogTo] = useState('');
    const [ledgerData, setLedgerData] = useState(null);
    const [logLoading, setLogLoading] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [ledgerForm, setLedgerForm] = useState({
        txnDate: todayYmd(),
        amount: '',
        entryType: 'charge',
        title: '',
        description: '',
        reference: '',
    });
    const [savingLedger, setSavingLedger] = useState(false);

    const loadParties = useCallback(async () => {
        setErr('');
        setLoading(true);
        try {
            const res = await listSupplierExternalParties();
            setPartyRows(Array.isArray(res?.parties) ? res.parties : []);
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadParties();
    }, [loadParties]);

    const refreshLog = useCallback(async (partyId, params = {}) => {
        setLogLoading(true);
        try {
            const res = await getSupplierExternalPartyTransactions(partyId, params);
            setLedgerData(res);
            return res;
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Transaction load failed');
            setLedgerData(null);
            return null;
        } finally {
            setLogLoading(false);
        }
    }, []);

    const openDetail = async (row) => {
        const from = firstOfMonthYmd();
        const to = todayYmd();
        setDetail(row);
        setLogFrom(from);
        setLogTo(to);
        setShowManualEntry(false);
        setLedgerData(null);
        await refreshLog(row.id, { from, to });
        setLedgerForm({
            txnDate: todayYmd(),
            amount: '',
            entryType: 'charge',
            title: '',
            description: '',
            reference: '',
        });
    };
    const submitParty = async (e) => {
        e.preventDefault();
        if (!partyForm.displayName.trim()) return;
        setSavingParty(true);
        try {
            await createSupplierExternalParty({
                displayName: partyForm.displayName.trim(),
                phone: partyForm.phone.trim() || undefined,
                email: partyForm.email.trim() || undefined,
                notes: partyForm.notes.trim() || undefined,
            });
            setAddOpen(false);
            setPartyForm({ displayName: '', phone: '', email: '', notes: '' });
            await loadParties();
        } catch (errSubmit) {
            console.error(errSubmit);
            setErr(errSubmit?.message || 'Save failed');
        } finally {
            setSavingParty(false);
        }
    };

    const submitEditParty = async (e) => {
        e.preventDefault();
        if (!editParty?.id || !partyForm.displayName.trim()) return;
        setSavingParty(true);
        try {
            await updateSupplierExternalParty(editParty.id, {
                displayName: partyForm.displayName.trim(),
                phone: partyForm.phone.trim() || undefined,
                email: partyForm.email.trim() || undefined,
                notes: partyForm.notes.trim() || undefined,
            });
            setEditParty(null);
            await loadParties();
            if (detail?.id === editParty.id) {
                setDetail((d) =>
                    d
                        ? {
                              ...d,
                              displayName: partyForm.displayName.trim(),
                              phone: partyForm.phone.trim() || null,
                              email: partyForm.email.trim() || null,
                              notes: partyForm.notes.trim() || null,
                          }
                        : d,
                );
            }
        } catch (errSubmit) {
            console.error(errSubmit);
            setErr(errSubmit?.message || 'Update failed');
        } finally {
            setSavingParty(false);
        }
    };

    const onDeactivate = async (row) => {
        if (
            !window.confirm(
                'Deactivate this party? They disappear from your list until re-added.',
            )
        ) {
            return;
        }
        try {
            await deactivateSupplierExternalParty(row.id);
            if (detail?.id === row.id) setDetail(null);
            await loadParties();
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Remove failed');
        }
    };

    const applyRange = () => {
        if (!detail) return;
        const p = {};
        if (logFrom.trim()) p.from = logFrom.trim();
        if (logTo.trim()) p.to = logTo.trim();
        refreshLog(detail.id, p);
    };

    const clearRange = () => {
        if (!detail) return;
        setLogFrom('');
        setLogTo('');
        refreshLog(detail.id, {});
    };

    const onExportPdf = () => {
        if (!ledgerData) return;
        exportCustomerLedgerPdf({
            header: {
                ...(ledgerData.header || {}),
                customerName: ledgerData.header?.customerName || detail?.displayName || '',
            },
            openingBalance: ledgerData.openingBalance ?? 0,
            rows: ledgerData.rows ?? [],
            totals: ledgerData.totals,
        });
    };

    const onExportExcel = () => {
        if (!ledgerData) return;
        exportCustomerLedgerExcel({
            header: {
                ...(ledgerData.header || {}),
                customerName: ledgerData.header?.customerName || detail?.displayName || '',
            },
            openingBalance: ledgerData.openingBalance ?? 0,
            rows: ledgerData.rows ?? [],
            totals: ledgerData.totals,
        });
    };
    const submitLedger = async (e) => {
        e.preventDefault();
        if (!detail) return;
        const amt = Number(ledgerForm.amount);
        if (!ledgerForm.title.trim() || Number.isNaN(amt)) return;
        setSavingLedger(true);
        try {
            await addSupplierExternalPartyLedger(detail.id, {
                txnDate: ledgerForm.txnDate,
                amount: amt,
                entryType: ledgerForm.entryType,
                title: ledgerForm.title.trim(),
                description: ledgerForm.description.trim() || undefined,
                reference: ledgerForm.reference.trim() || undefined,
            });
            const qp = {};
            if (logFrom.trim()) qp.from = logFrom.trim();
            if (logTo.trim()) qp.to = logTo.trim();
            const res = await refreshLog(detail.id, qp);
            if (res?.currentBalance != null) {
                setDetail((d) =>
                    d ? { ...d, balance: Number(res.currentBalance) } : d,
                );
            }
            await loadParties();
            setLedgerForm({
                txnDate: todayYmd(),
                amount: '',
                entryType: 'charge',
                title: '',
                description: '',
                reference: '',
            });
        } catch (errSubmit) {
            console.error(errSubmit);
            setErr(errSubmit?.message || 'Ledger save failed');
        } finally {
            setSavingLedger(false);
        }
    };

    const openEdit = (row) => {
        setPartyForm({
            displayName: row.displayName || '',
            phone: row.phone || '',
            email: row.email || '',
            notes: row.notes || '',
        });
        setEditParty(row);
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Non-affiliated customers / workshops</h2>
                    <p className="ws-page-sub">
                        Manually track parties outside Filter: running balance from your ledger lines, with
                        dated transaction history.
                    </p>
                </div>
                <button type="button" className="btn-portal" onClick={() => setAddOpen(true)}>
                    <Plus size={16} />
                    Add Non-Affiliated Customer
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
                            <th>Party</th>
                            <th>Balance</th>
                            <th style={{ width: 180 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={3}>Loading…</td>
                            </tr>
                        ) : partyRows.length === 0 ? (
                            <tr>
                                <td colSpan={3}>No customers yet — use &quot;Add Non-Affiliated Customer&quot;.</td>
                            </tr>
                        ) : (
                            partyRows.map((r) => (
                                <tr
                                    key={r.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => openDetail(r)}
                                >
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{r.displayName}</div>
                                        <div style={{ fontSize: '0.76rem', opacity: 0.65 }}>
                                            {[r.phone, r.email].filter(Boolean).join(' · ') || '—'}
                                        </div>
                                    </td>
                                    <td>{fmtBalance(r.balance)}</td>
                                    <td onClick={(ev) => ev.stopPropagation()}>
                                        <RowActionsMenu
                                            ariaLabel={`Actions for ${r.displayName || 'customer'}`}
                                            items={[
                                                {
                                                    label: 'Edit',
                                                    onClick: () => openEdit(r),
                                                },
                                                {
                                                    label: 'Deactivate',
                                                    onClick: () => onDeactivate(r),
                                                    danger: true,
                                                },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {addOpen ? (
                <Modal
                    title="Add Non-Affiliated Customer"
                    onClose={() => !savingParty && setAddOpen(false)}
                    disableClose={savingParty}
                    footer={
                        <>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setAddOpen(false)}
                                disabled={savingParty}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-portal"
                                form="party-add-form"
                                disabled={savingParty}
                            >
                                {savingParty ? 'Saving…' : 'Save'}
                            </button>
                        </>
                    }
                >
                    <form id="party-add-form" onSubmit={submitParty}>
                        <label className="ws-form-label-block">
                            Display name
                            <input
                                required
                                className="ws-input-like"
                                value={partyForm.displayName}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, displayName: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            Phone
                            <input
                                className="ws-input-like"
                                value={partyForm.phone}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, phone: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            Email
                            <input
                                className="ws-input-like"
                                type="email"
                                value={partyForm.email}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, email: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            Notes
                            <textarea
                                className="ws-input-like"
                                rows={2}
                                value={partyForm.notes}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, notes: e.target.value }))
                                }
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </label>
                    </form>
                </Modal>
            ) : null}

            {editParty ? (
                <Modal
                    title={`Edit — ${editParty.displayName}`}
                    onClose={() => !savingParty && setEditParty(null)}
                    disableClose={savingParty}
                    footer={
                        <>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setEditParty(null)}
                                disabled={savingParty}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-portal"
                                form="party-edit-form"
                                disabled={savingParty}
                            >
                                {savingParty ? 'Saving…' : 'Update'}
                            </button>
                        </>
                    }
                >
                    <form id="party-edit-form" onSubmit={submitEditParty}>
                        <label className="ws-form-label-block">
                            Display name
                            <input
                                required
                                className="ws-input-like"
                                value={partyForm.displayName}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, displayName: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            Phone
                            <input
                                className="ws-input-like"
                                value={partyForm.phone}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, phone: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            Email
                            <input
                                className="ws-input-like"
                                type="email"
                                value={partyForm.email}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, email: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            Notes
                            <textarea
                                className="ws-input-like"
                                rows={2}
                                value={partyForm.notes}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, notes: e.target.value }))
                                }
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </label>
                    </form>
                </Modal>
            ) : null}

            {detail ? (
                <Modal
                    title={`Customer Ledger — ${detail.displayName}`}
                    onClose={() => setDetail(null)}
                    width={960}
                    footer={
                        <button type="button" className="btn-portal-outline" onClick={() => setDetail(null)}>
                            Close
                        </button>
                    }
                >
                    <div
                        style={{
                            marginBottom: 16,
                            padding: '14px 16px',
                            borderRadius: 12,
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#64748B',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                            }}
                        >
                            Ledger account
                        </div>
                        <div
                            style={{
                                fontWeight: 800,
                                fontSize: '1.2rem',
                                marginTop: 6,
                                color: '#0F172A',
                                lineHeight: 1.35,
                            }}
                        >
                            {ledgerData?.header?.customerName || detail.displayName}
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 12,
                            marginBottom: 16,
                            padding: 14,
                            borderRadius: 12,
                            border: '1px solid var(--color-border, #e2e8f0)',
                            background: '#F8FAFC',
                        }}
                    >
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>
                                Current balance
                            </div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 4 }}>
                                {fmtBalance(ledgerData?.currentBalance ?? detail.balance)}
                            </div>
                        </div>
                        {ledgerData?.header?.companyName ? (
                            <div style={{ flex: '1 1 200px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>
                                    Your business
                                </div>
                                <div style={{ fontWeight: 600, marginTop: 4 }}>
                                    {ledgerData.header.companyName}
                                </div>
                            </div>
                        ) : null}
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>
                                Statement period
                            </div>
                            <div style={{ fontWeight: 600, marginTop: 4 }}>
                                {(ledgerData?.header?.from || logFrom || '—') +
                                    ' — ' +
                                    (ledgerData?.header?.to || logTo || '—')}
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 10,
                            alignItems: 'flex-end',
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>
                                From
                            </div>
                            <input
                                type="date"
                                value={logFrom}
                                onChange={(e) => setLogFrom(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>To</div>
                            <input
                                type="date"
                                value={logTo}
                                onChange={(e) => setLogTo(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={applyRange}
                            disabled={logLoading}
                        >
                            {logLoading ? 'Loading…' : 'Apply filters'}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={clearRange}
                            disabled={logLoading}
                        >
                            Clear filters
                        </button>
                        <div style={{ flex: 1, minWidth: 12 }} />
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={onExportPdf}
                            disabled={!ledgerData || logLoading}
                        >
                            <FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                            Download PDF
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={onExportExcel}
                            disabled={!ledgerData || logLoading}
                        >
                            <FileSpreadsheet
                                size={14}
                                style={{ marginRight: 6, verticalAlign: -2 }}
                            />
                            Download Excel
                        </button>
                    </div>

                    <div
                        style={{
                            border: '1px solid var(--color-border, #e2e8f0)',
                            borderRadius: 12,
                            overflow: 'hidden',
                            marginBottom: 16,
                        }}
                    >
                        <table className="ws-table" style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 110 }}>Date</th>
                                    <th>Description</th>
                                    <th style={{ width: 120, textAlign: 'right' }}>Debit</th>
                                    <th style={{ width: 120, textAlign: 'right' }}>Credit</th>
                                    <th style={{ width: 130, textAlign: 'right' }}>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                                    <td>—</td>
                                    <td>Opening balance</td>
                                    <td style={{ textAlign: 'right' }}>—</td>
                                    <td style={{ textAlign: 'right' }}>—</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {fmtMoney(ledgerData?.openingBalance ?? 0)}
                                    </td>
                                </tr>
                                {logLoading ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                                            Loading ledger…
                                        </td>
                                    </tr>
                                ) : (ledgerData?.rows ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                                            No transactions in this period.
                                        </td>
                                    </tr>
                                ) : (
                                    (ledgerData?.rows ?? []).map((r) => (
                                        <tr key={r.id}>
                                            <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                                            <td>{r.description || '—'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                {r.debit > 0 ? fmtMoney(r.debit) : ''}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {r.credit > 0 ? fmtMoney(r.credit) : ''}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {fmtMoney(r.runningBalance)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                {ledgerData?.totals ? (
                                    <tr
                                        style={{
                                            background: '#FFF7ED',
                                            fontWeight: 800,
                                            borderTop: '1px solid #FED7AA',
                                        }}
                                    >
                                        <td />
                                        <td>Closing summary</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {fmtMoney(ledgerData.totals.totalDebit)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {fmtMoney(ledgerData.totals.totalCredit)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {fmtMoney(ledgerData.totals.closingBalance)}
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>

                    {ledgerData?.totals ? (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 12,
                                marginBottom: 16,
                            }}
                        >
                            <div style={summaryCardStyle}>
                                <div style={summaryLabelStyle}>Total Debit</div>
                                <div style={{ ...summaryValueStyle, color: '#B91C1C' }}>
                                    SAR {fmtMoney(ledgerData.totals.totalDebit)}
                                </div>
                            </div>
                            <div style={summaryCardStyle}>
                                <div style={summaryLabelStyle}>Total Credit</div>
                                <div style={{ ...summaryValueStyle, color: '#0F766E' }}>
                                    SAR {fmtMoney(ledgerData.totals.totalCredit)}
                                </div>
                            </div>
                            <div style={summaryCardStyle}>
                                <div style={summaryLabelStyle}>Closing Balance</div>
                                <div style={summaryValueStyle}>
                                    SAR {fmtMoney(ledgerData.totals.closingBalance)}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <details
                        open={showManualEntry}
                        onToggle={(e) => setShowManualEntry(e.target.open)}
                    >
                        <summary
                            style={{
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                marginBottom: 8,
                            }}
                        >
                            Record manual payment / adjustment
                        </summary>
                        <form onSubmit={submitLedger}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: 10,
                            }}
                        >
                            <label style={lbl}>
                                Date
                                <input
                                    type="date"
                                    required
                                    value={ledgerForm.txnDate}
                                    onChange={(e) =>
                                        setLedgerForm((f) => ({ ...f, txnDate: e.target.value }))
                                    }
                                    style={inputStyle}
                                />
                            </label>
                            <label style={lbl}>
                                Amount (+ charge / − payment)
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    placeholder="e.g. 500 or -500"
                                    value={ledgerForm.amount}
                                    onChange={(e) =>
                                        setLedgerForm((f) => ({ ...f, amount: e.target.value }))
                                    }
                                    style={inputStyle}
                                />
                            </label>
                            <label style={lbl}>
                                Type
                                <select
                                    value={ledgerForm.entryType}
                                    onChange={(e) =>
                                        setLedgerForm((f) => ({ ...f, entryType: e.target.value }))
                                    }
                                    style={inputStyle}
                                >
                                    <option value="charge">charge</option>
                                    <option value="credit">credit</option>
                                    <option value="payment">payment</option>
                                    <option value="adjustment">adjustment</option>
                                </select>
                            </label>
                            <label style={{ ...lbl, gridColumn: '1 / -1' }}>
                                Title
                                <input
                                    required
                                    value={ledgerForm.title}
                                    onChange={(e) =>
                                        setLedgerForm((f) => ({ ...f, title: e.target.value }))
                                    }
                                    style={inputStyle}
                                />
                            </label>
                            <label style={{ ...lbl, gridColumn: '1 / -1' }}>
                                Description (optional)
                                <input
                                    value={ledgerForm.description}
                                    onChange={(e) =>
                                            setLedgerForm((f) => ({
                                                ...f,
                                                description: e.target.value,
                                            }))
                                    }
                                    style={inputStyle}
                                />
                            </label>
                            <label style={lbl}>
                                Reference (optional)
                                <input
                                    value={ledgerForm.reference}
                                    onChange={(e) =>
                                        setLedgerForm((f) => ({ ...f, reference: e.target.value }))
                                    }
                                    style={inputStyle}
                                />
                            </label>
                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button type="submit" className="btn-portal" disabled={savingLedger}>
                                    {savingLedger ? 'Saving…' : 'Add ledger line'}
                                </button>
                            </div>
                        </div>
                    </form>
                    </details>
                </Modal>
            ) : null}        </div>
    );
}

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.12)',
};

const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700 };

const summaryCardStyle = {
    padding: 14,
    borderRadius: 12,
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
};

const summaryLabelStyle = {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
};

const summaryValueStyle = {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#0F172A',
};