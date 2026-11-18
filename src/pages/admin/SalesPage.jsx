import React, { useCallback } from 'react';
import { useParams, NavLink, useOutletContext } from 'react-router-dom';
import SalesReports from './SalesReports';
import SalesOrders from './SalesOrders';
import WorkshopSales from './WorkshopSales';
import SuppliersWarehouseSales from './SuppliersWarehouseSales';
import CorporateTransactions from './CorporateTransactions';
import SalesReturnsPage from './SalesReturnsPage';
import Receipts from './Receipts';
import AdvancedReportsPage from '../advanced-reports/AdvancedReportsPage';
import { useAuth } from '../../context/AuthContext';
import { salesT, SALES_SUB_LABEL_KEYS } from '../../utils/salesI18n';
import '../../styles/ui.css';

const SUB_TABS = [
    { path: 'sales-reports',             labelKey: 'sub.reports',   permission: 'sales.sales-reports.view' },
    { path: 'advanced-reports',          labelKey: 'sub.advanced',  permission: 'sales.advanced-reports.view' },
    { path: 'sales-orders',              labelKey: 'sub.orders',    permission: 'sales.sales-orders.view' },
    { path: 'workshop-sales',            labelKey: 'sub.workshop',  permission: 'sales.workshop-sales.view' },
    { path: 'suppliers-warehouse-sales', labelKey: 'sub.suppliers', permission: 'sales.suppliers-warehouse-sales.view' },
    { path: 'corporate-transactions',    labelKey: 'sub.corporate', permission: 'sales.corporate-transactions.view' },
    { path: 'sales-returns',             labelKey: 'sub.returns',   permission: 'sales.sales-returns.view' },
    { path: 'receipts',                  labelKey: 'sub.receipts',  permission: 'sales.receipts.view' },
];

export default function SalesPage() {
    const { subTab } = useParams();
    const { hasPermission } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => salesT(locale, key, vars), [locale]);

    const visibleSubTabs = SUB_TABS.filter((tab) => {
        if (tab.path === 'advanced-reports') {
            return hasPermission('sales.advanced-reports.view') || hasPermission('sales.sales-reports.view');
        }
        return hasPermission(tab.permission);
    });
    const activeSub = subTab || 'sales-reports';

    return (
        <div className="ui-root ui-root--flush ui-stack">
            {/* Eight tabs do not fit one line on a laptop, so the strip scrolls. */}
            <div className="ui-tabs ui-tabs--scroll" role="tablist">
                {visibleSubTabs.map((tab) => (
                    <NavLink
                        key={tab.path}
                        to={`/admin/sales/${tab.path}`}
                        role="tab"
                        aria-selected={activeSub === tab.path}
                        className="ui-tab"
                    >
                        {t(SALES_SUB_LABEL_KEYS[tab.path] || tab.labelKey)}
                    </NavLink>
                ))}
            </div>

            <div className="ui-tabpanel">
                {activeSub === 'sales-reports' && <SalesReports />}
                {activeSub === 'advanced-reports' && <AdvancedReportsPage portal="admin" />}
                {activeSub === 'sales-orders' && <SalesOrders />}
                {activeSub === 'workshop-sales' && <WorkshopSales />}
                {activeSub === 'suppliers-warehouse-sales' && <SuppliersWarehouseSales />}
                {activeSub === 'corporate-transactions' && <CorporateTransactions />}
                {activeSub === 'sales-returns' && <SalesReturnsPage />}
                {activeSub === 'receipts' && <Receipts />}
            </div>
        </div>
    );
}
