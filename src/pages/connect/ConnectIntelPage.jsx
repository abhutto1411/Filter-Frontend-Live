import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { connectScopeParams, getConnectIntel, runConnectIntel } from '../../services/connectApi';
import '../../styles/connect/ConnectHome.css';

export default function ConnectIntelPage() {
    const { workshopId, branchId, scope } = useOutletContext() ?? {};
    const params = connectScopeParams({ workshopId, branchId });
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const load = () => {
        getConnectIntel(params)
            .then(setData)
            .catch((e) => setError(e?.message || 'Could not load intelligence.'));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId, branchId]);

    return (
        <div className="cn-home">
            <div className="cn-home-head">
                <h1>Background intelligence</h1>
                <p>
                    Hurdles, churn lists and sales forecasts are statistical / rule-based. The
                    assistant only explains the number — it does not invent the forecast.
                </p>
            </div>
            {error && <div className="cn-shell-error">{error}</div>}
            {scope?.isPlatformAdmin && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await runConnectIntel();
                            load();
                        } catch (e) {
                            setError(e?.message || 'Run failed.');
                        } finally {
                            setBusy(false);
                        }
                    }}
                    style={{ marginBottom: 16 }}
                >
                    {busy ? 'Running…' : 'Run now for all workshops'}
                </button>
            )}

            <section className="cn-card" style={{ padding: 20, marginBottom: 16 }}>
                <h2 style={{ fontSize: 16 }}>Target hurdles</h2>
                {(data?.hurdles || []).length === 0 && <p>None stored yet.</p>}
                {(data?.hurdles || []).map((h) => (
                    <p key={h.id}>
                        {h.achievementPct}% — {h.suggestion}
                    </p>
                ))}
            </section>

            <section className="cn-card" style={{ padding: 20, marginBottom: 16 }}>
                <h2 style={{ fontSize: 16 }}>Sales forecast (7-day mean)</h2>
                {(data?.forecasts || []).length === 0 && <p>No forecast rows yet. Run the job.</p>}
                {(data?.forecasts || []).map((f) => (
                    <p key={`${f.type}-${f.periodStart}`}>
                        {f.periodStart}: predicted {f.predicted} SAR including VAT ({f.method})
                        {f.errorPct != null ? ` · error ${f.errorPct}%` : ''}
                    </p>
                ))}
            </section>

            <section className="cn-card" style={{ padding: 20 }}>
                <h2 style={{ fontSize: 16 }}>Churn risk (recency / frequency)</h2>
                <p style={{ color: '#6b7280', fontSize: 13 }}>{data?.churn?.rule}</p>
                {(data?.churn?.atRisk || []).length === 0 && <p>No at-risk repeat customers in this snapshot.</p>}
                <ul>
                    {(data?.churn?.atRisk || []).map((c) => (
                        <li key={c.customerId}>
                            Customer {c.customerId} · {c.daysSinceVisit} days · {c.visits} visits ·
                            SAR {c.spendInclVat} including VAT
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
