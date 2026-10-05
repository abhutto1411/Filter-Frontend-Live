import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { getPublicLegalPage } from '../services/publicLegalApi';
import PublicLegalLayout from './PublicLegalLayout';
import './PublicLegalPage.css';

function pickLocalized(page, locale) {
    const isAr = locale === 'ar';
    return {
        title: (isAr && page.titleAr?.trim()) ? page.titleAr : (page.titleEn || 'Legal'),
        body: (isAr && page.bodyAr?.trim()) ? page.bodyAr : (page.bodyEn || ''),
    };
}

function bodyLooksLikeHtml(value) {
    return /<[a-z][\s\S]*>/i.test(String(value || '').trim());
}

function LegalBody({ body }) {
    const trimmed = String(body || '').trim();
    if (!trimmed) return null;

    if (bodyLooksLikeHtml(trimmed)) {
        return (
            <div
                className="public-legal-body"
                dangerouslySetInnerHTML={{ __html: trimmed }}
            />
        );
    }

    return <div className="public-legal-body public-legal-body--plain">{trimmed}</div>;
}

export default function PublicLegalPage({ slug, defaultLocale = 'en' }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(null);
    const [locale, setLocale] = useState(defaultLocale);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await getPublicLegalPage(slug);
                if (!mounted) return;
                if (!res?.page) {
                    setError('Legal page not found');
                    setPage(null);
                    return;
                }
                setPage(res.page);
            } catch (e) {
                if (!mounted) return;
                setError(e?.message || 'This page is not available yet.');
                setPage(null);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [slug]);

    const content = useMemo(() => {
        if (!page) return { title: '', body: '' };
        return pickLocalized(page, locale);
    }, [page, locale]);

    return (
        <PublicLegalLayout locale={locale} setLocale={setLocale}>
            {loading ? (
                <div className="public-legal-state">
                    <Loader2 className="spin" size={28} />
                    <span>Loading…</span>
                </div>
            ) : error ? (
                <div className="public-legal-state public-legal-error">
                    <AlertTriangle size={28} />
                    <h1>Page unavailable</h1>
                    <p>{error}</p>
                    <p className="public-legal-error-hint">
                        If you just published this page, wait a moment and refresh. Make sure
                        &quot;Published&quot; is checked in Super Admin → Legal Pages.
                    </p>
                    <Link to="/" className="public-legal-home-link">Back to home</Link>
                </div>
            ) : (
                <article className="public-legal-article">
                    <h1>{content.title}</h1>
                    {content.body?.trim() ? (
                        <LegalBody body={content.body} />
                    ) : (
                        <p className="public-legal-empty">Content will be published soon.</p>
                    )}
                </article>
            )}
        </PublicLegalLayout>
    );
}
