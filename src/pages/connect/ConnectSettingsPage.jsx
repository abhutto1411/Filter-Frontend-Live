import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { connectScopeParams, getConnectAiConfig, patchConnectAiConfig } from '../../services/connectApi';
import '../../styles/connect/ConnectHome.css';

export default function ConnectSettingsPage() {
    const { workshopId, branchId } = useOutletContext() ?? {};
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

            <section className="cn-card" style={{ padding: 20, marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Models</h2>
                <p>Testing model: <code>{cfg.testingModel}</code></p>
                <p>Production model (NODE_ENV=production): <code>{cfg.productionModel}</code></p>
                <p>Set <code>CONNECT_AI_PRODUCTION_MODEL</code> in filter_backend/.env when you leave the free-tier key.</p>
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
