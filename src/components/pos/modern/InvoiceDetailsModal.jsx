import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import CashierTaxInvoiceView from './CashierTaxInvoiceView';
import './CashierTaxInvoiceView.css';

/**
 * Modal wrapper for the bilingual simplified tax invoice (Flutter CashierInvoicePreview).
 * @param {'pos'|'corporate'} footerVariant — corporate shows Print + Cancel only.
 *
 * Portals to document.body so the `@media print` rules that hide every other
 * element work even when this modal is opened from inside another modal —
 * otherwise the parent modal's stacking/overflow swallows the print canvas.
 */
export default function InvoiceDetailsModal({
  invoice,
  isOpen,
  onClose,
  onPrint,
  footerVariant = 'pos',
}) {
  const scrollRef = useRef(null);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    if (onPrint) {
      onPrint(invoice);
      return;
    }
    window.print();
  };

  const isCorporate = footerVariant === 'corporate';

  const modal = (
    <div className="modal-overlay-modern invoice-modal-root">
      <div
        className="invoice-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Simplified Tax Invoice"
      >
        <button type="button" className="invoice-modal-close-fab" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="invoice-scroll" ref={scrollRef}>
          <CashierTaxInvoiceView invoice={invoice} />
        </div>

        <div className="invoice-actions">
          <button type="button" className="invoice-btn invoice-btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print
          </button>
          {isCorporate ? (
            <button type="button" className="invoice-btn invoice-btn-primary" onClick={onClose}>
              Cancel
            </button>
          ) : (
            <button type="button" className="invoice-btn invoice-btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>

      <style>{`
        .invoice-modal-root {
          padding: 16px;
          align-items: flex-start;
        }
        .invoice-modal-card {
          position: relative;
          width: 100%;
          max-width: 940px;
          max-height: calc(100vh - 32px);
          background: #ffffff;
          border: 1px solid #23262d;
          border-radius: 14px;
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.18);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin: auto;
        }
        .invoice-modal-close-fab {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 5;
          background: rgba(35, 38, 45, 0.85);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 6px;
          cursor: pointer;
        }
        .invoice-modal-close-fab:hover {
          background: #23262d;
        }
        .invoice-scroll {
          overflow-y: auto;
          padding: 14px 14px 8px;
        }
        .invoice-actions {
          display: flex;
          gap: 10px;
          padding: 12px 14px 14px;
          border-top: 1px solid #e5e7eb;
          background: #fff;
        }
        .invoice-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border: none;
          border-radius: 10px;
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
        }
        .invoice-btn-secondary {
          background: #2e3237;
          color: #fff;
        }
        .invoice-btn-primary {
          background: #fcc247;
          color: #23262d;
        }
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          /* Force backgrounds, badges and yellow column header to print —
             browsers strip background colors by default in print mode. */
          .invoice-modal-root,
          .invoice-modal-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Hide every direct body child EXCEPT this portaled invoice modal.
             Using display:none (not visibility) removes them from the layout
             so the invoice starts at the top of page 1 — no leading blank
             page from empty space the rest of the app would have occupied. */
          body > *:not(.invoice-modal-root) {
            display: none !important;
          }
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* ModernPOS.css globally hides .modal-overlay-modern in print — undo it here. */
          .invoice-modal-root,
          .modal-overlay-modern.invoice-modal-root {
            display: block !important;
            position: static !important;
            inset: auto !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
            width: auto !important;
            height: auto !important;
          }
          .invoice-modal-card {
            position: static !important;
            max-width: none !important;
            max-height: none !important;
            width: 100% !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            display: block !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
          }
          .invoice-modal-close-fab,
          .invoice-actions {
            display: none !important;
          }
          .invoice-scroll {
            overflow: visible !important;
            max-height: none !important;
            padding: 0 !important;
          }
          /* Keep goods table within page width so the right border of the
             last column ("Total With VAT") isn't clipped. */
          .cti-goods-table {
            min-width: 0 !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          .cti-goods-wrap {
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );

  return typeof document !== 'undefined' && document.body
    ? createPortal(modal, document.body)
    : modal;
}
