import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Plus, Search, Edit2, Trash2, X,
  Video, Radio, Car,
  ChevronRight, RefreshCw, Building, Layers,
} from 'lucide-react';
import {
  listCameras, createCamera, updateCamera, deleteCamera,
  listAiOrders, listStaffVehicles, createStaffVehicle, deleteStaffVehicle,
} from '../../services/aiCameraApi';
import {
  getWorkshopOptions,
  getBranches,
  getDepartments,
} from '../../services/superAdminApi';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import '../../components/SearchableEntityCombobox.css';

const STATUS_COLORS = {
  VEHICLE_ENTERED: { bg: '#FFF3CD', color: '#856404', label: 'Vehicle Entered' },
  CONFIRMED:       { bg: '#D4EDDA', color: '#155724', label: 'Confirmed' },
  MATCHED:         { bg: '#CCE5FF', color: '#004085', label: 'Matched' },
  UNMATCHED:       { bg: '#F8D7DA', color: '#721C24', label: 'Unmatched' },
  EXPIRED:         { bg: '#E2E3E5', color: '#383D41', label: 'Expired' },
};

const TABS = [
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'orders', label: 'AI Orders', icon: Car },
  { id: 'staff-vehicles', label: 'Staff Vehicles', icon: Radio },
];

// ────────────────────────────────────────────────────────────────
// Camera Form Modal
// ────────────────────────────────────────────────────────────────
const CameraFormModal = ({ isOpen, onClose, onSave, camera }) => {
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
  const [saving, setSaving] = useState(false);

  const [workshops, setWorkshops] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const [workshopDisplay, setWorkshopDisplay] = useState('');
  const [branchDisplay, setBranchDisplay] = useState('');
  const [typeDisplay, setTypeDisplay] = useState('');

  // Type key: "ENTRANCE" or "DEPT:{id}"
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
      opts.push({
        id: `DEPT:${d.id}`,
        label: d.name || `Department ${d.id}`,
      });
    });
    return opts;
  }, [departments]);

  // Load workshops + departments when modal opens
  useEffect(() => {
    if (!isOpen) return;
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
          setWorkshops(
            list.map((w) => ({
              id: String(w.id),
              name: String(w.name || '').trim() || 'Workshop',
            })),
          );
        }
      } catch {
        if (!cancelled) setWorkshops([]);
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
              .filter((d) => d && (d.isActive !== false))
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

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Load branches when workshop changes
  useEffect(() => {
    if (!isOpen || !form.workshopId) {
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
          setBranches(
            list.map((b) => ({
              id: String(b.id),
              name: String(b.name || '').trim() || 'Branch',
            })),
          );
        }
      } catch {
        if (!cancelled) setBranches([]);
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, form.workshopId]);

  // Reset / hydrate form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (camera) {
      setForm({
        workshopId: String(camera.workshopId ?? ''),
        branchId: String(camera.branchId ?? ''),
        name: camera.name || '',
        cameraType: camera.cameraType || 'ENTRANCE',
        departmentId: String(camera.departmentId ?? ''),
        streamUrl: camera.streamUrl || '',
        deviceId: camera.deviceId || '',
        isActive: camera.isActive ?? true,
      });
      setWorkshopDisplay('');
      setBranchDisplay('');
      setTypeDisplay('');
    } else {
      setForm({
        workshopId: '',
        branchId: '',
        name: '',
        cameraType: 'ENTRANCE',
        departmentId: '',
        streamUrl: '',
        deviceId: '',
        isActive: true,
      });
      setWorkshopDisplay('');
      setBranchDisplay('');
      setTypeDisplay('');
    }
  }, [camera, isOpen]);

  if (!isOpen) return null;

  const handleTypeSelect = (opt) => {
    const id = String(opt?.id || '');
    setTypeDisplay('');
    if (id === 'ENTRANCE') {
      setForm((f) => ({ ...f, cameraType: 'ENTRANCE', departmentId: '' }));
      return;
    }
    if (id.startsWith('DEPT:')) {
      const deptId = id.slice(5);
      setForm((f) => ({
        ...f,
        cameraType: 'SERVICE_BAY',
        departmentId: deptId,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.workshopId) {
      alert('Please select a workshop');
      return;
    }
    if (!form.branchId) {
      alert('Please select a branch');
      return;
    }
    if (form.cameraType === 'SERVICE_BAY' && !form.departmentId) {
      alert('Please select a department (service bay)');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        workshopId: form.workshopId,
        branchId: form.branchId,
        name: form.name,
        cameraType: form.cameraType,
        departmentId: form.cameraType === 'SERVICE_BAY' ? form.departmentId : undefined,
        streamUrl: form.streamUrl || undefined,
        deviceId: form.deviceId || undefined,
        isActive: form.isActive,
      });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div className="modal-header-content">
          <h3>{camera ? 'Edit Camera' : 'Add Camera'}</h3>
          <button type="button" className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Workshop *</label>
                <SearchableEntityCombobox
                  options={workshopOptions}
                  value={form.workshopId}
                  displayText={workshopDisplay}
                  onDisplayTextChange={setWorkshopDisplay}
                  onSelect={(opt) => {
                    setForm((f) => ({
                      ...f,
                      workshopId: String(opt?.id || ''),
                      branchId: '',
                    }));
                    setWorkshopDisplay('');
                    setBranchDisplay('');
                  }}
                  placeholder="Search workshop…"
                  entityLabel="workshop"
                  loading={loadingWorkshops}
                  required
                  menuMinWidth={240}
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
                  required
                  menuMinWidth={240}
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
                required
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
                required
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
          </div>
          <div className="modal-footer-content">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={saving}>
              {saving ? 'Saving...' : camera ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// Order Detail Drawer
// ────────────────────────────────────────────────────────────────
const OrderDetailDrawer = ({ order, onClose }) => {
  if (!order) return null;
  const st = STATUS_COLORS[order.status] || STATUS_COLORS.VEHICLE_ENTERED;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 460,
          background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', padding: 32,
          overflowY: 'auto', zIndex: 1000,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontWeight: 800, fontSize: 18 }}>AI Order Detail</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ background: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase' }}>Capture No</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{order.captureNo}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <InfoCell label="Plate Number" value={order.plateNumber} mono />
          <InfoCell label="Status" value={<span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{st.label}</span>} />
          <InfoCell label="Branch" value={order.branch?.name || '-'} />
          <InfoCell label="Entrance Camera" value={order.entranceCamera?.name || '-'} />
          <InfoCell label="Detected At" value={new Date(order.entranceDetectedAt).toLocaleString()} />
          <InfoCell label="Confidence" value={order.confidence ? `${(Number(order.confidence) * 100).toFixed(1)}%` : '-'} />
          <InfoCell label="Company Vehicle" value={order.isCompanyVehicle ? '✅ Yes' : 'No'} />
          <InfoCell label="First Bay At" value={order.firstServiceBayAt ? new Date(order.firstServiceBayAt).toLocaleString() : '-'} />
        </div>

        {order.snapshotUrl && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, marginBottom: 6 }}>SNAPSHOT</div>
            <img src={order.snapshotUrl} alt="snapshot" style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB' }} />
          </div>
        )}

        {order.serviceBayEvents?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#6C757D', fontWeight: 700, marginBottom: 8 }}>SERVICE BAY EVENTS</div>
            {order.serviceBayEvents.map((ev, i) => (
              <div key={i} style={{ background: '#F8F9FA', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700 }}>{ev.department?.name || `Dept ${ev.departmentId}`}</div>
                <div style={{ color: '#6C757D' }}>
                  {ev.camera?.name || 'Camera'} · {new Date(ev.detectedAt).toLocaleString()}
                  {ev.confidence && ` · ${(Number(ev.confidence) * 100).toFixed(1)}%`}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

const InfoCell = ({ label, value, mono }) => (
  <div>
    <div style={{ fontSize: 10, color: '#6C757D', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
  </div>
);

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────
export default function AiCameraPage() {
  const [tab, setTab] = useState('cameras');
  const [cameras, setCameras] = useState([]);
  const [orders, setOrders] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [staffVehicles, setStaffVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  // Camera form
  const [formOpen, setFormOpen] = useState(false);
  const [editCamera, setEditCamera] = useState(null);

  // Order detail
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Staff vehicle form
  const [svForm, setSvForm] = useState({ workshopId: '', plateNumber: '', staffName: '' });
  const [svFormOpen, setSvFormOpen] = useState(false);
  const [svWorkshopDisplay, setSvWorkshopDisplay] = useState('');
  const [svWorkshops, setSvWorkshops] = useState([]);
  const [svWorkshopsLoading, setSvWorkshopsLoading] = useState(false);

  // Order filters
  const [orderPage, setOrderPage] = useState(1);
  const [orderStatus, setOrderStatus] = useState('');

  const loadCameras = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCameras();
      setCameras(Array.isArray(res) ? res : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAiOrders({ page: orderPage, limit: 20, status: orderStatus, search: searchQ });
      setOrders(res || { data: [], total: 0, page: 1, totalPages: 1 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [orderPage, orderStatus, searchQ]);

  const loadStaffVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listStaffVehicles('1');
      setStaffVehicles(Array.isArray(res) ? res : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'cameras') loadCameras();
    if (tab === 'orders') loadOrders();
    if (tab === 'staff-vehicles') loadStaffVehicles();
  }, [tab, loadCameras, loadOrders, loadStaffVehicles]);

  useEffect(() => {
    if (!svFormOpen) return;
    let cancelled = false;
    (async () => {
      setSvWorkshopsLoading(true);
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
          setSvWorkshops(
            list.map((w) => ({
              id: String(w.id),
              label: String(w.name || '').trim() || `Workshop ${w.id}`,
            })),
          );
        }
      } catch {
        if (!cancelled) setSvWorkshops([]);
      } finally {
        if (!cancelled) setSvWorkshopsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [svFormOpen]);

  const handleSaveCamera = async (form) => {
    if (editCamera) {
      await updateCamera(String(editCamera.id), form);
    } else {
      await createCamera(form);
    }
    loadCameras();
  };

  const handleDeleteCamera = async (id) => {
    if (!window.confirm('Delete this camera?')) return;
    await deleteCamera(String(id));
    loadCameras();
  };

  const handleAddStaffVehicle = async (e) => {
    e.preventDefault();
    if (!svForm.workshopId) {
      alert('Please select a workshop');
      return;
    }
    try {
      await createStaffVehicle(svForm);
      setSvFormOpen(false);
      setSvForm({ workshopId: '', plateNumber: '', staffName: '' });
      setSvWorkshopDisplay('');
      loadStaffVehicles();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteStaffVehicle = async (id) => {
    if (!window.confirm('Remove this staff vehicle?')) return;
    await deleteStaffVehicle(String(id));
    loadStaffVehicles();
  };

  return (
    <div className="module-container" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>AI Camera System</h2>
          <p style={{ color: '#6C757D', fontSize: 13, margin: '4px 0 0' }}>
            Manage cameras, view vehicle detections & AI orders
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { if (tab === 'cameras') loadCameras(); if (tab === 'orders') loadOrders(); if (tab === 'staff-vehicles') loadStaffVehicles(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {tab === 'cameras' && (
            <button
              onClick={() => { setEditCamera(null); setFormOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#FFD700', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              <Plus size={16} /> Add Camera
            </button>
          )}
          {tab === 'staff-vehicles' && (
            <button
              onClick={() => setSvFormOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#FFD700', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              <Plus size={16} /> Add Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearchQ(''); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? '#000' : '#6C757D',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* CAMERAS TAB */}
      {tab === 'cameras' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading cameras...</div>
          ) : cameras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Camera size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No Cameras Yet</h3>
              <p style={{ color: '#6C757D', fontSize: 13, marginBottom: 16 }}>Add your first camera to start tracking vehicle entries.</p>
              <button
                onClick={() => { setEditCamera(null); setFormOpen(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: 'none', borderRadius: 8, background: '#FFD700', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                <Plus size={16} /> Add Camera
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {cameras.map(cam => (
                <motion.div
                  key={String(cam.id)}
                  whileHover={{ y: -3 }}
                  style={{
                    background: '#fff', borderRadius: 14, padding: 20,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: cam.cameraType === 'ENTRANCE' ? '#E8F5E9' : '#FFF3E0',
                      }}>
                        {cam.cameraType === 'ENTRANCE' ? <Video size={20} color="#2E7D32" /> : <Layers size={20} color="#E65100" />}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{cam.name}</h4>
                        <span style={{
                          fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                          color: cam.cameraType === 'ENTRANCE' ? '#2E7D32' : '#E65100',
                        }}>
                          {cam.cameraType === 'ENTRANCE' ? '🚗 Entrance' : '🔧 Service Bay'}
                        </span>
                      </div>
                    </div>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: cam.isActive ? '#4CAF50' : '#9E9E9E',
                      display: 'inline-block',
                    }} title={cam.isActive ? 'Active' : 'Inactive'} />
                  </div>

                  <div style={{ fontSize: 12, color: '#6C757D', marginBottom: 4 }}>
                    <Building size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Branch: <strong>{cam.branch?.name || cam.branchId}</strong>
                  </div>
                  {cam.department && (
                    <div style={{ fontSize: 12, color: '#6C757D', marginBottom: 4 }}>
                      <Layers size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Dept: <strong>{cam.department.name}</strong>
                    </div>
                  )}
                  {cam.deviceId && (
                    <div style={{ fontSize: 12, color: '#6C757D', fontFamily: 'monospace', marginBottom: 4 }}>
                      Device: {cam.deviceId}
                    </div>
                  )}
                  {cam.streamUrl && (
                    <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {cam.streamUrl.length > 60 ? cam.streamUrl.slice(0, 60) + '...' : cam.streamUrl}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 14, borderTop: '1px solid #F0F0F0', paddingTop: 12 }}>
                    <button
                      onClick={() => { setEditCamera(cam); setFormOpen(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCamera(cam.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #FECDD3', borderRadius: 6, background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* AI ORDERS TAB */}
      {tab === 'orders' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 12px', flex: 1, minWidth: 200 }}>
              <Search size={14} color="#9CA3AF" />
              <input
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setOrderPage(1); }}
                placeholder="Search by plate or capture no..."
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13 }}
              />
            </div>
            <select
              value={orderStatus}
              onChange={e => { setOrderStatus(e.target.value); setOrderPage(1); }}
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
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading orders...</div>
          ) : (orders.data || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Car size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No AI Orders Yet</h3>
              <p style={{ color: '#6C757D', fontSize: 13 }}>
                AI Orders will appear here when cameras detect vehicle plates.
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
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orders.data || []).map(order => {
                      const st = STATUS_COLORS[order.status] || STATUS_COLORS.VEHICLE_ENTERED;
                      return (
                        <tr key={String(order.id)} style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
                          onClick={() => setSelectedOrder(order)}>
                          <Td mono>{order.captureNo}</Td>
                          <Td><span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 14 }}>{order.plateNumber}</span></Td>
                          <Td><span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{st.label}</span></Td>
                          <Td>{order.branch?.name || '-'}</Td>
                          <Td>{order.entranceCamera?.name || '-'}</Td>
                          <Td>{new Date(order.entranceDetectedAt).toLocaleString()}</Td>
                          <Td>{order.isCompanyVehicle ? '✅' : '-'}</Td>
                          <Td><ChevronRight size={14} color="#9CA3AF" /></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13 }}>
                <span style={{ color: '#6C757D' }}>
                  Showing {((orders.page - 1) * 20) + 1}–{Math.min(orders.page * 20, orders.total)} of {orders.total}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled={orderPage <= 1} onClick={() => setOrderPage(p => p - 1)}
                    style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Previous
                  </button>
                  <button disabled={orderPage >= orders.totalPages} onClick={() => setOrderPage(p => p + 1)}
                    style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* STAFF VEHICLES TAB */}
      {tab === 'staff-vehicles' && (
        <>
          {svFormOpen && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <form onSubmit={handleAddStaffVehicle} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
                  <label className="form-label">Workshop *</label>
                  <SearchableEntityCombobox
                    options={svWorkshops}
                    value={svForm.workshopId}
                    displayText={svWorkshopDisplay}
                    onDisplayTextChange={setSvWorkshopDisplay}
                    onSelect={(opt) => {
                      setSvForm((f) => ({ ...f, workshopId: String(opt?.id || '') }));
                      setSvWorkshopDisplay('');
                    }}
                    placeholder="Search workshop…"
                    entityLabel="workshop"
                    loading={svWorkshopsLoading}
                    required
                    menuMinWidth={220}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                  <label className="form-label">Plate Number *</label>
                  <input className="form-input-field" placeholder="e.g. ABC1234" value={svForm.plateNumber}
                    onChange={e => setSvForm(f => ({ ...f, plateNumber: e.target.value }))} required />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                  <label className="form-label">Staff Name</label>
                  <input className="form-input-field" placeholder="e.g. Ahmed" value={svForm.staffName}
                    onChange={e => setSvForm(f => ({ ...f, staffName: e.target.value }))} />
                </div>
                <button type="submit"
                  style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#FFD700', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700, height: 38 }}>
                  Save
                </button>
                <button type="button" onClick={() => setSvFormOpen(false)}
                  style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, height: 38 }}>
                  Cancel
                </button>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C757D' }}>Loading...</div>
          ) : staffVehicles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Radio size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>No Staff Vehicles</h3>
              <p style={{ color: '#6C757D', fontSize: 13 }}>Register company vehicles so they're auto-flagged in AI Orders.</p>
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
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {staffVehicles.map(sv => (
                    <tr key={String(sv.id)} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <Td mono>{sv.plateNumber}</Td>
                      <Td>{sv.staffName || '-'}</Td>
                      <Td>
                        <span style={{
                          background: sv.isActive ? '#D4EDDA' : '#E2E3E5',
                          color: sv.isActive ? '#155724' : '#383D41',
                          padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                        }}>
                          {sv.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </Td>
                      <Td>{new Date(sv.createdAt).toLocaleDateString()}</Td>
                      <Td>
                        <button onClick={() => handleDeleteStaffVehicle(sv.id)}
                          style={{ border: '1px solid #FECDD3', borderRadius: 6, background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
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

      {/* Modals */}
      <AnimatePresence>
        {formOpen && (
          <CameraFormModal
            isOpen={formOpen}
            onClose={() => { setFormOpen(false); setEditCamera(null); }}
            onSave={handleSaveCamera}
            camera={editCamera}
          />
        )}
        {selectedOrder && (
          <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

const Th = ({ children }) => (
  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 800, color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
    {children}
  </th>
);

const Td = ({ children, mono }) => (
  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit' }}>
    {children}
  </td>
);
