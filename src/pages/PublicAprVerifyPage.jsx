import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, Loader2, PackageMinus, Lock } from 'lucide-react';
import {
    getPublicAffiliatedPurchaseReturnVerify,
    publicConfirmAffiliatedPurchaseReturnWithPassword,
} from '../services/publicVerifyApi';
import './PublicWpiVerifyPage.css';

function fmtMoney(n, cur = 'SAR') {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return `${cur} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
    if (!d) return '—';
    try {
        const x = new Date(d);
        if (Number.isNaN(x.getTime())) return String(d).slice(0, 10);
        return x.toISOString().slice(0, 10);
    } catch {
        return '—';
    }
}

/**
 * Public landing when scanning QR on an affiliated workshop purchase return.
 * GET /public/affiliated-purchase-returns/:qrToken
 */
export default function PublicAprVerifyPage() {
    const { qrToken } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [confirmResult, setConfirmResult] = useState(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        getPublicAffiliatedPurchaseReturnVerify(qrToken)
            .then((res) => {
                if (!active) return;
                setData(res);
            })
            .catch((err) => {
                if (!active) setError(err?.message || 'Could not verify this purchase return.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [qrToken]);

    const handleConfirmSubmit = async (e) => {
        e?.preventDefault?.();
        if (submitting) return;
        if (!password.trim()) {
            setConfirmError('Enter the workshop or branch password.');
            return;
        }
        setSubmitting(true);
        setConfirmError('');
        try {
            const res = await publicConfirmAffiliatedPurchaseReturnWithPassword(qrToken, password);
            setConfirmResult(res);
            setConfirmOpen(false);
            setPassword('');
            const refreshed = await getPublicAffiliatedPurchaseReturnVerify(qrToken);
            setData(refreshed);
        } catch (err) {
            setConfirmError(err?.message || 'Could not authenticate. Check the password and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const finalized = Boolean(data?.finalized || data?.finalizedAt || confirmResult?.success);
    const currency = data?.currencyCode || 'SAR';
    const supplierConfirms = data?.confirmWithParty === 'supplier' || data?.initiatedBy === 'workshop';

    return (
        <div className="public-verify-page">
            <header className="public-verify-header">
                <Link to="/" className="public-verify-brand">
                    Filter
                </Link>
            </header>

            <main className="public-verify-main">
                {loading ? (
                    <div className="public-verify-card public-verify-card--center">
                        <Loader2 className="public-verify-spin" size={32} />
                        <p>Verifying purchase return…</p>
                    </div>
                ) : error ? (
                    <div className="public-verify-card public-verify-card--error">
                        <AlertTriangle size={28} />
                        <h1>Verification failed</h1>
                        <p>{error}</p>
                    </div>
                ) : data ? (
                    <div className="public-verify-card">
                        <div className="public-verify-badge-row">
                            {finalized ? (
                                <span className="public-verify-pill public-verify-pill--ok">
                                    <ShieldCheck size={16} /> Finalized
                                </span>
                            ) : (
                                <span className="public-verify-pill public-verify-pill--pending">
                                    <PackageMinus size={16} />{' '}
                                    {supplierConfirms
                                        ? 'Pending supplier confirmation'
                                        : 'Pending workshop confirmation'}
                                </span>
                            )}
                        </div>

                        <h1>Purchase return {data.returnNumber || ''}</h1>
                        <p className="public-verify-sub">
                            {data.supplierName ? `From ${data.supplierName}` : 'Affiliated supplier return'}
                            {data.workshopName ? ` · ${data.workshopName}` : ''}
                            {data.branchName ? ` · ${data.branchName}` : ''}
                        </p>

                        <dl className="public-verify-dl">
                            <div>
                                <dt>Issue date</dt>
                                <dd>{fmtDate(data.issueDate)}</dd>
                            </div>
                            <div>
                                <dt>Reference</dt>
                                <dd>{data.reference || data.supplierSalesReturnNo || '—'}</dd>
                            </div>
                            <div>
                                <dt>Grand total</dt>
                                <dd>{fmtMoney(data.grandTotal, currency)}</dd>
                            </div>
                            {data.sourcePurchaseInvoiceNumber ? (
                                <div>
                                    <dt>Source purchase invoice</dt>
                                    <dd>{data.sourcePurchaseInvoiceNumber}</dd>
                                </div>
                            ) : null}
                        </dl>

                        {data.stockRevertSummary ? (
                            <p className="public-verify-note">{data.stockRevertSummary}</p>
                        ) : null}

                        {Array.isArray(data.lines) && data.lines.length > 0 ? (
                            <table className="public-verify-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.lines.map((ln, idx) => (
                                        <tr key={idx}>
                                            <td>{ln.itemName}</td>
                                            <td>
                                                {ln.qty} {ln.uom || ''}
                                            </td>
                                            <td>{fmtMoney(ln.total, currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : null}

                        {!finalized ? (
                            <button
                                type="button"
                                className="public-verify-btn public-verify-btn--primary"
                                onClick={() => setConfirmOpen(true)}
                            >
                                <Lock size={16} />{' '}
                                {supplierConfirms
                                    ? 'Confirm return with supplier password'
                                    : 'Confirm return with workshop password'}
                            </button>
                        ) : (
                            <p className="public-verify-success">
                                This return has been finalized. Stock and accounting were updated on both sides.
                                {confirmResult?.alreadyFinalized
                                    ? ' Scanning again will not receive stock a second time.'
                                    : null}
                            </p>
                        )}
                    </div>
                ) : null}
            </main>

            {confirmOpen ? (
                <div className="public-verify-modal-backdrop" role="presentation" onClick={() => !submitting && setConfirmOpen(false)}>
                    <div
                        className="public-verify-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2>Confirm purchase return</h2>
                        <p>
                            {supplierConfirms
                                ? 'Enter your supplier portal login password to receive returned stock. This QR can only finalize stock once.'
                                : 'Enter your workshop or branch login password to finalize this return. Branch stock will decrease and the linked supplier return will be posted.'}
                        </p>
                        <form onSubmit={handleConfirmSubmit}>
                            <label className="public-verify-field">
                                <span>{supplierConfirms ? 'Supplier password' : 'Workshop password'}</span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    disabled={submitting}
                                />
                            </label>
                            {confirmError ? <p className="public-verify-error">{confirmError}</p> : null}
                            <div className="public-verify-modal-actions">
                                <button type="button" disabled={submitting} onClick={() => setConfirmOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="public-verify-btn public-verify-btn--primary" disabled={submitting}>
                                    {submitting ? 'Confirming…' : 'Confirm return'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
