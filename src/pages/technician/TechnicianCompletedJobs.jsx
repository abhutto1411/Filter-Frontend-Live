import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function TechnicianCompletedJobs({ orders }) {
    const completedOrders = orders.filter(o => o.order_status === 'completed' || o.workflow_status === 'invoice_generated');

    return (
        <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14 }}>Completed Jobs ({completedOrders.length})</h3>
            {completedOrders.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <CheckCircle2 size={48} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No completed jobs yet</p>
                </div>
            ) : (
                <div className="ws-section">
                    <table className="ws-table">
                        <thead><tr><th>Order</th><th>Customer</th><th>Vehicle</th><th>Total</th><th>Commission</th><th>Status</th></tr></thead>
                        <tbody>
                            {completedOrders.map(o => (
                                <tr key={o.id}>
                                    <td><strong>#{o.order_number}</strong></td>
                                    <td>{o.customer_name || 'Walk-in'}</td>
                                    <td>{o.vehicle_plate || '–'}</td>
                                    <td>SAR {(o.grand_total || 0).toFixed(2)}</td>
                                    <td style={{ color: '#16A34A', fontWeight: 600 }}>SAR {(o.commission_amount || 0).toFixed(2)}</td>
                                    <td><span className="ws-badge ws-badge--green">Completed</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
