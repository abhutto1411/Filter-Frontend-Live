import React, { useEffect, useState } from 'react';
import {
  Plug,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Zap,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import {
  marketingGetIntegrations,
  marketingSaveIntegrations,
  marketingTestIntegration,
} from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

const groupIcon = (id) => {
  if (id === 'llm') return Sparkles;
  return Plug;
};

export const Integrations = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // edits: { KEY: value } — only keys the user typed are sent.
  const [edits, setEdits] = useState({});
  const [testState, setTestState] = useState({}); // { groupId: {loading,ok,msg} }

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await marketingGetIntegrations();
      setData(res);
      setEdits({});
    } catch (err) {
      setError(err?.message || 'Failed to load integrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setField = (key, value) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    setSuccess('');
  };

  const handleSave = async () => {
    if (Object.keys(edits).length === 0) {
      setSuccess('Nothing changed.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const res = await marketingSaveIntegrations(edits);
      if (res?.status) setData(res.status);
      setEdits({});
      const n = (res?.changed?.length || 0) + (res?.cleared?.length || 0);
      setSuccess(`Saved & applied ${n} setting(s). Changes are live immediately.`);
    } catch (err) {
      setError(err?.message || 'Failed to save integrations.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (group) => {
    setTestState((prev) => ({
      ...prev,
      [group.id]: { loading: true },
    }));
    try {
      // Save any pending edits first so the test uses the latest values.
      if (Object.keys(edits).length > 0) {
        const res = await marketingSaveIntegrations(edits);
        if (res?.status) setData(res.status);
        setEdits({});
      }

      const body =
        group.id === 'llm'
          ? { type: 'llm' }
          : { type: 'platform', platform: group.platform };
      const res = await marketingTestIntegration(body);
      setTestState((prev) => ({
        ...prev,
        [group.id]: {
          loading: false,
          ok: !!res?.ok,
          msg: res?.ok
            ? group.id === 'llm'
              ? `Connected to ${res.provider}. Test reply: "${res.sample || 'OK'}"`
              : `${res.label || 'Provider'} credentials are configured.`
            : res?.reason || 'Test failed.',
        },
      }));
    } catch (err) {
      setTestState((prev) => ({
        ...prev,
        [group.id]: { loading: false, ok: false, msg: err?.message || 'Test failed.' },
      }));
    }
  };

  const groups = data?.groups || [];

  return (
    <div className="mk-page mk-intg-page">
      <div className="mk-intg-header">
        <div>
          <h1 className="mk-intg-title">
            <KeyRound size={20} /> Integrations & API Keys
          </h1>
          <p className="mk-intg-subtitle">
            Add your API keys and credentials here. They are encrypted, applied
            instantly (no restart), and never shown again.
          </p>
        </div>
        <button
          type="button"
          className="mk-intg-save-btn"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? (
            <>
              <Loader2 size={15} className="mk-intg-spin" /> Saving...
            </>
          ) : (
            <>
              <Save size={15} /> Save All
            </>
          )}
        </button>
      </div>

      {data?.llm ? (
        <div
          className={`mk-intg-banner ${data.llm.configured ? 'ok' : 'warn'}`}
        >
          {data.llm.configured ? (
            <>
              <CheckCircle2 size={16} /> AI engine active via{' '}
              <b>&nbsp;{data.llm.provider}</b>. AI reports & optimizer are enabled.
            </>
          ) : (
            <>
              <AlertCircle size={16} /> AI engine not configured yet. Add an
              OpenAI or Anthropic key below and click Save.
            </>
          )}
        </div>
      ) : null}

      {success ? (
        <div className="mk-intg-toast ok">
          <CheckCircle2 size={15} /> {success}
        </div>
      ) : null}
      {error ? (
        <div className="mk-intg-toast err">
          <AlertCircle size={15} /> {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mk-intg-loading">
          <Loader2 size={32} className="mk-intg-spin" />
          <p>Loading integrations...</p>
        </div>
      ) : (
        <div className="mk-intg-grid">
          {groups.map((group) => {
            const Icon = groupIcon(group.id);
            const ts = testState[group.id] || {};
            return (
              <section key={group.id} className="mk-intg-card">
                <div className="mk-intg-card-head">
                  <div className="mk-intg-card-title">
                    <span className="mk-intg-card-icon">
                      <Icon size={16} />
                    </span>
                    <div>
                      <h3>{group.title}</h3>
                      <p>{group.description}</p>
                    </div>
                  </div>
                  <span
                    className={`mk-intg-badge ${group.configured ? 'on' : 'off'}`}
                  >
                    {group.configured ? (
                      <>
                        <ShieldCheck size={12} /> Configured
                      </>
                    ) : (
                      'Not set'
                    )}
                  </span>
                </div>

                <div className="mk-intg-fields">
                  {group.keys.map((field) => {
                    const edited = Object.prototype.hasOwnProperty.call(
                      edits,
                      field.key,
                    );
                    const inputValue = edited
                      ? edits[field.key]
                      : field.secret
                        ? ''
                        : field.value || '';
                    const placeholder = field.secret
                      ? field.last4
                        ? `•••• •••• ${field.last4}`
                        : field.placeholder || 'Enter value'
                      : field.placeholder || 'Enter value';

                    return (
                      <div key={field.key} className="mk-intg-field">
                        <label>
                          {field.label}
                          {field.secret ? (
                            <span className="mk-intg-secret-tag">secret</span>
                          ) : null}
                          {field.configured ? (
                            <span className="mk-intg-set-tag">
                              {field.source === 'env' ? 'from env' : 'saved'}
                            </span>
                          ) : null}
                        </label>
                        <input
                          type={field.secret ? 'password' : 'text'}
                          autoComplete="off"
                          value={inputValue}
                          placeholder={placeholder}
                          onChange={(e) => setField(field.key, e.target.value)}
                        />
                        {field.secret && field.configured ? (
                          <small>
                            A key is saved. Leave blank to keep it, type to
                            replace, or clear &amp; save to remove.
                          </small>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="mk-intg-card-foot">
                  <button
                    type="button"
                    className="mk-intg-test-btn"
                    onClick={() => handleTest(group)}
                    disabled={ts.loading}
                  >
                    {ts.loading ? (
                      <>
                        <Loader2 size={13} className="mk-intg-spin" /> Testing...
                      </>
                    ) : (
                      <>
                        <Zap size={13} /> Save &amp; Test
                      </>
                    )}
                  </button>
                  {ts.msg ? (
                    <span
                      className={`mk-intg-test-result ${ts.ok ? 'ok' : 'err'}`}
                    >
                      {ts.ok ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <AlertCircle size={13} />
                      )}
                      {ts.msg}
                    </span>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <style>{`
        .mk-intg-page { padding: 20px 22px 40px; }
        .mk-intg-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
        .mk-intg-title { display:flex; align-items:center; gap:9px; margin:0; font-size:20px; font-weight:850; color:#0f172a; }
        .mk-intg-subtitle { margin:4px 0 0; font-size:13px; color:#64748b; max-width:640px; }
        .mk-intg-save-btn { display:inline-flex; align-items:center; gap:8px; border:0; border-radius:9px; background:#7c3aed; color:#fff; font-weight:800; font-size:13px; padding:10px 18px; cursor:pointer; }
        .mk-intg-save-btn:disabled { opacity:.7; cursor:not-allowed; }
        .mk-intg-banner { display:flex; align-items:center; gap:7px; border-radius:9px; padding:11px 14px; font-size:13px; margin-bottom:14px; }
        .mk-intg-banner.ok { background:#ecfdf5; border:1px solid #a7f3d0; color:#047857; }
        .mk-intg-banner.warn { background:#fffbeb; border:1px solid #fde68a; color:#b45309; }
        .mk-intg-toast { display:flex; align-items:center; gap:7px; border-radius:8px; padding:9px 13px; font-size:12.5px; margin-bottom:12px; font-weight:600; }
        .mk-intg-toast.ok { background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; }
        .mk-intg-toast.err { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
        .mk-intg-loading { display:flex; flex-direction:column; align-items:center; gap:10px; padding:60px; color:#64748b; }
        .mk-intg-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:16px; }
        .mk-intg-card { background:#fff; border:1px solid #e2e8f0; border-radius:13px; padding:16px 18px; display:flex; flex-direction:column; }
        .mk-intg-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
        .mk-intg-card-title { display:flex; gap:11px; }
        .mk-intg-card-icon { width:34px; height:34px; flex:0 0 34px; border-radius:9px; background:linear-gradient(135deg,#ede9fe,#dbeafe); color:#7c3aed; display:flex; align-items:center; justify-content:center; }
        .mk-intg-card-title h3 { margin:0; font-size:14px; font-weight:850; color:#0f172a; }
        .mk-intg-card-title p { margin:3px 0 0; font-size:11.5px; color:#64748b; max-width:330px; }
        .mk-intg-badge { flex:0 0 auto; height:fit-content; display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.4px; padding:4px 9px; border-radius:20px; }
        .mk-intg-badge.on { background:#dcfce7; color:#15803d; }
        .mk-intg-badge.off { background:#f1f5f9; color:#94a3b8; }
        .mk-intg-fields { display:grid; gap:12px; margin-bottom:14px; }
        .mk-intg-field label { display:flex; align-items:center; gap:7px; font-size:11.5px; font-weight:750; color:#334155; margin-bottom:5px; }
        .mk-intg-secret-tag { font-size:9px; font-weight:800; text-transform:uppercase; background:#fef3c7; color:#b45309; padding:1px 6px; border-radius:9px; }
        .mk-intg-set-tag { font-size:9px; font-weight:800; text-transform:uppercase; background:#dbeafe; color:#1d4ed8; padding:1px 6px; border-radius:9px; }
        .mk-intg-field input { width:100%; height:38px; border:1px solid #d8dee9; border-radius:8px; padding:0 12px; font-size:13px; color:#0f172a; outline:none; box-sizing:border-box; font-family:inherit; }
        .mk-intg-field input:focus { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.12); }
        .mk-intg-field small { display:block; margin-top:4px; font-size:10.5px; color:#94a3b8; }
        .mk-intg-card-foot { margin-top:auto; display:flex; align-items:center; gap:11px; flex-wrap:wrap; padding-top:6px; border-top:1px solid #f1f5f9; }
        .mk-intg-test-btn { display:inline-flex; align-items:center; gap:6px; border:1px solid #ddd6fe; background:#f5f3ff; color:#6d28d9; font-weight:750; font-size:12px; padding:7px 13px; border-radius:8px; cursor:pointer; }
        .mk-intg-test-btn:disabled { opacity:.7; cursor:not-allowed; }
        .mk-intg-test-result { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:650; }
        .mk-intg-test-result.ok { color:#047857; }
        .mk-intg-test-result.err { color:#b91c1c; }
        .mk-intg-spin { animation: mk-intg-spin 1s linear infinite; }
        @keyframes mk-intg-spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) { .mk-intg-grid { grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
};

export default Integrations;
