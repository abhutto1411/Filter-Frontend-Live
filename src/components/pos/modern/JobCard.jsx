import React from 'react';
import { Package, User, Check, RefreshCw, X, Pencil, Settings, Droplets, CircleDot } from 'lucide-react';

const statusConfig = {
    finished: { bg: 'var(--pos-status-complete-bg)', color: 'var(--pos-status-complete-text)', label: 'FINISHED' },
    completed: { bg: 'var(--pos-status-complete-bg)', color: 'var(--pos-status-complete-text)', label: 'COMPLETED' },
    invoiced: { bg: 'var(--pos-status-complete-bg)', color: 'var(--pos-status-complete-text)', label: 'INVOICED' },
    edited: { bg: '#E0E7FF', color: '#3949AB', label: 'EDITED' },
    in_progress: { bg: 'var(--pos-status-progress-bg)', color: 'var(--pos-status-progress-text)', label: 'IN PROGRESS' },
    pending: { bg: 'var(--pos-status-pending-bg)', color: 'var(--pos-status-pending-text)', label: 'PENDING' },
};

export default function JobCard({
    job,
    jobData,
    onOpenModal,
    onMarkComplete,
    onCancelJob,
    actionLoading
}) {
    const statusLower = (job.status || '').toLowerCase();
    const isDone = ['finished', 'completed'].includes(statusLower);
    const isCancelled = ['cancelled', 'rejected_by_technician'].includes(statusLower);
    const isInvoiced = statusLower === 'invoiced';
    const canCancel = !!onCancelJob && !isInvoiced && !isCancelled;
    const config = statusConfig[(job.status || 'pending').toLowerCase()] || statusConfig.pending;
    
    const currentJobData = jobData || { products: [], techs: [] };
    
    // Merge backend data with local draft data
    // Backend uses 'items' for products and 'technicians' for staff
    const displayProducts = currentJobData.products.length > 0 
        ? currentJobData.products 
        : (job.items || []).map(item => ({
            ...item,
            id: item.productId || item.serviceId || item.id,
            name: item.product?.name || item.service?.name || item.name || 'Item',
            price: parseFloat(item.unitPrice || item.price || 0),
            qty: item.qty || 1
        }));

    const displayTechs = currentJobData.techs.length > 0
        ? currentJobData.techs
        : (job.technicians || []).map(t => ({
            ...t,
            id: t.employeeId || t.id,
            name: t.employee?.name || t.name || 'Technician'
        }));

    const hasProducts = displayProducts.length > 0;
    const hasTechs = displayTechs.length > 0;

    const isOil = (job.departmentName || job.department || '').toLowerCase().includes('oil');
    const isTire = (job.departmentName || job.department || '').toLowerCase().includes('tire');
    const Icon = isOil ? Droplets : (isTire ? CircleDot : Settings);

    return (
        <div className="job-card-modern">
            <div className="job-card-top">
                <div className="job-type-info">
                    <div className="job-icon-container">
                        <Icon size={20} />
                    </div>
                    <div>
                        <h3 className="job-name">{job.departmentName || job.department?.name || job.department}</h3>
                        <span 
                            className="job-status-badge"
                            style={{ backgroundColor: config.bg, color: config.color }}
                        >
                            {config.label}
                        </span>
                    </div>
                </div>
                <button
                    className="job-close-btn"
                    title={canCancel ? 'Cancel this job' : (isInvoiced ? 'Invoiced jobs cannot be cancelled' : 'Job already cancelled')}
                    disabled={!canCancel || actionLoading === `cancel-${job.id}`}
                    style={!canCancel ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!canCancel) return;
                        onCancelJob(job);
                    }}
                >
                    {actionLoading === `cancel-${job.id}` ? <RefreshCw size={16} className="animate-spin" /> : <X size={18} />}
                </button>
            </div>

            <div className="job-items-summary">
                <div className="job-item-row" onClick={() => onOpenModal('product', job)}>
                    <Package size={18} className="job-item-icon" color={hasProducts ? "var(--pos-gold)" : undefined} />
                    <div className="job-item-text">
                        {hasProducts ? `${displayProducts.length} items selected` : 'Add products/services'}
                        {hasProducts && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--pos-text-muted)' }}>
                                Total: SAR {displayProducts.reduce((s, p) => s + (p.price * (p.qty || 1)), 0).toFixed(2)}
                            </div>
                        )}
                    </div>
                    <Pencil size={14} color="var(--pos-border)" />
                </div>

                <div className="job-item-row" onClick={() => onOpenModal('technician', job)}>
                    <User size={18} className="job-item-icon" color={hasTechs ? "var(--pos-gold)" : undefined} />
                    <div className="job-item-text">
                        {hasTechs ? displayTechs.map(t => t.name).join(', ') : 'Assign technicians'}
                    </div>
                    <Pencil size={14} color="var(--pos-border)" />
                </div>
            </div>

            <div className="job-card-footer">
                <button 
                    className={`btn-complete-modern ${isDone ? 'done' : ''}`}
                    disabled={actionLoading === job.id}
                    onClick={() => onMarkComplete(job, isDone)}
                >
                    {actionLoading === job.id ? (
                        <RefreshCw size={18} className="animate-spin" />
                    ) : (
                        <Check size={18} />
                    )}
                    <span>{isDone ? 'Completed' : 'Mark Complete'}</span>
                </button>
            </div>
        </div>
    );
}
