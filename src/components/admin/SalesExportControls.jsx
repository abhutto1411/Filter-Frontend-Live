import { useState } from 'react';
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { salesT } from '../../utils/salesI18n';
// For `.ui-spin` on the busy icon. Carried here rather than left to the host
// page: this component sits on both migrated and not-yet-migrated screens, and
// a spinner that does not turn is the one thing a busy state must not do.
import '../../styles/ui.css';

/**
 * Shared controls for the Super-Admin Sales tabs:
 *  - <ExportMenu>      → PDF / Excel download buttons (export the current view).
 *
 * Kept presentational + inline-styled to match the existing Sales tab toolbars.
 */

const btnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#0f172a',
};

function resolveSalesT(locale, t) {
    if (typeof t === 'function') return t;
    const loc =
        locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    return (key, vars) => salesT(loc, key, vars);
}

export function ExportMenu({ onPdf, onExcel, busy = false, disabled = false, locale, t }) {
    // Track which button was pressed so only THAT one shows the spinner while
    // the (shared) `busy` flag is set — clicking PDF must not spin Excel. A
    // stale value once `busy` clears is harmless (spinner needs `busy` too).
    const [clicked, setClicked] = useState(null); // 'pdf' | 'excel' | null
    const tr = resolveSalesT(locale, t);

    const dis = disabled || busy;
    const style = {
        ...btnBase,
        cursor: dis ? 'not-allowed' : 'pointer',
        opacity: dis ? 0.6 : 1,
    };
    const fire = (kind, fn) => {
        setClicked(kind);
        fn?.();
    };
    return (
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={() => fire('pdf', onPdf)} disabled={dis} style={style} title={tr('export.pdfTitle')}>
                {busy && clicked === 'pdf' ? <Loader2 size={14} className="spin ui-spin" /> : <FileText size={14} />} {tr('export.pdf')}
            </button>
            <button type="button" onClick={() => fire('excel', onExcel)} disabled={dis} style={style} title={tr('export.excelTitle')}>
                {busy && clicked === 'excel' ? <Loader2 size={14} className="spin ui-spin" /> : <FileSpreadsheet size={14} />} {tr('export.excel')}
            </button>
        </div>
    );
}

