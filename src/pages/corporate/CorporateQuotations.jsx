import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Loader2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';

const QUOTE_LIST_REFRESH = 'corporate-price-quotations-changed';

const STATUS_STYLES = {
    pending: { bg: '#FEF3C7', color: '#B45309' },
    approved: { bg: '#D1FAE5', color: '#047857' },
    rejected: { bg: '#FEE2E2', color: '#B91C1C' },
    sent: { bg: '#DBEAFE', color: '#1D4ED8' },
    draft: { bg: '#F1F5F9', color: '#475569' },
};

/** GET /corporate/price-quotations — `{ success, total, quotations: [...] }`. */
function normalizePriceQuotationsList(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.quotations)) return data.quotations;
    if (Array.isArray(data.items)) return data.items;
    return [];
}

function normalizeSummary(data) {
    if (!data || typeof data !== 'object') return null;
    return {
        total: Number(data.total) || 0,
        pending: Number(data.pending) || 0,
        approved: Number(data.approved) || 0,
        rejected: Number(data.rejected) || 0,
    };
}

function formatMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return `SAR ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DetailField({ label, value }) {
    return (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            <p style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', margin: '4px 0 0 0', wordBreak: 'break-word' }}>{value ?? '—'}</p>
        </div>
    );
}

export default function CorporateQuotations({ setQuoteOpen }) {
    const [quotes, setQuotes] = useState([]);
    const [listTotal, setListTotal] = useState(0);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [detailId, setDetailId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const qs = new URLSearchParams();
        qs.set('limit', '50');
        qs.set('offset', '0');
        if (statusFilter.trim()) qs.set('status', statusFilter.trim());
        try {
            const [listRes, sumRes] = await Promise.all([
                apiFetch(`/corporate/price-quotations?${qs.toString()}`),
                apiFetch('/corporate/price-quotations/summary').catch(() => null),
            ]);
            setQuotes(normalizePriceQuotationsList(listRes));
            setListTotal(Number(listRes?.total) || normalizePriceQuotationsList(listRes).length);
            if (sumRes && typeof sumRes === 'object') {
                setSummary(normalizeSummary(sumRes));
            } else {
                setSummary(null);
            }
        } catch {
            setQuotes([]);
            setListTotal(0);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const fn = () => {
            void load();
        };
        window.addEventListener(QUOTE_LIST_REFRESH, fn);
        return () => window.removeEventListener(QUOTE_LIST_REFRESH, fn);
    }, [load]);

    useEffect(() => {
        if (!detailId) {
            setDetail(null);
            return;
        }
        let cancelled = false;
        setDetailLoading(true);
        setDetail(null);
        apiFetch(`/corporate/price-quotations/${encodeURIComponent(detailId)}`)
            .then((res) => {
                if (cancelled) return;
                const q = res?.quotation ?? res?.data?.quotation ?? res?.data ?? res;
                setDetail(q && typeof q === 'object' ? q : null);
            })
            .catch(() => {
                if (!cancelled) setDetail(null);
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [detailId]);

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Price quotations</h2>
                    <p className="ws-page-sub">
                        Lines from{' '}
                        <code style={{ fontSize: '0.75rem' }}>GET /corporate/price-quotations</code>
                        {listTotal > 0 ? ` · ${listTotal} in this filter` : ''}
                    </p>
                    {summary && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                            {[
                                { k: 'Total', v: summary.total },
                                { k: 'Pending', v: summary.pending },
                                { k: 'Approved', v: summary.approved },
                                { k: 'Rejected', v: summary.rejected },
                            ].map(({ k, v }) => (
                                <span
                                    key={k}
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        padding: '4px 10px',
                                        borderRadius: 8,
                                        background: '#F3E8FF',
                                        color: '#6D28D9',
                                    }}
                                >
                                    {k}: {v}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <select
                        className="form-input-field"
                        style={{ minWidth: 160, padding: '8px 10px', fontSize: '0.875rem' }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All statuses</option>
                        <option value="pending">pending</option>
                        <option value="approved">approved</option>
                        <option value="rejected">rejected</option>
                    </select>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        style={{ fontSize: '0.875rem', padding: '8px 12px' }}
                        onClick={() => void load()}
                    >
                        Refresh
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        style={{ background: '#7C3AED', color: '#fff', border: 'none' }}
                        onClick={() => setQuoteOpen(true)}
                    >
                        <Plus size={15} /> Request quotation
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: '#7C3AED' }} />
                </div>
            ) : quotes.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Tag size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No quotation lines yet</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Submit from “Request quotation”; this list uses the corporate price-quotations API.
                    </p>
                    <button
                        type="button"
                        className="btn-portal"
                        style={{ marginTop: 16, background: '#7C3AED', color: '#fff', border: 'none' }}
                        onClick={() => setQuoteOpen(true)}
                    >
                        Request quotation
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {quotes.map((q) => {
                        const status = String(q.status || 'pending').toLowerCase();
                        const st = STATUS_STYLES[status] || STATUS_STYLES.pending;
                        const lineTitle = q.name || '—';
                        const dept = q.departmentName || q.department_name || '';
                        const submitted = q.submittedAt ? new Date(q.submittedAt).toLocaleString() : '';
                        const batch = q.submissionBatchId || q.submission_batch_id;
                        return (
                            <button
                                type="button"
                                key={q.id}
                                className="ws-section"
                                onClick={() => setDetailId(String(q.id))}
                                style={{
                                    marginBottom: 0,
                                    padding: 20,
                                    textAlign: 'left',
                                    width: '100%',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 12,
                                    background: '#fff',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#7C3AED', margin: 0 }}>
                                            #{q.id}
                                            {q.sku ? (
                                                <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}> · {q.sku}</span>
                                            ) : null}
                                        </p>
                                        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-dark)', margin: '6px 0 0 0' }}>{lineTitle}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0' }}>
                                            {q.itemType === 'service' ? 'Service' : 'Product'}
                                            {q.unit ? ` · ${q.unit}` : ''}
                                            {dept ? ` · ${dept}` : ''}
                                        </p>
                                        {batch ? (
                                            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0' }}>
                                                Batch: {batch}
                                            </p>
                                        ) : null}
                                        {q.notes ? (
                                            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                                                Notes: {q.notes}
                                            </p>
                                        ) : null}
                                        {submitted ? (
                                            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                                                Submitted: {submitted}
                                            </p>
                                        ) : null}
                                        {status === 'rejected' && (q.rejectionReason || q.rejection_reason) ? (
                                            <p style={{ fontSize: '0.75rem', color: '#B91C1C', margin: '8px 0 0 0' }}>
                                                {q.rejectionReason || q.rejection_reason}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-dark)', margin: 0 }}>
                                            Quote {formatMoney(q.quotationPrice)} incl. VAT
                                        </p>
                                        <span
                                            style={{
                                                background: st.bg,
                                                color: st.color,
                                                padding: '4px 10px',
                                                borderRadius: 6,
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                textTransform: 'lowercase',
                                            }}
                                        >
                                            {status}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {detailId ? (
                <Modal
                    title="Quotation line"
                    onClose={() => setDetailId(null)}
                    width="min(520px, 94vw)"
                    footer={
                        <button type="button" className="btn-portal-outline" onClick={() => setDetailId(null)}>
                            Close
                        </button>
                    }
                >
                    {detailLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                            <Loader2 className="spin" size={28} style={{ color: '#7C3AED' }} />
                        </div>
                    ) : !detail ? (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Could not load this quotation.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <DetailField label="ID" value={detail.id} />
                            <DetailField label="Status" value={detail.status} />
                            <DetailField label="Item type" value={detail.itemType} />
                            <DetailField label="Name" value={detail.name} />
                            <DetailField label="SKU" value={detail.sku} />
                            <DetailField label="Unit" value={detail.unit} />
                            <DetailField label="Department" value={detail.departmentName} />
                            <DetailField label="Qty" value={detail.qty} />
                            <DetailField label="Quotation price (incl. VAT)" value={formatMoney(detail.quotationPrice)} />
                            <DetailField label="Product ID" value={detail.productId} />
                            <DetailField label="Service ID" value={detail.serviceId} />
                            <DetailField label="Submission batch" value={detail.submissionBatchId} />
                            <DetailField label="Notes" value={detail.notes} />
                            <DetailField label="Submitted" value={detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : ''} />
                            <DetailField label="Reviewed" value={detail.reviewedAt ? new Date(detail.reviewedAt).toLocaleString() : '—'} />
                            <DetailField label="Rejection reason" value={detail.rejectionReason} />
                        </div>
                    )}
                </Modal>
            ) : null}
        </div>
    );
}
