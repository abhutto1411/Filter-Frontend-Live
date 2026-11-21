import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, NavLink, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { Search, Plus, Users, Building, Pencil, FileText, Loader } from 'lucide-react';
import CustomersPageShell from '../../components/admin/CustomersPageShell';
import MultiSelectSearchCombo from '../../components/MultiSelectSearchCombo';
import CorporateBillingSection from '../../components/admin/CorporateBillingSection';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/CustomersPage.css';
import '../../styles/admin/ApprovalsPage.css';
import '../../styles/ui.css';
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
import { custT, CUST_SUB_LABEL_KEYS } from '../../utils/customersI18n';
import {
    MANAGED_BY_HQ,
    MANAGED_BY_WORKSHOP,
    managedByChanged,
    managedByErrorKey,
    homeWorkshopChoices,
    managedByStoreError,
    ownerWorkshopRequired,
    normalizeManagedBy,
    deriveManagedBy,
    hqWorkshopIdFrom,
    isUsableBranchCache,
    rederiveEditManagedBy,
    groupedStoreOptions,
} from '../../utils/corporateManagedBy';
import {
    compactTaxId,
    corporateVatError,
    individualTaxIdError,
    taxIdChanged,
    taxIdText,
} from '../../utils/saudiTaxId';

// FINAL F1: v2 — v1 caches lack isPlatformHq.
const CORPORATE_BRANCH_CACHE_KEY = 'filter_corporate_branch_options_cache_v2';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function readCorporateBranchCache() {
    try {
        const raw = localStorage.getItem(CORPORATE_BRANCH_CACHE_KEY);
        if (!raw) return { workshops: [], branches: [] };
        const o = JSON.parse(raw);
        const savedAt = o?.savedAt || 0;
        if (Date.now() - savedAt > CACHE_TTL_MS) {
            localStorage.removeItem(CORPORATE_BRANCH_CACHE_KEY);
            return { workshops: [], branches: [] };
        }
        if (!isUsableBranchCache(o)) return { workshops: [], branches: [] };
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
    // FINAL F1: never drop the HQ row (managedBy needs its id).
    if (w.isPlatformHq === true) return true;
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
        nationalAddress: c.nationalAddress ?? '',
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
    { path: 'all-customers',     labelKey: 'sub.all',     permission: 'customers.all-customers.view' },
    { path: 'corporate-billing', labelKey: 'sub.billing', permission: 'customers.corporate-billing.view' },
];

const EMPTY_NEW_CUSTOMER = {
    companyName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    password: '',
    vatNumber: '',
    crNumber: '',
    nationalAddress: '',
    referralId: '',
    selectedStoreIds: [],
    managedBy: MANAGED_BY_HQ,
    ownerWorkshopId: '',
};

export default function CustomersPage() {
    const { subTab } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { hasPermission } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => custT(locale, key, vars), [locale]);
    const visibleSubTabs = SUB_TABS.filter((tab) => hasPermission(tab.permission));
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
    const [searchDebounced, setSearchDebounced] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsData, setDetailsData] = useState(null);
    const [customersTotal, setCustomersTotal] = useState(0);
    const [counts, setCounts] = useState({ all: 0, corporate: 0, regular: 0 });
    // Bumped after a create or an edit: both the page of rows and the three
    // stat cards refetch, and the list keeps the filter and page the user is
    // actually looking at (the old code refetched page one, unfiltered).
    const [reloadKey, setReloadKey] = useState(0);
    const paging = useServerPaging({ resetKey: `${typeFilter}|${searchDebounced}` });
    const { page: customersPage, pageSize: customersPageSize } = paging;
    const branchCacheInit = readCorporateBranchCache();
    const [workshops, setWorkshops] = useState(() => branchCacheInit.workshops);
    const [allBranches, setAllBranches] = useState(() => branchCacheInit.branches);

    useEffect(() => {
        setLoading(true);
        // Search runs server-side: the old client-side filter only ever saw the
        // first page the API would return (it caps `limit` at 200), so customers
        // past that cut-off were unfindable.
        getCustomers({
            customerType: typeFilter === 'all' ? undefined : typeFilter,
            limit: customersPageSize,
            offset: (customersPage - 1) * customersPageSize,
            search: searchDebounced.trim() || undefined,
        })
            .then((d) => {
                const data = d.data || d;
                setCustomers(mapCustomersResponse(data.customers || data));
                setCustomersTotal(data.total || 0);
            })
            .catch(() => {
                setCustomers([]);
                setCustomersTotal(0);
            })
            .finally(() => setLoading(false));
    }, [typeFilter, customersPage, customersPageSize, searchDebounced, reloadKey]);

    // The three stat cards read nothing but the `total` the API reports, so ask
    // for a single row each rather than a default page of 50 customers — which
    // also dragged in every one of those customers' sales orders. They don't
    // vary with the filter, the search or the page either, so they no longer
    // refire alongside the list.
    useEffect(() => {
        let cancelled = false;
        const totalOf = (res) => Number((res?.data || res)?.total ?? 0);
        Promise.all([
            getCustomers({ limit: 1 }),
            getCustomers({ customerType: 'corporate', limit: 1 }),
            getCustomers({ customerType: 'regular', limit: 1 }),
        ])
            .then(([allD, corpD, walkInD]) => {
                if (cancelled) return;
                setCounts({
                    all: totalOf(allD),
                    corporate: totalOf(corpD),
                    regular: totalOf(walkInD),
                });
            })
            .catch(() => {
                if (!cancelled) setCounts({ all: 0, corporate: 0, regular: 0 });
            });
        return () => { cancelled = true; };
    }, [reloadKey]);

    useEffect(() => {
        const t = setTimeout(() => {
            setSearchDebounced(search.trim());
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const [editingCustomer, setEditingCustomer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [newCustomer, setNewCustomer] = useState(EMPTY_NEW_CUSTOMER);
    const [referrerOptions, setReferrerOptions] = useState([]);
    const [editFormLoading, setEditFormLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const normalizeWorkshop = (w) => ({
            id: String(w?.id ?? w?.value ?? ''),
            name: w?.name ?? w?.label ?? t('fallback.workshop', { id: w?.id ?? '' }),
            status: String(w?.status ?? '').toLowerCase(),
            isPlatformHq: Boolean(w?.isPlatformHq),
        });
        const normalizeBranch = (b, workshopId = '') => ({
            id: String(b?.id ?? b?._id ?? ''),
            name: String(b?.name ?? t('fallback.branch')),
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
    }, [t]);

    // FINAL F1: HQ workshop id from the options (no ref race); when the
    // workshops arrive after the edit details, re-derive managedBy.
    const hqWorkshopId = useMemo(() => hqWorkshopIdFrom(workshops), [workshops]);
    // Effective edit state: re-derived from owner vs HQ whichever arrives last
    // (never over an API managedBy or a user change).
    const editingManaged = useMemo(
        () => rederiveEditManagedBy(editingCustomer, hqWorkshopId),
        [editingCustomer, hqWorkshopId],
    );

    const branchComboOptions = useMemo(() => {
        const workshopNameById = new Map(
            workshops.map((w) => [String(w.id), w.name || t('fallback.workshop', { id: w.id })]),
        );
        return allBranches
            .map((b) => {
                const workshopName =
                    workshopNameById.get(String(b.workshopId)) ||
                    b.workshopName ||
                    t('fallback.workshop', { id: b.workshopId || '' });
                const branchName = b.name || t('fallback.branch');
                return {
                    id: String(b.id),
                    label: `${branchName} · ${workshopName}`,
                    chipLabel: branchName,
                    hint: workshopName,
                    group: workshopName,
                    searchText: `${workshopName} ${branchName} ${b.id}`,
                };
            })
            .sort((a, b) => {
                const g = String(a.group).localeCompare(String(b.group), undefined, { sensitivity: 'base' });
                if (g !== 0) return g;
                return String(a.chipLabel).localeCompare(String(b.chipLabel), undefined, { sensitivity: 'base' });
            });
    }, [workshops, allBranches, t]);


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
            initialTaxId: c.taxId === '-' ? '' : (c.taxId ?? ''),
            crNumber: c.crNumber === '-' ? '' : (c.crNumber ?? ''),
            nationalAddress: c.nationalAddress ?? '',
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
                const savedTaxId = String(raw?.customer?.taxId ?? raw?.taxId ?? prev.taxId ?? '').trim() || prev.taxId || '';
                return {
                    ...prev,
                    taxId: savedTaxId,
                    initialTaxId: savedTaxId,
                    crNumber: String(raw?.customer?.crNumber ?? raw?.crNumber ?? prev.crNumber ?? '').trim() || prev.crNumber || '',
                    nationalAddress: raw?.customer?.nationalAddress ?? prev.nationalAddress ?? '',
                    mobile: String(raw?.customer?.mobile ?? raw?.mobile ?? prev.mobile ?? '').trim() || prev.mobile || '',
                    loginEmail: primary?.email ?? prev.loginEmail ?? '',
                    companyName: raw?.corporateAccount?.companyName ?? prev.companyName ?? '',
                    contactPerson: raw?.corporateAccount?.contactPerson ?? prev.contactPerson ?? '',
                    workshopId: raw?.customer?.workshopId != null ? String(raw.customer.workshopId) : prev.workshopId,
                    workshopName: raw?.customer?.workshopName ?? prev.workshopName,
                    // CLOSING F1: derive from owner vs HQ when the API omits managedBy.
                    managedByFromApi: Boolean(String(raw?.corporateAccount?.managedBy ?? '').trim()),
                    managedByTouched: false,
                    ownerWorkshopId: raw?.corporateAccount?.ownerWorkshopId ?? raw?.customer?.workshopId ?? null,
                    managedBy: deriveManagedBy(
                        {
                            managedBy: raw?.corporateAccount?.managedBy,
                            ownerWorkshopId: raw?.corporateAccount?.ownerWorkshopId ?? raw?.customer?.workshopId,
                            hqWorkshopId: null, // FINAL F1: re-derived via editingManaged
                        },
                        prev.managedBy || MANAGED_BY_HQ,
                    ),
                    initialManagedBy:
                        deriveManagedBy(
                            {
                                managedBy: raw?.corporateAccount?.managedBy,
                                ownerWorkshopId: raw?.corporateAccount?.ownerWorkshopId ?? raw?.customer?.workshopId,
                                hqWorkshopId: null, // FINAL F1: re-derived via editingManaged
                            },
                            null,
                        ) || prev.initialManagedBy || null,
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
                    crNumber: c.crNumber ?? '-',
                    nationalAddress: c.nationalAddress ?? '',
                    customerType: c.customerType === 'corporate' ? 'corporate' : 'regular',
                    isActive: c.isActive !== false,
                    corporateAccount: raw?.corporateAccount ?? c.corporateAccount ?? null,
                });
            })
            .catch(() => {});
        return () => { cancelled = true; };
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
    const newVatError = corporateVatError(newCustomer.vatNumber, locale);
    const editIsCorp = !!editingCustomer && (editingCustomer.customerType === 'corporate' || !!editingCustomer.corporateAccount);
    const editTaxIdError = editingCustomer
        ? (editIsCorp ? corporateVatError : individualTaxIdError)(editingCustomer.taxId, locale)
        : '';
    const editTaxIdChanged = !!editingCustomer && taxIdChanged(editingCustomer.taxId, editingCustomer.initialTaxId);

    const handleSaveNew = async () => {
        const companyName = String(newCustomer.companyName || '').trim();
        const contactPerson = String(newCustomer.contactPerson || '').trim();
        const email = String(newCustomer.email || '').trim();
        const password = String(newCustomer.password || '').trim();
        const mobile = String(newCustomer.mobile || '').trim();
        if (!companyName || !contactPerson || !email || !password || !mobile) {
            alert(t('err.createRequired'));
            return;
        }
        if (!Array.isArray(newCustomer.selectedStoreIds) || newCustomer.selectedStoreIds.length === 0) {
            alert(t('err.selectBranch'));
            return;
        }
        {
            const mbErr = ownerWorkshopRequired({
                managedBy: newCustomer.managedBy,
                ownerWorkshopId: newCustomer.ownerWorkshopId,
            });
            if (mbErr) {
                alert(t(mbErr));
                return;
            }
        }
        if (newVatError) {
            alert(newVatError);
            return;
        }
        setSaving(true);
        try {
            const vat = compactTaxId(newCustomer.vatNumber) || undefined;
            const payload = {
                companyName,
                vatNumber: vat,
                taxId: vat,
                crNumber: String(newCustomer.crNumber || '').trim() || undefined,
                nationalAddress: String(newCustomer.nationalAddress || '').trim() || undefined,
                contactPerson,
                email,
                password,
                selectedStoreIds: newCustomer.selectedStoreIds.map((id) => String(id)),
                referralId: String(newCustomer.referralId || '').trim() || undefined,
                mobile,
                autoApprove: true,
                managedBy: normalizeManagedBy(newCustomer.managedBy),
            };
            if (normalizeManagedBy(newCustomer.managedBy) === MANAGED_BY_WORKSHOP) {
                payload.ownerWorkshopId = String(newCustomer.ownerWorkshopId || '').trim();
            }
            await createCorporateCustomerDirect(payload);
            setReloadKey((k) => k + 1);
            goBack();
            setNewCustomer(EMPTY_NEW_CUSTOMER);
        } catch (e) {
            const k = managedByErrorKey(e);
            alert(k ? `${t(k)}\n${e?.message || ''}` : e?.message || t('err.createFail'));
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
                alert(t('err.emailRequired'));
                return;
            }
            if (!String(editingCustomer.companyName ?? '').trim()) {
                alert(t('err.companyRequired'));
                return;
            }
            if (!Array.isArray(editingCustomer.selectedStoreIds) || editingCustomer.selectedStoreIds.length === 0) {
                alert(t('err.selectBranchCorp'));
                return;
            }
            const managerChanged = managedByChanged(editingManaged.initialManagedBy, editingManaged.managedBy);
            const mbErr = ownerWorkshopRequired({
                managedBy: editingManaged.managedBy,
                ownerWorkshopId: editingCustomer.ownerWorkshopId,
                managerChanged,
            });
            if (mbErr) {
                alert(t(mbErr));
                return;
            }
        }
        if (editTaxIdChanged && editTaxIdError) {
            alert(editTaxIdError);
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: String(editingCustomer.name ?? '').trim() || undefined,
                mobile: String(editingCustomer.mobile ?? '').trim() || undefined,
                whatsapp: String(editingCustomer.whatsapp ?? '').trim() || undefined,
                taxId: editTaxIdChanged
                    ? (compactTaxId(editingCustomer.taxId) || undefined)
                    : (String(editingCustomer.taxId ?? '').trim() || undefined),
                crNumber: String(editingCustomer.crNumber ?? '').trim() || undefined,
                nationalAddress: String(editingCustomer.nationalAddress ?? '').trim(),
                isActive: !!editingCustomer.isActive,
            };
            if (isCorp) {
                payload.companyName = String(editingCustomer.companyName ?? '').trim();
                payload.contactPerson = String(editingCustomer.contactPerson ?? '').trim() || undefined;
                payload.email = String(editingCustomer.loginEmail ?? '').trim();
                const np = String(editingCustomer.newPassword ?? '').trim();
                if (np) payload.newPassword = np;
                payload.selectedStoreIds = editingCustomer.selectedStoreIds.map((id) => String(id));
                // CORPORATE-FIX-02: owner moves only on an explicit, confirmed manager change.
                if (managedByChanged(editingManaged.initialManagedBy, editingManaged.managedBy)) {
                    if (!window.confirm(t('confirm.ownerChange'))) {
                        setSaving(false);
                        return;
                    }
                    payload.managedBy = normalizeManagedBy(editingManaged.managedBy);
                    payload.confirmOwnerChange = true;
                    if (normalizeManagedBy(editingManaged.managedBy) === MANAGED_BY_WORKSHOP) {
                        payload.ownerWorkshopId = String(editingCustomer.ownerWorkshopId || '').trim();
                    }
                }
            }
            await updateCustomer(editingCustomer.id, payload);
            setReloadKey((k) => k + 1);
            closeEdit();
        } catch (e) {
            const k = managedByErrorKey(e);
            alert(k ? `${t(k)}\n${e?.message || ''}` : e?.message || t('err.saveFail'));
        } finally {
            setSaving(false);
        }
    };

    /** CORPORATE-FIX-02 G1: who bills and collects this account. */
    const renderManagedByField = (value, onChange) => (
        <div className="ui-field ui-col-6" data-testid="corp-managed-by">
            <label>{t('label.managedBy')}</label>
            <select
                className="ui-input"
                value={normalizeManagedBy(value)}
                onChange={(e) => onChange(normalizeManagedBy(e.target.value))}
            >
                <option value={MANAGED_BY_HQ}>{t('managedBy.hq')}</option>
                <option value={MANAGED_BY_WORKSHOP}>{t('managedBy.workshop')}</option>
            </select>
            <p className="ui-help">
                {normalizeManagedBy(value) === MANAGED_BY_HQ ? t('managedBy.hqHint') : t('managedBy.workshopHint')}
            </p>
        </div>
    );

    const renderHomeWorkshop = ({ managedBy, selectedIds, value, onChange, readOnly, readOnlyName }) => {
        if (normalizeManagedBy(managedBy) !== MANAGED_BY_WORKSHOP) return null;
        if (readOnly) {
            return (
                <div className="ui-field ui-col-6" data-testid="corp-home-workshop">
                    <label>{t('label.homeWorkshop')}</label>
                    <input className="ui-input" value={readOnlyName || ''} readOnly />
                    <p className="ui-help">{t('hint.workshopAnchor')}</p>
                </div>
            );
        }
        const choices = homeWorkshopChoices(selectedIds, allBranches, workshops);
        return (
            <div className="ui-field ui-col-6" data-testid="corp-home-workshop">
                <label>{t('label.homeWorkshop')}</label>
                <select className="ui-input" value={String(value || '')} onChange={(e) => onChange(e.target.value)}>
                    <option value="">{t('err.ownerWorkshopRequired')}</option>
                    {choices.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
        );
    };

    const renderBranchPicker = (selectedIds, onChangeIds, managedBy = MANAGED_BY_HQ) => {
        const selectedCount = selectedIds.length;
        // CLOSING F1: grouped by workshop; workshop-managed locks to the first store's workshop.
        const pickerOptions = groupedStoreOptions(branchComboOptions, {
            managedBy,
            selectedIds,
            branches: allBranches,
        });
        return (
        <div className="customer-branch-combo ui-stack-sm">
            {workshops.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Building size={18} /></div>
                    <div className="ui-empty-title">{t('picker.noWorkshops')}</div>
                </div>
            ) : (
                <>
                    <MultiSelectSearchCombo
                        options={pickerOptions}
                        value={selectedIds}
                        onChange={onChangeIds}
                        placeholder={t('picker.searchPh')}
                        emptyHint={t('picker.empty')}
                        clearLabel={t('picker.clear')}
                        menuMinWidth={420}
                    />
                    {selectedCount > 0 && (
                        <p className="ui-help">
                            {t(selectedCount === 1 ? 'picker.selected' : 'picker.selectedPlural', { n: selectedCount })}
                        </p>
                    )}
                </>
            )}
        </div>
        );
    };

    if (pageMode) {
        return (
            <>
                {route?.screen === 'create' && (
                    <CustomersPageShell
                        title={t('create.title')}
                        onClose={goBack}
                        fullWidth
                        footer={
                            <>
                                <button type="button" className="ui-btn ui-btn--default" onClick={goBack}>{t('btn.cancel')}</button>
                                <button type="button" className="ui-btn ui-btn--primary" onClick={handleSaveNew} disabled={saving}>
                                    {saving ? <><Loader size={14} className="ui-spin" /> {t('btn.creating')}</> : t('btn.create')}
                                </button>
                            </>
                        }
                    >
                        <p className="ui-lead">
                            {t('create.lead')}
                        </p>

                        <section className="ui-section">
                            <h2>{t('section.company')}</h2>
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-3">
                                    <label>{t('label.companyName')}</label>
                                    <input
                                        type="text"
                                        className="ui-input"
                                        placeholder={t('ph.company')}
                                        value={newCustomer.companyName}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, companyName: e.target.value }))}
                                    />
                                </div>
                                <div className="ui-field ui-col-3">
                                    <label>{t('label.contactPerson')}</label>
                                    <input
                                        type="text"
                                        className="ui-input"
                                        placeholder={t('ph.contact')}
                                        value={newCustomer.contactPerson}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, contactPerson: e.target.value }))}
                                    />
                                </div>
                                <div className="ui-field ui-col-3">
                                    <label>{t('label.mobileReq')}</label>
                                    <input
                                        type="text"
                                        className="ui-input"
                                        placeholder={t('ph.mobile')}
                                        value={newCustomer.mobile}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, mobile: e.target.value }))}
                                    />
                                </div>
                                <div className="ui-field ui-col-3">
                                    <label>{t('label.vat')}</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={20}
                                        className={`ui-input${newVatError ? ' ui-input--err' : ''}`}
                                        placeholder={t('ph.optional')}
                                        value={newCustomer.vatNumber}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, vatNumber: e.target.value }))}
                                    />
                                    <p className={`ui-help${newVatError ? ' ui-help--err' : ''}`}>
                                        {newVatError || taxIdText(locale, 'vatHint')}
                                    </p>
                                </div>
                                <div className="ui-field ui-col-3">
                                    <label>{t('label.cr')}</label>
                                    <input
                                        type="text"
                                        className="ui-input"
                                        placeholder={t('ph.cr')}
                                        value={newCustomer.crNumber}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, crNumber: e.target.value }))}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{taxIdText(locale, 'nationalAddress')}</label>
                                    <input
                                        type="text"
                                        className="ui-input"
                                        placeholder={taxIdText(locale, 'nationalAddressPh')}
                                        value={newCustomer.nationalAddress}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, nationalAddress: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="ui-section">
                            <h2>{t('section.branches')}</h2>
                            {renderManagedByField(newCustomer.managedBy, (v) =>
                                setNewCustomer((p) => ({ ...p, managedBy: v })),
                            )}
                            {renderHomeWorkshop({
                                managedBy: newCustomer.managedBy,
                                selectedIds: newCustomer.selectedStoreIds,
                                value: newCustomer.ownerWorkshopId,
                                onChange: (id) => setNewCustomer((p) => ({ ...p, ownerWorkshopId: id })),
                            })}
                            <p className="ui-note">{t('hint.branches')}</p>
                            {renderBranchPicker(newCustomer.selectedStoreIds, (ids) => {
                                setNewCustomer((prev) => ({
                                    ...prev,
                                    selectedStoreIds: (ids || []).map(String),
                                }));
                            }, newCustomer.managedBy)}
                        </section>

                        <section className="ui-section">
                            <h2>{t('section.portal')}</h2>
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-4">
                                    <label>{t('label.email')}</label>
                                    <input
                                        type="email"
                                        className="ui-input"
                                        placeholder={t('ph.email')}
                                        autoComplete="off"
                                        value={newCustomer.email}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label>{t('label.password')}</label>
                                    <input
                                        type="password"
                                        className="ui-input"
                                        placeholder={t('ph.password')}
                                        autoComplete="new-password"
                                        value={newCustomer.password}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, password: e.target.value }))}
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label>{t('label.referral')}</label>
                                    <select
                                        className="ui-select"
                                        value={newCustomer.referralId}
                                        onChange={(e) => setNewCustomer((p) => ({ ...p, referralId: e.target.value }))}
                                    >
                                        <option value="">{t('opt.noReferral')}</option>
                                        {referrerOptions.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </section>
                    </CustomersPageShell>
                )}

                {route?.screen === 'edit' && editingCustomer && (
                    <CustomersPageShell
                        title={t('edit.title')}
                        onClose={closeEdit}
                        backDisabled={saving}
                        fullWidth
                        footer={
                            <>
                                <button type="button" className="ui-btn ui-btn--default" onClick={closeEdit} disabled={saving}>{t('btn.cancel')}</button>
                                <button type="button" className="ui-btn ui-btn--primary" onClick={handleSaveEdit} disabled={saving || editFormLoading}>{saving ? <><Loader size={14} className="ui-spin" /> {t('btn.saving')}</> : t('btn.save')}</button>
                            </>
                        }
                    >
                        {editFormLoading ? (
                            <div className="ui-form-grid" aria-label={t('loading.login')} aria-busy="true">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={`sk-${i}`} className="ui-field ui-col-4 ui-sk-row">
                                        <div className="ui-sk ui-sk--label ui-sk--w40" />
                                        <div className="ui-sk ui-sk--input" />
                                    </div>
                                ))}
                            </div>
                        ) : (() => {
                            const isCorp = editingCustomer.customerType === 'corporate' || !!editingCustomer.corporateAccount;
                            return (
                                <>
                                    <p className="ui-lead">
                                        {isCorp ? t('edit.leadCorp') : t('edit.leadWalkIn')}
                                    </p>
                                    <section className="ui-section">
                                        <h2>{t('section.profile')}</h2>
                                        <div className="ui-form-grid">
                                            <div className="ui-field ui-col-4">
                                                <label>{t('label.customerName')}</label>
                                                <input
                                                    type="text"
                                                    className="ui-input"
                                                    value={editingCustomer.name}
                                                    onChange={(e) => setEditingCustomer((p) => ({ ...p, name: e.target.value }))}
                                                />
                                            </div>
                                            <div className="ui-field ui-col-4">
                                                <label>{t('label.type')}</label>
                                                <select
                                                    className="ui-select"
                                                    value={editingCustomer.customerType === 'corporate' ? 'Corporate' : 'Walk-in'}
                                                    onChange={(e) => setEditingCustomer((p) => ({ ...p, customerType: e.target.value === 'Corporate' ? 'corporate' : 'regular' }))}
                                                >
                                                    <option value="Walk-in">{t('type.walkIn')}</option>
                                                    <option value="Corporate">{t('type.corporate')}</option>
                                                </select>
                                            </div>
                                            <div className="ui-field ui-col-4">
                                                <label>{t('label.status')}</label>
                                                <select
                                                    className="ui-select"
                                                    value={editingCustomer.isActive ? 'Active' : 'Inactive'}
                                                    onChange={(e) => setEditingCustomer((p) => ({ ...p, isActive: e.target.value === 'Active' }))}
                                                >
                                                    <option value="Active">{t('status.active')}</option>
                                                    <option value="Inactive">{t('status.inactive')}</option>
                                                </select>
                                            </div>
                                            <div className="ui-field ui-col-4">
                                                <label>{t('label.mobile')}</label>
                                                <input
                                                    type="text"
                                                    className="ui-input"
                                                    value={editingCustomer.mobile}
                                                    onChange={(e) => setEditingCustomer((p) => ({ ...p, mobile: e.target.value }))}
                                                />
                                            </div>
                                            <div className="ui-field ui-col-4">
                                                <label>{t('label.whatsapp')}</label>
                                                <input
                                                    type="text"
                                                    className="ui-input"
                                                    value={editingCustomer.whatsapp}
                                                    onChange={(e) => setEditingCustomer((p) => ({ ...p, whatsapp: e.target.value }))}
                                                />
                                            </div>
                                            <div className="ui-field ui-col-4">
                                                <label>{t('label.vat')}</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={20}
                                                    className={`ui-input${editTaxIdChanged && editTaxIdError ? ' ui-input--err' : ''}`}
                                                    value={editingCustomer.taxId}
                                                    onChange={(e) => setEditingCustomer((p) => ({ ...p, taxId: e.target.value }))}
                                                />
                                                {editTaxIdError ? (
                                                    <p className={`ui-help${editTaxIdChanged ? ' ui-help--err' : ''}`}>
                                                        {editTaxIdChanged ? editTaxIdError : taxIdText(locale, 'legacy')}
                                                    </p>
                                                ) : isCorp ? (
                                                    <p className="ui-help">{taxIdText(locale, 'vatHint')}</p>
                                                ) : null}
                                            </div>
                                            <div className="ui-field ui-col-4">
                                                <label>{t('label.cr')}</label>
                                                <input
                                                    type="text"
                                                    className="ui-input"
                                                    value={editingCustomer.crNumber ?? ''}
                                                    onChange={(e) => setEditingCustomer((p) => ({ ...p, crNumber: e.target.value }))}
                                                />
                                            </div>
                                            <div className="ui-field ui-col-8">
                                                <label>{taxIdText(locale, 'nationalAddress')}</label>
                                                <input
                                                    type="text"
                                                    className="ui-input"
                                                    placeholder={taxIdText(locale, 'nationalAddressPh')}
                                                    value={editingCustomer.nationalAddress ?? ''}
                                                    onChange={(e) => setEditingCustomer((p) => ({ ...p, nationalAddress: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {isCorp && (
                                        <section className="ui-section">
                                            <h2>{t('section.corporate')}</h2>
                                            <div className="ui-form-grid">
                                                <div className="ui-field ui-col-4">
                                                    <label>{t('label.companyName')}</label>
                                                    <input
                                                        type="text"
                                                        className="ui-input"
                                                        value={editingCustomer.companyName}
                                                        onChange={(e) => setEditingCustomer((p) => ({ ...p, companyName: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="ui-field ui-col-4">
                                                    <label>{t('label.contactPersonOpt')}</label>
                                                    <input
                                                        type="text"
                                                        className="ui-input"
                                                        value={editingCustomer.contactPerson}
                                                        onChange={(e) => setEditingCustomer((p) => ({ ...p, contactPerson: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="ui-field ui-col-4">
                                                    <label>{t('label.portalEmail')}</label>
                                                    <input
                                                        type="email"
                                                        className="ui-input"
                                                        autoComplete="off"
                                                        value={editingCustomer.loginEmail}
                                                        onChange={(e) => setEditingCustomer((p) => ({ ...p, loginEmail: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="ui-field ui-col-4">
                                                    <label>{t('label.newPassword')}</label>
                                                    <input
                                                        type="password"
                                                        className="ui-input"
                                                        autoComplete="new-password"
                                                        placeholder={t('ph.keepPassword')}
                                                        value={editingCustomer.newPassword}
                                                        onChange={(e) => setEditingCustomer((p) => ({ ...p, newPassword: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="ui-field ui-col-8">
                                                    <label>{t('label.primaryWorkshop')}</label>
                                                    <input
                                                        type="text"
                                                        className="ui-input"
                                                        readOnly
                                                        disabled
                                                        value={editingCustomer.workshopName || '—'}
                                                        title={t('hint.workshopAnchor')}
                                                    />
                                                    <p className="ui-help">
                                                        {t('hint.workshopAnchor')}
                                                    </p>
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {isCorp && (
                                        <section className="ui-section">
                                            <h2>{t('section.branches')}</h2>
                                            {renderManagedByField(editingManaged.managedBy || MANAGED_BY_HQ, (v) =>
                                                setEditingCustomer((p) => ({ ...p, managedBy: v, managedByTouched: true })),
                                            )}
                                            {renderHomeWorkshop({
                                                managedBy: editingManaged.managedBy || MANAGED_BY_HQ,
                                                selectedIds: editingCustomer.selectedStoreIds || [],
                                                value: editingCustomer.ownerWorkshopId,
                                                readOnly: !managedByChanged(editingManaged.initialManagedBy, editingManaged.managedBy),
                                                readOnlyName: editingCustomer.workshopName || String(editingCustomer.ownerWorkshopId || ''),
                                                onChange: (id) => setEditingCustomer((p) => ({ ...p, ownerWorkshopId: id })),
                                            })}
                                            <p className="ui-note">{t('hint.branches')}</p>
                                            {renderBranchPicker(editingCustomer.selectedStoreIds || [], (ids) => {
                                                setEditingCustomer((prev) => ({
                                                    ...prev,
                                                    selectedStoreIds: (ids || []).map(String),
                                                }));
                                            }, editingManaged.managedBy || MANAGED_BY_HQ)}
                                        </section>
                                    )}
                                </>
                            );
                        })()}
                    </CustomersPageShell>
                )}

                {route?.screen === 'details' && (
                    <CustomersPageShell
                        title={t('details.title')}
                        onClose={closeDetails}
                    >
                        {detailsLoading ? (
                            <div className="ui-stack" aria-label={t('loading.details')} aria-busy="true">
                                <div className="ui-sk ui-sk--title ui-sk--w40" />
                                <div className="ui-kv">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={`sk-${i}`} className="ui-sk-row">
                                            <div className="ui-sk ui-sk--label ui-sk--w55" />
                                            <div className="ui-sk ui-sk--text ui-sk--w70" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : detailsData ? (() => {
                            const cust = detailsData.customer ?? {};
                            const corp = detailsData.corporateAccount;
                            const isCorp = (detailsData.customerType ?? cust.customerType ?? 'regular') === 'corporate';
                            const vehicles = Array.isArray(detailsData.vehicles)
                                ? detailsData.vehicles.length
                                : (detailsData.vehiclesCount ?? 0);
                            const orders = Array.isArray(detailsData.salesOrders)
                                ? detailsData.salesOrders.length
                                : (detailsData.salesOrdersCount ?? 0);
                            const fact = (label, value) => (
                                <div>
                                    <span className="ui-kv-label">{label}</span>
                                    <span className="ui-kv-value">{value || '—'}</span>
                                </div>
                            );
                            return (
                                <>
                                    <div className="ui-section">
                                        <div className="ui-row">
                                            <h2 className="ui-card-title">{detailsData.name ?? cust.name ?? '—'}</h2>
                                            <span className={`ui-pill ui-pill--${isCorp ? 'info' : 'neutral'}`}>
                                                {isCorp ? t('type.corporate') : t('type.walkIn')}
                                            </span>
                                        </div>
                                        <div className="ui-kv">
                                            {fact(t('label.mobile'), detailsData.mobile ?? cust.mobile)}
                                            {fact(t('label.vat'), cust.taxId || detailsData.taxId)}
                                            {fact(t('label.cr'), cust.crNumber || detailsData.crNumber)}
                                            {fact(t('details.vehiclesCount'), vehicles)}
                                            {fact(t('details.ordersCount'), orders)}
                                            <div className="ui-kv-wide">
                                                <span className="ui-kv-label">{taxIdText(locale, 'nationalAddress')}</span>
                                                <span className="ui-kv-value">
                                                    {cust.nationalAddress || detailsData.nationalAddress || '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {corp && (
                                        <div className="ui-section">
                                            <h2>{t('label.corporateAccount')}</h2>
                                            <div className="ui-kv">
                                                {fact(t('label.companyName'), corp.companyName)}
                                                {fact(t('details.creditLimit'), t('money.sar', {
                                                    amount: Number(corp.creditLimit ?? 0).toFixed(2),
                                                }))}
                                                {fact(t('details.dueBalance'), t('money.sar', {
                                                    amount: Number(corp.dueBalance ?? 0).toFixed(2),
                                                }))}
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(corp?.portalUsers) && corp.portalUsers.length > 0 && (
                                        <div className="ui-section">
                                            <h2>{t('label.portalEmails')}</h2>
                                            <div className="ui-table-wrap ui-table-wrap--bare">
                                                <ul className="ui-list">
                                                    {corp.portalUsers.map((u) => (
                                                        <li key={String(u.userId)} className="ui-list-row">
                                                            <div className="ui-list-main">
                                                                <span className="ui-list-title">{u.email || '—'}</span>
                                                                {u.name ? <span className="ui-list-meta">{u.name}</span> : null}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(detailsData.salesOrders) && detailsData.salesOrders.length > 0 && (
                                        <div className="ui-section">
                                            <h2>{t('label.latestOrders')}</h2>
                                            <div className="ui-table-wrap ui-table-wrap--bare">
                                                <ul className="ui-list">
                                                    {detailsData.salesOrders.slice(0, 5).map((o, idx) => (
                                                        <li key={String(o.id ?? o.orderNumber ?? idx)} className="ui-list-row">
                                                            <div className="ui-list-main">
                                                                <span className="ui-list-title">
                                                                    {o.invoice?.invoiceNumber ?? o.orderNumber ?? '—'}
                                                                </span>
                                                                <span className="ui-list-meta">{String(o.source ?? '—')}</span>
                                                            </div>
                                                            <span className="ui-pill ui-pill--neutral ui-list-end">
                                                                {String(o.status ?? 'unknown')}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(corp?.corporateOrders) && corp.corporateOrders.length > 0 && (
                                        <div className="ui-section">
                                            <h2>{t('label.corporateOrders')}</h2>
                                            <div className="ui-table-wrap ui-table-wrap--bare">
                                                <ul className="ui-list">
                                                    {corp.corporateOrders.slice(0, 5).map((co, idx) => (
                                                        <li key={String(co.id ?? idx)} className="ui-list-row">
                                                            <div className="ui-list-main">
                                                                <span className="ui-list-title">
                                                                    {t('details.linkedOrders', {
                                                                        n: Array.isArray(co.linkedSalesOrders) ? co.linkedSalesOrders.length : 0,
                                                                    })}
                                                                </span>
                                                            </div>
                                                            <span className="ui-pill ui-pill--neutral ui-list-end">
                                                                {co.status ?? '—'}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })() : (
                            <div className="ui-empty">
                                <div className="ui-empty-icon"><FileText size={18} /></div>
                                <div className="ui-empty-title">{t('details.empty')}</div>
                            </div>
                        )}
                    </CustomersPageShell>
                )}
            </>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-tabs" role="tablist">
                {visibleSubTabs.map((tab) => (
                    <NavLink
                        key={tab.path}
                        to={`/admin/customers/${tab.path}`}
                        role="tab"
                        aria-selected={isCustomersSubTabActive(tab.path)}
                        className="ui-tab"
                    >
                        {t(CUST_SUB_LABEL_KEYS[tab.path] || tab.labelKey)}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'all-customers' && (
            <>
            <div className="ui-kpis">
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Users size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.total')}</div>
                    <div className="ui-metric-value">{counts.all}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Building size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.corporate')}</div>
                    <div className="ui-metric-value">{counts.corporate}</div>
                    <div className="ui-metric-foot">{t('stat.ofTotal', { n: counts.all })}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Users size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.walkIn')}</div>
                    <div className="ui-metric-value">{counts.regular}</div>
                    <div className="ui-metric-foot">{t('stat.ofTotal', { n: counts.all })}</div>
                </div>
            </div>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            type="text"
                            className="ui-input"
                            placeholder={t('search.placeholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="ui-chips">
                        {[
                            { id: 'all', labelKey: 'filter.all' },
                            { id: 'regular', labelKey: 'filter.walkIn' },
                            { id: 'corporate', labelKey: 'filter.corporate' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`ui-chip${typeFilter === tab.id ? ' ui-chip--on' : ''}`}
                                aria-pressed={typeFilter === tab.id}
                                onClick={() => setTypeFilter(tab.id)}
                            >
                                {t(tab.labelKey)}
                            </button>
                        ))}
                    </div>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => navigate(customersRoutes.create())}
                        >
                            <Plus size={14} /> {t('btn.add')}
                        </button>
                    </div>
                </div>

                {!loading && customers.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><Users size={18} /></div>
                        <div className="ui-empty-title">{t('empty.title')}</div>
                        <div className="ui-empty-sub">
                            {searchDebounced ? t('empty.search') : t('empty.sub')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('th.customer')}</th>
                                <th>{t('th.type')}</th>
                                <th>{t('th.mobile')}</th>
                                <th>{t('th.workshop')}</th>
                                <th>{t('th.orderStats')}</th>
                                <th>{t('th.corporate')}</th>
                                <th>{t('th.status')}</th>
                                <th aria-label={t('th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                // One skeleton row per row the page is about to show, so the
                                // table does not collapse to a single line and jump back.
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--btn" /></td>
                                    </tr>
                                ))
                            ) : customers.map((c) => (
                                <tr key={c.id}>
                                    <td data-label={t('th.customer')}>
                                        <div className="ui-strong">{c.name}</div>
                                        <div className="ui-meta">
                                            {c.customerType === 'corporate' ? t('type.business') : t('type.walkIn')}
                                            {c.taxId && c.taxId !== '-' ? ` · ${t('label.vat')}: ${c.taxId}` : ''}
                                        </div>
                                    </td>
                                    <td data-label={t('th.type')}>
                                        <span className={`ui-pill ui-pill--${c.customerType === 'corporate' ? 'info' : 'neutral'}`}>
                                            {c.customerType === 'corporate' ? t('type.corporate') : t('type.walkIn')}
                                        </span>
                                    </td>
                                    <td data-label={t('th.mobile')} className="ui-mono ui-nowrap">{c.mobile}</td>
                                    <td data-label={t('th.workshop')}>{c.workshopName}</td>
                                    <td data-label={t('th.orderStats')}>
                                        <div>{t('orders.total', { n: c.orderStats.totalOrders })}</div>
                                        <div className="ui-meta">
                                            {t('orders.completedDraft', {
                                                c: c.orderStats.completedOrders,
                                                d: c.orderStats.draftOrders,
                                            })}
                                        </div>
                                    </td>
                                    <td data-label={t('th.corporate')}>
                                        {c.corporateAccount
                                            ? (c.corporateAccount.companyName ?? t('type.corporate'))
                                            : <span className="ui-meta">—</span>}
                                    </td>
                                    <td data-label={t('th.status')}>
                                        <span className={`ui-pill ui-pill--${c.isActive ? 'ok' : 'neutral'}`}>
                                            {c.isActive ? t('status.active') : t('status.inactive')}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="ui-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--subtle ui-btn--sm"
                                                onClick={() => openDetails(c.id)}
                                            >
                                                <FileText size={13} /> {t('btn.details')}
                                            </button>
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                onClick={() => openEdit(c)}
                                            >
                                                <Pencil size={13} /> {t('btn.edit')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerFor(customersTotal)} />
            </div>
            </>
            )}

            {activeSub === 'corporate-billing' && <CorporateBillingSection />}
        </div>
    );
}
