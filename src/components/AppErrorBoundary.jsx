import React from 'react';
import { isChunkLoadError, reloadOnceForStaleChunk } from '../utils/lazyWithRetry';

export default class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[AppErrorBoundary]', error, info);
        // Stale lazy chunk after a deploy: reload once to pull the fresh files.
        // reloadOnceForStaleChunk is loop-safe (only one reload per session), so
        // a genuine (non-chunk) crash just falls through to the error UI below.
        if (isChunkLoadError(error)) {
            reloadOnceForStaleChunk();
        }
    }

    render() {
        if (this.state.error) {
            const staleChunk = isChunkLoadError(this.state.error);
            const isDev = import.meta.env.DEV;
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    background: '#f8fafc',
                    fontFamily: 'system-ui, sans-serif',
                }}
                >
                    <div style={{
                        maxWidth: 520,
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: 24,
                        boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                    }}
                    >
                        <h1 style={{ margin: '0 0 8px', fontSize: 20, color: '#0f172a' }}>
                            {staleChunk ? 'App update available' : 'Something went wrong'}
                        </h1>
                        <p style={{ margin: '0 0 16px', color: '#64748b', lineHeight: 1.5 }}>
                            {staleChunk
                                ? 'A new version was deployed while this tab was open. Reload to load the latest files.'
                                : isDev
                                    ? 'The page crashed while loading. Try a hard refresh (Ctrl+Shift+R). If it keeps happening, restart the frontend dev server.'
                                    : 'The page crashed while loading. Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R).'}
                        </p>
                        <pre style={{
                            margin: 0,
                            padding: 12,
                            background: '#fef2f2',
                            color: '#991b1b',
                            borderRadius: 8,
                            fontSize: 12,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                        }}
                        >
                            {String(this.state.error?.message || this.state.error)}
                        </pre>
                        <button
                            type="button"
                            onClick={() => {
                                sessionStorage.removeItem('filter_chunk_reload');
                                window.location.reload();
                            }}
                            style={{
                                marginTop: 16,
                                padding: '10px 16px',
                                border: 'none',
                                borderRadius: 8,
                                background: '#FFD600',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Reload page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
