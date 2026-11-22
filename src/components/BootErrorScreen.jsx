import React from 'react';
import { bootCopy, bootLocale } from '../utils/paintBootError';

export function BootErrorScreen({ error }) {
    const copy = bootCopy();
    const isRtl = bootLocale() === 'ar';
    return (
        <div
            data-boot-error="1"
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                background: '#f8fafc',
                fontFamily: 'system-ui, sans-serif',
                direction: isRtl ? 'rtl' : 'ltr',
            }}
        >
            <div
                style={{
                    maxWidth: 520,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 24,
                    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                }}
            >
                <h1 style={{ margin: '0 0 8px', fontSize: 20, color: '#0f172a' }}>{copy.title}</h1>
                <p style={{ margin: '0 0 16px', color: '#64748b', lineHeight: 1.5 }}>{copy.body}</p>
                <pre
                    style={{
                        margin: 0,
                        padding: 12,
                        background: '#fef2f2',
                        color: '#991b1b',
                        borderRadius: 8,
                        fontSize: 12,
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {String(error?.message || error || '')}
                </pre>
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => {
                            try { sessionStorage.removeItem('filter_chunk_reload'); } catch { /* ignore */ }
                            window.location.reload();
                        }}
                        style={{
                            padding: '10px 16px',
                            border: 'none',
                            borderRadius: 8,
                            background: '#FFD600',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        {copy.reload}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            try { sessionStorage.removeItem('filter_chunk_reload'); } catch { /* ignore */ }
                            window.location.assign('/');
                        }}
                        style={{
                            padding: '10px 16px',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            background: '#fff',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        {copy.home}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default class BootErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    render() {
        if (this.state.error) {
            return <BootErrorScreen error={this.state.error} />;
        }
        return this.props.children;
    }
}
