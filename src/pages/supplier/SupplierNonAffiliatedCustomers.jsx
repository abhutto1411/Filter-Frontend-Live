import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';
import {
    addSupplierExternalPartyLedger,
    createSupplierExternalParty,
    deactivateSupplierExternalParty,
    getSupplierExternalPartyTransactions,
    listSupplierExternalParties,
    updateSupplierExternalParty,
} from '../../services/supplierApi';

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
    const [transactions, setTransactions] = useState([]);
    const [logLoading, setLogLoading] = useState(false);

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
            setTransactions(Array.isArray(res?.transactions) ? res.transactions : []);
        } catch (e) {
            console.error(e);
            setErr(e?.message || 'Transaction load failed');
        } finally {
            setLogLoading(false);
        }
    }, []);

    const openDetail = async (row) => {
        setDetail(row);
        setLogFrom('');
        setLogTo('');
        await refreshLog(row.id, {});
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
            await loadParties();
            const qp = {};
            if (logFrom.trim()) qp.from = logFrom.trim();
            if (logTo.trim()) qp.to = logTo.trim();
            await refreshLog(detail.id, qp);
            const resList = await listSupplierExternalParties();
            const rows = Array.isArray(resList?.parties) ? resList.parties : [];
            const nu = rows.find((r) => r.id === detail.id);
            if (nu) setDetail(nu);
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
                    Add party
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
                                <td colSpan={3}>No parties yet — use “Add party”.</td>
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
                                    <td>
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            style={{ padding: '6px 10px', marginRight: 6 }}
                                            onClick={(ev) => {
                                                ev.stopPropagation();
                                                openEdit(r);
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            style={{ padding: '6px 10px' }}
                                            onClick={(ev) => {
                                                ev.stopPropagation();
                                                onDeactivate(r);
                                            }}
                                        >
                                            <Trash2 size={14} aria-hidden />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {addOpen ? (
                <Modal
                    title="Add non-affiliated party"
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
                                type="button"
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
                                type="button"
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
                    title={detail.displayName}
                    onClose={() => setDetail(null)}
                    width={880}
                    footer={
                        <button type="button" className="btn-portal-outline" onClick={() => setDetail(null)}>
                            Close
                        </button>
                    }
                >
                    <p style={{ marginTop: 0, fontWeight: 700 }}>{fmtBalance(detail.balance)}</p>

                    <form onSubmit={submitLedger} style={{ marginBottom: 16 }}>
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
                                        setLedgerForm((f) => ({ ...f, description: e.target.value }))
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

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 10,
                            alignItems: 'flex-end',
                            marginBottom: 12,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>From</div>
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
                        <button type="button" className="btn-portal" onClick={applyRange} disabled={logLoading}>
                            {logLoading ? 'Loading…' : 'Apply range'}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => {
                                setLogFrom('');
                                setLogTo('');
                                refreshLog(detail.id, {});
                            }}
                            disabled={logLoading}
                        >
                            Clear filter
                        </button>
                    </div>

                    <div style={{ maxHeight: 380, overflow: 'auto' }}>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Txn date</th>
                                    <th>Type</th>
                                    <th>Title</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logLoading ? (
                                    <tr>
                                        <td colSpan={4}>Loading…</td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>No ledger lines.</td>
                                    </tr>
                                ) : (
                                    transactions.map((t) => (
                                        <tr key={t.id}>
                                            <td style={{ whiteSpace: 'nowrap' }}>{t.txnDate}</td>
                                            <td>{t.entryType}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{t.title}</div>
                                                {t.reference ? (
                                                    <div style={{ fontSize: '0.76rem', opacity: 0.7 }}>
                                                        Ref {t.reference}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td>{Number(t.amount || 0).toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Modal>
            ) : null}
        </div>
    );
}

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.12)',
};

const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700 };
