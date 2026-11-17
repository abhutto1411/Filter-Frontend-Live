import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Boxes, Layers, Loader, Plus, RotateCcw, UserPlus, Wallet } from 'lucide-react';
import Modal from '../../../components/Modal';
import { SectionErrorBoundary } from '../../../components/AppErrorBoundary';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import {
    useStorageFacilityApi,
    useStorageFacilityPortal,
} from './StorageFacilityPortalContext';
import StorageFacilityCustomersTab from './StorageFacilityCustomersTab';
import StorageFacilitySuppliersTab from './StorageFacilitySuppliersTab';
import StorageFacilityProductsTab from './StorageFacilityProductsTab';
import StorageFacilityMovementsTab from './StorageFacilityMovementsTab';
import StorageFacilityLocationsTab from './StorageFacilityLocationsTab';
import StorageFacilityTransfersTab from './StorageFacilityTransfersTab';
import StorageFacilitySalesRepsTab from './StorageFacilitySalesRepsTab';
import StorageFacilitySalesTab from './StorageFacilitySalesTab';
import StorageFacilityInvoicesTab from './StorageFacilityInvoicesTab';
import StorageFacilityUomTab from './StorageFacilityUomTab';
import StorageBrandTransactionHub from './accounting/StorageBrandTransactionHub';
import StorageBrandCashBankTab from './accounting/StorageBrandCashBankTab';
import StorageBrandAccountsTab from './accounting/StorageBrandAccountsTab';
import StorageBrandJournalLogs from './accounting/StorageBrandJournalLogs';
import StorageBrandTrialBalanceTab from './accounting/StorageBrandTrialBalanceTab';
import StorageBrandIncomeStatementTab from './accounting/StorageBrandIncomeStatementTab';
import StorageBrandBalanceSheetTab from './accounting/StorageBrandBalanceSheetTab';
import { STORAGE_BRAND_ACCOUNTING_TABS } from './accounting/storageFacilityAccountingTabs';
import SupplierRiyalAmount from '../SupplierRiyalAmount';
import StorageFacilityPermissionsPicker from './StorageFacilityPermissionsPicker';
import { SF_DEFAULT_OPERATOR_PERMISSIONS } from './storageFacilityPermissions';
import {
    sfT,
    SF_OPERATIONS_TAB_KEYS,
    SF_ADMIN_TAB_KEYS,
    SF_ACCT_TAB_LABEL_KEYS,
} from '../../../utils/storageFacilityI18n';
import '../../../styles/admin/AccountingPage.css';
import '../../../styles/ui.css';

function readPortalScope(isOwnerFromContext) {
    if (typeof isOwnerFromContext === 'boolean') {
        return isOwnerFromContext ? 'owner' : 'storage_brand';
    }
    try {
        const u = JSON.parse(localStorage.getItem('filter_auth_user') || '{}');
        return u?.supplier?.portalScope ?? 'owner';
    } catch {
        return 'owner';
    }
}

export default function SupplierStorageFacilityBrandHub({ brandId, locale: localeProp } = {}) {
    const navigate = useNavigate();
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const tr = useCallback((key, vars) => sfT(locale, key, vars), [locale]);

    const { routeBase, isOwner: isOwnerFromContext } = useStorageFacilityPortal();
    const sfApi = useStorageFacilityApi();
    const isOwner = readPortalScope(isOwnerFromContext) !== 'storage_brand';
    const [tab, setTab] = useState('overview');
    const [summary, setSummary] = useState(null);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [uomProfiles, setUomProfiles] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    // Bumped by Retry and after a create. The old `reload` callback depended on
    // `tr`, so switching language refired all seven requests.
    const [reloadKey, setReloadKey] = useState(0);

    const [userModal, setUserModal] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        role: 'brand_operator',
        permissions: [...SF_DEFAULT_OPERATOR_PERMISSIONS],
    });
    const [whSearch, setWhSearch] = useState([]);
    const [busy, setBusy] = useState(false);
    const [auditEntries, setAuditEntries] = useState([]);
    const [openLedgerAccountId, setOpenLedgerAccountId] = useState(null);

    const visibleAdminTabs = SF_ADMIN_TAB_KEYS.filter((x) => !x.ownerOnly || isOwner);

    function renderTabButton(item) {
        if (item.type === 'divider') {
            return <span key={item.id} className="ui-tab-divider" aria-hidden="true" />;
        }
        const labelKey = item.labelKey || SF_ACCT_TAB_LABEL_KEYS[item.id];
        const label = labelKey ? tr(labelKey) : item.label;
        return (
            <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className="ui-tab"
            >
                {label}
            </button>
        );
    }

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [sumRes, prodRes, custRes, supRes, uomRes, auditRes] = await Promise.all([
                sfApi.getStorageBrandSummary(brandId),
                sfApi.listStorageProducts(brandId),
                sfApi.listStorageCustomers(brandId),
                sfApi.listStorageSuppliers(brandId),
                sfApi.listStorageUomProfiles(brandId),
                sfApi.listStorageAuditLog(brandId, { limit: 20 }),
            ]);
            setSummary(sumRes?.brand ?? null);
            setProducts(prodRes?.products ?? []);
            setCustomers(custRes?.customers ?? []);
            setSuppliers(supRes?.suppliers ?? []);
            setUomProfiles(uomRes?.profiles ?? []);
            setAuditEntries(auditRes?.entries ?? []);
            if (isOwner) {
                const uRes = await sfApi.listStorageBrandUsers(brandId);
                setUsers(uRes?.users ?? []);
            }
            setLoadError(false);
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, isOwner, sfApi]);

    useEffect(() => {
        reload();
    }, [reload, reloadKey]);

    // The brand's own users are few and arrive whole, so the pager slices.
    const usersPaging = usePagedRows(users, { resetKey: brandId });

    const addUser = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await sfApi.createStorageBrandUser(brandId, {
                name: newUser.name,
                email: newUser.email,
                password: newUser.password,
                role: newUser.role,
                permissions:
                    newUser.role === 'brand_admin' ? undefined : newUser.permissions,
            });
            setUserModal(false);
            setNewUser({
                name: '',
                email: '',
                password: '',
                role: 'brand_operator',
                permissions: [...SF_DEFAULT_OPERATOR_PERMISSIONS],
            });
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || tr('hub.user.err'));
        } finally {
            setBusy(false);
        }
    };

    const searchWh = async (q) => {
        try {
            const res = await sfApi.searchWarehouseProductsForMap(q, { limit: q?.trim() ? 200 : 5000 });
            setWhSearch(res?.products ?? []);
        } catch {
            setWhSearch([]);
        }
    };

    if (loading && !summary) {
        return (
            <div className="ui-root ui-root--flush ui-stack" aria-busy="true">
                <div className="ui-sk ui-sk--btn" />
                <div className="ui-sk ui-sk--title ui-sk--w40" />
                <div className="ui-kpis">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={`sk-${i}`} className="ui-metric ui-sk-row">
                            <div className="ui-sk ui-sk--label ui-sk--w55" />
                            <div className="ui-sk ui-sk--title ui-sk--w40" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div>
                <button
                    type="button"
                    className="ui-btn ui-btn--subtle ui-btn--sm"
                    onClick={() => navigate(routeBase)}
                >
                    <ArrowLeft size={14} /> {isOwner ? tr('hub.backBrands') : tr('hub.back')}
                </button>
            </div>

            <div className="ui-head">
                <h1>{summary?.name ?? tr('hub.titleFallback')}</h1>
                {summary?.locationName ? (
                    <p>{tr('hub.bin', { name: summary.locationName })}</p>
                ) : null}
                <p className="ui-banner" data-storage-not-warehouse="1">
                    {tr('hub.notWarehouse')}
                </p>
            </div>

            {loadError ? (
                <div className="ui-banner ui-banner--dang">
                    <AlertTriangle size={14} />
                    <div className="ui-stack-sm">
                        <div><strong>{tr('hub.errLoad')}</strong> {tr('hub.errSub')}</div>
                        <div>
                            <button
                                type="button"
                                className="ui-btn ui-btn--default ui-btn--sm"
                                onClick={() => setReloadKey((k) => k + 1)}
                            >
                                <RotateCcw size={13} /> {tr('hub.retry')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="ui-stack-sm">
                <div className="ui-tabs ui-tabs--scroll" role="tablist">
                    {SF_OPERATIONS_TAB_KEYS.map(renderTabButton)}
                    {visibleAdminTabs.map(renderTabButton)}
                </div>
                <div
                    className="ui-tabs ui-tabs--scroll"
                    role="tablist"
                    aria-label={tr('hub.accounting')}
                >
                    <span className="ui-tabs-label">{tr('hub.accounting')}</span>
                    {STORAGE_BRAND_ACCOUNTING_TABS.map(renderTabButton)}
                </div>
            </div>

            <SectionErrorBoundary resetKey={tab}>
            {tab === 'overview' ? (
                <div className="ui-stack">
                    {summary ? (
                        <div className="ui-kpis">
                            <div className="ui-metric">
                                <span className="ui-metric-icon"><Boxes size={62} strokeWidth={1.1} /></span>
                                <div className="ui-metric-label">{tr('hub.stat.products')}</div>
                                <div className="ui-metric-value">{summary.productCount}</div>
                            </div>
                            <div className="ui-metric">
                                <span className="ui-metric-icon"><Layers size={62} strokeWidth={1.1} /></span>
                                <div className="ui-metric-label">{tr('hub.stat.qty')}</div>
                                <div className="ui-metric-value">{summary.totalQty}</div>
                            </div>
                            <div className="ui-metric ui-metric--info">
                                <span className="ui-metric-icon"><Wallet size={62} strokeWidth={1.1} /></span>
                                <div className="ui-metric-label">{tr('hub.stat.ar')}</div>
                                <div className="ui-metric-value">
                                    <SupplierRiyalAmount amount={summary.arBalance} size={18} />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {auditEntries.length > 0 ? (
                        <div className="ui-stack-sm">
                            <div className="ui-label">{tr('hub.activity')}</div>
                            <div className="ui-rows">
                                <ul className="ui-list">
                                    {auditEntries.map((a) => (
                                        <li key={a.id} className="ui-list-row">
                                            <div className="ui-list-main">
                                                <span className="ui-list-title">
                                                    <strong>{a.action}</strong> — {a.summary}
                                                </span>
                                                <span className="ui-list-meta">
                                                    {a.createdAt?.slice(0, 16).replace('T', ' ')}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {tab === 'products' ? (
                <StorageFacilityProductsTab
                    brandId={brandId}
                    products={products}
                    uomProfiles={uomProfiles}
                    onReload={reload}
                    whSearch={whSearch}
                    onLoadCatalog={() => searchWh('')}
                />
            ) : null}

            {tab === 'uom' ? (
                <StorageFacilityUomTab
                    brandId={brandId}
                    products={products}
                    uomProfiles={uomProfiles}
                    onReload={reload}
                />
            ) : null}

            {tab === 'movements' ? (
                <StorageFacilityMovementsTab
                    brandId={brandId}
                    brandName={summary?.name}
                    products={products}
                    onReload={reload}
                />
            ) : null}

            {tab === 'locations' ? (
                <StorageFacilityLocationsTab brandId={brandId} />
            ) : null}

            {tab === 'sales_reps' ? (
                <StorageFacilitySalesRepsTab brandId={brandId} />
            ) : null}

            {tab === 'sales' ? <StorageFacilitySalesTab brandId={brandId} /> : null}

            {tab === 'transfers' ? (
                <StorageFacilityTransfersTab
                    brandId={brandId}
                    products={products}
                    onReload={reload}
                />
            ) : null}

            {tab === 'sales_invoices' ? (
                <StorageFacilityInvoicesTab
                    brandId={brandId}
                    brandName={summary?.name}
                    scope="sales"
                    products={products}
                    customers={customers}
                    suppliers={suppliers}
                    uomProfiles={uomProfiles}
                    onReload={reload}
                />
            ) : null}

            {tab === 'purchase_invoices' ? (
                <StorageFacilityInvoicesTab
                    brandId={brandId}
                    brandName={summary?.name}
                    scope="purchase"
                    products={products}
                    customers={customers}
                    suppliers={suppliers}
                    uomProfiles={uomProfiles}
                    onReload={reload}
                />
            ) : null}

            {tab === 'ar' ? <StorageFacilityCustomersTab brandId={brandId} /> : null}

            {tab === 'ap' ? <StorageFacilitySuppliersTab brandId={brandId} /> : null}

            {tab === 'acct_hub' ? (
                <StorageBrandTransactionHub brandId={brandId} customers={customers} />
            ) : null}
            {tab === 'acct_cash' ? <StorageBrandCashBankTab brandId={brandId} /> : null}
            {tab === 'acct_accounts' ? (
                <StorageBrandAccountsTab
                    brandId={brandId}
                    openAccountId={openLedgerAccountId}
                    onLedgerOpened={() => setOpenLedgerAccountId(null)}
                />
            ) : null}
            {tab === 'acct_log_pay' ? (
                <StorageBrandJournalLogs brandId={brandId} kind="payments" />
            ) : null}
            {tab === 'acct_log_rcpt' ? (
                <StorageBrandJournalLogs brandId={brandId} kind="receipts" />
            ) : null}
            {tab === 'acct_log_je' ? (
                <StorageBrandJournalLogs brandId={brandId} kind="journals" />
            ) : null}
            {tab === 'acct_tb' ? (
                <StorageBrandTrialBalanceTab
                    brandId={brandId}
                    onAccountClick={(id) => {
                        setOpenLedgerAccountId(id);
                        setTab('acct_accounts');
                    }}
                />
            ) : null}
            {tab === 'acct_pl' ? <StorageBrandIncomeStatementTab brandId={brandId} /> : null}
            {tab === 'acct_bs' ? <StorageBrandBalanceSheetTab brandId={brandId} /> : null}

            {tab === 'users' && isOwner ? (
                <div className="ui-table-wrap">
                    <div className="ui-toolbar">
                        <span>{tr('hub.users.count', { n: users.length })}</span>
                        <div className="ui-toolbar-end">
                            <button
                                type="button"
                                className="ui-btn ui-btn--primary ui-btn--sm"
                                onClick={() => setUserModal(true)}
                            >
                                <Plus size={14} /> {tr('hub.addUser')}
                            </button>
                        </div>
                    </div>
                    {users.length === 0 ? (
                        <div className="ui-empty">
                            <div className="ui-empty-icon"><UserPlus size={18} /></div>
                            <div className="ui-empty-title">{tr('hub.users.emptyTitle')}</div>
                            <div className="ui-empty-sub">{tr('hub.users.emptySub')}</div>
                        </div>
                    ) : (
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{tr('hub.th.name')}</th>
                                    <th>{tr('hub.th.email')}</th>
                                    <th>{tr('hub.th.role')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usersPaging.pagedRows.map((u) => (
                                    <tr key={u.id}>
                                        <td data-label={tr('hub.th.name')}>
                                            <div className="ui-strong">{u.name}</div>
                                        </td>
                                        <td data-label={tr('hub.th.email')}>{u.email}</td>
                                        <td data-label={tr('hub.th.role')}>
                                            {/* The table used to print the raw
                                                `brand_operator` while the form
                                                beside it said "Operator". */}
                                            <span className={`ui-pill ui-pill--${u.role === 'brand_admin' ? 'info' : 'neutral'}`}>
                                                {u.role === 'brand_admin'
                                                    ? tr('hub.user.roleShort.admin')
                                                    : tr('hub.user.roleShort.operator')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <UiPager {...usersPaging.pagerProps} />
                </div>
            ) : null}
            </SectionErrorBoundary>

            {userModal ? (
                <Modal
                    title={tr('hub.userModal.title')}
                    width="620px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={busy}
                    onClose={() => setUserModal(false)}
                >
                    <form onSubmit={addUser}>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-user-name">{tr('hub.user.label.name')}</label>
                                <input
                                    id="sf-user-name"
                                    type="text"
                                    className="ui-input"
                                    value={newUser.name}
                                    onChange={(e) =>
                                        setNewUser((u) => ({ ...u, name: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-user-email">{tr('hub.user.label.email')}</label>
                                <input
                                    id="sf-user-email"
                                    type="email"
                                    className="ui-input"
                                    autoComplete="off"
                                    value={newUser.email}
                                    onChange={(e) =>
                                        setNewUser((u) => ({ ...u, email: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-user-password">{tr('hub.user.label.password')}</label>
                                <input
                                    id="sf-user-password"
                                    type="password"
                                    className="ui-input"
                                    autoComplete="new-password"
                                    value={newUser.password}
                                    onChange={(e) =>
                                        setNewUser((u) => ({ ...u, password: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-user-role">{tr('hub.user.label.role')}</label>
                                <select
                                    id="sf-user-role"
                                    className="ui-select"
                                    value={newUser.role}
                                    onChange={(e) => {
                                        const role = e.target.value;
                                        setNewUser((u) => ({
                                            ...u,
                                            role,
                                            permissions:
                                                role === 'brand_admin'
                                                    ? [...SF_DEFAULT_OPERATOR_PERMISSIONS]
                                                    : u.permissions,
                                        }));
                                    }}
                                >
                                    <option value="brand_operator">{tr('hub.user.role.operator')}</option>
                                    <option value="brand_admin">{tr('hub.user.role.admin')}</option>
                                </select>
                                <p className="ui-help">{tr('hub.user.hint')}</p>
                            </div>
                        </div>

                        {newUser.role === 'brand_operator' ? (
                            <StorageFacilityPermissionsPicker
                                value={newUser.permissions}
                                onChange={(permissions) =>
                                    setNewUser((u) => ({ ...u, permissions }))
                                }
                                disabled={busy}
                            />
                        ) : null}

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={busy}
                                onClick={() => setUserModal(false)}
                            >
                                {tr('hub.user.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
                                {busy ? (
                                    <><Loader size={14} className="ui-spin" /> {tr('hub.user.creating')}</>
                                ) : tr('hub.user.create')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
