import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, X,
} from 'lucide-react';
import { BASE_URL } from '../../../services/api';
import {
  exportTrainingDataset,
  getTrainingStats,
  listCameras,
  listTrainingCrops,
  reviewTrainingCrop,
} from '../../../services/aiCameraApi';
import { aiTrainingT } from '../../../utils/aiCameraTrainingI18n';
import {
  TRAINING_REASONS,
  TRAINING_STATUSES,
  defaultLabelForCrop,
  exportStatusParam,
  nextReviewIndex,
  normalizeCharBoxes,
  normalizeTrainingLabel,
  trainingImageSrc,
} from './trainingReview';
import './TrainingDataTab.css';

const LIST_PATH = '/admin/ai-camera';

function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const shown = v <= 1 ? v * 100 : v;
  return `${shown.toFixed(1)}%`;
}

function CropOverlay({ crop, showBoxes }) {
  const boxes = useMemo(() => normalizeCharBoxes(crop.charBoxes), [crop.charBoxes]);
  if (!showBoxes || !boxes.length || !crop.imageWidth || !crop.imageHeight) return null;
  return (
    <svg
      className="ai-training-card__overlay"
      viewBox={`0 0 ${crop.imageWidth} ${crop.imageHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {boxes.map((b) => (
        <g key={b.key}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill="none"
            stroke="#FBBF24"
            strokeWidth={Math.max(1.5, Math.min(crop.imageWidth, crop.imageHeight) * 0.008)}
          />
          {b.char ? (
            <text
              x={b.x + 2}
              y={Math.max(10, b.y - 2)}
              fill="#FBBF24"
              fontSize={Math.max(10, Math.min(crop.imageWidth, crop.imageHeight) * 0.045)}
              fontWeight="700"
            >
              {b.char}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export default function TrainingDataTab({ locale = 'en' }) {
  const t = useCallback((key, vars) => aiTrainingT(locale, key, vars), [locale]);
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    counts: { pending: 0, auto_labeled: 0, verified: 0, rejected: 0 },
    total: 0,
  });
  const [cameras, setCameras] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBoxes, setShowBoxes] = useState(true);
  const [labels, setLabels] = useState({});
  const [toast, setToast] = useState(null);

  const [status, setStatus] = useState('pending');
  const [cameraId, setCameraId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [mismatchOnly, setMismatchOnly] = useState(false);

  const labelRefs = useRef({});
  const toastTimer = useRef(null);

  const flash = useCallback((message, isError = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, isError });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await getTrainingStats();
      setStats(res);
    } catch {
      /* keep last stats */
    }
  }, []);

  const loadCrops = useCallback(async (nextPage = page) => {
    setLoading(true);
    try {
      const res = await listTrainingCrops({
        status: status || undefined,
        cameraId: cameraId || undefined,
        from: from || undefined,
        to: to || undefined,
        reason: reason || undefined,
        mismatchOnly: mismatchOnly ? 'true' : undefined,
        page: nextPage,
        limit: 12,
      });
      setItems(res.items);
      setPage(res.page);
      setTotalPages(Math.max(1, res.totalPages));
      setTotal(res.total);
      setActiveIndex(0);
      const nextLabels = {};
      res.items.forEach((crop) => {
        nextLabels[crop.id] = defaultLabelForCrop(crop);
      });
      setLabels(nextLabels);
    } catch (err) {
      flash(err.message || t('toast.error'), true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, cameraId, from, to, reason, mismatchOnly, flash, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cams = await listCameras();
        if (!cancelled) setCameras(Array.isArray(cams) ? cams : []);
      } catch {
        if (!cancelled) setCameras([]);
      }
    })();
    loadStats();
    return () => { cancelled = true; };
  }, [loadStats]);

  useEffect(() => {
    loadCrops(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters change
  }, [status, cameraId, from, to, reason, mismatchOnly]);

  const activeCrop = items[activeIndex] || null;

  const removeCropLocally = useCallback((id) => {
    setItems((prev) => {
      const idx = prev.findIndex((c) => String(c.id) === String(id));
      const next = prev.filter((c) => String(c.id) !== String(id));
      setActiveIndex(nextReviewIndex(Math.max(0, idx), next.length));
      return next;
    });
    setTotal((n) => Math.max(0, n - 1));
  }, []);

  const handleVerify = useCallback(async (crop) => {
    if (!crop || busyId) return;
    const labelText = normalizeTrainingLabel(labels[crop.id] ?? defaultLabelForCrop(crop));
    if (!labelText) {
      flash('Label required to verify', true);
      return;
    }
    setBusyId(String(crop.id));
    removeCropLocally(crop.id);
    try {
      await reviewTrainingCrop(crop.id, { status: 'verified', labelText });
      flash(t('toast.verified'));
      loadStats();
      if (items.length <= 1) loadCrops(page);
    } catch (err) {
      flash(err.message || t('toast.error'), true);
      loadCrops(page);
    } finally {
      setBusyId('');
    }
  }, [busyId, labels, removeCropLocally, flash, t, loadStats, items.length, loadCrops, page]);

  const handleReject = useCallback(async (crop) => {
    if (!crop || busyId) return;
    setBusyId(String(crop.id));
    removeCropLocally(crop.id);
    try {
      await reviewTrainingCrop(crop.id, {
        status: 'rejected',
        labelText: normalizeTrainingLabel(labels[crop.id] || '') || undefined,
      });
      flash(t('toast.rejected'));
      loadStats();
      if (items.length <= 1) loadCrops(page);
    } catch (err) {
      flash(err.message || t('toast.error'), true);
      loadCrops(page);
    } finally {
      setBusyId('');
    }
  }, [busyId, labels, removeCropLocally, flash, t, loadStats, items.length, loadCrops, page]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = String(e.target?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (e.key === 'Enter' && !e.shiftKey) {
        if (typing && e.target?.dataset?.trainingLabel !== '1') return;
        e.preventDefault();
        if (activeCrop) handleVerify(activeCrop);
        return;
      }
      if (typing) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (activeCrop) handleReject(activeCrop);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeCrop, handleVerify, handleReject, items.length]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTrainingDataset({ status: exportStatusParam(status) });
      flash(t('toast.exportOk'));
    } catch (err) {
      flash(err.message || t('toast.error'), true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="ai-training-tab">
      <div className="ai-training-stats">
        {TRAINING_STATUSES.map((key) => (
          <button
            key={key}
            type="button"
            className="ai-training-stat"
            onClick={() => setStatus(key)}
            style={{
              cursor: 'pointer',
              outline: status === key ? '2px solid #6366F1' : 'none',
              textAlign: 'left',
            }}
          >
            <div className="ai-training-stat__label">{t(`stats.${key}`)}</div>
            <div className="ai-training-stat__value">{stats.counts?.[key] ?? 0}</div>
          </button>
        ))}
        <div className="ai-training-stat">
          <div className="ai-training-stat__label">{t('stats.total')}</div>
          <div className="ai-training-stat__value">{stats.total}</div>
        </div>
      </div>

      <div className="ai-training-filters">
        <div className="form-group">
          <label>{t('filter.status')}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('filter.all')}</option>
            {TRAINING_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`stats.${s}`)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('filter.camera')}</label>
          <select value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
            <option value="">{t('filter.all')}</option>
            {cameras.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.name || c.deviceId || c.id}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('filter.from')}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('filter.to')}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('filter.reason')}</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">{t('filter.all')}</option>
            {TRAINING_REASONS.map((r) => (
              <option key={r} value={r}>{t(`reason.${r}`)}</option>
            ))}
          </select>
        </div>
        <label className="ai-training-filters__check">
          <input
            type="checkbox"
            checked={mismatchOnly}
            onChange={(e) => setMismatchOnly(e.target.checked)}
          />
          {t('filter.mismatch')}
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => loadCrops(1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB',
            background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> {t('filter.apply')}
        </button>
      </div>

      <div className="ai-training-toolbar">
        <div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', border: 'none', borderRadius: 8,
              background: '#111827', color: '#fff', fontWeight: 700,
              fontSize: 12, cursor: exporting ? 'wait' : 'pointer',
            }}
          >
            {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {exporting ? t('export.working') : t('export.btn')}
          </button>
          <p className="ai-training-export-note" style={{ margin: '8px 0 0' }}>
            {t('export.note')}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} />
            {t('card.boxes')}
          </label>
          <div className="ai-training-toolbar__hint">{t('keys.hint')}</div>
        </div>
      </div>

      {loading ? (
        <div className="ai-training-loading">
          <Loader2 size={18} className="spin" style={{ marginBottom: 8 }} />
          <div>{t('loading')}</div>
        </div>
      ) : items.length === 0 ? (
        <div className="ai-training-empty">
          <h3>{t('empty.title')}</h3>
          <p style={{ margin: 0 }}>{t('empty.body')}</p>
        </div>
      ) : (
        <div className="ai-training-grid">
          {items.map((crop, idx) => {
            const src = trainingImageSrc(crop.imageUrl, BASE_URL);
            const isActive = idx === activeIndex;
            return (
              <div
                key={String(crop.id)}
                className={`ai-training-card${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  setActiveIndex(idx);
                  labelRefs.current[crop.id]?.focus?.();
                }}
              >
                <div className="ai-training-card__media">
                  {src ? (
                    <img src={src} alt={crop.predictedText || 'crop'} referrerPolicy="no-referrer" />
                  ) : (
                    <span style={{ color: '#9CA3AF', fontSize: 12 }}>No image</span>
                  )}
                  <CropOverlay crop={crop} showBoxes={showBoxes} />
                </div>
                <div className="ai-training-card__body">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`ai-training-badge ai-training-badge--${crop.status}`}>
                      {crop.status}
                    </span>
                    {crop.mismatch ? (
                      <span className="ai-training-badge ai-training-badge--mismatch">mismatch</span>
                    ) : null}
                  </div>
                  <dl className="ai-training-meta">
                    <div>
                      <dt>{t('card.predicted')}</dt>
                      <dd>{crop.predictedText || '—'}</dd>
                    </div>
                    <div>
                      <dt>{t('card.confidence')}</dt>
                      <dd>{pct(crop.confidence)}</dd>
                    </div>
                    <div>
                      <dt>{t('card.reason')}</dt>
                      <dd>{t(`reason.${crop.reason}`) || crop.reason}</dd>
                    </div>
                    <div>
                      <dt>{t('card.plateDet')}</dt>
                      <dd>{pct(crop.plateDetConfidence)}</dd>
                    </div>
                  </dl>
                  <div style={{ fontSize: 12 }}>
                    {crop.aiOrderId ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${LIST_PATH}/orders/${crop.aiOrderId}`);
                        }}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          color: '#4F46E5', fontWeight: 700, cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        {t('card.order')} #{crop.aiOrderId}
                      </button>
                    ) : (
                      <span style={{ color: '#9CA3AF' }}>{t('card.noOrder')}</span>
                    )}
                  </div>
                  <div className="ai-training-label-row">
                    <input
                      ref={(el) => { labelRefs.current[crop.id] = el; }}
                      data-training-label="1"
                      value={labels[crop.id] ?? ''}
                      onChange={(e) => {
                        const v = normalizeTrainingLabel(e.target.value);
                        setLabels((prev) => ({ ...prev, [crop.id]: v }));
                      }}
                      onFocus={() => setActiveIndex(idx)}
                      placeholder={t('card.label')}
                      aria-label={t('card.label')}
                    />
                  </div>
                  <div className="ai-training-actions">
                    <button
                      type="button"
                      className="btn-verify"
                      disabled={busyId === String(crop.id)}
                      onClick={(e) => { e.stopPropagation(); handleVerify(crop); }}
                    >
                      {busyId === String(crop.id) ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                      {' '}{t('card.verify')}
                    </button>
                    <button
                      type="button"
                      className="btn-reject"
                      disabled={busyId === String(crop.id)}
                      onClick={(e) => { e.stopPropagation(); handleReject(crop); }}
                    >
                      <X size={12} /> {t('card.reject')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 ? (
        <div className="ai-training-paging">
          <span>{t('paging.of', { page, totalPages, total })}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => loadCrops(page - 1)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB',
                background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              <ChevronLeft size={14} /> {t('paging.prev')}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => loadCrops(page + 1)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB',
                background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              {t('paging.next')} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`ai-training-toast${toast.isError ? ' is-error' : ''}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
