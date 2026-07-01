import { useMemo, useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Search, Plus, Users, Building, Pencil, FileText, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import CorporateBillingSection from '../../components/admin/CorporateBillingSection';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/CustomersPage.css';
import {
    createCorporateCustomerDirect,
    getBranches,
    getCustomerDetails,
    getCustomers,
    getWorkshopOptions,
    updateCustomer,
} from '../../services/superAdminApi';
import { marketingListReferrers } from '../../services/superAdminMarketingApi';

const CORPORATE_BRANCH_CACHE_KEY = 'filter_corporate_branch_options_cache_v1';

function readCorporateBranchCache() {
    try {
        const raw = localStorage.getItem(CORPORATE_BRANCH_CACHE_KEY);
        if (!raw) return { workshops: [], branches: [] };
        const o = JSON.parse(raw);
        return {
            workshops: Array.isArray(o?.workshops) ? o.workshops : [],
            branches: Array.isArray(o?.branches) ? o.branches : [],
        };
    } catch {
        return { workshops: [], branches: [] };
    }
}

/** Super-admin customer add/edit: list workshops unless clearly not assignable. */
function isWorkshopShownForBranchPicker(w) {
    if (!w?.id) return false;
    const s = String(w.status ?? '').toLowerCase();
    if (!s) return true;
    if (s === 'rejected' || s === 'suspended' || s === 'inactive' || s === 'cancelled') return false;
    return true;
}

function mapCustomersResponse(d) {
    return (Array.isArray(d) ? d : (d?.customers ?? [])).map((c) => ({
        id: String(c.id ?? c._id ?? ''),
        workshopId: c.workshopId != null ? String(c.workshopId) : '',
        workshopName: c.workshopName ?? '—',
        name: c.name ?? c.companyName ?? '—',
        mobile: c.mobile ?? '—',
        whatsapp: c.whatsapp ?? '—',
        taxId: c.taxId ?? '-',
        customerType: c.customerType === 'corporate' ? 'corporate' : 'regular',
        isActive: c.isActive !== false,
        vehiclesCount: Number(c.vehiclesCount ?? 0),
        salesOrdersCount: Number(c.salesOrdersCount ?? 0),
        orderStats: {
            totalOrders: Number(c.orderStats?.totalOrders ?? 0),
            completedOrders: Number(c.orderStats?.completedOrders ?? 0),
            draftOrders: Number(c.orderStats?.draftOrders ?? 0),
        },
        corporateAccount: c.corporateAccount ?? null,
    }));
}

const SUB_TABS = [
    { path: 'all-customers',     label: 'All Customers',     permission: 'customers.all-customers.view' },
    { path: 'corporate-billing', label: 'Corporate Billing', permission: 'customers.corporate-billing.view' },
];

export default function CustomersPage() {
    const { subTab } = useParams();
    const { hasPermission } = useAuth();
    const visibleSubTabs = SUB_TABS.filter((t) => hasPermission(t.permission));
    const activeSub = subTab || 'all-customers';
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsData, setDetailsData] = useState(null);
    const branchCacheInit = readCorporateBranchCache();
    const [workshops, setWorkshops] = useState(() => branchCacheInit.workshops);
    const [allBranches, setAllBranches] = useState(() => branchCacheInit.branches);

    useEffect(() => {
        setLoading(true);
        getCustomers({ customerType: typeFilter === 'all' ? undefined : typeFilter })
            .then((d) => {
                setCustomers(mapCustomersResponse(d));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [typeFilter]);

    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        customerName: '',
        type: 'Corporate',
        mobile: '',
        email: '',
        vatNumber: '',
        status: 'Active',
        contactPerson: '',
        companyName: '',
        password: '',
        referralId: '',
        selectedStoreIds: [],
    });
    const [referrerOptions, setReferrerOptions] = useState([]);
    const [editFormLoading, setEditFormLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const normalizeWorkshop = (w) => ({
            id: String(w?.id ?? w?.value ?? ''),
            name: w?.name ?? w?.label ?? `Workshop ${w?.id ?? ''}`,
            status: String(w?.status ?? '').toLowerCase(),
        });
        const normalizeBranch = (b, workshopId = '') => ({
            id: String(b?.id ?? b?._id ?? ''),
            name: String(b?.name ?? 'Unnamed branch'),
            workshopId: String(b?.mainWorkshopId ?? b?.workshopId ?? workshopId ?? ''),
            workshopName: b?.mainWorkshopName ?? b?.workshopName ?? '',
        });
        const loadBranchOptions = async () => {
            try {
                const workshopsRes = await getWorkshopOptions();
                const workshopRows = Array.isArray(workshopsRes)
                    ? workshopsRes
                    : (workshopsRes?.options ?? workshopsRes?.workshops ?? workshopsRes?.data ?? []);
                let listedWorkshops = workshopRows
                    .map(normalizeWorkshop)
                    .filter(isWorkshopShownForBranchPicker);
                if (listedWorkshops.length === 0 && workshopRows.length > 0) {
                    listedWorkshops = workshopRows
                        .map(normalizeWorkshop)
                        .filter((w) => !!w.id);
                }
                if (cancelled) return;
                setWorkshops(listedWorkshops);
                const branchLists = await Promise.all(
                    listedWorkshops.map((w) =>
                        getBranches({ workshopId: w.id })
                            .then((res) => {
                                const rows = Array.isArray(res) ? res : (res?.branches ?? res?.data ?? []);
                                return rows.map((b) => normalizeBranch(b, w.id));
                            })
                            .catch(() => []),
                    ),
                );
                if (cancelled) return;
                const dedup = new Map();
                branchLists.flat().forEach((b) => {
                    if (!b.id) return;
                    if (!dedup.has(b.id)) dedup.set(b.id, b);
                });
                const branchRows = Array.from(dedup.values());
                setAllBranches(branchRows);
                try {
                    localStorage.setItem(
                        CORPORATE_BRANCH_CACHE_KEY,
                        JSON.stringify({
                            workshops: listedWorkshops,
                            branches: branchRows,
                            savedAt: Date.now(),
                        }),
                    );
                } catch {
                    /* ignore */
                }
            } catch {
                if (!cancelled) {
                    const fallback = readCorporateBranchCache();
                    setWorkshops(fallback.workshops);
                    setAllBranches(fallback.branches);
                }
            }
        };
        loadBranchOptions();
        return () => {
            cancelled = true;
        };
    }, []);

    const corporateCount = customers.filter((c) => c.customerType === 'corporate').length;
    const walkInCount = customers.filter((c) => c.customerType === 'regular').length;
    const filteredCustomers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter((c) =>
            [c.name, c.mobile, c.whatsapp, c.taxId, c.workshopName]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q)));
    }, [customers, search]);

    useEffect(() => {
        let cancelled = false;
        const normalizeReferrer = (r) => {
            const id = String(r?.id ?? r?.referrerId ?? r?.userId ?? '').trim();
            const username = String(
                r?.username
                ?? r?.userName
                ?? r?.name
                ?? r?.fullName
                ?? r?.displayName
                ?? r?.email
                ?? id,
            ).trim();
            return { id, username };
        };
        marketingListReferrers({ status: 'active' })
            .then((res) => {
                const rows = Array.isArray(res)
                    ? res
                    : (res?.referrers ?? res?.data ?? res?.items ?? []);
                if (cancelled) return;
                const dedup = new Map();
                rows.map(normalizeReferrer).forEach((r) => {
                    if (!r.id) return;
                    if (!dedup.has(r.id)) dedup.set(r.id, r);
                });
                setReferrerOptions(Array.from(dedup.values()));
            })
            .catch(() => {
                if (!cancelled) setReferrerOptions([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const openEdit = async (c) => {
        const isCorp = c.customerType === 'corporate' || !!c.corporateAccount;
        setEditingCustomer({
            id: c.id,
            workshopId: c.workshopId,
            workshopName: c.workshopName,
            name: c.name,
            customerType: isCorp ? 'corporate' : 'regular',
            mobile: c.mobile === '—' ? '' : (c.mobile ?? ''),
            whatsapp: c.whatsapp === '—' ? '' : (c.whatsapp ?? ''),
            taxId: c.taxId === '-' ? '' : (c.taxId ?? ''),
            isActive: c.isActive !== false,
            corporateAccount: c.corporateAccount,
            companyName: c.corporateAccount?.companyName ?? '',
            contactPerson: c.corporateAccount?.contactPerson ?? '',
            loginEmail: '',
            newPassword: '',
            selectedStoreIds: [],
        });
        setEditOpen(true);
        if (!isCorp) {
            setEditFormLoading(false);
            return;
        }
        setEditFormLoading(true);
        try {
            const d = await getCustomerDetails(String(c.id));
            const raw = d?.data && typeof d.data === 'object' ? d.data : d;
            const portalUsers = raw?.corporateAccount?.portalUsers ?? [];
            const primary = portalUsers[0];
            const branchIds = raw?.corporateAccount?.selectedStoreIds;
            setEditingCustomer((prev) => ({
                ...prev,
                loginEmail: primary?.email ?? '',
                companyName: raw?.corporateAccount?.companyName ?? prev.companyName ?? '',
                contactPerson: raw?.corporateAccount?.contactPerson ?? prev.contactPerson ?? '',
                workshopId: raw?.customer?.workshopId != null ? String(raw.customer.workshopId) : prev.workshopId,
                workshopName: raw?.customer?.workshopName ?? prev.workshopName,
                selectedStoreIds: Array.isArray(branchIds) && branchIds.length > 0
                    ? branchIds.map((id) => String(id))
                    : (Array.isArray(prev.selectedStoreIds) ? prev.selectedStoreIds : []),
            }));
        } catch {
            /* ignore */
        } finally {
            setEditFormLoading(false);
        }
    };
    const openDetails = async (customerId) => {
        if (!customerId) return;
        setDetailsOpen(true);
        setDetailsLoading(true);
        setDetailsData(null);
        try {
            const d = await getCustomerDetails(String(customerId));
            setDetailsData(d?.data && typeof d.data === 'object' ? d.data : d);
        } catch {
            setDetailsData(null);
        } finally {
            setDetailsLoading(false);
        }
    };
    const handleSaveNew = async () => {
        const type = String(newCustomer.type || 'Walk-in').toLowerCase();
        if (type !== 'corporate') {
            alert('Direct API create is currently enabled for Corporate only.');
            return;
        }
        const companyName = String(newCustomer.companyName || newCustomer.customerName || '').trim();
        const contactPerson = String(newCustomer.contactPerson || '').trim();
        const email = String(newCustomer.email || '').trim();
        const password = String(newCustomer.password || '').trim();
        const mobile = String(newCustomer.mobile || '').trim();
        if (!companyName || !contactPerson || !email || !password || !mobile) {
            alert('Company name, contact person, email, password, and mobile are required for corporate registration.');
            return;
        }
        if (!Array.isArray(newCustomer.selectedStoreIds) || newCustomer.selectedStoreIds.length === 0) {
            alert('Select at least one branch.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                companyName,
                vatNumber: String(newCustomer.vatNumber || '').trim() || undefined,
                contactPerson,
                email,
                password,
                selectedStoreIds: newCustomer.selectedStoreIds.map((id) => String(id)),
                referralId: String(newCustomer.referralId || '').trim() || undefined,
                mobile,
                autoApprove: true,
            };
            await createCorporateCustomerDirect(payload);
            const d = await getCustomers({ customerType: typeFilter === 'all' ? undefined : typeFilter });
            setCustomers(mapCustomersResponse(d));
            setCreateOpen(false);
            setNewCustomer({
                customerName: '',
                type: 'Corporate',
                mobile: '',
                email: '',
                vatNumber: '',
                status: 'Active',
                contactPerson: '',
                companyName: '',
                password: '',
                referralId: '',
                selectedStoreIds: [],
            });
        } catch (e) {
            alert(e?.message || 'Failed to create corporate account');
        } finally {
            setSaving(false);
        }
    };
    const handleSaveEdit = async () => {
        if (!editingCustomer) return;
        const isCorp = editingCustomer.customerType === 'corporate' || !!editingCustomer.corporateAccount;
        if (isCorp) {
            const em = String(editingCustomer.loginEmail ?? '').trim();
            if (!em) {
                alert('Corporate portal login email is required.');
                return;
            }
            if (!String(editingCustomer.companyName ?? '').trim()) {
                alert('Company name is required for corporate customers.');
                return;
            }
            if (!Array.isArray(editingCustomer.selectedStoreIds) || editingCustomer.selectedStoreIds.length === 0) {
                alert('Select at least one branch for this corporate account.');
                return;
            }
        }
        setSaving(true);
        try {
            const payload = {
                name: String(editingCustomer.name ?? '').trim() || undefined,
                mobile: String(editingCustomer.mobile ?? '').trim() || undefined,
                whatsapp: String(editingCustomer.whatsapp ?? '').trim() || undefined,
                taxId: String(editingCustomer.taxId ?? '').trim() || undefined,
                isActive: !!editingCustomer.isActive,
            };
            if (isCorp) {
                payload.companyName = String(editingCustomer.companyName ?? '').trim();
                payload.contactPerson = String(editingCustomer.contactPerson ?? '').trim() || undefined;
                payload.email = String(editingCustomer.loginEmail ?? '').trim();
                const np = String(editingCustomer.newPassword ?? '').trim();
                if (np) payload.newPassword = np;
                payload.selectedStoreIds = editingCustomer.selectedStoreIds.map((id) => String(id));
            }
            await updateCustomer(editingCustomer.id, payload);
            const d = await getCustomers({ customerType: typeFilter === 'all' ? undefined : typeFilter });
            setCustomers(mapCustomersResponse(d));
            setEditOpen(false);
            setEditingCustomer(null);
        } catch (e) {
            alert(e?.message || 'Failed to save customer');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="customers-page module-container">
            <div className="customers-sub-nav">
                {visibleSubTabs.map((t) => (
                    <NavLink key={t.path} to={`/admin/customers/${t.path}`} className={({ isActive }) => `customers-sub-tab ${isActive ? 'active' : ''}`}>
                        {t.label}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'all-customers' && (
            <>
            <div className="stats-mini-grid">
                <div className="stat-mini-card">
                    <Users size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Total Customers</p>
                        <h4 className="mini-val">{customers.length}</h4>
                    </div>
                </div>
                <div className="stat-mini-card">
                    <Building size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Corporate</p>
                        <h4 className="mini-val">{corporateCount}</h4>
                    </div>
                </div>
                <div className="stat-mini-card">
                    <Users size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Walk-in</p>
                        <h4 className="mini-val">{walkInCount}</h4>
                    </div>
                </div>
            </div>

            <div className="module-header-actions">
                <div className="search-bar-mini">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search customers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="billing-tabs" style={{ margin: 0 }}>
                    {[
                        { id: 'all', label: 'All' },
                        { id: 'regular', label: 'Walk-in' },
                        { id: 'corporate', label: 'Corporate' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            className={`billing-tab ${typeFilter === t.id ? 'active' : ''}`}
                            onClick={() => setTypeFilter(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <button type="button" className="btn-portal" onClick={() => setCreateOpen(true)}><Plus size={16} /> ADD CUSTOMER</button>
            </div>

            <section className="premium-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">CUSTOMER</th>
                            <th className="table-th">TYPE</th>
                            <th className="table-th">MOBILE</th>
                            <th className="table-th">WORKSHOP</th>
                            <th className="table-th">ORDER STATS</th>
                            <th className="table-th">CORPORATE</th>
                            <th className="table-th">STATUS</th>
                            <th className="table-th">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : filteredCustomers.map((c) => (
                            <tr key={c.id} className="table-row">
                                <td className="table-cell">
                                    <div className="cell-main-text">{c.name}</div>
                                    <div className="cell-sub-text">{c.customerType === 'corporate' ? 'Business Account' : 'Walk-in'}</div>
                                </td>
                                <td className="table-cell">
                                    <span className={`type-badge ${c.customerType === 'corporate' ? 'corporate' : 'walk-in'}`}>
                                        {c.customerType === 'corporate' ? 'Corporate' : 'Walk-in'}
                                    </span>
                                </td>
                                <td className="table-cell">{c.mobile}</td>
                                <td className="table-cell">{c.workshopName}</td>
                                <td className="table-cell">
                                    <div className="cell-sub-text">Total: {c.orderStats.totalOrders}</div>
                                    <div className="cell-sub-text">Completed: {c.orderStats.completedOrders} | Draft: {c.orderStats.draftOrders}</div>
                                </td>
                                <td className="table-cell">
                                    {c.corporateAccount ? (
                                        <span className="type-badge corporate">{c.corporateAccount.companyName ?? 'Corporate'}</span>
                                    ) : (
                                        <span className="cell-sub-text">—</span>
                                    )}
                                </td>
                                <td className="table-cell">
                                    <span className={`status-badge ${c.isActive ? 'status-completed' : 'status-warning'}`}>
                                        {c.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="table-cell">
                                    <button type="button" className="btn-edit" onClick={() => openDetails(c.id)}><FileText size={14} /> Details</button>
                                    <button type="button" className="btn-edit" onClick={() => openEdit(c)} style={{ marginLeft: 8 }}><Pencil size={14} /> Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            </>
            )}

            {activeSub === 'corporate-billing' && <CorporateBillingSection />}

            <AnimatePresence>
                {createOpen && (
                    <Modal
                        title="Add Customer"
                        onClose={() => setCreateOpen(false)}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveNew} disabled={saving}>
                                    {saving ? <><Loader size={14} className="spin" /> Creating…</> : 'Create Customer'}
                                </button>
                            </>
                        }
                    >
                        <div className="form-group">
                            <label className="form-label">Customer Name</label>
                            <input
                                type="text"
                                className="form-input-field"
                                placeholder="Full name or company"
                                value={newCustomer.customerName}
                                onChange={(e) => setNewCustomer((p) => ({ ...p, customerName: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select
                                className="form-input-field"
                                value={newCustomer.type}
                                onChange={(e) => setNewCustomer((p) => ({ ...p, type: e.target.value }))}
                            >
                                <option value="Corporate">Corporate</option>
                            </select>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Mobile</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="+966..."
                                    value={newCustomer.mobile}
                                    onChange={(e) => setNewCustomer((p) => ({ ...p, mobile: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-input-field"
                                    placeholder="email@example.com"
                                    value={newCustomer.email}
                                    onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">VAT Number</label>
                            <input
                                type="text"
                                className="form-input-field"
                                placeholder="Optional for Walk-in"
                                value={newCustomer.vatNumber}
                                onChange={(e) => setNewCustomer((p) => ({ ...p, vatNumber: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={newCustomer.status}
                                onChange={(e) => setNewCustomer((p) => ({ ...p, status: e.target.value }))}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        {String(newCustomer.type).toLowerCase() === 'corporate' && (
                            <>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Company Name *</label>
                                        <input
                                            type="text"
                                            className="form-input-field"
                                            placeholder="Filter Corp"
                                            value={newCustomer.companyName}
                                            onChange={(e) => setNewCustomer((p) => ({ ...p, companyName: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contact Person *</label>
                                        <input
                                            type="text"
                                            className="form-input-field"
                                            placeholder="John Doe"
                                            value={newCustomer.contactPerson}
                                            onChange={(e) => setNewCustomer((p) => ({ ...p, contactPerson: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Password *</label>
                                        <input
                                            type="password"
                                            className="form-input-field"
                                            placeholder="Password"
                                            value={newCustomer.password}
                                            onChange={(e) => setNewCustomer((p) => ({ ...p, password: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Referral Username</label>
                                        <select
                                            className="form-input-field"
                                            value={newCustomer.referralId}
                                            onChange={(e) => setNewCustomer((p) => ({ ...p, referralId: e.target.value }))}
                                        >
                                            <option value="">Optional (No referral)</option>
                                            {referrerOptions.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.username}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Select Branches *</label>
                                    <div className="customer-branch-picker">
                                        {workshops.length === 0 ? (
                                            <div className="cell-sub-text">No workshops available.</div>
                                        ) : (
                                            workshops.map((w) => {
                                                const branchRows = allBranches.filter((b) => String(b.workshopId) === String(w.id));
                                                if (branchRows.length === 0) return null;
                                                return (
                                                    <div key={w.id} className="customer-branch-workshop">
                                                        <div className="customer-branch-workshop-title">{w.name}</div>
                                                        <div className="customer-branch-list">
                                                            {branchRows.map((b) => {
                                                                const checked = newCustomer.selectedStoreIds.includes(String(b.id));
                                                                return (
                                                                    <label key={b.id} className="customer-branch-option">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checked}
                                                                            onChange={(e) =>
                                                                                setNewCustomer((prev) => ({
                                                                                    ...prev,
                                                                                    selectedStoreIds: e.target.checked
                                                                                        ? [...prev.selectedStoreIds, String(b.id)]
                                                                                        : prev.selectedStoreIds.filter((id) => String(id) !== String(b.id)),
                                                                                }))
                                                                            }
                                                                        />
                                                                        <span>{b.name}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </Modal>
                )}

                {editOpen && editingCustomer && (
                    <Modal
                        title="Edit Customer"
                        onClose={() => { setEditOpen(false); setEditingCustomer(null); setEditFormLoading(false); }}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setEditOpen(false); setEditingCustomer(null); setEditFormLoading(false); }}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveEdit} disabled={saving || editFormLoading}>{saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Save Changes'}</button>
                            </>
                        }
                    >
                        {editFormLoading ? (
                            <div className="table-empty"><Loader size={18} className="spin" /> Loading corporate login…</div>
                        ) : (
                            <>
                        <div className="form-group">
                            <label className="form-label">Customer Name</label>
                            <input type="text" className="form-input-field" value={editingCustomer.name} onChange={(e) => setEditingCustomer((p) => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select
                                className="form-input-field"
                                value={editingCustomer.customerType === 'corporate' ? 'Corporate' : 'Walk-in'}
                                onChange={(e) => setEditingCustomer((p) => ({ ...p, customerType: e.target.value === 'Corporate' ? 'corporate' : 'regular' }))}
                            >
                                <option value="Walk-in">Walk-in</option>
                                <option value="Corporate">Corporate</option>
                            </select>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Mobile</label>
                                <input type="text" className="form-input-field" value={editingCustomer.mobile} onChange={(e) => setEditingCustomer((p) => ({ ...p, mobile: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">WhatsApp</label>
                                <input type="text" className="form-input-field" value={editingCustomer.whatsapp} onChange={(e) => setEditingCustomer((p) => ({ ...p, whatsapp: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">VAT Number</label>
                            <input type="text" className="form-input-field" value={editingCustomer.taxId} onChange={(e) => setEditingCustomer((p) => ({ ...p, taxId: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={editingCustomer.isActive ? 'Active' : 'Inactive'}
                                onChange={(e) => setEditingCustomer((p) => ({ ...p, isActive: e.target.value === 'Active' }))}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        {(editingCustomer.customerType === 'corporate' || editingCustomer.corporateAccount) && (
                            <>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Company name</label>
                                        <input
                                            type="text"
                                            className="form-input-field"
                                            value={editingCustomer.companyName}
                                            onChange={(e) => setEditingCustomer((p) => ({ ...p, companyName: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contact person</label>
                                        <input
                                            type="text"
                                            className="form-input-field"
                                            value={editingCustomer.contactPerson}
                                            onChange={(e) => setEditingCustomer((p) => ({ ...p, contactPerson: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Corporate portal email</label>
                                    <input
                                        type="email"
                                        className="form-input-field"
                                        autoComplete="off"
                                        value={editingCustomer.loginEmail}
                                        onChange={(e) => setEditingCustomer((p) => ({ ...p, loginEmail: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">New password</label>
                                    <input
                                        type="password"
                                        className="form-input-field"
                                        autoComplete="new-password"
                                        placeholder="Leave empty to keep your current password"
                                        value={editingCustomer.newPassword}
                                        onChange={(e) => setEditingCustomer((p) => ({ ...p, newPassword: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Primary workshop</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        readOnly
                                        disabled
                                        value={editingCustomer.workshopName || '—'}
                                        title="Taken from the first selected branch (same as new corporate registration)."
                                    />
                                    <p className="cell-sub-text" style={{ marginTop: 6 }}>
                                        Changing branch selection updates the anchor workshop to match the first checked branch on save.
                                    </p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Corporate branches *</label>
                                    <div className="customer-branch-picker">
                                        {workshops.length === 0 ? (
                                            <div className="cell-sub-text">No workshops available.</div>
                                        ) : (
                                            workshops.map((w) => {
                                                const branchRows = allBranches.filter((b) => String(b.workshopId) === String(w.id));
                                                if (branchRows.length === 0) return null;
                                                return (
                                                    <div key={w.id} className="customer-branch-workshop">
                                                        <div className="customer-branch-workshop-title">{w.name}</div>
                                                        <div className="customer-branch-list">
                                                            {branchRows.map((b) => {
                                                                const checked = (editingCustomer.selectedStoreIds || []).includes(String(b.id));
                                                                return (
                                                                    <label key={b.id} className="customer-branch-option">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checked}
                                                                            onChange={(e) =>
                                                                                setEditingCustomer((prev) => ({
                                                                                    ...prev,
                                                                                    selectedStoreIds: e.target.checked
                                                                                        ? [...(prev.selectedStoreIds || []), String(b.id)]
                                                                                        : (prev.selectedStoreIds || []).filter((id) => String(id) !== String(b.id)),
                                                                                }))
                                                                            }
                                                                        />
                                                                        <span>{b.name}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                            </>
                        )}
                    </Modal>
                )}

                {detailsOpen && (
                    <Modal
                        title="Customer Details"
                        onClose={() => { setDetailsOpen(false); setDetailsData(null); }}
                    >
                        {detailsLoading ? (
                            <div className="table-empty"><Loader size={18} className="spin" /> Loading details…</div>
                        ) : detailsData ? (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Customer</label>
                                    <div className="cell-main-text">{detailsData.name ?? detailsData.customer?.name ?? '—'}</div>
                                    <div className="cell-sub-text">{detailsData.mobile ?? detailsData.customer?.mobile ?? '—'}</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <div className="cell-main-text">{(detailsData.customerType ?? detailsData.customer?.customerType ?? 'regular') === 'corporate' ? 'Corporate' : 'Walk-in'}</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Vehicles / Orders</label>
                                    <div className="cell-main-text">
                                        Vehicles: {Array.isArray(detailsData.vehicles) ? detailsData.vehicles.length : (detailsData.vehiclesCount ?? 0)}
                                    </div>
                                    <div className="cell-sub-text">
                                        Sales Orders: {Array.isArray(detailsData.salesOrders) ? detailsData.salesOrders.length : (detailsData.salesOrdersCount ?? 0)}
                                    </div>
                                </div>
                                {Array.isArray(detailsData.salesOrders) && detailsData.salesOrders.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Latest Orders</label>
                                        {detailsData.salesOrders.slice(0, 5).map((o, idx) => (
                                            <div key={String(o.id ?? o.orderNumber ?? idx)} className="cell-sub-text" style={{ marginBottom: 6 }}>
                                                {String(o.status ?? 'unknown')} | {String(o.source ?? '—')} | Invoice: {o.invoice?.invoiceNumber ?? '—'}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {detailsData.corporateAccount && (
                                    <div className="form-group">
                                        <label className="form-label">Corporate Account</label>
                                        <div className="cell-main-text">{detailsData.corporateAccount.companyName ?? '—'}</div>
                                        <div className="cell-sub-text">
                                            Credit: SAR {Number(detailsData.corporateAccount.creditLimit ?? 0).toFixed(2)} | Due: SAR {Number(detailsData.corporateAccount.dueBalance ?? 0).toFixed(2)}
                                        </div>
                                    </div>
                                )}
                                {Array.isArray(detailsData.corporateAccount?.portalUsers) && detailsData.corporateAccount.portalUsers.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Corporate portal email</label>
                                        {detailsData.corporateAccount.portalUsers.map((u) => (
                                            <div key={String(u.userId)} className="cell-sub-text" style={{ marginBottom: 4 }}>
                                                {u.email || '—'}
                                                {u.name ? ` · ${u.name}` : ''}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {Array.isArray(detailsData.corporateAccount?.corporateOrders) && detailsData.corporateAccount.corporateOrders.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Corporate Orders</label>
                                        {detailsData.corporateAccount.corporateOrders.slice(0, 5).map((co, idx) => (
                                            <div key={String(co.id ?? idx)} className="cell-sub-text" style={{ marginBottom: 6 }}>
                                                {co.status ?? '—'} | Linked SOs: {Array.isArray(co.linkedSalesOrders) ? co.linkedSalesOrders.length : 0}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="table-empty">No details found.</div>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
