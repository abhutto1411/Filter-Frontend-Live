import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const DEPT_PAGE_TABS = [
    { id: 'departments', label: 'Departments', permission: 'workshop.departments.departments.view' },
    { id: 'products',    label: 'Products',    permission: 'workshop.departments.products.view' },
    { id: 'services',    label: 'Services',    permission: 'workshop.departments.services.view' },
    { id: 'categories',  label: 'Categories',  permission: 'workshop.departments.categories.view' },
];
import {
    getMyDepartments,
    getMyCategories,
    getMyProducts,
    getMyServices,
    getBranchDepartments,
    getBranchCategories,
    getBranchProducts,
    getBranchServices,
    removeBranchDepartment,
    patchWorkshopDepartmentActive,
    removeBranchCategory,
    removeBranchProduct,
    removeBranchService,
    removeWorkshopProduct,
    removeWorkshopProductsBulk,
    removeWorkshopService,
    removeWorkshopServicesBulk,
    getCatalogDepartments,
    getCatalogCategories,
    getCatalogUnitsOfMeasure,
    submitCatalogProductRequest,
} from '../../services/workshopCatalogApi';
import {
    unwrapWorkshopBranchListResponse,
    unwrapWorkshopBranchesResponse,
    filterPortalVisibleBranches,
} from '../../services/workshopStaffApi';
import {
    MOCK_CATEGORIES,
    UNIT_OPTIONS,
} from './constants';

function pickNumber(...vals) {
    for (const v of vals) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

/** First numeric value, or `null` if unset (fall back to adoption opening). */
function firstFiniteNumber(values) {
    for (const v of values) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

function pickItemName(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const candidates = [
        obj.name,
        obj.title,
        obj.label,
        obj.productName,
        obj.product_name,
        obj.serviceName,
        obj.service_name,
        obj.itemName,
        obj.item_name,
    ];
    for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    const sku = obj.sku ?? obj.SKU;
    if (sku != null && String(sku).trim() !== '') return String(sku).trim();
    return '';
}

function pickDeptLabel(obj) {
    if (!obj || typeof obj !== 'object') return '—';
    const candidates = [
        obj.departmentName,
        obj.department_name,
        obj.department?.name,
        typeof obj.department === 'string' ? obj.department : '',
    ];
    for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    return '—';
}

/** Unwrap catalog list responses (same keys as WorkshopCatalogNew). */
function pickCatalogArray(res, keys) {
    const extended = [...keys, 'rows', 'results', 'list', 'records'];
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    for (const k of extended) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

function normalizeUomOption(row) {
    if (row == null) return null;
    if (typeof row === 'string') {
        const s = row.trim();
        return s ? { value: s, label: s } : null;
    }
    if (typeof row !== 'object') return null;
    const value = String(
        row.abbreviation ?? row.code ?? row.symbol ?? row.unitCode ?? row.name ?? row.id ?? '',
    ).trim();
    if (!value) return null;
    const name = row.name ? String(row.name).trim() : '';
    const label = name && name.toLowerCase() !== value.toLowerCase() ? `${name} (${value})` : name || value;
    return { value, label };
}

/** After workshop-wide bulk remove — partial failures still return success: true + failed[]. */
function summarizeBulkRemoveResult(result) {
    if (!result || typeof result !== 'object') return;
    const failed = Array.isArray(result.failed) ? result.failed : [];
    if (failed.length === 0) return;
    const removed = Array.isArray(result.removedIds) ? result.removedIds.length : 0;
    const lines = failed.slice(0, 10).map((f) => `• ${String(f?.id ?? '—')}: ${f?.reason ?? 'Failed'}`);
    window.alert(`Removed ${removed} item(s). ${failed.length} could not be removed:\n${lines.join('\n')}${failed.length > 10 ? `\n… and ${failed.length - 10} more` : ''}`);
}

export default function WorkshopDepartments({ selectedBranchId = 'all', branches: branchesProp = [] }) {
    const { workshop, hasPermission } = useAuth();

    // Per-tab visibility (sub-tab gating) — filter tab strip + content rendering
    const visibleDeptPageTabs = DEPT_PAGE_TABS.filter((t) => hasPermission(t.permission));

    // Per-tab action permissions — used to gate Add/Edit/Delete buttons inside each tab.
    const canCreateDept     = hasPermission('workshop.departments.departments.create');
    const canEditDept       = hasPermission('workshop.departments.departments.edit');
    const canDeleteDept     = hasPermission('workshop.departments.departments.delete');
    const canCreateProduct  = hasPermission('workshop.departments.products.create');
    const canDeleteProduct  = hasPermission('workshop.departments.products.delete');
    const canCreateService  = hasPermission('workshop.departments.services.create');
    const canDeleteService  = hasPermission('workshop.departments.services.delete');
    const canCreateCategory = hasPermission('workshop.departments.categories.create');
    const canDeleteCategory = hasPermission('workshop.departments.categories.delete');
    const isAllBranches = !selectedBranchId || selectedBranchId === 'all';
    const branchScope = isAllBranches ? null : String(selectedBranchId);
    const selectedBranchName = (Array.isArray(branchesProp) ? branchesProp : []).find(
        (b) => String(b.id) === String(selectedBranchId),
    )?.name;
    const [departments, setDepartments] = useState([]);
    const [products, setProducts] = useState([]);
    const [productCategories, setProductCategories] = useState(MOCK_CATEGORIES);
    const [activeTab, setActiveTab] = useState(() => visibleDeptPageTabs.find((t) => t.id === 'products')?.id || visibleDeptPageTabs[0]?.id || 'products');

    // Auto-snap activeTab if current becomes hidden (perms changed mid-session).
    useEffect(() => {
        if (visibleDeptPageTabs.length === 0) return;
        if (!visibleDeptPageTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visibleDeptPageTabs[0].id);
        }
    }, [visibleDeptPageTabs, activeTab]);
    const [filterDept, setFilterDept] = useState('all');
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [showDeptForm, setShowDeptForm] = useState(false);
    const [showProdForm, setShowProdForm] = useState(false);
    const [showRequestForm, setShowRequestForm] = useState(null);
    const [editingProd, setEditingProd] = useState(null);
    const [isDeptLoading, setIsDeptLoading] = useState(false);
    const [deptError, setDeptError] = useState('');
    const [isSavingDept, setIsSavingDept] = useState(false);
    const [deptStatusLoadingId, setDeptStatusLoadingId] = useState(null);
    const [isProductsLoading, setIsProductsLoading] = useState(false);
    const [productsError, setProductsError] = useState('');
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [branches, setBranches] = useState([]);
    const branchesForUi = useMemo(
        () => filterPortalVisibleBranches(branches.length > 0 ? branches : branchesProp),
        [branches, branchesProp],
    );
    // When sidebar scopes to a specific branch, narrow create-form dropdowns.
    const scopedBranchesForForms = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return branchesForUi;
        return branchesForUi.filter((b) => String(b.id) === String(selectedBranchId));
    }, [branchesForUi, selectedBranchId]);
    const [productUnits, setProductUnits] = useState(UNIT_OPTIONS);
    const [defaultProductUnit, setDefaultProductUnit] = useState('pcs');
    const [categories, setCategories] = useState([]);
    const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
    const [categoriesError, setCategoriesError] = useState('');
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [isSavingCategory, setIsSavingCategory] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ name: '', type: 'product', departmentId: '' });
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState([]);
    const [isBulkRemoving, setIsBulkRemoving] = useState(false);

    /** True only for "Request Product" new-item flow (not edit / not service). */
    const [isProductRequestFlow, setIsProductRequestFlow] = useState(false);
    const [masterDeptOptions, setMasterDeptOptions] = useState([]);
    const [masterCatOptions, setMasterCatOptions] = useState([]);
    const [masterDeptLoading, setMasterDeptLoading] = useState(false);
    const [masterCatLoading, setMasterCatLoading] = useState(false);
    /** `{ value, label }[]` for unit dropdown; built from catalog UOM or staff product-units. */
    const [uomSelectOptions, setUomSelectOptions] = useState([]);

    // If a branch is scoped in the sidebar, pre-fill the request forms with it.
    const scopedBranchInitial = !isAllBranches ? String(selectedBranchId) : '';
    const [deptForm, setDeptForm] = useState({ name: '', branch_id: scopedBranchInitial || 'b1' });
    const [prodForm, setProdForm] = useState({
        name: '',
        arabic_name: '',
        brand_name: '',
        sku: '',
        description: '',
        notes: '',
        master_department_id: '',
        master_category_id: '',
        sale_price_incl_vat: '',
        category_id: '',
        type: 'product',
        unit: 'piece',
        purchase_price: '',
        sale_price: '',
        stock_qty: 0,
        critical_level: '',
        reorder_level: '',
        department_ids: [],
        branch_id: '',
        department_id: '',
    });

    const filteredProds = products.filter((p) => {
        if (filterDept !== 'all' && !p.department_ids?.some((id) => String(id) === String(filterDept))) return false;
        if (lowStockOnly && !(p.critical_level && p.stock_qty <= p.critical_level)) return false;
        return true;
    });
    const criticalCount = products.filter(p => p.critical_level && p.stock_qty <= p.critical_level).length;

    const loadDepartments = useCallback(async () => {
        setIsDeptLoading(true);
        setDeptError('');
        try {
            // Branch-scoped: if a specific branch is selected, list only what
            // that branch has adopted. Otherwise, list the workshop union.
            const response = branchScope
                ? await getBranchDepartments(branchScope)
                : await getMyDepartments();
            const list =
                Array.isArray(response?.departments) ? response.departments
                : Array.isArray(response?.data?.departments) ? response.data.departments
                : Array.isArray(response?.data) ? response.data
                : Array.isArray(response) ? response
                : null;
            if (!list) throw new Error('Invalid departments response.');
            setDepartments(list);
        } catch (error) {
            setDeptError(error.message || 'Failed to load departments.');
        } finally {
            setIsDeptLoading(false);
        }
    }, [branchScope]);

    useEffect(() => {
        loadDepartments();
    }, [loadDepartments]);

    const loadBranches = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/branches');
            const raw = unwrapWorkshopBranchesResponse(response);
            if (raw.length > 0 || response?.success) {
                setBranches(filterPortalVisibleBranches(raw.length ? raw : response?.branches || []));
            }
        } catch {
            setBranches([]);
        }
    }, []);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    const loadProductUnits = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/product-units');
            if (response?.success && Array.isArray(response.units) && response.units.length > 0) {
                setProductUnits(response.units);
                setDefaultProductUnit(response.defaultUnit || response.units[0] || 'pcs');
            }
        } catch {
            setProductUnits(UNIT_OPTIONS);
            setDefaultProductUnit('pcs');
        }
    }, []);

    useEffect(() => {
        loadProductUnits();
    }, [loadProductUnits]);

    /** Master catalog departments + UOM when opening Request Product. */
    // Refs let us read the latest productUnits without re-running the effect
    // every time `loadProductUnits` resolves (which would visibly re-blink the
    // master-department dropdown into its loading state right after opening).
    const productUnitsRef = useRef(productUnits);
    useEffect(() => {
        productUnitsRef.current = productUnits;
    }, [productUnits]);

    useEffect(() => {
        if (!showProdForm || !isProductRequestFlow) return undefined;
        let cancelled = false;
        setMasterDeptLoading(true);
        getCatalogDepartments({ branchId: branchScope || undefined })
            .then((res) => {
                if (!cancelled) setMasterDeptOptions(pickCatalogArray(res, ['departments', 'items']));
            })
            .catch(() => {
                if (!cancelled) setMasterDeptOptions([]);
            })
            .finally(() => {
                if (!cancelled) setMasterDeptLoading(false);
            });

        (async () => {
            try {
                const uomRes = await getCatalogUnitsOfMeasure({ branchId: branchScope || undefined });
                if (cancelled) return;
                const rows = pickCatalogArray(uomRes, ['units', 'items', 'uoms', 'unitOfMeasures']);
                const opts = rows.map(normalizeUomOption).filter(Boolean);
                if (opts.length) {
                    setUomSelectOptions(opts);
                    return;
                }
            } catch {
                /* catalog UOM route may not exist yet */
            }
            if (cancelled) return;
            const fallback = productUnitsRef.current?.length ? productUnitsRef.current : UNIT_OPTIONS;
            setUomSelectOptions(
                fallback.map((u) => (typeof u === 'string' ? { value: u, label: u } : normalizeUomOption(u))).filter(Boolean),
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [showProdForm, isProductRequestFlow, branchScope]);

    /** Master categories for selected master department (product type only). */
    useEffect(() => {
        if (!showProdForm || !isProductRequestFlow || !prodForm.master_department_id) {
            if (showProdForm && isProductRequestFlow) setMasterCatOptions([]);
            return undefined;
        }
        let cancelled = false;
        setMasterCatLoading(true);
        getCatalogCategories({
            departmentId: String(prodForm.master_department_id),
            type: 'product',
            branchId: branchScope || undefined,
        })
            .then((res) => {
                if (!cancelled) setMasterCatOptions(pickCatalogArray(res, ['categories', 'items']));
            })
            .catch(() => {
                if (!cancelled) setMasterCatOptions([]);
            })
            .finally(() => {
                if (!cancelled) setMasterCatLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [showProdForm, isProductRequestFlow, prodForm.master_department_id, branchScope]);

    const loadCategories = useCallback(async () => {
        setIsCategoriesLoading(true);
        setCategoriesError('');
        try {
            const response = branchScope
                ? await getBranchCategories(branchScope)
                : await getMyCategories();
            const list =
                Array.isArray(response?.categories) ? response.categories
                : Array.isArray(response?.data?.categories) ? response.data.categories
                : Array.isArray(response?.data) ? response.data
                : Array.isArray(response) ? response
                : null;
            if (!list) throw new Error('Invalid categories response.');
            setCategories(list);
            setProductCategories(list.map((category) => ({ id: category.id, name: category.name })));
        } catch (error) {
            setCategoriesError(error.message || 'Failed to load categories.');
        } finally {
            setIsCategoriesLoading(false);
        }
    }, [branchScope]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const saveCategory = async () => {
        if (!categoryForm.name.trim() || !categoryForm.departmentId) return;
        const normalizedName = categoryForm.name.trim().toLowerCase();
        const duplicateCategory = categories.some((category) => {
            return (
                String(category.name || '').trim().toLowerCase() === normalizedName &&
                String(category.type || '').toLowerCase() === String(categoryForm.type || '').toLowerCase() &&
                String(category.departmentId || '') === String(categoryForm.departmentId || '')
            );
        });
        if (duplicateCategory) {
            setCategoriesError('A category with the same name already exists for this type and department.');
            return;
        }
        setIsSavingCategory(true);
        setCategoriesError('');
        try {
            await apiFetch('/workshop-staff/category/create', {
                method: 'POST',
                body: JSON.stringify({
                    name: categoryForm.name.trim(),
                    type: categoryForm.type,
                    departmentId: String(categoryForm.departmentId),
                    isActive: true,
                }),
            });
            setShowCategoryForm(false);
            setCategoryForm({ name: '', type: 'product', departmentId: '' });
            await loadCategories();
        } catch (error) {
            setCategoriesError(error.message || 'Failed to create category.');
        } finally {
            setIsSavingCategory(false);
        }
    };

    const normalizeProduct = (product, category) => {
        const adoptionOpening = pickNumber(
            product.openingQty,
            product.opening_qty,
        );
        const onHand = firstFiniteNumber([
            product.currentQty,
            product.current_qty,
            product.qtyOnHand,
            product.qty_on_hand,
        ]);
        const effectiveStock = onHand !== null ? onHand : adoptionOpening;
        return {
            id: `product-${product.id}`,
            sourceId: product.id,
            name: pickItemName(product) || 'Unnamed',
            sku: product.sku || '',
            category_id: product.categoryId || product.category_id || category?.id || '',
            type: category?.type || product.type || 'product',
            unit: product.unit || 'piece',
            purchase_price: Number(product.purchasePrice ?? product.purchase_price) || 0,
            sale_price: Number(product.salePrice ?? product.sale_price) || 0,
            adoption_opening_qty: adoptionOpening,
            stock_qty: effectiveStock,
            critical_level: Number(product.criticalStockPoint ?? product.critical_stock_point) || 0,
            reorder_level: Number(product.reorderLevel ?? product.reorder_level) || 0,
            department_ids:
                product.departmentId != null || product.department_id != null
                    ? [String(product.departmentId ?? product.department_id)]
                    : [],
            dept: pickDeptLabel(product),
            isActive: product.isActive !== false,
        };
    };

    const normalizeService = (service) => ({
        id: `service-${service.id}`,
        sourceId: service.id,
        name: pickItemName(service) || 'Unnamed Service',
        sku: '',
        category_id: service.categoryId || service.category_id || '',
        type: 'service',
        unit: 'service',
        purchase_price: 0,
        sale_price: Number(service.sellingPrice ?? service.salePrice ?? service.selling_price) || 0,
        stock_qty: 0,
        critical_level: 0,
        reorder_level: 0,
        department_ids:
            service.departmentId != null || service.department_id != null
                ? [String(service.departmentId ?? service.department_id)]
                : [],
        dept: pickDeptLabel(service),
        isActive: service.isActive !== false,
    });

    const loadProducts = useCallback(async () => {
        setIsProductsLoading(true);
        setProductsError('');

        const extractProducts = (res) => unwrapWorkshopBranchListResponse(res, 'products');
        const extractServices = (res) => unwrapWorkshopBranchListResponse(res, 'services');

        // Per-branch listing rows can either be flat or wrapped as
        // `{ product: {...}, openingQty, ... }`. Pull out the master row plus
        // any per-branch overrides before normalizing.
        const buildBranchProductRow = (row) => {
            const master = row?.product && typeof row.product === 'object' ? row.product : {};
            const merged = {
                ...row,
                    ...master,
                id: master.id ?? row.productId ?? row.product_id ?? row.id,
                    openingQty: row?.openingQty ?? master?.openingQty,
                    opening_qty: row?.opening_qty ?? master?.opening_qty,
                    currentQty: row?.currentQty ?? master?.currentQty,
                    current_qty: row?.current_qty ?? master?.current_qty,
                    qtyOnHand: row?.qtyOnHand ?? master?.qtyOnHand,
                    qty_on_hand: row?.qty_on_hand ?? master?.qty_on_hand,
                    criticalStockPoint: row?.criticalStockPoint ?? master?.criticalStockPoint,
                salePrice: row?.salePriceOverride ?? master?.salePrice ?? row?.salePrice,
                purchasePrice: row?.purchasePriceOverride ?? master?.purchasePrice ?? row?.purchasePrice,
            };
            return normalizeProduct(merged, master?.category || row?.category);
        };
        const buildBranchServiceRow = (row) => {
            const master = row?.service && typeof row.service === 'object' ? row.service : {};
            const merged = {
                ...row,
                ...master,
                id: master.id ?? row.serviceId ?? row.service_id ?? row.id,
                sellingPrice:
                    row?.sellingPriceOverride ??
                    master?.sellingPrice ??
                    master?.salePrice ??
                    row?.sellingPrice ??
                    row?.salePrice,
            };
            return normalizeService(merged);
        };

        // Workshop-union rows already carry their branch list as
        // `branches: [{id,name}]` (and `branchNames`), so we just splice
        // those onto the normalized row.
        const buildUnionProductRow = (row) => {
            const norm = normalizeProduct(
                {
                    ...row,
                    departmentId: row?.departmentId,
                    departmentName: row?.departmentName,
                    categoryId: row?.categoryId,
                },
                { id: row?.categoryId, name: row?.categoryName, type: 'product' },
            );
            return {
                ...norm,
                branches: Array.isArray(row?.branches) ? row.branches : [],
                branchNames: Array.isArray(row?.branchNames) ? row.branchNames : [],
            };
        };
        const buildUnionServiceRow = (row) => {
            const norm = normalizeService({
                ...row,
                sellingPrice: row?.sellingPrice,
                departmentId: row?.departmentId,
                departmentName: row?.departmentName,
                categoryId: row?.categoryId,
            });
            return {
                ...norm,
                branches: Array.isArray(row?.branches) ? row.branches : [],
                branchNames: Array.isArray(row?.branchNames) ? row.branchNames : [],
            };
        };

        try {
            if (branchScope) {
                const [prodRes, svcRes] = await Promise.all([
                    getBranchProducts(branchScope).catch(() => null),
                    getBranchServices(branchScope).catch(() => null),
                ]);
                const flatProd = extractProducts(prodRes).map(buildBranchProductRow);
                const flatSvc = extractServices(svcRes).map(buildBranchServiceRow);
                setProducts([...flatProd, ...flatSvc]);
                return;
            }

            const [prodRes, svcRes] = await Promise.all([
                getMyProducts().catch(() => null),
                getMyServices().catch(() => null),
            ]);
            const flatProducts = extractProducts(prodRes).map(buildUnionProductRow);
            const flatServices = extractServices(svcRes).map(buildUnionServiceRow);
            setProducts([...flatProducts, ...flatServices]);
        } catch (error) {
            setProductsError(error.message || 'Failed to load products and services.');
        } finally {
            setIsProductsLoading(false);
        }
    }, [branchScope]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const saveDept = async () => {
        if (!deptForm.name) return;
        setIsSavingDept(true);
        setDeptError('');
        try {
            await apiFetch('/workshop-staff/department/create', {
                method: 'POST',
                body: JSON.stringify({
                    name: deptForm.name,
                    isActive: true,
                }),
            });
            await loadDepartments();
            setShowDeptForm(false);
            setDeptForm({ name: '', branch_id: scopedBranchInitial || 'b1' });
        } catch (error) {
            setDeptError(error.message || 'Failed to create department.');
        } finally {
            setIsSavingDept(false);
        }
    };
    const openAddProd = (presetType = 'product') => {
        setEditingProd(null);
        const isReqProduct = presetType === 'product';
        setIsProductRequestFlow(isReqProduct);
        if (isReqProduct) {
        setProdForm({
            name: '',
                arabic_name: '',
                brand_name: '',
            sku: '',
                description: '',
                notes: '',
                master_department_id: '',
                master_category_id: '',
                sale_price_incl_vat: '',
            category_id: '',
                type: 'product',
                unit: defaultProductUnit || 'pcs',
                purchase_price: '',
                sale_price: '',
                stock_qty: 0,
                critical_level: '',
                reorder_level: '',
                department_ids: [],
                branch_id: scopedBranchInitial || branches[0]?.id || '',
                department_id: '',
            });
        } else {
            setProdForm({
                name: '',
                arabic_name: '',
                brand_name: '',
                sku: '',
                description: '',
                notes: '',
                master_department_id: '',
                master_category_id: '',
                sale_price_incl_vat: '',
                category_id: '',
                type: 'service',
                unit: 'service',
            purchase_price: '',
            sale_price: '',
            stock_qty: 0,
            critical_level: '',
            reorder_level: '',
            department_ids: [],
            branch_id: scopedBranchInitial || branches[0]?.id || '',
            department_id: departments[0]?.id || '',
        });
        }
        setShowProdForm(true);
    };

    /**
     * Render the "Branches" column for a row.
     * - In branch-scoped view, every row is by definition in `selectedBranchName`.
     * - In the workshop-union view, we show whatever the BE sent us
     *   (`row.branches: [{id,name}]` or `row.branchNames: string[]`). If neither
     *   is present we show '—' so you can spot rows where the BE hasn't been
     *   updated to include the per-row branch list yet.
     */
    const formatRowBranches = (row) => {
        if (branchScope) return selectedBranchName || `Branch ${selectedBranchId}`;
        const list =
            (Array.isArray(row?.branches) && row.branches.map((b) => b?.name).filter(Boolean))
            || (Array.isArray(row?.branchNames) && row.branchNames)
            || [];
        if (!list.length) return '—';
        return list.join(', ');
    };

    const productItems = filteredProds.filter((row) => row.type !== 'service');
    const serviceItems = filteredProds.filter((row) => row.type === 'service');
    const allProductRowsSelected = productItems.length > 0 && productItems.every((p) => selectedProductIds.includes(String(p.sourceId)));
    const allServiceRowsSelected = serviceItems.length > 0 && serviceItems.every((s) => selectedServiceIds.includes(String(s.sourceId)));

    useEffect(() => {
        const valid = new Set(productItems.map((p) => String(p.sourceId)));
        setSelectedProductIds((prev) => prev.filter((id) => valid.has(String(id))));
    }, [productItems]);

    useEffect(() => {
        const valid = new Set(serviceItems.map((s) => String(s.sourceId)));
        setSelectedServiceIds((prev) => prev.filter((id) => valid.has(String(id))));
    }, [serviceItems]);

    const toggleProductSelection = (sourceId) => {
        const id = String(sourceId);
        setSelectedProductIds((prev) => (
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        ));
    };

    const toggleServiceSelection = (sourceId) => {
        const id = String(sourceId);
        setSelectedServiceIds((prev) => (
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        ));
    };

    const toggleAllProductsOnPage = () => {
        if (allProductRowsSelected) {
            setSelectedProductIds([]);
            return;
        }
        setSelectedProductIds(productItems.map((p) => String(p.sourceId)));
    };

    const toggleAllServicesOnPage = () => {
        if (allServiceRowsSelected) {
            setSelectedServiceIds([]);
            return;
        }
        setSelectedServiceIds(serviceItems.map((s) => String(s.sourceId)));
    };

    const openEditProd = (p) => {
        setEditingProd(p);
        setIsProductRequestFlow(false);
        setProdForm({
            ...p,
            arabic_name: p.arabic_name ?? '',
            brand_name: p.brand_name ?? '',
            description: p.description ?? '',
            notes: p.notes ?? '',
            master_department_id: '',
            master_category_id: '',
            sale_price_incl_vat: p.sale_price != null ? String(p.sale_price) : '',
            purchase_price: p.purchase_price || '',
            sale_price: p.sale_price || '',
            critical_level: p.critical_level || '',
            reorder_level: p.reorder_level || '',
            branch_id: p.branch_id || branches[0]?.id || '',
            department_id: p.department_id || p.department_ids?.[0] || departments[0]?.id || '',
        });
        setShowProdForm(true);
    };
    const saveProd = async () => {
        if (!prodForm.name) return;
        const data = {
            ...prodForm,
            sale_price: parseFloat(prodForm.sale_price) || 0, purchase_price: parseFloat(prodForm.purchase_price) || 0,
            stock_qty: parseInt(prodForm.stock_qty) || 0, critical_level: parseFloat(prodForm.critical_level) || 0,
            reorder_level: parseFloat(prodForm.reorder_level) || 0,
            department_ids: prodForm.department_ids?.length ? prodForm.department_ids : [prodForm.department_id || editingProd?.department_ids?.[0] || departments[0]?.id].filter(Boolean),
            department_id: prodForm.department_id || editingProd?.department_ids?.[0] || departments[0]?.id || '',
            branch_id: prodForm.branch_id || branches[0]?.id || '',
            dept: editingProd?.dept || departments[0]?.name || 'Lubrication',
        };

        const workshopId = workshop?.id;
        if (!workshopId) {
            setProductsError('Workshop session missing. Please login again.');
            return;
        }

        if (!editingProd && isProductRequestFlow) {
            if (!prodForm.master_department_id || !prodForm.master_category_id) {
                setProductsError('Select a master department and category.');
                return;
            }
        }

        setIsSavingProduct(true);
        setProductsError('');

        if (editingProd) {
            try {
                const sourceId = editingProd.sourceId || String(editingProd.id).replace(/^product-/, '').replace(/^service-/, '');
                const isService = data.type === 'service' || String(editingProd.id).startsWith('service-');

                if (isService) {
                    await apiFetch(`/workshop-staff/service/${sourceId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            name: data.name,
                            categoryId: String(data.category_id || ''),
                            departmentId: String(data.department_id || data.department_ids?.[0] || ''),
                            sellingPrice: data.sale_price,
                            minPriceCorporate: 0,
                            maxPriceCorporate: 0,
                            isActive: true,
                        }),
                    });
                } else {
                    await apiFetch(`/workshop-staff/product/${sourceId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            name: data.name,
                            unit: data.unit || defaultProductUnit || 'pcs',
                            purchasePrice: data.purchase_price,
                            salePrice: data.sale_price,
                            openingQty: data.stock_qty,
                            criticalStockPoint: data.critical_level,
                            categoryId: String(data.category_id || ''),
                            allowDecimalQty: true,
                            minPriceCorporate: 0,
                            maxPriceCorporate: 0,
                            isActive: true,
                        }),
                    });
                }
                await loadProducts();
                setShowProdForm(false);
            } catch (error) {
                setProductsError(error.message || 'Failed to update item.');
            } finally {
                setIsSavingProduct(false);
            }
            return;
        }

        try {
            if (isProductRequestFlow) {
                const payload = {
                    workshopId: String(workshopId),
                    branchId: branchScope ? String(branchScope) : data.branch_id ? String(data.branch_id) : undefined,
                    name: prodForm.name.trim(),
                    arabicName: prodForm.arabic_name?.trim() || undefined,
                    brandName: prodForm.brand_name?.trim() || undefined,
                    sku: prodForm.sku?.trim() || undefined,
                    description: prodForm.description?.trim() || undefined,
                    unit: prodForm.unit || defaultProductUnit || 'pcs',
                    salePriceInclusiveVat: parseFloat(prodForm.sale_price_incl_vat) || 0,
                    notes: prodForm.notes?.trim() || undefined,
                    masterDepartmentId: String(prodForm.master_department_id),
                    masterCategoryId: String(prodForm.master_category_id),
                };
                try {
                    await submitCatalogProductRequest(payload);
                } catch (err) {
                    await apiFetch('/workshop-staff/catalog/product-request', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                    });
                }
                await loadProducts();
                setShowProdForm(false);
                setIsProductRequestFlow(false);
            } else {
            await apiFetch('/workshop-staff/product/create', {
                method: 'POST',
                body: JSON.stringify({
                    workshopId: String(workshopId),
                    branchId: String(data.branch_id || ''),
                    name: data.name,
                    departmentId: String(data.department_id || ''),
                    categoryId: String(data.category_id || ''),
                    unit: data.unit || defaultProductUnit || 'pcs',
                    purchasePrice: data.purchase_price,
                    salePrice: data.sale_price,
                    openingQty: data.stock_qty,
                    minPriceCorporate: 0,
                    maxPriceCorporate: 0,
                    criticalStockPoint: data.critical_level,
                    kmTypeValue: 0,
                    allowDecimalQty: true,
                    type: data.type || 'product',
                    isActive: true,
                }),
            });
            await loadProducts();
            setShowProdForm(false);
            }
        } catch (error) {
            setProductsError(
                error.message ||
                    (isProductRequestFlow
                        ? 'Failed to submit product request. Ensure the catalog product-request API is deployed.'
                        : 'Failed to create product.'),
            );
        } finally {
            setIsSavingProduct(false);
        }
    };

    const removeDeptFromBranch = async (deptId) => {
        if (!branchScope) return;
        if (!window.confirm(`Remove this department from ${selectedBranchName || 'this branch'}? Adopted categories under it stay; only the link to this branch is dropped. If this branch was the last one using it, it will also be removed from the workshop.`)) return;
        try {
            await removeBranchDepartment(branchScope, deptId);
            await loadDepartments();
        } catch (error) {
            setDeptError(error.message || 'Failed to remove department from this branch.');
        }
    };

    const toggleDepartmentActive = async (dept) => {
        const masterId = dept.departmentId || dept.masterId || dept.id;
        const currentlyActive = Boolean(dept.isActive ?? dept.status === 'active');
        const nextActive = !currentlyActive;
        const branchLabel = selectedBranchName || 'this branch';
        const msg = branchScope
            ? nextActive
                ? `Reactivate "${dept.name}" on ${branchLabel} only?\n\nCategories, products, and services under this department on this branch will be marked active. Other branches are not affected.`
                : `Deactivate "${dept.name}" on ${branchLabel} only?\n\nCategories, products, and services under this department on this branch will be marked inactive.\n\nOther branches stay unchanged. Past invoices are unchanged — nothing is deleted.`
            : nextActive
              ? `Reactivate "${dept.name}" for the entire workshop?\n\nLinked categories, products, and services on all branches will be marked active.`
              : `Deactivate "${dept.name}" for the entire workshop?\n\nAll categories, products, and services under this department will be marked inactive on every branch.\n\nPast invoices and historical records stay unchanged — nothing is deleted.`;
        if (!window.confirm(msg)) return;
        setDeptStatusLoadingId(String(masterId));
        setDeptError('');
        try {
            await patchWorkshopDepartmentActive(masterId, nextActive, branchScope || undefined);
            await loadDepartments();
            await loadCategories();
            await loadProducts();
        } catch (error) {
            setDeptError(error.message || 'Failed to update department status.');
        } finally {
            setDeptStatusLoadingId(null);
        }
    };

    const removeCategoryFromBranch = async (categoryId) => {
        if (!branchScope) return;
        if (!window.confirm(`Remove this category from ${selectedBranchName || 'this branch'}?`)) return;
        try {
            await removeBranchCategory(branchScope, categoryId);
            await loadCategories();
        } catch (error) {
            setCategoriesError(error.message || 'Failed to remove category from this branch.');
        }
    };

    const removeProductFromBranch = async (sourceId, isService) => {
        if (!sourceId) return;
        const noun = isService ? 'service' : 'product';
        const scopeLabel = branchScope
            ? `${selectedBranchName || 'this branch'} only`
            : 'all branches in this workshop';
        if (!window.confirm(`Remove this ${noun} from ${scopeLabel}?`)) return;
        setProductsError('');
        try {
            if (branchScope) {
                if (isService) await removeBranchService(branchScope, sourceId);
                else await removeBranchProduct(branchScope, sourceId);
            } else if (isService) {
                const res = await removeWorkshopService(sourceId);
                summarizeBulkRemoveResult(res);
            } else {
                const res = await removeWorkshopProduct(sourceId);
                summarizeBulkRemoveResult(res);
            }
            await loadProducts();
        } catch (error) {
            setProductsError(error.message || `Failed to remove ${noun}.`);
        }
    };

    const removeSelectedFromBranch = async (isService) => {
        const ids = isService ? selectedServiceIds : selectedProductIds;
        if (!ids.length) return;
        const noun = isService ? 'service' : 'product';
        const scopeText = branchScope ? `${selectedBranchName || 'this branch'} only` : 'all branches in this workshop';
        if (!window.confirm(`Remove ${ids.length} ${noun}${ids.length === 1 ? '' : 's'} from ${scopeText}?`)) return;
        setIsBulkRemoving(true);
        setProductsError('');
        try {
            if (branchScope) {
                if (isService) {
                    await Promise.all(ids.map((id) => removeBranchService(branchScope, id)));
                    setSelectedServiceIds([]);
                } else {
                    await Promise.all(ids.map((id) => removeBranchProduct(branchScope, id)));
                    setSelectedProductIds([]);
                }
            } else if (isService) {
                const res = await removeWorkshopServicesBulk(ids.map(String));
                summarizeBulkRemoveResult(res);
                const removed = new Set((res?.removedIds || []).map(String));
                setSelectedServiceIds((prev) => prev.filter((id) => !removed.has(String(id))));
            } else {
                const res = await removeWorkshopProductsBulk(ids.map(String));
                summarizeBulkRemoveResult(res);
                const removed = new Set((res?.removedIds || []).map(String));
                setSelectedProductIds((prev) => prev.filter((id) => !removed.has(String(id))));
            }
            await loadProducts();
        } catch (error) {
            setProductsError(error.message || `Failed to bulk remove ${noun}s.`);
        } finally {
            setIsBulkRemoving(false);
        }
    };

    const closeProdForm = () => {
        setShowProdForm(false);
        setIsProductRequestFlow(false);
    };

    const prodFormTitle = editingProd
        ? 'Edit Product/Service'
        : isProductRequestFlow
          ? 'Request Product'
          : prodForm.type === 'service'
            ? 'Request Service'
            : 'Request Product/Service';

    const prodFormBackLabel =
        editingProd || prodForm.type === 'service' || activeTab === 'services'
            ? 'Back to Services'
            : 'Back to Products';

    if (showRequestForm) {
        const stockItem = showRequestForm;
        return (
            <WorkshopSubScreen
                title={`Request Stock — ${stockItem.name}`}
                subtitle="Submit a replenishment request to your supplier or warehouse."
                backLabel="Back to Products"
                onBack={() => setShowRequestForm(null)}
                size="narrow"
                footer={(
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                        <button type="button" className="btn-secondary" onClick={() => setShowRequestForm(null)}>Cancel</button>
                        <button
                            type="button"
                            className="btn-submit"
                            onClick={() => {
                                alert('Stock request submitted for approval');
                                setShowRequestForm(null);
                            }}
                        >
                            Submit Request
                        </button>
                    </div>
                )}
            >
                <div className="ws-section" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ background: 'var(--color-bg-muted)', padding: 14, borderRadius: 10 }}>
                            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 4px' }}>Current Stock</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                                {stockItem.stock_qty}{' '}
                                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>{stockItem.unit}</span>
                            </p>
                            {stockItem.critical_level && stockItem.stock_qty <= stockItem.critical_level ? (
                                <span className="ws-badge ws-badge--red" style={{ marginTop: 8, display: 'inline-block' }}>⚠ Below critical level</span>
                            ) : null}
                        </div>
                        <div className="ws-field"><label>Supplier / Warehouse</label><select><option>Al-Jazeera Auto Parts</option><option>Gulf Lubricants Co.</option><option>Saudi Tire Trading</option></select></div>
                        <div className="ws-field"><label>Quantity Requested ({stockItem.unit})</label><input type="number" placeholder={`Enter qty in ${stockItem.unit}`} /></div>
                        <div className="ws-field"><label>Notes</label><input placeholder="Optional notes..." /></div>
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    if (showCategoryForm) {
        return (
            <WorkshopSubScreen
                title="Request Category"
                subtitle="Submit a new category for super-admin catalog approval."
                backLabel="Back to Categories"
                onBack={() => !isSavingCategory && setShowCategoryForm(false)}
                backDisabled={isSavingCategory}
                footer={(
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                        <button type="button" className="btn-secondary" onClick={() => setShowCategoryForm(false)} disabled={isSavingCategory}>Cancel</button>
                        <button type="button" className="btn-submit" onClick={saveCategory} disabled={isSavingCategory || !categoryForm.name.trim() || !categoryForm.departmentId}>
                            {isSavingCategory ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            >
                <div className="ws-section" style={{ padding: 20 }}>
                    <div className="ws-form-grid">
                        <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                            <label>Name *</label>
                            <input value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="ws-field">
                            <label>Type *</label>
                            <select value={categoryForm.type} onChange={(e) => setCategoryForm((f) => ({ ...f, type: e.target.value }))}>
                                <option value="product">Product</option>
                                <option value="service">Service</option>
                            </select>
                        </div>
                        <div className="ws-field">
                            <label>Department *</label>
                            <select value={categoryForm.departmentId} onChange={(e) => setCategoryForm((f) => ({ ...f, departmentId: e.target.value }))}>
                                <option value="">Select Department</option>
                                {departments.map((department) => (
                                    <option key={department.id} value={department.id}>{department.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    if (showDeptForm) {
        return (
            <WorkshopSubScreen
                title="Request Department"
                subtitle="Submit a department adoption request for your workshop."
                backLabel="Back to Departments"
                onBack={() => !isSavingDept && setShowDeptForm(false)}
                backDisabled={isSavingDept}
                footer={(
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                        <button type="button" className="btn-secondary" onClick={() => setShowDeptForm(false)} disabled={isSavingDept}>Cancel</button>
                        <button type="button" className="btn-submit" disabled={isSavingDept || !deptForm.name.trim()} onClick={saveDept}>
                            {isSavingDept ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            >
                <div className="ws-section" style={{ padding: 20 }}>
                    <div className="ws-form-grid">
                        <div className="ws-field"><label>Name *</label><input value={deptForm.name} onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))} /></div>
                        <div className="ws-field">
                            <label>Branch</label>
                            <select
                                value={deptForm.branch_id}
                                disabled={!isAllBranches}
                                onChange={(e) => setDeptForm((f) => ({ ...f, branch_id: e.target.value }))}
                                style={{ opacity: isAllBranches ? 1 : 0.85 }}
                            >
                                {isAllBranches && <option value="">Select Branch</option>}
                                {scopedBranchesForForms.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    if (showProdForm) {
        return (
            <WorkshopSubScreen
                title={prodFormTitle}
                subtitle={
                    isProductRequestFlow && !editingProd
                        ? 'Adds a row to the master catalog queue for super-admin approval.'
                        : 'Update catalog item details, pricing, and stock thresholds.'
                }
                backLabel={prodFormBackLabel}
                size="wide"
                onBack={() => !isSavingProduct && closeProdForm()}
                backDisabled={isSavingProduct}
                footer={(
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                        <button type="button" className="btn-secondary" onClick={closeProdForm} disabled={isSavingProduct}>Cancel</button>
                        <button
                            type="button"
                            className="btn-submit"
                            disabled={
                                isSavingProduct ||
                                !prodForm.name.trim() ||
                                (isProductRequestFlow && (!prodForm.master_department_id || !prodForm.master_category_id))
                            }
                            onClick={saveProd}
                        >
                            {isSavingProduct ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            >
                <div className="ws-section" style={{ padding: 20 }}>
                    {isProductRequestFlow && !editingProd ? (
                        <div className="ws-form-grid">
                            <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                Request adds a row to the master catalog queue (super-admin). Departments and categories are loaded from the global master catalog.
                            </p>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Name *</label>
                                <input value={prodForm.name} onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Arabic name</label>
                                <input value={prodForm.arabic_name} onChange={(e) => setProdForm((f) => ({ ...f, arabic_name: e.target.value }))} dir="rtl" placeholder="الاسم بالعربية" />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Brand name</label>
                                <input value={prodForm.brand_name} onChange={(e) => setProdForm((f) => ({ ...f, brand_name: e.target.value }))} />
                            </div>
                            <div className="ws-field">
                                <label>SKU</label>
                                <input value={prodForm.sku} onChange={(e) => setProdForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Optional" />
                            </div>
                            <div className="ws-field">
                                <label>Unit *</label>
                                <select value={prodForm.unit} onChange={(e) => setProdForm((f) => ({ ...f, unit: e.target.value }))}>
                                    {(uomSelectOptions.length
                                        ? uomSelectOptions
                                        : (productUnits || []).map((u) => (typeof u === 'string' ? { value: u, label: u } : normalizeUomOption(u))).filter(Boolean)
                                    ).map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Description</label>
                                <textarea rows={3} value={prodForm.description} onChange={(e) => setProdForm((f) => ({ ...f, description: e.target.value }))} placeholder="Product description" style={{ width: '100%', resize: 'vertical' }} />
                            </div>
                            <div className="ws-field">
                                <label>Sales price inclusive VAT (expected) *</label>
                                <input type="number" min={0} step="0.01" value={prodForm.sale_price_incl_vat} onChange={(e) => setProdForm((f) => ({ ...f, sale_price_incl_vat: e.target.value }))} placeholder="0.00" />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Notes</label>
                                <textarea rows={2} value={prodForm.notes} onChange={(e) => setProdForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes for approvers" style={{ width: '100%', resize: 'vertical' }} />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Department (master) *</label>
                                <select
                                    value={prodForm.master_department_id}
                                    disabled={masterDeptLoading}
                                    onChange={(e) => setProdForm((f) => ({ ...f, master_department_id: e.target.value, master_category_id: '', category_id: '' }))}
                                >
                                    <option value="">{masterDeptLoading ? 'Loading…' : 'Select department'}</option>
                                    {masterDeptOptions.map((d) => {
                                        const id = d.id ?? d.departmentId ?? d.masterId;
                                        return <option key={id} value={id}>{d.name || pickDeptLabel(d)}</option>;
                                    })}
                                </select>
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Category (master) *</label>
                                <select
                                    value={prodForm.master_category_id}
                                    disabled={!prodForm.master_department_id || masterCatLoading}
                                    onChange={(e) => setProdForm((f) => ({ ...f, master_category_id: e.target.value, category_id: e.target.value }))}
                                >
                                    <option value="">
                                        {!prodForm.master_department_id ? 'Select a department first' : masterCatLoading ? 'Loading…' : 'Select category'}
                                    </option>
                                    {masterCatOptions.map((c) => {
                                        const id = c.id ?? c.categoryId ?? c.masterId;
                                        return <option key={id} value={id}>{c.name || c.categoryName || '—'}</option>;
                                    })}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="ws-form-grid">
                                <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                    <label>Name *</label>
                                    <input value={prodForm.name} onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div className="ws-field">
                                    <label>SKU / Barcode</label>
                                    <input value={prodForm.sku} onChange={(e) => setProdForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Optional" />
                                </div>
                                <div className="ws-field">
                                    <label>Category</label>
                                    <select value={prodForm.category_id} onChange={(e) => setProdForm((f) => ({ ...f, category_id: e.target.value }))}>
                                        <option value="">Select Category</option>
                                        {productCategories.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ws-field">
                                    <label>Branch</label>
                                    <select value={prodForm.branch_id} disabled={!isAllBranches} onChange={(e) => setProdForm((f) => ({ ...f, branch_id: e.target.value }))} style={{ opacity: isAllBranches ? 1 : 0.85 }}>
                                        {isAllBranches && <option value="">Select Branch</option>}
                                        {scopedBranchesForForms.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ws-field">
                                    <label>Department</label>
                                    <select value={prodForm.department_id} onChange={(e) => setProdForm((f) => ({ ...f, department_id: e.target.value, department_ids: e.target.value ? [e.target.value] : [] }))}>
                                        <option value="">Select Department</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ws-field">
                                    <label>Type</label>
                                    <select value={prodForm.type} onChange={(e) => setProdForm((f) => ({ ...f, type: e.target.value }))}>
                                        <option value="product">Product</option>
                                        <option value="service">Service</option>
                                    </select>
                                </div>
                                <div className="ws-field">
                                    <label>Unit</label>
                                    <select value={prodForm.unit} onChange={(e) => setProdForm((f) => ({ ...f, unit: e.target.value }))}>
                                        {productUnits.map((u) => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ws-field">
                                    <label>Purchase Price (SAR)</label>
                                    <input type="number" value={prodForm.purchase_price} onChange={(e) => setProdForm((f) => ({ ...f, purchase_price: e.target.value }))} />
                                </div>
                                <div className="ws-field">
                                    <label>Sale Price (SAR, incl. VAT)</label>
                                    <input type="number" value={prodForm.sale_price} onChange={(e) => setProdForm((f) => ({ ...f, sale_price: e.target.value }))} />
                                </div>
                                <div className="ws-field">
                                    <label>Current Stock Qty</label>
                                    <input type="number" value={prodForm.stock_qty} onChange={(e) => setProdForm((f) => ({ ...f, stock_qty: e.target.value }))} />
                                </div>
                                <div className="ws-field">
                                    <label>
                                        Critical Level{' '}
                                        <span style={{ fontSize: '0.6875rem', color: '#DC2626' }}>(alert threshold)</span>
                                    </label>
                                    <input type="number" value={prodForm.critical_level} onChange={(e) => setProdForm((f) => ({ ...f, critical_level: e.target.value }))} />
                                </div>
                                <div className="ws-field">
                                    <label>Reorder Level</label>
                                    <input type="number" value={prodForm.reorder_level} onChange={(e) => setProdForm((f) => ({ ...f, reorder_level: e.target.value }))} />
                                </div>
                            </div>
                            {prodForm.critical_level && prodForm.stock_qty <= parseFloat(prodForm.critical_level) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginTop: 16, fontSize: '0.8125rem', color: '#DC2626' }}>
                                    <AlertTriangle size={16} /> Current stock is at/below critical level — saving will notify all active suppliers.
                                </div>
                            )}
                        </>
                    )}
                </div>
            </WorkshopSubScreen>
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Dept & Products</h2><p className="ws-page-sub">Departments and product catalog with stock levels</p></div>
            </div>

            <div style={{
                marginBottom: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                background: branchScope ? '#ECFEFF' : '#EEF2FF',
                color: branchScope ? '#0E7490' : '#4338CA',
                fontSize: '0.8125rem',
                fontWeight: 700,
            }}>
                <span>Viewing:</span>
                <span>{branchScope ? (selectedBranchName || `Branch ${selectedBranchId}`) : 'All branches (workshop union)'}</span>
            </div>
            {!branchScope && (
                <div
                    style={{
                        marginBottom: 16,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #C7D2FE',
                        background: '#EEF2FF',
                        color: '#3730A3',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                    }}
                >
                    To see correct current stock of the branch select a specific branch
                </div>
            )}

            {criticalCount > 0 && (
                <div style={{display:'flex',alignItems:'center',gap:12,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:12,padding:14,marginBottom:20}}>
                    <AlertTriangle size={20} style={{color:'#DC2626',flexShrink:0}}/>
                    <p style={{margin:0,fontSize:'0.875rem',fontWeight:600,color:'#DC2626'}}>
                        {criticalCount} product{criticalCount > 1 ? 's are' : ' is'} at or below critical stock level — suppliers have been notified.
                    </p>
                </div>
            )}

            <div className="ws-dept-tabs">
                {hasPermission('workshop.departments.departments.view') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('departments')}
                        className={`ws-dept-tab${activeTab === 'departments' ? ' active' : ''}`}
                    >
                        Departments ({departments.length})
                    </button>
                )}
                {hasPermission('workshop.departments.products.view') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('products')}
                        className={`ws-dept-tab${activeTab === 'products' ? ' active' : ''}`}
                    >
                        Products ({productItems.length})
                        {criticalCount > 0 && (
                            <span className="ws-nav-badge ws-dept-tab-badge">{criticalCount}</span>
                        )}
                    </button>
                )}
                {hasPermission('workshop.departments.services.view') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('services')}
                        className={`ws-dept-tab${activeTab === 'services' ? ' active' : ''}`}
                    >
                        Services ({serviceItems.length})
                    </button>
                )}
                {hasPermission('workshop.departments.categories.view') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('categories')}
                        className={`ws-dept-tab${activeTab === 'categories' ? ' active' : ''}`}
                    >
                        Categories ({categories.length})
                    </button>
                )}
            </div>

            {activeTab === 'departments' && hasPermission('workshop.departments.departments.view') && (
                <div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16, gap: 10}}>
                        <button className="btn-portal" onClick={loadDepartments} disabled={isDeptLoading}>
                            <RefreshCw size={14} /> {isDeptLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        {canCreateDept && (
                            <button className="btn-portal" onClick={() => setShowDeptForm(true)}>
                                <Plus size={14}/> Request Department
                            </button>
                        )}
                    </div>
                    {deptError && (
                        <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                            {deptError}
                        </div>
                    )}
                    <div className="ws-section">
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead><tr><th>Name</th><th>Branches</th><th>Status</th>{(canEditDept || (branchScope && canDeleteDept)) && <th>Actions</th>}</tr></thead>
                            <tbody>
                                {departments.length === 0 ? (
                                    <tr><td colSpan={(canEditDept || (branchScope && canDeleteDept)) ? 4 : 3} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        {isDeptLoading
                                            ? 'Loading departments...'
                                            : branchScope
                                                ? `No departments adopted into ${selectedBranchName || 'this branch'} yet. Add some from the Master Catalog.`
                                                : 'No departments adopted into your workshop yet. Add some from the Master Catalog.'}
                                    </td></tr>
                                ) : departments.map(d => {
                                    const isActive = Boolean(d.isActive ?? d.status === 'active');
                                    const masterId = d.departmentId || d.masterId || d.id;
                                    return (
                                        <tr key={d.id}>
                                            <td><strong>{d.name}</strong></td>
                                            <td style={{color:'var(--color-text-muted)'}}>{formatRowBranches(d)}</td>
                                            <td><span className={`ws-badge ${isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>{isActive ? 'active' : 'inactive'}</span></td>
                                            {(canEditDept || (branchScope && canDeleteDept)) && (
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                        {canEditDept && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleDepartmentActive(d)}
                                                                disabled={deptStatusLoadingId === String(masterId)}
                                                                style={{
                                                                    padding: '4px 10px',
                                                                    background: isActive ? '#FFFBEB' : '#ECFDF5',
                                                                    color: isActive ? '#B45309' : '#047857',
                                                                    border: `1px solid ${isActive ? '#FDE68A' : '#A7F3D0'}`,
                                                                    borderRadius: 6,
                                                                    fontWeight: 700,
                                                                    cursor: deptStatusLoadingId === String(masterId) ? 'not-allowed' : 'pointer',
                                                                    fontSize: '0.75rem',
                                                                    opacity: deptStatusLoadingId === String(masterId) ? 0.6 : 1,
                                                                }}
                                                            >
                                                                {deptStatusLoadingId === String(masterId)
                                                                    ? 'Saving…'
                                                                    : isActive
                                                                      ? 'Deactivate'
                                                                      : 'Activate'}
                                                            </button>
                                                        )}
                                                        {branchScope && canDeleteDept && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeDeptFromBranch(masterId)}
                                                                style={{ padding: '4px 10px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}
                                                            >
                                                                Remove from this branch
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </WsTableScroll>
                    </div>
                </div>
            )}

            {activeTab === 'products' && hasPermission('workshop.departments.products.view') && (
                <div>
                    {productsError && (
                        <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                            {productsError}
                        </div>
                    )}
                    <div className="ws-section" style={{marginBottom:16}}>
                        <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',justifyContent:'space-between',padding:16}}>
                            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                                <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--color-border)',fontSize:'0.875rem',minWidth:160}}>
                                    <option value="all">All Departments</option>
                                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <button onClick={()=>setLowStockOnly(!lowStockOnly)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:`1px solid ${lowStockOnly?'#FCA5A5':'var(--color-border)'}`,background:lowStockOnly?'#FEF2F2':'#fff',color:lowStockOnly?'#DC2626':'var(--color-text-muted)',fontWeight:700,fontSize:'0.8125rem',cursor:'pointer'}}>
                                    <AlertTriangle size={14}/> Low Stock Only
                                </button>
                            </div>
                            <div style={{display:'flex',gap:10}}>
                                <button className="btn-portal" onClick={loadProducts} disabled={isProductsLoading}>
                                    <RefreshCw size={14}/> {isProductsLoading ? 'Refreshing...' : 'Refresh'}
                                </button>
                                {canDeleteProduct && (
                                    <button
                                        className="btn-portal"
                                        onClick={() => removeSelectedFromBranch(false)}
                                        disabled={isBulkRemoving || selectedProductIds.length === 0}
                                        style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
                                    >
                                        Remove Selected ({selectedProductIds.length})
                                    </button>
                                )}
                                {canCreateProduct && (
                                    <button className="btn-portal" onClick={() => openAddProd('product')}><Plus size={14}/> Request Product</button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="ws-section">
                        <WsTableScroll>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>
                                            <input
                                                type="checkbox"
                                                checked={allProductRowsSelected}
                                                onChange={toggleAllProductsOnPage}
                                                aria-label="Select all products on page"
                                            />
                                        </th>
                                        <th>Name</th>
                                        <th>SKU</th>
                                        <th>Unit</th>
                                        <th>Sale Price</th>
                                        <th>Purchase Price</th>
                                        {branchScope ? (
                                            <>
                                                <th title="openingQty — set when this branch adopted from catalog; not changed by manual stock adjustments">Opening (adoption)</th>
                                                <th title="currentQty — on hand now (sales, GRN, adjustments); matches opening until an inventory row exists">Current stock</th>
                                            </>
                                        ) : (
                                            <th title="openingQty on workshop/union list (adoption baseline where applicable)">Opening (adoption)</th>
                                        )}
                                        <th>Critical</th>
                                        <th>Branches</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>{productItems.length === 0 ? (
                                    <tr><td colSpan={branchScope ? 11 : 10} style={{padding:40,textAlign:'center',color:'var(--color-text-muted)'}}>{isProductsLoading ? 'Loading products...' : 'No products found'}</td></tr>
                                ) : productItems.map(p => {
                                    const isCritical = p.critical_level && p.stock_qty <= p.critical_level;
                                    const isActive = Boolean(p.isActive ?? p.status === 'active');
                                    return (
                                        <tr key={p.id} style={{background: isCritical ? '#FEF2F2' : undefined, opacity: isActive ? 1 : 0.72}}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProductIds.includes(String(p.sourceId))}
                                                    onChange={() => toggleProductSelection(p.sourceId)}
                                                    aria-label={`Select product ${p.name}`}
                                                />
                                            </td>
                                            <td><strong>{p.name}</strong></td>
                                            <td style={{fontFamily:'monospace',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>{p.sku || '—'}</td>
                                            <td style={{textTransform:'capitalize'}}>{p.unit}</td>
                                            <td>SAR {(p.sale_price||0).toFixed(2)}</td>
                                            <td style={{color:'var(--color-text-muted)'}}>SAR {(p.purchase_price||0).toFixed(2)}</td>
                                            {branchScope ? (
                                                <>
                                                    <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{p.adoption_opening_qty ?? '—'}</td>
                                                    <td><span style={{fontWeight:700,color:isCritical?'#DC2626':'inherit'}}>{p.stock_qty ?? '—'}</span></td>
                                                </>
                                            ) : (
                                                <td><span style={{fontWeight:700,color:isCritical?'#DC2626':'inherit'}}>{p.adoption_opening_qty ?? '—'}</span></td>
                                            )}
                                            <td style={{color:'var(--color-text-muted)'}}>{p.critical_level ?? '—'}</td>
                                            <td style={{color:'var(--color-text-muted)'}}>{formatRowBranches(p)}</td>
                                            <td>
                                                <span className={`ws-badge ${isActive ? (isCritical ? 'ws-badge--red' : 'ws-badge--green') : 'ws-badge--gray'}`}>
                                                    {!isActive ? 'inactive' : isCritical ? '⚠ Critical' : 'active'}
                                                </span>
                                                {canDeleteProduct && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeProductFromBranch(p.sourceId, false)}
                                                        style={{ marginLeft: 8, padding: '4px 10px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}
                                                    >
                                                        {branchScope ? 'Remove' : 'Remove from workshop'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}</tbody>
                            </table>
                        </WsTableScroll>
                    </div>
                </div>
            )}

            {activeTab === 'services' && hasPermission('workshop.departments.services.view') && (
                <div>
                    {productsError && (
                        <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                            {productsError}
                        </div>
                    )}
                    <div className="ws-section" style={{marginBottom:16}}>
                        <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',justifyContent:'space-between',padding:16}}>
                            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                                <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--color-border)',fontSize:'0.875rem',minWidth:160}}>
                                    <option value="all">All Departments</option>
                                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div style={{display:'flex',gap:10}}>
                                <button className="btn-portal" onClick={loadProducts} disabled={isProductsLoading}>
                                    <RefreshCw size={14}/> {isProductsLoading ? 'Refreshing...' : 'Refresh'}
                                </button>
                                {canDeleteService && (
                                    <button
                                        className="btn-portal"
                                        onClick={() => removeSelectedFromBranch(true)}
                                        disabled={isBulkRemoving || selectedServiceIds.length === 0}
                                        style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
                                    >
                                        Remove Selected ({selectedServiceIds.length})
                                    </button>
                                )}
                                {canCreateService && (
                                    <button className="btn-portal" onClick={() => openAddProd('service')}><Plus size={14}/> Request Service</button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="ws-section">
                        <WsTableScroll>
                            <table className="ws-table">
                                <thead><tr><th style={{ width: 44 }}>
                                    <input
                                        type="checkbox"
                                        checked={allServiceRowsSelected}
                                        onChange={toggleAllServicesOnPage}
                                        aria-label="Select all services on page"
                                    />
                                </th><th>Name</th><th>Department</th><th>Sale Price</th><th>Branches</th><th>Status</th></tr></thead>
                                <tbody>{serviceItems.length === 0 ? (
                                    <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'var(--color-text-muted)'}}>{isProductsLoading ? 'Loading services...' : 'No services found'}</td></tr>
                                ) : serviceItems.map(s => {
                                    const isActive = Boolean(s.isActive ?? s.status === 'active');
                                    return (
                                        <tr key={s.id} style={{ opacity: isActive ? 1 : 0.72 }}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedServiceIds.includes(String(s.sourceId))}
                                                    onChange={() => toggleServiceSelection(s.sourceId)}
                                                    aria-label={`Select service ${s.name}`}
                                                />
                                            </td>
                                            <td><strong>{s.name}</strong></td>
                                            <td style={{color:'var(--color-text-muted)'}}>{s.dept || '—'}</td>
                                            <td>SAR {(s.sale_price||0).toFixed(2)}</td>
                                            <td style={{color:'var(--color-text-muted)'}}>{formatRowBranches(s)}</td>
                                            <td>
                                                <span className={`ws-badge ${isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>{isActive ? 'active' : 'inactive'}</span>
                                                {canDeleteService && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeProductFromBranch(s.sourceId, true)}
                                                        style={{ marginLeft: 8, padding: '4px 10px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}
                                                    >
                                                        {branchScope ? 'Remove' : 'Remove from workshop'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}</tbody>
                            </table>
                        </WsTableScroll>
                    </div>
                </div>
            )}

            {activeTab === 'categories' && (
                <div>
                    <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10,marginBottom:16}}>
                        <button className="btn-portal" onClick={loadCategories} disabled={isCategoriesLoading}>
                            <RefreshCw size={14} /> {isCategoriesLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        {canCreateCategory && (
                            <button className="btn-portal" onClick={() => setShowCategoryForm(true)}>
                                <Plus size={14} /> Request Category
                            </button>
                        )}
                    </div>
                    {categoriesError && (
                        <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                            {categoriesError}
                        </div>
                    )}
                    <div className="ws-section">
                        <WsTableScroll>
                            <table className="ws-table">
                                <thead><tr><th>Name</th><th>Type</th><th>Department</th><th>Branches</th><th>Status</th>{branchScope && <th>Actions</th>}</tr></thead>
                                <tbody>
                                    {categories.length === 0 ? (
                                        <tr><td colSpan={branchScope ? 6 : 5} style={{padding:40,textAlign:'center',color:'var(--color-text-muted)'}}>
                                            {isCategoriesLoading
                                                ? 'Loading categories...'
                                                : branchScope
                                                    ? `No categories adopted into ${selectedBranchName || 'this branch'} yet.`
                                                    : 'No categories adopted into your workshop yet.'}
                                        </td></tr>
                                    ) : categories.map((category) => {
                                        const masterId = category.categoryId || category.masterId || category.id;
                                        const isActive = Boolean(category.isActive ?? category.status === 'active');
                                        return (
                                            <tr key={category.id}>
                                                <td><strong>{category.name}</strong></td>
                                                <td><span className="ws-badge ws-badge--gray">{category.type || '—'}</span></td>
                                                <td>{category.departmentName || '—'}</td>
                                                <td style={{color:'var(--color-text-muted)'}}>{formatRowBranches(category)}</td>
                                                <td>
                                                    <span className={`ws-badge ${isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                                        {isActive ? 'active' : 'inactive'}
                                                    </span>
                                                </td>
                                                {branchScope && (
                                                    <td>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeCategoryFromBranch(masterId)}
                                                            style={{ padding: '4px 10px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}
                                                        >
                                                            Remove from this branch
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </WsTableScroll>
                    </div>
                </div>
            )}

        </div>
    );
}
