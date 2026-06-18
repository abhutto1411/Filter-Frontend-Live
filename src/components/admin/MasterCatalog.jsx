import React, { useEffect, useRef, useState } from 'react';
import { 
    Plus, Search, Download, Upload, Filter, 
    CheckCircle2, AlertCircle, Copy, XCircle,
    MoreVertical, Edit3, Trash2, Package, Layers,
    ChevronDown, Info, RefreshCw, Box, ShieldCheck,
    ArrowUp, Settings, LayoutGrid, Tags
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../Modal';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/MasterCatalog.css';
import productsCsvTemplate from '../../../Products.csv?url';
import servicesCsvTemplate from '../../../Services.csv?url';
import {
    createCategory,
    createDepartment,
    createProduct,
    createService,
    deleteCategory,
    deleteDepartment,
    deleteProduct,
    deleteService,
    getCategories,
    getDepartments,
    getProducts,
    getServices,
    getDepartmentProducts,
    getDepartmentServices,
    updateCategory,
    updateDepartment,
    updateProduct,
    updateService,
    importProductsFromCsv,
    importServicesFromCsv,
    getMasterCatalogKpis,
    getDuplicates,
    ignoreDuplicate,
    deleteDuplicateItem,
    getProductRequests,
    getProductRequestKpis,
    approveProductRequest,
    rejectProductRequest,
} from '../../services/superAdminApi';
import {
    findFirstNegativeMoneyField,
    NON_NEGATIVE_MONEY_INPUT_ATTRS,
    parseNonNegativeNumberOr,
    sanitizeNonNegativeMoneyInput,
} from '../../utils/nonNegativeMoney';

const KPI_CARD_DEFS = [
    {
        key: 'products',
        label: 'PRODUCTS',
        icon: Box,
        color: '#111827',
        textColor: '#FFFFFF',
        subColor: 'rgba(255,255,255,0.7)',
    },
    {
        key: 'services',
        label: 'SERVICES',
        icon: Layers,
        color: '#F0FDF4',
        textColor: '#166534',
        subColor: '#15803D',
    },
    {
        key: 'departments',
        label: 'DEPARTMENTS',
        icon: LayoutGrid,
        color: '#FFFBEB',
        textColor: '#92400E',
        subColor: '#B45309',
    },
    {
        key: 'categories',
        label: 'CATEGORIES',
        icon: Tags,
        color: '#F5F3FF',
        textColor: '#5B21B6',
        subColor: '#6D28D9',
    },
];

/** Coerce KPI numbers — backend may return null / strings. */
const kpiNum = (v) => {
    if (v == null || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Build the 4 summary cards from the combined KPIs payload. */
function buildKpiCards(kpis) {
    const k = kpis || {};
    const products = k.products || {};
    const services = k.services || {};
    const departments = k.departments || {};
    const categories = k.categories || {};
    const byType = categories.byType || {};

    return [
        {
            ...KPI_CARD_DEFS[0],
            value: kpiNum(products.total),
            sub: `${kpiNum(products.active)} active · ${kpiNum(products.inactive)} inactive`,
        },
        {
            ...KPI_CARD_DEFS[1],
            value: kpiNum(services.total),
            sub: `${kpiNum(services.active)} active · ${kpiNum(services.inactive)} inactive`,
        },
        {
            ...KPI_CARD_DEFS[2],
            value: kpiNum(departments.total),
            sub: `${kpiNum(departments.active)} active · ${kpiNum(departments.inactive)} inactive`,
        },
        {
            ...KPI_CARD_DEFS[3],
            value: kpiNum(categories.total),
            sub: `${kpiNum(byType.product)} product · ${kpiNum(byType.service)} service · ${kpiNum(byType.expense)} expense`,
        },
    ];
}

const MASTER_TABS = [
    { id: 'master',       label: 'Master Catalog',         icon: CheckCircle2, permission: 'inventory.master-catalog.products.view' },
    { id: 'dept',         label: 'Master Department',      icon: LayoutGrid,   permission: 'inventory.master-catalog.departments.view' },
    { id: 'category',     label: 'Master Category',        icon: Tags,         permission: 'inventory.master-catalog.categories.view' },
    { id: 'requests',     label: 'Product Requests',       icon: Layers,       permission: 'inventory.master-catalog.requests.view' },
    { id: 'duplication',  label: 'Duplication Review',     icon: Copy,         permission: 'inventory.master-catalog.duplication.view' },
    { id: 'availability', label: 'Supplier Availability',  icon: Package,      permission: 'inventory.master-catalog.availability.view' },
    { id: 'services',     label: 'Services',               icon: Layers,       permission: 'inventory.master-catalog.services.view' },
];

const parseNumberOr = parseNonNegativeNumberOr;

function validateCatalogProductPrices(form, { includePurchase = true } = {}) {
    const fields = [
        { label: 'Sale price', value: form.salePrice },
        { label: 'Min corporate price', value: form.minCorpPrice },
        { label: 'Max corporate price', value: form.maxCorpPrice },
        { label: 'Min editable price', value: form.minPriceEditable },
    ];
    if (includePurchase) {
        fields.unshift({ label: 'Purchase price', value: form.purchasePrice });
    }
    return findFirstNegativeMoneyField(fields);
}

function validateProductPriceEditableRules(form) {
    if (!toBoolPriceEditable(form)) return null;
    const raw = form.minPriceEditable;
    if (raw === '' || raw == null) {
        return 'Minimum editable price is required when price editing is enabled';
    }
    const min = parseNumberOr(raw, NaN);
    if (!Number.isFinite(min) || min < 0) {
        return 'Minimum editable price must be zero or greater';
    }
    return null;
}

function validateCatalogServicePrices(form) {
    return findFirstNegativeMoneyField([
        { label: 'Selling price', value: form.sellingPrice },
        { label: 'Min corporate price', value: form.minPriceCorporate },
        { label: 'Max corporate price', value: form.maxPriceCorporate },
    ]);
}

const toBoolPriceEditable = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const raw = obj.isPriceEditable ?? obj.is_price_editable;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
};

const catalogItemId = (item) =>
    item?.id != null ? String(item.id) : '';

const catalogIdsMatch = (a, b) => catalogItemId(a) !== '' && catalogItemId(a) === catalogItemId(b);

const toBoolActive = (obj) => {
    if (!obj || typeof obj !== 'object') return true;
    const raw = obj.isActive ?? obj.is_active;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes') return true;
        if (s === 'false' || s === '0' || s === 'no') return false;
    }
    return true;
};

/**
 * Super-admin product list and GET-by-id responses expose `allowDecimalQty` in camelCase JSON
 * (Nest DTOs). Prisma @map("allow_decimal_qty") only affects the DB column, not the HTTP body.
 */
const toBoolAllowDecimal = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const raw = obj.allowDecimalQty ?? obj.allow_decimal_qty;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
};

/** ISO-8601 from catalog APIs → short local display; empty string if missing/invalid. */
const formatCatalogCreatedAt = (iso) => {
    if (iso == null || iso === '') return '';
    const d = new Date(typeof iso === 'string' || typeof iso === 'number' ? iso : String(iso));
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/** For sorting: newest first. Invalid / missing dates sort last. */
const catalogCreatedAtSortMs = (iso) => {
    if (iso == null || iso === '') return 0;
    const t = new Date(typeof iso === 'string' || typeof iso === 'number' ? iso : String(iso)).getTime();
    return Number.isFinite(t) ? t : 0;
};

const PRODUCT_CSV_COLUMNS = [
    'Product',
    'Arabic Name',
    'Brand',
    'SKU',
    'Description',
    'Allow Decimal Qty',
    'Department',
    'Category',
    'UOM',
    'Supply Price Inclusive VAT 15%',
    'Sale Price Inclusive VAT 15%',
    'Min Corporate Price',
    'Max Corporate price',
    'Department ID',
    'Category ID',
    'Sale Price Enclusive VAT 15%',
];

/** Must match `Services.csv` header and backend `SERVICE_CSV_CANONICAL_HEADERS` (order + spelling). */
const SERVICE_CSV_COLUMNS = [
    'Service',
    'Arabic Name',
    'SKU',
    'Description',
    'Department',
    'Category',
    'UOM',
    'Sale Price Inclusive VAT 15%',
    'Sale Price Enclusive VAT 15%',
    'Allow Price Change',
    'Min Corporate Price',
    'Max Corporate price',
    'Department ID',
    'Category ID',
];

/** ProductCsvImportResponseDto — top-level JSON or nested under `data`. */
function getCsvImportPayload(result) {
    if (!result || typeof result !== 'object') return null;
    return result.data && typeof result.data === 'object' ? result.data : result;
}

function formatCsvImportSummary(result) {
    const p = getCsvImportPayload(result);
    if (!p) return '';
    const parts = [];
    if (typeof p.created === 'number') parts.push(`Created: ${p.created}`);
    if (typeof p.skippedDuplicate === 'number') parts.push(`Skipped (duplicate SKU): ${p.skippedDuplicate}`);
    if (typeof p.failed === 'number') parts.push(`Failed: ${p.failed}`);
    if (typeof p.vatWarningsCount === 'number') parts.push(`VAT warning rows: ${p.vatWarningsCount}`);
    return parts.join(' · ');
}

function isProductCsvImportShape(p) {
    return (
        p &&
        typeof p === 'object' &&
        (typeof p.created === 'number' ||
            typeof p.skippedDuplicate === 'number' ||
            typeof p.failed === 'number' ||
            typeof p.vatWarningsCount === 'number')
    );
}

function formatRowDetailItem(d) {
    if (d == null) return '';
    if (typeof d === 'string') return d;
    if (typeof d !== 'object') return String(d);
    const bits = [`Row ${d.rowNumber ?? '?'}`];
    if (d.outcome) bits.push(String(d.outcome).replace(/_/g, ' '));
    if (d.sku) bits.push(`SKU ${d.sku}`);
    if (d.message) bits.push(d.message);
    if (d.productId != null && d.productId !== '') bits.push(`productId ${d.productId}`);
    return bits.join(' — ');
}

function formatVatWarningItem(w) {
    if (w == null) return '';
    if (typeof w === 'string') return w;
    if (typeof w !== 'object') return String(w);
    return `Row ${w.rowNumber ?? '?'}: ${w.message || ''}`.trim();
}

export default function MasterCatalog() {
    const { hasPermission } = useAuth();
    const visibleMasterTabs = MASTER_TABS.filter((t) => hasPermission(t.permission));
    const [activeTab, setActiveTab] = useState(() => visibleMasterTabs[0]?.id ?? 'master');

    // If the current activeTab is no longer visible (perms changed mid-session), snap to first allowed.
    useEffect(() => {
        if (visibleMasterTabs.length === 0) return;
        if (!visibleMasterTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visibleMasterTabs[0].id);
        }
    }, [visibleMasterTabs, activeTab]);

    const [statusFilter, setStatusFilter] = useState('Approved');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
    const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
    const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
    const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
    const [isEditDeptModalOpen, setIsEditDeptModalOpen] = useState(false);
    const [isEditCatModalOpen, setIsEditCatModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isBulkProductModalOpen, setIsBulkProductModalOpen] = useState(false);
    const [isBulkServiceModalOpen, setIsBulkServiceModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingDept, setEditingDept] = useState(null);
    const [editingCat, setEditingCat] = useState(null);
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [departmentProducts, setDepartmentProducts] = useState([]);
    const [departmentServices, setDepartmentServices] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [kpis, setKpis] = useState(null);
    const [kpisLoading, setKpisLoading] = useState(true);
    const [kpisError, setKpisError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedBulkFile, setSelectedBulkFile] = useState(null);
    const [bulkImporting, setBulkImporting] = useState(false);
    const [bulkImportResult, setBulkImportResult] = useState(null);
    const bulkFileInputRef = useRef(null);
    /** Sync guard: React state can lag one frame, so double-clicks could otherwise fire two imports. */
    const bulkImportInFlightRef = useRef(false);
    const bulkServiceFileInputRef = useRef(null);
    const bulkServiceImportInFlightRef = useRef(false);
    const [selectedBulkServiceFile, setSelectedBulkServiceFile] = useState(null);
    const [bulkServiceImporting, setBulkServiceImporting] = useState(false);
    const [bulkServiceImportResult, setBulkServiceImportResult] = useState(null);
    const [serviceToggleBusyKey, setServiceToggleBusyKey] = useState('');
    const [productToggleBusyKey, setProductToggleBusyKey] = useState('');

    // ── Duplication Review ────────────────────────────────────────
    const [dupGroups, setDupGroups] = useState([]);
    const [dupLoading, setDupLoading] = useState(false);
    const [dupError, setDupError] = useState(null);
    const [dupEntityFilter, setDupEntityFilter] = useState('');
    const [expandedDupKey, setExpandedDupKey] = useState(null);

    // ── Product Requests ──────────────────────────────────────────
    const [productRequests, setProductRequests] = useState([]);
    const [prKpis, setPrKpis] = useState(null);
    const [prTab, setPrTab] = useState('Pending');
    const [prLoading, setPrLoading] = useState(false);
    const [prError, setPrError] = useState(null);
    const [prApproveTarget, setPrApproveTarget] = useState(null);
    const [prRejectTarget, setPrRejectTarget] = useState(null);
    const [prRemarks, setPrRemarks] = useState('');
    const [prApproveForm, setPrApproveForm] = useState({
        name: '',
        sku: '',
        brandName: '',
        description: '',
        arabicName: '',
        unit: 'pcs',
        expectedPrice: '',
        departmentId: '',
        categoryId: '',
    });
    const [prRejectReason, setPrRejectReason] = useState('');
    const [prActionBusy, setPrActionBusy] = useState(false);
    /** Services tab status chips (separate from master product `statusFilter`). */
    const [serviceStatusFilter, setServiceStatusFilter] = useState('Approved');
    const [selectedProductDepartment, setSelectedProductDepartment] = useState('');
    const [selectedServiceDepartment, setSelectedServiceDepartment] = useState('');

    const [toast, setToast] = useState(null);
    const showToast = (message, kind = 'success') => {
        setToast({ message, kind, id: Date.now() });
        setTimeout(() => setToast((t) => (t && t.message === message ? null : t)), 3500);
    };

    const [newProduct, setNewProduct] = useState({
        name: '',
        arabicName: '',
        sku: '',
        departmentId: '',
        categoryId: '',
        brand: '',
        unit: 'piece',
        type: 'Product',
        salePrice: '',
        purchasePrice: '',
        description: '',
        barcode: '',
        imageUrl: '',
        conversionRules: [],
        kmTypeValue: '',
        isPriceEditable: false,
        minPriceEditable: '',
    });

    const [newDept, setNewDept] = useState({ name: '' });
    const [newCat, setNewCat] = useState({ type: 'product', name: '', departmentId: '' });
    const [newService, setNewService] = useState({
        name: '',
        arabicName: '',
        sku: '',
        description: '',
        unitOfMeasurement: 'ea',
        sellingPrice: '',
        isPriceEditable: true,
        minPriceCorporate: '',
        maxPriceCorporate: '',
        departmentId: '',
        categoryId: '',
    });
    const [editingService, setEditingService] = useState(null);
    const productCategories = categories.filter((c) => c.type === 'product' || !c.type);
    const serviceCategories = categories.filter((c) => c.type === 'service' || !c.type);
    const selectedProductCategories = productCategories.filter((c) => String(c.departmentId) === String(newProduct.departmentId));
    const selectedServiceCategories = serviceCategories.filter((c) => String(c.departmentId) === String(newService.departmentId));
    const approveProductCategories = productCategories.filter(
        (c) => String(c.departmentId) === String(prApproveForm.departmentId),
    );
    const editModalProductCategories = editingProduct
        ? productCategories.filter(
              (c) =>
                  !editingProduct.departmentId ||
                  String(c.departmentId) === String(editingProduct.departmentId),
          )
        : [];
    const productMatchesFilters = (p) => {
        const kmStr =
            p.kmTypeValue != null && p.kmTypeValue !== ''
                ? String(p.kmTypeValue)
                : '';
        const matchesSearch =
            !searchQuery ||
            [p.name, p.arabicName, p.sku, p.brandName, kmStr].some((v) =>
                (v || '').toLowerCase().includes(searchQuery.toLowerCase()),
            );
        const status = p.isActive === false ? 'Rejected' : 'Approved';
        const matchesStatus = statusFilter === 'All' || statusFilter === status;
        return matchesSearch && matchesStatus;
    };
    const serviceMatchesFilters = (s) => {
        const active = toBoolActive(s);
        const matchesSvcStatus =
            serviceStatusFilter === 'All' || serviceStatusFilter === 'Pending'
                ? true
                : serviceStatusFilter === 'Rejected'
                  ? !active
                  : active;
        if (!matchesSvcStatus) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const createdFmt = formatCatalogCreatedAt(s.createdAt ?? s.created_at).toLowerCase();
        const createdRaw = String(s.createdAt ?? s.created_at ?? '').toLowerCase();
        const vatStr = String(s.vatMode ?? s.vat_mode ?? '').toLowerCase();
        const catIdStr = s.categoryId != null ? String(s.categoryId).toLowerCase() : '';
        return [s.name, s.arabicName, s.sku, s.categoryName, vatStr, catIdStr, createdFmt, createdRaw].some((v) =>
            (v || '').includes(q),
        );
    };
    const filteredProducts = products.filter(productMatchesFilters);
    const filteredServices = services.filter(serviceMatchesFilters);
    /** Newest created first (descending by `createdAt`); rows with no date sort last. */
    const sortedFilteredServices = [...filteredServices].sort((a, b) => {
        const ta = catalogCreatedAtSortMs(a.createdAt ?? a.created_at);
        const tb = catalogCreatedAtSortMs(b.createdAt ?? b.created_at);
        const aMissing = !(ta > 0);
        const bMissing = !(tb > 0);
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;
        return tb - ta;
    });
    const groupedFilteredProducts = departmentProducts
        .map((dept) => ({
            ...dept,
            products: (Array.isArray(dept.products) ? dept.products : []).filter(productMatchesFilters),
        }))
        .filter((dept) => dept.products.length > 0);
    const groupedFilteredServices = departmentServices
        .map((dept) => ({
            ...dept,
            services: (Array.isArray(dept.services) ? dept.services : [])
                .filter(serviceMatchesFilters)
                .sort((a, b) => {
                    const ta = catalogCreatedAtSortMs(a.createdAt ?? a.created_at);
                    const tb = catalogCreatedAtSortMs(b.createdAt ?? b.created_at);
                    const aMissing = !(ta > 0);
                    const bMissing = !(tb > 0);
                    if (aMissing && bMissing) return 0;
                    if (aMissing) return 1;
                    if (bMissing) return -1;
                    return tb - ta;
                }),
        }))
        .filter((dept) => dept.services.length > 0);
    const productDepartmentOptions = departmentProducts.map((dept) => ({
        id: String(dept.departmentId ?? ''),
        name: dept.departmentName || `Department ${dept.departmentId}`,
    }));
    const serviceDepartmentOptions = departmentServices.map((dept) => ({
        id: String(dept.departmentId ?? ''),
        name: dept.departmentName || `Department ${dept.departmentId}`,
    }));
    const displayedProducts = selectedProductDepartment
        ? (groupedFilteredProducts.find((d) => String(d.departmentId) === selectedProductDepartment)?.products ?? [])
        : groupedFilteredProducts.flatMap((d) => d.products);
    const displayedServices = selectedServiceDepartment
        ? (groupedFilteredServices.find((d) => String(d.departmentId) === selectedServiceDepartment)?.services ?? [])
        : groupedFilteredServices.flatMap((d) => d.services);
    const _q = searchQuery.trim().toLowerCase();
    const filteredDepartments = !_q
        ? departments
        : departments.filter((d) => (d.name || '').toLowerCase().includes(_q));
    const filteredCategories = !_q
        ? categories
        : categories.filter((c) => {
            const deptName = departments.find((d) => String(d.id) === String(c.departmentId))?.name || '';
            return [c.name, c.type, deptName].some((v) => (v || '').toLowerCase().includes(_q));
        });
    const filteredAvailability = !_q
        ? products
        : products.filter((p) => {
              const kmStr =
                  p.kmTypeValue != null && p.kmTypeValue !== ''
                      ? String(p.kmTypeValue)
                      : '';
              return [p.name, p.sku, p.brandName, p.categoryName, p.unit, kmStr].some((v) =>
                  (v || '').toLowerCase().includes(_q),
              );
          });
    const isDepartmentFormValid = !!newDept.name.trim();
    const isCategoryFormValid = !!newCat.name.trim() && !!newCat.departmentId;
    const isProductFormValid = !!newProduct.name.trim() && !!newProduct.departmentId && !!newProduct.categoryId;
    const isServiceFormValid = !!newService.name.trim() && !!newService.departmentId && !!newService.categoryId;

    const loadCatalog = async () => {
        setLoading(true);
        try {
            const [
                productsRes,
                servicesRes,
                departmentsRes,
                categoriesRes,
                departmentProductsRes,
                departmentServicesRes,
            ] = await Promise.all([
                getProducts().catch(() => ({ products: [] })),
                getServices().catch(() => ({ services: [] })),
                getDepartments().catch(() => ({ departments: [] })),
                getCategories().catch(() => ({ categories: [] })),
                getDepartmentProducts().catch(() => ({ departments: [] })),
                getDepartmentServices().catch(() => ({ departments: [] })),
            ]);
            const productsData = Array.isArray(productsRes) ? productsRes : (productsRes?.products ?? []);
            const servicesData = Array.isArray(servicesRes) ? servicesRes : (servicesRes?.services ?? []);
            const departmentsData = Array.isArray(departmentsRes) ? departmentsRes : (departmentsRes?.departments ?? []);
            const categoriesData = Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes?.categories ?? []);
            setProducts(productsData);
            setServices(servicesData);
            setDepartments(departmentsData);
            setCategories(categoriesData);
            setDepartmentProducts(
                Array.isArray(departmentProductsRes?.departments) ? departmentProductsRes.departments : [],
            );
            setDepartmentServices(
                Array.isArray(departmentServicesRes?.departments) ? departmentServicesRes.departments : [],
            );
        } finally {
            setLoading(false);
        }
    };

    const loadKpis = async ({ silent = false } = {}) => {
        if (!silent) setKpisLoading(true);
        setKpisError(null);
        try {
            const res = await getMasterCatalogKpis();
            // Backend may wrap in `{ data: {...} }` or return flat — handle both.
            setKpis(res?.data && typeof res.data === 'object' ? res.data : res);
        } catch (e) {
            setKpisError(e?.message || 'Failed to load KPIs');
        } finally {
            if (!silent) setKpisLoading(false);
        }
    };

    /**
     * Refresh lists + KPIs together. KPIs refresh silently to avoid the
     * cards flickering to "—" between every CRUD action.
     */
    const refreshCatalog = async () => {
        await Promise.all([loadCatalog(), loadKpis({ silent: true })]);
    };

    // ── Duplication Review loaders ────────────────────────────────
    const loadDuplicates = async () => {
        setDupLoading(true);
        setDupError(null);
        try {
            const res = await getDuplicates({ entityType: dupEntityFilter || undefined });
            const groups = Array.isArray(res?.groups) ? res.groups : [];
            setDupGroups(groups);
        } catch (e) {
            setDupError(e?.message || 'Failed to load duplicates');
            setDupGroups([]);
        } finally {
            setDupLoading(false);
        }
    };

    const handleIgnoreDuplicate = async (group) => {
        if (!window.confirm(`Mark "${group.displayName || group.nameKey}" group as not a duplicate?`)) return;
        try {
            await ignoreDuplicate({ entityType: group.entityType, nameKey: group.nameKey });
            showToast('Group dismissed', 'success');
            await loadDuplicates();
        } catch (e) {
            showToast(e?.message || 'Failed to dismiss group', 'error');
        }
    };

    const handleDeleteDuplicateItem = async (entityType, item) => {
        if (!window.confirm(`Delete this ${entityType} "${item.name}"? This cannot be undone.`)) return;
        try {
            await deleteDuplicateItem(entityType, item.id);
            showToast('Item deleted', 'success');
            await Promise.all([loadDuplicates(), refreshCatalog()]);
        } catch (e) {
            showToast(e?.message || 'Delete failed', 'error');
        }
    };

    // ── Product Request loaders ───────────────────────────────────
    const loadProductRequests = async () => {
        setPrLoading(true);
        setPrError(null);
        try {
            const status = prTab === 'All' ? undefined : prTab.toLowerCase();
            const [listRes, kpisRes] = await Promise.all([
                getProductRequests({ status }),
                getProductRequestKpis().catch(() => null),
            ]);
            const items = Array.isArray(listRes?.items)
                ? listRes.items
                : Array.isArray(listRes)
                    ? listRes
                    : [];
            setProductRequests(items);
            if (kpisRes) setPrKpis(kpisRes?.data && typeof kpisRes.data === 'object' ? kpisRes.data : kpisRes);
        } catch (e) {
            setPrError(e?.message || 'Failed to load product requests');
            setProductRequests([]);
        } finally {
            setPrLoading(false);
        }
    };

    const handlePrApproveConfirm = async () => {
        if (!prApproveTarget) return;
        if (!prApproveForm.name?.trim()) {
            showToast('Product name is required', 'error');
            return;
        }
        if (!prApproveForm.departmentId) {
            showToast('Department is required', 'error');
            return;
        }
        const prPriceErr = findFirstNegativeMoneyField([
            { label: 'Expected price', value: prApproveForm.expectedPrice },
        ]);
        if (prPriceErr) {
            showToast(`${prPriceErr} cannot be negative.`, 'error');
            return;
        }
        setPrActionBusy(true);
        try {
            const payload = {
                remarks: prRemarks?.trim() || undefined,
                name: prApproveForm.name.trim(),
                sku: prApproveForm.sku?.trim() || undefined,
                brandName: prApproveForm.brandName?.trim() || undefined,
                description: prApproveForm.description?.trim() || undefined,
                arabicName: prApproveForm.arabicName?.trim() || undefined,
                unit: prApproveForm.unit?.trim() || 'pcs',
                expectedPrice:
                    prApproveForm.expectedPrice === '' ? undefined : Number(prApproveForm.expectedPrice),
                departmentId: prApproveForm.departmentId,
                categoryId: prApproveForm.categoryId || null,
            };
            await approveProductRequest(prApproveTarget.id, payload);
            showToast('Request approved', 'success');
            setPrApproveTarget(null);
            setPrRemarks('');
            setPrApproveForm({
                name: '',
                sku: '',
                brandName: '',
                description: '',
                arabicName: '',
                unit: 'pcs',
                expectedPrice: '',
                departmentId: '',
                categoryId: '',
            });
            await loadProductRequests();
            await Promise.all([loadCatalog(), loadKpis({ silent: true })]);
        } catch (e) {
            showToast(e?.message || 'Approve failed', 'error');
        } finally {
            setPrActionBusy(false);
        }
    };

    const handlePrRejectConfirm = async () => {
        if (!prRejectTarget) return;
        const reason = prRejectReason?.trim();
        if (!reason) {
            showToast('Reason is required', 'error');
            return;
        }
        setPrActionBusy(true);
        try {
            await rejectProductRequest(prRejectTarget.id, reason);
            showToast('Request rejected', 'success');
            setPrRejectTarget(null);
            setPrRejectReason('');
            await loadProductRequests();
        } catch (e) {
            showToast(e?.message || 'Reject failed', 'error');
        } finally {
            setPrActionBusy(false);
        }
    };

    useEffect(() => {
        loadCatalog();
        loadKpis();
    }, []);

    useEffect(() => {
        if (activeTab === 'duplication') loadDuplicates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, dupEntityFilter]);

    useEffect(() => {
        if (activeTab === 'requests') loadProductRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, prTab]);

    const handleEditClick = (product) => {
        if (!product?.id) return;
        let departmentId =
            product.departmentId != null && product.departmentId !== ''
                ? String(product.departmentId)
                : product.department_id != null && product.department_id !== ''
                  ? String(product.department_id)
                  : '';
        let categoryId =
            product.categoryId != null && product.categoryId !== ''
                ? String(product.categoryId)
                : product.category_id != null && product.category_id !== ''
                  ? String(product.category_id)
                  : '';
        if (!departmentId && categoryId) {
            const byCat = productCategories.find((c) => String(c.id) === String(categoryId));
            if (byCat?.departmentId != null) departmentId = String(byCat.departmentId);
        }
        if (!categoryId) {
            const name = product.categoryName ?? product.category;
            if (name) {
                const candidates = productCategories.filter(
                    (c) =>
                        String(c.name || '').trim() === String(name).trim() &&
                        (!departmentId || String(c.departmentId) === String(departmentId)),
                );
                if (candidates.length === 1) categoryId = String(candidates[0].id);
                else if (candidates.length > 1 && departmentId) {
                    const exact = candidates.find((c) => String(c.departmentId) === String(departmentId));
                    if (exact) categoryId = String(exact.id);
                }
            }
        }
        setEditingProduct({
            ...product,
            departmentId,
            categoryId,
            arabicName: product.arabicName ?? product.arabic_name ?? '',
            salePrice: product.salePrice ?? '',
            purchasePrice: product.purchasePrice ?? '',
            brand: product.brandName ?? product.brand ?? '',
            minCorpPrice:
                product.minCorpPrice ??
                product.minPriceCorporate ??
                product.min_price_corporate ??
                '',
            maxCorpPrice:
                product.maxCorpPrice ??
                product.maxPriceCorporate ??
                product.max_price_corporate ??
                '',
            allowDecimalQty: toBoolAllowDecimal(product),
            conversionRules: [],
            kmTypeValue:
                product.kmTypeValue != null && product.kmTypeValue !== ''
                    ? String(product.kmTypeValue)
                    : '',
            isPriceEditable: toBoolPriceEditable(product),
            minPriceEditable:
                product.minPriceEditable == null && product.min_price_editable == null
                    ? ''
                    : String(product.minPriceEditable ?? product.min_price_editable),
        });
        setIsEditModalOpen(true);
    };

    const handleCreateProduct = async () => {
        const priceErr = validateCatalogProductPrices(newProduct);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        const editableErr = validateProductPriceEditableRules(newProduct);
        if (editableErr) {
            alert(editableErr);
            return;
        }
        setSaving(true);
        try {
            const kmRaw = newProduct.kmTypeValue;
            const kmTrimmed =
                kmRaw === '' || kmRaw == null ? '' : String(kmRaw).trim();
            const kmParsed = kmTrimmed === '' ? NaN : Number(kmTrimmed);
            const kmPayload =
                kmTrimmed !== '' && Number.isFinite(kmParsed) ? { kmTypeValue: kmParsed } : {};

            await createProduct({
                departmentId: newProduct.departmentId || undefined,
                categoryId: newProduct.categoryId || undefined,
                name: newProduct.name,
                arabicName: newProduct.arabicName?.trim() || undefined,
                sku: newProduct.sku || undefined,
                brandName: newProduct.brand || undefined,
                description: newProduct.description || undefined,
                unit: newProduct.unit || 'pcs',
                purchasePrice: parseNumberOr(newProduct.purchasePrice, 0),
                salePrice: parseNumberOr(newProduct.salePrice, 0),
                allowDecimalQty: false,
                minPriceCorporate: parseNumberOr(newProduct.minCorpPrice, 0),
                maxPriceCorporate: parseNumberOr(newProduct.maxCorpPrice, 0),
                isPriceEditable: !!newProduct.isPriceEditable,
                minPriceEditable:
                    newProduct.isPriceEditable && newProduct.minPriceEditable !== ''
                        ? parseNumberOr(newProduct.minPriceEditable, 0)
                        : null,
                ...kmPayload,
            });
            setIsAddModalOpen(false);
            setNewProduct({
                name: '',
                arabicName: '',
                sku: '',
                departmentId: '',
                categoryId: '',
                brand: '',
                unit: 'piece',
                type: 'Product',
                salePrice: '',
                purchasePrice: '',
                description: '',
                barcode: '',
                imageUrl: '',
                conversionRules: [],
                kmTypeValue: '',
                isPriceEditable: false,
                minPriceEditable: '',
            });
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to create product');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateCatalogProduct = async () => {
        if (!editingProduct?.id) return;
        if (!String(editingProduct.categoryId || '').trim()) {
            alert('Please select a category.');
            return;
        }
        const priceErr = validateCatalogProductPrices(editingProduct);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        const editableErr = validateProductPriceEditableRules(editingProduct);
        if (editableErr) {
            alert(editableErr);
            return;
        }
        setSaving(true);
        try {
            // PATCH /super-admin/products/:id — never send departmentId (not supported; department fixed after create).
            // Send categoryId so category changes persist. 200 returns a flat product (same fields as list/get).
            const kmRaw = editingProduct.kmTypeValue;
            const kmTrimmed =
                kmRaw === '' || kmRaw == null ? '' : String(kmRaw).trim();
            const kmParsed = kmTrimmed === '' ? null : Number(kmTrimmed);
            const kmTypeValue =
                kmTrimmed === '' || !Number.isFinite(kmParsed) ? null : kmParsed;

            await updateProduct(editingProduct.id, {
                name: editingProduct.name?.trim() || undefined,
                arabicName: editingProduct.arabicName?.trim() || undefined,
                sku: editingProduct.sku?.trim() || undefined,
                brandName: editingProduct.brand?.trim() || undefined,
                categoryId: String(editingProduct.categoryId).trim(),
                description: editingProduct.description?.trim() || undefined,
                unit: editingProduct.unit || undefined,
                purchasePrice:
                    editingProduct.purchasePrice === '' || editingProduct.purchasePrice == null
                        ? undefined
                        : parseNumberOr(editingProduct.purchasePrice, 0),
                salePrice: editingProduct.salePrice === '' ? null : parseNumberOr(editingProduct.salePrice, 0),
                minPriceCorporate:
                    editingProduct.minCorpPrice === '' || editingProduct.minCorpPrice == null
                        ? undefined
                        : parseNumberOr(editingProduct.minCorpPrice, 0),
                maxPriceCorporate:
                    editingProduct.maxCorpPrice === '' || editingProduct.maxCorpPrice == null
                        ? undefined
                        : parseNumberOr(editingProduct.maxCorpPrice, 0),
                isActive: editingProduct.isActive ?? true,
                allowDecimalQty: !!editingProduct.allowDecimalQty,
                isPriceEditable: !!editingProduct.isPriceEditable,
                minPriceEditable:
                    editingProduct.isPriceEditable &&
                    editingProduct.minPriceEditable !== '' &&
                    editingProduct.minPriceEditable != null
                        ? parseNumberOr(editingProduct.minPriceEditable, 0)
                        : null,
                kmTypeValue,
            });
            setIsEditModalOpen(false);
            setEditingProduct(null);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to update product');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateCatalogService = async () => {
        const priceErr = validateCatalogServicePrices(newService);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        setSaving(true);
        try {
            await createService({
                departmentId: newService.departmentId || undefined,
                categoryId: newService.categoryId || undefined,
                name: newService.name,
                arabicName: newService.arabicName?.trim() || undefined,
                sku: newService.sku || undefined,
                description: newService.description || undefined,
                unitOfMeasurement: newService.unitOfMeasurement || 'ea',
                sellingPrice: newService.sellingPrice === '' ? null : parseNumberOr(newService.sellingPrice, 0),
                isPriceEditable: !!newService.isPriceEditable,
                minPriceCorporate: parseNumberOr(newService.minPriceCorporate, 0),
                maxPriceCorporate: parseNumberOr(newService.maxPriceCorporate, 0),
            });
            setIsAddServiceModalOpen(false);
            setNewService({
                name: '',
                arabicName: '',
                sku: '',
                description: '',
                unitOfMeasurement: 'ea',
                sellingPrice: '',
                isPriceEditable: true,
                minPriceCorporate: '',
                maxPriceCorporate: '',
                departmentId: '',
                categoryId: '',
            });
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to create service');
        } finally {
            setSaving(false);
        }
    };

    const openEditService = (service) => {
        setEditingService({
            id: service.id,
            name: service.name || '',
            arabicName: service.arabicName ?? service.arabic_name ?? '',
            sku: service.sku || '',
            description: service.description || '',
            sellingPrice: service.sellingPrice == null ? '' : String(service.sellingPrice),
            isPriceEditable: toBoolPriceEditable(service),
            minPriceCorporate:
                service.minPriceCorporate == null && service.min_price_corporate == null
                    ? ''
                    : String(service.minPriceCorporate ?? service.min_price_corporate),
            maxPriceCorporate:
                service.maxPriceCorporate == null && service.max_price_corporate == null
                    ? ''
                    : String(service.maxPriceCorporate ?? service.max_price_corporate),
            isActive: service.isActive !== false,
            categoryId: service.categoryId != null ? String(service.categoryId) : '',
            categoryName: service.categoryName ?? service.category?.name ?? '',
            vatMode: service.vatMode ?? service.vat_mode ?? '',
            createdAt: service.createdAt ?? service.created_at ?? '',
        });
        setIsEditServiceModalOpen(true);
    };

    const handleUpdateCatalogService = async () => {
        if (!editingService?.id) return;
        const priceErr = validateCatalogServicePrices(editingService);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: (editingService.name ?? '').trim(),
                arabicName: (editingService.arabicName ?? '').trim(),
                sku: (editingService.sku ?? '').trim(),
                description: (editingService.description ?? '').trim(),
                sellingPrice:
                    editingService.sellingPrice === ''
                        ? null
                        : parseNumberOr(editingService.sellingPrice, 0),
                minPriceCorporate:
                    editingService.minPriceCorporate === '' || editingService.minPriceCorporate == null
                        ? undefined
                        : parseNumberOr(editingService.minPriceCorporate, 0),
                maxPriceCorporate:
                    editingService.maxPriceCorporate === '' || editingService.maxPriceCorporate == null
                        ? undefined
                        : parseNumberOr(editingService.maxPriceCorporate, 0),
                isPriceEditable: !!editingService.isPriceEditable,
                isActive: !!editingService.isActive,
                categoryId:
                    editingService.categoryId == null || editingService.categoryId === ''
                        ? null
                        : String(editingService.categoryId),
                vatMode:
                    editingService.vatMode == null || editingService.vatMode === ''
                        ? null
                        : String(editingService.vatMode),
            };
            await updateService(editingService.id, payload);
            setIsEditServiceModalOpen(false);
            setEditingService(null);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to update service');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleProductField = async (product, field, nextValue, extraPayload = {}) => {
        if (!product?.id) return;
        const busyKey = `${catalogItemId(product)}:${field}`;
        const patch = { [field]: nextValue, ...extraPayload };
        setProductToggleBusyKey(busyKey);
        try {
            const updated = await updateProduct(catalogItemId(product), patch);
            const merged = updated && typeof updated === 'object' ? { ...patch, ...updated } : patch;
            const applyPatch = (item) =>
                catalogIdsMatch(item, product) ? { ...item, ...merged } : item;
            setProducts((prev) => prev.map(applyPatch));
            setDepartmentProducts((prev) =>
                prev.map((dept) => ({
                    ...dept,
                    products: (dept.products || []).map(applyPatch),
                })),
            );
            setEditingProduct((prev) =>
                prev && catalogIdsMatch(prev, product) ? { ...prev, ...merged } : prev,
            );
            await refreshCatalog();
            await loadKpis({ silent: true });
        } catch (e) {
            alert(e?.message || 'Failed to update product');
        } finally {
            setProductToggleBusyKey((current) => (current === busyKey ? '' : current));
        }
    };

    const handleToggleProductPriceEditable = async (product, currentlyEditable) => {
        if (!product?.id) return;
        if (currentlyEditable) {
            await handleToggleProductField(product, 'isPriceEditable', false);
            return;
        }
        const raw = window.prompt(
            'Enter minimum price (SAR, VAT inclusive). Cashier cannot go below this amount:',
            product.minPriceEditable != null && product.minPriceEditable !== ''
                ? String(product.minPriceEditable ?? product.min_price_editable ?? '')
                : '',
        );
        if (raw == null) return;
        const min = parseNumberOr(raw, NaN);
        if (!Number.isFinite(min) || min < 0) {
            alert('Minimum price must be zero or greater.');
            return;
        }
        await handleToggleProductField(product, 'isPriceEditable', true, {
            minPriceEditable: min,
        });
    };

    const handleToggleServiceField = async (service, field, nextValue, extraPayload = {}) => {
        if (!service?.id) return;
        const busyKey = `${catalogItemId(service)}:${field}`;
        const patch = { [field]: nextValue, ...extraPayload };
        setServiceToggleBusyKey(busyKey);
        try {
            const updated = await updateService(catalogItemId(service), patch);
            const merged = updated && typeof updated === 'object' ? { ...patch, ...updated } : patch;
            const applyPatch = (item) =>
                catalogIdsMatch(item, service) ? { ...item, ...merged } : item;
            setServices((prev) => prev.map(applyPatch));
            setDepartmentServices((prev) =>
                prev.map((dept) => ({
                    ...dept,
                    services: (dept.services || []).map(applyPatch),
                })),
            );
            setEditingService((prev) =>
                prev && catalogIdsMatch(prev, service) ? { ...prev, ...merged } : prev,
            );
            if (field === 'isActive') {
                if (nextValue === false && serviceStatusFilter === 'Approved') {
                    setServiceStatusFilter('All');
                } else if (nextValue === true && serviceStatusFilter === 'Rejected') {
                    setServiceStatusFilter('All');
                }
            }
            await refreshCatalog();
            await loadKpis({ silent: true });
        } catch (e) {
            alert(e?.message || 'Failed to update service');
        } finally {
            setServiceToggleBusyKey((current) => (current === busyKey ? '' : current));
        }
    };

    const handleEditDeptClick = (dept) => {
        setEditingDept(dept);
        setIsEditDeptModalOpen(true);
    };

    const handleCreateDepartment = async () => {
        if (!newDept.name.trim()) return;
        setSaving(true);
        try {
            await createDepartment({ name: newDept.name.trim() });
            setNewDept({ name: '' });
            setIsAddDeptModalOpen(false);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to create department');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateCategory = async () => {
        if (!newCat.name.trim() || !newCat.departmentId) return;
        setSaving(true);
        try {
            await createCategory({
                type: newCat.type,
                name: newCat.name.trim(),
                departmentId: String(newCat.departmentId),
            });
            setNewCat({ type: 'product', name: '', departmentId: '' });
            setIsAddCatModalOpen(false);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to create category');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDeptClick = (id) => {
        if (!window.confirm('Delete this department? This cannot be undone.')) return;
        setSaving(true);
        deleteDepartment(id)
            .then(async () => {
                await refreshCatalog();
            })
            .catch(async (e) => {
                if (window.confirm(`${e.message || 'Delete failed.'}\n\nIf this item is linked, disable it instead?`)) {
                    await updateDepartment(id, { isActive: false });
                    await refreshCatalog();
                } else {
                    alert(e.message || 'Delete failed');
                }
            })
            .finally(() => setSaving(false));
    };

    const handleEditCatClick = (cat) => {
        setEditingCat({
            ...cat,
            departmentId: cat.departmentId,
            type: cat.type || 'product',
        });
        setIsEditCatModalOpen(true);
    };

    const handleDeleteCatClick = (id) => {
        if (!window.confirm('Delete this category? This cannot be undone.')) return;
        setSaving(true);
        deleteCategory(id)
            .then(async () => {
                await refreshCatalog();
            })
            .catch((e) => {
                alert(e?.message || 'Delete failed. The category may be in use by products or services.');
            })
            .finally(() => setSaving(false));
    };

    const handleUpdateDepartment = async () => {
        if (!editingDept?.id || !editingDept?.name?.trim()) return;
        setSaving(true);
        try {
            await updateDepartment(editingDept.id, {
                name: editingDept.name.trim(),
                isActive: editingDept.isActive ?? true,
            });
            setIsEditDeptModalOpen(false);
            setEditingDept(null);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to update department');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateCategory = async () => {
        if (!editingCat?.id || !editingCat?.name?.trim() || !editingCat?.departmentId) return;
        setSaving(true);
        try {
            // Backend PATCH /categories/:id only accepts { type?, name?, departmentId? }.
            // Do NOT send isActive — categories don't expose it (will 400 with strict validation).
            await updateCategory(editingCat.id, {
                name: editingCat.name.trim(),
                type: editingCat.type || 'product',
                departmentId: String(editingCat.departmentId),
            });
            setIsEditCatModalOpen(false);
            setEditingCat(null);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to update category');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCatalogProduct = async () => {
        if (!editingProduct?.id) return;
        if (!window.confirm('Delete this product? This cannot be undone.')) return;
        setSaving(true);
        try {
            await deleteProduct(editingProduct.id);
            setIsEditModalOpen(false);
            setEditingProduct(null);
            await refreshCatalog();
        } catch (e) {
            if (window.confirm(`${e.message || 'Delete failed.'}\n\nIf this item is linked, disable it instead?`)) {
                await updateProduct(editingProduct.id, { isActive: false });
                setIsEditModalOpen(false);
                setEditingProduct(null);
                await refreshCatalog();
            } else {
                alert(e.message || 'Delete failed');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCatalogService = async () => {
        if (!editingService?.id) return;
        if (!window.confirm('Delete this service? This cannot be undone.')) return;
        setSaving(true);
        try {
            await deleteService(editingService.id);
            setIsEditServiceModalOpen(false);
            setEditingService(null);
            await refreshCatalog();
        } catch (e) {
            if (window.confirm(`${e.message || 'Delete failed.'}\n\nIf this item is linked, disable it instead?`)) {
                await updateService(editingService.id, { isActive: false });
                setIsEditServiceModalOpen(false);
                setEditingService(null);
                await refreshCatalog();
            } else {
                alert(e.message || 'Delete failed');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleBulkFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedBulkFile(file);
        setBulkImportResult(null);
    };

    const closeBulkProductModal = () => {
        setIsBulkProductModalOpen(false);
        setSelectedBulkFile(null);
        setBulkImportResult(null);
        setBulkImporting(false);
        bulkImportInFlightRef.current = false;
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    };

    const closeBulkServiceModal = () => {
        setIsBulkServiceModalOpen(false);
        setSelectedBulkServiceFile(null);
        setBulkServiceImportResult(null);
        setBulkServiceImporting(false);
        bulkServiceImportInFlightRef.current = false;
        if (bulkServiceFileInputRef.current) bulkServiceFileInputRef.current.value = '';
    };

    const handleBulkImport = async () => {
        if (!selectedBulkFile || bulkImporting || bulkImportInFlightRef.current) return;
        bulkImportInFlightRef.current = true;
        setBulkImporting(true);
        setBulkImportResult(null);
        try {
            const result = await importProductsFromCsv(selectedBulkFile);
            setBulkImportResult(result);
            await refreshCatalog();
        } catch (e) {
            console.error('[MasterCatalog] bulk import failed', e);
            alert(e.message || 'CSV import failed');
        } finally {
            bulkImportInFlightRef.current = false;
            setBulkImporting(false);
        }
    };

    const handleBulkServiceFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedBulkServiceFile(file);
        setBulkServiceImportResult(null);
    };

    const handleBulkServiceImport = async () => {
        if (!selectedBulkServiceFile || bulkServiceImporting || bulkServiceImportInFlightRef.current) return;
        bulkServiceImportInFlightRef.current = true;
        setBulkServiceImporting(true);
        setBulkServiceImportResult(null);
        try {
            const result = await importServicesFromCsv(selectedBulkServiceFile);
            setBulkServiceImportResult(result);
            await refreshCatalog();
        } catch (e) {
            console.error('[MasterCatalog] service CSV import failed', e);
            alert(e.message || 'Service CSV import failed');
        } finally {
            bulkServiceImportInFlightRef.current = false;
            setBulkServiceImporting(false);
        }
    };

    const renderMasterCatalog = () => (
        <div className="mc-content-area">
            <div className="mc-filter-bar">
                <div className="mc-status-filters">
                    {['Approved', 'Pending', 'Rejected', 'All'].map(s => (
                        <button
                            key={s}
                            className={`mc-status-btn ${statusFilter === s ? 'active' : ''}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                
                <div className="mc-search-box">
                    <Search size={18} className="mc-search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search name, SKU, brand, KM type value…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="mc-filter-selects">
                    <div className="mc-select-wrapper">
                        <select
                            value={selectedProductDepartment}
                            onChange={(e) => setSelectedProductDepartment(e.target.value)}
                        >
                            <option value="">All Departments</option>
                            {productDepartmentOptions.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} />
                    </div>
                    <span className="mc-items-count">
                        {searchQuery ? `${displayedProducts.length} of ${products.length}` : `${displayedProducts.length} items`}
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="mc-empty-state">
                    <div className="mc-empty-icon"><RefreshCw size={28} className="spin" /></div>
                    <p>Loading products…</p>
                </div>
            ) : displayedProducts.length === 0 ? (
                <div className="mc-empty-state">
                    <div className="mc-empty-icon"><Package size={44} opacity={0.18} /></div>
                    <p>{searchQuery ? `No products matching "${searchQuery}"` : 'No products yet'}</p>
                </div>
            ) : (
                <div className="mc-products-grid">
                    {displayedProducts.map((p) => {
                        const createdRaw = p.createdAt ?? p.created_at;
                        const createdLabel = formatCatalogCreatedAt(createdRaw);
                        const priceEditable = toBoolPriceEditable(p);
                        const priceBusy = productToggleBusyKey === `${catalogItemId(p)}:isPriceEditable`;
                        return (
                            <div
                                key={p.id}
                                className="mc-product-card"
                                onClick={() => { if (hasPermission('inventory.master-catalog.products.edit')) handleEditClick(p); }}
                                style={{ cursor: hasPermission('inventory.master-catalog.products.edit') ? 'pointer' : 'default' }}
                            >
                                <div className="mc-pc-header">
                                    <div className="mc-pc-icon"><Edit3 size={18} /></div>
                                    <span className={`mc-pc-status ${p.isActive === false ? 'rejected' : 'approved'}`}>
                                        {p.isActive === false ? 'Rejected' : 'Approved'}
                                    </span>
                                </div>
                                <div className="mc-pc-body">
                                    <h3 className="mc-pc-name">{p.name}</h3>
                                    <p className="mc-pc-sku">{p.sku || 'No SKU'}</p>
                                    {createdLabel ? (
                                        <p className="mc-pc-created" title={String(createdRaw)}>
                                            Created {createdLabel}
                                        </p>
                                    ) : null}
                                    <div className="mc-pc-tags">
                                        <span className="mc-pc-tag">Product</span>
                                        <span className="mc-pc-tag">{p.unit || 'pcs'}</span>
                                        <span className="mc-pc-tag">{p.categoryName || '—'}</span>
                                        {p.kmTypeValue != null && String(p.kmTypeValue).trim() !== '' && (
                                            <span className="mc-pc-tag" title="KM type value">
                                                KM {p.kmTypeValue}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mc-pc-footer">
                                        <span className="mc-pc-price">SAR {p.salePrice ?? 0}</span>
                                        {hasPermission('inventory.master-catalog.products.edit') && (
                                            <button className="mc-pc-edit-btn" onClick={(e) => { e.stopPropagation(); handleEditClick(p); }}>
                                                <Edit3 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {hasPermission('inventory.master-catalog.products.edit') && (
                                        <div
                                            className="mc-sc-toggle-group"
                                            style={{ justifyContent: 'flex-start', gap: 8, width: '100%', minWidth: 0, marginTop: 10 }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="mc-toggle-label">
                                                <strong>Price Editable</strong>
                                                <span className={priceEditable ? 'mc-toggle-state--on' : ''}>
                                                    {priceBusy
                                                        ? 'Updating...'
                                                        : priceEditable
                                                          ? `Editable · min SAR ${Number(p.minPriceEditable ?? p.min_price_editable ?? 0).toFixed(2)}`
                                                          : 'Fixed price'}
                                                </span>
                                            </div>
                                            <div
                                                className={`mc-toggle-switch${priceEditable ? ' active' : ''}`}
                                                role="button"
                                                aria-label={`Toggle ${p.name} price editable`}
                                                aria-pressed={priceEditable}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (priceBusy) return;
                                                    handleToggleProductPriceEditable(p, priceEditable);
                                                }}
                                                style={{ opacity: priceBusy ? 0.65 : 1, pointerEvents: priceBusy ? 'none' : 'auto' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderMasterDepartment = () => (
        <div className="mc-content-area">
            <div className="mc-services-header">
                <div className="mc-services-actions">
                    <div className="mc-search-box small">
                        <Search size={16} className="mc-search-icon" />
                        <input
                            type="text"
                            placeholder="Search departments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {hasPermission('inventory.master-catalog.departments.create') && (
                        <button className="mc-btn-primary small" onClick={() => setIsAddDeptModalOpen(true)}><Plus size={14} /> Add Department</button>
                    )}
                </div>
            </div>

            <div className="mc-dept-grid">
                {filteredDepartments.map(dept => (
                    <div key={dept.id} className="mc-dept-card">
                        <div className="mc-dept-icon"><LayoutGrid size={24} color="#D4A017" /></div>
                        <h3 className="mc-dept-name">{dept.name}</h3>
                        <p className="mc-dept-meta">Department</p>
                        <div className="mc-dept-actions">
                            {hasPermission('inventory.master-catalog.departments.edit') && (
                                <button className="mc-btn-icon" onClick={() => handleEditDeptClick(dept)}><Edit3 size={14} /></button>
                            )}
                            {hasPermission('inventory.master-catalog.departments.delete') && (
                                <button className="mc-btn-icon delete" onClick={() => handleDeleteDeptClick(dept.id)}><Trash2 size={14} /></button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMasterCategory = () => (
        <div className="mc-content-area">
            <div className="mc-services-header">
                <div className="mc-services-actions">
                    <div className="mc-search-box small">
                        <Search size={16} className="mc-search-icon" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {hasPermission('inventory.master-catalog.categories.create') && (
                        <button className="mc-btn-primary small" onClick={() => setIsAddCatModalOpen(true)}><Plus size={14} /> Add Category</button>
                    )}
                </div>
            </div>

            <div className="mc-availability-table-container">
                <table className="mc-availability-table">
                    <thead>
                        <tr>
                            <th>CATEGORY NAME</th>
                            <th>DEPARTMENT</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCategories.map(cat => (
                            <tr key={cat.id}>
                                <td>
                                    <div className="mc-table-product">
                                        <Tags size={16} opacity={0.3} />
                                        {cat.name}
                                    </div>
                                </td>
                                <td>
                                    <span className="mc-pc-tag">
                                        {departments.find((d) => String(d.id) === String(cat.departmentId))?.name || '—'}
                                    </span>
                                </td>
                                <td>
                                    <div className="mc-table-actions">
                                        {hasPermission('inventory.master-catalog.categories.edit') && (
                                            <button className="mc-btn-icon" onClick={() => handleEditCatClick(cat)}><Edit3 size={14} /></button>
                                        )}
                                        {hasPermission('inventory.master-catalog.categories.delete') && (
                                            <button className="mc-btn-icon delete" onClick={() => handleDeleteCatClick(cat.id)}><Trash2 size={14} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderProductRequests = () => {
        const statusBadge = (status) => {
            const s = String(status || '').toLowerCase();
            const cls = s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending';
            return <span className={`mc-status-badge ${cls}`}>{s ? s[0].toUpperCase() + s.slice(1) : '—'}</span>;
        };
        const fmtDate = (iso) => {
            if (!iso) return '—';
            const d = new Date(iso);
            return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
        };
        const fmtMoney = (v) => {
            if (v == null || v === '') return '—';
            const n = Number(v);
            return Number.isFinite(n) ? `SAR ${n.toFixed(2)}` : '—';
        };

        return (
            <div className="mc-content-area">
                <div className="mc-pr-kpis">
                    {[
                        { key: 'total', label: 'Total', color: '#111827', value: prKpis?.total },
                        { key: 'pending', label: 'Pending', color: '#D97706', value: prKpis?.pending },
                        { key: 'approved', label: 'Approved', color: '#15803D', value: prKpis?.approved },
                        { key: 'rejected', label: 'Rejected', color: '#B91C1C', value: prKpis?.rejected },
                    ].map((c) => (
                        <div key={c.key} className="mc-pr-kpi" style={{ borderColor: c.color }}>
                            <span className="mc-pr-kpi-value" style={{ color: c.color }}>{kpiNum(c.value)}</span>
                            <span className="mc-pr-kpi-label">{c.label}</span>
                        </div>
                    ))}
                </div>

                <div className="mc-services-header">
                    <div className="mc-services-tabs">
                        {['Pending', 'Approved', 'Rejected', 'All'].map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={`mc-service-tab ${prTab === s ? 'active' : ''}`}
                                onClick={() => setPrTab(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="mc-btn-ghost" onClick={loadProductRequests} disabled={prLoading}>
                        <RefreshCw size={14} /> {prLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>

                {prError && (
                    <div className="mc-kpi-error">
                        <AlertCircle size={14} /> {prError}
                        <button type="button" className="mc-kpi-retry" onClick={loadProductRequests}>
                            <RefreshCw size={12} /> Retry
                        </button>
                    </div>
                )}

                {prLoading ? (
                    <div className="mc-empty-state"><p>Loading…</p></div>
                ) : productRequests.length === 0 ? (
                    <div className="mc-empty-state">
                        <div className="mc-empty-icon"><CheckCircle2 size={48} opacity={0.15} /></div>
                        <p>No {prTab.toLowerCase()} product requests</p>
                    </div>
                ) : (
                    <div className="mc-pr-grid">
                        {productRequests.map((r) => {
                            const submitter = r.submittedByUser || {};
                            const workshop = r.workshop || {};
                            const branch = r.branch || {};
                            const pending = String(r.status || '').toLowerCase() === 'pending';
                            return (
                                <div key={r.id} className="mc-pr-card">
                                    <div className="mc-pr-card-head">
                                        <div className="mc-pr-card-title">
                                            <Package size={16} color="#6B7280" />
                                            <strong>{r.name || '—'}</strong>
                                        </div>
                                        {statusBadge(r.status)}
                                    </div>
                                    <div className="mc-pr-card-body">
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">SKU</span>
                                            <span className="mc-pr-value">{r.sku || '—'}</span>
                                        </div>
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">Brand</span>
                                            <span className="mc-pr-value">{r.brandName || '—'}</span>
                                        </div>
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">Requested from Supplier</span>
                                            <span className="mc-pr-value">
                                                {submitter.name || submitter.email || '—'}
                                            </span>
                                        </div>
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">Expected price</span>
                                            <span className="mc-pr-value">{fmtMoney(r.expectedPrice)}</span>
                                        </div>
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">Submitted on</span>
                                            <span className="mc-pr-value">{fmtDate(r.createdAt)}</span>
                                        </div>
                                        {r.notes && (
                                            <div className="mc-pr-notes">
                                                <span className="mc-pr-label">Notes</span>
                                                <p>{r.notes}</p>
                                            </div>
                                        )}
                                        {String(r.status).toLowerCase() === 'rejected' && r.rejectionReason && (
                                            <div className="mc-pr-rejection">
                                                <strong>Rejection reason:</strong> {r.rejectionReason}
                                            </div>
                                        )}
                                    </div>
                                    {pending && (
                                        <div className="mc-pr-card-actions">
                                            <button
                                                type="button"
                                                className="mc-btn-ghost"
                                                onClick={() => { setPrRejectTarget(r); setPrRejectReason(''); }}
                                            >
                                                <XCircle size={14} /> Reject
                                            </button>
                                            <button
                                                type="button"
                                                className="mc-btn-primary"
                                                onClick={() => {
                                                    setPrApproveTarget(r);
                                                    setPrRemarks('');
                                                    setPrApproveForm({
                                                        name: r?.name || '',
                                                        sku: r?.sku || '',
                                                        brandName: r?.brandName || '',
                                                        description: r?.description || '',
                                                        arabicName: r?.arabicName || '',
                                                        unit: r?.unit || 'pcs',
                                                        expectedPrice:
                                                            r?.expectedPrice === null || r?.expectedPrice === undefined
                                                                ? ''
                                                                : String(r.expectedPrice),
                                                        departmentId: r?.departmentId ? String(r.departmentId) : '',
                                                        categoryId: r?.categoryId ? String(r.categoryId) : '',
                                                    });
                                                }}
                                            >
                                                <CheckCircle2 size={14} /> Approve
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderDuplicationReview = () => {
        const totalAffected = dupGroups.reduce((sum, g) => sum + (g.items?.length || g.count || 0), 0);
        const entityIcon = {
            product: Package,
            service: Layers,
            department: LayoutGrid,
            category: Tags,
        };
        return (
            <div className="mc-content-area">
                <div className="mc-engine-banner">
                    <strong>Duplication Control Engine</strong>
                    <p>Automatically detects similar records across products, services, departments and categories.</p>
                </div>

                <div className="mc-services-header">
                    <div className="mc-services-tabs">
                        {[
                            { id: '', label: 'All' },
                            { id: 'product', label: 'Products' },
                            { id: 'service', label: 'Services' },
                            { id: 'department', label: 'Departments' },
                            { id: 'category', label: 'Categories' },
                        ].map((t) => (
                            <button
                                key={t.id || 'all'}
                                type="button"
                                className={`mc-service-tab ${dupEntityFilter === t.id ? 'active' : ''}`}
                                onClick={() => setDupEntityFilter(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="mc-btn-ghost" onClick={loadDuplicates} disabled={dupLoading}>
                        <RefreshCw size={14} /> {dupLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>

                <div className={`mc-alert-banner ${dupGroups.length ? 'warning' : 'success'}`}>
                    <div className="mc-alert-icon">
                        {dupGroups.length ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    </div>
                    <div className="mc-alert-content">
                        <strong>Duplicate Detection</strong>
                        <p>
                            {dupLoading
                                ? 'Scanning…'
                                : dupGroups.length
                                    ? `${dupGroups.length} group(s) · ${totalAffected} record(s) affected`
                                    : 'No duplicate groups detected'}
                        </p>
                    </div>
                    {dupGroups.length > 0 && (
                        <span className="mc-alert-badge">{dupGroups.length} Group(s)</span>
                    )}
                </div>

                {dupError && (
                    <div className="mc-kpi-error">
                        <AlertCircle size={14} /> {dupError}
                        <button type="button" className="mc-kpi-retry" onClick={loadDuplicates}>
                            <RefreshCw size={12} /> Retry
                        </button>
                    </div>
                )}

                {!dupLoading && dupGroups.length === 0 && !dupError && (
                    <div className="mc-empty-state">
                        <div className="mc-empty-icon"><CheckCircle2 size={48} opacity={0.15} /></div>
                        <p>All clear — no duplicate groups{dupEntityFilter ? ` in ${dupEntityFilter}s` : ''}.</p>
                    </div>
                )}

                <div className="mc-duplicates-list">
                    {dupGroups.map((group) => {
                        const key = `${group.entityType}::${group.nameKey}`;
                        const isOpen = expandedDupKey === key;
                        const Icon = entityIcon[group.entityType] || Package;
                        const items = Array.isArray(group.items) ? group.items : [];
                        return (
                            <div key={key} className="mc-dup-group">
                                <button
                                    type="button"
                                    className="mc-dup-group-head"
                                    onClick={() => setExpandedDupKey(isOpen ? null : key)}
                                >
                                    <div className="mc-dup-group-title">
                                        <Icon size={16} color="#991B1B" />
                                        <strong>{group.displayName || group.nameKey}</strong>
                                        <span className={`mc-pc-tag mc-dup-entity-tag ${group.entityType}`}>
                                            {group.entityType}
                                        </span>
                                        <span className="mc-dup-count-badge">{group.count ?? items.length}</span>
                                    </div>
                                    <ChevronDown
                                        size={16}
                                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                                    />
                                </button>
                                {isOpen && (
                                    <div className="mc-dup-group-body">
                                        <table className="mc-availability-table">
                                            <thead>
                                                <tr>
                                                    <th>NAME</th>
                                                    <th>SKU</th>
                                                    <th>KM TYPE</th>
                                                    <th>VAT MODE</th>
                                                    <th>CREATED</th>
                                                    <th>DEPARTMENT</th>
                                                    <th>CATEGORY</th>
                                                    <th>STATUS</th>
                                                    <th>ACTIONS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item.id}>
                                                        <td>{item.name || '—'}</td>
                                                        <td className="mono">{item.sku || '—'}</td>
                                                        <td className="mono">
                                                            {group.entityType === 'product' &&
                                                            item.kmTypeValue != null &&
                                                            String(item.kmTypeValue).trim() !== ''
                                                                ? item.kmTypeValue
                                                                : '—'}
                                                        </td>
                                                        <td className="mono">
                                                            {group.entityType === 'service' &&
                                                            (item.vatMode != null || item.vat_mode != null) &&
                                                            String(item.vatMode ?? item.vat_mode).trim() !== ''
                                                                ? String(item.vatMode ?? item.vat_mode)
                                                                : '—'}
                                                        </td>
                                                        <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                                            {formatCatalogCreatedAt(item.createdAt ?? item.created_at) || '—'}
                                                        </td>
                                                        <td>{item.department?.name || '—'}</td>
                                                        <td>{item.category?.name || '—'}</td>
                                                        <td>
                                                            <span className={`mc-pc-status ${item.isActive === false ? 'rejected' : 'approved'}`}>
                                                                {item.isActive === false ? 'Inactive' : 'Active'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {hasPermission('inventory.master-catalog.duplication.edit') && (
                                                                <button
                                                                    type="button"
                                                                    className="mc-btn-icon delete"
                                                                    title="Delete this record"
                                                                    onClick={() => handleDeleteDuplicateItem(group.entityType, item)}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="mc-dup-group-actions">
                                            <button
                                                type="button"
                                                className="mc-btn-ghost"
                                                onClick={() => handleIgnoreDuplicate(group)}
                                            >
                                                <ShieldCheck size={14} /> Mark as not duplicate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderSupplierAvailability = () => (
        <div className="mc-content-area">
            <div className="mc-filter-bar compact">
                <div className="mc-search-box">
                    <Search size={18} className="mc-search-icon" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="mc-availability-badges">
                    <span className="mc-av-badge green">0 with stock</span>
                    <span className="mc-av-badge red">{filteredAvailability.length} no supplier</span>
                </div>
            </div>

            <div className="mc-availability-table-container">
                <table className="mc-availability-table">
                    <thead>
                        <tr>
                            <th>PRODUCT</th>
                            <th>CATEGORY</th>
                            <th>UNIT</th>
                            <th>KM TYPE</th>
                            <th>SUPPLIERS</th>
                            <th>AVAILABILITY</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(loading ? [] : filteredAvailability).map((p) => (
                            <tr key={p.id}>
                                <td>
                                    <div className="mc-table-product">
                                        <Package size={16} opacity={0.3} />
                                        {p.name}
                                    </div>
                                </td>
                                <td>{p.categoryName || '—'}</td>
                                <td>{p.unit || 'pcs'}</td>
                                <td className="mono">
                                    {p.kmTypeValue != null && String(p.kmTypeValue).trim() !== ''
                                        ? p.kmTypeValue
                                        : '—'}
                                </td>
                                <td className="mc-muted">No suppliers</td>
                                <td><span className="mc-av-status red">No Stock</span></td>
                            </tr>
                        ))}
                        {!loading && filteredAvailability.length === 0 && (
                            <tr>
                                <td colSpan={6} className="mc-muted" style={{ textAlign: 'center', padding: '24px' }}>
                                    {searchQuery ? `No products matching "${searchQuery}"` : 'No products yet'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderServices = () => (
        <div className="mc-content-area">
            <div className="mc-services-header">
                <div className="mc-services-tabs">
                    {['Approved', 'Pending', 'Rejected', 'All'].map((s) => (
                        <button
                            key={s}
                            type="button"
                            className={`mc-service-tab ${s === serviceStatusFilter ? 'active' : ''}`}
                            onClick={() => setServiceStatusFilter(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                <div className="mc-services-actions">
                    <div className="mc-search-box small">
                        <Search size={16} className="mc-search-icon" />
                        <input
                            type="text"
                            placeholder="Search services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="mc-select-wrapper">
                        <select
                            value={selectedServiceDepartment}
                            onChange={(e) => setSelectedServiceDepartment(e.target.value)}
                        >
                            <option value="">All Departments</option>
                            {serviceDepartmentOptions.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} />
                    </div>
                </div>
            </div>

            <div className="mc-services-summary">
                <div className="mc-ss-card purple">
                    <div className="mc-ss-value">{services.length}</div>
                    <div className="mc-ss-label">Total Services</div>
                </div>
                <div className="mc-ss-card green">
                    <div className="mc-ss-value">{services.filter((s) => s.isActive !== false).length}</div>
                    <div className="mc-ss-label">Approved</div>
                </div>
                <div className="mc-ss-card blue">
                    <div className="mc-ss-value">{services.filter((s) => toBoolPriceEditable(s)).length}</div>
                    <div className="mc-ss-label">Price Editable</div>
                </div>
            </div>

            {loading ? (
                <div className="mc-empty-state">
                    <div className="mc-empty-icon">
                        <RefreshCw size={28} className="spin" />
                    </div>
                    <p>Loading services…</p>
                </div>
            ) : displayedServices.length === 0 ? (
                <div className="mc-empty-state">
                    <div className="mc-empty-icon">
                        <Layers size={44} opacity={0.18} />
                    </div>
                    <p>
                        {services.length === 0
                            ? 'No services yet'
                            : searchQuery
                              ? `No services matching "${searchQuery}"`
                              : 'No services match this filter'}
                    </p>
                </div>
            ) : (
                <div className="mc-services-grid">
                    {displayedServices.map((p) => {
                        const isActive = toBoolActive(p);
                        const priceEditable = toBoolPriceEditable(p);
                        const createdRaw = p.createdAt ?? p.created_at;
                        const createdLabel = formatCatalogCreatedAt(createdRaw);
                        const activeBusy = serviceToggleBusyKey === `${catalogItemId(p)}:isActive`;
                        const priceBusy = serviceToggleBusyKey === `${catalogItemId(p)}:isPriceEditable`;
                        return (
                            <div
                                key={p.id}
                                className="mc-service-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => { if (hasPermission('inventory.master-catalog.services.edit')) openEditService(p); }}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && hasPermission('inventory.master-catalog.services.edit')) {
                                        e.preventDefault();
                                        openEditService(p);
                                    }
                                }}
                                style={{ cursor: hasPermission('inventory.master-catalog.services.edit') ? 'pointer' : 'default' }}
                            >
                                <div className="mc-sc-header">
                                    <div className="mc-sc-icon">
                                        <Edit3 size={16} />
                                    </div>
                                    <span className={`mc-pc-status ${isActive ? 'approved' : 'rejected'}`}>
                                        {isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="mc-sc-body">
                                    <h4 className="mc-sc-name">{p.name}</h4>
                                    <p className="mc-sc-sub">{p.sku || 'No SKU'}</p>
                                    {createdLabel ? (
                                        <p className="mc-pc-created" title={String(createdRaw)}>
                                            Created {createdLabel}
                                        </p>
                                    ) : null}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                        <span className="mc-pc-tag">{p.categoryName || '—'}</span>
                                        {(p.vatMode != null && String(p.vatMode).trim() !== '') ||
                                        (p.vat_mode != null && String(p.vat_mode).trim() !== '') ? (
                                            <span className="mc-pc-tag" title="VAT mode">
                                                {String(p.vatMode ?? p.vat_mode)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mc-sc-price">Sale: SAR {p.sellingPrice ?? 0}</div>
                                </div>
                                <div className="mc-sc-footer">
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'max-content max-content',
                                            columnGap: 8,
                                            width: '100%',
                                            justifyContent: 'start',
                                        }}
                                    >
                                        <div className="mc-sc-toggle-group" style={{ justifyContent: 'flex-start', gap: 8, width: '100%', minWidth: 0 }}>
                                            <div className="mc-toggle-label">
                                                <strong>Status</strong>
                                                <span className={isActive ? 'mc-toggle-state--on' : ''}>
                                                    {activeBusy ? 'Updating...' : isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div
                                                className={`mc-toggle-switch${isActive ? ' active' : ''}`}
                                                role="button"
                                                aria-label={`Toggle ${p.name} active status`}
                                                aria-pressed={isActive}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (activeBusy) return;
                                                    handleToggleServiceField(p, 'isActive', !isActive);
                                                }}
                                                style={{ opacity: activeBusy ? 0.65 : 1, pointerEvents: activeBusy ? 'none' : 'auto' }}
                                            />
                                        </div>
                                        <div className="mc-sc-toggle-group" style={{ justifyContent: 'flex-start', gap: 8, width: '100%', minWidth: 0 }}>
                                            <div className="mc-toggle-label">
                                                <strong>Price Editable</strong>
                                                <span className={priceEditable ? 'mc-toggle-state--on' : ''}>
                                                    {priceBusy ? 'Updating...' : priceEditable ? 'Editable' : 'Fixed price'}
                                                </span>
                                            </div>
                                            <div
                                                className={`mc-toggle-switch${priceEditable ? ' active' : ''}`}
                                                role="button"
                                                aria-label={`Toggle ${p.name} price editable`}
                                                aria-pressed={priceEditable}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (priceBusy) return;
                                                    handleToggleServiceField(p, 'isPriceEditable', !priceEditable);
                                                }}
                                                style={{ opacity: priceBusy ? 0.65 : 1, pointerEvents: priceBusy ? 'none' : 'auto' }}
                                            />
                                        </div>
                                    </div>
                                    {hasPermission('inventory.master-catalog.services.edit') && (
                                        <Edit3
                                            size={14}
                                            className="mc-sc-edit-icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditService(p);
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div className="master-catalog-container">
            {/* Header Area */}
            <div className="mc-header">
                <div className="mc-header-info">
                    <h1 className="mc-title">Master Product Catalog</h1>
                    <p className="mc-subtitle">Super Admin — Single source of truth for all products & services across all tenants</p>
                </div>
                <div className="mc-header-actions">
                    <button type="button" className="mc-btn-ghost"><RefreshCw size={16} /> Sync Depts</button>
                    {hasPermission('inventory.master-catalog.products.create') && (
                        <button type="button" className="mc-btn-ghost" onClick={() => setIsBulkProductModalOpen(true)}>
                            <Upload size={16} /> Bulk upload Product
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.services.create') && (
                        <button type="button" className="mc-btn-ghost" onClick={() => setIsBulkServiceModalOpen(true)}>
                            <Upload size={16} /> Bulk upload Service
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.products.create') && (
                        <button type="button" className="mc-btn-primary" onClick={() => setIsAddModalOpen(true)}>
                            <Plus size={16} /> Add product
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.services.create') && (
                        <button type="button" className="mc-btn-primary purple-btn" onClick={() => setIsAddServiceModalOpen(true)}>
                            <Plus size={16} /> Add service
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards (live KPIs) */}
            <div className="mc-summary-grid">
                {kpisError && (
                    <div className="mc-kpi-error">
                        <AlertCircle size={14} /> {kpisError}
                        <button type="button" className="mc-kpi-retry" onClick={loadKpis}>
                            <RefreshCw size={12} /> Retry
                        </button>
                    </div>
                )}
                {buildKpiCards(kpis).map((card) => (
                    <div
                        key={card.key}
                        className="mc-summary-card"
                        style={{ backgroundColor: card.color, color: card.textColor }}
                    >
                        <div className="mc-card-top">
                            <span className="mc-card-label">{card.label}</span>
                            <card.icon size={18} opacity={0.6} />
                        </div>
                        <div className="mc-card-value">
                            {kpisLoading && !kpis ? '—' : card.value}
                        </div>
                        <div className="mc-card-sub" style={{ color: card.subColor }}>
                            {kpisLoading && !kpis ? 'Loading…' : card.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* Inner Navigation Tabs */}
            <div className="mc-tabs-container">
                {visibleMasterTabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`mc-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
                {visibleMasterTabs.length === 0 && (
                    <div style={{ padding: 20, color: '#94a3b8', fontSize: '0.875rem' }}>
                        You don't have permission to view any Master Catalog tabs.
                    </div>
                )}
            </div>

            {/* Banner Notification */}
            <div className="mc-governance-banner">
                <div className="mc-banner-icon"><CheckCircle2 size={18} /></div>
                <div className="mc-banner-content">
                    <strong>Master Catalog — Super Admin Governed</strong>
                    <p>This is the single source of truth. Workshops and Suppliers cannot create products directly — they select from here or submit a request.</p>
                </div>
            </div>

            {/* Render Active Tab Content — re-check permission as a defense-in-depth gate */}
            {activeTab === 'master'       && hasPermission('inventory.master-catalog.products.view')     && renderMasterCatalog()}
            {activeTab === 'dept'         && hasPermission('inventory.master-catalog.departments.view')  && renderMasterDepartment()}
            {activeTab === 'category'     && hasPermission('inventory.master-catalog.categories.view')   && renderMasterCategory()}
            {activeTab === 'requests'     && hasPermission('inventory.master-catalog.requests.view')     && renderProductRequests()}
            {activeTab === 'duplication'  && hasPermission('inventory.master-catalog.duplication.view')  && renderDuplicationReview()}
            {activeTab === 'availability' && hasPermission('inventory.master-catalog.availability.view') && renderSupplierAvailability()}
            {activeTab === 'services'     && hasPermission('inventory.master-catalog.services.view')     && renderServices()}

            {/* Add Department Modal */}
            <AnimatePresence>
                {isAddDeptModalOpen && (
                    <Modal
                        title={<div className="mc-modal-title"><LayoutGrid size={18} color="#D4A017" /> Add Master Department</div>}
                        onClose={() => setIsAddDeptModalOpen(false)}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>Department Name *</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Engine Services" 
                                    value={newDept.name}
                                    onChange={(e) => setNewDept({ name: e.target.value })}
                                />
                            </div>
                            <div className="mc-modal-footer">
                                <button className="mc-btn-primary mc-btn-large" onClick={handleCreateDepartment} disabled={saving || !isDepartmentFormValid}>
                                    {saving ? 'Saving...' : 'Add Department'}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={() => setIsAddDeptModalOpen(false)}>Cancel</button>
                            </div>
                            {!isDepartmentFormValid && (
                                <p style={{ marginTop: 8, color: '#B91C1C', fontSize: 12 }}>Department name is required.</p>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Edit Department Modal */}
            <AnimatePresence>
                {isEditDeptModalOpen && editingDept && (
                    <Modal
                        title={<div className="mc-modal-title"><LayoutGrid size={18} color="#D4A017" /> Edit Master Department</div>}
                        onClose={() => setIsEditDeptModalOpen(false)}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>Department Name *</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Engine Services" 
                                    value={editingDept.name}
                                    onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                                />
                            </div>
                            <div className="mc-modal-footer">
                                <button className="mc-btn-primary mc-btn-large" onClick={handleUpdateDepartment} disabled={saving || !editingDept.name?.trim()}>
                                    {saving ? 'Saving...' : 'Update Department'}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={() => setIsEditDeptModalOpen(false)}>Cancel</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Add Category Modal */}
            <AnimatePresence>
                {isAddCatModalOpen && (
                    <Modal
                        title={<div className="mc-modal-title"><Tags size={18} color="#D4A017" /> Add Master Category</div>}
                        onClose={() => setIsAddCatModalOpen(false)}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>Select Department *</label>
                                <div className="mc-select-wrapper">
                                    <select
                                        value={newCat.departmentId}
                                        onChange={(e) => setNewCat({ ...newCat, departmentId: e.target.value })}
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map((dept) => (
                                            <option key={dept.id} value={String(dept.id)}>{dept.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                            <div className="mc-form-group">
                                <label>Category Type *</label>
                                <div className="mc-select-wrapper">
                                    <select value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}>
                                        <option value="product">Product</option>
                                        <option value="service">Service</option>
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                            <div className="mc-form-group">
                                <label>Category Name *</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Synthetic Oil" 
                                    value={newCat.name}
                                    onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                                />
                            </div>
                            <div className="mc-modal-footer">
                                <button className="mc-btn-primary mc-btn-large" onClick={handleCreateCategory} disabled={saving || !isCategoryFormValid}>
                                    {saving ? 'Saving...' : 'Add Category'}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={() => setIsAddCatModalOpen(false)}>Cancel</button>
                            </div>
                            {!isCategoryFormValid && (
                                <p style={{ marginTop: 8, color: '#B91C1C', fontSize: 12 }}>
                                    Department and category name are required.
                                </p>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Edit Category Modal */}
            <AnimatePresence>
                {isEditCatModalOpen && editingCat && (
                    <Modal
                        title={<div className="mc-modal-title"><Tags size={18} color="#D4A017" /> Edit Master Category</div>}
                        onClose={() => setIsEditCatModalOpen(false)}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>Select Department *</label>
                                <div className="mc-dept-selector">
                                    {departments.map(dept => (
                                        <button 
                                            key={dept.id} 
                                            className={`mc-dept-mini-card ${String(editingCat.departmentId) === String(dept.id) ? 'active' : ''}`}
                                            onClick={() => setEditingCat({ ...editingCat, departmentId: String(dept.id) })}
                                        >
                                            {dept.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mc-form-group">
                                <label>Category Name *</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Synthetic Oil" 
                                    value={editingCat.name}
                                    onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                                />
                            </div>
                            <div className="mc-form-group">
                                <label>Category Type *</label>
                                <div className="mc-select-wrapper">
                                    <select
                                        value={editingCat.type || 'product'}
                                        onChange={(e) => setEditingCat({ ...editingCat, type: e.target.value })}
                                    >
                                        <option value="product">Product</option>
                                        <option value="service">Service</option>
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                            <div className="mc-modal-footer">
                                <button
                                    className="mc-btn-primary mc-btn-large"
                                    onClick={handleUpdateCategory}
                                    disabled={saving || !editingCat.name?.trim() || !editingCat.departmentId}
                                >
                                    {saving ? 'Saving...' : 'Update Category'}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={() => setIsEditCatModalOpen(false)}>Cancel</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Add Service Modal */}
            <AnimatePresence>
                {isAddServiceModalOpen && (
                    <Modal
                        title={<div className="mc-modal-title"><Settings size={18} color="#9333EA" /> Add Service to Master Catalog</div>}
                        onClose={() => setIsAddServiceModalOpen(false)}
                        className="sa-mc-modal"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>Service Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Oil Change Full Synthetic"
                                    value={newService.name}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>Arabic name</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    placeholder="الاسم بالعربية"
                                    value={newService.arabicName}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, arabicName: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Department</label>
                                    <div className="mc-select-wrapper">
                                        <select
                                            value={newService.departmentId}
                                            onChange={(e) =>
                                                setNewService((prev) => ({ ...prev, departmentId: e.target.value, categoryId: '' }))
                                            }
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                                <div className="mc-form-group">
                                    <label>Category</label>
                                    <div className="mc-select-wrapper">
                                        <select
                                            value={newService.categoryId}
                                            onChange={(e) => setNewService((prev) => ({ ...prev, categoryId: e.target.value }))}
                                            disabled={!newService.departmentId}
                                        >
                                            <option value="">Select Category</option>
                                            {selectedServiceCategories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                    {newService.departmentId && selectedServiceCategories.length === 0 && (
                                        <p style={{ marginTop: 6, color: '#B91C1C', fontSize: 12 }}>
                                            No service categories for this department. Create one first.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>SKU</label>
                                    <input
                                        type="text"
                                        placeholder="SRV-001"
                                        className="mc-input-faded"
                                        value={newService.sku}
                                        onChange={(e) => setNewService((prev) => ({ ...prev, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Unit</label>
                                    <div className="mc-select-wrapper">
                                        <select
                                            value={newService.unitOfMeasurement}
                                            onChange={(e) => setNewService((prev) => ({ ...prev, unitOfMeasurement: e.target.value }))}
                                        >
                                            <option value="ea">Each (ea)</option>
                                            <option value="pcs">pcs</option>
                                            <option value="service">service</option>
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Default Sale Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={newService.sellingPrice}
                                        onChange={(e) =>
                                            setNewService((prev) => ({
                                                ...prev,
                                                sellingPrice: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Min Corporate Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={newService.minPriceCorporate}
                                        onChange={(e) =>
                                            setNewService((prev) => ({
                                                ...prev,
                                                minPriceCorporate: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Max Corporate Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={newService.maxPriceCorporate}
                                        onChange={(e) =>
                                            setNewService((prev) => ({
                                                ...prev,
                                                maxPriceCorporate: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    placeholder="Optional description"
                                    value={newService.description}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="mc-toggle-box yellow">
                                <div className="mc-toggle-info">
                                    <strong>Allow Cashier to Edit Price on POS</strong>
                                    <span>When ON, cashier can negotiate & set custom price at checkout</span>
                                </div>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={newService.isPriceEditable}
                                        onChange={(e) => setNewService((prev) => ({ ...prev, isPriceEditable: e.target.checked }))}
                                    />
                                </label>
                            </div>

                            <div className="mc-toggle-box blue-toggle">
                                <div className="mc-toggle-info">
                                    <strong>Active Status</strong>
                                    <span>Enable or disable this service across the catalog</span>
                                </div>
                                <div className="mc-toggle-switch small active"></div>
                            </div>

                            <div className="mc-modal-banner purple-banner">
                                <ShieldCheck size={14} /> Services added here are immediately approved and available to all tenants.
                            </div>

                            <div className="mc-modal-footer row">
                                <button
                                    className="mc-btn-primary mc-btn-large purple-btn"
                                    style={{ flex: 4 }}
                                    onClick={handleCreateCatalogService}
                                    disabled={saving || !isServiceFormValid}
                                >
                                    {saving ? 'Saving...' : 'Add to Master Catalog'}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" style={{ flex: 1 }} onClick={() => setIsAddServiceModalOpen(false)}>Cancel</button>
                            </div>
                            {!isServiceFormValid && (
                                <p style={{ marginTop: 8, color: '#B91C1C', fontSize: 12 }}>
                                    Service name, department, and category are required.
                                </p>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Edit Service Modal */}
            <AnimatePresence>
                {isEditServiceModalOpen && editingService && (
                    <Modal
                        title={<div className="mc-modal-title"><Settings size={18} color="#9333EA" /> Edit Service</div>}
                        onClose={() => {
                            setIsEditServiceModalOpen(false);
                            setEditingService(null);
                        }}
                        className="sa-mc-modal"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>Service Name *</label>
                                <input
                                    type="text"
                                    value={editingService.name}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>Arabic name</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    placeholder="الاسم بالعربية"
                                    value={editingService.arabicName ?? ''}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, arabicName: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>SKU</label>
                                    <input
                                        type="text"
                                        value={editingService.sku}
                                        onChange={(e) => setEditingService((prev) => ({ ...prev, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Selling Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="Leave empty for null"
                                        value={editingService.sellingPrice}
                                        onChange={(e) =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                sellingPrice: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Min Corporate Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={editingService.minPriceCorporate ?? ''}
                                        onChange={(e) =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                minPriceCorporate: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Max Corporate Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={editingService.maxPriceCorporate ?? ''}
                                        onChange={(e) =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                maxPriceCorporate: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={editingService.description}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>Category</label>
                                <input
                                    type="text"
                                    readOnly
                                    disabled
                                    value={
                                        editingService.categoryName?.trim()
                                            ? editingService.categoryName
                                            : editingService.categoryId
                                              ? `Category ID ${editingService.categoryId}`
                                              : '—'
                                    }
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>VAT mode</label>
                                    <input
                                        type="text"
                                        readOnly
                                        disabled
                                        value={String(editingService.vatMode ?? editingService.vat_mode ?? '') || '—'}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Created</label>
                                    <input
                                        type="text"
                                        readOnly
                                        disabled
                                        value={
                                            formatCatalogCreatedAt(
                                                editingService.createdAt ?? editingService.created_at,
                                            ) || '—'
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-toggle-box yellow">
                                    <div className="mc-toggle-info">
                                        <strong>Service Status</strong>
                                        <span>{editingService.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>
                                    <div
                                        className={`mc-toggle-switch small${editingService.isActive ? ' active' : ''}`}
                                        role="button"
                                        aria-label="Toggle service active status"
                                        aria-pressed={!!editingService.isActive}
                                        onClick={() =>
                                            setEditingService((prev) => ({ ...prev, isActive: !prev.isActive }))
                                        }
                                    />
                                </div>
                                <div className="mc-toggle-box yellow">
                                    <div className="mc-toggle-info">
                                        <strong>Price Editable</strong>
                                        <span>{editingService.isPriceEditable ? 'Editable by cashier' : 'Fixed price'}</span>
                                    </div>
                                    <div
                                        className={`mc-toggle-switch small${editingService.isPriceEditable ? ' active' : ''}`}
                                        role="button"
                                        aria-label="Toggle price editable"
                                        aria-pressed={!!editingService.isPriceEditable}
                                        onClick={() =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                isPriceEditable: !prev.isPriceEditable,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mc-modal-footer row">
                                <button className="mc-btn-ghost mc-btn-large" onClick={handleDeleteCatalogService} disabled={saving}>
                                    Delete
                                </button>
                                <button
                                    className="mc-btn-ghost mc-btn-large"
                                    onClick={() => {
                                        setIsEditServiceModalOpen(false);
                                        setEditingService(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button className="mc-btn-primary mc-btn-large purple-btn" onClick={handleUpdateCatalogService} disabled={saving}>
                                    {saving ? 'Saving...' : 'Update Service'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Edit Product Modal */}
            <AnimatePresence>
                {isEditModalOpen && editingProduct && (
                    <Modal
                        title={<div className="mc-modal-title"><ShieldCheck size={18} color="#D4A017" /> Edit Master Product</div>}
                        onClose={() => setIsEditModalOpen(false)}
                        className="sa-mc-modal"
                    >
                        <div className="mc-modal-banner">
                            Products added here are immediately approved and available to all workshops and suppliers.
                        </div>
                        
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>Product Name *</label>
                                <input 
                                    type="text" 
                                    value={editingProduct.name} 
                                    onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>Arabic name</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    placeholder="الاسم بالعربية"
                                    value={editingProduct.arabicName ?? ''}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, arabicName: e.target.value })}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>SKU</label>
                                    <input 
                                        type="text" 
                                        value={editingProduct.sku || editingProduct.name} 
                                        onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Brand</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Mobil"
                                        value={editingProduct.brand || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>Department</label>
                                <input
                                    type="text"
                                    readOnly
                                    disabled
                                    value={
                                        departments.find((d) => String(d.id) === String(editingProduct.departmentId))
                                            ?.name ||
                                        editingProduct.departmentName ||
                                        '—'
                                    }
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>Category *</label>
                                <div className="mc-select-wrapper">
                                    <select
                                        value={editingProduct.categoryId ?? ''}
                                        onChange={(e) =>
                                            setEditingProduct({ ...editingProduct, categoryId: e.target.value })
                                        }
                                        disabled={editModalProductCategories.length === 0}
                                    >
                                        <option value="">Select Category</option>
                                        {editModalProductCategories.map((cat) => (
                                            <option key={cat.id} value={String(cat.id)}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                                {editingProduct.departmentId && editModalProductCategories.length === 0 && (
                                    <p style={{ marginTop: 6, color: '#B91C1C', fontSize: 12 }}>
                                        No product categories for this department. Create one first.
                                    </p>
                                )}
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Unit</label>
                                    <div className="mc-select-wrapper">
                                        <select 
                                            value={editingProduct.unit} 
                                            onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                                        >
                                            <option value="piece">piece</option>
                                            <option value="Each (ea)">Each (ea)</option>
                                            <option value="liter">Liter</option>
                                            <option value="kg">Kg</option>
                                            <option value="box">Box</option>
                                            <option value="carton">Carton</option>
                                            <option value="drum">Drum</option>
                                            <option value="service">Service</option>
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                                <div className="mc-form-group">
                                    <label>Type</label>
                                    <div className="mc-select-wrapper">
                                        <select 
                                            value={editingProduct.type} 
                                            onChange={(e) => setEditingProduct({...editingProduct, type: e.target.value})}
                                        >
                                            <option value="Product">Product</option>
                                            <option value="Service">Service</option>
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Default Sale Price (SAR)</label>
                                    <input 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        value={editingProduct.salePrice} 
                                        onChange={(e) => setEditingProduct({...editingProduct, salePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Default Purchase Price (SAR)</label>
                                    <input 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        value={editingProduct.purchasePrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, purchasePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Min Corporate Price (SAR)</label>
                                    <input 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={editingProduct.minCorpPrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, minCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Max Corporate Price (SAR)</label>
                                    <input 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={editingProduct.maxCorpPrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, maxCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>KM type value (optional)</label>
                                <input
                                    type="number"
                                    placeholder="Leave empty if not used"
                                    value={editingProduct.kmTypeValue ?? ''}
                                    onChange={(e) =>
                                        setEditingProduct({ ...editingProduct, kmTypeValue: e.target.value })
                                    }
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>Description</label>
                                <input 
                                    type="text" 
                                    placeholder="Optional description" 
                                    value={editingProduct.description || ''} 
                                    onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                                />
                            </div>

                            <div
                                className="mc-toggle-box yellow"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    setEditingProduct((prev) => ({
                                        ...prev,
                                        isPriceEditable: !prev.isPriceEditable,
                                        minPriceEditable: !prev.isPriceEditable ? prev.minPriceEditable : '',
                                    }))
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setEditingProduct((prev) => ({
                                            ...prev,
                                            isPriceEditable: !prev.isPriceEditable,
                                            minPriceEditable: !prev.isPriceEditable ? prev.minPriceEditable : '',
                                        }));
                                    }
                                }}
                            >
                                <div className="mc-toggle-info">
                                    <strong>Price Editable on POS</strong>
                                    <span>{editingProduct.isPriceEditable ? 'Cashier can set custom price' : 'Fixed catalog price'}</span>
                                </div>
                                <div
                                    className={`mc-toggle-switch small${editingProduct.isPriceEditable ? ' active' : ''}`}
                                    aria-hidden
                                />
                            </div>

                            {editingProduct.isPriceEditable && (
                                <div className="mc-form-group">
                                    <label>Minimum editable price (SAR, VAT inclusive) *</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={editingProduct.minPriceEditable ?? ''}
                                        onChange={(e) =>
                                            setEditingProduct({
                                                ...editingProduct,
                                                minPriceEditable: sanitizeNonNegativeMoneyInput(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                            )}

                            <div
                                className="mc-toggle-box blue-toggle"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    setEditingProduct((prev) => ({
                                        ...prev,
                                        allowDecimalQty: !prev.allowDecimalQty,
                                    }))
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setEditingProduct((prev) => ({
                                            ...prev,
                                            allowDecimalQty: !prev.allowDecimalQty,
                                        }));
                                    }
                                }}
                            >
                                <div className="mc-toggle-info">
                                    <strong>Allowed Decimal Quantity</strong>
                                    <span>Enable fractional quantities (e.g. 1.5 liters)</span>
                                </div>
                                <div
                                    className={`mc-toggle-switch small${editingProduct.allowDecimalQty ? ' active' : ''}`}
                                    aria-hidden
                                />
                            </div>

                            <div className="mc-modal-footer">
                                <button className="mc-btn-ghost mc-btn-large" onClick={handleDeleteCatalogProduct} disabled={saving}>
                                    Delete
                                </button>
                                <button className="mc-btn-primary mc-btn-large" onClick={handleUpdateCatalogProduct} disabled={saving}>
                                    {saving ? 'Saving...' : 'Update Product'}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Add Product Modal */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <Modal
                        title={<div className="mc-modal-title"><CheckCircle2 size={18} color="#D4A017" /> Add to Master Catalog</div>}
                        onClose={() => setIsAddModalOpen(false)}
                        className="sa-mc-modal"
                    >
                        <div className="mc-modal-banner">
                            Products added here are immediately approved and available to all workshops and suppliers.
                        </div>
                        
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>Product Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Mobil 1 5W-30 Engine Oil"
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>Arabic name</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    placeholder="الاسم بالعربية"
                                    value={newProduct.arabicName}
                                    onChange={(e) => setNewProduct({ ...newProduct, arabicName: e.target.value })}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>SKU</label>
                                    <input 
                                        type="text" 
                                        placeholder="MOB-5W30" 
                                        value={newProduct.sku}
                                        onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Brand</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Mobil" 
                                        value={newProduct.brand}
                                        onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>Department</label>
                                <div className="mc-select-wrapper">
                                    <select
                                        value={newProduct.departmentId}
                                        onChange={(e) => setNewProduct({ ...newProduct, departmentId: e.target.value, categoryId: '' })}
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map((dept) => (
                                            <option key={dept.id} value={String(dept.id)}>{dept.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>Category</label>
                                <div className="mc-select-wrapper">
                                    <select 
                                        value={newProduct.categoryId}
                                        onChange={(e) => setNewProduct({...newProduct, categoryId: e.target.value})}
                                        disabled={!newProduct.departmentId}
                                    >
                                        <option value="">Select Category</option>
                                        {selectedProductCategories.map(cat => (
                                            <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                                {newProduct.departmentId && selectedProductCategories.length === 0 && (
                                    <p style={{ marginTop: 6, color: '#B91C1C', fontSize: 12 }}>
                                        No product categories for this department. Create one first.
                                    </p>
                                )}
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Unit</label>
                                    <div className="mc-select-wrapper">
                                        <select
                                            value={newProduct.unit}
                                            onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                                        >
                                            <option value="piece">piece</option>
                                            <option value="liter">Liter</option>
                                            <option value="kg">Kg</option>
                                            <option value="box">Box</option>
                                            <option value="carton">Carton</option>
                                            <option value="drum">Drum</option>
                                            <option value="service">Service</option>
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                                <div className="mc-form-group">
                                    <label>Type</label>
                                    <div className="mc-select-wrapper">
                                        <select>
                                            <option value="Product">Product</option>
                                            <option value="Service">Service</option>
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Default Sale Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={newProduct.salePrice}
                                        onChange={(e) => setNewProduct({...newProduct, salePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Default Purchase Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={newProduct.purchasePrice}
                                        onChange={(e) => setNewProduct({...newProduct, purchasePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>Min Corporate Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={newProduct.minCorpPrice || ''}
                                        onChange={(e) => setNewProduct({...newProduct, minCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Max Corporate Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={newProduct.maxCorpPrice || ''}
                                        onChange={(e) => setNewProduct({...newProduct, maxCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>KM type value (optional)</label>
                                <input
                                    type="number"
                                    placeholder="Leave empty if not used"
                                    value={newProduct.kmTypeValue ?? ''}
                                    onChange={(e) => setNewProduct({ ...newProduct, kmTypeValue: e.target.value })}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    placeholder="Optional description"
                                    value={newProduct.description}
                                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                                />
                            </div>

                            <div className="mc-toggle-box yellow">
                                <div className="mc-toggle-info">
                                    <strong>Allow Cashier to Edit Price on POS</strong>
                                    <span>When ON, cashier can negotiate & set custom price at checkout</span>
                                </div>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={!!newProduct.isPriceEditable}
                                        onChange={(e) =>
                                            setNewProduct((prev) => ({
                                                ...prev,
                                                isPriceEditable: e.target.checked,
                                                minPriceEditable: e.target.checked ? prev.minPriceEditable : '',
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            {newProduct.isPriceEditable && (
                                <div className="mc-form-group">
                                    <label>Minimum editable price (SAR, VAT inclusive) *</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0.00"
                                        value={newProduct.minPriceEditable ?? ''}
                                        onChange={(e) =>
                                            setNewProduct({
                                                ...newProduct,
                                                minPriceEditable: sanitizeNonNegativeMoneyInput(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                            )}

                            <div className="mc-toggle-box blue-toggle">
                                <div className="mc-toggle-info">
                                    <strong>Allowed Decimal Quantity</strong>
                                    <span>Enable fractional quantities (e.g. 1.5 liters)</span>
                                </div>
                                <div className="mc-toggle-switch small"></div>
                            </div>

                            <div className="mc-modal-footer">
                                <button className="mc-btn-primary mc-btn-large" onClick={handleCreateProduct} disabled={saving || !isProductFormValid}>
                                    {saving ? 'Saving...' : 'Add to Master Catalog'}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                            </div>
                            {!isProductFormValid && (
                                <p style={{ marginTop: 8, color: '#B91C1C', fontSize: 12 }}>
                                    Product name, department, and category are required.
                                </p>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Bulk Upload Products */}
            <AnimatePresence>
                {isBulkProductModalOpen && (
                    <Modal
                        title={<div className="mc-modal-title"><Upload size={18} color="#2563EB" /> Bulk Upload Products</div>}
                        onClose={closeBulkProductModal}
                        className="sa-mc-modal"
                    >
                        <div className="mc-bulk-format-card redesigned">
                            <div className="mc-bulk-header">
                                <Box size={18} />
                                <strong>Upload Format</strong>
                            </div>
                            <p>Upload a CSV file with columns: <strong>{PRODUCT_CSV_COLUMNS.join(', ')}</strong></p>
                            <div className="mc-bulk-bullets">
                                <span>• Use the same column names and order as the downloaded template</span>
                                <span>• Column names are case-sensitive and must match exactly</span>
                                <span>• Keep the header row unchanged when preparing your upload file</span>
                                <span>• Import runs row-by-row; successful rows are kept if others fail or skip (no whole-file rollback)</span>
                            </div>
                        </div>

                        <a className="mc-template-btn dashed" href={productsCsvTemplate} download="Products.csv">
                            <Download size={18} /> Download CSV Template (with sample data)
                        </a>

                        <label className="mc-upload-dropzone blue-dashed" htmlFor="bulk-csv-upload-input">
                            <Layers size={24} color="#3B82F6" />
                            <span>{selectedBulkFile ? selectedBulkFile.name : 'Choose CSV File'}</span>
                            <input
                                ref={bulkFileInputRef}
                                id="bulk-csv-upload-input"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleBulkFileChange}
                                style={{ display: 'none' }}
                            />
                        </label>

                        {bulkImportResult && (() => {
                            const payload = getCsvImportPayload(bulkImportResult);
                            const summary = formatCsvImportSummary(bulkImportResult);
                            const vat = payload?.vatWarnings;
                            const rows = payload?.rowDetails;
                            const hasVat = Array.isArray(vat) && vat.length > 0;
                            const hasRows = Array.isArray(rows) && rows.length > 0;
                            const knownShape = isProductCsvImportShape(payload);
                            return (
                                <div className="mc-bulk-import-result">
                                    {summary ? <p className="mc-bulk-import-summary">{summary}</p> : null}
                                    {hasVat && (
                                        <details className="mc-bulk-import-details">
                                            <summary>VAT warnings (up to 100)</summary>
                                            <ul>
                                                {vat.slice(0, 100).map((w, i) => (
                                                    <li key={i}>{formatVatWarningItem(w)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {hasRows && (
                                        <details className="mc-bulk-import-details">
                                            <summary>Skipped / failed rows (up to 500)</summary>
                                            <ul>
                                                {rows.slice(0, 500).map((row, i) => (
                                                    <li key={i}>{formatRowDetailItem(row)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {!knownShape && !hasVat && !hasRows && (
                                        <pre className="mc-bulk-import-raw">{JSON.stringify(bulkImportResult, null, 2)}</pre>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="mc-modal-footer row">
                            <button type="button" className="mc-btn-ghost mc-btn-large" onClick={closeBulkProductModal} disabled={bulkImporting}>
                                Cancel
                            </button>
                            <button
                                className={`mc-btn-primary mc-btn-large ${!selectedBulkFile || bulkImporting ? 'disabled-blue' : ''}`}
                                type="button"
                                disabled={!selectedBulkFile || bulkImporting}
                                onClick={handleBulkImport}
                            >
                                {bulkImporting ? 'Importing…' : selectedBulkFile ? 'Import CSV' : 'Upload 0 Products'}
                            </button>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Bulk Upload Services */}
            <AnimatePresence>
                {isBulkServiceModalOpen && (
                    <Modal
                        title={<div className="mc-modal-title"><Upload size={18} color="#9333EA" /> Bulk Upload Services</div>}
                        onClose={closeBulkServiceModal}
                        className="sa-mc-modal"
                    >
                        <div className="mc-bulk-format-card redesigned">
                            <div className="mc-bulk-header">
                                <Box size={18} />
                                <strong>Upload Format</strong>
                            </div>
                            <p>Upload a CSV file with columns: <strong>{SERVICE_CSV_COLUMNS.join(', ')}</strong></p>
                            <div className="mc-bulk-bullets">
                                <span>• Use the same column names and order as the downloaded template</span>
                                <span>• Column names are case-sensitive and must match exactly</span>
                                <span>• Keep the header row unchanged when preparing your upload file</span>
                                <span>• Import runs row-by-row; successful rows are kept if others fail or skip (no whole-file rollback)</span>
                            </div>
                        </div>

                        <a className="mc-template-btn dashed" href={servicesCsvTemplate} download="Services.csv">
                            <Download size={18} /> Download CSV Template (with sample data)
                        </a>

                        <label className="mc-upload-dropzone blue-dashed" htmlFor="bulk-service-csv-upload-input">
                            <Layers size={24} color="#9333EA" />
                            <span>{selectedBulkServiceFile ? selectedBulkServiceFile.name : 'Choose CSV File'}</span>
                            <input
                                ref={bulkServiceFileInputRef}
                                id="bulk-service-csv-upload-input"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleBulkServiceFileChange}
                                style={{ display: 'none' }}
                            />
                        </label>

                        {bulkServiceImportResult && (() => {
                            const payload = getCsvImportPayload(bulkServiceImportResult);
                            const summary = formatCsvImportSummary(bulkServiceImportResult);
                            const vat = payload?.vatWarnings;
                            const rows = payload?.rowDetails;
                            const hasVat = Array.isArray(vat) && vat.length > 0;
                            const hasRows = Array.isArray(rows) && rows.length > 0;
                            const knownShape = isProductCsvImportShape(payload);
                            return (
                                <div className="mc-bulk-import-result">
                                    {summary ? <p className="mc-bulk-import-summary">{summary}</p> : null}
                                    {hasVat && (
                                        <details className="mc-bulk-import-details">
                                            <summary>VAT warnings (up to 100)</summary>
                                            <ul>
                                                {vat.slice(0, 100).map((w, i) => (
                                                    <li key={i}>{formatVatWarningItem(w)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {hasRows && (
                                        <details className="mc-bulk-import-details">
                                            <summary>Skipped / failed rows (up to 500)</summary>
                                            <ul>
                                                {rows.slice(0, 500).map((row, i) => (
                                                    <li key={i}>{formatRowDetailItem(row)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {!knownShape && !hasVat && !hasRows && (
                                        <pre className="mc-bulk-import-raw">{JSON.stringify(bulkServiceImportResult, null, 2)}</pre>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="mc-modal-footer row">
                            <button type="button" className="mc-btn-ghost mc-btn-large" onClick={closeBulkServiceModal} disabled={bulkServiceImporting}>
                                Cancel
                            </button>
                            <button
                                className={`mc-btn-primary mc-btn-large purple-btn ${!selectedBulkServiceFile || bulkServiceImporting ? 'disabled-blue' : ''}`}
                                type="button"
                                disabled={!selectedBulkServiceFile || bulkServiceImporting}
                                onClick={handleBulkServiceImport}
                            >
                                {bulkServiceImporting ? 'Importing…' : selectedBulkServiceFile ? 'Import CSV' : 'Upload 0 Services'}
                            </button>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Product Request — Approve Modal */}
            <AnimatePresence>
                {prApproveTarget && (
                    <Modal
                        title={<div className="mc-modal-title"><CheckCircle2 size={18} color="#15803D" /> Approve Request</div>}
                        onClose={() => !prActionBusy && setPrApproveTarget(null)}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <p className="mc-pr-modal-lead">
                                Review and approve <strong>{prApproveTarget.name}</strong>.
                            </p>
                            <div className="mc-form-grid two">
                                <div className="mc-form-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        value={prApproveForm.name}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, name: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder="Product name"
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>SKU</label>
                                    <input
                                        type="text"
                                        value={prApproveForm.sku}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, sku: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder="SKU"
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Brand</label>
                                    <input
                                        type="text"
                                        value={prApproveForm.brandName}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, brandName: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder="Brand"
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Unit</label>
                                    <input
                                        type="text"
                                        value={prApproveForm.unit}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, unit: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder="pcs"
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Expected price</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        value={prApproveForm.expectedPrice}
                                        onChange={(e) =>
                                            setPrApproveForm((prev) => ({
                                                ...prev,
                                                expectedPrice: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                        disabled={prActionBusy}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>Department *</label>
                                    <select
                                        value={prApproveForm.departmentId}
                                        onChange={(e) =>
                                            setPrApproveForm((prev) => ({
                                                ...prev,
                                                departmentId: e.target.value,
                                                categoryId: '',
                                            }))
                                        }
                                        disabled={prActionBusy}
                                    >
                                        <option value="">Select department</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={String(d.id)}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mc-form-group">
                                    <label>Category</label>
                                    <select
                                        value={prApproveForm.categoryId}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                                        disabled={prActionBusy || !prApproveForm.departmentId}
                                    >
                                        <option value="">No category</option>
                                        {approveProductCategories.map((c) => (
                                            <option key={c.id} value={String(c.id)}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="mc-form-group">
                                <label>Description</label>
                                <textarea
                                    rows={3}
                                    placeholder="Description"
                                    value={prApproveForm.description}
                                    onChange={(e) => setPrApproveForm((prev) => ({ ...prev, description: e.target.value }))}
                                    disabled={prActionBusy}
                                />
                            </div>
                            <div className="mc-form-group">
                                <label>Arabic name</label>
                                <input
                                    type="text"
                                    value={prApproveForm.arabicName}
                                    onChange={(e) => setPrApproveForm((prev) => ({ ...prev, arabicName: e.target.value }))}
                                    disabled={prActionBusy}
                                    placeholder="Arabic name"
                                />
                            </div>
                            <div className="mc-form-group">
                                <label>Remarks (optional)</label>
                                <textarea
                                    rows={3}
                                    placeholder="Internal note for audit trail"
                                    value={prRemarks}
                                    onChange={(e) => setPrRemarks(e.target.value)}
                                    disabled={prActionBusy}
                                />
                            </div>
                            <div className="mc-modal-footer">
                                <button
                                    type="button"
                                    className="mc-btn-primary mc-btn-large"
                                    onClick={handlePrApproveConfirm}
                                    disabled={prActionBusy}
                                >
                                    {prActionBusy ? 'Approving…' : 'Confirm Approve'}
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-ghost mc-btn-large"
                                    onClick={() => setPrApproveTarget(null)}
                                    disabled={prActionBusy}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Product Request — Reject Modal */}
            <AnimatePresence>
                {prRejectTarget && (
                    <Modal
                        title={<div className="mc-modal-title"><XCircle size={18} color="#B91C1C" /> Reject Request</div>}
                        onClose={() => !prActionBusy && setPrRejectTarget(null)}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <p className="mc-pr-modal-lead">
                                Reject <strong>{prRejectTarget.name}</strong>?
                            </p>
                            <div className="mc-form-group">
                                <label>Reason *</label>
                                <textarea
                                    rows={3}
                                    placeholder="Why is this being rejected?"
                                    value={prRejectReason}
                                    onChange={(e) => setPrRejectReason(e.target.value)}
                                    disabled={prActionBusy}
                                />
                                {!prRejectReason.trim() && (
                                    <p className="mc-pr-modal-hint">Reason is required.</p>
                                )}
                            </div>
                            <div className="mc-modal-footer">
                                <button
                                    type="button"
                                    className="mc-btn-primary mc-btn-large"
                                    style={{ background: '#B91C1C' }}
                                    onClick={handlePrRejectConfirm}
                                    disabled={prActionBusy || !prRejectReason.trim()}
                                >
                                    {prActionBusy ? 'Rejecting…' : 'Confirm Reject'}
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-ghost mc-btn-large"
                                    onClick={() => setPrRejectTarget(null)}
                                    disabled={prActionBusy}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {toast && (
                <div className={`mc-toast mc-toast-${toast.kind}`} role="status" aria-live="polite">
                    {toast.message}
                </div>
            )}
        </div>
    );
}
