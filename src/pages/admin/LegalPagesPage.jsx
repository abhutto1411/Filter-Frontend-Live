import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, CheckCircle2, Copy, ExternalLink, AlertCircle, Loader2, Save } from 'lucide-react';
import { getLegalPage, updateLegalPage } from '../../services/superAdminApi';
import { lpT, LP_TAB_DEFS } from '../../utils/legalPagesI18n';
import '../../styles/ui.css';

const emptyForm = {
    titleEn: '',
    titleAr: '',
    bodyEn: '',
    bodyAr: '',
    isPublished: false,
};

/** One skeleton bar. */
function Sk({ shape = 'text', w, style }) {
    return <div className={`ui-sk ui-sk--${shape}${w ? ` ui-sk--w${w}` : ''}`} style={style} />;
}

export default function LegalPagesPage() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => lpT(locale, key, vars), [locale]);

    const tabs = useMemo(
        () => LP_TAB_DEFS.map((tab) => ({ ...tab, label: t(tab.labelKey) })),
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

    // p2 ("always published") and p4 ("available in EN and AR") are already said
    // by the Static pill and by the bilingual page itself.
    const staticPoints = useMemo(() => [t('static.p1'), t('static.p3')], [t]);

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
        <div className="ui-root ui-root--flush">
            <div className="ui-tabs" role="tablist">
                {tabs.map((tab) => (
                    <button
                        key={tab.slug}
                        type="button"
                        role="tab"
                        aria-selected={tab.slug === activeSlug}
                        className="ui-tab"
                        onClick={() => setActiveSlug(tab.slug)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="ui-band" style={{ marginTop: 16 }}>
                <section className="ui-panel">
                    {/* Where this page is served, and whether the public can see it. */}
                    <div className="ui-toolbar">
                        <div style={{ minWidth: 0 }}>
                            <span className="ui-fieldro-label">{t('public.label')}</span>
                            <a
                                href={publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ui-link ui-link--wrap"
                            >
                                {publicUrl} <ExternalLink size={12} />
                            </a>
                            {!isStaticTab && !loading && !form.isPublished ? (
                                <p className="ui-help" style={{ marginTop: 4 }}>{t('public.draft')}</p>
                            ) : null}
                        </div>
                        <div className="ui-toolbar-end" style={{ alignItems: 'center' }}>
                            {isStaticTab ? (
                                <span className="ui-pill ui-pill--info">{t('public.staticBadge')}</span>
                            ) : loading ? null : (
                                <span className={`ui-pill ui-pill--${form.isPublished ? 'ok' : 'warn'}`}>
                                    {form.isPublished ? t('status.published') : t('status.draft')}
                                </span>
                            )}
                            <button type="button" className="ui-btn ui-btn--default" onClick={handleCopyLink}>
                                {copied ? <Check size={15} /> : <Copy size={15} />}
                                {copied ? t('btn.copied') : t('btn.copy')}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="ui-panel-pad ui-sk-row">
                            <Sk shape="input" w={25} style={{ height: 20, marginBottom: 22 }} />
                            <div className="ui-form-grid">
                                <div className="ui-col-6">
                                    <Sk shape="label" w={40} style={{ marginBottom: 7 }} />
                                    <Sk shape="input" />
                                </div>
                                <div className="ui-col-6">
                                    <Sk shape="label" w={40} style={{ marginBottom: 7 }} />
                                    <Sk shape="input" />
                                </div>
                                <div className="ui-col-6">
                                    <Sk shape="label" w={40} style={{ marginBottom: 7 }} />
                                    <Sk shape="input" style={{ height: 300 }} />
                                </div>
                                <div className="ui-col-6">
                                    <Sk shape="label" w={40} style={{ marginBottom: 7 }} />
                                    <Sk shape="input" style={{ height: 300 }} />
                                </div>
                            </div>
                        </div>
                    ) : isStaticTab ? (
                        <div className="ui-panel-pad">
                            <section className="ui-subsection">
                                <div className="ui-subsection-head">
                                    <h4>{t('static.title')}</h4>
                                </div>
                                <p className="ui-lead">{t('static.lead')}</p>
                                <ul className="ui-bullets">
                                    {staticPoints.map((point) => <li key={point}>{point}</li>)}
                                </ul>
                                <a
                                    href={publicUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ui-btn ui-btn--default"
                                    style={{ marginTop: 18 }}
                                >
                                    <ExternalLink size={15} /> {t('btn.preview', { label: activeTab.label })}
                                </a>
                            </section>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="ui-panel-pad">
                            <label className="ui-switch" style={{ marginBottom: 20 }}>
                                <input
                                    type="checkbox"
                                    checked={form.isPublished}
                                    onChange={(e) => handleChange('isPublished', e.target.checked)}
                                />
                                <span className="ui-switch-track" />
                                {t('published')}
                            </label>

                            {/* English and Arabic side by side — legal copy is written
                                by comparison, not one language after the other. */}
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label htmlFor="lp-title-en">{t('label.titleEn')}</label>
                                    <input
                                        id="lp-title-en"
                                        type="text"
                                        className="ui-input"
                                        value={form.titleEn}
                                        onChange={(e) => handleChange('titleEn', e.target.value)}
                                        placeholder={t('ph.titleEn')}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label htmlFor="lp-title-ar">{t('label.titleAr')}</label>
                                    <input
                                        id="lp-title-ar"
                                        type="text"
                                        className="ui-input"
                                        dir="rtl"
                                        value={form.titleAr}
                                        onChange={(e) => handleChange('titleAr', e.target.value)}
                                        placeholder={t('ph.titleAr')}
                                    />
                                </div>

                                <div className="ui-field ui-col-6">
                                    <label htmlFor="lp-body-en">{t('label.bodyEn')}</label>
                                    <textarea
                                        id="lp-body-en"
                                        className="ui-textarea ui-textarea--tall"
                                        value={form.bodyEn}
                                        onChange={(e) => handleChange('bodyEn', e.target.value)}
                                        placeholder={t('ph.bodyEn')}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label htmlFor="lp-body-ar">{t('label.bodyAr')}</label>
                                    <textarea
                                        id="lp-body-ar"
                                        className="ui-textarea ui-textarea--tall"
                                        dir="rtl"
                                        value={form.bodyAr}
                                        onChange={(e) => handleChange('bodyAr', e.target.value)}
                                        placeholder={t('ph.bodyAr')}
                                    />
                                </div>
                            </div>

                            {error ? (
                                <div className="ui-banner ui-banner--dang" style={{ marginTop: 18 }}>
                                    <AlertCircle size={15} />
                                    <span>{error}</span>
                                </div>
                            ) : null}
                            {success ? (
                                <div className="ui-banner ui-banner--ok" style={{ marginTop: 18 }}>
                                    <CheckCircle2 size={15} />
                                    <span>{success}</span>
                                </div>
                            ) : null}

                            <div className="ui-form-foot ui-form-foot--split">
                                <span className="ui-help">
                                    {updatedAt
                                        ? t('updated', {
                                            date: new Date(updatedAt).toLocaleString(
                                                locale === 'ar' ? 'ar-SA' : undefined,
                                            ),
                                        })
                                        : ''}
                                </span>
                                <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
                                    {saving ? <Loader2 className="ui-spin" size={15} /> : <Save size={15} />}
                                    {t('btn.save', { label: activeTab.label })}
                                </button>
                            </div>
                        </form>
                    )}
                </section>
            </div>
        </div>
    );
}
