import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    CheckCircle2,
    Loader2,
    Plus,
    Save,
    Smartphone,
} from 'lucide-react';
import {
    createMobileAppMenuPortal,
    getMobileAppMenu,
    updateMobileAppMenu,
} from '../../services/superAdminApi';
import { mamT } from '../../utils/mobileAppMenuI18n';
import AdminScreenShell from '../../components/admin/AdminScreenShell';
import '../../styles/admin/MobileAppMenuPage.css';

const EMPTY_CREATE_FORM = {
    key: '',
    titleEn: '',
    titleAr: '',
    enabled: true,
};

function ToggleSwitch({ checked, onChange, label, visibleLabel, hiddenLabel }) {
    return (
        <label className="mobile-app-menu-switch-wrap">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                className={`mobile-app-menu-switch${checked ? ' is-on' : ''}`}
                onClick={() => onChange(!checked)}
            >
                <span className="mobile-app-menu-switch-thumb" />
            </button>
            <span className="mobile-app-menu-switch-label">
                {checked ? visibleLabel : hiddenLabel}
            </span>
        </label>
    );
}

function MobileAppMenuShimmer({ loadingLabel }) {
    return (
        <div
            className="mobile-app-menu-shimmer"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={loadingLabel}
        >
            <div className="mobile-app-menu-shimmer-summary" />
            <ul className="mobile-app-menu-shimmer-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                    <li key={index} className="mobile-app-menu-shimmer-tile">
                        <div className="mobile-app-menu-shimmer-tile-body">
                            <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--title" />
                            <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--subtitle" />
                            <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--code" />
                            <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--badge" />
                        </div>
                        <div className="mobile-app-menu-shimmer-toggle">
                            <span className="mobile-app-menu-shimmer-switch" />
                            <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--toggle-label" />
                        </div>
                    </li>
                ))}
            </ul>
            <div className="mobile-app-menu-shimmer-actions">
                <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--button" />
            </div>
        </div>
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getMobileAppMenu();
            setPortals(res?.portals ?? []);
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const togglePortal = (key) => {
        setPortals((prev) =>
            prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p)),
        );
        setSuccess('');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await updateMobileAppMenu({
                portals: portals.map((p) => ({ key: p.key, enabled: p.enabled })),
            });
            setPortals(res?.portals ?? portals);
            setSuccess(t('ok.saved'));
        } catch (err) {
            setError(err?.message || t('err.save'));
        } finally {
            setSaving(false);
        }
    };

    const openCreateModal = () => {
        setCreateForm(EMPTY_CREATE_FORM);
        setShowCreateModal(true);
        setError('');
    };

    const closeCreateModal = () => {
        if (creating) return;
        setShowCreateModal(false);
        setCreateForm(EMPTY_CREATE_FORM);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError('');
        setSuccess('');
        try {
            const res = await createMobileAppMenuPortal({
                key: createForm.key.trim(),
                titleEn: createForm.titleEn.trim(),
                titleAr: createForm.titleAr.trim() || undefined,
                enabled: createForm.enabled,
            });
            setPortals(res?.portals ?? portals);
            setShowCreateModal(false);
            setCreateForm(EMPTY_CREATE_FORM);
            setSuccess(t('ok.created'));
        } catch (err) {
            setError(err?.message || t('err.create'));
        } finally {
            setCreating(false);
        }
    };

    const enabledCount = portals.filter((p) => p.enabled).length;

    if (showCreateModal) {
        return (
            <AdminScreenShell
                title={t('modal.title')}
                onBack={closeCreateModal}
                backLabel={t('modal.close')}
                backDisabled={creating}
                footer={(
                    <div className="mobile-app-menu-modal-actions">
                        <button
                            type="button"
                            className="mobile-app-menu-cancel-btn"
                            onClick={closeCreateModal}
                            disabled={creating}
                        >
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="submit"
                            form="mobile-app-menu-create-form"
                            className="mobile-app-menu-save-btn"
                            disabled={creating}
                        >
                            {creating ? (
                                <Loader2 className="spin" size={18} />
                            ) : (
                                <Plus size={18} />
                            )}
                            {t('btn.createSubmit')}
                        </button>
                    </div>
                )}
            >
                <form id="mobile-app-menu-create-form" onSubmit={handleCreate} className="mobile-app-menu-modal-form">
                    <label className="mobile-app-menu-field">
                        <span>{t('label.key')}</span>
                        <input
                            type="text"
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
                    </label>

                    <label className="mobile-app-menu-field">
                        <span>{t('label.titleEn')}</span>
                        <input
                            type="text"
                            value={createForm.titleEn}
                            onChange={(e) =>
                                setCreateForm((f) => ({ ...f, titleEn: e.target.value }))
                            }
                            placeholder={t('ph.titleEn')}
                            required
                        />
                    </label>

                    <label className="mobile-app-menu-field">
                        <span>{t('label.titleAr')}</span>
                        <input
                            type="text"
                            dir="rtl"
                            value={createForm.titleAr}
                            onChange={(e) =>
                                setCreateForm((f) => ({ ...f, titleAr: e.target.value }))
                            }
                            placeholder={t('ph.titleAr')}
                        />
                    </label>

                    <div className="mobile-app-menu-modal-toggle-row">
                        <span>{t('label.showInApp')}</span>
                        <ToggleSwitch
                            checked={createForm.enabled}
                            onChange={(enabled) =>
                                setCreateForm((f) => ({ ...f, enabled }))
                            }
                            label={t('label.showInApp')}
                            visibleLabel={t('toggle.visible')}
                            hiddenLabel={t('toggle.hidden')}
                        />
                    </div>

                    {error && showCreateModal && (
                        <div className="mobile-app-menu-error">{error}</div>
                    )}
                </form>
            </AdminScreenShell>
        );
    }

    return (
        <div className="mobile-app-menu-page">
            <header className="mobile-app-menu-header">
                <div>
                    <h1>{t('page.title')}</h1>
                    <p>{t('page.subtitle')}</p>
                </div>
                <button
                    type="button"
                    className="mobile-app-menu-create-btn"
                    onClick={openCreateModal}
                    disabled={loading}
                >
                    <Plus size={18} />
                    {t('btn.create')}
                </button>
            </header>

            <div className="mobile-app-menu-card">
                {loading ? (
                    <MobileAppMenuShimmer loadingLabel={t('loading.aria')} />
                ) : (
                    <form onSubmit={handleSave} className="mobile-app-menu-form">
                        <div className="mobile-app-menu-summary">
                            <Smartphone size={20} />
                            <span>
                                {t('summary.visible', {
                                    enabled: enabledCount,
                                    total: portals.length,
                                })}
                            </span>
                        </div>

                        <ul className="mobile-app-menu-grid">
                            {portals.map((portal) => (
                                <li key={portal.key} className="mobile-app-menu-tile">
                                    <div className="mobile-app-menu-tile-body">
                                        <strong>{portal.titleEn}</strong>
                                        {portal.titleAr && (
                                            <span dir="rtl">{portal.titleAr}</span>
                                        )}
                                        <code>{portal.key}</code>
                                        {portal.isBuiltIn && (
                                            <span className="mobile-app-menu-badge">
                                                {t('badge.builtIn')}
                                            </span>
                                        )}
                                    </div>
                                    <ToggleSwitch
                                        checked={portal.enabled === true}
                                        onChange={() => togglePortal(portal.key)}
                                        label={t('toggle.aria', { title: portal.titleEn })}
                                        visibleLabel={t('toggle.visible')}
                                        hiddenLabel={t('toggle.hidden')}
                                    />
                                </li>
                            ))}
                        </ul>

                        {error && !showCreateModal && (
                            <div className="mobile-app-menu-error">{error}</div>
                        )}
                        {success && (
                            <div className="mobile-app-menu-success">
                                <CheckCircle2 size={16} />
                                {success}
                            </div>
                        )}

                        <div className="mobile-app-menu-actions">
                            <button
                                type="submit"
                                className="mobile-app-menu-save-btn"
                                disabled={saving || enabledCount === 0}
                            >
                                {saving ? (
                                    <Loader2 className="spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                {t('btn.save')}
                            </button>
                        </div>
                    </form>
                )}
            </div>

        </div>
    );
}
