import React, { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Plus, ChevronDown, Calendar, Search, Lightbulb, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import SalesReports from './SalesReports';
import SalesOrders from './SalesOrders';
import WorkshopSales from './WorkshopSales';
import SuppliersWarehouseSales from './SuppliersWarehouseSales';
import CorporateTransactions from './CorporateTransactions';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/SalesPage.css';

const SUB_TABS = [
    { path: 'sales-reports',              label: 'Sales Reports',                 permission: 'sales.sales-reports.view' },
    { path: 'sales-orders',                label: 'Sales Orders',                  permission: 'sales.sales-orders.view' },
    { path: 'workshop-sales',              label: 'Workshop Sales',                permission: 'sales.workshop-sales.view' },
    { path: 'suppliers-warehouse-sales',   label: 'Suppliers & Warehouse Sales',   permission: 'sales.suppliers-warehouse-sales.view' },
    { path: 'corporate-transactions',      label: 'Corporate Transactions',        permission: 'sales.corporate-transactions.view' },
    { path: 'receipts',                    label: 'Receipts',                      permission: 'sales.receipts.view' },
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
    const visibleSubTabs = SUB_TABS.filter((t) => hasPermission(t.permission));
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
            {/* Header Row 1 */}
            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">Invoice Number</label>
                    <input type="text" className="form-input-inv" value={invoiceData.invNo} readOnly style={{ borderColor: '#FFD700', backgroundColor: '#FBFBFE' }} />
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Invoice Date</label>
                    <div className="input-with-icon">
                        <input type="date" className="form-input-inv" value={invoiceData.invDate} onChange={(e) => setInvoiceData({ ...invoiceData, invDate: e.target.value })} />
                        <Calendar size={16} className="input-icon-right" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Due Date</label>
                    <div className="due-date-row">
                        <div className="select-wrapper-inv" style={{ width: '80px' }}>
                            <select className="form-input-inv" value={invoiceData.dueDateType} onChange={(e) => setInvoiceData({ ...invoiceData, dueDateType: e.target.value })}>
                                <option>Net</option>
                                <option>Fixed</option>
                            </select>
                            <ChevronDown size={14} className="select-icon-inv" />
                        </div>
                        <input type="text" className="form-input-inv" style={{ width: '60px' }} value={invoiceData.dueDateValue} onChange={(e) => setInvoiceData({ ...invoiceData, dueDateValue: e.target.value })} />
                        <span className="unit-label">days</span>
                    </div>
                    <span className="due-date-hint">Due: 2026-04-05</span>
                </div>
            </div>

            {/* Header Row 2 */}
            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">Workshop Branch *</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.branch} onChange={(e) => setInvoiceData({ ...invoiceData, branch: e.target.value })}>
                            <option>Select branch</option>
                            <option>Petromin Services</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Customer</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.customer} onChange={(e) => setInvoiceData({ ...invoiceData, customer: e.target.value })}>
                            <option>Select customer</option>
                            <option>Safa Makkah</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Customer Mobile</label>
                    <input type="text" className="form-input-inv" placeholder="05XXXXXXXX" value={invoiceData.customerMobile} onChange={(e) => setInvoiceData({ ...invoiceData, customerMobile: e.target.value })} />
                </div>
            </div>

            {/* Header Row 3 */}
            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">Vehicle Plate</label>
                    <input type="text" className="form-input-inv" placeholder="ABC 1234" value={invoiceData.vehiclePlate} onChange={(e) => setInvoiceData({ ...invoiceData, vehiclePlate: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Payment Method</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.paymentMethod} onChange={(e) => setInvoiceData({ ...invoiceData, paymentMethod: e.target.value })}>
                            <option>Cash</option>
                            <option>Bank Card</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Payment Status</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.paymentStatus} onChange={(e) => setInvoiceData({ ...invoiceData, paymentStatus: e.target.value })}>
                            <option>Unpaid</option>
                            <option>Paid</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
            </div>

            <div className="line-items-label">Line Items (Services & Products)</div>

            <div className="line-items-table-wrapper">
                <table className="line-items-table">
                    <thead>
                        <tr>
                            <th style={{ width: '25%' }}>Item</th>
                            <th>UOM</th>
                            <th>Qty</th>
                            <th>Unit price</th>
                            <th>Total</th>
                            <th>Tax Code</th>
                            <th>Tax Amt</th>
                            <th>Grand Total</th>
                            <th>Last Sale Price</th>
                            <th style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoiceData.lineItems.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <div className="item-search-box">
                                        <Search size={14} className="search-inline-icon" />
                                        <input type="text" className="table-input" placeholder="Search product to add" value={item.item} onChange={(e) => updateItem(item.id, 'item', e.target.value)} />
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
                    <button type="button" className="btn-add-line" onClick={addLine}>+ Add line</button>
                </div>
            </div>

            <div className="tip-box">
                <Lightbulb size={14} className="tip-icon" />
                <span>Tip: Type to search, use ↑↓ arrows, Enter to select. Price fields support math (e.g. 120*2)</span>
            </div>

            <div className="options-row">
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showLineNo} onChange={(e) => setInvoiceData({ ...invoiceData, showLineNo: e.target.checked })} />
                    <span>Column — Line number</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showDesc} onChange={(e) => setInvoiceData({ ...invoiceData, showDesc: e.target.checked })} />
                    <span>Column — Description</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showDiscount} onChange={(e) => setInvoiceData({ ...invoiceData, showDiscount: e.target.checked })} />
                    <span>Column — Discount</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.isTaxInclusive} onChange={(e) => setInvoiceData({ ...invoiceData, isTaxInclusive: e.target.checked })} />
                    <span>Amounts are tax inclusive</span>
                </label>
            </div>

            <div className="invoice-footer-grid">
                <div className="footer-left">
                    <div className="form-group-horiz">
                        <label>Freight / Other Charges (SAR)</label>
                        <input type="number" className="form-input-inv small-input" value={invoiceData.freightCharges} onChange={(e) => setInvoiceData({ ...invoiceData, freightCharges: e.target.value })} />
                    </div>
                    <div className="form-group-horiz mt-20">
                        <label>Invoice Discount:</label>
                        <div className="discount-group">
                            <input type="number" className="form-input-inv small-input" value={invoiceData.discountValue} onChange={(e) => setInvoiceData({ ...invoiceData, discountValue: e.target.value })} />
                            <div className="select-wrapper-inv" style={{ width: '100px' }}>
                                <select className="form-input-inv" value={invoiceData.discountType} onChange={(e) => setInvoiceData({ ...invoiceData, discountType: e.target.value })}>
                                    <option>Fixed (S..</option>
                                    <option>Percentage</option>
                                </select>
                                <ChevronDown size={14} className="select-icon-inv" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="footer-right">
                    <div className="summary-card">
                        <div className="summary-row">
                            <span>Subtotal:</span>
                            <span>SAR {totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Total Tax (VAT):</span>
                            <span>SAR {totals.totalTax.toFixed(2)}</span>
                        </div>
                        <div className="summary-row grand-total-row">
                            <span>Grand Total:</span>
                            <span className="grand-total-val">SAR {totals.grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="notes-section">
                <label className="form-label-inv">Notes</label>
                <textarea className="form-input-inv notes-area" placeholder="Internal notes" value={invoiceData.notes} onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })} />
            </div>
        </div>
    );

    return (
        <div className="sales-page module-container">
            <div className="sales-sub-nav">
                {visibleSubTabs.map((t) => (
                    <NavLink key={t.path} to={`/admin/sales/${t.path}`} className={({ isActive }) => `sales-sub-tab ${isActive ? 'active' : ''}`}>
                        {t.label}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'workshop-sales' && <WorkshopSales />}

            {activeSub === 'suppliers-warehouse-sales' && <SuppliersWarehouseSales />}

            {activeSub === 'corporate-transactions' && <CorporateTransactions />}

            {activeSub === 'receipts' && (
                <>
                    <header className="sales-invoices-header">
                        <div>
                            <h1 className="sales-invoices-title">Receipts</h1>
                            <p className="sales-invoices-count">Payment receipts and records</p>
                        </div>
                        <button type="button" className="btn-portal"><Plus size={16} /> New Receipt</button>
                    </header>
                    <div className="sales-empty">
                        <p>No receipts found. Create a receipt from a sale or payment.</p>
                    </div>
                </>
            )}

            {activeSub === 'sales-reports' && <SalesReports />}
            {activeSub === 'sales-orders' && <SalesOrders />}

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title="New Sales Invoice"
                        onClose={() => setIsModalOpen(false)}
                        className="invoice-modal-mega"
                        footer={
                            <div className="modal-footer-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit-inv" onClick={handleCreateInvoice}>Create Invoice</button>
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
