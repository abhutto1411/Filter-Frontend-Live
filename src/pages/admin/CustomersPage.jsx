import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, Users, Building, Pencil, FileText, Loader, Check } from 'lucide-react';
import CustomersPageShell from '../../components/admin/CustomersPageShell';
import CorporateBillingSection from '../../components/admin/CorporateBillingSection';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/CustomersPage.css';
import '../../styles/admin/ApprovalsPage.css';
import {
    createCorporateCustomerDirect,
    getBranches,
    getCustomerDetails,
    getCustomers,
    getWorkshopOptions,
    updateCustomer,
} from '../../services/superAdminApi';
import { marketingListReferrers } from '../../services/superAdminMarketingApi';
import { parseAllCustomersRoute, customersRoutes, ALL_CUSTOMERS_BASE } from '../../utils/customersRoutes';

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
        crNumber: c.crNumber ?? '-',
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

const EMPTY_NEW_CUSTOMER = {
    companyName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    password: '',
    vatNumber: '',
    crNumber: '',
    referralId: '',
    selectedStoreIds: [],
};

export default function CustomersPage() {
    const { subTab } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { hasPermission } = useAuth();
    const visibleSubTabs = SUB_TABS.filter((t) => hasPermission(t.permission));
    const isAllCustomersPath = location.pathname.startsWith('/admin/customers/all-customers');
    const activeSub = isAllCustomersPath ? 'all-customers' : (subTab || 'all-customers');
    const route = parseAllCustomersRoute(location.pathname);
    const pageMode = Boolean(route);

    const goBack = useCallback(() => {
        navigate(ALL_CUSTOMERS_BASE);
    }, [navigate]);

    const isCustomersSubTabActive = (path) => {
        if (path === 'all-customers') {
            return location.pathname.startsWith('/admin/customers/all-customers');
        }
        const base = `/admin/customers/${path}`;
        return location.pathname === base || location.pathname.startsWith(`${base}/`);
    };
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
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

    const [editingCustomer, setEditingCustomer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [newCustomer, setNewCustomer] = useState(EMPTY_NEW_CUSTOMER);
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
        if (route?.screen === 'create') {
            setNewCustomer(EMPTY_NEW_CUSTOMER);
        }
    }, [route?.screen]);

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

    const buildEditingCustomerState = (c) => {
        const isCorp = c.customerType === 'corporate' || !!c.corporateAccount;
        return {
            id: c.id,
            workshopId: c.workshopId,
            workshopName: c.workshopName,
            name: c.name,
            customerType: isCorp ? 'corporate' : 'regular',
            mobile: c.mobile === '—' ? '' : (c.mobile ?? ''),
            whatsapp: c.whatsapp === '—' ? '' : (c.whatsapp ?? ''),
            taxId: c.taxId === '-' ? '' : (c.taxId ?? ''),
            crNumber: c.crNumber === '-' ? '' : (c.crNumber ?? ''),
            isActive: c.isActive !== false,
            corporateAccount: c.corporateAccount,
            companyName: c.corporateAccount?.companyName ?? '',
            contactPerson: c.corporateAccount?.contactPerson ?? '',
            loginEmail: '',
            newPassword: '',
            selectedStoreIds: [],
        };
    };

    const loadCorporateEditDetails = async (customerId) => {
        setEditFormLoading(true);
        try {
            const d = await getCustomerDetails(String(customerId));
            const raw = d?.data && typeof d.data === 'object' ? d.data : d;
            const portalUsers = raw?.corporateAccount?.portalUsers ?? [];
            const primary = portalUsers[0];
            const branchIds = raw?.corporateAccount?.selectedStoreIds;
            setEditingCustomer((prev) => {
                if (!prev || String(prev.id) !== String(customerId)) return prev;
                return {
                    ...prev,
                    loginEmail: primary?.email ?? '',
                    companyName: raw?.corporateAccount?.companyName ?? prev.companyName ?? '',
                    contactPerson: raw?.corporateAccount?.contactPerson ?? prev.contactPerson ?? '',
                    workshopId: raw?.customer?.workshopId != null ? String(raw.customer.workshopId) : prev.workshopId,
                    workshopName: raw?.customer?.workshopName ?? prev.workshopName,
                    selectedStoreIds: Array.isArray(branchIds) && branchIds.length > 0
                        ? branchIds.map((id) => String(id))
                        : (Array.isArray(prev.selectedStoreIds) ? prev.selectedStoreIds : []),
                };
            });
        } catch {
            /* ignore */
        } finally {
            setEditFormLoading(false);
        }
    };

    const openEdit = (c) => {
        const next = buildEditingCustomerState(c);
        setEditingCustomer(next);
        navigate(customersRoutes.edit(c.id), { state: { customer: c } });
    };

    const openDetails = (customerId) => {
        if (!customerId) return;
        navigate(customersRoutes.details(customerId));
    };

    const closeEdit = () => {
        goBack();
        setEditingCustomer(null);
        setEditFormLoading(false);
    };

    const closeDetails = () => {
        goBack();
        setDetailsData(null);
        setDetailsLoading(false);
    };

    useEffect(() => {
        if (route?.screen !== 'edit' || !route.id) return;

        const bootstrapEdit = (c) => {
            if (!c?.id) return;
            setEditingCustomer((prev) => {
                if (prev && String(prev.id) === String(c.id)) return prev;
                return buildEditingCustomerState(c);
            });
            const isCorp = c.customerType === 'corporate' || !!c.corporateAccount;
            if (isCorp) {
                loadCorporateEditDetails(String(c.id));
            } else {
                setEditFormLoading(false);
            }
        };

        const fromState = location.state?.customer;
        if (fromState && String(fromState.id) === route.id) {
            bootstrapEdit(fromState);
            return;
        }

        const fromList = customers.find((c) => String(c.id) === route.id);
        if (fromList) {
            bootstrapEdit(fromList);
            return;
        }

        let cancelled = false;
        getCustomerDetails(String(route.id))
            .then((d) => {
                if (cancelled) return;
                const raw = d?.data && typeof d.data === 'object' ? d.data : d;
                const c = raw?.customer ?? raw;
                if (!c?.id) return;
                bootstrapEdit({
                    id: String(c.id),
                    workshopId: c.workshopId != null ? String(c.workshopId) : '',
                    workshopName: c.workshopName ?? '—',
                    name: c.name ?? '—',
                    mobile: c.mobile ?? '—',
                    whatsapp: c.whatsapp ?? '—',
                    taxId: c.taxId ?? '-',
                    customerType: c.customerType === 'corporate' ? 'corporate' : 'regular',
                    isActive: c.isActive !== false,
                    corporateAccount: raw?.corporateAccount ?? c.corporateAccount ?? null,
                });
            })
            .catch(() => {});
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route?.screen, route?.id, location.state, customers]);

    useEffect(() => {
        if (route?.screen !== 'details' || !route.id) return;
        let cancelled = false;
        setDetailsLoading(true);
        setDetailsData(null);
        getCustomerDetails(String(route.id))
            .then((d) => {
                if (cancelled) return;
                setDetailsData(d?.data && typeof d.data === 'object' ? d.data : d);
            })
            .catch(() => {
                if (!cancelled) setDetailsData(null);
            })
            .finally(() => {
                if (!cancelled) setDetailsLoading(false);
            });
        return () => { cancelled = true; };
    }, [route?.screen, route?.id]);
    const handleSaveNew = async () => {
        const companyName = String(newCustomer.companyName || '').trim();
        const contactPerson = String(newCustomer.contactPerson || '').trim();
        const email = String(newCustomer.email || '').trim();
        const password = String(newCustomer.password || '').trim();
        const mobile = String(newCustomer.mobile || '').trim();
        if (!companyName || !contactPerson || !email || !password || !mobile) {
            alert('Company name, contact person, email, password, and mobile are required.');
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
                crNumber: String(newCustomer.crNumber || '').trim() || undefined,
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
            goBack();
            setNewCustomer(EMPTY_NEW_CUSTOMER);
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
                crNumber: String(editingCustomer.crNumber ?? '').trim() || undefined,
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
            closeEdit();
        } catch (e) {
            alert(e?.message || 'Failed to save customer');
        } finally {
            setSaving(false);
        }
    };

    const renderBranchPicker = (selectedIds, onToggle, className = '') => {
        const selectedCount = selectedIds.length;
        return (
        <div className={`customer-branch-picker customers-form-branch-picker ${className}`.trim()}>
            {selectedCount > 0 && (
                <div className="customer-branch-picker-summary">
                    {selectedCount} branch{selectedCount !== 1 ? 'es' : ''} selected
                </div>
            )}
            {workshops.length === 0 ? (
                <div className="customer-branch-picker-empty">No workshops available.</div>
            ) : (
                workshops.map((w) => {
                    const branchRows = allBranches.filter((b) => String(b.workshopId) === String(w.id));
                    if (branchRows.length === 0) return null;
                    const workshopSelected = branchRows.filter((b) => selectedIds.includes(String(b.id))).length;
                    return (
                        <div key={w.id} className="customer-branch-workshop-card">
                            <div className="customer-branch-workshop-head">
                                <Building size={15} strokeWidth={2} />
                                <span className="customer-branch-workshop-name">{w.name}</span>
                                {workshopSelected > 0 && (
                                    <span className="customer-branch-workshop-badge">
                                        {workshopSelected}/{branchRows.length}
                                    </span>
                                )}
                            </div>
                            <div className="customer-branch-tile-grid">
                                {branchRows.map((b) => {
                                    const checked = selectedIds.includes(String(b.id));
                                    return (
                                        <label
                                            key={b.id}
                                            className={`customer-branch-tile${checked ? ' selected' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="customer-branch-tile-input"
                                                checked={checked}
                                                onChange={(e) => onToggle(String(b.id), e.target.checked)}
                                            />
                                            <span className="customer-branch-tile-indicator" aria-hidden="true">
                                                {checked ? <Check size={13} strokeWidth={2.5} /> : null}
                                            </span>
                                            <span className="customer-branch-tile-label">{b.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
        );
    };

    if (pageMode) {
        return (
            <>
                {route?.screen === 'create' && (
                    <CustomersPageShell
                        title="Add Corporate Customer"
                        onClose={goBack}
                        fullWidth
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={goBack}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveNew} disabled={saving}>
                                    {saving ? <><Loader size={14} className="spin" /> Creating…</> : 'Create Customer'}
                                </button>
                            </>
                        }
                    >
                        <p className="customers-form-lead">
                            Register a new corporate account with portal login. The customer is auto-approved and can access selected workshop branches immediately.
                        </p>

                        <div className="customers-create-layout">
                            <div className="customers-create-main">
                                <section className="customers-form-section">
                                    <h2 className="customers-form-section-title">Company details</h2>
                                    <div className="customers-form-grid customers-form-grid--4">
                                        <div className="form-group">
                                            <label className="form-label">Company name *</label>
                                            <input
                                                type="text"
                                                className="form-input-field"
                                                placeholder="e.g. Filter Corp"
                                                value={newCustomer.companyName}
                                                onChange={(e) => setNewCustomer((p) => ({ ...p, companyName: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Contact person *</label>
                                            <input
                                                type="text"
                                                className="form-input-field"
                                                placeholder="Primary contact name"
                                                value={newCustomer.contactPerson}
                                                onChange={(e) => setNewCustomer((p) => ({ ...p, contactPerson: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Mobile *</label>
                                            <input
                                                type="text"
                                                className="form-input-field"
                                                placeholder="+966..."
                                                value={newCustomer.mobile}
                                                onChange={(e) => setNewCustomer((p) => ({ ...p, mobile: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">VAT number</label>
                                            <input
                                                type="text"
                                                className="form-input-field"
                                                placeholder="Optional"
                                                value={newCustomer.vatNumber}
                                                onChange={(e) => setNewCustomer((p) => ({ ...p, vatNumber: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">CR number</label>
                                            <input
                                                type="text"
                                                className="form-input-field"
                                                placeholder="Commercial registration"
                                                value={newCustomer.crNumber}
                                                onChange={(e) => setNewCustomer((p) => ({ ...p, crNumber: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="customers-form-section">
                                    <h2 className="customers-form-section-title">Portal login</h2>
                                    <div className="customers-form-grid customers-form-grid--3">
                                        <div className="form-group">
                                            <label className="form-label">Email *</label>
                                            <input
                                                type="email"
                                                className="form-input-field"
                                                placeholder="login@company.com"
                                                autoComplete="off"
                                                value={newCustomer.email}
                                                onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Password *</label>
                                            <input
                                                type="password"
                                                className="form-input-field"
                                                placeholder="Portal password"
                                                autoComplete="new-password"
                                                value={newCustomer.password}
                                                onChange={(e) => setNewCustomer((p) => ({ ...p, password: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Referral username</label>
                                            <select
                                                className="form-input-field"
                                                value={newCustomer.referralId}
                                                onChange={(e) => setNewCustomer((p) => ({ ...p, referralId: e.target.value }))}
                                            >
                                                <option value="">No referral</option>
                                                {referrerOptions.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.username}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <aside className="customers-create-branches">
                                <section className="customers-form-section customers-form-section--fill">
                                    <h2 className="customers-form-section-title">Branch access *</h2>
                                    <p className="customers-form-hint">Select which workshop branches this corporate account can use.</p>
                                    {renderBranchPicker(newCustomer.selectedStoreIds, (branchId, checked) => {
                                        setNewCustomer((prev) => ({
                                            ...prev,
                                            selectedStoreIds: checked
                                                ? [...prev.selectedStoreIds, branchId]
                                                : prev.selectedStoreIds.filter((id) => String(id) !== branchId),
                                        }));
                                    })}
                                </section>
                            </aside>
                        </div>
                    </CustomersPageShell>
                )}

                {route?.screen === 'edit' && editingCustomer && (
                    <CustomersPageShell
                        title="Edit Customer"
                        onClose={closeEdit}
                        backDisabled={saving}
                        fullWidth
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={closeEdit} disabled={saving}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveEdit} disabled={saving || editFormLoading}>{saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Save Changes'}</button>
                            </>
                        }
                    >
                        {editFormLoading ? (
                            <div className="table-empty"><Loader size={18} className="spin" /> Loading corporate login…</div>
                        ) : (() => {
                            const isCorp = editingCustomer.customerType === 'corporate' || !!editingCustomer.corporateAccount;
                            return (
                                <>
                                    <p className="customers-form-lead">
                                        {isCorp
                                            ? 'Update customer profile, corporate portal login, and branch access.'
                                            : 'Update walk-in customer contact details and account status.'}
                                    </p>
                                    <div className={`customers-create-layout${isCorp ? '' : ' customers-create-layout--single'}`}>
                                        <div className="customers-create-main">
                                            <section className="customers-form-section">
                                                <h2 className="customers-form-section-title">Customer profile</h2>
                                                <div className="customers-form-grid customers-form-grid--3">
                                                    <div className="form-group">
                                                        <label className="form-label">Customer name</label>
                                                        <input
                                                            type="text"
                                                            className="form-input-field"
                                                            value={editingCustomer.name}
                                                            onChange={(e) => setEditingCustomer((p) => ({ ...p, name: e.target.value }))}
                                                        />
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
                                                    <div className="form-group">
                                                        <label className="form-label">Mobile</label>
                                                        <input
                                                            type="text"
                                                            className="form-input-field"
                                                            value={editingCustomer.mobile}
                                                            onChange={(e) => setEditingCustomer((p) => ({ ...p, mobile: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">WhatsApp</label>
                                                        <input
                                                            type="text"
                                                            className="form-input-field"
                                                            value={editingCustomer.whatsapp}
                                                            onChange={(e) => setEditingCustomer((p) => ({ ...p, whatsapp: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">VAT number</label>
                                                        <input
                                                            type="text"
                                                            className="form-input-field"
                                                            value={editingCustomer.taxId}
                                                            onChange={(e) => setEditingCustomer((p) => ({ ...p, taxId: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">CR number</label>
                                                        <input
                                                            type="text"
                                                            className="form-input-field"
                                                            value={editingCustomer.crNumber ?? ''}
                                                            onChange={(e) => setEditingCustomer((p) => ({ ...p, crNumber: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                            </section>

                                            {isCorp && (
                                                <section className="customers-form-section">
                                                    <h2 className="customers-form-section-title">Corporate account</h2>
                                                    <div className="customers-form-grid customers-form-grid--3">
                                                        <div className="form-group">
                                                            <label className="form-label">Company name *</label>
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
                                                        <div className="form-group">
                                                            <label className="form-label">Portal email *</label>
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
                                                                placeholder="Leave empty to keep current"
                                                                value={editingCustomer.newPassword}
                                                                onChange={(e) => setEditingCustomer((p) => ({ ...p, newPassword: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div className="form-group span-2">
                                                            <label className="form-label">Primary workshop</label>
                                                            <input
                                                                type="text"
                                                                className="form-input-field"
                                                                readOnly
                                                                disabled
                                                                value={editingCustomer.workshopName || '—'}
                                                                title="Updates from the first selected branch on save."
                                                            />
                                                            <p className="customers-form-hint customers-form-hint--inline">
                                                                Anchor workshop follows the first selected branch when you save.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </section>
                                            )}
                                        </div>

                                        {isCorp && (
                                            <aside className="customers-create-branches">
                                                <section className="customers-form-section customers-form-section--fill">
                                                    <h2 className="customers-form-section-title">Branch access *</h2>
                                                    <p className="customers-form-hint">Select which workshop branches this corporate account can use.</p>
                                                    {renderBranchPicker(editingCustomer.selectedStoreIds || [], (branchId, checked) => {
                                                        setEditingCustomer((prev) => ({
                                                            ...prev,
                                                            selectedStoreIds: checked
                                                                ? [...(prev.selectedStoreIds || []), branchId]
                                                                : (prev.selectedStoreIds || []).filter((id) => String(id) !== branchId),
                                                        }));
                                                    })}
                                                </section>
                                            </aside>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </CustomersPageShell>
                )}

                {route?.screen === 'details' && (
                    <CustomersPageShell
                        title="Customer Details"
                        onClose={closeDetails}
                    >
                        {detailsLoading ? (
                            <div className="table-empty"><Loader size={18} className="spin" /> Loading details…</div>
                        ) : detailsData ? (
                            <div className="customers-form-stack">
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
                            </div>
                        ) : (
                            <div className="table-empty">No details found.</div>
                        )}
                    </CustomersPageShell>
                )}
            </>
        );
    }

    return (
        <div className="customers-page module-container">
            <div className="customers-sub-nav">
                {visibleSubTabs.map((t) => (
                    <NavLink
                        key={t.path}
                        to={`/admin/customers/${t.path}`}
                        className={() => `customers-sub-tab ${isCustomersSubTabActive(t.path) ? 'active' : ''}`}
                    >
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
                <button type="button" className="btn-portal" onClick={() => navigate(customersRoutes.create())}><Plus size={16} /> ADD CUSTOMER</button>
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
        </div>
    );
}
