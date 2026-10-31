import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Trash2, X,
} from 'lucide-react';
import { BASE_URL } from '../../../services/api';
import {
  exportVehicleDataset,
  getVehicleTrainingStats,
  listCameras,
  listVehicleTrainingFrames,
  reviewVehicleTrainingFrame,
} from '../../../services/aiCameraApi';

const STATUSES = ['pending', 'verified', 'rejected'];
const REASONS = ['low_conf', 'missed', 'track_loss'];

function imgSrc(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/${url}`;
}

function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return `${(v <= 1 ? v * 100 : v).toFixed(1)}%`;
}

// ─── Canvas box-drawing component ──────────────────────────────

function BoxCanvas({ imageUrl, imageWidth, imageHeight, boxes, onChange, predictedBoxes }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [drawing, setDrawing] = useState(null); // {startX, startY}
  const [hovered, setHovered] = useState(-1);

  const scale = useMemo(() => {
    if (!imageWidth || !imageHeight) return 1;
    const maxW = 900;
    const maxH = 600;
    return Math.min(1, maxW / imageWidth, maxH / imageHeight);
  }, [imageWidth, imageHeight]);

  const canvasW = Math.round((imageWidth || 640) * scale);
  const canvasH = Math.round((imageHeight || 480) * scale);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    // Pi predicted boxes (dashed green)
    if (predictedBoxes?.length) {
      ctx.strokeStyle = 'rgba(40, 180, 40, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      for (const b of predictedBoxes) {
        ctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
      }
      ctx.setLineDash([]);
    }

    // Human-drawn boxes (solid yellow)
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const isHover = i === hovered;
      ctx.strokeStyle = isHover ? '#EF4444' : '#FBBF24';
      ctx.lineWidth = isHover ? 3 : 2;
      ctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
      ctx.fillStyle = isHover ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.08)';
      ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
      // Label
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = isHover ? '#EF4444' : '#FBBF24';
      ctx.fillText(`vehicle #${i + 1}`, b.x * scale + 4, b.y * scale - 4);
    }

    // Active draw
    if (drawing) {
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(drawing.x * scale, drawing.y * scale, drawing.w * scale, drawing.h * scale);
      ctx.setLineDash([]);
    }
  }, [canvasW, canvasH, boxes, predictedBoxes, scale, loaded, drawing, hovered]);

  useEffect(() => { draw(); }, [draw]);

  const toImage = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    const { x, y } = toImage(e);
    setDrawing({ startX: x, startY: y, x, y, w: 0, h: 0 });
  };

  const onMouseMove = (e) => {
    if (!drawing) {
      // Hover detection for delete
      const { x, y } = toImage(e);
      let found = -1;
      for (let i = boxes.length - 1; i >= 0; i--) {
        const b = boxes[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { found = i; break; }
      }
      setHovered(found);
      return;
    }
    const { x, y } = toImage(e);
    setDrawing((prev) => ({
      ...prev,
      x: Math.min(prev.startX, x),
      y: Math.min(prev.startY, y),
      w: Math.abs(x - prev.startX),
      h: Math.abs(y - prev.startY),
    }));
  };

  const onMouseUp = () => {
    if (!drawing) return;
    const minSize = 20;
    if (drawing.w >= minSize && drawing.h >= minSize) {
      onChange([...boxes, {
        x: Math.round(drawing.x),
        y: Math.round(drawing.y),
        w: Math.round(drawing.w),
        h: Math.round(drawing.h),
      }]);
    }
    setDrawing(null);
  };

  const onContextMenu = (e) => {
    e.preventDefault();
    if (hovered >= 0) {
      onChange(boxes.filter((_, i) => i !== hovered));
      setHovered(-1);
    }
  };

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <img
        ref={imgRef}
        src={imgSrc(imageUrl)}
        crossOrigin="anonymous"
        style={{ display: 'none' }}
        onLoad={() => setLoaded(true)}
        alt=""
      />
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{ cursor: drawing ? 'crosshair' : hovered >= 0 ? 'pointer' : 'crosshair', border: '1px solid #374151', borderRadius: 8 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setDrawing(null); setHovered(-1); }}
        onContextMenu={onContextMenu}
      />
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
        Click + drag to draw a box · Right-click a box to delete · Green dashed = Pi prediction
      </div>
    </div>
  );
}

// ─── Main tab ──────────────────────────────────────────────────

export default function VehicleTrainingTab() {
  const [stats, setStats] = useState({ counts: { pending: 0, verified: 0, rejected: 0 }, total: 0 });
  const [cameras, setCameras] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast] = useState(null);

  const [status, setStatus] = useState('pending');
  const [cameraId, setCameraId] = useState('');
  const [reason, setReason] = useState('');

  // Per-frame drawn boxes: { [frameId]: [{x,y,w,h}] }
  const [drawnBoxes, setDrawnBoxes] = useState({});

  const toastTimer = useRef(null);
  const flash = useCallback((msg, isError = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: msg, isError });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await getVehicleTrainingStats()); } catch { /* keep last */ }
  }, []);

  const loadFrames = useCallback(async (nextPage = page) => {
    setLoading(true);
    try {
      const res = await listVehicleTrainingFrames({ status, cameraId, reason, page: nextPage, limit: 12 });
      setItems(res.items);
      setPage(res.page);
      setTotalPages(Math.max(1, res.totalPages));
      setTotal(res.total);
      setActiveIndex(0);
      const init = {};
      res.items.forEach((f) => {
        init[f.id] = f.labelBoxes || f.predictedBoxes || [];
      });
      setDrawnBoxes(init);
    } catch (err) {
      flash(err.message || 'Load failed', true);
      setItems([]);
    } finally { setLoading(false); }
  }, [page, status, cameraId, reason, flash]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cams = await listCameras();
        if (!cancelled) setCameras(Array.isArray(cams) ? cams : []);
      } catch { if (!cancelled) setCameras([]); }
    })();
    loadStats();
    return () => { cancelled = true; };
  }, [loadStats]);

  useEffect(() => { loadFrames(1); }, [status, cameraId, reason]);

  const activeFrame = items[activeIndex] || null;
  const activeBoxes = activeFrame ? (drawnBoxes[activeFrame.id] || []) : [];

  const handleBoxChange = useCallback((frameId, newBoxes) => {
    setDrawnBoxes((prev) => ({ ...prev, [frameId]: newBoxes }));
  }, []);

  const handleVerify = useCallback(async (frame) => {
    if (!frame || busyId) return;
    const boxes = drawnBoxes[frame.id] || [];
    if (!boxes.length) { flash('Draw at least one vehicle box before verifying', true); return; }
    setBusyId(frame.id);
    try {
      await reviewVehicleTrainingFrame(frame.id, { status: 'verified', labelBoxes: boxes });
      flash('Verified ✓');
      setItems((prev) => prev.filter((f) => f.id !== frame.id));
      setTotal((n) => Math.max(0, n - 1));
      loadStats();
      if (items.length <= 1) loadFrames(page);
    } catch (err) { flash(err.message || 'Error', true); }
    finally { setBusyId(''); }
  }, [busyId, drawnBoxes, flash, items.length, loadFrames, loadStats, page]);

  const handleReject = useCallback(async (frame) => {
    if (!frame || busyId) return;
    setBusyId(frame.id);
    try {
      await reviewVehicleTrainingFrame(frame.id, { status: 'rejected' });
      flash('Rejected');
      setItems((prev) => prev.filter((f) => f.id !== frame.id));
      setTotal((n) => Math.max(0, n - 1));
      loadStats();
      if (items.length <= 1) loadFrames(page);
    } catch (err) { flash(err.message || 'Error', true); }
    finally { setBusyId(''); }
  }, [busyId, flash, items.length, loadFrames, loadStats, page]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'Enter' && activeFrame) { e.preventDefault(); handleVerify(activeFrame); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); handleReject(activeFrame); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setActiveIndex((i) => Math.min(items.length - 1, i + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeFrame, handleVerify, handleReject, items.length]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportVehicleDataset({ status: 'verified' });
      flash('Download started');
    } catch (err) { flash(err.message || 'Export failed', true); }
    finally { setExporting(false); }
  };

  return (
    <div className="ai-training-tab">
      {/* Stats */}
      <div className="ai-training-stats">
        {STATUSES.map((key) => (
          <button
            key={key}
            type="button"
            className="ai-training-stat"
            onClick={() => setStatus(key)}
            style={{ cursor: 'pointer', outline: status === key ? '2px solid #6366F1' : 'none', textAlign: 'left' }}
          >
            <div className="ai-training-stat__label" style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</div>
            <div className="ai-training-stat__value">{stats.counts?.[key] ?? 0}</div>
          </button>
        ))}
        <div className="ai-training-stat">
          <div className="ai-training-stat__label">Total</div>
          <div className="ai-training-stat__value">{stats.total}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="ai-training-filters">
        <div className="form-group">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Camera</label>
          <select value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
            <option value="">All</option>
            {cameras.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.name || c.deviceId || c.id}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">All</option>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button
          type="button" className="btn-secondary" onClick={() => loadFrames(1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          <RefreshCw size={14} /> Apply
        </button>
      </div>

      {/* Toolbar */}
      <div className="ai-training-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
        <button
          type="button" onClick={handleExport} disabled={exporting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 8, background: '#111827', color: '#fff', fontWeight: 700, fontSize: 12, cursor: exporting ? 'wait' : 'pointer' }}
        >
          {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          Export YOLO ZIP
        </button>
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          Single class: <strong>vehicle</strong> · Enter = verify · R = reject · ← → move
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 8, background: toast.isError ? '#FEE2E2' : '#D1FAE5', color: toast.isError ? '#991B1B' : '#065F46', fontWeight: 600, fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          {toast.message}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading…</div>}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No frames to review</div>
          <div>When the Pi uploads vehicle frames, they appear here for box annotation.</div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Main canvas */}
          <div style={{ flex: 1 }}>
            {activeFrame && (
              <>
                <BoxCanvas
                  imageUrl={activeFrame.imageUrl}
                  imageWidth={activeFrame.imageWidth}
                  imageHeight={activeFrame.imageHeight}
                  boxes={activeBoxes}
                  onChange={(newBoxes) => handleBoxChange(activeFrame.id, newBoxes)}
                  predictedBoxes={activeFrame.predictedBoxes}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => handleVerify(activeFrame)} disabled={!!busyId}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    <Check size={14} /> Verify ({activeBoxes.length} box{activeBoxes.length !== 1 ? 'es' : ''})
                  </button>
                  <button
                    onClick={() => handleReject(activeFrame)} disabled={!!busyId}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #EF4444', background: '#fff', color: '#EF4444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    <X size={14} /> Reject
                  </button>
                  <button
                    onClick={() => handleBoxChange(activeFrame.id, [])}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #9CA3AF', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    <Trash2 size={14} /> Clear boxes
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
                  Reason: <strong>{activeFrame.reason}</strong> · Camera: <strong>{activeFrame.deviceId}</strong> · {activeFrame.imageWidth}×{activeFrame.imageHeight}
                  {activeFrame.predictedBoxes?.length ? ` · Pi predicted ${activeFrame.predictedBoxes.length} box(es)` : ' · Pi detected 0 vehicles'}
                </div>
              </>
            )}
          </div>

          {/* Sidebar thumbnails */}
          <div style={{ width: 180, maxHeight: 650, overflowY: 'auto' }}>
            {items.map((frame, i) => (
              <div
                key={frame.id}
                onClick={() => setActiveIndex(i)}
                style={{
                  cursor: 'pointer', marginBottom: 8, borderRadius: 8, overflow: 'hidden',
                  border: i === activeIndex ? '3px solid #6366F1' : '2px solid transparent',
                  opacity: i === activeIndex ? 1 : 0.7,
                }}
              >
                <img
                  src={imgSrc(frame.imageUrl)}
                  crossOrigin="anonymous"
                  alt={`Frame ${frame.id}`}
                  style={{ width: '100%', display: 'block' }}
                />
                <div style={{ padding: '4px 6px', background: '#F3F4F6', fontSize: 10, color: '#374151' }}>
                  {frame.reason} · {(drawnBoxes[frame.id] || []).length} boxes
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => loadFrames(Math.max(1, page - 1))} disabled={page <= 1}
            style={{ background: 'none', border: 'none', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.3 : 1 }}
          ><ChevronLeft size={18} /></button>
          <span style={{ fontSize: 12, color: '#6B7280' }}>Page {page} of {totalPages} · {total} frames</span>
          <button
            onClick={() => loadFrames(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
            style={{ background: 'none', border: 'none', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.3 : 1 }}
          ><ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  );
}
