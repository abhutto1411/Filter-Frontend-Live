import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, Save } from 'lucide-react';
import {
    getMobileAppVersions,
    updateMobileAppVersion,
} from '../../services/superAdminApi';
import '../../styles/ui.css';

const APPS = [
    { id: 'softpos', title: 'Filter SoftPOS', placeholder: '77.0.0', ready: true },
    { id: 'filter_hub', title: 'Filter Hub', placeholder: '1.0.1', ready: false },
];

function emptyDraft(row) {
    return {
        appVersion: row?.appVersion || '',
        playStoreVersion: row?.playStoreVersion || '',
        enabled: row?.enabled !== false,
    };
}

/** One skeleton bar. */
function Sk({ shape = 'text', w, style }) {
    return <div className={`ui-sk ui-sk--${shape}${w ? ` ui-sk--w${w}` : ''}`} style={style} />;
}

function VersionSkeleton() {
    return (
        <section
            className="ui-panel ui-sk-row"
            role="status"
            aria-busy="true"
            aria-label="Loading app versions"
        >
            <div className="ui-toolbar">
                <Sk shape="strong" w={25} />
                <div className="ui-toolbar-end">
                    <Sk shape="pill" w={70} />
                </div>
            </div>
            <div className="ui-panel-pad">
                <div className="ui-form-grid">
                    <div className="ui-col-4">
                        <Sk shape="label" w={40} style={{ marginBottom: 7 }} />
                        <Sk shape="input" />
                    </div>
                    <div className="ui-col-4">
                        <Sk shape="label" w={40} style={{ marginBottom: 7 }} />
                        <Sk shape="input" />
                    </div>
                </div>
            </div>
            <div className="ui-panel-foot">
                <div className="ui-panel-end">
                    <Sk shape="btn" />
                </div>
            </div>
        </section>
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

    const app = APPS.find((item) => item.id === activeApp) ?? APPS[0];
    const row = rows.find((item) => item.appKey === app.id);
    const base = emptyDraft(row);
    const draft = drafts[app.id] || base;
    const busy = savingKey === app.id;
    const dirty =
        draft.appVersion !== base.appVersion ||
        draft.playStoreVersion !== base.playStoreVersion ||
        draft.enabled !== base.enabled;

    return (
        <div className="ui-root ui-root--flush">
            <div className="ui-tabs" role="tablist">
                {APPS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={item.id === activeApp}
                        className="ui-tab"
                        onClick={() => setActiveApp(item.id)}
                    >
                        {item.title}
                    </button>
                ))}
            </div>

            <div className="ui-band" style={{ marginTop: 16 }}>
                {loading ? (
                    <VersionSkeleton />
                ) : !app.ready ? (
                    <section className="ui-panel">
                        <div className="ui-empty">
                            <div className="ui-empty-icon">
                                <Clock size={18} />
                            </div>
                            <div className="ui-empty-title">Coming soon</div>
                            <div className="ui-empty-sub">
                                Version control is not wired for {app.title} yet.
                            </div>
                        </div>
                    </section>
                ) : (
                    <form
                        className="ui-panel"
                        onSubmit={(event) => {
                            event.preventDefault();
                            save(app.id);
                        }}
                    >
                        {/* Only the production channel is served to the apps — sandbox and
                            local builds skip the check entirely. */}
                        <div className="ui-toolbar">
                            <span className="ui-card-title">{app.title}</span>
                            <span className="ui-pill ui-pill--neutral">production</span>
                            <div className="ui-toolbar-end" style={{ alignItems: 'center' }}>
                                {dirty ? <span className="ui-pill ui-pill--warn">Unsaved changes</span> : null}
                                <label className="ui-switch">
                                    <input
                                        type="checkbox"
                                        checked={draft.enabled !== false}
                                        onChange={(e) => patchDraft(app.id, 'enabled', e.target.checked)}
                                    />
                                    <span className="ui-switch-track" />
                                    Version check
                                </label>
                            </div>
                        </div>

                        <div className="ui-panel-pad">
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="mav-app-version">App version</label>
                                    <input
                                        id="mav-app-version"
                                        className="ui-input"
                                        value={draft.appVersion}
                                        onChange={(e) => patchDraft(app.id, 'appVersion', e.target.value)}
                                        placeholder={app.placeholder}
                                        required
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="mav-store-version">Play Store version</label>
                                    <input
                                        id="mav-store-version"
                                        className="ui-input"
                                        value={draft.playStoreVersion}
                                        onChange={(e) =>
                                            patchDraft(app.id, 'playStoreVersion', e.target.value)
                                        }
                                        placeholder={app.placeholder}
                                        required
                                    />
                                    <span className="ui-help">
                                        Builds below this are asked to update.
                                    </span>
                                </div>
                            </div>

                            {draft.enabled === false ? (
                                <div className="ui-banner ui-banner--warn" style={{ marginTop: 16 }}>
                                    <AlertCircle size={15} />
                                    <span>Version check off — no build is asked to update.</span>
                                </div>
                            ) : null}
                            {error ? (
                                <div className="ui-banner ui-banner--dang" style={{ marginTop: 16 }}>
                                    <AlertCircle size={15} />
                                    <span>{error}</span>
                                </div>
                            ) : null}
                            {savedKey === app.id ? (
                                <div className="ui-banner ui-banner--ok" style={{ marginTop: 16 }}>
                                    <CheckCircle2 size={15} />
                                    <span>Saved.</span>
                                </div>
                            ) : null}
                        </div>

                        <div className="ui-panel-foot">
                            <div className="ui-panel-end">
                                <button
                                    type="submit"
                                    className="ui-btn ui-btn--primary"
                                    disabled={busy || !dirty}
                                >
                                    {busy ? <Loader2 className="ui-spin" size={15} /> : <Save size={15} />}
                                    Save
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
