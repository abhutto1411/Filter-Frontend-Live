import { useState, useEffect } from 'react';
import { useParams, NavLink, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, FileText, TrendingUp, TrendingDown, Minus, Search, Folder, Layers, Loader } from 'lucide-react';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import MasterCatalog from '../../components/admin/MasterCatalog';
import StockMovementsSuperAdmin from '../../components/admin/StockMovementsSuperAdmin';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/InventoryPage.css';
import '../../styles/ui.css';
import { smT, SM_INV_SUB_LABEL_KEYS } from '../../utils/stockMovementsI18n';
import { getProducts, getServices, createProduct, createService, updateProduct, updateService } from '../../services/superAdminApi';
import {
    findFirstNegativeMoneyField,
    NON_NEGATIVE_MONEY_INPUT_ATTRS,
    parseNonNegativeNumberOr,
    sanitizeNonNegativeMoneyInput,
} from '../../utils/nonNegativeMoney';

const SUB_TABS = [
    { path: 'master-catalog',   label: 'Master Catalog',    permission: 'inventory.master-catalog.view' },
    { path: 'stock-movements',  label: 'Stock Movements',   permission: 'inventory.stock-movements.view' },
    { path: 'units-of-measure', label: 'Units of Measure',  permission: 'inventory.units-of-measure.view' },
];

/** The categories a unit of measure can belong to — the filter row and the
 *  "Categories" count are both read from this one list. */
const UOM_CATEGORIES = ['quantity', 'volume', 'weight', 'length', 'service'];


const VALID_INVENTORY_SUB_PATHS = SUB_TABS.map((t) => t.path);


const MOCK_DEPARTMENTS = [
    { id: 1, name: 'Car Wash Services', description: '—', status: 'Active' },
    { id: 2, name: 'Oil Change', description: '—', status: 'Active' },
];

const MOCK_CATEGORIES = [
    { id: 1, name: 'Car Wash VIP', department: 'Car Wash Services', description: '—', status: 'Active' },
    { id: 2, name: 'Car Wash Normal', department: 'Car Wash Services', description: '—', status: 'Active' },
    { id: 3, name: 'Oil Change Service', department: 'Oil Change', description: '—', status: 'Active' },
    { id: 4, name: 'Castrol', department: 'Oil Change', description: '—', status: 'Active' },
];

const MOCK_UOM = [
    { id: 1, name: 'Box', abbreviation: 'box', category: 'Box / carton', description: 'Box / carton', status: 'active' },
    { id: 2, name: 'Liter', abbreviation: 'L', category: 'volume', description: 'Liter of liquid', status: 'active' },
    { id: 3, name: 'Kilogram', abbreviation: 'kg', category: 'weight', description: 'Kilogram', status: 'active' },
    { id: 4, name: 'Piece', abbreviation: 'pcs', category: 'quantity', description: 'Single unit / piece', status: 'active' },
    { id: 5, name: 'Service', abbreviation: 'svc', category: 'service', description: 'Service unit', status: 'active' },
];

export default function InventoryPage() {
    const { subTab } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { hasPermission } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale = outletCtx.locale || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const visibleSubTabs = SUB_TABS.filter((t) => hasPermission(t.permission));
    const normalizedSubTab =
        subTab && subTab.replace(/\s+/g, '-').toLowerCase() !== subTab
            ? subTab.replace(/\s+/g, '-').toLowerCase()
            : subTab;
    const isMasterCatalogPath = location.pathname.startsWith('/admin/inventory/master-catalog');
    const activeSub = isMasterCatalogPath
        ? 'master-catalog'
        : (VALID_INVENTORY_SUB_PATHS.includes(normalizedSubTab)
            ? normalizedSubTab
            : (subTab || 'master-catalog'));

    const isInventorySubTabActive = (path) => {
        if (path === 'master-catalog') {
            return location.pathname.startsWith('/admin/inventory/master-catalog');
        }
        const base = `/admin/inventory/${path}`;
        return location.pathname === base || location.pathname.startsWith(`${base}/`);
    };

    useEffect(() => {
        if (!subTab) return;
        if (VALID_INVENTORY_SUB_PATHS.includes(subTab)) return;
        const fixed = subTab.replace(/\s+/g, '-').toLowerCase();
        if (VALID_INVENTORY_SUB_PATHS.includes(fixed)) {
            navigate(`/admin/inventory/${fixed}`, { replace: true });
        }
    }, [subTab, navigate]);
    const [viewTab, setViewTab] = useState('Products');
    const [products, setProducts] = useState([]);
    const [typeFilter, setTypeFilter] = useState('All');
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [saving, setSaving] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const normalizeItem = (item, type) => ({
        id: item.id ?? item._id,
        name: item.name ?? '—',
        sku: item.sku ?? 'No SKU',
        type: type ?? (item.type === 'service' ? 'service' : 'product'),
        dept: item.departmentName ?? item.department?.name ?? '—',
        unit: item.unit ?? '—',
        price: String(item.salePrice ?? item.sellingPrice ?? item.price ?? '0'),
        status: item.isActive === false ? 'inactive' : 'active',
    });

    const reloadProducts = async () => {
        const [prods, svcs] = await Promise.all([
            getProducts().catch(() => []),
            getServices().catch(() => []),
        ]);
        const p = (Array.isArray(prods) ? prods : (prods?.products ?? [])).map((i) => normalizeItem(i, 'product'));
        const s = (Array.isArray(svcs) ? svcs : (svcs?.services ?? [])).map((i) => normalizeItem(i, 'service'));
        setProducts([...p, ...s]);
    };

    useEffect(() => {
        reloadProducts()
            .catch(() => {})
            .finally(() => setLoadingProducts(false));
    }, []);
    const [newProduct, setNewProduct] = useState({
        type: 'product',
        name: '',
        sku: '',
        category: '',
        primaryUnit: 'Piece',
        status: 'Active',
        departments: [],
        conversionRules: [],
        purchasePrice: '0.00',
        salePrice: '0.00',
        priceEditable: false,
        corporatePricing: { base: '0.00', lower: '0.00', upper: '0.00' },
        initialStock: '0.0000',
        criticalStock: '0.00',
        reorderLevel: '0.00',
        description: ''
    });

    const addConversionRule = () => {
        setNewProduct(prev => ({
            ...prev,
            conversionRules: [...prev.conversionRules, { unit: '', multiplier: '' }]
        }));
    };

    const toggleDept = (dept) => {
        setNewProduct(prev => ({
            ...prev,
            departments: prev.departments.includes(dept)
                ? prev.departments.filter(d => d !== dept)
                : [...prev.departments, dept]
        }));
    };

    const [editOpen, setEditOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [departments, setDepartments] = useState(MOCK_DEPARTMENTS);
    const [categories, setCategories] = useState(MOCK_CATEGORIES);
    const [innerTab, setInnerTab] = useState('Departments');
    const [newDeptOpen, setNewDeptOpen] = useState(false);
    const [editDeptOpen, setEditDeptOpen] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [newCategoryOpen, setNewCategoryOpen] = useState(false);
    const [editCategoryOpen, setEditCategoryOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [uomList, setUomList] = useState(MOCK_UOM);
    const [newUomOpen, setNewUomOpen] = useState(false);
    const [editUomOpen, setEditUomOpen] = useState(false);
    const [editingUom, setEditingUom] = useState(null);
    const [uomCategoryFilter, setUomCategoryFilter] = useState('all');

    const closeUomScreen = () => {
        setNewUomOpen(false);
        setEditUomOpen(false);
        setEditingUom(null);
    };
    const uomField = (key) => (editUomOpen ? editingUom?.[key] : uomForm[key]) ?? '';
    const setUomField = (key, value) => (editUomOpen
        ? setEditingUom((prev) => ({ ...prev, [key]: value }))
        : setUomForm((prev) => ({ ...prev, [key]: value })));

    const uomActiveCount = uomList.filter((u) => u.status === 'active').length;
    const visibleUoms = uomList.filter(
        (u) => uomCategoryFilter === 'all' || u.category === uomCategoryFilter,
    );
    const uomPaging = usePagedRows(visibleUoms, { resetKey: uomCategoryFilter });

    const [uomForm, setUomForm] = useState({
        name: '',
        abbreviation: '',
        category: 'quantity',
        description: '',
        status: 'active'
    });

    const itemCount = products.length;
    const selectedCategory = categories.find((c) => c.name === newProduct.category);
    const selectedDepartment = departments.find((d) => d.name === newProduct.departments[0]);

    const openEdit = (p) => {
        setEditingProduct({ ...p });
        setEditOpen(true);
    };
    const handleSaveNew = async () => {
        const priceErr = findFirstNegativeMoneyField([
            { label: 'Purchase price', value: newProduct.purchasePrice },
            { label: 'Sale price', value: newProduct.salePrice },
            { label: 'Corporate base price', value: newProduct.corporatePricing?.base },
            { label: 'Corporate lower limit', value: newProduct.corporatePricing?.lower },
            { label: 'Corporate upper limit', value: newProduct.corporatePricing?.upper },
        ]);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        setSaving(true);
        try {
            if (newProduct.type === 'service') {
                await createService({
                    departmentId: selectedDepartment?.id ? String(selectedDepartment.id) : undefined,
                    categoryId: selectedCategory?.id ? String(selectedCategory.id) : undefined,
                    name: newProduct.name,
                    sku: newProduct.sku || undefined,
                    description: newProduct.description || undefined,
                    unitOfMeasurement: newProduct.primaryUnit,
                    sellingPrice: parseNonNegativeNumberOr(newProduct.salePrice, 0),
                    isPriceEditable: newProduct.priceEditable,
                    minPriceCorporate: parseNonNegativeNumberOr(newProduct.corporatePricing.lower, 0),
                    maxPriceCorporate: parseNonNegativeNumberOr(newProduct.corporatePricing.upper, 0),
                });
            } else {
                await createProduct({
                    departmentId: selectedDepartment?.id ? String(selectedDepartment.id) : undefined,
                    categoryId: selectedCategory?.id ? String(selectedCategory.id) : undefined,
                    name: newProduct.name,
                    sku: newProduct.sku || undefined,
                    brandName: undefined,
                    description: newProduct.description || undefined,
                    unit: newProduct.primaryUnit,
                    purchasePrice: parseNonNegativeNumberOr(newProduct.purchasePrice, 0),
                    salePrice: parseNonNegativeNumberOr(newProduct.salePrice, 0),
                    allowDecimalQty: false,
                    minPriceCorporate: parseNonNegativeNumberOr(newProduct.corporatePricing.lower, 0),
                    maxPriceCorporate: parseNonNegativeNumberOr(newProduct.corporatePricing.upper, 0),
                });
            }
            await reloadProducts();
            setCreateOpen(false);
            setNewProduct({ type: 'product', name: '', sku: '', category: '', primaryUnit: 'Piece', status: 'Active', departments: [], conversionRules: [], purchasePrice: '0.00', salePrice: '0.00', priceEditable: false, corporatePricing: { base: '0.00', lower: '0.00', upper: '0.00' }, initialStock: '0.0000', criticalStock: '0.00', reorderLevel: '0.00', description: '' });
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };
    const handleSaveEdit = async () => {
        if (!editingProduct) return;
        const priceErr = findFirstNegativeMoneyField([
            { label: 'Sale price', value: editingProduct.price },
        ]);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: editingProduct.name,
                salePrice: parseNonNegativeNumberOr(editingProduct.price, 0),
                isActive: editingProduct.status === 'active',
            };
            if (editingProduct.type === 'service') {
                await updateService(editingProduct.id, body);
            } else {
                await updateProduct(editingProduct.id, body);
            }
            await reloadProducts();
            setEditOpen(false);
            setEditingProduct(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveUom = () => {
        if (editingUom) {
            setUomList((prev) => prev.map((u) => (u.id === editingUom.id ? { ...editingUom } : u)));
            setEditUomOpen(false);
            setEditingUom(null);
        } else {
            const id = Date.now();
            setUomList((prev) => [...prev, { id, ...uomForm }]);
            setNewUomOpen(false);
            setUomForm({ name: '', abbreviation: '', category: 'quantity', description: '', status: 'active' });
        }
    };

    const handleDeleteUom = (id) => {
        if (window.confirm('Are you sure you want to delete this unit of measure?')) {
            setUomList((prev) => prev.filter((u) => u.id !== id));
        }
    };

    const openEditUom = (u) => {
        setEditingUom({ ...u });
        setEditUomOpen(true);
    };

    if (createOpen || editOpen || newDeptOpen || editDeptOpen || newCategoryOpen || editCategoryOpen || newUomOpen || editUomOpen) {
    return (
            <>
                        {createOpen && (
                            <AdminModalAsScreen
                                title="Add New Product / Service"
                                onClose={() => setCreateOpen(false)}
                                className="product-redesign-modal"
                                footer={
                                    <>
                                        <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                                        <button type="button" className="btn-submit" onClick={handleSaveNew} disabled={saving}>{saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Create Product'}</button>
                                    </>
                                }
                            >
                                <div className="product-form-container">
                                    {/* Basic Information Section */}
                                    <div className="form-section">
                                        <h4 className="section-title">Basic Information</h4>
                                        <div className="form-group">
                                            <label className="form-label">Type *</label>
                                            <div className="type-toggle-group">
                                                <button
                                                    type="button"
                                                    className={`type-toggle-btn ${newProduct.type === 'product' ? 'active' : ''}`}
                                                    onClick={() => setNewProduct({ ...newProduct, type: 'product' })}
                                                >
                                                    product
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`type-toggle-btn ${newProduct.type === 'service' ? 'active' : ''}`}
                                                    onClick={() => setNewProduct({ ...newProduct, type: 'service' })}
                                                >
                                                    service
                                                </button>
                                            </div>
                                        </div>

                                        <div className="section-grid">
                                            <div className="form-group">
                                                <label className="form-label">Name *</label>
                                                <input
                                                    type="text"
                                                    className="form-input-field"
                                                    placeholder="Product name"
                                                    value={newProduct.name}
                                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">SKU</label>
                                                <input
                                                    type="text"
                                                    className="form-input-field"
                                                    placeholder="Optional SKU"
                                                    value={newProduct.sku}
                                                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="section-grid">
                                            <div className="form-group">
                                                <label className="form-label">Category</label>
                                                <select
                                                    className="form-input-field"
                                                    value={newProduct.category}
                                                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                                                >
                                                    <option value="">Select category</option>
                                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Primary Unit *</label>
                                                <select
                                                    className="form-input-field"
                                                    value={newProduct.primaryUnit}
                                                    onChange={(e) => setNewProduct({ ...newProduct, primaryUnit: e.target.value })}
                                                >
                                                    <option value="Piece">Piece</option>
                                                    <option value="Liter">Liter</option>
                                                    <option value="Box">Box</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="section-grid">
                                            <div className="form-group">
                                                <label className="form-label">Status</label>
                                                <select
                                                    className="form-input-field"
                                                    value={newProduct.status}
                                                    onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value })}
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-group" style={{ marginTop: '16px' }}>
                                            <label className="form-label">Department(s) * – select at least one</label>
                                            <div className="dept-checkbox-group">
                                                {['Car Wash Services', 'Oil Change'].map(dept => (
                                                    <label key={dept} className="dept-checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={newProduct.departments.includes(dept)}
                                                            onChange={() => toggleDept(dept)}
                                                        />
                                                        {dept}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Unit Conversion Rules Section */}
                                    <div className="form-section">
                                        <h4 className="section-title">Unit Conversion Rules</h4>
                                        <p className="hint-text" style={{ marginBottom: '16px' }}>
                                            Suppliers deliver in different units (Box, Drum). Define conversion to your primary unit.
                                        </p>
                                        <div className="conversion-rules-list">
                                            {newProduct.conversionRules.map((_rule, idx) => (
                                                <div key={idx} className="rule-item-row">
                                                    <div className="rule-field-group">
                                                        <label className="rule-field-label">Purchase Unit</label>
                                                        <select className="form-input-field">
                                                            <option value="box">box</option>
                                                            <option value="drum">drum</option>
                                                            <option value="carton">carton</option>
                                                        </select>
                                                    </div>
                                                    <div className="rule-separator">=</div>
                                                    <div className="rule-field-group">
                                                        <label className="rule-field-label">Qty in {newProduct.primaryUnit.toLowerCase()}</label>
                                                        <div className="rule-input-wrapper">
                                                            <input type="number" className="form-input-field" placeholder="e.g. 20" />
                                                            <span className="rule-unit-suffix">{newProduct.primaryUnit}</span>
                                                        </div>
                                                    </div>
                                                    <button type="button" className="btn-delete-rule" onClick={() => {
                                                        const rules = [...newProduct.conversionRules];
                                                        rules.splice(idx, 1);
                                                        setNewProduct({ ...newProduct, conversionRules: rules });
                                                    }}><Trash2 size={18} /></button>
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" className="btn-add-rule" onClick={addConversionRule}>
                                            <Plus size={14} /> Add Conversion Rule
                                        </button>
                                    </div>

                                    {/* Pricing Section */}
                                    <div className="form-section">
                                        <h4 className="section-title">Pricing</h4>
                                        <div className="section-grid">
                                            <div className="form-group">
                                                <label className="form-label">Purchase Price excl. VAT</label>
                                                <input
                                                    {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                                    className="form-input-field"
                                                    value={newProduct.purchasePrice}
                                                    onChange={(e) =>
                                                        setNewProduct({
                                                            ...newProduct,
                                                            purchasePrice: sanitizeNonNegativeMoneyInput(e.target.value),
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Sale Price incl. 15% VAT</label>
                                                <input
                                                    {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                                    className="form-input-field"
                                                    value={newProduct.salePrice}
                                                    onChange={(e) =>
                                                        setNewProduct({
                                                            ...newProduct,
                                                            salePrice: sanitizeNonNegativeMoneyInput(e.target.value),
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className="price-editable-toggle" style={{ marginTop: '16px' }}>
                                            <label className="switch">
                                                <input
                                                    type="checkbox"
                                                    checked={newProduct.priceEditable}
                                                    onChange={(e) => setNewProduct({ ...newProduct, priceEditable: e.target.checked })}
                                                />
                                                <span className="slider"></span>
                                            </label>
                                            <div style={{ marginLeft: '12px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Price Editable at Invoice</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Corporate Pricing Section */}
                                    <div className="form-section">
                                        <h4 className="section-title">Corporate Pricing (optional)</h4>
                                        <div className="section-grid">
                                            <div className="form-group">
                                                <label className="form-label">Base Price</label>
                                                <input
                                                    {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                                    className="form-input-field"
                                                    value={newProduct.corporatePricing.base}
                                                    onChange={(e) =>
                                                        setNewProduct({
                                                            ...newProduct,
                                                            corporatePricing: {
                                                                ...newProduct.corporatePricing,
                                                                base: sanitizeNonNegativeMoneyInput(e.target.value),
                                                            },
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Lower Limit</label>
                                                <input
                                                    {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                                    className="form-input-field"
                                                    value={newProduct.corporatePricing.lower}
                                                    onChange={(e) =>
                                                        setNewProduct({
                                                            ...newProduct,
                                                            corporatePricing: {
                                                                ...newProduct.corporatePricing,
                                                                lower: sanitizeNonNegativeMoneyInput(e.target.value),
                                                            },
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Upper Limit</label>
                                                <input
                                                    {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                                    className="form-input-field"
                                                    value={newProduct.corporatePricing.upper}
                                                    onChange={(e) =>
                                                        setNewProduct({
                                                            ...newProduct,
                                                            corporatePricing: {
                                                                ...newProduct.corporatePricing,
                                                                upper: sanitizeNonNegativeMoneyInput(e.target.value),
                                                            },
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inventory Settings Section */}
                                    <div className="form-section">
                                        <h4 className="section-title">Inventory Settings</h4>
                                        <div className="form-group">
                                            <label className="form-label">Initial Stock Quantity</label>
                                            <input
                                                type="number"
                                                className="form-input-field"
                                                value={newProduct.initialStock}
                                                onChange={(e) => setNewProduct({ ...newProduct, initialStock: e.target.value })}
                                            />
                                        </div>
                                        <div className="section-grid">
                                            <div className="form-group">
                                                <label className="form-label">Critical Stock Level</label>
                                                <input
                                                    type="number"
                                                    className="form-input-field"
                                                    value={newProduct.criticalStock}
                                                    onChange={(e) => setNewProduct({ ...newProduct, criticalStock: e.target.value })}
                                                />
                                                <div className="hint-text">Alert when ≤ this</div>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Reorder Level</label>
                                                <input
                                                    type="number"
                                                    className="form-input-field"
                                                    value={newProduct.reorderLevel}
                                                    onChange={(e) => setNewProduct({ ...newProduct, reorderLevel: e.target.value })}
                                                />
                                                <div className="hint-text">Suggested reorder</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Media & Metadata Section */}
                                    <div className="form-section">
                                        <h4 className="section-title">Media & Metadata</h4>
                                        <div className="form-group">
                                            <label className="form-label">Product Image</label>
                                            <div className="image-upload-area">
                                                <Plus size={24} />
                                                <div className="upload-text">Upload Image</div>
                                                <div className="upload-hint">Max 2MB, JPG/PNG</div>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Description</label>
                                            <textarea
                                                className="form-input-field"
                                                rows="3"
                                                placeholder="Optional product description"
                                                value={newProduct.description}
                                                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                                style={{ resize: 'none', height: 'auto', padding: '12px' }}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                            </AdminModalAsScreen>
                        )}

                        {editOpen && editingProduct && (
                            <AdminModalAsScreen
                                title="Edit Product"
                                onClose={() => { setEditOpen(false); setEditingProduct(null); }}
                                footer={
                                    <>
                                        <button type="button" className="btn-secondary" onClick={() => { setEditOpen(false); setEditingProduct(null); }}>Cancel</button>
                                        <button type="button" className="btn-submit" onClick={handleSaveEdit} disabled={saving}>{saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Save Changes'}</button>
                                    </>
                                }
                            >
                                <div className="form-group">
                                    <label className="form-label">Product / Service Name</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingProduct.name}
                                        onChange={(e) => setEditingProduct((p) => ({ ...p, name: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SKU</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingProduct.sku}
                                        onChange={(e) => setEditingProduct((p) => ({ ...p, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Type</label>
                                        <select className="form-input-field" value={editingProduct.type} onChange={(e) => setEditingProduct((p) => ({ ...p, type: e.target.value }))}>
                                            <option value="product">Product</option><option value="service">Service</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unit</label>
                                        <input
                                            type="text"
                                            className="form-input-field"
                                            value={editingProduct.unit}
                                            onChange={(e) => setEditingProduct((p) => ({ ...p, unit: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Department</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingProduct.dept}
                                        onChange={(e) => setEditingProduct((p) => ({ ...p, dept: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sale Price (SAR)</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        className="form-input-field"
                                        value={editingProduct.price}
                                        onChange={(e) =>
                                            setEditingProduct((p) => ({
                                                ...p,
                                                price: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input-field" value={editingProduct.status} onChange={(e) => setEditingProduct((p) => ({ ...p, status: e.target.value }))}>
                                        <option value="active">Active</option><option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </AdminModalAsScreen>
                        )}
                        {/* New Department Modal */}
                        {newDeptOpen && (
                            <AdminModalAsScreen
                                title="Add Department"
                                onClose={() => setNewDeptOpen(false)}
                                footer={
                                    <>
                                        <button type="button" className="btn-secondary" onClick={() => setNewDeptOpen(false)}>Cancel</button>
                                        <button type="button" className="btn-submit" onClick={() => { setDepartments((prev) => [...prev, { id: Date.now(), name: 'New Dept', description: '—', status: 'Active' }]); setNewDeptOpen(false); }}>Save</button>
                                    </>
                                }
                            >
                                <div className="form-group"><label className="form-label">Name *</label><input type="text" className="form-input-field" placeholder="Department name" /></div>
                                <div className="form-group"><label className="form-label">Description</label><textarea className="form-input-field" rows="3" placeholder="Department description" style={{ height: 'auto', padding: '12px' }}></textarea></div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input-field"><option>Active</option><option>Inactive</option></select>
                                </div>
                            </AdminModalAsScreen>
                        )}

                        {/* Edit Department Modal */}
                        {editDeptOpen && editingDept && (
                            <AdminModalAsScreen
                                title="Edit Department"
                                onClose={() => { setEditDeptOpen(false); setEditingDept(null); }}
                                footer={
                                    <>
                                        <button type="button" className="btn-secondary" onClick={() => { setEditDeptOpen(false); setEditingDept(null); }}>Cancel</button>
                                        <button type="button" className="btn-submit" onClick={() => { setDepartments((prev) => prev.map((d) => (d.id === editingDept.id ? { ...editingDept } : d))); setEditDeptOpen(false); setEditingDept(null); }}>Save</button>
                                    </>
                                }
                            >
                                <div className="form-group">
                                    <label className="form-label">Name *</label>
                                    <input type="text" className="form-input-field" value={editingDept.name} onChange={(e) => setEditingDept((p) => ({ ...p, name: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-input-field" rows="3" value={editingDept.description} onChange={(e) => setEditingDept((p) => ({ ...p, description: e.target.value }))} style={{ height: 'auto', padding: '12px' }}></textarea>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input-field" value={editingDept.status} onChange={(e) => setEditingDept((p) => ({ ...p, status: e.target.value }))}>
                                        <option>Active</option><option>Inactive</option>
                                    </select>
                                </div>
                            </AdminModalAsScreen>
                        )}

                        {/* New Category Modal */}
                        {newCategoryOpen && (
                            <AdminModalAsScreen
                                title="Add Category"
                                onClose={() => setNewCategoryOpen(false)}
                                footer={
                                    <>
                                        <button type="button" className="btn-secondary" onClick={() => setNewCategoryOpen(false)}>Cancel</button>
                                        <button type="button" className="btn-submit" onClick={() => { setCategories((prev) => [...prev, { id: Date.now(), name: 'New Category', department: 'Car Wash Services', description: '—', status: 'Active' }]); setNewCategoryOpen(false); }}>Save</button>
                                    </>
                                }
                            >
                                <div className="form-group"><label className="form-label">Name *</label><input type="text" className="form-input-field" placeholder="Category name" /></div>
                                <div className="form-group">
                                    <label className="form-label">Department</label>
                                    <select className="form-input-field">
                                        <option value="">Select department</option>
                                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Description</label><textarea className="form-input-field" rows="3" placeholder="Category description" style={{ height: 'auto', padding: '12px' }}></textarea></div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input-field"><option>Active</option><option>Inactive</option></select>
                                </div>
                            </AdminModalAsScreen>
                        )}

                        {/* Edit Category Modal */}
                        {editCategoryOpen && editingCategory && (
                            <AdminModalAsScreen
                                title="Edit Category"
                                onClose={() => { setEditCategoryOpen(false); setEditingCategory(null); }}
                                footer={
                                    <>
                                        <button type="button" className="btn-secondary" onClick={() => { setEditCategoryOpen(false); setEditingCategory(null); }}>Cancel</button>
                                        <button type="button" className="btn-submit" onClick={() => { setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? { ...editingCategory } : c))); setEditCategoryOpen(false); setEditingCategory(null); }}>Save</button>
                                    </>
                                }
                            >
                                <div className="form-group"><label className="form-label">Name *</label><input type="text" className="form-input-field" value={editingCategory.name} onChange={(e) => setEditingCategory((p) => ({ ...p, name: e.target.value }))} /></div>
                                <div className="form-group">
                                    <label className="form-label">Department</label>
                                    <select className="form-input-field" value={editingCategory.department} onChange={(e) => setEditingCategory((p) => ({ ...p, department: e.target.value }))}>
                                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Description</label><textarea className="form-input-field" rows="3" value={editingCategory.description} onChange={(e) => setEditingCategory((p) => ({ ...p, description: e.target.value }))} style={{ height: 'auto', padding: '12px' }}></textarea></div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input-field" value={editingCategory.status} onChange={(e) => setEditingCategory((p) => ({ ...p, status: e.target.value }))}>
                                        <option>Active</option><option>Inactive</option>
                                    </select>
                                </div>
                            </AdminModalAsScreen>
                        )}
                        {(newUomOpen || editUomOpen) && (
                            <AdminModalAsScreen
                                title={editUomOpen ? 'Edit Unit of Measure' : 'New Unit of Measure'}
                                onClose={closeUomScreen}
                                footer={
                                    <div className="ui-panel-end">
                                        <button type="button" className="ui-btn ui-btn--default" onClick={closeUomScreen}>
                                            Cancel
                                        </button>
                                        <button type="button" className="ui-btn ui-btn--primary" onClick={handleSaveUom}>
                                            {editUomOpen ? 'Save Changes' : 'Create UOM'}
                                        </button>
                                    </div>
                                }
                            >
                                {/* One form backs both screens: `uomField` reads and writes
                                    whichever of the two states is open. */}
                                <div className="ui-form-grid">
                                    <div className="ui-field ui-col-6">
                                        <label htmlFor="uom-name">Name *</label>
                                        <input
                                            id="uom-name"
                                            type="text"
                                            className="ui-input"
                                            placeholder="e.g. Kilogram"
                                            value={uomField('name')}
                                            onChange={(e) => setUomField('name', e.target.value)}
                                        />
                                    </div>
                                    <div className="ui-field ui-col-6">
                                        <label htmlFor="uom-abbr">Abbreviation *</label>
                                        <input
                                            id="uom-abbr"
                                            type="text"
                                            className="ui-input"
                                            placeholder="e.g. kg"
                                            value={uomField('abbreviation')}
                                            onChange={(e) => setUomField('abbreviation', e.target.value)}
                                        />
                                    </div>
                                    <div className="ui-field ui-col-6">
                                        <label htmlFor="uom-category">Category</label>
                                        <select
                                            id="uom-category"
                                            className="ui-select"
                                            value={uomField('category')}
                                            onChange={(e) => setUomField('category', e.target.value)}
                                        >
                                            {UOM_CATEGORIES.map((cat) => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ui-field ui-col-6">
                                        <label htmlFor="uom-status">Status</label>
                                        <select
                                            id="uom-status"
                                            className="ui-select"
                                            value={uomField('status')}
                                            onChange={(e) => setUomField('status', e.target.value)}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                    <div className="ui-field ui-col-12">
                                        <label htmlFor="uom-description">Description</label>
                                        <input
                                            id="uom-description"
                                            type="text"
                                            className="ui-input"
                                            placeholder="Optional description"
                                            value={uomField('description')}
                                            onChange={(e) => setUomField('description', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </AdminModalAsScreen>
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
                        to={`/admin/inventory/${tab.path}`}
                        role="tab"
                        aria-selected={isInventorySubTabActive(tab.path)}
                        className="ui-tab"
                    >
                        {smT(locale, SM_INV_SUB_LABEL_KEYS[tab.path] || tab.label)}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'master-catalog' && <MasterCatalog />}

            {activeSub === 'products-services' && (
                <>
                    <header className="products-page-header">
                        <div>
                            <h1 className="products-title">Products & Services</h1>
                            <p className="products-count">{itemCount} items in inventory</p>
                        </div>
                        <button type="button" className="btn-portal" onClick={() => setCreateOpen(true)}><Plus size={16} /> Add Product / Service</button>
                    </header>

                    <div className="products-view-tabs" style={{ marginBottom: '24px' }}>
                        <button type="button" className={`products-view-tab ${viewTab === 'Products' ? 'active' : ''}`} onClick={() => setViewTab('Products')}>
                            <Package size={14} /> Products
                        </button>
                        <button type="button" className={`products-view-tab ${viewTab === 'Inventory Log' ? 'active' : ''}`} onClick={() => setViewTab('Inventory Log')}>
                            <FileText size={14} /> Inventory Log
                        </button>
                    </div>


                    {viewTab === 'Products' && (
                        <>
                            <div className="products-filters">
                                {['All', 'product', 'service'].map((f) => (
                                    <button
                                        key={f}
                                        type="button"
                                        className={`products-filter-pill ${typeFilter === f ? 'active' : ''}`}
                                        onClick={() => setTypeFilter(f)}
                                    >
                                        {f === 'All' ? 'All Types' : f === 'product' ? 'Products' : 'Services'}
                                    </button>
                                ))}
                            </div>
                            <section className="premium-table products-table">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr className="table-header-row">
                                            <th className="table-th">Product</th>
                                            <th className="table-th">Type</th>
                                            <th className="table-th">Department(s)</th>
                                            <th className="table-th">Unit</th>
                                            <th className="table-th">Sale Price (incl. VAT)</th>
                                            <th className="table-th">Stock / Critical</th>
                                            <th className="table-th">Status</th>
                                            <th className="table-th">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingProducts ? (
                                            <tr><td colSpan={8} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                                        ) : products
                                            .filter((p) => typeFilter === 'All' || p.type === typeFilter)
                                            .map((p) => (
                                            <tr key={p.id} className="table-row">
                                                <td className="table-cell">
                                                    <div className="cell-main-text">{p.name}</div>
                                                    <div className="cell-sub-text">{p.sku || 'No SKU'}</div>
                                                </td>
                                                <td className="table-cell"><span style={{ textTransform: 'capitalize' }}>{p.type}</span></td>
                                                <td className="table-cell">{p.dept}</td>
                                                <td className="table-cell">{p.unit}</td>
                                                <td className="table-cell font-bold">SAR {p.price}</td>
                                                <td className="table-cell">N/A</td>
                                                <td className="table-cell"><span className={`status-badge ${p.status === 'Active' ? 'status-completed' : 'status-warning'}`}>{p.status}</span></td>
                                                <td className="table-cell">
                                                    <button type="button" className="btn-edit" onClick={() => openEdit(p)}><Pencil size={14} /> Edit</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        </>
                    )}

                    {viewTab === 'Inventory Log' && (
                        <div className="inventory-log-dashboard">
                            {/* Filter Bar */}
                            <div className="log-filters-card">
                                <div className="log-filter-group">
                                    <label className="log-filter-label">From Date</label>
                                    <input type="date" className="form-input-field" defaultValue="2026-03-02" />
                                </div>
                                <div className="log-filter-group">
                                    <label className="log-filter-label">To Date</label>
                                    <input type="date" className="form-input-field" defaultValue="2026-03-05" />
                                </div>
                                <div className="log-filter-group">
                                    <label className="log-filter-label">Product</label>
                                    <select className="form-input-field">
                                        <option>All Products</option>
                                    </select>
                                </div>
                                <div className="log-filter-group">
                                    <label className="log-filter-label">Movement Type</label>
                                    <select className="form-input-field">
                                        <option>All Types</option>
                                    </select>
                                </div>
                            </div>

                            {/* Summary Cards */}
                            <div className="log-summary-cards">
                                <div className="log-summary-card success">
                                    <div className="log-summary-icon"><TrendingUp size={24} /></div>
                                    <div className="log-summary-content">
                                        <div className="log-summary-label">Total In</div>
                                        <div className="log-summary-value">+0.0</div>
                                    </div>
                                </div>
                                <div className="log-summary-card danger">
                                    <div className="log-summary-icon"><TrendingDown size={24} /></div>
                                    <div className="log-summary-content">
                                        <div className="log-summary-label">Total Out</div>
                                        <div className="log-summary-value">-7.0</div>
                                    </div>
                                </div>
                                <div className="log-summary-card warning">
                                    <div className="log-summary-icon"><Minus size={24} /></div>
                                    <div className="log-summary-content">
                                        <div className="log-summary-label">Net Movement</div>
                                        <div className="log-summary-value">-7.0</div>
                                    </div>
                                </div>
                            </div>

                            {/* Log Table */}
                            <div className="log-table-container premium-table">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr className="table-header-row">
                                            <th className="table-th">Date</th>
                                            <th className="table-th">Product</th>
                                            <th className="table-th">Type</th>
                                            <th className="table-th">Stock In</th>
                                            <th className="table-th">Stock Out</th>
                                            <th className="table-th">Balance After</th>
                                            <th className="table-th">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="table-row">
                                            <td className="table-cell">Feb 28, 2026</td>
                                            <td className="table-cell">
                                                <div className="product-cell-with-icon">
                                                    <div className="product-mini-icon"><Package size={14} /></div>
                                                    <div className="cell-main-text">Castrol 10W30</div>
                                                </div>
                                            </td>
                                            <td className="table-cell"><span className="badge-sale">Sale</span></td>
                                            <td className="table-cell" style={{ color: '#9CA3AF' }}>—</td>
                                            <td className="table-cell"><span className="stock-out-val"> -7 liter</span></td>
                                            <td className="table-cell font-bold">17</td>
                                            <td className="table-cell" style={{ color: '#9CA3AF' }}>—</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="log-table-footer">
                                    <span className="records-count">1 records shown</span>
                                </div>
                            </div>
                        </div>
                    )}

                    
                </>
            )}

            {activeSub === 'stock-movements' && <StockMovementsSuperAdmin />}

            {activeSub === 'categories' && (
                <>
                    <header className="dept-cat-header">
                        <div>
                            <h1 className="dept-cat-title">Departments & Categories</h1>
                        </div>
                        <button
                            type="button"
                            className="btn-portal btn-add-main"
                            onClick={() => innerTab === 'Departments' ? setNewDeptOpen(true) : setNewCategoryOpen(true)}
                        >
                            <Plus size={16} /> {innerTab === 'Departments' ? 'Add Department' : 'Add Category'}
                        </button>
                    </header>

                    <div className="dept-cat-nav-bar">
                        <div className="inner-tabs">
                            <button
                                className={`inner-tab ${innerTab === 'Departments' ? 'active' : ''}`}
                                onClick={() => setInnerTab('Departments')}
                            >
                                <Folder size={18} /> Departments ({departments.length})
                            </button>
                            <button
                                className={`inner-tab ${innerTab === 'Categories' ? 'active' : ''}`}
                                onClick={() => setInnerTab('Categories')}
                            >
                                <Layers size={18} /> Categories ({categories.length})
                            </button>
                        </div>
                        <div className="dept-cat-search">
                            <div className="search-wrapper">
                                <Search size={18} className="search-icon" />
                                <input type="text" placeholder="Search..." className="inner-search-input" />
                            </div>
                        </div>
                    </div>

                    <section className="premium-table dept-cat-table">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">{innerTab === 'Departments' ? 'Department' : 'Category'}</th>
                                    {innerTab === 'Categories' && <th className="table-th">Department</th>}
                                    <th className="table-th">Description</th>
                                    <th className="table-th">Status</th>
                                    <th className="table-th">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {innerTab === 'Departments' ? (
                                    departments.map((d) => (
                                        <tr key={d.id} className="table-row">
                                            <td className="table-cell">
                                                <div className="cell-with-icon">
                                                    <div className="dept-icon-box"><Folder size={16} /></div>
                                                    <span className="cell-main-text">{d.name}</span>
                                                </div>
                                            </td>
                                            <td className="table-cell">{d.description}</td>
                                            <td className="table-cell"><span className="status-badge status-completed">{d.status}</span></td>
                                            <td className="table-cell">
                                                <button type="button" className="btn-edit" onClick={() => { setEditingDept({ ...d }); setEditDeptOpen(true); }}>Edit</button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    categories.map((c) => (
                                        <tr key={c.id} className="table-row">
                                            <td className="table-cell">
                                                <div className="cell-with-icon">
                                                    <div className="cat-icon-box"><Layers size={16} /></div>
                                                    <span className="cell-main-text">{c.name}</span>
                                                </div>
                                            </td>
                                            <td className="table-cell">{c.department}</td>
                                            <td className="table-cell">{c.description}</td>
                                            <td className="table-cell"><span className="status-badge status-completed">{c.status}</span></td>
                                            <td className="table-cell">
                                                <button type="button" className="btn-edit" onClick={() => { setEditingCategory({ ...c }); setEditCategoryOpen(true); }}>Edit</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>

                    
                </>
            )}

            {activeSub === 'units-of-measure' && (
                <>
                    <div className="ui-kpis">
                        <div className="ui-metric">
                            <span className="ui-metric-icon"><Layers size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">Total UOMs</div>
                            <div className="ui-metric-value">{uomList.length}</div>
                        </div>
                        <div className="ui-metric">
                            <span className="ui-metric-icon"><Package size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">Active</div>
                            <div className="ui-metric-value">{uomActiveCount}</div>
                            <div className="ui-metric-foot">of {uomList.length}</div>
                        </div>
                        <div className="ui-metric">
                            <span className="ui-metric-icon"><Folder size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">Categories</div>
                            <div className="ui-metric-value">{UOM_CATEGORIES.length}</div>
                        </div>
                        <div className="ui-metric">
                            <span className="ui-metric-icon"><Minus size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">Inactive</div>
                            <div className="ui-metric-value">{uomList.length - uomActiveCount}</div>
                        </div>
                    </div>

                    <div className="ui-table-wrap">
                        <div className="ui-toolbar">
                            <div className="ui-chips">
                                {['all', ...UOM_CATEGORIES].map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        className={`ui-chip${uomCategoryFilter === cat ? ' ui-chip--on' : ''}`}
                                        aria-pressed={uomCategoryFilter === cat}
                                        onClick={() => setUomCategoryFilter(cat)}
                                    >
                                        {cat === 'all' ? 'All' : cat}
                                    </button>
                                ))}
                            </div>
                            <div className="ui-toolbar-end">
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--primary ui-btn--sm"
                                    onClick={() => setNewUomOpen(true)}
                                >
                                    <Plus size={14} /> New UOM
                                </button>
                            </div>
                        </div>

                        {visibleUoms.length === 0 ? (
                            <div className="ui-empty">
                                <div className="ui-empty-icon"><Layers size={18} /></div>
                                <div className="ui-empty-title">No units of measure here</div>
                            </div>
                        ) : (
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Abbreviation</th>
                                        <th>Category</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th aria-label="Actions" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {uomPaging.pagedRows.map((u) => (
                                        <tr key={u.id}>
                                            <td data-label="Name" className="ui-strong">{u.name}</td>
                                            <td data-label="Abbreviation" className="ui-mono">{u.abbreviation}</td>
                                            <td data-label="Category"><span className="ui-tag">{u.category}</span></td>
                                            <td data-label="Description">{u.description || '—'}</td>
                                            <td data-label="Status">
                                                <span className={`ui-pill ui-pill--${u.status === 'active' ? 'ok' : 'neutral'}`}>
                                                    {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="ui-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm"
                                                        onClick={() => openEditUom(u)}
                                                        title="Edit"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm"
                                                        onClick={() => handleDeleteUom(u.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <UiPager {...uomPaging.pagerProps} />
                    </div>
                    
                </>
            )}
        </div>
    );
}
