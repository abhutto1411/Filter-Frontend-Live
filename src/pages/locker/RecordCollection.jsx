import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle, RefreshCw, Upload, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const MAX_PROOF_SIZE_BYTES = 2 * 1024 * 1024;

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const rowCashierName = (row) =>
    row?.cashierName || row?.cashier?.name || row?.cashierUser?.name || '—';

function paymentBreakdown(detail, key) {
    const cc = detail?.counterClosing;
    if (!cc) return { physical: 0, system: 0, diff: 0 };
    const nested = cc[key];
    if (nested && typeof nested === 'object') {
        return {
            physical: Number(nested.physical || 0),
            system: Number(nested.system || 0),
            diff: Number(nested.diff || 0),
        };
    }
    const prefix = key === 'cash' ? 'Cash' : key.charAt(0).toUpperCase() + key.slice(1);
    return {
        physical: Number(cc[`physical${prefix}`] || 0),
        system: Number(cc[`system${prefix}Total`] || 0),
        diff: Number(cc[`${key}Diff`] || cc[`${key === 'cash' ? 'cash' : key}Diff`] || 0),
    };
}

function ClosingRow({ label, physical, system, diff, editable, value, onChange }) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 1fr 1fr',
                gap: 12,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid #eef2f7',
            }}
        >
            <div style={{ fontWeight: 700, color: '#1f2937' }}>{label}</div>
            <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>Physical</div>
                {editable ? (
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        placeholder="0.00"
                    />
                ) : (
                    <strong>{fmtSar(physical)}</strong>
                )}
            </div>
            <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>System</div>
                <span style={{ color: '#475569' }}>{fmtSar(system)}</span>
            </div>
            <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>Difference</div>
                <span style={{ color: diff !== 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                    {fmtSar(diff)}
                </span>
            </div>
        </div>
    );
}

function ProofPicker({ fileInputRef, cameraInputRef, proofFile, proofPreview, onPick, onClear }) {
    return (
        <div>
            <div
                onClick={() => !proofPreview && fileInputRef.current?.click()}
                style={{
                    minHeight: 150,
                    borderRadius: 12,
                    border: `1.5px dashed ${proofPreview ? '#16a34a' : '#cbd5e1'}`,
                    background: proofPreview ? '#fff' : '#FAFBFC',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: proofPreview ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={onPick}
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={onPick}
                />
                {proofPreview ? (
                    <>
                        <img
                            src={proofPreview}
                            alt="Collection proof"
                            style={{
                                width: '100%',
                                minHeight: 150,
                                maxHeight: 280,
                                objectFit: 'contain',
                                background: '#000',
                            }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                display: 'flex',
                                gap: 6,
                            }}
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.92)',
                                    border: 'none',
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <Upload size={12} /> Replace
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClear();
                                }}
                                style={{
                                    background: 'rgba(239,68,68,0.95)',
                                    border: 'none',
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    color: '#fff',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <X size={12} /> Remove
                            </button>
                        </div>
                        {proofFile ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 8,
                                    left: 8,
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    background: 'rgba(255,255,255,0.92)',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: '#1E2124',
                                }}
                            >
                                {proofFile.name} · {(proofFile.size / 1024).toFixed(0)} KB
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>
                        <Upload size={28} color="#94a3b8" style={{ marginBottom: 8 }} />
                        <p style={{ margin: 0, fontWeight: 700, color: '#1E2124' }}>
                            Attach proof of collection
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                            JPG / PNG · max 2 MB
                        </p>
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <Upload size={14} /> Upload image
                </button>
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => cameraInputRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <Camera size={14} /> Take photo
                </button>
            </div>
        </div>
    );
}

export default function RecordCollection({ portalRole = 'supervisor' }) {
    const isCollector = portalRole === 'collector';
    const [searchParams, setSearchParams] = useSearchParams();
    const requestIdFromUrl = searchParams.get('requestId') || '';

    const [requests, setRequests] = useState([]);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ requestId: '', receivedAmount: '', notes: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/collection-requests${qs({
                    view: isCollector ? 'collector' : 'supervisor',
                    status: isCollector ? 'assigned' : 'open',
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
    }, [isCollector]);

    const loadDetail = useCallback(async (requestId) => {
        if (!requestId) {
            setDetail(null);
            return;
        }
        setDetailLoading(true);
        setError('');
        try {
            const res = await apiFetch(`/locker/collection-requests/${requestId}`);
            setDetail(res);
            const cash = paymentBreakdown(res, 'cash');
            setForm((f) => ({
                ...f,
                requestId: String(requestId),
                receivedAmount:
                    f.receivedAmount !== ''
                        ? f.receivedAmount
                        : String(cash.physical || res.totalSecuredAsset || ''),
            }));
        } catch (e) {
            setDetail(null);
            setError(e?.message || 'Failed to load request details');
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    useEffect(() => {
        if (requestIdFromUrl) {
            setForm((f) => ({ ...f, requestId: requestIdFromUrl }));
            loadDetail(requestIdFromUrl);
        }
    }, [requestIdFromUrl, loadDetail]);

    const selected =
        detail ||
        requests.find((r) => String(r.id) === String(form.requestId));

    const clearProof = () => {
        setProofFile(null);
        setProofPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const onPickProof = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) {
            setError('Please pick an image file.');
            e.target.value = '';
            return;
        }
        if (f.size > MAX_PROOF_SIZE_BYTES) {
            setError('Image is too large (max 2 MB).');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setProofFile(f);
            setProofPreview(reader.result);
            setError('');
        };
        reader.readAsDataURL(f);
    };

    const onRequestChange = (requestId) => {
        setForm({ requestId, receivedAmount: '', notes: '' });
        clearProof();
        setSuccess(null);
        if (requestId) {
            setSearchParams({ requestId });
            loadDetail(requestId);
        } else {
            setSearchParams({});
            setDetail(null);
        }
    };

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
                    ...(proofPreview ? { proofUrl: proofPreview } : {}),
                }),
            });
            if (res?.success === false) throw new Error(res?.message || 'Failed to record');
            setSuccess(res);
            setForm({ requestId: '', receivedAmount: '', notes: '' });
            clearProof();
            setDetail(null);
            setSearchParams({});
            await loadRequests();
        } catch (e) {
            setError(e?.message || 'Failed to record collection');
        } finally {
            setSubmitting(false);
        }
    };

    const cashBreakdown = detail ? paymentBreakdown(detail, 'cash') : null;
    const bankBreakdown = detail ? paymentBreakdown(detail, 'bank') : null;
    const tabbyBreakdown = detail ? paymentBreakdown(detail, 'tabby') : null;
    const tamaraBreakdown = detail ? paymentBreakdown(detail, 'tamara') : null;
    const corporateBreakdown = detail ? paymentBreakdown(detail, 'corporate') : null;

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Record Collection</h2>
                    <p className="ws-page-sub">
                        {isCollector
                            ? 'Collect assigned cash from the POS cashier and attach proof'
                            : 'Review counter closing, record cash received, and attach proof'}
                    </p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={() => {
                        loadRequests();
                        if (form.requestId) loadDetail(form.requestId);
                    }}
                    disabled={loading || detailLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading || detailLoading ? 'spin' : ''} /> Refresh
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
                    {success.collection?.status === 'pending_approval' ? (
                        <> · Variance sent to locker supervisor / workshop admin for approval</>
                    ) : null}
                    {success.collection?.journalId ? (
                        <> · JE #{success.collection.journalId}</>
                    ) : null}
                </div>
            ) : null}

            <div className="ws-section" style={{ maxWidth: 920, padding: 24 }}>
                {!requestIdFromUrl ? (
                    <div className="ws-form-grid" style={{ marginBottom: 20 }}>
                        <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Request *</label>
                            <select
                                value={form.requestId}
                                onChange={(e) => onRequestChange(e.target.value)}
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
                    </div>
                ) : null}

                {detailLoading ? (
                    <p style={{ color: '#64748b' }}>Loading request details…</p>
                ) : null}

                {selected && detail ? (
                    <>
                        <div
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 20,
                            }}
                        >
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Request</div>
                                    <strong>{detail.referenceCode}</strong>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Branch</div>
                                    <strong>{detail.branch?.name}</strong>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Cashier</div>
                                    <strong>{detail.cashier?.name}</strong>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Expected cash</div>
                                    <strong>{fmtSar(detail.totalSecuredAsset)}</strong>
                                </div>
                                {detail.assignedOfficer?.name ? (
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Collector</div>
                                        <strong>{detail.assignedOfficer.name}</strong>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Counter closing</h3>
                        <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.85rem' }}>
                            Enter the cash collected from the cashier. Other payment methods are shown
                            for reference only.
                        </p>

                        <div style={{ marginBottom: 20 }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '140px 1fr 1fr 1fr',
                                    gap: 12,
                                    padding: '0 0 8px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    color: '#94a3b8',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                }}
                            >
                                <div>Method</div>
                                <div>Physical</div>
                                <div>System</div>
                                <div>Difference</div>
                            </div>

                            <ClosingRow
                                label="Cash"
                                physical={cashBreakdown.physical}
                                system={cashBreakdown.system}
                                diff={cashBreakdown.diff}
                                editable
                                value={form.receivedAmount}
                                onChange={(value) => setForm((f) => ({ ...f, receivedAmount: value }))}
                            />
                            <ClosingRow
                                label="Bank"
                                physical={bankBreakdown.physical}
                                system={bankBreakdown.system}
                                diff={bankBreakdown.diff}
                            />
                            <ClosingRow
                                label="Tabby"
                                physical={tabbyBreakdown.physical}
                                system={tabbyBreakdown.system}
                                diff={tabbyBreakdown.diff}
                            />
                            <ClosingRow
                                label="Tamara"
                                physical={tamaraBreakdown.physical}
                                system={tamaraBreakdown.system}
                                diff={tamaraBreakdown.diff}
                            />
                            <ClosingRow
                                label="Corporate"
                                physical={corporateBreakdown.physical}
                                system={corporateBreakdown.system}
                                diff={corporateBreakdown.diff}
                            />
                        </div>

                        <div className="ws-form-grid">
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Remarks / notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                    placeholder="Variance reason, witness name, or other remarks"
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 8,
                                        padding: 10,
                                        resize: 'vertical',
                                    }}
                                />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Proof attachment (optional)</label>
                                <ProofPicker
                                    fileInputRef={fileInputRef}
                                    cameraInputRef={cameraInputRef}
                                    proofFile={proofFile}
                                    proofPreview={proofPreview}
                                    onPick={onPickProof}
                                    onClear={clearProof}
                                />
                            </div>
                        </div>
                    </>
                ) : null}

                {!detailLoading && !detail && form.requestId ? (
                    <p style={{ color: '#64748b' }}>Could not load details for this request.</p>
                ) : null}

                {!detailLoading && !form.requestId ? (
                    <p style={{ color: '#64748b' }}>
                        Select a request from Pending Requests or use the dropdown above.
                    </p>
                ) : null}

                {detail ? (
                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            justifyContent: 'flex-end',
                            marginTop: 24,
                        }}
                    >
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => onRequestChange('')}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-submit"
                            onClick={submit}
                            disabled={submitting}
                        >
                            {submitting ? 'Recording…' : isCollector ? 'Submit collection' : 'Approve and record collection'}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
