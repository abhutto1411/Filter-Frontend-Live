import React from 'react';
import { useLocation } from 'react-router-dom';
import {
    isChunkLoadError,
    isLazyPageLoadError,
    isMissingDefaultExportError,
    reloadOnceForStaleChunk,
} from '../utils/lazyPage';

const BOUNDARY_COPY = {
    en: {
        updatedTitle: 'Page updated — Reload',
        updatedBody: 'This page was updated while it was open. Reload to continue.',
        chunkTitle: 'App update available',
        chunkBody: 'A new version was deployed while this tab was open. Reload to load the latest files.',
        crashTitle: 'Something went wrong',
        crashBodyDev:
            'The page crashed while loading. Try a hard refresh (Ctrl+Shift+R). If it keeps happening, restart the frontend dev server.',
        crashBody:
            'The page crashed while loading. Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R).',
        reload: 'Reload',
        home: 'Go to home',
    },
    ar: {
        updatedTitle: 'تم تحديث الصفحة — أعد التحميل',
        updatedBody: 'حُدّثت هذه الصفحة أثناء فتحها. أعد التحميل للمتابعة.',
        chunkTitle: 'يتوفر تحديث للتطبيق',
        chunkBody: 'نُشر إصدار جديد أثناء فتح هذا التبويب. أعد التحميل لجلب الملفات الأحدث.',
        crashTitle: 'حدث خطأ ما',
        crashBodyDev:
            'انهارت الصفحة أثناء التحميل. جرّب تحديثاً قوياً (Ctrl+Shift+R). إذا تكرر الأمر، أعد تشغيل خادم التطوير.',
        crashBody: 'انهارت الصفحة أثناء التحميل. جرّب تحديثاً قوياً (Ctrl+Shift+R أو Cmd+Shift+R).',
        reload: 'إعادة التحميل',
        home: 'الذهاب إلى الرئيسية',
    },
};

function boundaryLocale() {
    try {
        const loc =
            typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : 'en';
        return String(loc || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
    } catch {
        return 'en';
    }
}

/** Clears a caught page crash when the user navigates to another route. */
export function AppErrorBoundaryWithRouter({ children }) {
    const location = useLocation();
    return (
        <AppErrorBoundary resetKey={location.pathname + location.search}>
            {children}
        </AppErrorBoundary>
    );
}

/** Keeps portal chrome (sidebar/tabs) when a single page or tab throws. */
export function SectionErrorBoundary({ children, resetKey }) {
    return (
        <AppErrorBoundary resetKey={resetKey} variant="section">
            {children}
        </AppErrorBoundary>
    );
}

export default class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, componentStack: '' };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidUpdate(prevProps) {
        if (this.state.error && this.props.resetKey !== prevProps.resetKey) {
            this.setState({ error: null, componentStack: '' });
        }
    }

    componentDidCatch(error, info) {
        this.setState({ componentStack: info?.componentStack || '' });
        console.error('[AppErrorBoundary]', error, info);
        // Stale lazy chunk after a deploy: reload once to pull the fresh files.
        // reloadOnceForStaleChunk is loop-safe (only one reload per session), so
        // a genuine (non-chunk) crash just falls through to the error UI below.
        if (isChunkLoadError(error) && !isMissingDefaultExportError(error)) {
            reloadOnceForStaleChunk();
        }
    }

    render() {
        if (this.state.error) {
            const staleChunk = isChunkLoadError(this.state.error);
            const hmrExport = isMissingDefaultExportError(this.state.error);
            const lazyLoad = isLazyPageLoadError(this.state.error);
            const isDev = import.meta.env.DEV;
            const section = this.props.variant === 'section';
            const copy = BOUNDARY_COPY[boundaryLocale()];
            const title = hmrExport || staleChunk || lazyLoad
                ? copy.updatedTitle
                : copy.crashTitle;
            const body = hmrExport || staleChunk || lazyLoad
                ? copy.updatedBody
                : isDev
                    ? copy.crashBodyDev
                    : copy.crashBody;
            const isRtl = boundaryLocale() === 'ar';
            return (
                <div style={{
                    minHeight: section ? 240 : '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    background: '#f8fafc',
                    fontFamily: 'system-ui, sans-serif',
                    direction: isRtl ? 'rtl' : 'ltr',
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
                            {title}
                        </h1>
                        <p style={{ margin: '0 0 16px', color: '#64748b', lineHeight: 1.5 }}>
                            {body}
                        </p>
                        {isDev ? (
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
                            {this.state.componentStack
                                ? `\n${this.state.componentStack}`
                                : ''}
                        </pre>
                        ) : null}
                        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => {
                                sessionStorage.removeItem('filter_chunk_reload');
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
                                sessionStorage.removeItem('filter_chunk_reload');
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

        return this.props.children;
    }
}
