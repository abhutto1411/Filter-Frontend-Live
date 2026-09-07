import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    connectScopeParams,
    createConnectAiProvider,
    deleteConnectAiProvider,
    getConnectAiConfig,
    listConnectAiProviders,
    patchConnectAiConfig,
    patchConnectAiProvider,
} from '../../services/connectApi';
import '../../styles/connect/ConnectHome.css';

/** Named platforms. API hosts are filled in — never paste a browser address. */
const PROVIDERS = [
    {
        id: 'gemini',
        platform: 'gemini',
        label: 'Google Gemini',
        model: 'gemini-flash-lite-latest',
        baseUrl: '',
        keyHint: 'AIza… or AQ.…',
        help: 'Google AI Studio → API keys. Copy the key only (AIza… or AQ.…), not the page URL.',
    },
    {
        id: 'openai',
        platform: 'openai',
        label: 'OpenAI',
        model: 'gpt-4o-mini',
        baseUrl: '',
        keyHint: 'sk-…',
        help: 'platform.openai.com → API keys. Copy the secret key only.',
    },
    {
        id: 'anthropic',
        platform: 'anthropic',
        label: 'Anthropic Claude',
        model: 'claude-sonnet-5',
        baseUrl: '',
        keyHint: 'sk-ant-…',
        help: 'console.anthropic.com → API keys. Copy the key only (starts with sk-ant).',
    },
    {
        id: 'openrouter',
        platform: 'custom',
        label: 'OpenRouter',
        model: 'openai/gpt-4o-mini',
        baseUrl: 'https://openrouter.ai/api/v1',
        keyHint: 'sk-or-…',
        help: 'openrouter.ai → Keys. Copy the key only.',
    },
    {
        id: 'groq',
        platform: 'custom',
        label: 'Groq',
        model: 'llama-3.1-8b-instant',
        baseUrl: 'https://api.groq.com/openai/v1',
        keyHint: 'gsk_…',
        help: 'console.groq.com → API keys. Copy the key only.',
    },
    {
        id: 'together',
        platform: 'custom',
        label: 'Together AI',
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        baseUrl: 'https://api.together.xyz/v1',
        keyHint: '…',
        help: 'api.together.xyz → API keys. Copy the key only.',
    },
    {
        id: 'fireworks',
        platform: 'custom',
        label: 'Fireworks',
        model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
        baseUrl: 'https://api.fireworks.ai/inference/v1',
        keyHint: '…',
        help: 'fireworks.ai → API keys. Copy the key only.',
    },
    {
        id: 'deepseek',
        platform: 'custom',
        label: 'DeepSeek',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        keyHint: 'sk-…',
        help: 'platform.deepseek.com → API keys. Copy the key only.',
    },
    {
        id: 'mistral',
        platform: 'custom',
        label: 'Mistral',
        model: 'mistral-small-latest',
        baseUrl: 'https://api.mistral.ai/v1',
        keyHint: '…',
        help: 'console.mistral.ai → API keys. Copy the key only.',
    },
    {
        id: 'xai',
        platform: 'custom',
        label: 'xAI Grok',
        model: 'grok-2-latest',
        baseUrl: 'https://api.x.ai/v1',
        keyHint: 'xai-…',
        help: 'console.x.ai → API keys. Copy the key only.',
    },
    {
        id: 'ollama',
        platform: 'custom',
        label: 'Ollama (local)',
        model: 'llama3.1',
        baseUrl: 'http://127.0.0.1:11434/v1',
        keyHint: 'ollama',
        help: 'Local Ollama. Key can be the word ollama if the server does not require one.',
    },
    {
        id: 'other',
        platform: 'custom',
        label: 'Other (OpenAI-compatible)',
        model: 'gpt-4o-mini',
        baseUrl: '',
        keyHint: 'sk-…',
        help: 'Copy the API key only — not the browser address.',
        needsBaseUrl: true,
    },
];

const PLATFORM_LABEL = {
    openai: 'OpenAI',
    anthropic: 'Anthropic Claude',
    gemini: 'Google Gemini',
    custom: 'Custom',
};

function providerById(id) {
    return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

function displayNameForSaved(row) {
    if (row.label) return row.label;
    if (row.platform !== 'custom') {
        return PROVIDERS.find((p) => p.platform === row.platform && !p.needsBaseUrl)?.label
            || PLATFORM_LABEL[row.platform]
            || row.platform;
    }
    const base = String(row.baseUrl || '').replace(/\/+$/, '');
    const preset = PROVIDERS.find((p) => p.baseUrl && p.baseUrl.replace(/\/+$/, '') === base);
    return preset?.label || 'Custom';
}

const EMPTY_FORM = {
    providerId: 'gemini',
    label: '',
    apiKey: '',
    model: providerById('gemini').model,
    baseUrl: '',
    isActive: true,
};

export default function ConnectSettingsPage() {
    const { workshopId, branchId, scope } = useOutletContext() ?? {};
    const isPlatformAdmin = Boolean(scope?.isPlatformAdmin);
    const params = connectScopeParams({ workshopId, branchId });
    const [cfg, setCfg] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const load = () => {
        getConnectAiConfig(params)
            .then(setCfg)
            .catch((e) => setError(e?.message || 'Could not load AI settings.'));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId, branchId]);

    const toggle = async (key, value) => {
        setSaving(true);
        try {
            await patchConnectAiConfig({ [key]: value }, params);
            load();
        } catch (e) {
            setError(e?.message || 'Could not save.');
        } finally {
            setSaving(false);
        }
    };

    if (!cfg) {
        return <div className="cn-home">{error || 'Loading AI settings…'}</div>;
    }

    const modelHint =
        cfg.modelSource === 'db'
            ? 'This is the model on the active API integration. Switch or edit the integration to change it — no restart.'
            : isPlatformAdmin
              ? 'No integration is active, so Connect is using the .env fallback. Add or activate a key below.'
              : 'Super Admin chooses the live model from API integrations.';

    return (
        <div className="cn-home">
            <div className="cn-home-head">
                <h1>AI settings</h1>
                <p>
                    Super Admin signs off D-05 / D-07 here, picks whether web search is on, and sees
                    which model is live. Expense auto-approval stays at {cfg.aiApprovalLimit} SAR.
                </p>
            </div>
            {error && <div className="cn-shell-error">{error}</div>}

            {isPlatformAdmin && <ApiIntegrationsCard onChanged={load} />}

            <section className="cn-card" style={{ padding: 20, marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Models</h2>
                <p>
                    Active model: <code>{cfg.productionModel}</code>
                    {cfg.activePlatform ? (
                        <>
                            {' '}
                            ({PLATFORM_LABEL[cfg.activePlatform] || cfg.activePlatform}
                            {cfg.modelSource === 'env' ? ', from .env' : ''})
                        </>
                    ) : null}
                </p>
                <p style={{ color: '#6b7280', fontSize: 13 }}>{modelHint}</p>
            </section>

            <section className="cn-card" style={{ padding: 20, marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Sign-off gates</h2>
                <label style={{ display: 'block', marginBottom: 10 }}>
                    <input
                        type="checkbox"
                        checked={cfg.d05SignedOff}
                        disabled={saving}
                        onChange={(e) => toggle('d05SignedOff', e.target.checked)}
                    />{' '}
                    D-05 target attribution signed off
                </label>
                <p style={{ color: '#6b7280', fontSize: 13 }}>{cfg.d05Brief}</p>
                <label style={{ display: 'block', margin: '12px 0 10px' }}>
                    <input
                        type="checkbox"
                        checked={cfg.d07SignedOff}
                        disabled={saving}
                        onChange={(e) => toggle('d07SignedOff', e.target.checked)}
                    />{' '}
                    D-07 PDPL / cross-border AI signed off
                </label>
                <p style={{ color: '#6b7280', fontSize: 13 }}>{cfg.d07Brief}</p>
            </section>

            <section className="cn-card" style={{ padding: 20 }}>
                <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Toggles</h2>
                <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                        type="checkbox"
                        checked={cfg.webSearchEnabled}
                        disabled={saving}
                        onChange={(e) => toggle('webSearchEnabled', e.target.checked)}
                    />{' '}
                    Web search (Tier 3) — Super Admin can always use it
                </label>
                <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                        type="checkbox"
                        checked={cfg.kbEnabled}
                        disabled={saving}
                        onChange={(e) => toggle('kbEnabled', e.target.checked)}
                    />{' '}
                    Knowledge base (Tier 2)
                </label>
                <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                        type="checkbox"
                        checked={cfg.voiceEnabled}
                        disabled={saving}
                        onChange={(e) => toggle('voiceEnabled', e.target.checked)}
                    />{' '}
                    Voice input
                </label>
                <label style={{ display: 'block' }}>
                    <input
                        type="checkbox"
                        checked={cfg.visionEnabled}
                        disabled={saving}
                        onChange={(e) => toggle('visionEnabled', e.target.checked)}
                    />{' '}
                    Attachment / vision
                </label>
            </section>
        </div>
    );
}

function ApiIntegrationsCard({ onChanged }) {
    const [providers, setProviders] = useState([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    const load = () => {
        listConnectAiProviders()
            .then((res) => setProviders(res?.providers || []))
            .catch((e) => setError(e?.message || 'Could not load API integrations.'));
    };

    useEffect(() => {
        load();
    }, []);

    const setField = (key, value) => {
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            if (key === 'providerId') {
                const preset = providerById(value);
                next.model = preset.model;
                next.baseUrl = preset.needsBaseUrl ? '' : preset.baseUrl || '';
                if (!prev.label) next.label = '';
            }
            return next;
        });
    };

    const run = async (fn) => {
        setBusy(true);
        setError('');
        try {
            await fn();
            load();
            onChanged?.();
        } catch (e) {
            setError(e?.message || 'Could not save the integration.');
        } finally {
            setBusy(false);
        }
    };

    const handleAdd = (e) => {
        e.preventDefault();
        const preset = providerById(form.providerId);
        const key = form.apiKey.trim();
        if (!key) {
            setError('API key is required.');
            return;
        }
        if (/^https?:\/\//i.test(key) || /aistudio\.google\.com|platform\.openai\.com|console\./i.test(key)) {
            setError('Paste only the API key, not the browser address. Pick the platform from the list.');
            return;
        }
        const baseUrl = preset.needsBaseUrl ? form.baseUrl.trim() : preset.baseUrl;
        if (preset.needsBaseUrl) {
            if (!baseUrl) {
                setError('Enter the API host (it should look like https://api.example.com/v1), not a website.');
                return;
            }
            if (/aistudio\.google\.com|platform\.openai\.com|console\.|\/keys|\/apikey/i.test(baseUrl) && !/\/v1/i.test(baseUrl)) {
                setError('That looks like a website. Pick a named platform above, or enter an API host ending in /v1.');
                return;
            }
        }
        run(async () => {
            await createConnectAiProvider({
                platform: preset.platform,
                label: form.label.trim() || preset.label,
                apiKey: key,
                model: form.model.trim() || preset.model,
                baseUrl: preset.platform === 'custom' ? baseUrl : undefined,
                isActive: form.isActive,
            });
            setForm({ ...EMPTY_FORM, providerId: form.providerId, model: preset.model });
            setShowForm(false);
        });
    };

    const preset = providerById(form.providerId);

    return (
        <section className="cn-card cn-integrations" style={{ padding: 20, marginBottom: 16 }}>
            <div className="cn-integrations-head">
                <div>
                    <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>API integrations</h2>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                        Super Admin only. Choose a platform, paste the API key, save. Connect fills
                        the API host — never paste a browser address. Keys are encrypted and not shown again.
                    </p>
                </div>
                <button
                    type="button"
                    className="cn-integrations-add"
                    disabled={busy}
                    onClick={() => setShowForm((v) => !v)}
                >
                    {showForm ? 'Cancel' : 'Add'}
                </button>
            </div>
            {error && <div className="cn-shell-error" style={{ marginTop: 12 }}>{error}</div>}

            {showForm && (
                <form className="cn-integrations-form" onSubmit={handleAdd}>
                    <label>
                        Platform
                        <select
                            value={form.providerId}
                            onChange={(e) => setField('providerId', e.target.value)}
                            disabled={busy}
                        >
                            {PROVIDERS.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Display name (optional)
                        <input
                            value={form.label}
                            onChange={(e) => setField('label', e.target.value)}
                            placeholder={preset.label}
                            disabled={busy}
                        />
                    </label>
                    <label className="cn-integrations-span">
                        API key
                        <input
                            type="password"
                            autoComplete="off"
                            value={form.apiKey}
                            onChange={(e) => setField('apiKey', e.target.value)}
                            placeholder={preset.keyHint}
                            disabled={busy}
                        />
                        <span className="cn-integrations-help">{preset.help}</span>
                    </label>
                    <label>
                        Model
                        <input
                            value={form.model}
                            onChange={(e) => setField('model', e.target.value)}
                            placeholder={preset.model}
                            disabled={busy}
                        />
                    </label>
                    {preset.needsBaseUrl && (
                        <label className="cn-integrations-span">
                            API host
                            <input
                                value={form.baseUrl}
                                onChange={(e) => setField('baseUrl', e.target.value)}
                                placeholder="https://api.example.com/v1"
                                disabled={busy}
                            />
                            <span className="cn-integrations-help">
                                Must look like https://api.example.com/v1 — not a dashboard or docs page.
                            </span>
                        </label>
                    )}
                    <label className="cn-integrations-check">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(e) => setField('isActive', e.target.checked)}
                            disabled={busy}
                        />
                        Set as active (Connect uses this key immediately)
                    </label>
                    <div className="cn-integrations-span">
                        <button type="submit" className="cn-integrations-save" disabled={busy}>
                            {busy ? 'Saving…' : 'Save integration'}
                        </button>
                    </div>
                </form>
            )}

            {providers.length === 0 && !showForm ? (
                <p className="cn-integrations-empty">No keys saved yet. Pick a platform, paste its API key, save.</p>
            ) : (
                <ul className="cn-integrations-list">
                    {providers.map((p) => (
                        <li key={p.id} className={p.isActive ? 'is-active' : ''}>
                            <div>
                                <strong>{displayNameForSaved(p)}</strong>
                                <span className="cn-integrations-meta">
                                    {displayNameForSaved({ ...p, label: '' })} · {p.model} · ••••{p.last4 || '????'}
                                </span>
                            </div>
                            <div className="cn-integrations-actions">
                                <span className={`cn-integrations-badge${p.isActive ? ' is-on' : ''}`}>
                                    {p.isActive ? 'Active' : 'Inactive'}
                                </span>
                                {!p.isActive && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => run(() => patchConnectAiProvider(p.id, { isActive: true }))}
                                    >
                                        Set active
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="is-danger"
                                    disabled={busy}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                `Remove ${p.label || p.platform} (••••${p.last4 || ''})? Connect will fall back to another saved key, then .env.`,
                                            )
                                        ) {
                                            run(() => deleteConnectAiProvider(p.id));
                                        }
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
