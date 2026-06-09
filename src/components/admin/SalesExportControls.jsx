import { useState } from 'react';
import { FileText, FileSpreadsheet, Loader2, X } from 'lucide-react';

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

export function ExportMenu({ onPdf, onExcel, busy = false, disabled = false }) {
    // Track which button was pressed so only THAT one shows the spinner while
    // the (shared) `busy` flag is set — clicking PDF must not spin Excel. A
    // stale value once `busy` clears is harmless (spinner needs `busy` too).
    const [clicked, setClicked] = useState(null); // 'pdf' | 'excel' | null

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
            <button type="button" onClick={() => fire('pdf', onPdf)} disabled={dis} style={style} title="Open print dialog → Save as PDF">
                {busy && clicked === 'pdf' ? <Loader2 size={14} className="spin" /> : <FileText size={14} />} PDF
            </button>
            <button type="button" onClick={() => fire('excel', onExcel)} disabled={dis} style={style} title="Download Excel of the current view">
                {busy && clicked === 'excel' ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />} Excel
            </button>
        </div>
    );
}

export function DateTimeRange({ from, to, onFrom, onTo, onClear, label = 'Date & time range' }) {
    const labelStyle = { fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 };
    const inputStyle = { padding: '9px 10px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.8125rem', background: '#fff' };
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>{label}</label>
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <input
                    type="datetime-local"
                    value={from || ''}
                    onChange={(e) => onFrom(e.target.value)}
                    style={inputStyle}
                    aria-label="From date and time"
                />
                <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>→</span>
                <input
                    type="datetime-local"
                    value={to || ''}
                    onChange={(e) => onTo(e.target.value)}
                    style={inputStyle}
                    aria-label="To date and time"
                />
                {(from || to) ? (
                    <button
                        type="button"
                        onClick={onClear}
                        title="Clear date range"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1',
                            background: '#f8fafc', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#475569',
                        }}
                    >
                        <X size={13} /> Clear
                    </button>
                ) : null}
            </div>
        </div>
    );
}
