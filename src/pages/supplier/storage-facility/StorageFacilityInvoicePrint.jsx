import React from 'react';

/** Printable storage-facility invoice (browser print / PDF). */
export default function StorageFacilityInvoicePrint({ brandName, invoice, onClose }) {
    if (!invoice) return null;
    const lines = invoice.lines ?? invoice.items ?? [];

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="sf-invoice-print-root">
            <style>{`
              @media print {
                body * { visibility: hidden; }
                .sf-invoice-print-root, .sf-invoice-print-root * { visibility: visible; }
                .sf-invoice-print-actions { display: none !important; }
                .sf-invoice-print-root { position: absolute; left: 0; top: 0; width: 100%; }
              }
              .sf-invoice-print-sheet {
                max-width: 720px;
                margin: 0 auto;
                padding: 24px;
                font-family: system-ui, sans-serif;
                color: #111;
              }
              .sf-invoice-print-sheet h1 { font-size: 1.25rem; margin: 0 0 8px; }
              .sf-invoice-print-meta { font-size: 0.875rem; margin-bottom: 16px; }
              .sf-invoice-print-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
              .sf-invoice-print-table th, .sf-invoice-print-table td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
              }
              .sf-invoice-print-totals { margin-top: 16px; text-align: right; font-size: 0.875rem; }
            `}</style>
            <div className="sf-invoice-print-actions" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                <button type="button" className="mgr-si-btn-new" onClick={handlePrint}>
                    Print / Save PDF
                </button>
                {onClose ? (
                    <button type="button" className="btn-portal-outline" onClick={onClose}>
                        Close
                    </button>
                ) : null}
            </div>
            <div className="sf-invoice-print-sheet">
                <h1>Storage facility invoice</h1>
                <div className="sf-invoice-print-meta">
                    <div>
                        <strong>Brand:</strong> {brandName || '—'}
                    </div>
                    <div>
                        <strong>Invoice #:</strong> {invoice.invoiceNo}
                    </div>
                    <div>
                        <strong>Type:</strong> {invoice.invoiceType}
                    </div>
                    <div>
                        <strong>Issue date:</strong> {invoice.issueDate}
                    </div>
                    {invoice.dueDate ? (
                        <div>
                            <strong>Due date:</strong> {invoice.dueDate}
                        </div>
                    ) : null}
                    <div>
                        <strong>Status:</strong> {invoice.status}
                    </div>
                    {invoice.description ? (
                        <div>
                            <strong>Description:</strong> {invoice.description}
                        </div>
                    ) : null}
                </div>
                {lines.length > 0 ? (
                    <table className="sf-invoice-print-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Qty</th>
                                <th>Unit price</th>
                                <th>Line total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((ln, i) => (
                                <tr key={ln.id ?? i}>
                                    <td>{ln.description || ln.productName || '—'}</td>
                                    <td>{ln.qty ?? ln.quantity}</td>
                                    <td>{Number(ln.unitPrice ?? 0).toFixed(2)}</td>
                                    <td>{Number(ln.lineTotal ?? ln.total ?? 0).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : null}
                <div className="sf-invoice-print-totals">
                    <div>Subtotal: SAR {Number(invoice.subtotal ?? 0).toFixed(2)}</div>
                    <div>VAT: SAR {Number(invoice.vatAmount ?? 0).toFixed(2)}</div>
                    <div>
                        <strong>Total: SAR {Number(invoice.grandTotal ?? 0).toFixed(2)}</strong>
                    </div>
                    <div>Balance due: SAR {Number(invoice.balance ?? 0).toFixed(2)}</div>
                </div>
            </div>
        </div>
    );
}
