import React from 'react';
import { Loader2 } from 'lucide-react';
import { isClickableInvoiceRef } from '../../utils/posInvoiceActions';
import '../../styles/ui.css';

/**
 * Clickable invoice number — opens tax invoice preview and downloads PDF.
 *
 * It renders inside other people's tables, so it carries `ui-tokens` itself
 * rather than assuming a styled ancestor.
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
            className={`ui-link ui-tokens${className ? ` ${className}` : ''}`}
            disabled={loading}
            title="Open invoice & download PDF"
            onClick={(e) => {
                e.stopPropagation();
                onOpen?.({ invoiceId, invoiceNo, workshopId });
            }}
        >
            {loading ? <Loader2 size={12} className="ui-spin" /> : null}
            {label}
        </button>
    );
}
