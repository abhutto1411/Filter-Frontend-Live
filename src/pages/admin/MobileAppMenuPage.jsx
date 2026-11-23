import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    Plus,
    Save,
    Smartphone,
    X,
} from 'lucide-react';
import {
    createMobileAppMenuPortal,
    getMobileAppMenu,
    updateMobileAppMenu,
} from '../../services/superAdminApi';
import { mamT } from '../../utils/mobileAppMenuI18n';
import '../../styles/ui.css';

const EMPTY_CREATE_FORM = {
    key: '',
    titleEn: '',
    titleAr: '',
    enabled: true,
};

/** Visible/hidden switch. The word sits before the track so a column lines up. */
function PortalSwitch({ checked, onChange, label, visibleLabel, hiddenLabel }) {
    return (
        <label className="ui-switch ui-switch--end">
            <span className="ui-switch-text">{checked ? visibleLabel : hiddenLabel}</span>
            <input
                type="checkbox"
                checked={checked}
                aria-label={label}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="ui-switch-track" />
        </label>
    );
}

/** One skeleton bar. */
function Sk({ shape = 'text', w, style }) {
    return <div className={`ui-sk ui-sk--${shape}${w ? ` ui-sk--w${w}` : ''}`} style={style} />;
}

function MenuSkeleton({ loadingLabel }) {
    return (
        <section
            className="ui-panel ui-sk-row"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={loadingLabel}
        >
            <div className="ui-toolbar">
                <Sk shape="text" w={25} />
            </div>
            <ul className="ui-list">
                {Array.from({ length: 6 }).map((_, index) => (
                    <li key={index} className="ui-list-row">
                        <div className="ui-list-main">
                            <Sk shape="strong" w={40} />
                            <Sk shape="text" w={25} style={{ marginTop: 7 }} />
                        </div>
                        <div className="ui-list-end">
                            <Sk shape="pill" w={70} />
                        </div>
                    </li>
                ))}
            </ul>
            <div className="ui-panel-foot">
                <div className="ui-panel-end">
                    <Sk shape="btn" />
                </div>
            </div>
        </section>
    );
}

export default function MobileAppMenuPage() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => mamT(locale, key, vars), [locale]);

    const [portals, setPortals] = useState([]);
    // What the server currently holds, keyed by portal — the toggles only take
    // effect on Save, so the page needs a baseline to know it is dirty.
    const [saved, setSaved] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
    const [error, setError] = useState('');
    const [createError, setCreateError] = useState('');
    const [success, setSuccess] = useState('');

    const applyPortals = useCallback((list) => {
        const rows = list ?? [];
        setPortals(rows);
        setSaved(Object.fromEntries(rows.map((p) => [p.key, p.enabled === true])));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getMobileAppMenu();
            applyPortals(res?.portals);
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [applyPortals, t]);

    useEffect(() => {
        load();
    }, [load]);

    const togglePortal = (key, enabled) => {
        setPortals((prev) => prev.map((p) => (p.key === key ? { ...p, enabled } : p)));
        setSuccess('');
    };

    const enabledCount = portals.filter((p) => p.enabled).length;
    const dirty = useMemo(
        () => portals.some((p) => (p.enabled === true) !== (saved[p.key] === true)),
        [portals, saved],
    );

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await updateMobileAppMenu({
                portals: portals.map((p) => ({ key: p.key, enabled: p.enabled })),
            });
            applyPortals(res?.portals ?? portals);
            setSuccess(t('ok.saved'));
        } catch (err) {
            setError(err?.message || t('err.save'));
        } finally {
            setSaving(false);
        }
    };

    const openCreate = () => {
        setCreateForm(EMPTY_CREATE_FORM);
        setCreateError('');
        setSuccess('');
        setShowCreate(true);
    };

    const closeCreate = () => {
        if (creating) return;
        setShowCreate(false);
        setCreateForm(EMPTY_CREATE_FORM);
        setCreateError('');
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        setCreateError('');
        setSuccess('');
        try {
            const res = await createMobileAppMenuPortal({
                key: createForm.key.trim(),
                titleEn: createForm.titleEn.trim(),
                titleAr: createForm.titleAr.trim() || undefined,
                enabled: createForm.enabled,
            });
            applyPortals(res?.portals ?? portals);
            setShowCreate(false);
            setCreateForm(EMPTY_CREATE_FORM);
            setSuccess(t('ok.created'));
        } catch (err) {
            setCreateError(err?.message || t('err.create'));
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="ui-root ui-root--flush">
                <MenuSkeleton loadingLabel={t('loading.aria')} />
            </div>
        );
    }

    return (
        <div className="ui-root ui-root--flush">
            {showCreate ? (
                <div className="ui-band">
                    <form onSubmit={handleCreate} className="ui-panel">
                        <div className="ui-toolbar">
                            <span className="ui-card-title">{t('modal.title')}</span>
                            <div className="ui-toolbar-end">
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--icon ui-btn--subtle"
                                    onClick={closeCreate}
                                    disabled={creating}
                                    aria-label={t('modal.close')}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="ui-panel-pad">
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="mam-key">{t('label.key')}</label>
                                    <input
                                        id="mam-key"
                                        type="text"
                                        className="ui-input"
                                        value={createForm.key}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                key: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                                            }))
                                        }
                                        placeholder={t('ph.key')}
                                        required
                                        pattern="[a-z][a-z0-9_]*"
                                        title={t('key.patternTitle')}
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="mam-title-en">{t('label.titleEn')}</label>
                                    <input
                                        id="mam-title-en"
                                        type="text"
                                        className="ui-input"
                                        value={createForm.titleEn}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({ ...f, titleEn: e.target.value }))
                                        }
                                        placeholder={t('ph.titleEn')}
                                        required
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="mam-title-ar">{t('label.titleAr')}</label>
                                    <input
                                        id="mam-title-ar"
                                        type="text"
                                        className="ui-input"
                                        dir="rtl"
                                        value={createForm.titleAr}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({ ...f, titleAr: e.target.value }))
                                        }
                                        placeholder={t('ph.titleAr')}
                                    />
                                </div>
                            </div>

                            <label className="ui-switch" style={{ marginTop: 16 }}>
                                <input
                                    type="checkbox"
                                    checked={createForm.enabled}
                                    onChange={(e) =>
                                        setCreateForm((f) => ({ ...f, enabled: e.target.checked }))
                                    }
                                />
                                <span className="ui-switch-track" />
                                {t('label.showInApp')}
                            </label>

                            {createError ? (
                                <div className="ui-banner ui-banner--dang" style={{ marginTop: 16 }}>
                                    <AlertCircle size={15} />
                                    <span>{createError}</span>
                                </div>
                            ) : null}
                        </div>

                        <div className="ui-panel-foot">
                            <div className="ui-panel-end">
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--default"
                                    onClick={closeCreate}
                                    disabled={creating}
                                >
                                    {t('btn.cancel')}
                                </button>
                                <button type="submit" className="ui-btn ui-btn--primary" disabled={creating}>
                                    {creating ? <Loader2 className="ui-spin" size={15} /> : <Plus size={15} />}
                                    {t('btn.createSubmit')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : null}

            <div className="ui-band">
                <form onSubmit={handleSave} className="ui-panel">
                    {/* How much of the app home screen this list is currently showing. */}
                    <div className="ui-toolbar">
                        <Smartphone size={16} />
                        <span>
                            {t('summary.visible', {
                                enabled: enabledCount,
                                total: portals.length,
                            })}
                        </span>
                        <div className="ui-toolbar-end" style={{ alignItems: 'center' }}>
                            {dirty ? (
                                <span className="ui-pill ui-pill--warn">{t('status.unsaved')}</span>
                            ) : null}
                            {!showCreate ? (
                                <button type="button" className="ui-btn ui-btn--default" onClick={openCreate}>
                                    <Plus size={15} />
                                    {t('btn.create')}
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {portals.length === 0 ? (
                        <div className="ui-empty">
                            <div className="ui-empty-icon">
                                <Smartphone size={18} />
                            </div>
                            <div className="ui-empty-title">{t('empty.title')}</div>
                        </div>
                    ) : (
                        <ul className="ui-list">
                            {portals.map((portal) => (
                                <li key={portal.key} className="ui-list-row">
                                    <div className="ui-list-main">
                                        <span className="ui-list-title">
                                            {portal.titleEn}
                                            {portal.isBuiltIn ? (
                                                <span
                                                    className="ui-pill ui-pill--neutral"
                                                    style={{ marginInlineStart: 8 }}
                                                >
                                                    {t('badge.builtIn')}
                                                </span>
                                            ) : null}
                                        </span>
                                        <div className="ui-meta">
                                            <code className="ui-code">{portal.key}</code>
                                            {portal.titleAr ? <span dir="rtl">{portal.titleAr}</span> : null}
                                        </div>
                                    </div>
                                    <div className="ui-list-end">
                                        <PortalSwitch
                                            checked={portal.enabled === true}
                                            onChange={(enabled) => togglePortal(portal.key, enabled)}
                                            label={t('toggle.aria', { title: portal.titleEn })}
                                            visibleLabel={t('toggle.visible')}
                                            hiddenLabel={t('toggle.hidden')}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* The server rejects an all-hidden menu, so say so here rather
                        than leaving Save disabled without a reason. */}
                    {portals.length > 0 && enabledCount === 0 ? (
                        <div className="ui-panel-pad">
                            <div className="ui-banner ui-banner--warn">
                                <AlertCircle size={15} />
                                <span>{t('warn.minOne')}</span>
                            </div>
                        </div>
                    ) : null}
                    {error ? (
                        <div className="ui-panel-pad">
                            <div className="ui-banner ui-banner--dang">
                                <AlertCircle size={15} />
                                <span>{error}</span>
                            </div>
                        </div>
                    ) : null}
                    {success ? (
                        <div className="ui-panel-pad">
                            <div className="ui-banner ui-banner--ok">
                                <CheckCircle2 size={15} />
                                <span>{success}</span>
                            </div>
                        </div>
                    ) : null}

                    <div className="ui-panel-foot">
                        <div className="ui-panel-end">
                            <button
                                type="submit"
                                className="ui-btn ui-btn--primary"
                                disabled={saving || !dirty || enabledCount === 0}
                            >
                                {saving ? <Loader2 className="ui-spin" size={15} /> : <Save size={15} />}
                                {t('btn.save')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
