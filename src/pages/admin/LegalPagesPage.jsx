import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, FileText, Loader2, Save, Shield, UserX } from 'lucide-react';
import { getLegalPage, updateLegalPage } from '../../services/superAdminApi';
import '../../styles/admin/LegalPagesPage.css';

const TABS = [
    {
        slug: 'privacy-policy',
        label: 'Privacy Policy',
        publicPath: '/privacy-policy',
        icon: Shield,
    },
    {
        slug: 'terms-and-conditions',
        label: 'Terms & Conditions',
        publicPath: '/terms-and-conditions',
        icon: FileText,
    },
    {
        slug: 'account-deletion',
        label: 'Account Deletion',
        publicPath: '/account-deletion',
        icon: UserX,
        static: true,
    },
];

const STATIC_PAGE_SUMMARY = {
    title: 'Fixed Play Store page',
    points: [
        'Content is built into the app and follows Google Play account deletion requirements.',
        'Always published — no draft or save needed.',
        'Covers in-app deletion steps, email requests, deleted vs retained data, and processing time.',
        'Available in English and Arabic on the public URL.',
    ],
};

const emptyForm = {
    titleEn: '',
    titleAr: '',
    bodyEn: '',
    bodyAr: '',
    isPublished: false,
};

export default function LegalPagesPage() {
    const [activeSlug, setActiveSlug] = useState(TABS[0].slug);
    const [form, setForm] = useState(emptyForm);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copied, setCopied] = useState(false);

    const activeTab = useMemo(
        () => TABS.find((t) => t.slug === activeSlug) ?? TABS[0],
        [activeSlug],
    );

    const publicUrl = useMemo(() => {
        if (typeof window === 'undefined') return activeTab.publicPath;
        return `${window.location.origin}${activeTab.publicPath}`;
    }, [activeTab.publicPath]);

    const isStaticTab = activeTab.static === true;

    useEffect(() => {
        if (isStaticTab) {
            setLoading(false);
            setError('');
            setSuccess('');
            setForm(emptyForm);
            setUpdatedAt(null);
            return undefined;
        }

        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError('');
            setSuccess('');
            try {
                const res = await getLegalPage(activeSlug);
                if (!mounted) return;
                const page = res?.page ?? {};
                setForm({
                    titleEn: page.titleEn ?? '',
                    titleAr: page.titleAr ?? '',
                    bodyEn: page.bodyEn ?? '',
                    bodyAr: page.bodyAr ?? '',
                    isPublished: page.isPublished === true,
                });
                setUpdatedAt(page.updatedAt ?? null);
            } catch (e) {
                if (!mounted) return;
                setError(e?.message || 'Failed to load legal page');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [activeSlug, isStaticTab]);

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setSuccess('');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await updateLegalPage(activeSlug, form);
            const page = res?.page ?? {};
            setForm({
                titleEn: page.titleEn ?? form.titleEn,
                titleAr: page.titleAr ?? form.titleAr,
                bodyEn: page.bodyEn ?? form.bodyEn,
                bodyAr: page.bodyAr ?? form.bodyAr,
                isPublished: page.isPublished === true,
            });
            setUpdatedAt(page.updatedAt ?? null);
            setSuccess('Saved successfully');
        } catch (err) {
            setError(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Could not copy link');
        }
    };

    return (
        <div className="legal-pages-page">
            <header className="legal-pages-header">
                <div>
                    <h1>Legal Pages</h1>
                    <p>
                        Manage public legal pages for Play Store and app store listings.
                        Privacy Policy and Terms are editable; Account Deletion is a fixed page.
                    </p>
                </div>
            </header>

            <div className="legal-pages-tabs">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.slug === activeSlug;
                    return (
                        <button
                            key={tab.slug}
                            type="button"
                            className={`legal-pages-tab${isActive ? ' is-active' : ''}`}
                            onClick={() => setActiveSlug(tab.slug)}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="legal-pages-card">
                <div className="legal-pages-public-row">
                    <div>
                        <div className="legal-pages-public-label">Public URL</div>
                        <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="legal-pages-public-url"
                        >
                            {publicUrl}
                            <ExternalLink size={14} />
                        </a>
                        {!isStaticTab && !form.isPublished && (
                            <div className="legal-pages-draft-note">
                                Draft — publish to make this URL visible publicly.
                            </div>
                        )}
                        {isStaticTab && (
                            <div className="legal-pages-static-badge">
                                Static · always live
                            </div>
                        )}
                    </div>
                    <button type="button" className="legal-pages-copy-btn" onClick={handleCopyLink}>
                        <Copy size={16} />
                        {copied ? 'Copied' : 'Copy link'}
                    </button>
                </div>

                {loading ? (
                    <div className="legal-pages-loading">
                        <Loader2 className="spin" size={28} />
                        <span>Loading…</span>
                    </div>
                ) : isStaticTab ? (
                    <div className="legal-pages-static-panel">
                        <h2>{STATIC_PAGE_SUMMARY.title}</h2>
                        <p className="legal-pages-static-lead">
                            This page cannot be edited here. Use the public link above for Play Store
                            and store listings.
                        </p>
                        <ul className="legal-pages-static-list">
                            {STATIC_PAGE_SUMMARY.points.map((point) => (
                                <li key={point}>{point}</li>
                            ))}
                        </ul>
                        <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="legal-pages-static-preview-btn"
                        >
                            <ExternalLink size={16} />
                            Preview {activeTab.label}
                        </a>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="legal-pages-form">
                        <label className="legal-pages-toggle">
                            <input
                                type="checkbox"
                                checked={form.isPublished}
                                onChange={(e) => handleChange('isPublished', e.target.checked)}
                            />
                            <span>Published (visible on public URL)</span>
                        </label>

                        <div className="legal-pages-grid">
                            <label className="legal-pages-field">
                                <span>Title (English)</span>
                                <input
                                    type="text"
                                    value={form.titleEn}
                                    onChange={(e) => handleChange('titleEn', e.target.value)}
                                    placeholder="Privacy Policy"
                                />
                            </label>
                            <label className="legal-pages-field">
                                <span>Title (Arabic)</span>
                                <input
                                    type="text"
                                    value={form.titleAr}
                                    onChange={(e) => handleChange('titleAr', e.target.value)}
                                    dir="rtl"
                                    placeholder="سياسة الخصوصية"
                                />
                            </label>
                        </div>

                        <label className="legal-pages-field">
                            <span>Content (English)</span>
                            <textarea
                                rows={14}
                                value={form.bodyEn}
                                onChange={(e) => handleChange('bodyEn', e.target.value)}
                                placeholder="Write your privacy policy or terms here. Basic HTML is supported (e.g. &lt;p&gt;, &lt;ul&gt;, &lt;strong&gt;)."
                            />
                        </label>

                        <label className="legal-pages-field">
                            <span>Content (Arabic)</span>
                            <textarea
                                rows={14}
                                value={form.bodyAr}
                                onChange={(e) => handleChange('bodyAr', e.target.value)}
                                dir="rtl"
                                placeholder="اكتب المحتوى بالعربية. يدعم HTML البسيط."
                            />
                        </label>

                        {updatedAt && (
                            <div className="legal-pages-updated">
                                Last updated: {new Date(updatedAt).toLocaleString()}
                            </div>
                        )}

                        {error && <div className="legal-pages-error">{error}</div>}
                        {success && (
                            <div className="legal-pages-success">
                                <CheckCircle2 size={16} />
                                {success}
                            </div>
                        )}

                        <div className="legal-pages-actions">
                            <button type="submit" className="legal-pages-save-btn" disabled={saving}>
                                {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                                Save {activeTab.label}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
