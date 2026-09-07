import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
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
import StorageFacilityPermissionsPicker from './StorageFacilityPermissionsPicker';
import { SF_DEFAULT_OPERATOR_PERMISSIONS } from './storageFacilityPermissions';
import {
    sfT,
    SF_OPERATIONS_TAB_KEYS,
    SF_ADMIN_TAB_KEYS,
    SF_ACCT_TAB_LABEL_KEYS,
} from '../../../utils/storageFacilityI18n';
import '../../../styles/admin/AccountingPage.css';

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
    const [err, setErr] = useState('');

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
            return <span key={item.id} className="sf-brand-tab-divider" aria-hidden />;
        }
        const active = tab === item.id;
        const labelKey = item.labelKey || SF_ACCT_TAB_LABEL_KEYS[item.id];
        const label = labelKey ? tr(labelKey) : item.label;
        return (
            <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={active ? 'sf-brand-tab sf-brand-tab--active' : 'sf-brand-tab'}
            >
                {label}
            </button>
        );
    }

    const reload = useCallback(async () => {
        setLoading(true);
        setErr('');
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
        } catch (e) {
            setErr(e?.message || tr('hub.errLoad'));
        } finally {
            setLoading(false);
        }
    }, [brandId, isOwner, sfApi, tr]);

    useEffect(() => {
        reload();
    }, [reload]);

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
            await reload();
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
            <div style={{ padding: 16 }}>
                <ShimmerTable rows={8} columns={5} />
            </div>
        );
    }

    return (
        <div className="mgr-si-page">
            <button
                type="button"
                className="btn-portal-outline"
                style={{ marginBottom: 12 }}
                onClick={() => navigate(routeBase)}
            >
                <ArrowLeft size={14} /> {isOwner ? tr('hub.backBrands') : tr('hub.back')}
            </button>

            <h2 className="mgr-si-title">{summary?.name ?? tr('hub.titleFallback')}</h2>
            {summary?.locationName ? (
                <p className="mgr-si-subtitle">{tr('hub.bin', { name: summary.locationName })}</p>
            ) : null}

            {err ? <div className="mgr-si-error">{err}</div> : null}

            <div className="sf-brand-tab-panel">
                <div className="sf-brand-tab-row">
                    {SF_OPERATIONS_TAB_KEYS.map(renderTabButton)}
                    {visibleAdminTabs.map(renderTabButton)}
                </div>
                <div className="sf-brand-tab-row sf-brand-tab-row--accounting">
                    <span className="sf-brand-tab-row-label">{tr('hub.accounting')}</span>
                    {STORAGE_BRAND_ACCOUNTING_TABS.map(renderTabButton)}
                </div>
            </div>

            {tab === 'overview' && summary ? (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 12,
                    }}
                >
                    <div className="ws-section" style={{ padding: 16 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{tr('hub.stat.products')}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary.productCount}</div>
                    </div>
                    <div className="ws-section" style={{ padding: 16 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{tr('hub.stat.qty')}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary.totalQty}</div>
                    </div>
                    <div className="ws-section" style={{ padding: 16 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{tr('hub.stat.ar')}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>
                            {tr('money.sar', {
                                amount: Number(summary.arBalance || 0).toLocaleString(),
                            })}
                        </div>
                    </div>
                </div>
            ) : null}

            {tab === 'overview' && auditEntries.length > 0 ? (
                <div className="ws-section" style={{ marginTop: 16, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem' }}>{tr('hub.activity')}</h3>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.8125rem' }}>
                        {auditEntries.map((a) => (
                            <li
                                key={a.id}
                                style={{
                                    padding: '8px 0',
                                    borderBottom: '1px solid #e2e8f0',
                                }}
                            >
                                <span style={{ color: '#64748b' }}>
                                    {a.createdAt?.slice(0, 16).replace('T', ' ')}
                                </span>
                                {' · '}
                                <strong>{a.action}</strong> — {a.summary}
                            </li>
                        ))}
                    </ul>
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
                <>
                    <button
                        type="button"
                        className="mgr-si-btn-new"
                        style={{ marginBottom: 12 }}
                        onClick={() => setUserModal(true)}
                    >
                        <Plus size={14} /> {tr('hub.addUser')}
                    </button>
                    <div className="premium-table mgr-si-table-wrap">
                        <table className="mgr-si-table">
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">{tr('hub.th.name')}</th>
                                    <th className="table-th">{tr('hub.th.email')}</th>
                                    <th className="table-th">{tr('hub.th.role')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="table-row">
                                        <td className="table-cell">{u.name}</td>
                                        <td className="table-cell">{u.email}</td>
                                        <td className="table-cell">{u.role}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}

            {userModal ? (
                <Modal
                    title={tr('hub.userModal.title')}
                    width="560px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !busy && setUserModal(false)}
                >
                    <form className="sf-simple-form" onSubmit={addUser}>
                        <div className="sf-form-field">
                            <label htmlFor="sf-user-name">{tr('hub.user.label.name')}</label>
                            <input
                                id="sf-user-name"
                                value={newUser.name}
                                onChange={(e) =>
                                    setNewUser((u) => ({ ...u, name: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label htmlFor="sf-user-email">{tr('hub.user.label.email')}</label>
                                <input
                                    id="sf-user-email"
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) =>
                                        setNewUser((u) => ({ ...u, email: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="sf-form-field">
                                <label htmlFor="sf-user-password">{tr('hub.user.label.password')}</label>
                                <input
                                    id="sf-user-password"
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) =>
                                        setNewUser((u) => ({ ...u, password: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                        </div>
                        <div className="sf-form-field">
                            <label htmlFor="sf-user-role">{tr('hub.user.label.role')}</label>
                            <select
                                id="sf-user-role"
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
                            <p className="sf-form-field-hint">{tr('hub.user.hint')}</p>
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
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={busy}
                                onClick={() => setUserModal(false)}
                            >
                                {tr('hub.user.cancel')}
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={busy}>
                                {busy ? tr('hub.user.creating') : tr('hub.user.create')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
