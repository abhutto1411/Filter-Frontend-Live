import React, { useCallback, useEffect, useState } from 'react';
import { Download, ImageIcon, Loader, Maximize2, X } from 'lucide-react';

const DEFAULT_LABELS = {
    title: 'Attached photo',
    open: 'View full size',
    download: 'Download',
    loading: 'Loading photo…',
    none: 'No photo attached.',
    error: 'Could not load the attached photo.',
    close: 'Close',
};

const MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const header = dataUrl.slice(5, comma);
    const mime = header.split(';')[0] || 'application/octet-stream';
    const payload = dataUrl.slice(comma + 1);
    if (!/;base64/i.test(header)) {
        return new Blob([decodeURIComponent(payload)], { type: mime });
    }
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

function extFromUrl(url) {
    const m = /\.(jpe?g|png|webp|gif)(?:[?#]|$)/i.exec(url);
    return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

/** Saves a data-URL or remote image under `${fileName}.<ext>`. Remote URLs that block CORS open in a new tab. */
async function downloadProofImage(url, fileName = 'approval-proof') {
    let blob = null;
    if (url.startsWith('data:')) {
        blob = dataUrlToBlob(url);
    } else {
        try {
            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) blob = await res.blob();
        } catch {
            blob = null;
        }
        if (!blob) {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
    }
    const ext = MIME_EXT[blob.type] || extFromUrl(url);
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${fileName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
}

const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#0f172a',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
};

/**
 * Approval detail block for a request's attached proof photo: inline preview,
 * full-size viewer and download. `url` may be a base64 data URL or an http(s) image URL.
 */
export default function ApprovalProofAttachment({
    url,
    loading = false,
    error = '',
    fileName = 'approval-proof',
    labels: labelsProp,
    showTitle = true,
}) {
    const labels = { ...DEFAULT_LABELS, ...(labelsProp || {}) };
    const [open, setOpen] = useState(false);
    const [broken, setBroken] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const src = typeof url === 'string' ? url.trim() : '';

    useEffect(() => {
        setBroken(false);
    }, [src]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const onDownload = useCallback(async () => {
        if (!src || downloading) return;
        setDownloading(true);
        try {
            await downloadProofImage(src, fileName);
        } finally {
            setDownloading(false);
        }
    }, [src, fileName, downloading]);

    let body;
    if (loading) {
        body = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: '0.875rem' }}>
                <Loader size={16} className="spin" /> {labels.loading}
            </div>
        );
    } else if (error || broken) {
        body = <p style={{ margin: 0, color: '#b45309', fontSize: '0.875rem' }}>{error || labels.error}</p>;
    } else if (!src) {
        body = <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>{labels.none}</p>;
    } else {
        body = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    title={labels.open}
                    style={{
                        padding: 4,
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        background: '#f8fafc',
                        cursor: 'zoom-in',
                        lineHeight: 0,
                        maxWidth: '100%',
                    }}
                >
                    <img
                        src={src}
                        alt={labels.title}
                        onError={() => setBroken(true)}
                        style={{
                            display: 'block',
                            maxWidth: '100%',
                            maxHeight: 320,
                            objectFit: 'contain',
                            borderRadius: 8,
                        }}
                    />
                </button>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" style={btnStyle} onClick={() => setOpen(true)}>
                        <Maximize2 size={14} /> {labels.open}
                    </button>
                    <button type="button" style={btnStyle} onClick={onDownload} disabled={downloading}>
                        {downloading ? <Loader size={14} className="spin" /> : <Download size={14} />} {labels.download}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="approval-proof-attachment">
            {showTitle ? (
                <p
                    style={{
                        margin: '0 0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                    }}
                >
                    <ImageIcon size={14} /> {labels.title}
                </p>
            ) : null}
            {body}
            {open && src ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={labels.title}
                    onClick={() => setOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10050,
                        background: 'rgba(15, 23, 42, 0.78)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#fff',
                            borderRadius: 12,
                            padding: 12,
                            maxWidth: 'min(1000px, 96vw)',
                            maxHeight: '94vh',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ImageIcon size={16} /> {labels.title}
                            </strong>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" style={btnStyle} onClick={onDownload} disabled={downloading}>
                                    {downloading ? <Loader size={14} className="spin" /> : <Download size={14} />} {labels.download}
                                </button>
                                <button type="button" style={btnStyle} onClick={() => setOpen(false)} aria-label={labels.close}>
                                    <X size={14} /> {labels.close}
                                </button>
                            </div>
                        </div>
                        <img
                            src={src}
                            alt={labels.title}
                            style={{
                                maxWidth: '100%',
                                maxHeight: 'calc(94vh - 80px)',
                                objectFit: 'contain',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                            }}
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
