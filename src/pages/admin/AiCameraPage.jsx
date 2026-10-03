import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useMatch, useParams } from 'react-router-dom';
import {
  Camera, Plus, Search, Edit2, Trash2,
  Video, Radio, Car, ChevronRight, RefreshCw, Building, Layers, Loader2,
} from 'lucide-react';
import ApprovalPageShell from '../../components/admin/ApprovalPageShell';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import '../../components/SearchableEntityCombobox.css';
import '../../styles/admin/ApprovalsPage.css';
import {
  listCameras, createCamera, updateCamera, deleteCamera, getCamera,
  listAiOrders, getAiOrder,
  listStaffVehicles, createStaffVehicle, deleteStaffVehicle,
} from '../../services/aiCameraApi';
import {
  getWorkshopOptions,
  getBranches,
  getDepartments,
} from '../../services/superAdminApi';

const LIST_PATH = '/admin/ai-camera';

const STATUS_COLORS = {
  VEHICLE_ENTERED: { bg: '#FFF3CD', color: '#856404', label: 'Vehicle Entered' },
  CONFIRMED: { bg: '#D4EDDA', color: '#155724', label: 'Confirmed' },
  MATCHED: { bg: '#CCE5FF', color: '#004085', label: 'Matched' },
  UNMATCHED: { bg: '#F8D7DA', color: '#721C24', label: 'Unmatched' },
  EXPIRED: { bg: '#E2E3E5', color: '#383D41', label: 'Expired' },
};

const TABS = [
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'orders', label: 'AI Orders', icon: Car },
  { id: 'staff-vehicles', label: 'Staff Vehicles', icon: Radio },
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

  return (
    <ApprovalPageShell title="AI Order Detail" onBack={() => navigate(`${LIST_PATH}?tab=orders`)}>
      <div style={{ background: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase' }}>Capture No</div>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{order.captureNo}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, maxWidth: 640 }}>
        <InfoCell label="Plate Number" value={order.plateNumber} mono />
        <InfoCell
          label="Status"
          value={(
            <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
              {st.label}
            </span>
          )}
        />
        <InfoCell label="Branch" value={order.branch?.name || '-'} />
        <InfoCell label="Entrance Camera" value={order.entranceCamera?.name || '-'} />
        <InfoCell label="Detected At" value={new Date(order.entranceDetectedAt).toLocaleString()} />
        <InfoCell label="Confidence" value={order.confidence ? `${(Number(order.confidence) * 100).toFixed(1)}%` : '-'} />
        <InfoCell label="Company Vehicle" value={order.isCompanyVehicle ? 'Yes' : 'No'} />
        <InfoCell label="First Bay At" value={order.firstServiceBayAt ? new Date(order.firstServiceBayAt).toLocaleString() : '-'} />
      </div>

      {order.snapshotUrl ? (
        <div style={{ marginBottom: 16, maxWidth: 480 }}>
          <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, marginBottom: 6 }}>SNAPSHOT</div>
          <img src={order.snapshotUrl} alt="snapshot" style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB' }} />
        </div>
      ) : null}

      {order.serviceBayEvents?.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, marginBottom: 8 }}>SERVICE BAY EVENTS</div>
          {order.serviceBayEvents.map((ev, i) => (
            <div key={i} style={{ background: '#F8F9FA', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{ev.department?.name || `Dept ${ev.departmentId}`}</div>
              <div style={{ color: '#6C757D' }}>
                {ev.camera?.name || 'Camera'} · {new Date(ev.detectedAt).toLocaleString()}
                {ev.confidence ? ` · ${(Number(ev.confidence) * 100).toFixed(1)}%` : ''}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </ApprovalPageShell>
  );
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
  const [searchQ, setSearchQ] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderStatus, setOrderStatus] = useState('');

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
      });
      setOrders(res || { data: [], total: 0, page: 1, totalPages: 1 });
    } catch (e) {
      setError(e.message || 'Failed to load orders');
      setOrders({ data: [], total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [orderPage, orderStatus, searchQ]);

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
    if (tab === 'staff-vehicles') loadStaffVehicles();
  }, [tab, loadCameras, loadOrders, loadStaffVehicles]);

  useEffect(() => {
    if (tab !== 'staff-vehicles') return;
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

  const refresh = () => {
    if (tab === 'cameras') loadCameras();
    if (tab === 'orders') loadOrders();
    if (tab === 'staff-vehicles') loadStaffVehicles();
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
                      <Th>BRANCH</Th>
                      <Th>CAMERA</Th>
                      <Th>DETECTED</Th>
                      <Th>COMPANY</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {(orders.data || []).map((order) => {
                      const st = STATUS_COLORS[order.status] || STATUS_COLORS.VEHICLE_ENTERED;
                      return (
                        <tr
                          key={String(order.id)}
                          style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
                          onClick={() => navigate(`${LIST_PATH}/orders/${order.id}`)}
                        >
                          <Td mono>{order.captureNo}</Td>
                          <Td><span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 14 }}>{order.plateNumber}</span></Td>
                          <Td>
                            <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                              {st.label}
                            </span>
                          </Td>
                          <Td>{order.branch?.name || '-'}</Td>
                          <Td>{order.entranceCamera?.name || '-'}</Td>
                          <Td>{new Date(order.entranceDetectedAt).toLocaleString()}</Td>
                          <Td>{order.isCompanyVehicle ? 'Yes' : '-'}</Td>
                          <Td><ChevronRight size={14} color="#9CA3AF" /></Td>
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
                        <button
                          type="button"
                          onClick={() => handleDeleteStaffVehicle(sv.id)}
                          style={{ border: '1px solid #FECDD3', borderRadius: 6, background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', padding: '4px 10px', fontSize: 12, fontWeight: 600 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
