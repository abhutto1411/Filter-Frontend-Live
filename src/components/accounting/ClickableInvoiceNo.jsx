import React from 'react';
import { Loader2 } from 'lucide-react';
import { isClickableInvoiceRef } from '../../utils/posInvoiceActions';

const linkStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    font: 'inherit',
    fontWeight: 700,
    color: '#0369A1',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
};

/**
 * Clickable invoice number — opens tax invoice preview and downloads PDF.
 */
export default function ClickableInvoiceNo({
    invoiceId,
    invoiceNo,
    workshopId,
    loadingId = '',
    onOpen,
    className = '',
}) {
    const label = invoiceNo || '—';
    if (!isClickableInvoiceRef(invoiceNo)) {
        return <span>{label}</span>;
    }

    const loadKey = invoiceId || invoiceNo;
    const loading = loadingId && String(loadingId) === String(loadKey);

    return (
        <button
            type="button"
            className={`sa-invoice-link${className ? ` ${className}` : ''}`}
            style={linkStyle}
            disabled={loading}
            title="Open invoice & download PDF"
            onClick={(e) => {
                e.stopPropagation();
                onOpen?.({ invoiceId, invoiceNo, workshopId });
            }}
        >
            {loading ? (
                <span className="sa-invoice-link__loading">
                    <Loader2 size={12} className="spin" /> {label}
                </span>
            ) : (
                label
            )}
        </button>
    );
}
