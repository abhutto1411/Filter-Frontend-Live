import React from 'react';
import { Layers } from 'lucide-react';

const statusConfig = {
    completed: { bg: 'var(--pos-status-complete-bg)', color: 'var(--pos-status-complete-text)', label: 'COMPLETED' },
    invoiced: { bg: 'var(--pos-status-complete-bg)', color: 'var(--pos-status-complete-text)', label: 'INVOICED' },
    ready_for_invoice: { bg: 'var(--pos-status-complete-bg)', color: 'var(--pos-status-complete-text)', label: 'READY' },
    cancelled: { bg: 'var(--pos-status-cancelled-bg)', color: 'var(--pos-status-cancelled-text)', label: 'CANCELLED' },
    in_progress: { bg: 'var(--pos-status-progress-bg)', color: 'var(--pos-status-progress-text)', label: 'IN PROGRESS' },
    draft: { bg: 'rgba(71, 85, 105, 0.1)', color: '#475569', label: 'DRAFT' },
    active: { bg: 'var(--pos-status-pending-bg)', color: 'var(--pos-status-pending-text)', label: 'ACTIVE' },
};

export default function OrderTile({ order, isSelected, onClick }) {
    const status = (order.status || 'active').toLowerCase();
    const config = statusConfig[status] || statusConfig.active;

    return (
        <button 
            onClick={onClick}
            className={`order-tile-modern ${isSelected ? 'selected' : ''}`}
        >
            <div className="order-tile-header">
                <span className="order-number">#{String(order.orderNumber).toUpperCase()}</span>
                <div className="order-badges">
                    <span className="badge-jobs">
                        <Layers size={10} /> {order.jobsCount}
                    </span>
                    <span 
                        className="badge-status" 
                        style={{ backgroundColor: config.bg, color: config.color }}
                    >
                        {config.label}
                    </span>
                </div>
            </div>
            
            <div className="order-tile-details">
                <p className="order-plate">{order.plateNumber || 'NO PLATE'}</p>
                <p className="order-customer">{order.customerName}</p>
            </div>
            
            <div className="order-tile-footer">
                <span className="order-total">SAR {order.total.toFixed(2)}</span>
                {order.createdAt && (
                    <span className="order-time">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        </button>
    );
}
