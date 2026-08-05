import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Users,
    Plus,
    Pencil,
    Warehouse,
    ClipboardList,
    Truck,
    Calculator,
    UsersRound,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import {
    createSupplierStaff,
    listSupplierStaff,
    patchSupplierStaffDutyStatus,
    updateSupplierStaff,
} from '../../../services/supplierApi';
import { ShimmerKpiGrid, ShimmerTable } from '../../../components/supplier/Shimmer';
import {
    computeStaffRoleKpis,
    emptyStaffForm,
    formatStaffCreatedAt,
    listRowFromApiStaff,
    mapStaffRow,
    staffAvailabilityUi,
} from './supplierEmployeesUtils';
import './StaffEmployeesScreen.css';

const KPI_DEF = [
    { id: 'warehouse', label: 'WAREHOUSE INCHARGE', Icon: Warehouse },
    { id: 'order', label: 'ORDER PROCESSOR', Icon: ClipboardList },
    { id: 'driver', label: 'DRIVER', Icon: Truck },
    { id: 'accountant', label: 'ACCOUNTANT', Icon: Calculator },
    { id: 'supervisor', label: 'SUPERVISOR', Icon: UsersRound },
];

export default function SupplierEmployeesPage() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [form, setForm] = useState(emptyStaffForm);
    const [saveError, setSaveError] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);
    const [dutyLoadingId, setDutyLoadingId] = useState(null);
    const [toast, setToast] = useState(null);
    const [resolvedSupplierId, setResolvedSupplierId] = useState('default');

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        window.setTimeout(() => setToast(null), 2600);
    };

    const deriveSupplierId = () => {
        try {
            const raw = localStorage.getItem('filter_auth_user');
            if (!raw) return '';
            const u = JSON.parse(raw);
            return (
                u?.supplier?.supplierId ||
                u?.supplierId ||
                u?.supplier_id ||
                u?.supplier?.id ||
                ''
            );
        } catch {
            return '';
        }
    };

    const loadStaff = useCallback(async () => {
        setLoading(true);
        setApiError('');
        try {
            const supplierId = deriveSupplierId();
            if (!supplierId) {
                setResolvedSupplierId('');
                setList([]);
                setApiError('Supplier ID not found in login session. Please login again as supplier.');
                return [];
            }
            setResolvedSupplierId(String(supplierId));
            const res = await listSupplierStaff({ status: 'all', supplierId });
            const raw = Array.isArray(res?.staff)
                ? res.staff
                : Array.isArray(res?.data)
                  ? res.data
                  : Array.isArray(res?.items)
                    ? res.items
                    : Array.isArray(res?.supplierStaff)
                      ? res.supplierStaff
                      : [];
            let rows = raw.map(mapStaffRow).filter((x) => x && x.name);
            if (rows.length === 0) {
                const retry = await listSupplierStaff({ supplierId });
                const rawRetry = Array.isArray(retry?.staff)
                    ? retry.staff
                    : Array.isArray(retry?.data)
                      ? retry.data
                      : Array.isArray(retry?.items)
                        ? retry.items
                        : Array.isArray(retry?.supplierStaff)
                          ? retry.supplierStaff
                          : [];
                rows = rawRetry.map(mapStaffRow).filter((x) => x && x.name);
            }
            setList(rows);
            return rows;
        } catch (err) {
            console.error('Supplier staff API failed:', err);
            setList([]);
            setApiError(
                err?.message?.includes('401')
                    ? 'Unauthorized (401). Please sign in again.'
                    : err?.message || 'Failed to load staff',
            );
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStaff();
    }, [loadStaff]);

    const kpiCounts = useMemo(() => computeStaffRoleKpis(list), [list]);

    const openAdd = () => {
        setEditItem(null);
        setForm(emptyStaffForm);
        setSaveError('');
        setModalOpen(true);
    };

    const openEdit = (s) => {
        setEditItem(s);
        const sal = s.basicSalary != null ? String(s.basicSalary) : '0';
        setForm({
            name: s.name || '',
            phone: s.phone || '',
            email: s.email || '',
            role: s.role || '',
            basicSalary: sal === '' ? '0' : sal,
            status: s.status || 'active',
        });
        setSaveError('');
        setModalOpen(true);
    };

    const buildPayload = () => {
        const sal = Number.parseFloat(String(form.basicSalary ?? '0').replace(/,/g, ''));
        return {
            supplierId: String(resolvedSupplierId || ''),
            name: form.name.trim(),
            mobile: form.phone.trim(),
            email: form.email.trim() ? form.email.trim() : undefined,
            role: form.role.trim(),
            basicSalary: Number.isFinite(sal) && sal >= 0 ? sal : 0,
            isActive: form.status === 'active',
        };
    };

    const handleSave = async () => {
        if (!form.name?.trim() || !form.phone?.trim()) {
            setSaveError('Enter full name and mobile number.');
            return;
        }
        if (!form.role?.trim()) {
            setSaveError('Select a role.');
            return;
        }
        if (!resolvedSupplierId) {
            setSaveError('Supplier ID missing. Please re-login.');
            showToast('Supplier ID missing. Please re-login.', 'error');
            return;
        }
        setSaveError('');
        setSaveLoading(true);
        const editingSnapshot = editItem;
        try {
            const payload = buildPayload();
            const wasEdit = !!editingSnapshot;
            if (editingSnapshot) {
                const updated = await updateSupplierStaff(editingSnapshot.id, payload);
                const apiStaff = updated?.staff ?? updated?.data ?? updated;
                setList((prev) =>
                    prev.map((x) =>
                        String(x.id) === String(editingSnapshot.id)
                            ? listRowFromApiStaff(apiStaff, x)
                            : x,
                    ),
                );
            } else {
                const created = await createSupplierStaff(payload);
                const apiStaff = created?.staff ?? created?.data;
                let newRow = listRowFromApiStaff(apiStaff, null);
                if (!newRow?.id) {
                    newRow = mapStaffRow({
                        id:
                            apiStaff?.id ??
                            created?.supplierStaff?.id ??
                            created?.id ??
                            '',
                        name: form.name.trim(),
                        phone: form.phone.trim(),
                        email: form.email.trim(),
                        role: form.role.trim(),
                        basicSalary: String(payload.basicSalary ?? 0),
                        status: payload.isActive ? 'active' : 'inactive',
                        dutyStatus: null,
                        vehiclePlate: null,
                        department: apiStaff?.department ?? null,
                    });
                }
                if (newRow?.id) {
                    setList((prev) => {
                        const exists = prev.some((x) => String(x.id) === String(newRow.id));
                        if (exists) {
                            return prev.map((x) =>
                                String(x.id) === String(newRow.id) ? newRow : x,
                            );
                        }
                        return [newRow, ...prev];
                    });
                }
            }
            setModalOpen(false);
            setEditItem(null);
            setForm(emptyStaffForm);
            showToast(wasEdit ? 'Employee updated.' : 'Employee added.');
        } catch (err) {
            setSaveError(err?.message || 'Could not save employee');
            showToast(err?.message || 'Could not save employee', 'error');
        } finally {
            setSaveLoading(false);
        }
    };

    const toggleDutyBusy = async (row) => {
        if (row.status === 'inactive') {
            showToast('Inactive employees cannot change duty status.', 'warning');
            return;
        }
        const nextStatus = row.dutyStatus === 'busy' ? 'available' : 'busy';
        const prevDuty = row.dutyStatus;
        setDutyLoadingId(row.id);
        setList((prev) =>
            prev.map((x) =>
                String(x.id) === String(row.id) ? { ...x, dutyStatus: nextStatus } : x,
            ),
        );
        try {
            await patchSupplierStaffDutyStatus(row.id, { status: nextStatus });
            showToast(nextStatus === 'busy' ? 'Marked busy.' : 'Marked available.');
        } catch (err) {
            setList((prev) =>
                prev.map((x) =>
                    String(x.id) === String(row.id) ? { ...x, dutyStatus: prevDuty } : x,
                ),
            );
            showToast(err?.message || 'Could not update duty status', 'error');
        } finally {
            setDutyLoadingId(null);
        }
    };

    const fieldFull = { gridColumn: '1 / -1' };
    const primaryBtn = {
        padding: '10px 20px',
        borderRadius: 10,
        border: 'none',
        fontWeight: 800,
        fontSize: '0.875rem',
        cursor: saveLoading ? 'wait' : 'pointer',
        color: saveLoading ? '#ffffff' : '#111111',
        background: saveLoading ? '#6B7280' : 'var(--color-primary)',
    };
    const canSubmit =
        String(form.name || '').trim() &&
        String(form.phone || '').trim() &&
        String(form.role || '').trim();

    return (
        <div>
            {toast ? (
                <div
                    style={{
                        position: 'fixed',
                        top: 18,
                        right: 18,
                        zIndex: 1200,
                        padding: '10px 14px',
                        borderRadius: 10,
                        color: '#fff',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        background:
                            toast.type === 'error'
                                ? '#23262D'
                                : toast.type === 'warning'
                                  ? '#FCC245'
                                  : '#23262D',
                        color: toast.type === 'warning' ? '#23262D' : '#fff',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                    }}
                >
                    {toast.message}
                </div>
            ) : null}
            <div className="ws-page-header" style={{ alignItems: 'flex-start' }}>
                <div>
                    <h2 className="ws-page-title">Staff & Roles</h2>
                    <p className="ws-page-sub">Supplier & Warehouse Portal</p>
                </div>
                <button type="button" className="mgr-si-btn-new" onClick={openAdd}>
                    <Plus size={18} strokeWidth={2.5} /> Add Employee / Worker
                </button>
            </div>

            {apiError ? (
                <div className="theme-alert">
                    <strong>Could not load staff:</strong> {apiError}
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem' }}>
                        Supplier scope: <strong>{resolvedSupplierId}</strong>
                    </p>
                </div>
            ) : null}

            {loading ? (
                <>
                    <ShimmerKpiGrid cards={5} />
                    <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                        <ShimmerTable rows={8} columns={8} />
                    </div>
                </>
            ) : (
                <>
                    <div className="ws-kpi-grid">
                        {KPI_DEF.map(({ id, label, Icon }) => (
                            <div key={id} className="ws-kpi-card">
                                <div>
                                    <p className="ws-kpi-label">{label}</p>
                                    <p className="ws-kpi-value">{kpiCounts[id] ?? 0}</p>
                                </div>
                                <div className="ws-kpi-icon ws-kpi-icon--dark">
                                    <Icon size={22} strokeWidth={2} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                        {list.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                                <Users size={48} style={{ opacity: 0.25, margin: '0 auto 16px', display: 'block' }} />
                                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                    No employees yet
                                </p>
                                <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    Add your first warehouse or office worker using the button above.
                                </p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="ws-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Mobile</th>
                                            <th>Vehicle plate</th>
                                            <th>Availability</th>
                                            <th>Status</th>
                                            <th>Created</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {list.map((s) => (
                                            <tr key={s.id}>
                                                <td>
                                                    <strong>{s.name}</strong>
                                                </td>
                                                <td style={{ fontSize: '0.875rem' }}>{s.role || '—'}</td>
                                                <td style={{ fontSize: '0.875rem' }}>{s.phone || '—'}</td>
                                                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                                    {s.vehiclePlate || '—'}
                                                </td>
                                                <td style={{ fontSize: '0.875rem' }}>
                                                    {staffAvailabilityUi(s).label}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`ws-badge ${s.status === 'active' ? 'ws-badge--green' : 'ws-badge--gray'}`}
                                                    >
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td
                                                    style={{
                                                        fontSize: '0.8125rem',
                                                        color: 'var(--color-text-muted)',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                    title={
                                                        s.createdAt
                                                            ? new Date(s.createdAt).toISOString()
                                                            : undefined
                                                    }
                                                >
                                                    {formatStaffCreatedAt(s.createdAt)}
                                                </td>
                                                <td>
                                                    <RowActionsMenu
                                                        ariaLabel={`Actions for ${s.name || 'employee'}`}
                                                        items={[
                                                            {
                                                                label: 'Edit',
                                                                onClick: () => openEdit(s),
                                                            },
                                                            {
                                                                label:
                                                                    s.dutyStatus === 'busy'
                                                                        ? 'Mark available'
                                                                        : 'Mark busy',
                                                                onClick: () => toggleDutyBusy(s),
                                                                disabled:
                                                                    dutyLoadingId === s.id ||
                                                                    s.status === 'inactive',
                                                            },
                                                        ]}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={editItem ? 'Edit Employee / Worker' : 'Add Employee / Worker'}
                        width="min(520px, 94vw)"
                        onClose={() => {
                            if (!saveLoading) {
                                setModalOpen(false);
                                setEditItem(null);
                                setSaveError('');
                            }
                        }}
                        footer={
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 10,
                                    justifyContent: 'flex-end',
                                    flexWrap: 'wrap',
                                    width: '100%',
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={saveLoading}
                                    onClick={() => !saveLoading && setModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={saveLoading || !canSubmit}
                                    onClick={handleSave}
                                    style={{
                                        ...primaryBtn,
                                        opacity: saveLoading || !canSubmit ? 0.55 : 1,
                                    }}
                                >
                                    {saveLoading ? 'Saving…' : editItem ? 'Save changes' : 'Add Employee'}
                                </button>
                            </div>
                        }
                    >
                        {saveError ? (
                            <p
                                style={{
                                    margin: '0 0 12px 0',
                                    padding: 10,
                                    background: '#FEF2F2',
                                    borderRadius: 8,
                                    color: '#B91C1C',
                                    fontSize: '0.8125rem',
                                }}
                            >
                                {saveError}
                            </p>
                        ) : null}
                        <div className="ws-form-grid" style={{ gap: 14 }}>
                            <div className="ws-field" style={fieldFull}>
                                <label>Full Name *</label>
                                <input
                                    autoComplete="name"
                                    value={form.name}
                                    onChange={(e) => set('name', e.target.value)}
                                    placeholder="Full Name"
                                />
                            </div>
                            <div className="ws-field">
                                <label>Mobile *</label>
                                <input
                                    autoComplete="tel"
                                    value={form.phone}
                                    onChange={(e) => set('phone', e.target.value)}
                                    placeholder="05XXXXXXXX"
                                />
                            </div>
                            <div className="ws-field">
                                <label>Email</label>
                                <input
                                    type="email"
                                    autoComplete="email"
                                    value={form.email}
                                    onChange={(e) => set('email', e.target.value)}
                                    placeholder="Email"
                                />
                            </div>
                            <div className="ws-field" style={fieldFull}>
                                <label>Role *</label>
                                <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                                    <option value="">Select role</option>
                                    <option value="Warehouse Incharge">Warehouse Incharge</option>
                                    <option value="Order Processor">Order Processor</option>
                                    <option value="Driver">Driver</option>
                                    <option value="Accountant">Accountant</option>
                                    <option value="Supervisor">Supervisor</option>
                                    <option value="Finance">Finance</option>
                                    <option value="Warehouse Manager">Warehouse Manager</option>
                                    <option value="Picker / Packer">Picker / Packer</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>Basic Salary (SAR)</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.basicSalary}
                                    onChange={(e) => set('basicSalary', e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="ws-field">
                                <label>Status</label>
                                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
