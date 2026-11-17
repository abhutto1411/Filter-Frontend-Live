import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getAiCameraSettings, updateAiCameraSettings } from '../../../services/aiCameraApi';

const inputStyle = {
  width: 120,
  padding: '8px 10px',
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  background: '#fff',
};

export default function AiCameraSettingsTab() {
  const [fields, setFields] = useState([]);
  const [draft, setDraft] = useState({});
  const [savedByAdmin, setSavedByAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getAiCameraSettings();
        if (cancelled) return;
        setFields(Array.isArray(res?.fields) ? res.fields : []);
        setDraft(res?.values || {});
        setSavedByAdmin(!!res?.savedByAdmin);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load timings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await updateAiCameraSettings(draft);
      setFields(Array.isArray(res?.fields) ? res.fields : fields);
      setDraft(res?.values || draft);
      setSavedByAdmin(true);
      setNotice('Saved. Matching and alerts use these values within about 30 seconds.');
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading timings…</div>;
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>AI camera timings</h3>
        <p style={{ margin: 0, color: '#6C757D', fontSize: 13, lineHeight: 1.5 }}>
          These apply to every workshop. They control alerts, how long a car stays one visit,
          and when a later invoice can replace a wrong department.
          {savedByAdmin
            ? ' The values below are the ones last saved here.'
            : ' Nothing has been saved yet, so the system is using its built-in defaults.'}
        </p>
      </div>

      {error ? (
        <div style={{ padding: 12, background: '#FEF2F2', color: '#991B1B', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {error}
        </div>
      ) : null}
      {notice ? (
        <div style={{ padding: 12, background: '#F0FDF4', color: '#166534', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {notice}
        </div>
      ) : null}

      <div className="ai-cam-panel">
        {fields.map((field) => (
          <div
            key={field.key}
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid #F3F4F6',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{field.label}</div>
              <div style={{ color: '#6C757D', fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>{field.help}</div>
            </div>
            {field.unit === 'boolean' ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={!!draft[field.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.checked }))}
                />
                On
              </label>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step || 1}
                  value={draft[field.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                  style={inputStyle}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6C757D', width: 72 }}>
                  {field.unit === 'confidence' ? '0–1' : field.unit}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="ai-cam-btn ai-cam-btn--primary"
        onClick={save}
        disabled={saving || fields.length === 0}
        style={{ marginTop: 16 }}
      >
        {saving ? <Loader2 size={14} className="spin" /> : null}
        Save timings
      </button>
    </div>
  );
}
