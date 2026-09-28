import React from 'react';
import { Receipt, Check, Printer, Edit, Trash2, Plus, Minus, Tag, AlertCircle, User, Percent, Info } from 'lucide-react';

export default function SummaryPanel({ 
    order, 
    jobData = {},
    onMarkComplete, 
    onCancelOrder,
    onGenerateInvoice, 
    onGenerateInvoiceByOrder,
    onOpenCustomer,
    onOpenPayment,
    actionLoading,
    localPayments
}) {
    if (!order) return null;

    // Merge backend jobs with local jobData to get the current state of items
    const jobsWithItems = (order.jobs || []).map(job => {
        const key = job.id || job.jobKey;
        const local = jobData[key];
        
        // Items from backend
        const backendItems = (job.items || []).map(item => ({
            ...item,
            id: item.productId || item.serviceId || item.id,
            name: item.productName || item.product?.name || item.service?.name || item.name || 'Item',
            price: parseFloat(item.unitPrice || item.price || 0),
            qty: item.qty || 1,
            discountType: item.discountType || 'amount',
            discountValue: parseFloat(item.discountValue || item.discount || 0),
            isService: !!item.serviceId,
            allowDecimalQty: item.product?.allowDecimalQty || item.service?.allowDecimalQty || item.allowDecimalQty || false
        }));

        const displayItems = local ? local.products : backendItems;
        const backendTechs = (job.assignments || job.technicians || []).map(t => ({
            ...t,
            id: t.employeeId || t.id,
            name: t.employeeName || t.name || 'Technician'
        }));
        const displayTechs = local ? local.techs : backendTechs;

        // Global pricing for this job
        const totalDiscountType = local ? local.totalDiscountType : (job.totalDiscountType || 'amount');
        const totalDiscountValue = parseFloat(local ? local.totalDiscountValue : (job.totalDiscountValue || 0)) || 0;
        const vatRate = parseFloat(local?.VAT !== undefined && local?.VAT !== null ? local.VAT : (job.VAT !== undefined && job.VAT !== null ? job.VAT : 15));

        return {
            ...job,
            displayItems,
            displayTechs,
            totalDiscountType,
            totalDiscountValue,
            vatRate
        };
    });

    // Calculate Totals across all jobs
    let subtotalAll = 0;
    let itemDiscountsAll = 0;
    let globalDiscountsAll = 0;
    let vatAll = 0;

    jobsWithItems.forEach(job => {
        let jobSubtotal = 0;
        let jobItemDiscounts = 0;

        job.displayItems.forEach(item => {
            const rowTotal = item.price * item.qty;
            const disc = item.discountType === 'percentage' 
                ? (rowTotal * (item.discountValue || 0) / 100) 
                : (item.discountValue || 0);
            
            jobSubtotal += rowTotal;
            jobItemDiscounts += disc;
        });

        const afterItems = jobSubtotal - jobItemDiscounts;
        const jobGlobalDisc = job.totalDiscountType === 'percentage' 
            ? (afterItems * (job.totalDiscountValue || 0) / 100) 
            : (job.totalDiscountValue || 0);
        
        const taxableAmount = Math.max(0, afterItems - jobGlobalDisc);
        const jobVat = taxableAmount * (job.vatRate / 100);

        subtotalAll += jobSubtotal;
        itemDiscountsAll += jobItemDiscounts;
        globalDiscountsAll += jobGlobalDisc;
        vatAll += jobVat;
    });

    const grandTotal = subtotalAll - itemDiscountsAll - globalDiscountsAll + vatAll;
    const status = (order.status || '').toLowerCase();

    return (
        <div className="summary-panel-modern">
            <div className="summary-items-container no-scrollbar">
                <p className="summary-label">ORDER ITEMS</p>
                
                {jobsWithItems.length === 0 ? (
                    <div className="empty-summary-state">
                        <AlertCircle size={32} />
                        <p>No jobs added to this order yet.</p>
                    </div>
                ) : (
                    jobsWithItems.map(job => (
                        <div key={job.id} className="summary-job-section">
                            <div className="summary-job-header">
                                <span className="job-dept-tag">{job.departmentName || job.department?.name || job.department || 'Job'}</span>
                                <span className="job-status-pill">{job.status || 'Pending'}</span>
                            </div>
                            
                            <div className="summary-job-items">
                                {job.displayItems.length === 0 ? (
                                    <div className="no-items-card">
                                        <Info size={16} />
                                        <span>No items added to this job</span>
                                    </div>
                                ) : (
                                    job.displayItems.map(item => (
                                        <div key={item.id} className="summary-item-row-v2 read-only">
                                            <div className="item-info-main">
                                                <div className="item-name-group">
                                                    <span className="item-qty-badge">{item.qty}x</span>
                                                    <span className="item-name-v2">{item.name}</span>
                                                </div>
                                                <span className="item-price-unit">SAR {item.price.toFixed(2)}</span>
                                            </div>
                                            
                                            <div className="item-summary-details">
                                                {item.discountValue > 0 && (
                                                    <div className="item-discount-tag">
                                                        <Tag size={10} />
                                                        <span>-{item.discountType === 'percentage' ? `${item.discountValue}%` : `SAR ${item.discountValue}`}</span>
                                                    </div>
                                                )}
                                                <div className="item-row-final">
                                                    SAR {((item.price * item.qty) - (item.discountType === 'percentage' ? (item.price * item.qty * item.discountValue / 100) : (item.discountValue || 0))).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Assigned Technicians Section */}
                            <div className="summary-job-techs">
                                <div className="tech-label-row">
                                    <User size={12} />
                                    <span>Assigned Technicians</span>
                                </div>
                                <div className="tech-pills-container">
                                    {job.displayTechs?.length > 0 ? (
                                        job.displayTechs.map(t => (
                                            <span key={t.id} className="tech-summary-pill">{t.name}</span>
                                        ))
                                    ) : (
                                        <span className="no-tech-text">No technicians assigned</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="summary-quick-actions-minimal">
                <button 
                    className={`btn-summary-minimal ${ (order.customerMobile || (order.customerName && order.customerName !== 'Walk-in Customer')) ? 'completed' : ''}`}
                    onClick={() => onOpenCustomer && onOpenCustomer()}
                >
                    {(order.customerMobile || (order.customerName && order.customerName !== 'Walk-in Customer')) ? (
                        <div className="btn-content-minimal">
                            <Check size={14} />
                            <span>Customer Added</span>
                        </div>
                    ) : (
                        "Add Customer Details"
                    )}
                </button>

                <button 
                    className={`btn-summary-minimal ${ (order.paymentMethod || localPayments) ? 'completed' : ''}`}
                    onClick={() => onOpenPayment && onOpenPayment()}
                >
                    {(order.paymentMethod || localPayments) ? (
                        <div className="btn-content-minimal">
                            <Check size={14} />
                            <span>{localPayments?.method || order.paymentMethod} Selected</span>
                        </div>
                    ) : (
                        "Select Payment Method"
                    )}
                </button>
            </div>

            <div className="summary-totals-card">
                <div className="summary-rows">
                    <div className="summary-row">
                        <span>Subtotal</span>
                        <span>SAR {subtotalAll.toFixed(2)}</span>
                    </div>
                    {(itemDiscountsAll > 0 || globalDiscountsAll > 0) && (
                        <div className="summary-row" style={{ color: '#ef4444' }}>
                            <span>Discounts</span>
                            <span>- SAR {(itemDiscountsAll + globalDiscountsAll).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="summary-row">
                        <span>VAT</span>
                        <span>SAR {vatAll.toFixed(2)}</span>
                    </div>
                    <div className="summary-divider" />
                    <div className="summary-row total">
                        <span>GRAND TOTAL</span>
                        <span className="total-value">SAR {grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className="summary-actions-v3">
                <button 
                    className="btn-summary-v3 btn-outline-v3 cancel" 
                    onClick={onCancelOrder}
                    disabled={actionLoading === 'cancelling-order'}
                >
                    <Trash2 size={16} /> 
                    <span>{actionLoading === 'cancelling-order' ? 'Wait...' : 'Cancel'}</span>
                </button>

                {['active', 'in_progress'].includes(status) ? (
                    <button 
                        className="btn-summary-v3 btn-complete-v3"
                        onClick={() => {
                            const incompleteJobs = (order.jobs || []).filter(j => 
                                !['finished', 'completed'].includes((j.status || '').toLowerCase())
                            );
                            if (incompleteJobs.length > 0) {
                                // Trigger completion for all incomplete jobs sequentially or just the first if you want to be safe
                                // For now, let's complete all.
                                incompleteJobs.forEach(j => onMarkComplete(j));
                            }
                        }}
                        disabled={actionLoading}
                    >
                        <Check size={16} />
                        <span>{actionLoading ? '...' : 'Complete Order'}</span>
                    </button>
                ) : status === 'ready_for_invoice' ? (
                    <button 
                        className="btn-summary-v3 btn-invoice-v3"
                        onClick={onGenerateInvoice}
                    >
                        <Receipt size={16} />
                        <span>Invoice</span>
                    </button>
                ) : status === 'draft' ? (
                    <button 
                        className="btn-summary-v3 btn-invoice-v3"
                        onClick={onGenerateInvoiceByOrder}
                        disabled={actionLoading}
                    >
                        <Receipt size={16} />
                        <span>{actionLoading ? '...' : 'Generate Invoice'}</span>
                    </button>
                ) : (
                    <button className="btn-summary-v3 btn-complete-v3" disabled>
                        <Check size={16} />
                        <span>{status.replace('_', ' ')}</span>
                    </button>
                )}
            </div>
        </div>
    );
}


