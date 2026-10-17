import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useMatch, useParams } from 'react-router-dom';
import {
  Camera, Plus, Search, Edit2, Trash2,
  Video, Radio, Car, ChevronRight, RefreshCw, Building, Layers, Loader2,
  BarChart3, AlertTriangle, Clock, Pencil, Check, X, Download, FileText, Sheet,
} from 'lucide-react';
import ApprovalPageShell from '../../components/admin/ApprovalPageShell';
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
} from '../../services/aiCameraApi';
import {
  getWorkshopOptions,
  getBranches,
  getDepartments,
} from '../../services/superAdminApi';
import { toPosCompactPlate } from '../../utils/formatPlate';

function displayAiPlate(orderOrPlate) {
  if (!orderOrPlate) return '';
  if (typeof orderOrPlate === 'string') {
    return toPosCompactPlate(orderOrPlate) || orderOrPlate;
  }
  const raw = orderOrPlate.plateNumber || '';
  return toPosCompactPlate(raw) || raw;
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

const TABS = [
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'orders', label: 'AI Orders', icon: Car },
  { id: 'unmatched-pos', label: 'Unmatched POS', icon: AlertTriangle },
  { id: 'staff-vehicles', label: 'Staff Vehicles', icon: Radio },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

function InfoCell({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 800, color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {children}
    </th>
  );
}

function Td({ children, mono }) {
  return (
    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit' }}>
      {children}
    </td>
  );
}

// ────────────────────────────────────────────────────────────────
// Camera create / edit (full page — no modal)
// ────────────────────────────────────────────────────────────────
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
  });
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
        });
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

    const payload = {
      workshopId: form.workshopId,
      branchId: form.branchId,
      name: form.name.trim(),
      cameraType: form.cameraType,
      departmentId: form.cameraType === 'SERVICE_BAY' ? form.departmentId : undefined,
      streamUrl: form.streamUrl || undefined,
      deviceId: form.deviceId || undefined,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateCamera(id, {
          name: payload.name,
          cameraType: payload.cameraType,
          departmentId: payload.departmentId,
          streamUrl: payload.streamUrl,
          deviceId: payload.deviceId,
          isActive: payload.isActive,
        });
      } else {
        await createCamera(payload);
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
      <ApprovalPageShell title="AI Order Detail" onBack={() => navigate(`${LIST_PATH}?tab=orders`)}>
        <div style={{ padding: 40, textAlign: 'center', color: '#6C757D' }}>Loading…</div>
      </ApprovalPageShell>
    );
  }

  if (error || !order) {
    return (
      <ApprovalPageShell title="AI Order Detail" onBack={() => navigate(`${LIST_PATH}?tab=orders`)}>
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
      at: order.entranceDetectedAt,
      isFirstDetection: !!entranceIsFirst,
      meta: order.confidence
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
        linkedJob: ev.linkedJob,
      };
    }),
  ];

  return (
    <ApprovalPageShell title="AI Order Detail" onBack={() => navigate(`${LIST_PATH}?tab=orders`)}>
      <div style={{ background: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase' }}>Capture No</div>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{order.captureNo}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24, maxWidth: 640 }}>
        <div>
          <div style={{ fontSize: 10, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Plate Number</div>
          {editingPlate ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, padding: '2px 8px', border: '1px solid #E5E7EB', borderRadius: 6, width: 120 }}
                autoFocus
              />
              <button
                type="button"
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
                style={{ padding: '2px 6px', border: 'none', background: '#E8F5E9', borderRadius: 4, cursor: 'pointer' }}
                title="Save"
              >
                {savingPlate ? <Loader2 size={14} className="spin" /> : <Check size={14} color="#2E7D32" />}
              </button>
              <button
                type="button"
                onClick={() => setEditingPlate(false)}
                style={{ padding: '2px 6px', border: 'none', background: '#FEF2F2', borderRadius: 4, cursor: 'pointer' }}
                title="Cancel"
              >
                <X size={14} color="#DC2626" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{displayAiPlate(order)}</span>
              <button
                type="button"
                onClick={() => { setNewPlate(displayAiPlate(order)); setEditingPlate(true); }}
                style={{ padding: '2px 6px', border: '1px solid #E5E7EB', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
                title="Correct plate number"
              >
                <Pencil size={12} color="#6C757D" />
              </button>
            </div>
          )}
        </div>
        <InfoCell
          label="Status"
          value={(
            <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
              {st.label}
            </span>
          )}
        />
        <InfoCell
          label="Job Match Status"
          value={(() => {
            const jm = JOB_MATCH_COLORS[order.jobMatchStatus] || JOB_MATCH_COLORS.PENDING;
            return (
              <span style={{ background: jm.bg, color: jm.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                {jm.label}
              </span>
            );
          })()}
        />
        {order.invoiceGeneratedAt && (
          <InfoCell label="Invoice Generated" value={new Date(order.invoiceGeneratedAt).toLocaleString()} />
        )}
        <InfoCell label="Branch" value={order.branch?.name || '-'} />
        <InfoCell label="Entrance Camera" value={order.entranceCamera?.name || '-'} />
        <InfoCell label="Detected At" value={new Date(order.entranceDetectedAt).toLocaleString()} />
        <InfoCell
          label="Company Vehicle"
          value={
            order.isCompanyVehicle ? (
              <span style={{ background: '#FFECB3', color: '#8D6E00', padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                STAFF VEHICLE
              </span>
            ) : 'No'
          }
        />
        <InfoCell label="First Bay At" value={order.firstServiceBayAt ? new Date(order.firstServiceBayAt).toLocaleString() : '-'} />
        <InfoCell label="Bay Visits" value={String(bayEvents.length)} />
        <InfoCell
          label="POS Order"
          value={
            order.linkedSalesOrder?.id
              || order.cashierOrderId
              || '-'
          }
          mono
        />
        <InfoCell
          label="Matched At"
          value={order.matchedAt ? new Date(order.matchedAt).toLocaleString() : '-'}
        />
        <InfoCell
          label="Invoice"
          value={order.linkedSalesOrder?.invoice?.invoiceNo || '-'}
          mono
        />
        <InfoCell
          label="POS Customer"
          value={order.linkedSalesOrder?.customer?.name || '-'}
        />
        <div>
          <div style={{ fontSize: 10, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>First Detected At</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {order.firstDetectedAt ? new Date(order.firstDetectedAt).toLocaleString() : '-'}
          </div>
          {order.firstDetectedCamera?.name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <span style={{
                background: '#DBEAFE', color: '#1E40AF', padding: '1px 8px', borderRadius: 4,
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              }}>
                First Detection
              </span>
              <span style={{ fontSize: 11, color: '#6C757D' }}>{order.firstDetectedCamera.name}</span>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Last Seen</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {order.lastSeenAt ? new Date(order.lastSeenAt).toLocaleString() : '-'}
          </div>
          {order.lastSeenCamera?.name && (
            <div style={{ fontSize: 11, color: '#6C757D', marginTop: 3 }}>
              at <strong>{order.lastSeenCamera.name}</strong>
            </div>
          )}
        </div>
      </div>

      {order.snapshotUrl ? (
        <div style={{ marginBottom: 24, maxWidth: 480 }}>
          <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, marginBottom: 6 }}>ENTRANCE SNAPSHOT</div>
          <img src={order.snapshotUrl} alt="snapshot" style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB' }} />
        </div>
      ) : null}

      <div style={{ maxWidth: 640 }}>
        <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, marginBottom: 12, letterSpacing: '0.4px' }}>
          VISIT TIMELINE
        </div>
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          <div style={{
            position: 'absolute', left: 9, top: 8, bottom: 8, width: 2, background: '#E5E7EB',
          }}
          />
          {timeline.map((step, idx) => {
            const isBay = step.kind === 'SERVICE_BAY';
            const color = isBay ? '#E65100' : '#2E7D32';
            const bg = isBay ? '#FFF3E0' : '#E8F5E9';
            return (
              <div key={step.key} style={{ position: 'relative', marginBottom: idx === timeline.length - 1 ? 0 : 16 }}>
                <div style={{
                  position: 'absolute', left: -28, top: 14, width: 20, height: 20, borderRadius: '50%',
                  background: bg, border: `2px solid ${color}`, zIndex: 1,
                }}
                />
                <div style={{
                  background: '#fff', border: '1px solid #F0F0F0', borderRadius: 12, padding: 14,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase' }}>
                          {isBay ? 'Service Bay' : 'Entrance'}
                        </span>
                        {step.isFirstDetection && (
                          <span style={{
                            background: '#DBEAFE', color: '#1E40AF', padding: '1px 8px', borderRadius: 4,
                            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3px',
                          }}>
                            First Detection
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{step.title}</div>
                      <div style={{ fontSize: 12, color: '#6C757D', marginTop: 2 }}>{step.subtitle}</div>
                      {step.meta ? (
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{step.meta}</div>
                      ) : null}
                      {/* Job lifecycle info for bay events */}
                      {isBay && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          {(() => {
                            const jm = JOB_MATCH_COLORS[step.jobMatchStatus] || JOB_MATCH_COLORS.PENDING;
                            return (
                              <span style={{ background: jm.bg, color: jm.color, padding: '1px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>
                                Job: {jm.label}
                              </span>
                            );
                          })()}
                          {step.completedAt && (
                            <span style={{
                              background: step.autoCompleted ? '#FFF3CD' : '#D4EDDA',
                              color: step.autoCompleted ? '#856404' : '#155724',
                              padding: '1px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                            }}>
                              {step.autoCompleted ? 'Auto-completed' : 'Completed'} {new Date(step.completedAt).toLocaleTimeString()}
                            </span>
                          )}
                          {step.linkedJob && (
                            <span style={{ fontSize: 10, color: '#6C757D' }}>
                              POS Job: {step.linkedJob.department?.name || `#${step.linkedJob.id}`} ({step.linkedJob.status})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                        {step.at ? new Date(step.at).toLocaleString() : '-'}
                      </div>
                      {step.isFirstDetection && (
                        <div style={{ fontSize: 10, color: '#1E40AF', fontWeight: 600, marginTop: 2 }}>
                          First Detection
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {bayEvents.length === 0 ? (
          <p style={{ marginTop: 16, fontSize: 13, color: '#6C757D' }}>
            No service bay detections yet. When a service-bay camera sees this plate, status becomes <strong>Confirmed</strong> and events appear here.
          </p>
        ) : null}
      </div>

      {/* ── Fuzzy Match Suggestions ── */}
      {order.status !== 'MATCHED' && (
        <div style={{ marginTop: 28, maxWidth: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              POS Match Suggestions
            </div>
            <button
              type="button"
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
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              {loadingSuggestions ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
              {suggestions ? 'Refresh' : 'Find Similar POS Orders'}
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
              <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '5px 12px', border: 'none', borderRadius: 6,
                                  background: '#FFD700', color: '#000',
                                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
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
        </div>
      )}

      {/* ── Delete AI Order ── */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #F0F0F0' }}>
        <button
          type="button"
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
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', border: '1px solid #FECDD3', borderRadius: 8,
            background: '#FFF5F5', color: '#DC2626',
            cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}
        >
          <Trash2 size={14} />
          {deleting ? 'Deleting…' : 'Delete AI Order'}
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
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [cameraFilter, setCameraFilter] = useState('');
  const [filterDepartments, setFilterDepartments] = useState([]);
  const [filterCameras, setFilterCameras] = useState([]);
  const [unmatchedPos, setUnmatchedPos] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [unmatchedPosPage, setUnmatchedPosPage] = useState(1);
  const [unmatchedPosSearch, setUnmatchedPosSearch] = useState('');
  const [report, setReport] = useState(null);
  const [reportWorkshopId, setReportWorkshopId] = useState('');
  const [reportWorkshopDisplay, setReportWorkshopDisplay] = useState('');
  const [reportIncludeCompany, setReportIncludeCompany] = useState(true);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');

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
  }, [orderPage, orderStatus, searchQ, companyFilter, dateFrom, dateTo, departmentFilter, cameraFilter]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAiCameraReportSummary({
        workshopId: reportWorkshopId || undefined,
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
  }, [reportWorkshopId, reportIncludeCompany, reportFrom, reportTo]);

  const loadUnmatchedPos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listUnmatchedPosOrders({
        page: unmatchedPosPage,
        limit: 20,
        search: unmatchedPosSearch || undefined,
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
  }, [unmatchedPosPage, unmatchedPosSearch, dateFrom, dateTo]);

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

  useEffect(() => {
    if (tab !== 'staff-vehicles' && tab !== 'reports') return;
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

  const handleDeleteCamera = async (camId) => {
    if (!window.confirm('Delete this camera?')) return;
    try {
      await deleteCamera(String(camId));
      loadCameras();
    } catch (e) {
      setError(e.message || 'Delete failed');
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

  const refresh = () => {
    if (tab === 'cameras') loadCameras();
    if (tab === 'orders') loadOrders();
    if (tab === 'unmatched-pos') loadUnmatchedPos();
    if (tab === 'staff-vehicles') loadStaffVehicles();
    if (tab === 'reports') loadReport();
  };

  return (
    <div className="module-container" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>AI Camera System</h2>
          <p style={{ color: '#6C757D', fontSize: 13, margin: '4px 0 0' }}>
            Manage cameras, view vehicle detections & AI orders
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={refresh}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {tab === 'cameras' ? (
            <button
              type="button"
              onClick={() => navigate(`${LIST_PATH}/new`)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#FFD700', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              <Plus size={16} /> Add Camera
            </button>
          ) : null}
          {tab === 'staff-vehicles' ? (
            <button
              type="button"
              onClick={() => navigate(`${LIST_PATH}/staff-vehicles/new`)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#FFD700', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              <Plus size={16} /> Add Vehicle
            </button>
          ) : null}
          {tab === 'orders' && (orders.data || []).length > 0 ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                <Download size={14} /> Export
              </button>
              {exportOpen && (
                <div
                  style={{
                    position: 'absolute', right: 0, top: '110%', zIndex: 50,
                    background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 170, overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => { exportOrdersToPDF(orders.data); setExportOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <FileText size={15} color="#DC2626" /> Export as PDF
                  </button>
                  <div style={{ height: 1, background: '#F0F0F0' }} />
                  <button
                    type="button"
                    onClick={() => { exportOrdersToCSV(orders.data); setExportOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Sheet size={15} color="#16A34A" /> Export as Excel (CSV)
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSearchQ('');
              setError('');
              navigate(`${LIST_PATH}?tab=${t.id}`, { replace: true });
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? '#000' : '#6C757D',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <t.icon size={16} /> {t.label}
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
          <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {cameras.map((cam) => (
              <div
                key={String(cam.id)}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  border: '1px solid #F0F0F0',
                }}
              >
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
                    }}>
                      {cam.cameraType === 'ENTRANCE'
                        ? <Video size={20} color="#2E7D32" />
                        : <Layers size={20} color="#E65100" />}
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{cam.name}</h4>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: cam.cameraType === 'ENTRANCE' ? '#2E7D32' : '#E65100',
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
                    }}
                  />
                </div>

                <div style={{ fontSize: 12, color: '#6C757D', marginBottom: 4 }}>
                  <Building size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Branch: <strong>{cam.branch?.name || cam.branchId}</strong>
                </div>
                {cam.deviceId ? (
                  <div style={{ fontSize: 12, color: '#6C757D', fontFamily: 'monospace', marginBottom: 4 }}>
                    Device: {cam.deviceId}
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 6, marginTop: 14, borderTop: '1px solid #F0F0F0', paddingTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => navigate(`${LIST_PATH}/${cam.id}/edit`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCamera(cam.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #FECDD3', borderRadius: 6, background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'orders' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 12px', flex: 1, minWidth: 200 }}>
              <Search size={14} color="#9CA3AF" />
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setOrderPage(1); }}
                placeholder="Search by plate or capture no…"
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13 }}
              />
            </div>
            <select
              value={orderStatus}
              onChange={(e) => { setOrderStatus(e.target.value); setOrderPage(1); }}
              style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff' }}
            >
              <option value="">All Statuses</option>
              <option value="VEHICLE_ENTERED">Vehicle Entered</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="MATCHED">Matched</option>
              <option value="UNMATCHED">Unmatched</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <select
              value={companyFilter}
              onChange={(e) => { setCompanyFilter(e.target.value); setOrderPage(1); }}
              style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff' }}
            >
              <option value="">All vehicles</option>
              <option value="true">Staff / company only</option>
              <option value="false">Customer only</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D' }}>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setOrderPage(1); }}
                style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, background: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D' }}>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setOrderPage(1); }}
                style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, background: '#fff' }}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo(''); setOrderPage(1); }}
                style={{ padding: '6px 12px', border: '1px solid #FECDD3', borderRadius: 8, background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
              >
                Clear dates
              </button>
            )}
            {filterDepartments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setOrderPage(1); }}
                style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff' }}
              >
                <option value="">All Departments</option>
                {filterDepartments.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name || `Dept ${d.id}`}</option>
                ))}
              </select>
            )}
            {filterCameras.length > 0 && (
              <select
                value={cameraFilter}
                onChange={(e) => { setCameraFilter(e.target.value); setOrderPage(1); }}
                style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff' }}
              >
                <option value="">All Cameras</option>
                {filterCameras.filter((c) => c.cameraType === 'ENTRANCE').map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name || `Camera ${c.id}`}</option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading orders…</div>
          ) : (orders.data || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Car size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No AI Orders Yet</h3>
              <p style={{ color: '#6C757D', fontSize: 13 }}>
                AI Orders appear here when cameras detect vehicle plates.
              </p>
            </div>
          ) : (
            <>
              <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
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
                          <Td mono>{order.captureNo}</Td>
                          <Td>
                            <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 14 }}>
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
                                {order.firstDetectedAt ? new Date(order.firstDetectedAt).toLocaleString() : new Date(order.entranceDetectedAt).toLocaleString()}
                              </div>
                              <div style={{ fontSize: 10, color: '#6C757D' }}>
                                {order.firstDetectedCamera?.name || order.entranceCamera?.name || '-'}
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>
                                {order.lastSeenAt ? new Date(order.lastSeenAt).toLocaleString() : '-'}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13 }}>
                <span style={{ color: '#6C757D' }}>
                  Showing {((orders.page - 1) * 20) + 1}–{Math.min(orders.page * 20, orders.total)} of {orders.total}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" disabled={orderPage <= 1} onClick={() => setOrderPage((p) => p - 1)}
                    style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Previous
                  </button>
                  <button type="button" disabled={orderPage >= orders.totalPages} onClick={() => setOrderPage((p) => p + 1)}
                    style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
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
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 12px', flex: 1, minWidth: 200 }}>
              <Search size={14} color="#9CA3AF" />
              <input
                value={unmatchedPosSearch}
                onChange={(e) => { setUnmatchedPosSearch(e.target.value); setUnmatchedPosPage(1); }}
                placeholder="Search by plate, customer, invoice…"
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D' }}>From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setUnmatchedPosPage(1); }}
                style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, background: '#fff' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D' }}>To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setUnmatchedPosPage(1); }}
                style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, background: '#fff' }} />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading…</div>
          ) : (unmatchedPos.data || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <AlertTriangle size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No Unmatched POS Orders</h3>
              <p style={{ color: '#6C757D', fontSize: 13 }}>
                All POS sales orders with vehicles have a matching AI detection. 🎉
              </p>
            </div>
          ) : (
            <>
              <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
                      <Th>ORDER #</Th>
                      <Th>PLATE</Th>
                      <Th>CUSTOMER</Th>
                      <Th>BRANCH</Th>
                      <Th>INVOICE</Th>
                      <Th>DATE</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(unmatchedPos.data || []).map((so) => (
                      <tr key={String(so.id)} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <Td mono>{so.orderNo || so.id}</Td>
                        <Td>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 14, background: '#FFF3CD', padding: '1px 6px', borderRadius: 4 }}>
                            {so.vehiclePlate || '-'}
                          </span>
                        </Td>
                        <Td>{so.customer?.name || so.customerName || '-'}</Td>
                        <Td>{so.branch?.name || '-'}</Td>
                        <Td mono>{so.invoice?.invoiceNo || '-'}</Td>
                        <Td>{so.createdAt ? new Date(so.createdAt).toLocaleString() : '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13 }}>
                <span style={{ color: '#6C757D' }}>
                  Showing {((unmatchedPos.page - 1) * 20) + 1}–{Math.min(unmatchedPos.page * 20, unmatchedPos.total)} of {unmatchedPos.total}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" disabled={unmatchedPosPage <= 1} onClick={() => setUnmatchedPosPage((p) => p - 1)}
                    style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Previous
                  </button>
                  <button type="button" disabled={unmatchedPosPage >= unmatchedPos.totalPages} onClick={() => setUnmatchedPosPage((p) => p + 1)}
                    style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
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
          <div style={{ marginBottom: 16, maxWidth: 360 }}>
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

          {!staffWorkshopId ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D', fontSize: 13 }}>
              Select a workshop to view staff vehicles.
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading…</div>
          ) : staffVehicles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Radio size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No Staff Vehicles</h3>
              <p style={{ color: '#6C757D', fontSize: 13 }}>Register company vehicles so they are auto-flagged in AI Orders.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
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

      {tab === 'reports' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 280, flex: 1, maxWidth: 360 }}>
              <label className="form-label">Workshop (optional)</label>
              <SearchableEntityCombobox
                options={[{ id: '', label: 'All workshops' }, ...staffWorkshops]}
                value={reportWorkshopId}
                displayText={reportWorkshopDisplay}
                onDisplayTextChange={setReportWorkshopDisplay}
                onSelect={(opt) => {
                  setReportWorkshopId(String(opt?.id || ''));
                  setReportWorkshopDisplay('');
                }}
                placeholder="All workshops…"
                entityLabel="workshop"
                menuMinWidth={280}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D', display: 'block', marginBottom: 4 }}>From</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, background: '#fff' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D', display: 'block', marginBottom: 4 }}>To</label>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, background: '#fff' }}
                />
              </div>
              {(reportFrom || reportTo) && (
                <button
                  type="button"
                  onClick={() => { setReportFrom(''); setReportTo(''); }}
                  style={{ padding: '6px 12px', border: '1px solid #FECDD3', borderRadius: 8, background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginBottom: 1 }}
                >
                  Clear
                </button>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={reportIncludeCompany}
                onChange={(e) => setReportIncludeCompany(e.target.checked)}
              />
              Include staff vehicles
            </label>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading report…</div>
          ) : !report?.totals ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>No report data.</div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
              >
                {[
                  { label: 'Visits', value: report.totals.visits },
                  { label: 'Matched', value: report.totals.MATCHED },
                  { label: 'Unmatched', value: report.totals.UNMATCHED },
                  { label: 'Confirmed', value: report.totals.CONFIRMED },
                  { label: 'Entered', value: report.totals.VEHICLE_ENTERED },
                  { label: 'Match rate', value: `${report.totals.matchRatePercent}%` },
                  { label: 'Staff visits', value: report.totals.companyVehicleVisits },
                  { label: 'Unbilled alerts', value: report.totals.unbilledAlertsSent },
                  { label: 'Staff registry', value: report.totals.activeStaffVehiclesRegistered },
                ].map((card) => (
                  <div
                    key={card.label}
                    style={{
                      background: '#fff', borderRadius: 12, padding: 14,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#6C757D', textTransform: 'uppercase' }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{card.value ?? 0}</div>
                  </div>
                ))}
              </div>

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
                        <Th>BRANCH</Th>
                        <Th>TOTAL</Th>
                        <Th>MATCHED</Th>
                        <Th>UNMATCHED</Th>
                        <Th>STAFF</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byBranch.map((b) => (
                        <tr key={b.branchId} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <Td>{b.branchName}</Td>
                          <Td>{b.total}</Td>
                          <Td>{b.matched}</Td>
                          <Td>{b.unmatched}</Td>
                          <Td>{b.companyVehicle}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                      {[...report.byDay].reverse().map((d) => (
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
