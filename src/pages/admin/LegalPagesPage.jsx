import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CheckCircle2, Copy, ExternalLink, FileText, Loader2, Save, Shield, UserX } from 'lucide-react';
import { getLegalPage, updateLegalPage } from '../../services/superAdminApi';
import { lpT, LP_TAB_DEFS } from '../../utils/legalPagesI18n';
import '../../styles/admin/LegalPagesPage.css';

const TAB_ICONS = {
    'privacy-policy': Shield,
    'terms-and-conditions': FileText,
    'account-deletion': UserX,
};

const emptyForm = {
    titleEn: '',
    titleAr: '',
    bodyEn: '',
    bodyAr: '',
    isPublished: false,
};

export default function LegalPagesPage() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => lpT(locale, key, vars), [locale]);

    const tabs = useMemo(
        () =>
            LP_TAB_DEFS.map((tab) => ({
                ...tab,
                label: t(tab.labelKey),
                icon: TAB_ICONS[tab.slug],
            })),
        [t],
    );

    const [activeSlug, setActiveSlug] = useState(LP_TAB_DEFS[0].slug);
    const [form, setForm] = useState(emptyForm);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copied, setCopied] = useState(false);

    const activeTab = useMemo(
        () => tabs.find((tab) => tab.slug === activeSlug) ?? tabs[0],
        [tabs, activeSlug],
    );

    const publicUrl = useMemo(() => {
        if (typeof window === 'undefined') return activeTab.publicPath;
        return `${window.location.origin}${activeTab.publicPath}`;
    }, [activeTab.publicPath]);

    const isStaticTab = activeTab.static === true;

    const staticPoints = useMemo(
        () => [t('static.p1'), t('static.p2'), t('static.p3'), t('static.p4')],
        [t],
    );

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
                setError(e?.message || t('err.load'));
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [activeSlug, isStaticTab, t]);

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
            setSuccess(t('ok.saved'));
        } catch (err) {
            setError(err?.message || t('err.save'));
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
            setError(t('err.copy'));
        }
    };

    return (
        <div className="legal-pages-page">
            <header className="legal-pages-header">
                <div>
                    <h1>{t('page.title')}</h1>
                    <p>{t('page.subtitle')}</p>
                </div>
            </header>

            <div className="legal-pages-tabs">
                {tabs.map((tab) => {
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
                        <div className="legal-pages-public-label">{t('public.label')}</div>
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
                            <div className="legal-pages-draft-note">{t('public.draft')}</div>
                        )}
                        {isStaticTab && (
                            <div className="legal-pages-static-badge">{t('public.staticBadge')}</div>
                        )}
                    </div>
                    <button type="button" className="legal-pages-copy-btn" onClick={handleCopyLink}>
                        <Copy size={16} />
                        {copied ? t('btn.copied') : t('btn.copy')}
                    </button>
                </div>

                {loading ? (
                    <div className="legal-pages-loading">
                        <Loader2 className="spin" size={28} />
                        <span>{t('loading')}</span>
                    </div>
                ) : isStaticTab ? (
                    <div className="legal-pages-static-panel">
                        <h2>{t('static.title')}</h2>
                        <p className="legal-pages-static-lead">{t('static.lead')}</p>
                        <ul className="legal-pages-static-list">
                            {staticPoints.map((point) => (
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
                            {t('btn.preview', { label: activeTab.label })}
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
                            <span>{t('published')}</span>
                        </label>

                        <div className="legal-pages-grid">
                            <label className="legal-pages-field">
                                <span>{t('label.titleEn')}</span>
                                <input
                                    type="text"
                                    value={form.titleEn}
                                    onChange={(e) => handleChange('titleEn', e.target.value)}
                                    placeholder={t('ph.titleEn')}
                                />
                            </label>
                            <label className="legal-pages-field">
                                <span>{t('label.titleAr')}</span>
                                <input
                                    type="text"
                                    value={form.titleAr}
                                    onChange={(e) => handleChange('titleAr', e.target.value)}
                                    dir="rtl"
                                    placeholder={t('ph.titleAr')}
                                />
                            </label>
                        </div>

                        <label className="legal-pages-field">
                            <span>{t('label.bodyEn')}</span>
                            <textarea
                                rows={14}
                                value={form.bodyEn}
                                onChange={(e) => handleChange('bodyEn', e.target.value)}
                                placeholder={t('ph.bodyEn')}
                            />
                        </label>

                        <label className="legal-pages-field">
                            <span>{t('label.bodyAr')}</span>
                            <textarea
                                rows={14}
                                value={form.bodyAr}
                                onChange={(e) => handleChange('bodyAr', e.target.value)}
                                dir="rtl"
                                placeholder={t('ph.bodyAr')}
                            />
                        </label>

                        {updatedAt && (
                            <div className="legal-pages-updated">
                                {t('updated', { date: new Date(updatedAt).toLocaleString(locale === 'ar' ? 'ar-SA' : undefined) })}
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
                                {t('btn.save', { label: activeTab.label })}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
