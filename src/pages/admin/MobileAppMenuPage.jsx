import React, { useCallback, useEffect, useState } from 'react';
import {
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
import '../../styles/admin/MobileAppMenuPage.css';

const EMPTY_CREATE_FORM = {
    key: '',
    titleEn: '',
    titleAr: '',
    enabled: true,
};

function ToggleSwitch({ checked, onChange, label }) {
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
                {checked ? 'Visible' : 'Hidden'}
            </span>
        </label>
    );
}

function MobileAppMenuShimmer() {
    return (
        <div
            className="mobile-app-menu-shimmer"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading mobile app menu"
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
            setError(e?.message || 'Failed to load mobile app menu');
        } finally {
            setLoading(false);
        }
    }, []);

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
            setSuccess('Saved — mobile app will show only enabled portals.');
        } catch (err) {
            setError(err?.message || 'Failed to save');
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
            setSuccess('Portal created successfully.');
        } catch (err) {
            setError(err?.message || 'Failed to create portal');
        } finally {
            setCreating(false);
        }
    };

    const enabledCount = portals.filter((p) => p.enabled).length;

    return (
        <div className="mobile-app-menu-page">
            <header className="mobile-app-menu-header">
                <div>
                    <h1>Mobile App Menu</h1>
                    <p>
                        Control which portals appear on the Flutter app home screen
                        (ALL Apps). Only toggled-on portals are visible to users.
                    </p>
                </div>
                <button
                    type="button"
                    className="mobile-app-menu-create-btn"
                    onClick={openCreateModal}
                    disabled={loading}
                >
                    <Plus size={18} />
                    Create Portal
                </button>
            </header>

            <div className="mobile-app-menu-card">
                {loading ? (
                    <MobileAppMenuShimmer />
                ) : (
                    <form onSubmit={handleSave} className="mobile-app-menu-form">
                        <div className="mobile-app-menu-summary">
                            <Smartphone size={20} />
                            <span>
                                {enabledCount} of {portals.length} portal(s) visible in the app
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
                                            <span className="mobile-app-menu-badge">Built-in</span>
                                        )}
                                    </div>
                                    <ToggleSwitch
                                        checked={portal.enabled === true}
                                        onChange={() => togglePortal(portal.key)}
                                        label={`Toggle ${portal.titleEn}`}
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
                                Save menu
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {showCreateModal && (
                <div
                    className="mobile-app-menu-modal-backdrop"
                    onClick={closeCreateModal}
                    role="presentation"
                >
                    <div
                        className="mobile-app-menu-modal"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-portal-title"
                    >
                        <div className="mobile-app-menu-modal-header">
                            <h2 id="create-portal-title">Create Portal</h2>
                            <button
                                type="button"
                                className="mobile-app-menu-modal-close"
                                onClick={closeCreateModal}
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="mobile-app-menu-modal-form">
                            <label className="mobile-app-menu-field">
                                <span>Key (slug)</span>
                                <input
                                    type="text"
                                    value={createForm.key}
                                    onChange={(e) =>
                                        setCreateForm((f) => ({
                                            ...f,
                                            key: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                                        }))
                                    }
                                    placeholder="e.g. corporate_portal"
                                    required
                                    pattern="[a-z][a-z0-9_]*"
                                    title="Lowercase letters, numbers, and underscores only"
                                />
                            </label>

                            <label className="mobile-app-menu-field">
                                <span>Title (English)</span>
                                <input
                                    type="text"
                                    value={createForm.titleEn}
                                    onChange={(e) =>
                                        setCreateForm((f) => ({ ...f, titleEn: e.target.value }))
                                    }
                                    placeholder="Corporate Portal"
                                    required
                                />
                            </label>

                            <label className="mobile-app-menu-field">
                                <span>Title (Arabic)</span>
                                <input
                                    type="text"
                                    dir="rtl"
                                    value={createForm.titleAr}
                                    onChange={(e) =>
                                        setCreateForm((f) => ({ ...f, titleAr: e.target.value }))
                                    }
                                    placeholder="بوابة الشركات"
                                />
                            </label>

                            <div className="mobile-app-menu-modal-toggle-row">
                                <span>Show in mobile app</span>
                                <ToggleSwitch
                                    checked={createForm.enabled}
                                    onChange={(enabled) =>
                                        setCreateForm((f) => ({ ...f, enabled }))
                                    }
                                    label="Show in mobile app"
                                />
                            </div>

                            {error && showCreateModal && (
                                <div className="mobile-app-menu-error">{error}</div>
                            )}

                            <div className="mobile-app-menu-modal-actions">
                                <button
                                    type="button"
                                    className="mobile-app-menu-cancel-btn"
                                    onClick={closeCreateModal}
                                    disabled={creating}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="mobile-app-menu-save-btn"
                                    disabled={creating}
                                >
                                    {creating ? (
                                        <Loader2 className="spin" size={18} />
                                    ) : (
                                        <Plus size={18} />
                                    )}
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
