import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, ChevronDown, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/EmployeesPage.css';
import {
    getTechnicians,
    getCashiers,
    createTechnician,
    createCashier,
    updateUser,
    getWorkshopOptions,
    getBranches,
} from '../../services/superAdminApi';

const EMPTY_EMPLOYEE = {
    name: '',
    mobile: '',
    email: '',
    iqama: '',
    branch: 'Select branch',
    department: '',
    role: 'cashier',
    isTechnician: false,
    basicSalary: '',
    commissionPercent: '0',
    commissionType: '% Revenue',
    status: 'Active'
};

export default function EmployeesPage() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE);
    const [editingId, setEditingId] = useState(null);
    const [roleFilter, setRoleFilter] = useState('All Roles');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [workshopFilter, setWorkshopFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const latestFetchRef = useRef(0);

    const inferRole = (emp) => {
        const raw = String(emp?.role ?? '').trim().toLowerCase();
        if (raw.includes('tech')) return 'technician';
        if (raw.includes('cash')) return 'cashier';
        if (emp?.technicianType) return 'technician';
        return raw || 'cashier';
    };

    const pickArray = (res, keys = []) => {
        if (Array.isArray(res)) return res;
        for (const key of keys) {
            if (Array.isArray(res?.[key])) return res[key];
            if (Array.isArray(res?.data?.[key])) return res.data[key];
        }
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.items)) return res.items;
        if (Array.isArray(res?.data?.items)) return res.data.items;
        return [];
    };

    const normalizeEmployee = (u, role) => ({
        id: String(u.id ?? u._id ?? ''),
        name: u.name ?? u.fullName ?? '—',
        mobile: u.mobile ?? u.phone ?? '—',
        email: u.email ?? '',
        role: u.position ?? role ?? u.role ?? u.userType ?? 'cashier',
        workshopName: u.workshopName ?? u.workshop?.name ?? '—',
        technicianType: u.technicianType ?? u.type ?? null,
        branch: u.branchName ?? u.branch?.name ?? '—',
        commission: u.commissionPercent != null ? `${u.commissionPercent}%` : '—',
        status: u.isActive === false ? 'inactive' : 'active',
    });

    const reloadEmployees = async () => {
        const fetchId = ++latestFetchRef.current;
        setLoading(true);
        const params = {
            workshopId: workshopFilter || undefined,
            branchId: branchFilter || undefined,
        };
        try {
            if (roleFilter === 'technician') {
                const techs = await getTechnicians(params);
                const techList = (Array.isArray(techs) ? techs : (techs?.technicians ?? techs?.data ?? []))
                    .map((u) => normalizeEmployee(u, 'technician'))
                    .filter((u) => inferRole(u) === 'technician');
                if (fetchId !== latestFetchRef.current) return;
                setEmployees(techList);
                return;
            }
            if (roleFilter === 'cashier') {
                const cashiers = await getCashiers(params);
                const cashierList = (Array.isArray(cashiers) ? cashiers : (cashiers?.cashiers ?? cashiers?.data ?? []))
                    .map((u) => normalizeEmployee(u, 'cashier'))
                    .filter((u) => inferRole(u) === 'cashier');
                if (fetchId !== latestFetchRef.current) return;
                setEmployees(cashierList);
                return;
            }
            const [techs, cashiers] = await Promise.all([
                getTechnicians(params),
                getCashiers(params),
            ]);
            const techList = (Array.isArray(techs) ? techs : (techs?.technicians ?? techs?.data ?? []))
                .map((u) => normalizeEmployee(u, 'technician'))
                .filter((u) => inferRole(u) === 'technician');
            const cashierList = (Array.isArray(cashiers) ? cashiers : (cashiers?.cashiers ?? cashiers?.data ?? []))
                .map((u) => normalizeEmployee(u, 'cashier'))
                .filter((u) => inferRole(u) === 'cashier');
            if (fetchId !== latestFetchRef.current) return;
            setEmployees([...techList, ...cashierList]);
        } catch {
            if (fetchId !== latestFetchRef.current) return;
            setEmployees([]);
        } finally {
            if (fetchId !== latestFetchRef.current) return;
            setLoading(false);
        }
    };

    useEffect(() => {
        getWorkshopOptions()
            .then((res) => {
                const rows = pickArray(res, ['options', 'workshops']);
                setWorkshopOptions(rows.map((w) => ({
                    id: String(w.id ?? w.value ?? w.workshopId ?? ''),
                    name: w.name ?? w.label ?? w.workshopName ?? `Workshop ${w.id ?? w.workshopId ?? ''}`,
                    status: String(w.status ?? '').toLowerCase(),
                })).filter((w) => w.id));
            })
            .catch(() => setWorkshopOptions([]));
    }, []);

    const approvedWorkshopOptions = workshopOptions.filter((w) => w.status === 'approved');

    useEffect(() => {
        if (!workshopFilter) {
            setBranchOptions([]);
            setBranchFilter('');
            return;
        }
        getBranches({ workshopId: workshopFilter })
            .then((res) => {
                const rows = pickArray(res, ['branches']);
                setBranchOptions(rows.map((b) => ({
                    id: String(b.id ?? b.value ?? b.branchId ?? ''),
                    name: b.name ?? b.branchName ?? b.label ?? `Branch ${b.id ?? ''}`,
                })).filter((b) => b.id));
            })
            .catch(() => setBranchOptions([]));
    }, [workshopFilter]);

    useEffect(() => {
        setEmployees([]);
        reloadEmployees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roleFilter, workshopFilter, branchFilter]);

    const total = employees.length;
    const activeCount = employees.filter((e) => e.status.toLowerCase() === 'active').length;
    const technicianCount = employees.filter((e) => inferRole(e) === 'technician').length;
    const onDutyCount = activeCount; // demo

    const openCreate = () => {
        setEmployeeForm(EMPTY_EMPLOYEE);
        setCreateOpen(true);
    };

    const openEdit = (emp) => {
        setEmployeeForm({ ...emp, isTechnician: emp.role === 'technician' });
        setEditingId(emp.id);
        setEditOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editOpen) {
                await updateUser(editingId, {
                    name: employeeForm.name,
                    email: employeeForm.email,
                    mobile: employeeForm.mobile,
                });
            } else if (employeeForm.role === 'technician') {
                await createTechnician({
                    name: employeeForm.name,
                    mobile: employeeForm.mobile,
                    email: employeeForm.email,
                    password: `Pass@${Date.now()}`,
                    technicianType: 'workshop',
                    commissionPercent: parseFloat(employeeForm.commissionPercent) || 0,
                });
            } else {
                await createCashier({
                    name: employeeForm.name,
                    mobile: employeeForm.mobile,
                    email: employeeForm.email,
                    password: `Pass@${Date.now()}`,
                });
            }
            await reloadEmployees();
            setCreateOpen(false);
            setEditOpen(false);
            setEmployeeForm(EMPTY_EMPLOYEE);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const filtered = employees.filter((e) => {
        const role = inferRole(e);
        if (roleFilter !== 'All Roles' && role !== roleFilter.toLowerCase()) return false;
        return true;
    });

    const EmployeeForm = () => (
        <div className="employee-form-container">
            <section className="form-section">
                <h4 className="form-section-title">BASIC INFORMATION</h4>
                <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                        type="text"
                        className="form-input-field"
                        placeholder="e.g. Al-Fahd Trading"
                        style={{ borderColor: '#FFD700' }}
                        value={employeeForm.name}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    />
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">Mobile *</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="05XXXXXXXX"
                            value={employeeForm.mobile}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, mobile: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input-field"
                            placeholder="email@example.com"
                            value={employeeForm.email}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                        />
                    </div>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">Iqama / CNIC</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Enter Iqama / CNIC"
                            value={employeeForm.iqama}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, iqama: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <div className="select-wrapper">
                            <select
                                className="form-input-field"
                                value={employeeForm.branch}
                                onChange={(e) => setEmployeeForm({ ...employeeForm, branch: e.target.value })}
                            >
                                <option>Select branch</option>
                                <option>Petromin Services</option>
                                <option>Main Branch</option>
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">Role</label>
                        <div className="select-wrapper">
                            <select
                                className="form-input-field"
                                value={employeeForm.role}
                                onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                            >
                                <option value="cashier">cashier</option>
                                <option value="technician">technician</option>
                                <option value="manager">manager</option>
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Department</label>
                        <div className="select-wrapper">
                            <select
                                className="form-input-field"
                                value={employeeForm.department || ''}
                                onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                            >
                                <option value="">Select department</option>
                                <option value="HR">HR</option>
                                <option value="IT">IT</option>
                                <option value="Finance">Finance</option>
                                <option value="Operations">Operations</option>
                                <option value="Sales">Sales</option>
                                <option value="Marketing">Marketing</option>
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>
                </div>
            </section>

            <div className="section-divider" />

            <section className="form-section">
                <h4 className="form-section-title">TECHNICIAN SETTINGS</h4>
                <div className="technician-toggle-row">
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={employeeForm.isTechnician}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, isTechnician: e.target.checked })}
                        />
                        <span className="slider round"></span>
                    </label>
                    <span className="toggle-label">This employee is a Technician</span>
                </div>
            </section>

            <div className="section-divider" />

            <section className="form-section">
                <h4 className="form-section-title">FINANCIAL</h4>
                <div className="form-grid-three">
                    <div className="form-group">
                        <label className="form-label">Basic Salary (SAR)</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="0"
                            value={employeeForm.basicSalary}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, basicSalary: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Commission %</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="0"
                            value={employeeForm.commissionPercent}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, commissionPercent: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Commission Type</label>
                        <div className="select-wrapper">
                            <select
                                className="form-input-field"
                                value={employeeForm.commissionType}
                                onChange={(e) => setEmployeeForm({ ...employeeForm, commissionType: e.target.value })}
                            >
                                <option>% Revenue</option>
                                <option>Fixed Amount</option>
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>
                </div>
                <div className="form-group" style={{ maxWidth: '240px' }}>
                    <label className="form-label">Status</label>
                    <div className="select-wrapper">
                        <select
                            className="form-input-field"
                            value={employeeForm.status}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })}
                        >
                            <option>Active</option>
                            <option>Inactive</option>
                        </select>
                        <ChevronDown size={16} className="select-icon" />
                    </div>
                </div>
            </section>

            <div className="info-notice-box">
                Login credentials will be sent to the employee via SMS & Email on save.
            </div>
        </div>
    );

    return (
        <div className="employees-page module-container">
            <header className="employees-page-header">
                <div>
                    <h1 className="employees-title">Employees & Technicians</h1>
                    <p className="employees-subtitle">{total} total · {technicianCount} technicians · {activeCount} active</p>
                </div>
                <button type="button" className="btn-portal" onClick={openCreate}><Plus size={16} /> Add Employee</button>
            </header>

            <div className="employees-stats">
                <div className="employees-stat-card"><span className="employees-stat-label">Total</span><span className="employees-stat-val">{total}</span></div>
                <div className="employees-stat-card"><span className="employees-stat-label">Active</span><span className="employees-stat-val">{activeCount}</span></div>
                <div className="employees-stat-card"><span className="employees-stat-label">Technicians</span><span className="employees-stat-val">{technicianCount}</span></div>
                <div className="employees-stat-card"><span className="employees-stat-label">On Duty</span><span className="employees-stat-val">{onDutyCount}</span></div>
            </div>

            <div className="employees-filters">
                <div className="employees-filters-main">
                    <div className="select-wrapper" style={{ minWidth: 220 }}>
                        <select
                            className="form-input-field"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="All Roles">All Roles</option>
                            <option value="cashier">Cashier</option>
                            <option value="technician">Technician</option>
                        </select>
                        <ChevronDown size={16} className="select-icon" />
                    </div>
                </div>

                <div className="employees-filters-selects">
                    <div className="select-wrapper">
                        <select
                            className="form-input-field"
                            value={workshopFilter}
                            onChange={(e) => {
                                setWorkshopFilter(e.target.value);
                                setBranchFilter('');
                            }}
                        >
                            <option value="">All Workshops</option>
                            {approvedWorkshopOptions.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="select-icon" />
                    </div>
                    <div className="select-wrapper">
                        <select
                            className="form-input-field"
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            disabled={!workshopFilter}
                        >
                            <option value="">All Branches</option>
                            {branchOptions.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="select-icon" />
                    </div>
                </div>
            </div>

            <section className="premium-table employees-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Employee</th>
                            <th className="table-th">Mobile</th>
                            <th className="table-th">Role</th>
                            <th className="table-th">Workshop</th>
                            <th className="table-th">Department</th>
                            <th className="table-th">Technician Type</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Commission</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : filtered.map((emp) => (
                            <tr key={`${inferRole(emp)}-${emp.id}`} className="table-row">
                                <td className="table-cell">
                                    <div className="employee-cell">
                                        <span className="employee-avatar">{emp.name.charAt(0)}</span>
                                        <div>
                                            <span className="cell-main-text">{emp.name}</span>
                                            {emp.role === 'technician' && <span className="employee-tech-badge">Tech</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="table-cell">{emp.mobile || '–'}</td>
                                <td className="table-cell" style={{ textTransform: 'capitalize' }}>{emp.role}</td>
                                <td className="table-cell">{emp.workshopName || '–'}</td>
                                <td className="table-cell">{emp.department || '–'}</td>
                                <td className="table-cell">{emp.technicianType || '–'}</td>
                                <td className="table-cell">{emp.branch}</td>
                                <td className="table-cell">{emp.commission}</td>
                                <td className="table-cell"><span className={`status-badge ${emp.status.toLowerCase() === 'active' ? 'status-completed' : 'status-warning'}`}>{emp.status}</span></td>
                                <td className="table-cell">
                                    <button type="button" className="btn-edit" onClick={() => openEdit(emp)}>
                                        <Pencil size={14} /> Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {(createOpen || editOpen) && (
                    <Modal
                        title={editOpen ? "Edit Employee" : "Add New Employee"}
                        onClose={() => { setCreateOpen(false); setEditOpen(false); }}
                        className="employee-modal-wide"
                        footer={
                            <div className="modal-footer-actions">
                                <button type="button" className="btn-secondary" onClick={() => { setCreateOpen(false); setEditOpen(false); }}>Cancel</button>
                                <button type="button" className="btn-portal btn-black" onClick={handleSave} disabled={saving}>
                                    {saving ? <><Loader size={14} className="spin" /> Saving…</> : editOpen ? 'Save Changes' : 'Create Employee'}
                                </button>
                            </div>
                        }
                    >
                        <EmployeeForm />
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
