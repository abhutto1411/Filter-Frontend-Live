import { useState } from 'react';
import { FileText, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { salesT } from '../../utils/salesI18n';

/**
 * Shared controls for the Super-Admin Sales tabs:
 *  - <ExportMenu>      → PDF / Excel download buttons (export the current view).
 *  - <DateTimeRange>   → From/To datetime-local filter pair with a clear button.
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
                {busy && clicked === 'pdf' ? <Loader2 size={14} className="spin" /> : <FileText size={14} />} {tr('export.pdf')}
            </button>
            <button type="button" onClick={() => fire('excel', onExcel)} disabled={dis} style={style} title={tr('export.excelTitle')}>
                {busy && clicked === 'excel' ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />} {tr('export.excel')}
            </button>
        </div>
    );
}

export function DateTimeRange({ from, to, onFrom, onTo, onClear, label, locale, t }) {
    const tr = resolveSalesT(locale, t);
    const rangeLabel = label ?? tr('date.range');
    const labelStyle = { fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 };
    const inputStyle = { padding: '9px 10px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.8125rem', background: '#fff' };
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>{rangeLabel}</label>
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <input
                    type="datetime-local"
                    value={from || ''}
                    onChange={(e) => onFrom(e.target.value)}
                    style={inputStyle}
                    aria-label={tr('date.from')}
                />
                <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>→</span>
                <input
                    type="datetime-local"
                    value={to || ''}
                    onChange={(e) => onTo(e.target.value)}
                    style={inputStyle}
                    aria-label={tr('date.to')}
                />
                {(from || to) ? (
                    <button
                        type="button"
                        onClick={onClear}
                        title={tr('date.clearTitle')}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1',
                            background: '#f8fafc', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#475569',
                        }}
                    >
                        <X size={13} /> {tr('date.clear')}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
