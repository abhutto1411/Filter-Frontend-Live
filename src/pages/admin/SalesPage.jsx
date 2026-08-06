import React, { useCallback, useState } from 'react';
import { useParams, NavLink, useOutletContext } from 'react-router-dom';
import { ChevronDown, Calendar, Search, Lightbulb, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
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
import '../../styles/admin/SalesPage.css';

const SUB_TABS = [
    { path: 'sales-reports',              labelKey: 'sub.reports',    permission: 'sales.sales-reports.view' },
    { path: 'advanced-reports',           labelKey: 'sub.advanced',   permission: 'sales.advanced-reports.view' },
    { path: 'sales-orders',                labelKey: 'sub.orders',     permission: 'sales.sales-orders.view' },
    { path: 'workshop-sales',              labelKey: 'sub.workshop',   permission: 'sales.workshop-sales.view' },
    { path: 'suppliers-warehouse-sales',   labelKey: 'sub.suppliers',  permission: 'sales.suppliers-warehouse-sales.view' },
    { path: 'corporate-transactions',      labelKey: 'sub.corporate',  permission: 'sales.corporate-transactions.view' },
    { path: 'sales-returns',               labelKey: 'sub.returns',    permission: 'sales.sales-returns.view' },
    { path: 'receipts',                    labelKey: 'sub.receipts',   permission: 'sales.receipts.view' },
];

const EMPTY_INVOICE = {
    invNo: 'INV-' + Math.floor(Math.random() * 100000000),
    invDate: new Date().toISOString().split('T')[0],
    dueDateType: 'Net',
    dueDateValue: '30',
    branch: 'Select branch',
    customer: 'Select customer',
    customerMobile: '',
    vehiclePlate: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Unpaid',
    lineItems: [
        { id: 1, item: '', uom: 'pcs', qty: 1, unitPrice: 0, total: 0, taxCode: '15%', taxAmt: 0, grandTotal: 0, lastSalePrice: 0 }
    ],
    freightCharges: 0,
    discountValue: 0,
    discountType: 'Fixed (S..',
    notes: '',
    showLineNo: false,
    showDesc: false,
    showDiscount: false,
    isTaxInclusive: false
};

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [invoiceData, setInvoiceData] = useState(EMPTY_INVOICE);

    // Calculation logic
    const calculateTotals = () => {
        let subtotal = 0;
        let totalTax = 0;

        const updatedItems = invoiceData.lineItems.map(item => {
            const rowTotal = item.qty * item.unitPrice;
            const rowTax = rowTotal * 0.15; // Assuming 15% VAT for demo
            subtotal += rowTotal;
            totalTax += rowTax;
            return { ...item, total: rowTotal, taxAmt: rowTax, grandTotal: rowTotal + rowTax };
        });

        const grandTotal = subtotal + totalTax + parseFloat(invoiceData.freightCharges || 0) - parseFloat(invoiceData.discountValue || 0);

        return { subtotal, totalTax, grandTotal };
    };

    const totals = calculateTotals();

    const addLine = () => {
        setInvoiceData({
            ...invoiceData,
            lineItems: [...invoiceData.lineItems, { id: Date.now(), item: '', uom: 'pcs', qty: 1, unitPrice: 0, total: 0, taxCode: '15%', taxAmt: 0, grandTotal: 0, lastSalePrice: 0 }]
        });
    };

    const updateItem = (id, field, value) => {
        setInvoiceData({
            ...invoiceData,
            lineItems: invoiceData.lineItems.map(item => item.id === id ? { ...item, [field]: value } : item)
        });
    };

    const removeItem = (id) => {
        if (invoiceData.lineItems.length > 1) {
            setInvoiceData({
                ...invoiceData,
                lineItems: invoiceData.lineItems.filter(item => item.id !== id)
            });
        }
    };

    const handleCreateInvoice = () => {
        // demo functionality
        setIsModalOpen(false);
        setInvoiceData(EMPTY_INVOICE);
    };

    const InvoiceModalContent = () => (
        <div className="invoice-form-container">
            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.number')}</label>
                    <input type="text" className="form-input-inv" value={invoiceData.invNo} readOnly style={{ borderColor: '#FFD700', backgroundColor: '#FBFBFE' }} />
                </div>
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.date')}</label>
                    <div className="input-with-icon">
                        <input type="date" className="form-input-inv" value={invoiceData.invDate} onChange={(e) => setInvoiceData({ ...invoiceData, invDate: e.target.value })} />
                        <Calendar size={16} className="input-icon-right" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.dueDate')}</label>
                    <div className="due-date-row">
                        <div className="select-wrapper-inv" style={{ width: '80px' }}>
                            <select className="form-input-inv" value={invoiceData.dueDateType} onChange={(e) => setInvoiceData({ ...invoiceData, dueDateType: e.target.value })}>
                                <option value="Net">{t('inv.opt.net')}</option>
                                <option value="Fixed">{t('inv.opt.fixed')}</option>
                            </select>
                            <ChevronDown size={14} className="select-icon-inv" />
                        </div>
                        <input type="text" className="form-input-inv" style={{ width: '60px' }} value={invoiceData.dueDateValue} onChange={(e) => setInvoiceData({ ...invoiceData, dueDateValue: e.target.value })} />
                        <span className="unit-label">{t('inv.days')}</span>
                    </div>
                    <span className="due-date-hint">Due: 2026-04-05</span>
                </div>
            </div>

            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.branch')}</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.branch} onChange={(e) => setInvoiceData({ ...invoiceData, branch: e.target.value })}>
                            <option value="Select branch">{t('inv.opt.selectBranch')}</option>
                            <option>Petromin Services</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.customer')}</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.customer} onChange={(e) => setInvoiceData({ ...invoiceData, customer: e.target.value })}>
                            <option value="Select customer">{t('inv.opt.selectCustomer')}</option>
                            <option>Safa Makkah</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.mobile')}</label>
                    <input type="text" className="form-input-inv" placeholder={t('inv.ph.mobile')} value={invoiceData.customerMobile} onChange={(e) => setInvoiceData({ ...invoiceData, customerMobile: e.target.value })} />
                </div>
            </div>

            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.plate')}</label>
                    <input type="text" className="form-input-inv" placeholder={t('inv.ph.plate')} value={invoiceData.vehiclePlate} onChange={(e) => setInvoiceData({ ...invoiceData, vehiclePlate: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.payMethod')}</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.paymentMethod} onChange={(e) => setInvoiceData({ ...invoiceData, paymentMethod: e.target.value })}>
                            <option value="Cash">{t('inv.opt.cash')}</option>
                            <option value="Bank Card">{t('inv.opt.card')}</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">{t('inv.payStatus')}</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.paymentStatus} onChange={(e) => setInvoiceData({ ...invoiceData, paymentStatus: e.target.value })}>
                            <option value="Unpaid">{t('inv.opt.unpaid')}</option>
                            <option value="Paid">{t('inv.opt.paid')}</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
            </div>

            <div className="line-items-label">{t('inv.lineItems')}</div>

            <div className="line-items-table-wrapper">
                <table className="line-items-table">
                    <thead>
                        <tr>
                            <th style={{ width: '25%' }}>{t('inv.th.item')}</th>
                            <th>{t('inv.th.uom')}</th>
                            <th>{t('inv.th.qty')}</th>
                            <th>{t('inv.th.unitPrice')}</th>
                            <th>{t('inv.th.total')}</th>
                            <th>{t('inv.th.taxCode')}</th>
                            <th>{t('inv.th.taxAmt')}</th>
                            <th>{t('inv.th.grand')}</th>
                            <th>{t('inv.th.lastSale')}</th>
                            <th style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoiceData.lineItems.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <div className="item-search-box">
                                        <Search size={14} className="search-inline-icon" />
                                        <input type="text" className="table-input" placeholder={t('inv.ph.search')} value={item.item} onChange={(e) => updateItem(item.id, 'item', e.target.value)} />
                                    </div>
                                </td>
                                <td><input type="text" className="table-input" value={item.uom} onChange={(e) => updateItem(item.id, 'uom', e.target.value)} /></td>
                                <td><input type="number" className="table-input" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} /></td>
                                <td><input type="number" className="table-input" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} /></td>
                                <td className="font-mono-inv">{item.total.toFixed(2)}</td>
                                <td>
                                    <div className="select-wrapper-inv">
                                        <select className="table-input" value={item.taxCode} onChange={(e) => updateItem(item.id, 'taxCode', e.target.value)}>
                                            <option>15%</option>
                                            <option>0%</option>
                                        </select>
                                    </div>
                                </td>
                                <td className="font-mono-inv">{item.taxAmt.toFixed(2)}</td>
                                <td className="font-mono-inv">{item.grandTotal.toFixed(2)}</td>
                                <td className="last-sale-price-cell">{item.lastSalePrice.toFixed(2)}</td>
                                <td>
                                    <button type="button" className="btn-delete-row" onClick={() => removeItem(item.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="table-actions-row">
                    <button type="button" className="btn-add-line" onClick={addLine}>{t('inv.addLine')}</button>
                </div>
            </div>

            <div className="tip-box">
                <Lightbulb size={14} className="tip-icon" />
                <span>{t('inv.tip')}</span>
            </div>

            <div className="options-row">
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showLineNo} onChange={(e) => setInvoiceData({ ...invoiceData, showLineNo: e.target.checked })} />
                    <span>{t('inv.col.lineNo')}</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showDesc} onChange={(e) => setInvoiceData({ ...invoiceData, showDesc: e.target.checked })} />
                    <span>{t('inv.col.desc')}</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showDiscount} onChange={(e) => setInvoiceData({ ...invoiceData, showDiscount: e.target.checked })} />
                    <span>{t('inv.col.discount')}</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.isTaxInclusive} onChange={(e) => setInvoiceData({ ...invoiceData, isTaxInclusive: e.target.checked })} />
                    <span>{t('inv.taxInclusive')}</span>
                </label>
            </div>

            <div className="invoice-footer-grid">
                <div className="footer-left">
                    <div className="form-group-horiz">
                        <label>{t('inv.freight')}</label>
                        <input type="number" className="form-input-inv small-input" value={invoiceData.freightCharges} onChange={(e) => setInvoiceData({ ...invoiceData, freightCharges: e.target.value })} />
                    </div>
                    <div className="form-group-horiz mt-20">
                        <label>{t('inv.discount')}</label>
                        <div className="discount-group">
                            <input type="number" className="form-input-inv small-input" value={invoiceData.discountValue} onChange={(e) => setInvoiceData({ ...invoiceData, discountValue: e.target.value })} />
                            <div className="select-wrapper-inv" style={{ width: '100px' }}>
                                <select className="form-input-inv" value={invoiceData.discountType} onChange={(e) => setInvoiceData({ ...invoiceData, discountType: e.target.value })}>
                                    <option value="Fixed (S..">{t('inv.opt.fixedDisc')}</option>
                                    <option value="Percentage">{t('inv.opt.pctDisc')}</option>
                                </select>
                                <ChevronDown size={14} className="select-icon-inv" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="footer-right">
                    <div className="summary-card">
                        <div className="summary-row">
                            <span>{t('inv.subtotal')}</span>
                            <span>{t('money.sar', { amount: totals.subtotal.toFixed(2) })}</span>
                        </div>
                        <div className="summary-row">
                            <span>{t('inv.totalTax')}</span>
                            <span>{t('money.sar', { amount: totals.totalTax.toFixed(2) })}</span>
                        </div>
                        <div className="summary-row grand-total-row">
                            <span>{t('inv.grandTotal')}</span>
                            <span className="grand-total-val">{t('money.sar', { amount: totals.grandTotal.toFixed(2) })}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="notes-section">
                <label className="form-label-inv">{t('inv.notes')}</label>
                <textarea className="form-input-inv notes-area" placeholder={t('inv.ph.notes')} value={invoiceData.notes} onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })} />
            </div>
        </div>
    );

    return (
        <div className="sales-page module-container">
            <div className="sales-sub-nav">
                {visibleSubTabs.map((tab) => (
                    <NavLink key={tab.path} to={`/admin/sales/${tab.path}`} className={({ isActive }) => `sales-sub-tab ${isActive ? 'active' : ''}`}>
                        {t(SALES_SUB_LABEL_KEYS[tab.path] || tab.labelKey)}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'workshop-sales' && <WorkshopSales />}

            {activeSub === 'suppliers-warehouse-sales' && <SuppliersWarehouseSales />}

            {activeSub === 'corporate-transactions' && <CorporateTransactions />}

            {activeSub === 'sales-returns' && <SalesReturnsPage />}

            {activeSub === 'receipts' && <Receipts />}

            {activeSub === 'sales-reports' && <SalesReports />}
            {activeSub === 'advanced-reports' && <AdvancedReportsPage portal="admin" />}
            {activeSub === 'sales-orders' && <SalesOrders />}

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title={t('inv.modalTitle')}
                        onClose={() => setIsModalOpen(false)}
                        className="invoice-modal-mega"
                        footer={
                            <div className="modal-footer-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>{t('inv.cancel')}</button>
                                <button type="button" className="btn-submit-inv" onClick={handleCreateInvoice}>{t('inv.create')}</button>
                            </div>
                        }
                    >
                        <InvoiceModalContent />
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
