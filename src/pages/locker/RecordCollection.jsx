import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const rowCashierName = (row) =>
    row?.cashierName || row?.cashier?.name || row?.cashierUser?.name || '—';

export default function RecordCollection() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ requestId: '', receivedAmount: '', notes: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/collection-requests${qs({
                    view: 'supervisor',
                    status: 'open',
                    limit: 100,
                })}`,
            );
            const list = res?.items || res?.rows || res?.data || [];
            setRequests(list);
        } catch (e) {
            setError(e?.message || 'Failed to load requests');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const selected = requests.find((r) => String(r.id) === String(form.requestId));

    const submit = async () => {
        if (!form.requestId) {
            setError('Select a request');
            return;
        }
        const amt = Number(form.receivedAmount);
        if (!(amt >= 0)) {
            setError('Received amount must be a number');
            return;
        }
        setSubmitting(true);
        setError('');
        setSuccess(null);
        try {
            const res = await apiFetch('/locker/record-collection', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: form.requestId,
                    receivedAmount: amt,
                    notes: form.notes || undefined,
                }),
            });
            if (res?.success === false) throw new Error(res?.message || 'Failed to record');
            setSuccess(res);
            setForm({ requestId: '', receivedAmount: '', notes: '' });
            await load();
        } catch (e) {
            setError(e?.message || 'Failed to record collection');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Record Collection</h2>
                    <p className="ws-page-sub">Record cash received from cashier locker</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={load}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {error ? (
                <div className="wlk-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} /> {error}
                </div>
            ) : null}
            {success ? (
                <div
                    className="wlk-error"
                    style={{
                        marginBottom: 12,
                        background: '#dcfce7',
                        color: '#15803d',
                        borderColor: '#bbf7d0',
                    }}
                >
                    <CheckCircle size={14} /> {success.message}
                    {success.collection?.journalId ? (
                        <> · JE #{success.collection.journalId}</>
                    ) : null}
                </div>
            ) : null}

            <div className="ws-section" style={{ maxWidth: 720, padding: 24 }}>
                <div className="ws-form-grid">
                    <div className="ws-field">
                        <label>Request *</label>
                        <select
                            value={form.requestId}
                            onChange={(e) => setForm((f) => ({ ...f, requestId: e.target.value }))}
                        >
                            <option value="">Select request…</option>
                            {requests.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.referenceCode} — {r.branchName} — {rowCashierName(r)} —{' '}
                                    {fmtSar(r.expectedAmount)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="ws-field">
                        <label>
                            Received Amount (SAR) *
                            {selected ? (
                                <span style={{ marginLeft: 6, color: '#6b7280', fontWeight: 400 }}>
                                    expected {fmtSar(selected.expectedAmount)}
                                </span>
                            ) : null}
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.receivedAmount}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, receivedAmount: e.target.value }))
                            }
                            placeholder="0.00"
                        />
                    </div>
                    <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                        <label>Notes</label>
                        <input
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Optional notes (variance reason, witness, etc.)"
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button
                        className="btn-secondary"
                        onClick={() => setForm({ requestId: '', receivedAmount: '', notes: '' })}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button className="btn-submit" onClick={submit} disabled={submitting}>
                        {submitting ? 'Recording…' : 'Record Collection'}
                    </button>
                </div>
            </div>
        </div>
    );
}
