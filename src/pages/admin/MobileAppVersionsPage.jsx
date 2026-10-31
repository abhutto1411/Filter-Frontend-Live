import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import {
    getMobileAppVersions,
    updateMobileAppVersion,
} from '../../services/superAdminApi';
import '../../styles/admin/MobileAppMenuPage.css';

const APPS = [
    { id: 'softpos', title: 'Filter SoftPOS', placeholder: '77.0.0' },
    { id: 'filter_hub', title: 'Filter Hub', placeholder: '1.0.1' },
];

function emptyDraft(row) {
    return {
        appVersion: row?.appVersion || '',
        playStoreVersion: row?.playStoreVersion || '',
        enabled: row?.enabled !== false,
    };
}

function VersionShimmer() {
    return (
        <div className="mobile-app-menu-card" style={{ marginTop: 20 }} role="status" aria-busy="true" aria-label="Loading versions">
            <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--title" />
            <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--subtitle" style={{ marginTop: 10 }} />
            <span className="mobile-app-menu-shimmer-line" style={{ height: 42, marginTop: 16 }} />
            <span className="mobile-app-menu-shimmer-line" style={{ height: 42, marginTop: 12 }} />
            <span className="mobile-app-menu-shimmer-line mobile-app-menu-shimmer-line--button" style={{ marginTop: 16 }} />
        </div>
    );
}

export default function MobileAppVersionsPage() {
    const [rows, setRows] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState('');
    const [error, setError] = useState('');
    const [savedKey, setSavedKey] = useState('');
    const [activeApp, setActiveApp] = useState('softpos');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getMobileAppVersions();
            const list = Array.isArray(res?.data) ? res.data : [];
            const next = {};
            for (const row of list) {
                next[row.appKey] = emptyDraft(row);
            }
            setRows(list);
            setDrafts(next);
        } catch (err) {
            setError(err?.message || 'Could not load app versions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const patchDraft = (appKey, field, value) => {
        setDrafts((prev) => ({
            ...prev,
            [appKey]: { ...emptyDraft(), ...prev[appKey], [field]: value },
        }));
        setSavedKey('');
    };

    const save = async (appKey) => {
        const draft = drafts[appKey] || emptyDraft();
        setSavingKey(appKey);
        setError('');
        setSavedKey('');
        try {
            await updateMobileAppVersion({
                appKey,
                channel: 'production',
                appVersion: draft.appVersion.trim(),
                playStoreVersion: draft.playStoreVersion.trim(),
                enabled: draft.enabled !== false,
            });
            setSavedKey(appKey);
            await load();
        } catch (err) {
            setError(err?.message || 'Could not save this version');
        } finally {
            setSavingKey('');
        }
    };

    return (
        <div className="mobile-app-menu-page">
            <header className="mobile-app-menu-header">
                <div>
                    <h1>Mobile app versions</h1>
                    <p>
                        Filter SoftPOS production only. Sandbox and local are not checked.
                        Filter Hub version control is coming soon.
                    </p>
                </div>
            </header>

            {error ? <div className="mobile-app-menu-error" style={{ marginTop: 16 }}>{error}</div> : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                {APPS.map((app) => {
                    const selected = activeApp === app.id;
                    return (
                        <button
                            key={app.id}
                            type="button"
                            onClick={() => setActiveApp(app.id)}
                            style={{
                                border: 'none',
                                borderRadius: 999,
                                padding: '8px 16px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: selected ? '#23262D' : '#fff',
                                color: selected ? '#FCC247' : '#23262D',
                            }}
                        >
                            {app.title}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <VersionShimmer />
            ) : (
                APPS.filter((app) => app.id === activeApp).map((app) => {
                    if (app.id === 'filter_hub') {
                        return (
                            <div key={app.id} className="mobile-app-menu-card" style={{ maxWidth: 520 }}>
                                <strong>Filter Hub</strong>
                                <p style={{ margin: '10px 0 0', color: '#6b7280' }}>Coming soon</p>
                            </div>
                        );
                    }
                    const row = rows.find((item) => item.appKey === app.id);
                    const draft = drafts[app.id] || emptyDraft(row);
                    const busy = savingKey === app.id;
                    return (
                        <form
                            key={app.id}
                            className="mobile-app-menu-card"
                            onSubmit={(event) => {
                                event.preventDefault();
                                save(app.id);
                            }}
                            style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 520 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <strong>{app.title}</strong>
                                <label className="mobile-app-menu-switch-wrap">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={draft.enabled}
                                        className={`mobile-app-menu-switch${draft.enabled ? ' is-on' : ''}`}
                                        onClick={() => patchDraft(app.id, 'enabled', !draft.enabled)}
                                    >
                                        <span className="mobile-app-menu-switch-thumb" />
                                    </button>
                                    <span className="mobile-app-menu-switch-label">
                                        {draft.enabled ? 'On' : 'Off'}
                                    </span>
                                </label>
                            </div>
                            <label className="mobile-app-menu-field">
                                <span>App version</span>
                                <input
                                    value={draft.appVersion}
                                    onChange={(e) => patchDraft(app.id, 'appVersion', e.target.value)}
                                    placeholder={app.placeholder}
                                />
                            </label>
                            <label className="mobile-app-menu-field">
                                <span>Play Store version</span>
                                <input
                                    value={draft.playStoreVersion}
                                    onChange={(e) => patchDraft(app.id, 'playStoreVersion', e.target.value)}
                                    placeholder={app.placeholder}
                                />
                            </label>
                            <button type="submit" className="mobile-app-menu-save-btn" disabled={busy}>
                                {busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                {savedKey === app.id ? 'Saved' : 'Save'}
                            </button>
                        </form>
                    );
                })
            )}
        </div>
    );
}
