import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useMatch, useParams, useLocation } from 'react-router-dom';
import {
  Camera, Plus, Search, Edit2, Trash2,
  Video, Radio, Car, ChevronRight, RefreshCw, Building, Layers, Loader2,
  BarChart3, AlertTriangle, Clock, Pencil, Check, X, Download, FileText, Sheet,
  Play, Square, Terminal, ChevronDown, ChevronUp, ImagePlus, Images,
} from 'lucide-react';
import ApprovalPageShell from '../../components/admin/ApprovalPageShell';
import { startVisiblePolling } from '../../utils/visiblePolling';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import '../../components/SearchableEntityCombobox.css';
import '../../styles/admin/ApprovalsPage.css';
import {
  listCameras, createCamera, updateCamera, deleteCamera, getCamera,
  listAiOrders, getAiOrder, matchAiOrder,
  listStaffVehicles, createStaffVehicle, updateStaffVehicle, deleteStaffVehicle,
  getAiCameraReportSummary,
  listUnmatchedPosOrders,
  correctPlateNumber,
  getMatchSuggestions,
  deleteAiOrder,
  startCameraCapture,
  stopCameraCapture,
  getCameraCaptureLogs,
} from '../../services/aiCameraApi';
import { BASE_URL } from '../../services/api';
import {
  getWorkshopOptions,
  getBranches,
  getDepartments,
} from '../../services/superAdminApi';
import { toPosCompactPlate } from '../../utils/formatPlate';
import TrainingDataTab from './ai-camera/TrainingDataTab';
import VehicleTrainingTab from './ai-camera/VehicleTrainingTab';
import AiCameraSettingsTab from './ai-camera/AiCameraSettingsTab';
import './AiCameraPage.css';
import { openInvoicePdfInNewTab } from '../../utils/posInvoiceActions';

function displayAiPlate(orderOrPlate) {
  if (!orderOrPlate) return '';
  if (typeof orderOrPlate === 'string') {
    return toPosCompactPlate(orderOrPlate) || orderOrPlate;
  }
  const raw = orderOrPlate.plateNumber || '';
  return toPosCompactPlate(raw) || raw;
}

function snapshotSrc(url) {
  if (!url) return '';
  return url.startsWith('/') ? `${BASE_URL}${url}` : url;
}

function fileToJpegBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxW = 1400;
      const scale = Math.min(1, maxW / Math.max(1, img.width));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process image'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1] || '');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image'));
    };
    img.src = objectUrl;
  });
}

function SnapshotCard({ url, title, subtitle, large }) {
  if (!url) return null;
  const src = snapshotSrc(url);
  if (large) {
    return (
      <a
        className="ai-order__shot"
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the full camera frame"
      >
        <img src={src} alt={title || 'Full camera'} referrerPolicy="no-referrer" />
      </a>
    );
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in new tab"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #E5E7EB',
        background: '#fff',
        minWidth: 0,
        flex: 1,
        cursor: 'zoom-in',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          background: '#111827',
          minHeight: 168,
          maxHeight: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={src}
          alt={title}
          referrerPolicy="no-referrer"
          style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }}
        />
      </div>
      <div style={{ padding: '8px 12px', background: '#F8F9FA' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 10, color: '#6C757D', marginTop: 2 }}>{subtitle}</div>
        ) : null}
      </div>
    </a>
  );
}

function OrderSnapshotGallery({ order, compact, large }) {
  const full = order?.wideSnapshotUrl || order?.snapshotUrl;
  if (!full) return null;
  if (large) {
    return <SnapshotCard url={full} title="Full camera" large />;
  }
  if (compact) {
    return (
      <img
        src={snapshotSrc(full)}
        alt="Full camera"
        referrerPolicy="no-referrer"
        style={{
          width: 56, height: 40, objectFit: 'cover',
          borderRadius: 6, border: '1px solid #E5E7EB',
        }}
        loading="lazy"
      />
    );
  }
  return (
    <div style={{ flex: '1 1 280px', minWidth: 240, maxWidth: 520 }}>
      <SnapshotCard
        url={full}
        title="Full camera"
        subtitle="Whole camera frame · click to open"
      />
    </div>
  );
}

const LIST_PATH = '/admin/ai-camera';

const STATUS_COLORS = {
  VEHICLE_ENTERED: { bg: '#FFF3CD', color: '#856404', label: 'Vehicle Entered' },
  CONFIRMED: { bg: '#D4EDDA', color: '#155724', label: 'Confirmed' },
  MATCHED: { bg: '#CCE5FF', color: '#004085', label: 'Matched' },
  UNMATCHED: { bg: '#F8D7DA', color: '#721C24', label: 'Unmatched' },
  EXPIRED: { bg: '#E2E3E5', color: '#383D41', label: 'Expired' },
};

const JOB_MATCH_COLORS = {
  PENDING: { bg: '#E2E3E5', color: '#383D41', label: 'Pending' },
  MATCHED: { bg: '#D4EDDA', color: '#155724', label: 'Matched' },
  PARTIALLY_MATCHED: { bg: '#FFF3CD', color: '#856404', label: 'Partial' },
  UNMATCHED: { bg: '#F8D7DA', color: '#721C24', label: 'Unmatched' },
};

const CAPTURE_STATUS = {
  IDLE: { bg: '#F3F4F6', color: '#6B7280', label: 'Idle' },
  STARTING: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Starting…' },
  RUNNING: { bg: '#DCFCE7', color: '#166534', label: 'Capturing' },
  STOPPING: { bg: '#FEF3C7', color: '#92400E', label: 'Stopping…' },
  ERROR: { bg: '#FEE2E2', color: '#B91C1C', label: 'Error' },
  OFFLINE: { bg: '#FFEDD5', color: '#C2410C', label: 'Pi offline' },
};

const TABS = [
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'orders', label: 'AI Orders', icon: Car },
  { id: 'unmatched-pos', label: 'Unmatched POS', icon: AlertTriangle },
  { id: 'staff-vehicles', label: 'Staff Vehicles', icon: Radio },
  { id: 'training', label: 'Training Data', icon: Images },
  { id: 'vehicle-training', label: 'Vehicle Training', icon: Car },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Timings', icon: Clock },
];

function InfoCell({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  );
}

const REPORT_PAGE_SIZE = 10;

function ReportPager({ page, total, totalPages, onPage }) {
  const pages = Math.max(1, totalPages || Math.ceil((total || 0) / REPORT_PAGE_SIZE) || 1);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', fontSize: 12, color: '#6C757D' }}>
      <span>{total || 0} rows</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 700 }}
        >
          Prev
        </button>
        <span>Page {Math.min(page, pages)} of {pages}</span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: page >= pages ? 'default' : 'pointer', fontWeight: 700 }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function pageSlice(items, page) {
  const start = (Math.max(1, page) - 1) * REPORT_PAGE_SIZE;
  return (items || []).slice(start, start + REPORT_PAGE_SIZE);
}

function Th({ children }) {
  return <th className="ai-cam-th">{children}</th>;
}

function Td({ children, mono }) {
  return <td className={`ai-cam-td${mono ? ' ai-cam-td--mono' : ''}`}>{children}</td>;
}

function formatWhen(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

// ────────────────────────────────────────────────────────────────
// Camera create / edit (full page — no modal)
// ────────────────────────────────────────────────────────────────
function roundZone(value) {
  return Math.round(value * 10) / 10;
}

function DetectionZoneBox({ imageUrl, x, y, w, h, onChange }) {
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const nx = Number(x);
  const ny = Number(y);
  const nw = Number(w);
  const nh = Number(h);
  const visible = Number.isFinite(nx) && Number.isFinite(ny) && nw > 1 && nh > 1;

  const pointFromEvent = (event) => {
    const rect = frameRef.current.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * 100;
    const py = ((event.clientY - rect.top) / rect.height) * 100;
    return {
      x: roundZone(Math.min(100, Math.max(0, px))),
      y: roundZone(Math.min(100, Math.max(0, py))),
    };
  };

  const boxFromPoints = (start, end) => ({
    x: roundZone(Math.min(start.x, end.x)),
    y: roundZone(Math.min(start.y, end.y)),
    w: roundZone(Math.abs(end.x - start.x)),
    h: roundZone(Math.abs(end.y - start.y)),
  });

  const onPointerDown = (event) => {
    if (!imageUrl || !frameRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = pointFromEvent(event);
    dragRef.current = start;
    onChange(boxFromPoints(start, start));
  };

  const onPointerMove = (event) => {
    if (!dragRef.current || !frameRef.current) return;
    onChange(boxFromPoints(dragRef.current, pointFromEvent(event)));
  };

  const onPointerUp = (event) => {
    if (!dragRef.current || !frameRef.current) return;
    const next = boxFromPoints(dragRef.current, pointFromEvent(event));
    dragRef.current = null;
    if (next.w < 2 || next.h < 2) {
      onChange(null);
      return;
    }
    onChange(next);
  };

  if (!imageUrl) {
    return (
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6C757D' }}>
        Upload a full-frame photo from this camera above, then drag a box on it.
        Until then you can type the percentages below.
      </p>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 720,
          cursor: 'crosshair',
          touchAction: 'none',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid #E5E7EB',
          background: '#111',
        }}
      >
        <img
          src={imageUrl}
          alt="Camera view for the detection zone"
          draggable={false}
          style={{ width: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
        />
        {visible ? (
          <div
            style={{
              position: 'absolute',
              left: `${nx}%`,
              top: `${ny}%`,
              width: `${nw}%`,
              height: `${nh}%`,
              border: '2px solid #16a34a',
              background: 'rgba(22, 163, 74, 0.18)',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          >
            <span style={{
              position: 'absolute',
              left: 6,
              top: 4,
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}>
              Detect here
            </span>
          </div>
        ) : null}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6C757D' }}>
        Drag on the photo. A click that is too small clears the box.
      </p>
    </div>
  );
}

function CameraFormScreen({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    workshopId: '',
    branchId: '',
    name: '',
    cameraType: 'ENTRANCE',
    departmentId: '',
    streamUrl: '',
    deviceId: '',
    isActive: true,
    dzLevel: '',
    dzCenterX: '',
    dzCenterY: '',
    cropX: '',
    cropY: '',
    cropW: '',
    cropH: '',
    cardImageUrl: '',
  });
  const [cardImagePreview, setCardImagePreview] = useState('');
  const [cardImageRemoved, setCardImageRemoved] = useState(false);
  const [cardImageFile, setCardImageFile] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [workshops, setWorkshops] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const [workshopDisplay, setWorkshopDisplay] = useState('');
  const [branchDisplay, setBranchDisplay] = useState('');
  const [typeDisplay, setTypeDisplay] = useState('');

  const typeKey = form.cameraType === 'ENTRANCE'
    ? 'ENTRANCE'
    : form.departmentId
      ? `DEPT:${form.departmentId}`
      : '';

  const workshopOptions = useMemo(
    () => workshops.map((w) => ({ id: String(w.id), label: w.name || `Workshop ${w.id}` })),
    [workshops],
  );
  const branchOptions = useMemo(
    () => branches.map((b) => ({ id: String(b.id), label: b.name || `Branch ${b.id}` })),
    [branches],
  );
  const typeOptions = useMemo(() => {
    const opts = [{ id: 'ENTRANCE', label: 'Entrance' }];
    departments.forEach((d) => {
      opts.push({ id: `DEPT:${d.id}`, label: d.name || `Department ${d.id}` });
    });
    return opts;
  }, [departments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingWorkshops(true);
      try {
        const res = await getWorkshopOptions();
        const list = Array.isArray(res?.workshops)
          ? res.workshops
          : Array.isArray(res?.data?.workshops)
            ? res.data.workshops
            : Array.isArray(res)
              ? res
              : [];
        if (!cancelled) {
          setWorkshops(list.map((w) => ({
            id: String(w.id),
            name: String(w.name || '').trim() || 'Workshop',
          })));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load workshops');
      } finally {
        if (!cancelled) setLoadingWorkshops(false);
      }
    })();

    (async () => {
      setLoadingDepartments(true);
      try {
        const res = await getDepartments();
        const list = Array.isArray(res?.departments)
          ? res.departments
          : Array.isArray(res)
            ? res
            : [];
        if (!cancelled) {
          setDepartments(
            list
              .filter((d) => d && d.isActive !== false)
              .map((d) => ({
                id: String(d.id),
                name: String(d.name || '').trim() || `Department ${d.id}`,
              })),
          );
        }
      } catch {
        if (!cancelled) setDepartments([]);
      } finally {
        if (!cancelled) setLoadingDepartments(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!form.workshopId) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingBranches(true);
      try {
        const res = await getBranches({ workshopId: form.workshopId });
        const list = Array.isArray(res?.branches)
          ? res.branches
          : Array.isArray(res?.data?.branches)
            ? res.data.branches
            : Array.isArray(res)
              ? res
              : [];
        if (!cancelled) {
          setBranches(list.map((b) => ({
            id: String(b.id),
            name: String(b.name || '').trim() || 'Branch',
          })));
        }
      } catch {
        if (!cancelled) setBranches([]);
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => { cancelled = true; };
  }, [form.workshopId]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const cam = await getCamera(id);
        if (cancelled) return;
        setForm({
          workshopId: String(cam.workshopId ?? ''),
          branchId: String(cam.branchId ?? ''),
          name: cam.name || '',
          cameraType: cam.cameraType || 'ENTRANCE',
          departmentId: cam.departmentId != null ? String(cam.departmentId) : '',
          streamUrl: cam.streamUrl || '',
          deviceId: cam.deviceId || '',
          isActive: cam.isActive ?? true,
          dzLevel: cam.digitalZoom?.level ?? '',
          dzCenterX: cam.digitalZoom?.centerX ?? '',
          dzCenterY: cam.digitalZoom?.centerY ?? '',
          cropX: cam.cropRegion?.x ?? '',
          cropY: cam.cropRegion?.y ?? '',
          cropW: cam.cropRegion?.w ?? '',
          cropH: cam.cropRegion?.h ?? '',
          cardImageUrl: cam.cardImageUrl || '',
        });
        setCardImagePreview(cam.cardImageUrl ? snapshotSrc(cam.cardImageUrl) : '');
        setCardImageRemoved(false);
        setCardImageFile(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load camera');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, id]);

  const handleTypeSelect = (opt) => {
    const key = String(opt?.id || '');
    setTypeDisplay('');
    if (key === 'ENTRANCE') {
      setForm((f) => ({ ...f, cameraType: 'ENTRANCE', departmentId: '' }));
      return;
    }
    if (key.startsWith('DEPT:')) {
      setForm((f) => ({
        ...f,
        cameraType: 'SERVICE_BAY',
        departmentId: key.slice(5),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.workshopId) {
      setError('Please select a workshop');
      return;
    }
    if (!form.branchId) {
      setError('Please select a branch');
      return;
    }
    if (!form.name.trim()) {
      setError('Camera name is required');
      return;
    }
    if (form.cameraType === 'SERVICE_BAY' && !form.departmentId) {
      setError('Please select a department for service-bay cameras');
      return;
    }
    if ((form.dzCenterX !== '' || form.dzCenterY !== '') && !form.dzLevel) {
      setError('Digital zoom needs Zoom Level (1–6). Center X/Y alone does not zoom the snapshot.');
      return;
    }
    const cropAny = form.cropX !== '' || form.cropY !== '' || form.cropW !== '' || form.cropH !== '';
    if (cropAny && (!form.cropW || !form.cropH)) {
      setError('Detection zone needs Width % and Height % as well as X/Y. X/Y is the top-left of the box.');
      return;
    }

    const digitalZoom = form.dzLevel
      ? { level: Number(form.dzLevel), centerX: Number(form.dzCenterX) || 50, centerY: Number(form.dzCenterY) || 50 }
      : null;
    const cropRegion = cropAny
      ? { x: Number(form.cropX) || 0, y: Number(form.cropY) || 0, w: Number(form.cropW) || 100, h: Number(form.cropH) || 100 }
      : null;

    const payload = {
      workshopId: form.workshopId,
      branchId: form.branchId,
      name: form.name.trim(),
      cameraType: form.cameraType,
      departmentId: form.cameraType === 'SERVICE_BAY' ? form.departmentId : undefined,
      streamUrl: form.streamUrl || undefined,
      deviceId: form.deviceId || undefined,
      isActive: form.isActive,
      digitalZoom,
      cropRegion,
    };

    setSaving(true);
    try {
      let cardImageBase64;
      if (cardImageFile) {
        cardImageBase64 = await fileToJpegBase64(cardImageFile);
      }
      const imageFields = cardImageBase64
        ? { cardImageBase64 }
        : cardImageRemoved
          ? { cardImageUrl: null }
          : {};
      if (isEdit) {
        await updateCamera(id, {
          name: payload.name,
          cameraType: payload.cameraType,
          departmentId: payload.departmentId,
          streamUrl: payload.streamUrl,
          deviceId: payload.deviceId,
          isActive: payload.isActive,
          digitalZoom: payload.digitalZoom,
          cropRegion: payload.cropRegion,
          ...imageFields,
        });
      } else {
        await createCamera({ ...payload, ...imageFields });
      }
      navigate(LIST_PATH);
    } catch (err) {
      setError(err.message || 'Failed to save camera');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ApprovalPageShell title={isEdit ? 'Edit Camera' : 'Add Camera'} onBack={() => navigate(LIST_PATH)}>
        <div style={{ padding: 40, textAlign: 'center', color: '#6C757D' }}>
          <Loader2 size={20} className="spin" /> Loading…
        </div>
      </ApprovalPageShell>
    );
  }

  return (
    <ApprovalPageShell
      title={isEdit ? 'Edit Camera' : 'Add Camera'}
      onBack={() => navigate(LIST_PATH)}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={() => navigate(LIST_PATH)} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="ai-camera-form" className="btn-submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Camera'}
          </button>
        </>
      )}
    >
      <form id="ai-camera-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
        {error ? (
          <div style={{ padding: 12, background: '#FEF2F2', color: '#991B1B', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Workshop *</label>
            <SearchableEntityCombobox
              options={workshopOptions}
              value={form.workshopId}
              displayText={workshopDisplay}
              onDisplayTextChange={setWorkshopDisplay}
              onSelect={(opt) => {
                setForm((f) => ({ ...f, workshopId: String(opt?.id || ''), branchId: '' }));
                setWorkshopDisplay('');
                setBranchDisplay('');
              }}
              placeholder="Search workshop…"
              entityLabel="workshop"
              loading={loadingWorkshops}
              menuMinWidth={260}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Branch *</label>
            <SearchableEntityCombobox
              options={branchOptions}
              value={form.branchId}
              displayText={branchDisplay}
              onDisplayTextChange={setBranchDisplay}
              onSelect={(opt) => {
                setForm((f) => ({ ...f, branchId: String(opt?.id || '') }));
                setBranchDisplay('');
              }}
              placeholder={form.workshopId ? 'Search branch…' : 'Select workshop first'}
              entityLabel="branch"
              loading={loadingBranches}
              disabled={!form.workshopId}
              menuMinWidth={260}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Camera Name *</label>
          <input
            className="form-input-field"
            placeholder="e.g. Gate A Entrance Camera"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Type *</label>
          <SearchableEntityCombobox
            options={typeOptions}
            value={typeKey}
            displayText={typeDisplay}
            onDisplayTextChange={setTypeDisplay}
            onSelect={handleTypeSelect}
            placeholder="Entrance or search department…"
            entityLabel="type"
            loading={loadingDepartments}
            menuMinWidth={280}
            emptyHint="No departments found"
          />
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6C757D' }}>
            Choose <strong>Entrance</strong> for gate cameras, or a <strong>department</strong> for service-bay cameras.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Device ID (Pi camera-id)</label>
          <input
            className="form-input-field"
            placeholder="e.g. PI-001-CAM-A"
            value={form.deviceId}
            onChange={(e) => setForm((f) => ({ ...f, deviceId: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Stream URL</label>
          <input
            className="form-input-field"
            placeholder="rtsp://admin:pass@192.168.1.10:554/stream1"
            value={form.streamUrl}
            onChange={(e) => setForm((f) => ({ ...f, streamUrl: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Bay / entrance photo (optional)</label>
          <p style={{ margin: '2px 0 8px', fontSize: 11, color: '#6C757D' }}>
            Shown as the darkened cover on the camera card so you can tell which bay it is at a glance.
          </p>
          {cardImagePreview ? (
            <div
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #E5E7EB',
                marginBottom: 10,
                height: 140,
                background: `#111 url(${cardImagePreview}) center/cover no-repeat`,
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(15,23,42,0.28) 0%, rgba(15,23,42,0.72) 100%)',
              }} />
              <div style={{
                position: 'relative', zIndex: 1, height: '100%',
                display: 'flex', alignItems: 'flex-end', padding: 12, color: '#fff',
                fontSize: 12, fontWeight: 700, textShadow: '0 1px 8px rgba(0,0,0,0.5)',
              }}>
                Card preview
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8,
                background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}
            >
              <ImagePlus size={14} />
              {cardImagePreview ? 'Change photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (file.size > 8 * 1024 * 1024) {
                    setError('Photo must be under 8 MB');
                    return;
                  }
                  setCardImageFile(file);
                  setCardImageRemoved(false);
                  setCardImagePreview(URL.createObjectURL(file));
                }}
              />
            </label>
            {cardImagePreview ? (
              <button
                type="button"
                onClick={() => {
                  setCardImageFile(null);
                  setCardImagePreview('');
                  setCardImageRemoved(true);
                }}
                style={{
                  padding: '8px 12px', border: '1px solid #FECDD3', borderRadius: 8,
                  background: '#FFF5F5', color: '#DC2626', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        {/* ── Zoom / Crop Settings ── */}
        <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 8, paddingTop: 14 }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: 13 }}>
            Digital Zoom (ISAPI) — optional, PTZ cameras only
          </label>
          <p style={{ margin: '2px 0 8px', fontSize: 11, color: '#6C757D' }}>
            Tells a Hikvision PTZ camera to zoom. Fixed bay cameras usually ignore this, so the Admin snapshot stays wide.
            Origin is the <strong>centre of the plate</strong>. X = 0 left / 100 right. Y = 0 top / 100 bottom.
            Zoom Level is required or nothing is sent to the camera.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Zoom Level (1-6)</label>
              <input
                className="form-input-field"
                type="number" min="0" max="6" step="1"
                placeholder="e.g. 2"
                value={form.dzLevel}
                onChange={(e) => setForm((f) => ({ ...f, dzLevel: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Center X %</label>
              <input
                className="form-input-field"
                type="number" min="0" max="100"
                placeholder="50"
                value={form.dzCenterX}
                onChange={(e) => setForm((f) => ({ ...f, dzCenterX: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Center Y %</label>
              <input
                className="form-input-field"
                type="number" min="0" max="100"
                placeholder="50"
                value={form.dzCenterY}
                onChange={(e) => setForm((f) => ({ ...f, dzCenterY: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 8, paddingTop: 14 }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: 13 }}>
            Detection zone
          </label>
          <p style={{ margin: '2px 0 8px', fontSize: 11, color: '#6C757D' }}>
            Available on every camera. Drag a box around the part of this camera
            that should count. A car is read only when the centre of its box is
            inside. Cars outside are ignored. The photo saved on the AI order stays
            the whole camera frame. Leave the box empty to detect across the whole
            picture. Use a photo of the full camera view, then save. The camera
            restarts with the new box.
          </p>
          <DetectionZoneBox
            imageUrl={cardImagePreview}
            x={form.cropX}
            y={form.cropY}
            w={form.cropW}
            h={form.cropH}
            onChange={(zone) => setForm((f) => ({
              ...f,
              cropX: zone ? String(zone.x) : '',
              cropY: zone ? String(zone.y) : '',
              cropW: zone ? String(zone.w) : '',
              cropH: zone ? String(zone.h) : '',
            }))}
          />
          {(form.cropW || form.cropH) ? (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, cropX: '', cropY: '', cropW: '', cropH: '' }))}
              style={{
                marginBottom: 8,
                padding: '6px 10px',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                background: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Clear zone
            </button>
          ) : null}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 80 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>X %</label>
              <input
                className="form-input-field"
                type="number" min="0" max="100" step="any"
                placeholder="0"
                value={form.cropX}
                onChange={(e) => setForm((f) => ({ ...f, cropX: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Y %</label>
              <input
                className="form-input-field"
                type="number" min="0" max="100" step="any"
                placeholder="0"
                value={form.cropY}
                onChange={(e) => setForm((f) => ({ ...f, cropY: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Width %</label>
              <input
                className="form-input-field"
                type="number" min="0" max="100" step="any"
                placeholder="100"
                value={form.cropW}
                onChange={(e) => setForm((f) => ({ ...f, cropW: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Height %</label>
              <input
                className="form-input-field"
                type="number" min="0" max="100" step="any"
                placeholder="100"
                value={form.cropH}
                onChange={(e) => setForm((f) => ({ ...f, cropH: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Active</span>
        </label>
      </form>
    </ApprovalPageShell>
  );
}

// ────────────────────────────────────────────────────────────────
// Staff vehicle create (full page)
// ────────────────────────────────────────────────────────────────
function StaffVehicleFormScreen() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ workshopId: '', plateNumber: '', staffName: '' });
  const [workshopDisplay, setWorkshopDisplay] = useState('');
  const [workshops, setWorkshops] = useState([]);
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingWorkshops(true);
      try {
        const res = await getWorkshopOptions();
        const list = Array.isArray(res?.workshops)
          ? res.workshops
          : Array.isArray(res?.data?.workshops)
            ? res.data.workshops
            : Array.isArray(res)
              ? res
              : [];
        if (!cancelled) {
          setWorkshops(list.map((w) => ({
            id: String(w.id),
            label: String(w.name || '').trim() || `Workshop ${w.id}`,
          })));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load workshops');
      } finally {
        if (!cancelled) setLoadingWorkshops(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.workshopId) {
      setError('Please select a workshop');
      return;
    }
    if (!form.plateNumber.trim()) {
      setError('Plate number is required');
      return;
    }
    setSaving(true);
    try {
      await createStaffVehicle({
        workshopId: form.workshopId,
        plateNumber: form.plateNumber.trim(),
        staffName: form.staffName.trim() || undefined,
      });
      navigate(`${LIST_PATH}?tab=staff-vehicles`);
    } catch (err) {
      setError(err.message || 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ApprovalPageShell
      title="Add Staff Vehicle"
      onBack={() => navigate(`${LIST_PATH}?tab=staff-vehicles`)}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={() => navigate(`${LIST_PATH}?tab=staff-vehicles`)} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="staff-vehicle-form" className="btn-submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Vehicle'}
          </button>
        </>
      )}
    >
      <form id="staff-vehicle-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        {error ? (
          <div style={{ padding: 12, background: '#FEF2F2', color: '#991B1B', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
        <div className="form-group">
          <label className="form-label">Workshop *</label>
          <SearchableEntityCombobox
            options={workshops}
            value={form.workshopId}
            displayText={workshopDisplay}
            onDisplayTextChange={setWorkshopDisplay}
            onSelect={(opt) => {
              setForm((f) => ({ ...f, workshopId: String(opt?.id || '') }));
              setWorkshopDisplay('');
            }}
            placeholder="Search workshop…"
            entityLabel="workshop"
            loading={loadingWorkshops}
            menuMinWidth={260}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Plate Number *</label>
          <input
            className="form-input-field"
            placeholder="e.g. ABC1234"
            value={form.plateNumber}
            onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Staff Name</label>
          <input
            className="form-input-field"
            placeholder="e.g. Ahmed"
            value={form.staffName}
            onChange={(e) => setForm((f) => ({ ...f, staffName: e.target.value }))}
          />
        </div>
      </form>
    </ApprovalPageShell>
  );
}

// ────────────────────────────────────────────────────────────────
// Order detail (full page)
// ────────────────────────────────────────────────────────────────
function OrderDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const backTab = location.state?.backTab || 'orders';
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPlate, setEditingPlate] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [savingPlate, setSavingPlate] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [matching, setMatching] = useState(null); // salesOrderId being matched
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getAiOrder(orderId);
        if (!cancelled) setOrder(res);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <ApprovalPageShell title="AI Order Detail" onBack={() => navigate(`${LIST_PATH}?tab=${backTab}`)}>
        <div style={{ padding: 40, textAlign: 'center', color: '#6C757D' }}>Loading…</div>
      </ApprovalPageShell>
    );
  }

  if (error || !order) {
    return (
      <ApprovalPageShell title="AI Order Detail" onBack={() => navigate(`${LIST_PATH}?tab=${backTab}`)}>
        <div style={{ padding: 16, background: '#FEF2F2', color: '#991B1B', borderRadius: 8 }}>{error || 'Not found'}</div>
      </ApprovalPageShell>
    );
  }

  const st = STATUS_COLORS[order.status] || STATUS_COLORS.VEHICLE_ENTERED;
  const bayEvents = order.serviceBayEvents || [];

  // First detection is the camera that actually saw the car first.
  // Missed-entrance rows copy the bay timestamp onto entranceDetectedAt, so
  // do not treat a synthetic entrance card as first detection.
  const firstDetAt = order.firstDetectedAt ? new Date(order.firstDetectedAt).getTime() : null;
  const entranceAt = order.entranceDetectedAt ? new Date(order.entranceDetectedAt).getTime() : null;
  const firstCamId = String(order.firstDetectedCameraId || order.firstDetectedCamera?.id || '');
  const entranceCamId = String(order.entranceCameraId || order.entranceCamera?.id || '');
  const hasRealEntrance = Boolean(entranceCamId);
  const entranceIsFirst = hasRealEntrance && (
    firstCamId
      ? firstCamId === entranceCamId
      : !!(firstDetAt && entranceAt && Math.abs(firstDetAt - entranceAt) < 2000)
  );

  // Visit timeline: entrance first, then bay events in order
  let bayFirstTagged = false;
  const timeline = [
    {
      key: 'entrance',
      kind: 'ENTRANCE',
      title: 'Vehicle Entered',
      subtitle: order.entranceCamera?.name || (order.entranceCameraId ? 'Entrance camera' : 'No entrance camera (missed)'),
      at: hasRealEntrance ? order.entranceDetectedAt : null,
      isFirstDetection: !!entranceIsFirst,
      meta: hasRealEntrance && order.confidence
        ? `${(Number(order.confidence) * 100).toFixed(1)}% confidence`
        : null,
    },
    ...bayEvents.map((ev, i) => {
      const evTime = new Date(ev.detectedAt).getTime();
      const evCamId = String(ev.cameraId || ev.camera?.id || '');
      let isBayFirst = false;
      if (!entranceIsFirst && !bayFirstTagged) {
        if (firstCamId && evCamId && evCamId === firstCamId) {
          isBayFirst = true;
        } else if (!firstCamId && firstDetAt && Math.abs(evTime - firstDetAt) < 2000) {
          isBayFirst = true;
        } else if (!hasRealEntrance && i === 0) {
          isBayFirst = true;
        }
        if (isBayFirst) bayFirstTagged = true;
      }
      return {
        key: `bay-${ev.id || i}`,
        kind: 'SERVICE_BAY',
        title: ev.department?.name || `Department ${ev.departmentId}`,
        subtitle: ev.camera?.name || 'Service bay camera',
        at: ev.detectedAt,
        isFirstDetection: !!isBayFirst,
        meta: ev.confidence
          ? `${(Number(ev.confidence) * 100).toFixed(1)}% confidence`
          : null,
        completedAt: ev.completedAt,
        autoCompleted: ev.autoCompleted,
        jobMatchStatus: ev.jobMatchStatus,
        departmentId: ev.departmentId || ev.department?.id,
        linkedJob: ev.linkedJob,
        snapshotUrl: ev.snapshotUrl,
        wideSnapshotUrl: ev.wideSnapshotUrl,
      };
    }),
  ];

  const jobMatch = JOB_MATCH_COLORS[order.jobMatchStatus] || JOB_MATCH_COLORS.PENDING;

  return (
    <ApprovalPageShell title="" onBack={() => navigate(`${LIST_PATH}?tab=${backTab}`)}>
      <div className="ai-order__hero">
        <div className="ai-order__photo">
          {order.wideSnapshotUrl || order.snapshotUrl ? (
            <OrderSnapshotGallery order={order} large />
          ) : (
            <div className="ai-order__shot ai-order__shot--empty">No camera photo</div>
          )}
        </div>
        <div className="ai-order__identity">
          <div className="ai-order__kicker">{order.captureNo}</div>
          {editingPlate ? (
            <div className="ai-order__plate-row">
              <div className="ai-order__plate-edit">
                <input
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                  autoFocus
                />
                <button
                  type="button"
                  className="ai-cam-btn ai-cam-btn--go"
                  disabled={savingPlate || !newPlate.trim()}
                  onClick={async () => {
                    setSavingPlate(true);
                    try {
                      await correctPlateNumber(orderId, newPlate.trim());
                      const res = await getAiOrder(orderId);
                      setOrder(res);
                      setEditingPlate(false);
                    } catch (e) {
                      setError(e.message || 'Failed to correct plate');
                    } finally {
                      setSavingPlate(false);
                    }
                  }}
                  title="Save"
                >
                  {savingPlate ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  Save
                </button>
                <button type="button" className="ai-cam-btn" onClick={() => setEditingPlate(false)} title="Cancel">
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="ai-order__plate-row">
              <div className="ai-order__plate">{displayAiPlate(order)}</div>
              <button
                type="button"
                className="ai-cam-btn ai-order__edit"
                onClick={() => { setNewPlate(displayAiPlate(order)); setEditingPlate(true); }}
                title="Correct plate number"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
          <div className="ai-order__badges">
            <span className="ai-order__pill" style={{ background: st.bg, color: st.color }}>{st.label}</span>
            <span className="ai-order__pill" style={{ background: jobMatch.bg, color: jobMatch.color }}>Job {jobMatch.label}</span>
            {order.isCompanyVehicle ? (
              <span className="ai-order__pill" style={{ background: '#FFECB3', color: '#8D6E00' }}>Staff vehicle</span>
            ) : null}
          </div>
          <dl className="ai-order__sheet">
            <div>
              <dt>Branch</dt>
              <dd>{order.branch?.name || '-'}</dd>
            </div>
            <div>
              <dt>Entrance</dt>
              <dd>{order.entranceCamera?.name || '-'}</dd>
            </div>
            <div>
              <dt>First detected</dt>
              <dd>
                <span className="ai-order__when-line">{formatWhen(order.firstDetectedAt || order.entranceDetectedAt)}</span>
                {order.firstDetectedCamera?.name ? (
                  <span className="ai-order__meta">{order.firstDetectedCamera.name}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Last seen</dt>
              <dd>
                <span className="ai-order__when-line">{formatWhen(order.lastSeenAt)}</span>
                {order.lastSeenCamera?.name ? (
                  <span className="ai-order__meta">{order.lastSeenCamera.name}</span>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <dl className="ai-order__stats">
        <div className="ai-order__stat">
          <dt>First bay</dt>
          <dd>{formatWhen(order.firstServiceBayAt)}</dd>
        </div>
        <div className="ai-order__stat">
          <dt>Bay visits</dt>
          <dd>{bayEvents.length}</dd>
        </div>
        <div className="ai-order__stat">
          <dt>Customer</dt>
          <dd>{order.linkedSalesOrder?.customer?.name || '-'}</dd>
        </div>
        <div className="ai-order__stat">
          <dt>POS order</dt>
          <dd>{order.linkedSalesOrder?.id || order.cashierOrderId || '-'}</dd>
        </div>
        <div className="ai-order__stat">
          <dt>Invoice</dt>
          <dd>
            {order.linkedSalesOrder?.invoice?.invoiceNo ? (
              <button
                type="button"
                className="ai-order__link"
                title="Open invoice PDF in a new tab"
                onClick={() => {
                  openInvoicePdfInNewTab({
                    invoiceId: order.linkedSalesOrder.invoice.id,
                    invoiceNo: order.linkedSalesOrder.invoice.invoiceNo,
                    workshopId: order.workshopId || order.workshop?.id,
                  }).catch((err) => {
                    setError(err.message || 'Could not open invoice');
                  });
                }}
              >
                {order.linkedSalesOrder.invoice.invoiceNo}
              </button>
            ) : '-'}
          </dd>
        </div>
        <div className="ai-order__stat">
          <dt>Matched</dt>
          <dd>{formatWhen(order.matchedAt)}</dd>
        </div>
      </dl>

      <section className="ai-order__section">
        <h3>Visit timeline</h3>
        <div className="ai-order__timeline">
          {timeline.map((step) => {
            const isBay = step.kind === 'SERVICE_BAY';
            const photo = step.wideSnapshotUrl || step.snapshotUrl;
            const deptId = step.departmentId;
            const deptJobs = (order.linkedSalesOrder?.jobs || []).filter((j) => (
              j.status !== 'cancelled'
              && deptId
              && String(j.department?.id) === String(deptId)
            ));
            const statusKey = step.linkedJob || deptJobs.length
              ? 'MATCHED'
              : (step.jobMatchStatus || 'PENDING');
            const jm = JOB_MATCH_COLORS[statusKey] || JOB_MATCH_COLORS.PENDING;
            const techs = [
              ...(step.linkedJob?.jobAssignments || []).map((a) => a.assignedToEmployee?.name),
              ...(!step.linkedJob ? deptJobs.flatMap((j) => j.technicians || []).map((t) => t.name) : []),
            ].filter(Boolean);
            const techNames = [...new Set(techs)].join(', ');
            const finished = step.completedAt
              ? new Date(step.completedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <article key={step.key} className="ai-order__step">
                {photo ? (
                  <a className="ai-order__thumb" href={snapshotSrc(photo)} target="_blank" rel="noopener noreferrer">
                    <img src={snapshotSrc(photo)} alt="" referrerPolicy="no-referrer" />
                  </a>
                ) : (
                  <div className="ai-order__thumb ai-order__thumb--empty">No photo</div>
                )}
                <div className="ai-order__step-main">
                  <div className="ai-order__step-top">
                    <span className="ai-order__step-kind" style={{ color: isBay ? '#C2410C' : '#166534' }}>
                      {isBay ? 'Service bay' : 'Entrance'}
                    </span>
                    {step.isFirstDetection ? <span className="ai-order__flag">First seen here</span> : null}
                    {step.at ? <span className="ai-order__when">{formatWhen(step.at)}</span> : null}
                  </div>
                  <div className="ai-order__step-title">{step.title}</div>
                  <div className="ai-order__step-sub">
                    {step.subtitle}
                    {step.meta ? ` · ${step.meta}` : ''}
                  </div>
                  {isBay ? (
                    <dl className="ai-order__step-facts">
                      <div>
                        <dt>Job</dt>
                        <dd style={{ color: jm.color }}>{jm.label}</dd>
                      </div>
                      {finished ? (
                        <div>
                          <dt>Job completed at</dt>
                          <dd>{finished}{step.autoCompleted ? ' · invoice closed it' : ''}</dd>
                        </div>
                      ) : null}
                      {techNames ? (
                        <div>
                          <dt>Technician</dt>
                          <dd>{techNames}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {bayEvents.length === 0 ? (
          <p className="ai-order__note">
            No service bay detections yet. When a service-bay camera sees this plate, status becomes Confirmed and the bay appears here.
          </p>
        ) : null}
      </section>

      {/* ── Fuzzy Match Suggestions ── */}
      {order.status !== 'MATCHED' && (
        <section className="ai-order__section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>POS match suggestions</h3>
            <button
              type="button"
              className="ai-cam-btn"
              disabled={loadingSuggestions}
              onClick={async () => {
                setLoadingSuggestions(true);
                try {
                  const res = await getMatchSuggestions(orderId);
                  setSuggestions(res);
                } catch (e) {
                  setError(e.message || 'Failed to load suggestions');
                } finally {
                  setLoadingSuggestions(false);
                }
              }}
            >
              {loadingSuggestions ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
              {suggestions ? 'Refresh' : 'Find similar POS orders'}
            </button>
          </div>

          {suggestions && (
            (suggestions.suggestions || []).length === 0 ? (
              <div style={{
                padding: 20, background: '#F9FAFB', borderRadius: 12, textAlign: 'center',
                color: '#6C757D', fontSize: 13,
              }}>
                No POS orders with similar plates found for this date range.
              </div>
            ) : (
              <div className="ai-cam-table-wrap">
                <table className="ai-cam-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
                      <Th>POS PLATE</Th>
                      <Th>SIMILARITY</Th>
                      <Th>CUSTOMER</Th>
                      <Th>INVOICE</Th>
                      <Th>DATE</Th>
                      <Th>ACTION</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(suggestions.suggestions || []).map((s) => {
                      const pct = s.similarityPercent;
                      const pctColor = pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
                      const pctBg = pct >= 80 ? '#F0FDF4' : pct >= 50 ? '#FFFBEB' : '#FEF2F2';
                      return (
                        <tr key={s.salesOrder.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <Td>
                            <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 14 }}>
                              {s.posPlate}
                            </span>
                            {s.salesOrder.vehicle?.make || s.salesOrder.vehicle?.model ? (
                              <span style={{ marginLeft: 6, fontSize: 11, color: '#6C757D' }}>
                                {[s.salesOrder.vehicle.make, s.salesOrder.vehicle.model].filter(Boolean).join(' ')}
                              </span>
                            ) : null}
                          </Td>
                          <Td>
                            <span style={{
                              background: pctBg, color: pctColor,
                              padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800,
                            }}>
                              {pct}%
                            </span>
                          </Td>
                          <Td>{s.salesOrder.customer?.name || '-'}</Td>
                          <Td mono>{s.salesOrder.invoice?.invoiceNo || '-'}</Td>
                          <Td>{s.salesOrder.createdAt ? new Date(s.salesOrder.createdAt).toLocaleString() : '-'}</Td>
                          <Td>
                            {s.alreadyMatched ? (
                              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>Already linked</span>
                            ) : (
                              <button
                                type="button"
                                className="ai-cam-btn ai-cam-btn--primary"
                                disabled={matching === s.salesOrder.id}
                                onClick={async () => {
                                  if (!window.confirm(`Match this AI Order (${displayAiPlate(order)}) with POS plate ${s.posPlate} (${pct}% similar)?`)) return;
                                  setMatching(s.salesOrder.id);
                                  try {
                                    await matchAiOrder(orderId, s.salesOrder.id);
                                    const res = await getAiOrder(orderId);
                                    setOrder(res);
                                    setSuggestions(null);
                                  } catch (e) {
                                    setError(e.message || 'Match failed');
                                  } finally {
                                    setMatching(null);
                                  }
                                }}
                              >
                                {matching === s.salesOrder.id ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                                Match
                              </button>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      )}

      <div className="ai-order__actions">
        <button
          type="button"
          className="ai-cam-btn ai-cam-btn--danger"
          disabled={deleting}
          onClick={async () => {
            if (!window.confirm(`Delete AI Order ${order.captureNo}? This action cannot be undone.`)) return;
            setDeleting(true);
            try {
              await deleteAiOrder(orderId);
              navigate(`${LIST_PATH}?tab=orders`);
            } catch (e) {
              setError(e.message || 'Delete failed');
              setDeleting(false);
            }
          }}
        >
          <Trash2 size={14} />
          {deleting ? 'Deleting…' : 'Delete AI order'}
        </button>
      </div>
    </ApprovalPageShell>
  );
}

// ────────────────────────────────────────────────────────────────
// Export helpers
// ────────────────────────────────────────────────────────────────
function exportOrdersToCSV(orders) {
  const headers = ['Capture No', 'Plate', 'Status', 'Job Status', 'Branch', 'First Detected', 'First Detected Camera', 'Last Seen', 'Last Seen Camera', 'Bays', 'Staff Vehicle'];
  const rows = (orders || []).map((o) => [
    o.captureNo || '',
    displayAiPlate(o),
    o.status || '',
    o.jobMatchStatus || 'PENDING',
    o.branch?.name || '',
    o.firstDetectedAt ? new Date(o.firstDetectedAt).toLocaleString() : (o.entranceDetectedAt ? new Date(o.entranceDetectedAt).toLocaleString() : ''),
    o.firstDetectedCamera?.name || o.entranceCamera?.name || '',
    o.lastSeenAt ? new Date(o.lastSeenAt).toLocaleString() : '',
    o.lastSeenCamera?.name || '',
    String(o.serviceBayEvents?.length ?? 0),
    o.isCompanyVehicle ? 'Yes' : 'No',
  ]);
  const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportOrdersToPDF(orders) {
  const headers = ['Capture No', 'Plate', 'Status', 'Job Status', 'Branch', 'First Detected', 'First Camera', 'Last Seen', 'Last Camera', 'Bays', 'Staff'];
  const rows = (orders || []).map((o) => [
    o.captureNo || '',
    displayAiPlate(o),
    o.status || '',
    o.jobMatchStatus || 'PENDING',
    o.branch?.name || '',
    o.firstDetectedAt ? new Date(o.firstDetectedAt).toLocaleString() : (o.entranceDetectedAt ? new Date(o.entranceDetectedAt).toLocaleString() : ''),
    o.firstDetectedCamera?.name || o.entranceCamera?.name || '',
    o.lastSeenAt ? new Date(o.lastSeenAt).toLocaleString() : '',
    o.lastSeenCamera?.name || '',
    String(o.serviceBayEvents?.length ?? 0),
    o.isCompanyVehicle ? 'Yes' : 'No',
  ]);

  const printWin = window.open('', '_blank');
  if (!printWin) return;
  const tableRows = rows.map((r) =>
    `<tr>${r.map((c) => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:12px;">${c}</td>`).join('')}</tr>`
  ).join('');
  printWin.document.write(`
    <!DOCTYPE html><html><head><title>AI Orders Export</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      p { font-size: 12px; color: #666; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; }
      th { border: 1px solid #333; padding: 8px 10px; font-size: 11px; text-transform: uppercase;
           font-weight: 800; background: #f5f5f5; text-align: left; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>AI Camera — Orders Report</h1>
    <p>Exported: ${new Date().toLocaleString()} &nbsp;|&nbsp; Total: ${rows.length} orders</p>
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    </body></html>
  `);
  printWin.document.close();
  setTimeout(() => printWin.print(), 400);
}

function WorkshopBranchFilter({
  workshops,
  workshopId,
  workshopDisplay,
  onWorkshopDisplayChange,
  onWorkshopChange,
  branches,
  branchesLoading,
  branchId,
  branchDisplay,
  onBranchDisplayChange,
  onBranchChange,
}) {
  return (
    <>
      <div className="ai-cam-field">
        <label className="form-label">Workshop</label>
        <SearchableEntityCombobox
          options={[{ id: '', label: 'All workshops' }, ...workshops]}
          value={workshopId}
          displayText={workshopDisplay}
          onDisplayTextChange={onWorkshopDisplayChange}
          onSelect={(opt) => onWorkshopChange(String(opt?.id || ''))}
          placeholder="All workshops…"
          entityLabel="workshop"
          menuMinWidth={260}
        />
      </div>
      <div className="ai-cam-field">
        <label className="form-label">Branch</label>
        <SearchableEntityCombobox
          options={workshopId ? [{ id: '', label: 'All branches' }, ...branches] : []}
          value={branchId}
          displayText={branchDisplay}
          onDisplayTextChange={onBranchDisplayChange}
          onSelect={(opt) => onBranchChange(String(opt?.id || ''))}
          placeholder={workshopId ? 'All branches…' : 'Select workshop first'}
          entityLabel="branch"
          loading={branchesLoading}
          disabled={!workshopId}
          menuMinWidth={260}
        />
      </div>
    </>
  );
}

function branchOptionsFromResponse(res) {
  const list = Array.isArray(res?.branches)
    ? res.branches
    : Array.isArray(res?.data?.branches)
      ? res.data.branches
      : Array.isArray(res)
        ? res
        : [];
  return list.map((b) => ({
    id: String(b.id),
    label: String(b.name || '').trim() || `Branch ${b.id}`,
  }));
}

// ────────────────────────────────────────────────────────────────
// List screen
// ────────────────────────────────────────────────────────────────
function AiCameraListScreen() {
  const navigate = useNavigate();
  const initialTab = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    return TABS.some((t) => t.id === q) ? q : 'cameras';
  }, []);

  const [tab, setTab] = useState(initialTab);
  const [cameras, setCameras] = useState([]);
  const [orders, setOrders] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [staffVehicles, setStaffVehicles] = useState([]);
  const [staffWorkshopId, setStaffWorkshopId] = useState('');
  const [staffWorkshops, setStaffWorkshops] = useState([]);
  const [staffWorkshopDisplay, setStaffWorkshopDisplay] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderStatus, setOrderStatus] = useState('');
  const [companyFilter, setCompanyFilter] = useState(''); // '' | 'true' | 'false'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orderWorkshopId, setOrderWorkshopId] = useState('');
  const [orderWorkshopDisplay, setOrderWorkshopDisplay] = useState('');
  const [orderBranchId, setOrderBranchId] = useState('');
  const [orderBranchDisplay, setOrderBranchDisplay] = useState('');
  const [orderBranches, setOrderBranches] = useState([]);
  const [orderBranchesLoading, setOrderBranchesLoading] = useState(false);
  const [ordersFilterHint, setOrdersFilterHint] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [cameraFilter, setCameraFilter] = useState('');
  const [filterDepartments, setFilterDepartments] = useState([]);
  const [filterCameras, setFilterCameras] = useState([]);
  const [unmatchedPos, setUnmatchedPos] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [unmatchedPosPage, setUnmatchedPosPage] = useState(1);
  const [unmatchedPosSearch, setUnmatchedPosSearch] = useState('');
  const [unmatchedWorkshopId, setUnmatchedWorkshopId] = useState('');
  const [unmatchedWorkshopDisplay, setUnmatchedWorkshopDisplay] = useState('');
  const [unmatchedBranchId, setUnmatchedBranchId] = useState('');
  const [unmatchedBranchDisplay, setUnmatchedBranchDisplay] = useState('');
  const [unmatchedBranches, setUnmatchedBranches] = useState([]);
  const [unmatchedBranchesLoading, setUnmatchedBranchesLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [reportWorkshopId, setReportWorkshopId] = useState('');
  const [reportWorkshopDisplay, setReportWorkshopDisplay] = useState('');
  const [reportBranchId, setReportBranchId] = useState('');
  const [reportBranchDisplay, setReportBranchDisplay] = useState('');
  const [reportBranches, setReportBranches] = useState([]);
  const [reportBranchesLoading, setReportBranchesLoading] = useState(false);
  const [reportIncludeCompany, setReportIncludeCompany] = useState(true);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportKpi, setReportKpi] = useState(null);
  const [reportEvidencePage, setReportEvidencePage] = useState(1);
  const [reportEvidence, setReportEvidence] = useState(null);
  const [reportEvidenceLoading, setReportEvidenceLoading] = useState(false);
  const [branchPage, setBranchPage] = useState(1);
  const [dayPage, setDayPage] = useState(1);
  const [staffPage, setStaffPage] = useState(1);

  const loadCameras = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listCameras();
      setCameras(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e.message || 'Failed to load cameras');
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listAiOrders({
        page: orderPage,
        limit: 20,
        status: orderStatus,
        search: searchQ,
        isCompanyVehicle: companyFilter || undefined,
        from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
        departmentId: departmentFilter || undefined,
        cameraId: cameraFilter || undefined,
        workshopId: orderWorkshopId || undefined,
        branchId: orderBranchId || undefined,
      });
      if (Array.isArray(res)) {
        setOrders({ data: res, total: res.length, page: 1, totalPages: 1 });
      } else if (res && Array.isArray(res.data)) {
        setOrders(res);
      } else {
        setOrders({ data: [], total: 0, page: 1, totalPages: 1 });
      }
    } catch (e) {
      setError(e.message || 'Failed to load orders');
      setOrders({ data: [], total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [orderPage, orderStatus, searchQ, companyFilter, dateFrom, dateTo, departmentFilter, cameraFilter, orderWorkshopId, orderBranchId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAiCameraReportSummary({
        workshopId: reportWorkshopId || undefined,
        branchId: reportBranchId || undefined,
        includeCompanyVehicles: reportIncludeCompany,
        from: reportFrom ? new Date(reportFrom).toISOString() : undefined,
        to: reportTo ? new Date(`${reportTo}T23:59:59`).toISOString() : undefined,
      });
      setReport(res || null);
    } catch (e) {
      setError(e.message || 'Failed to load report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [reportWorkshopId, reportBranchId, reportIncludeCompany, reportFrom, reportTo]);

  const loadUnmatchedPos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listUnmatchedPosOrders({
        page: unmatchedPosPage,
        limit: 20,
        search: unmatchedPosSearch || undefined,
        workshopId: unmatchedWorkshopId || undefined,
        branchId: unmatchedBranchId || undefined,
        from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      });
      if (Array.isArray(res)) {
        setUnmatchedPos({ data: res, total: res.length, page: 1, totalPages: 1 });
      } else if (res && Array.isArray(res.data)) {
        setUnmatchedPos(res);
      } else {
        setUnmatchedPos({ data: [], total: 0, page: 1, totalPages: 1 });
      }
    } catch (e) {
      setError(e.message || 'Failed to load unmatched POS orders');
      setUnmatchedPos({ data: [], total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [unmatchedPosPage, unmatchedPosSearch, unmatchedWorkshopId, unmatchedBranchId, dateFrom, dateTo]);

  const loadStaffVehicles = useCallback(async () => {
    if (!staffWorkshopId) {
      setStaffVehicles([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await listStaffVehicles(staffWorkshopId);
      setStaffVehicles(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e.message || 'Failed to load staff vehicles');
      setStaffVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [staffWorkshopId]);

  useEffect(() => {
    if (tab === 'cameras') loadCameras();
    if (tab === 'orders') loadOrders();
    if (tab === 'unmatched-pos') loadUnmatchedPos();
    if (tab === 'staff-vehicles') loadStaffVehicles();
    if (tab === 'reports') loadReport();
  }, [tab, loadCameras, loadOrders, loadUnmatchedPos, loadStaffVehicles, loadReport]);

  // Refresh capture status while viewing cameras (Pi agent heartbeats)
  useEffect(() => {
    if (tab !== 'cameras') return undefined;
    return startVisiblePolling(() => {
      listCameras()
        .then((res) => setCameras(Array.isArray(res) ? res : []))
        .catch(() => {});
    }, 8000);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'staff-vehicles' && tab !== 'reports' && tab !== 'orders' && tab !== 'unmatched-pos') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getWorkshopOptions();
        const list = Array.isArray(res?.workshops)
          ? res.workshops
          : Array.isArray(res?.data?.workshops)
            ? res.data.workshops
            : Array.isArray(res)
              ? res
              : [];
        if (!cancelled) {
          setStaffWorkshops(list.map((w) => ({
            id: String(w.id),
            label: String(w.name || '').trim() || `Workshop ${w.id}`,
          })));
        }
      } catch {
        if (!cancelled) setStaffWorkshops([]);
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    async function load(workshopId, setList, setLoading) {
      if (!workshopId) {
        setList([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await getBranches({ workshopId });
        if (!cancelled) setList(branchOptionsFromResponse(res));
      } catch {
        if (!cancelled) setList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load(orderWorkshopId, setOrderBranches, setOrderBranchesLoading);
    load(unmatchedWorkshopId, setUnmatchedBranches, setUnmatchedBranchesLoading);
    load(reportWorkshopId, setReportBranches, setReportBranchesLoading);
    return () => { cancelled = true; };
  }, [orderWorkshopId, unmatchedWorkshopId, reportWorkshopId]);

  // Load departments + cameras for filter dropdowns on orders tab
  useEffect(() => {
    if (tab !== 'orders') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getDepartments();
        const list = Array.isArray(res?.departments) ? res.departments : Array.isArray(res) ? res : [];
        if (!cancelled) setFilterDepartments(list.filter((d) => d && d.isActive !== false));
      } catch {
        if (!cancelled) setFilterDepartments([]);
      }
    })();
    (async () => {
      try {
        const cams = await listCameras();
        if (!cancelled) setFilterCameras(Array.isArray(cams) ? cams : []);
      } catch {
        if (!cancelled) setFilterCameras([]);
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  const [captureBusyId, setCaptureBusyId] = useState('');
  const [logsOpenId, setLogsOpenId] = useState('');
  const [cameraLogs, setCameraLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadCameraLogs = useCallback(async (camId) => {
    if (!camId) return;
    setLogsLoading(true);
    try {
      const res = await getCameraCaptureLogs(String(camId), 100);
      setCameraLogs(Array.isArray(res) ? res : []);
    } catch {
      setCameraLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const handleToggleLogs = (cam) => {
    const id = String(cam.id);
    if (logsOpenId === id) {
      setLogsOpenId('');
      setCameraLogs([]);
      return;
    }
    setLogsOpenId(id);
    loadCameraLogs(id);
  };

  // Poll open camera logs while capturing
  useEffect(() => {
    if (tab !== 'cameras' || !logsOpenId) return undefined;
    return startVisiblePolling(() => {
      loadCameraLogs(logsOpenId);
    }, 4000);
  }, [tab, logsOpenId, loadCameraLogs]);

  const handleDeleteCamera = async (camId) => {
    if (!window.confirm('Delete this camera?')) return;
    try {
      await deleteCamera(String(camId));
      loadCameras();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const handleToggleCapture = async (cam) => {
    const id = String(cam.id);
    const wantStart = String(cam.captureDesired || 'IDLE').toUpperCase() !== 'RUNNING';
    if (wantStart && (!cam.streamUrl || !cam.deviceId)) {
      setError('Set RTSP stream URL and Device ID on the camera before starting capture.');
      return;
    }
    setCaptureBusyId(id);
    setError('');
    try {
      if (wantStart) await startCameraCapture(id);
      else await stopCameraCapture(id);
      await loadCameras();
    } catch (e) {
      setError(e.message || (wantStart ? 'Failed to start capture' : 'Failed to stop capture'));
    } finally {
      setCaptureBusyId('');
    }
  };

  const handleDeleteStaffVehicle = async (svId) => {
    if (!window.confirm('Remove this staff vehicle?')) return;
    try {
      await deleteStaffVehicle(String(svId));
      loadStaffVehicles();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const handleToggleStaffActive = async (sv) => {
    try {
      await updateStaffVehicle(String(sv.id), { isActive: !sv.isActive });
      loadStaffVehicles();
    } catch (e) {
      setError(e.message || 'Update failed');
    }
  };

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const close = () => setExportOpen(false);
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', close); };
  }, [exportOpen]);

  const reportWindowYmd = () => ({
    from: reportFrom || '',
    to: reportTo || '',
  });

  const openKpiEvidence = (card) => {
    if (reportKpi?.label === card.label) {
      setReportKpi(null);
      setReportEvidence(null);
      return;
    }
    setReportEvidencePage(1);
    setStaffPage(1);
    setReportKpi(card);
  };

  useEffect(() => {
    if (tab !== 'reports' || !reportKpi) return undefined;
    let cancelled = false;
    (async () => {
      setReportEvidenceLoading(true);
      try {
        if (reportKpi.targetTab === 'staff-vehicles') {
          if (!reportWorkshopId) {
            if (!cancelled) setReportEvidence({ kind: 'staff', needsWorkshop: true, data: [] });
            return;
          }
          const res = await listStaffVehicles(reportWorkshopId);
          if (!cancelled) {
            setReportEvidence({ kind: 'staff', data: Array.isArray(res) ? res : [] });
          }
          return;
        }
        const { from, to } = reportWindowYmd();
        const res = await listAiOrders({
          page: reportEvidencePage,
          limit: 20,
          status: reportKpi.status || undefined,
          isCompanyVehicle: reportKpi.company || undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
          workshopId: reportWorkshopId || undefined,
          branchId: reportBranchId || undefined,
        });
        if (cancelled) return;
        if (Array.isArray(res)) {
          setReportEvidence({ kind: 'orders', data: res, total: res.length, page: 1, totalPages: 1 });
        } else if (res && Array.isArray(res.data)) {
          setReportEvidence({ kind: 'orders', ...res });
        } else {
          setReportEvidence({ kind: 'orders', data: [], total: 0, page: 1, totalPages: 1 });
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load results');
      } finally {
        if (!cancelled) setReportEvidenceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, reportKpi, reportEvidencePage, reportWorkshopId, reportBranchId, reportFrom, reportTo, reportIncludeCompany]);

  useEffect(() => {
    setBranchPage(1);
    setDayPage(1);
  }, [reportWorkshopId, reportBranchId, reportFrom, reportTo, reportIncludeCompany]);

  const refresh = () => {
    if (tab === 'cameras') loadCameras();
    if (tab === 'orders') loadOrders();
    if (tab === 'unmatched-pos') loadUnmatchedPos();
    if (tab === 'staff-vehicles') loadStaffVehicles();
    if (tab === 'reports') loadReport();
  };

  return (
    <div className="module-container ai-cam-page">
      <div className="ai-cam-head">
        <div>
          <h2>AI Camera System</h2>
          <p>Manage cameras, view vehicle detections & AI orders</p>
        </div>
        <div className="ai-cam-head__actions">
          <button type="button" className="ai-cam-btn" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </button>
          {tab === 'cameras' ? (
            <button type="button" className="ai-cam-btn ai-cam-btn--primary" onClick={() => navigate(`${LIST_PATH}/new`)}>
              <Plus size={16} /> Add Camera
            </button>
          ) : null}
          {tab === 'staff-vehicles' ? (
            <button type="button" className="ai-cam-btn ai-cam-btn--primary" onClick={() => navigate(`${LIST_PATH}/staff-vehicles/new`)}>
              <Plus size={16} /> Add Vehicle
            </button>
          ) : null}
          {tab === 'orders' && (orders.data || []).length > 0 ? (
            <div style={{ position: 'relative' }}>
              <button type="button" className="ai-cam-btn" onClick={() => setExportOpen((v) => !v)}>
                <Download size={14} /> Export
              </button>
              {exportOpen && (
                <div className="ai-cam-menu">
                  <button type="button" onClick={() => { exportOrdersToPDF(orders.data); setExportOpen(false); }}>
                    <FileText size={15} color="#DC2626" /> Export as PDF
                  </button>
                  <div className="ai-cam-menu__rule" />
                  <button type="button" onClick={() => { exportOrdersToCSV(orders.data); setExportOpen(false); }}>
                    <Sheet size={15} color="#16A34A" /> Export as Excel (CSV)
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="ai-cam-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`ai-cam-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setSearchQ('');
              setError('');
              navigate(`${LIST_PATH}?tab=${t.id}`, { replace: true });
            }}
          >
            <t.icon size={15} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ padding: 12, background: '#FEF2F2', color: '#991B1B', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {tab === 'cameras' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading cameras…</div>
        ) : cameras.length === 0 ? (
          <div className="ai-cam-empty">
            <Camera size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No Cameras Yet</h3>
            <p style={{ color: '#6C757D', fontSize: 13, marginBottom: 16 }}>Add your first camera to start tracking vehicle entries.</p>
            <button
              type="button"
              onClick={() => navigate(`${LIST_PATH}/new`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: 'none', borderRadius: 8, background: '#FFD700', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              <Plus size={16} /> Add Camera
            </button>
          </div>
        ) : (
          <div className="ai-cam-grid">
            {cameras.map((cam) => {
              const coverSrc = cam.cardImageUrl ? snapshotSrc(cam.cardImageUrl) : '';
              const onCover = !!coverSrc;
              const typeColor = cam.cameraType === 'ENTRANCE'
                ? (onCover ? '#C8E6C9' : '#2E7D32')
                : (onCover ? '#FFCC80' : '#E65100');
              const muted = onCover ? 'rgba(255,255,255,0.88)' : '#6C757D';
              return (
              <div key={String(cam.id)} className="ai-cam-card">
                <div
                  style={{
                    position: 'relative',
                    padding: 20,
                    minHeight: onCover ? 168 : undefined,
                    background: onCover
                      ? `#1f2937 url(${coverSrc}) center/cover no-repeat`
                      : '#fff',
                    color: onCover ? '#fff' : '#111827',
                  }}
                >
                  {onCover ? (
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(180deg, rgba(15,23,42,0.38) 0%, rgba(15,23,42,0.78) 100%)',
                      }}
                    />
                  ) : null}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: cam.cameraType === 'ENTRANCE' ? '#E8F5E9' : '#FFF3E0',
                      boxShadow: onCover ? '0 1px 8px rgba(0,0,0,0.35)' : 'none',
                    }}>
                      {cam.cameraType === 'ENTRANCE'
                        ? <Video size={20} color="#2E7D32" />
                        : <Layers size={20} color="#E65100" />}
                    </div>
                    <div>
                      <h4 style={{
                        fontWeight: 700, fontSize: 14, margin: 0,
                        color: onCover ? '#fff' : '#111827',
                        textShadow: onCover ? '0 1px 10px rgba(0,0,0,0.45)' : 'none',
                      }}>{cam.name}</h4>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: typeColor,
                        textShadow: onCover ? '0 1px 8px rgba(0,0,0,0.45)' : 'none',
                      }}>
                        {cam.cameraType === 'ENTRANCE' ? 'Entrance' : (cam.department?.name || 'Service Bay')}
                      </span>
                    </div>
                  </div>
                  <span
                    title={cam.isActive ? 'Active' : 'Inactive'}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: cam.isActive ? '#4CAF50' : '#9E9E9E',
                      display: 'inline-block',
                      boxShadow: onCover ? '0 0 0 2px rgba(255,255,255,0.85)' : 'none',
                    }}
                  />
                </div>

                <div style={{ fontSize: 12, color: muted, marginBottom: 4, textShadow: onCover ? '0 1px 8px rgba(0,0,0,0.4)' : 'none' }}>
                  <Building size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Branch: <strong style={{ color: onCover ? '#fff' : '#374151' }}>{cam.branch?.name || cam.branchId}</strong>
                </div>
                {cam.deviceId ? (
                  <div style={{ fontSize: 12, color: muted, fontFamily: 'monospace', marginBottom: 4, textShadow: onCover ? '0 1px 8px rgba(0,0,0,0.4)' : 'none' }}>
                    Device: {cam.deviceId}
                  </div>
                ) : null}
                {(() => {
                  const st = CAPTURE_STATUS[cam.captureStatus] || CAPTURE_STATUS.IDLE;
                  const desiredOn = String(cam.captureDesired || 'IDLE').toUpperCase() === 'RUNNING';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 6,
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                      }}>
                        {st.label}
                      </span>
                      {desiredOn ? (
                        <span style={{ fontSize: 10, color: onCover ? 'rgba(255,255,255,0.8)' : '#6B7280' }}>Web: Start requested</span>
                      ) : null}
                      {cam.captureError ? (
                        <span style={{ fontSize: 11, color: onCover ? '#FECACA' : '#B91C1C' }} title={cam.captureError}>
                          {cam.captureError.slice(0, 60)}
                        </span>
                      ) : null}
                    </div>
                  );
                })()}
                  </div>
                </div>

                <div className="ai-cam-card__actions">
                  {(() => {
                    const desiredOn = String(cam.captureDesired || 'IDLE').toUpperCase() === 'RUNNING';
                    const busy = captureBusyId === String(cam.id);
                    return (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleCapture(cam)}
                        title={desiredOn ? 'Stop Pi capture for this camera' : 'Start Pi capture for this camera'}
                        className={`ai-cam-btn ${desiredOn ? 'ai-cam-btn--stop' : 'ai-cam-btn--go'}`}
                      >
                        {busy ? <Loader2 size={12} className="spin" /> : desiredOn ? <Square size={12} /> : <Play size={12} />}
                        {desiredOn ? 'Stop capture' : 'Start capture'}
                      </button>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => handleToggleLogs(cam)}
                    title="Show capture / detection logs from the Pi"
                    className={`ai-cam-btn ai-cam-btn--ghost${logsOpenId === String(cam.id) ? ' is-on' : ''}`}
                  >
                    <Terminal size={12} />
                    Logs
                    {logsOpenId === String(cam.id)
                      ? <ChevronUp size={12} />
                      : <ChevronDown size={12} />}
                  </button>
                  <button
                    type="button"
                    className="ai-cam-btn"
                    onClick={() => navigate(`${LIST_PATH}/${cam.id}/edit`)}
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    className="ai-cam-btn ai-cam-btn--danger"
                    onClick={() => handleDeleteCamera(cam.id)}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>

                {logsOpenId === String(cam.id) ? (
                  <div className="ai-cam-card__logs">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#9CA3AF' }}>
                      <span>Capture log (live)</span>
                      <button
                        type="button"
                        onClick={() => loadCameraLogs(String(cam.id))}
                        style={{
                          background: 'transparent', border: 'none', color: '#A5B4FC',
                          cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {logsLoading ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />}
                        Refresh
                      </button>
                    </div>
                    {logsLoading && !cameraLogs.length ? (
                      <div style={{ color: '#6B7280' }}>Loading…</div>
                    ) : !cameraLogs.length ? (
                      <div style={{ color: '#6B7280' }}>
                        No log lines yet. Start capture and wait for the Pi agent to upload detections.
                      </div>
                    ) : (
                      cameraLogs.map((line) => {
                        const lvl = String(line.level || 'INFO').toUpperCase();
                        const color =
                          lvl === 'ERROR' ? '#FCA5A5'
                            : lvl === 'WARN' ? '#FCD34D'
                              : '#86EFAC';
                        const ts = line.createdAt
                          ? new Date(line.createdAt).toLocaleTimeString()
                          : '';
                        return (
                          <div key={line.id} style={{ marginBottom: 4, wordBreak: 'break-word' }}>
                            <span style={{ color: '#6B7280' }}>{ts}</span>
                            {' '}
                            <span style={{ color, fontWeight: 700 }}>{lvl}</span>
                            {' '}
                            <span>{line.message}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            );
            })}
          </div>
        )
      )}

      {tab === 'orders' && (
        <>
          {ordersFilterHint ? (
            <div className="ai-cam-banner">
              <span>Report evidence: {ordersFilterHint}{dateFrom ? ` · ${dateFrom}` : ''}{dateTo ? ` → ${dateTo}` : ''}</span>
              <button
                type="button"
                onClick={() => {
                  setOrdersFilterHint('');
                  setOrderStatus('');
                  setCompanyFilter('');
                  setDateFrom('');
                  setDateTo('');
                  setOrderWorkshopId('');
                  setOrderWorkshopDisplay('');
                  setOrderBranchId('');
                  setOrderBranchDisplay('');
                  setOrderPage(1);
                }}
                style={{
                  border: 'none', background: '#fff', color: '#4338CA', cursor: 'pointer',
                  fontWeight: 800, fontSize: 12, padding: '4px 10px', borderRadius: 6,
                }}
              >
                Clear
              </button>
            </div>
          ) : null}
          <div className="ai-cam-toolbar">
            <WorkshopBranchFilter
              workshops={staffWorkshops}
              workshopId={orderWorkshopId}
              workshopDisplay={orderWorkshopDisplay}
              onWorkshopDisplayChange={setOrderWorkshopDisplay}
              onWorkshopChange={(id) => {
                setOrderWorkshopId(id);
                setOrderWorkshopDisplay('');
                setOrderBranchId('');
                setOrderBranchDisplay('');
                setCameraFilter('');
                setOrderPage(1);
              }}
              branches={orderBranches}
              branchesLoading={orderBranchesLoading}
              branchId={orderBranchId}
              branchDisplay={orderBranchDisplay}
              onBranchDisplayChange={setOrderBranchDisplay}
              onBranchChange={(id) => {
                setOrderBranchId(id);
                setOrderBranchDisplay('');
                setCameraFilter('');
                setOrderPage(1);
              }}
            />
            <label className="ai-cam-field ai-cam-field--search">
              <span>Search</span>
              <div className="ai-cam-search">
                <Search size={14} color="#9CA3AF" />
                <input
                  value={searchQ}
                  onChange={(e) => { setSearchQ(e.target.value); setOrderPage(1); }}
                  placeholder="Plate or capture number"
                />
              </div>
            </label>
            <label className="ai-cam-field">
              <span>Status</span>
            <select
              className="ai-cam-control"
              value={orderStatus}
              onChange={(e) => { setOrderStatus(e.target.value); setOrderPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="VEHICLE_ENTERED">Vehicle Entered</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="MATCHED">Matched</option>
              <option value="UNMATCHED">Unmatched</option>
              <option value="EXPIRED">Expired</option>
            </select>
            </label>
            <label className="ai-cam-field">
              <span>Vehicle</span>
            <select
              className="ai-cam-control"
              value={companyFilter}
              onChange={(e) => { setCompanyFilter(e.target.value); setOrderPage(1); }}
            >
              <option value="">All vehicles</option>
              <option value="true">Staff / company only</option>
              <option value="false">Customer only</option>
            </select>
            </label>
            <label className="ai-cam-field">
              <span>From</span>
              <input
                className="ai-cam-control"
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setOrderPage(1); }}
              />
            </label>
            <label className="ai-cam-field">
              <span>To</span>
              <input
                className="ai-cam-control"
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setOrderPage(1); }}
              />
            </label>
            {(dateFrom || dateTo) && (
              <div className="ai-cam-field">
                <span>Dates</span>
                <button
                  type="button"
                  className="ai-cam-clear"
                  onClick={() => { setDateFrom(''); setDateTo(''); setOrderPage(1); }}
                >
                  Clear dates
                </button>
              </div>
            )}
            {filterDepartments.length > 0 && (
              <label className="ai-cam-field">
                <span>Department</span>
              <select
                className="ai-cam-control"
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setOrderPage(1); }}
              >
                <option value="">All Departments</option>
                {filterDepartments.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name || `Dept ${d.id}`}</option>
                ))}
              </select>
              </label>
            )}
            {filterCameras.length > 0 && (
              <label className="ai-cam-field">
                <span>Camera</span>
              <select
                className="ai-cam-control"
                value={cameraFilter}
                onChange={(e) => { setCameraFilter(e.target.value); setOrderPage(1); }}
              >
                <option value="">All Cameras</option>
                {filterCameras
                  .filter((c) => {
                    if (orderWorkshopId && String(c.workshopId) !== String(orderWorkshopId)) return false;
                    if (orderBranchId && String(c.branchId) !== String(orderBranchId)) return false;
                    return true;
                  })
                  .slice()
                  .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                  .map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name || `Camera ${c.id}`}
                      {c.branch?.name ? ` · ${c.branch.name}` : ''}
                      {c.isActive === false ? ' (inactive)' : ''}
                    </option>
                  ))}
              </select>
              </label>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading orders…</div>
          ) : (orders.data || []).length === 0 ? (
            <div className="ai-cam-empty">
              <Car size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No AI Orders Yet</h3>
              <p style={{ color: '#6C757D', fontSize: 13 }}>
                AI Orders appear here when cameras detect vehicle plates.
              </p>
            </div>
          ) : (
            <>
              <div className="ai-cam-table-wrap">
                <table className="ai-cam-table">
                  <thead>
                    <tr>
                      <Th>SNAPSHOT</Th>
                      <Th>CAPTURE NO</Th>
                      <Th>PLATE</Th>
                      <Th>STATUS</Th>
                      <Th>JOB STATUS</Th>
                      <Th>BRANCH</Th>
                      <Th>FIRST DETECTED</Th>
                      <Th>LAST SEEN</Th>
                      <Th>BAYS</Th>
                      <Th>STAFF VEHICLE</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {(orders.data || []).map((order) => {
                      const st = STATUS_COLORS[order.status] || STATUS_COLORS.VEHICLE_ENTERED;
                      const bayCount = order.serviceBayEvents?.length ?? 0;
                      const isStaff = !!order.isCompanyVehicle;
                      return (
                        <tr
                          key={String(order.id)}
                          style={{
                            borderBottom: '1px solid #F5F5F5',
                            cursor: 'pointer',
                            background: isStaff ? '#FFF8E7' : undefined,
                          }}
                          onClick={() => navigate(`${LIST_PATH}/orders/${order.id}`)}
                        >
                          <Td>
                            {order.snapshotUrl || order.wideSnapshotUrl ? (
                              <OrderSnapshotGallery order={order} compact />
                            ) : (
                              <div style={{
                                width: 56, height: 40, background: '#F3F4F6',
                                borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Camera size={16} color="#9CA3AF" />
                              </div>
                            )}
                          </Td>
                          <Td mono>{order.captureNo}</Td>
                          <Td>
                            <span className="ai-cam-plate">
                              {displayAiPlate(order)}
                            </span>
                            {isStaff ? (
                              <span style={{
                                marginLeft: 8, background: '#FFECB3', color: '#8D6E00',
                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800,
                              }}
                              >
                                STAFF
                              </span>
                            ) : null}
                          </Td>
                          <Td>
                            <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                              {st.label}
                            </span>
                          </Td>
                          <Td>
                            {(() => {
                              const jm = JOB_MATCH_COLORS[order.jobMatchStatus] || JOB_MATCH_COLORS.PENDING;
                              return (
                                <span style={{ background: jm.bg, color: jm.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                                  {jm.label}
                                </span>
                              );
                            })()}
                          </Td>
                          <Td>{order.branch?.name || '-'}</Td>
                          <Td>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>
                                {formatWhen(order.firstDetectedAt || order.entranceDetectedAt)}
                              </div>
                              <div style={{ fontSize: 10, color: '#6C757D' }}>
                                {order.firstDetectedCamera?.name || order.entranceCamera?.name || '-'}
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>
                                {formatWhen(order.lastSeenAt)}
                              </div>
                              <div style={{ fontSize: 10, color: '#6C757D' }}>
                                {order.lastSeenCamera?.name || '-'}
                              </div>
                            </div>
                          </Td>
                          <Td>{bayCount}</Td>
                          <Td>{isStaff ? 'Yes' : '-'}</Td>
                          <Td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                title="Delete AI Order"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!window.confirm(`Delete AI Order ${order.captureNo}?`)) return;
                                  deleteAiOrder(String(order.id)).then(() => loadOrders()).catch((err) => setError(err.message || 'Delete failed'));
                                }}
                                style={{
                                  padding: '3px 6px', border: '1px solid #FECDD3', borderRadius: 4,
                                  background: '#FFF5F5', cursor: 'pointer', lineHeight: 0,
                                }}
                              >
                                <Trash2 size={12} color="#DC2626" />
                              </button>
                              <ChevronRight size={14} color="#9CA3AF" />
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="ai-cam-pager">
                <span>
                  Showing {((orders.page - 1) * 20) + 1}–{Math.min(orders.page * 20, orders.total)} of {orders.total}
                </span>
                <div className="ai-cam-pager__nav">
                  <button type="button" className="ai-cam-btn" disabled={orderPage <= 1} onClick={() => setOrderPage((p) => p - 1)}>
                    Previous
                  </button>
                  <button type="button" className="ai-cam-btn" disabled={orderPage >= orders.totalPages} onClick={() => setOrderPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'unmatched-pos' && (
        <>
          <div className="ai-cam-toolbar">
            <WorkshopBranchFilter
              workshops={staffWorkshops}
              workshopId={unmatchedWorkshopId}
              workshopDisplay={unmatchedWorkshopDisplay}
              onWorkshopDisplayChange={setUnmatchedWorkshopDisplay}
              onWorkshopChange={(id) => {
                setUnmatchedWorkshopId(id);
                setUnmatchedWorkshopDisplay('');
                setUnmatchedBranchId('');
                setUnmatchedBranchDisplay('');
                setUnmatchedPosPage(1);
              }}
              branches={unmatchedBranches}
              branchesLoading={unmatchedBranchesLoading}
              branchId={unmatchedBranchId}
              branchDisplay={unmatchedBranchDisplay}
              onBranchDisplayChange={setUnmatchedBranchDisplay}
              onBranchChange={(id) => {
                setUnmatchedBranchId(id);
                setUnmatchedBranchDisplay('');
                setUnmatchedPosPage(1);
              }}
            />
            <label className="ai-cam-field ai-cam-field--search">
              <span>Search</span>
              <div className="ai-cam-search">
                <Search size={14} color="#9CA3AF" />
                <input
                  value={unmatchedPosSearch}
                  onChange={(e) => { setUnmatchedPosSearch(e.target.value); setUnmatchedPosPage(1); }}
                  placeholder="Plate, customer, or invoice"
                />
              </div>
            </label>
            <label className="ai-cam-field">
              <span>From</span>
              <input className="ai-cam-control" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setUnmatchedPosPage(1); }} />
            </label>
            <label className="ai-cam-field">
              <span>To</span>
              <input className="ai-cam-control" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setUnmatchedPosPage(1); }} />
            </label>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading…</div>
          ) : (unmatchedPos.data || []).length === 0 ? (
            <div className="ai-cam-empty">
              <AlertTriangle size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No Unmatched POS Orders</h3>
              <p style={{ color: '#6C757D', fontSize: 13 }}>
                All POS sales orders with vehicles have a matching AI detection. 🎉
              </p>
            </div>
          ) : (
            <>
              <div className="ai-cam-table-wrap">
                <table className="ai-cam-table">
                  <thead>
                    <tr>
                      <Th>ORDER #</Th>
                      <Th>PLATE</Th>
                      <Th>CUSTOMER</Th>
                      <Th>BRANCH</Th>
                      <Th>INVOICE</Th>
                      <Th>DATE</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(unmatchedPos.data || []).map((so) => {
                      const orderId = so.orderNo || so.salesOrderId || so.id;
                      const plate =
                        so.vehiclePlate ||
                        so.vehicle?.plate ||
                        so.vehicle?.plateNo ||
                        so.vehicle?.plateNumber ||
                        '';
                      const customer =
                        so.customerName ||
                        so.customer?.name ||
                        '';
                      const invoiceNo =
                        so.invoice?.invoiceNo ||
                        so.invoiceNo ||
                        '';
                      return (
                      <tr key={String(orderId)} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <Td mono>{orderId || '-'}</Td>
                        <Td>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 14, background: '#FFF3CD', padding: '1px 6px', borderRadius: 4 }}>
                            {plate ? displayAiPlate(plate) : '-'}
                          </span>
                        </Td>
                        <Td>{customer.trim() || '-'}</Td>
                        <Td>{so.branch?.name || '-'}</Td>
                        <Td mono>{invoiceNo || '-'}</Td>
                        <Td>{formatWhen(so.createdAt)}</Td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="ai-cam-pager">
                <span>
                  Showing {((unmatchedPos.page - 1) * 20) + 1}–{Math.min(unmatchedPos.page * 20, unmatchedPos.total)} of {unmatchedPos.total}
                </span>
                <div className="ai-cam-pager__nav">
                  <button type="button" className="ai-cam-btn" disabled={unmatchedPosPage <= 1} onClick={() => setUnmatchedPosPage((p) => p - 1)}>
                    Previous
                  </button>
                  <button type="button" className="ai-cam-btn" disabled={unmatchedPosPage >= unmatchedPos.totalPages} onClick={() => setUnmatchedPosPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'staff-vehicles' && (
        <>
          <div className="ai-cam-toolbar" style={{ gridTemplateColumns: 'minmax(0, 360px)' }}>
            <div className="ai-cam-field">
            <label className="form-label">Workshop</label>
            <SearchableEntityCombobox
              options={staffWorkshops}
              value={staffWorkshopId}
              displayText={staffWorkshopDisplay}
              onDisplayTextChange={setStaffWorkshopDisplay}
              onSelect={(opt) => {
                setStaffWorkshopId(String(opt?.id || ''));
                setStaffWorkshopDisplay('');
              }}
              placeholder="Search workshop…"
              entityLabel="workshop"
              menuMinWidth={280}
            />
            </div>
          </div>

          {!staffWorkshopId ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D', fontSize: 13 }}>
              Select a workshop to view staff vehicles.
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading…</div>
          ) : staffVehicles.length === 0 ? (
            <div className="ai-cam-empty">
              <Radio size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No Staff Vehicles</h3>
              <p style={{ color: '#6C757D', fontSize: 13 }}>Register company vehicles so they are auto-flagged in AI Orders.</p>
            </div>
          ) : (
            <div className="ai-cam-table-wrap">
              <table className="ai-cam-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <Th>PLATE</Th>
                    <Th>STAFF NAME</Th>
                    <Th>STATUS</Th>
                    <Th>ADDED</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {staffVehicles.map((sv) => (
                    <tr key={String(sv.id)} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <Td mono>{sv.plateNumber}</Td>
                      <Td>{sv.staffName || '-'}</Td>
                      <Td>
                        <span style={{
                          background: sv.isActive ? '#D4EDDA' : '#E2E3E5',
                          color: sv.isActive ? '#155724' : '#383D41',
                          padding: '2px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                        }}>
                          {sv.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </Td>
                      <Td>{new Date(sv.createdAt).toLocaleDateString()}</Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleToggleStaffActive(sv)}
                            style={{
                              border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
                              cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700,
                            }}
                          >
                            {sv.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaffVehicle(sv.id)}
                            style={{ border: '1px solid #FECDD3', borderRadius: 6, background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', padding: '4px 10px', fontSize: 12, fontWeight: 600 }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'training' && (
        <TrainingDataTab />
      )}

      {tab === 'vehicle-training' && (
        <VehicleTrainingTab />
      )}

      {tab === 'settings' && (
        <AiCameraSettingsTab />
      )}

      {tab === 'reports' && (
        <>
          <div className="ai-cam-toolbar">
            <WorkshopBranchFilter
              workshops={staffWorkshops}
              workshopId={reportWorkshopId}
              workshopDisplay={reportWorkshopDisplay}
              onWorkshopDisplayChange={setReportWorkshopDisplay}
              onWorkshopChange={(id) => {
                setReportWorkshopId(id);
                setReportWorkshopDisplay('');
                setReportBranchId('');
                setReportBranchDisplay('');
              }}
              branches={reportBranches}
              branchesLoading={reportBranchesLoading}
              branchId={reportBranchId}
              branchDisplay={reportBranchDisplay}
              onBranchDisplayChange={setReportBranchDisplay}
              onBranchChange={(id) => {
                setReportBranchId(id);
                setReportBranchDisplay('');
              }}
            />
            <label className="ai-cam-field">
              <span>From</span>
              <input className="ai-cam-control" type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
            </label>
            <label className="ai-cam-field">
              <span>To</span>
              <input className="ai-cam-control" type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
            </label>
            {(reportFrom || reportTo) && (
              <div className="ai-cam-field">
                <span>Dates</span>
                <button type="button" className="ai-cam-clear" onClick={() => { setReportFrom(''); setReportTo(''); }}>
                  Clear dates
                </button>
              </div>
            )}
            <label className="ai-cam-check">
              <input
                type="checkbox"
                checked={reportIncludeCompany}
                onChange={(e) => setReportIncludeCompany(e.target.checked)}
              />
              Include staff vehicles
            </label>
          </div>
          {!reportWorkshopId && !reportBranchId && !reportFrom && !reportTo ? (
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6C757D', fontWeight: 600 }}>
              Showing all workshops, all branches, and all dates.
            </p>
          ) : null}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading report…</div>
          ) : !report?.totals ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>No report data.</div>
          ) : (
            <>
              <div className="ai-cam-kpis">
                {[
                  { label: 'Visits', value: report.totals.visits, hint: 'All visits in this period', status: '' },
                  { label: 'Matched', value: report.totals.MATCHED, hint: 'Matched AI orders', status: 'MATCHED' },
                  { label: 'Unmatched', value: report.totals.UNMATCHED, hint: 'Unmatched AI orders', status: 'UNMATCHED' },
                  { label: 'Confirmed', value: report.totals.CONFIRMED, hint: 'Confirmed AI orders', status: 'CONFIRMED' },
                  { label: 'Entered', value: report.totals.VEHICLE_ENTERED, hint: 'Vehicle entered', status: 'VEHICLE_ENTERED' },
                  { label: 'Match rate', value: `${report.totals.matchRatePercent}%`, hint: 'Visits used for match rate', status: '' },
                  { label: 'Staff visits', value: report.totals.companyVehicleVisits, hint: 'Staff / company vehicle visits', status: '', company: 'true' },
                  { label: 'Unbilled alerts', value: report.totals.unbilledAlertsSent, hint: 'Confirmed visits (alerts fire on unbilled confirmed)', status: 'CONFIRMED' },
                  { label: 'Staff registry', value: report.totals.activeStaffVehiclesRegistered, hint: 'Registered staff vehicles', targetTab: 'staff-vehicles' },
                ].map((card) => {
                  const selected = reportKpi?.label === card.label;
                  return (
                  <button
                    type="button"
                    key={card.label}
                    onClick={() => openKpiEvidence(card)}
                    title={`View ${card.hint || card.label}`}
                    className={`ai-cam-kpi${selected ? ' is-on' : ''}`}
                  >
                    <div className="ai-cam-kpi__label">{card.label}</div>
                    <div className="ai-cam-kpi__value">{card.value ?? 0}</div>
                    {selected ? <div className="ai-cam-kpi__hint">Showing below</div> : null}
                  </button>
                  );
                })}
              </div>

              {reportKpi ? (
                <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid #F0F0F0' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{reportKpi.label}</div>
                      <div style={{ fontSize: 11, color: '#6C757D', marginTop: 2 }}>{reportKpi.hint}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setReportKpi(null); setReportEvidence(null); }}
                      style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>
                  {reportEvidenceLoading ? (
                    <div style={{ padding: 28, textAlign: 'center', color: '#6C757D', fontSize: 13 }}>Loading results…</div>
                  ) : reportEvidence?.needsWorkshop ? (
                    <div style={{ padding: 28, textAlign: 'center', color: '#6C757D', fontSize: 13 }}>Select a workshop to see the staff registry.</div>
                  ) : reportEvidence?.kind === 'staff' ? (
                    (reportEvidence.data || []).length === 0 ? (
                      <div style={{ padding: 28, textAlign: 'center', color: '#6C757D', fontSize: 13 }}>No staff vehicles for this workshop.</div>
                    ) : (
                      <>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
                              <Th>PLATE</Th>
                              <Th>STAFF NAME</Th>
                              <Th>STATUS</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageSlice(reportEvidence.data, staffPage).map((sv) => (
                              <tr key={String(sv.id)} style={{ borderBottom: '1px solid #F5F5F5' }}>
                                <Td mono>{sv.plateNumber}</Td>
                                <Td>{sv.staffName || '—'}</Td>
                                <Td>{sv.isActive ? 'Active' : 'Inactive'}</Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <ReportPager page={staffPage} total={reportEvidence.data.length} onPage={setStaffPage} />
                      </>
                    )
                  ) : (reportEvidence?.data || []).length === 0 ? (
                    <div style={{ padding: 28, textAlign: 'center', color: '#6C757D', fontSize: 13 }}>No matching AI orders in this period.</div>
                  ) : (
                    <>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
                            <Th>PLATE</Th>
                            <Th>STATUS</Th>
                            <Th>BRANCH</Th>
                            <Th>DETECTED</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportEvidence.data.map((order) => {
                            const st = STATUS_COLORS[order.status] || STATUS_COLORS.VEHICLE_ENTERED;
                            return (
                              <tr
                                key={String(order.id)}
                                onClick={() => navigate(`${LIST_PATH}/orders/${order.id}`, { state: { backTab: 'reports' } })}
                                style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
                              >
                                <Td mono>{displayAiPlate(order)}</Td>
                                <Td>
                                  <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                                    {st.label}
                                  </span>
                                </Td>
                                <Td>{order.branch?.name || '—'}</Td>
                                <Td>{order.entranceDetectedAt ? new Date(order.entranceDetectedAt).toLocaleString() : '—'}</Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <ReportPager
                        page={reportEvidencePage}
                        total={reportEvidence.total ?? reportEvidence.data.length}
                        totalPages={reportEvidence.totalPages || 1}
                        onPage={setReportEvidencePage}
                      />
                    </>
                  )}
                </div>
              ) : null}

              {/* Waiting time analysis */}
              {report.waitingTime && (
                <div style={{
                  background: '#fff', borderRadius: 14, padding: 16,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Clock size={16} color="#1565C0" />
                    <span style={{ fontWeight: 800, fontSize: 13 }}>Waiting Time Analysis</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    <div style={{ padding: 12, background: '#F0F7FF', borderRadius: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#6C757D', textTransform: 'uppercase' }}>Entrance → First Bay (avg)</div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: '#1565C0' }}>
                        {report.waitingTime.entranceToFirstBay?.avgMinutes != null
                          ? `${report.waitingTime.entranceToFirstBay.avgMinutes} min`
                          : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6C757D' }}>
                        Median: {report.waitingTime.entranceToFirstBay?.medianMinutes ?? '—'} min
                        · {report.waitingTime.entranceToFirstBay?.sampleCount ?? 0} samples
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F0FFF0', borderRadius: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#6C757D', textTransform: 'uppercase' }}>Entrance → POS Match (avg)</div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: '#2E7D32' }}>
                        {report.waitingTime.entranceToPos?.avgMinutes != null
                          ? `${report.waitingTime.entranceToPos.avgMinutes} min`
                          : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6C757D' }}>
                        Median: {report.waitingTime.entranceToPos?.medianMinutes ?? '—'} min
                        · {report.waitingTime.entranceToPos?.sampleCount ?? 0} samples
                      </div>
                    </div>
                    {report.confidence && (
                      <div style={{ padding: 12, background: '#FFF8E1', borderRadius: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#6C757D', textTransform: 'uppercase' }}>Avg Plate Read Confidence</div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: '#E65100' }}>
                          {report.confidence.avgPercent != null
                            ? `${report.confidence.avgPercent}%`
                            : '—'}
                        </div>
                        <div style={{ fontSize: 11, color: '#6C757D' }}>
                          Min: {report.confidence.minPercent ?? '—'}%
                          · {report.confidence.sampleCount ?? 0} reads
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(report.byBranch || []).length > 0 ? (
                <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <div style={{ padding: '12px 14px', fontWeight: 800, fontSize: 13, borderBottom: '1px solid #F0F0F0' }}>
                    By branch
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
                        <Th>WORKSHOP</Th>
                        <Th>BRANCH</Th>
                        <Th>TOTAL</Th>
                        <Th>MATCHED</Th>
                        <Th>UNMATCHED</Th>
                        <Th>STAFF</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice(report.byBranch, branchPage).map((b) => (
                        <tr key={b.branchId} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <Td>{b.workshopName || '—'}</Td>
                          <Td>{b.branchName}</Td>
                          <Td>{b.total}</Td>
                          <Td>{b.matched}</Td>
                          <Td>{b.unmatched}</Td>
                          <Td>{b.companyVehicle}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ReportPager page={branchPage} total={report.byBranch.length} onPage={setBranchPage} />
                </div>
              ) : null}

              {(report.byDay || []).length > 0 ? (
                <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ padding: '12px 14px', fontWeight: 800, fontSize: 13, borderBottom: '1px solid #F0F0F0' }}>
                    By day
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
                        <Th>DATE</Th>
                        <Th>TOTAL</Th>
                        <Th>MATCHED</Th>
                        <Th>UNMATCHED</Th>
                        <Th>CONFIRMED</Th>
                        <Th>STAFF</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice([...report.byDay].reverse(), dayPage).map((d) => (
                        <tr key={d.date} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <Td mono>{d.date}</Td>
                          <Td>{d.total}</Td>
                          <Td>{d.matched}</Td>
                          <Td>{d.unmatched}</Td>
                          <Td>{d.confirmed}</Td>
                          <Td>{d.companyVehicle}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ReportPager page={dayPage} total={report.byDay.length} onPage={setDayPage} />
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Router entry
// ────────────────────────────────────────────────────────────────
export default function AiCameraPage() {
  const newCamera = useMatch('/admin/ai-camera/new');
  const editCamera = useMatch('/admin/ai-camera/:id/edit');
  const orderDetail = useMatch('/admin/ai-camera/orders/:orderId');
  const newStaff = useMatch('/admin/ai-camera/staff-vehicles/new');

  if (newCamera) return <CameraFormScreen mode="create" />;
  if (editCamera) return <CameraFormScreen mode="edit" />;
  if (orderDetail) return <OrderDetailScreen />;
  if (newStaff) return <StaffVehicleFormScreen />;
  return <AiCameraListScreen />;
}
