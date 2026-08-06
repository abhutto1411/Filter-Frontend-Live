import React, { useState } from 'react';
import { Clock, CheckCircle, DollarSign, UserCheck, Download } from 'lucide-react';
import Modal from '../../components/Modal';
import '../../styles/admin/ReferralCommissionsPage.css';

export default function ReferralCommissionsPage() {
    const [branchFilter, setBranchFilter] = useState('All Branches');
    const [employeeFilter, setEmployeeFilter] = useState('All Employees');
    const [statusFilter, setStatusFilter] = useState('All');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const isAr = localStorage.getItem('portal-locale') === 'ar';

    const [commissions, setCommissions] = useState([
        { id: 1, employee: 'Darrell Steward', date: '2026-03-20', jobCard: 'JC-8829', service: 'Full Synthetic Oil Change', amount: 45.00, status: 'Accrued', payoutRef: '-' },
        { id: 2, employee: 'Wade Warren', date: '2026-03-21', jobCard: 'JC-8830', service: 'Brake Pad Replacement', amount: 32.50, status: 'Accrued', payoutRef: '-' },
        { id: 3, employee: 'Brooklyn Simmons', date: '2026-03-21', jobCard: 'JC-8831', service: 'Tire Rotation & Balance', amount: 15.00, status: 'Paid', payoutRef: 'PAY-001' },
        { id: 4, employee: 'Guy Hawkins', date: '2026-03-22', jobCard: 'JC-8832', service: 'AC System Diagnostic', amount: 25.00, status: 'Accrued', payoutRef: '-' },
        { id: 5, employee: 'Robert Fox', date: '2026-03-22', jobCard: 'JC-8833', service: 'Wheel Alignment', amount: 20.00, status: 'Accrued', payoutRef: '-' },
        { id: 6, employee: 'Esther Howard', date: '2026-03-23', jobCard: 'JC-8834', service: 'Air Filter Replacement', amount: 12.00, status: 'Accrued', payoutRef: '-' },
    ]);

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [payoutModalOpen, setPayoutModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState('');

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const accruedOnly = commissions.filter(c => c.status === 'Accrued');
        if (selectedIds.size === accruedOnly.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(accruedOnly.map(c => c.id)));
        }
    };

    const stats = {
        total: commissions.length,
        accrued: commissions.filter(c => c.status === 'Accrued').reduce((sum, c) => sum + c.amount, 0),
        paid: commissions.filter(c => c.status === 'Paid').reduce((sum, c) => sum + c.amount, 0),
        selected: Array.from(selectedIds).reduce((sum, id) => {
            const c = commissions.find(item => item.id === id);
            return sum + (c ? c.amount : 0);
        }, 0)
    };

    const confirmPayout = () => {
        if (!selectedAccount) return;
        
        const payoutRef = `PAY-${Math.floor(1000 + Math.random() * 9000)}`;
        setCommissions(prev => prev.map(c => {
            if (selectedIds.has(c.id)) {
                return { ...c, status: 'Paid', payoutRef };
            }
            return c;
        }));
        
        setSelectedIds(new Set());
        setPayoutModalOpen(false);
        setSelectedAccount('');
    };

    const ACCOUNTS = [
        "Cash Register — Riyadh — SAR 18,500",
        "Al Rajhi Bank — Riyadh — SAR 198,500",
        "Cash Register — Jeddah — SAR 13,200",
        "Petty Cash — Dammam — SAR 3,800",
        "SNB Bank — Jeddah — SAR 114,250",
        "Bank — SAR 1,500"
    ];

    return (
        <div className="commissions-page module-container">
            <header className="commissions-header">
                <h1 className="commissions-title">{isAr ? 'العمولات' : 'Commission'}</h1>
                <p className="commissions-subtitle">
                    {isAr ? 'تتبع وإدارة استحقاقات ومدفوعات عمولات الموظفين' : 'Track and manage employee commission accruals and payouts'}
                </p>
            </header>

            <div className="commissions-stats">
                <div className="stat-card">
                    <span className="stat-label">Total Records</span>
                    <span className="stat-val">{stats.total}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label"><Clock size={14} className="icon-accrued"/> Accrued</span>
                    <span className="stat-val accrued">SAR {stats.accrued.toFixed(2)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label"><CheckCircle size={14} className="icon-paid"/> Paid</span>
                    <span className="stat-val paid">SAR {stats.paid.toFixed(2)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label"><DollarSign size={14} className="icon-selected"/> Selected</span>
                    <span className="stat-val selected">SAR {stats.selected.toFixed(2)}</span>
                </div>
            </div>

            <div className="commissions-controls-row">
                <div className="filter-group">
                    <div className="filter-item">
                        <label>Branch</label>
                        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                            <option value="All Branches">All Branches</option>
                        </select>
                    </div>
                    <div className="filter-item">
                        <label>Employee</label>
                        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
                            <option value="All Employees">All Employees</option>
                        </select>
                    </div>
                    <div className="filter-item status-filter">
                        <label>Status</label>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="All">All</option>
                        </select>
                    </div>
                    <div className="filter-item date-input">
                        <label>From</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div className="filter-item date-input">
                        <label>To</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                </div>
                
                <div className="action-buttons">
                    <button className="btn-select-all" onClick={toggleSelectAll}>
                        <UserCheck size={16} /> Select All
                    </button>
                    <button 
                        className="btn-generate-payout" 
                        onClick={() => selectedIds.size > 0 && setPayoutModalOpen(true)}
                        disabled={selectedIds.size === 0}
                        style={{ opacity: selectedIds.size === 0 ? 0.6 : 1, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer' }}
                    >
                        <Download size={16} /> Generate Payout ({selectedIds.size > 0 ? selectedIds.size : 'Selected'})
                    </button>
                </div>
            </div>

            <div className="commissions-table-container">
                <table className="commissions-table">
                    <thead>
                        <tr>
                            <th className="checkbox-col"><input type="checkbox" /></th>
                            <th>EMPLOYEE</th>
                            <th>DATE</th>
                            <th>JOB CARD</th>
                            <th>SERVICE</th>
                            <th>COMMISSION</th>
                            <th>STATUS</th>
                            <th>PAYOUT REF</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commissions.length === 0 ? (
                            <tr><td colSpan="8" className="empty-state">No commissions found</td></tr>
                        ) : (
                            commissions.map(c => (
                                <tr key={c.id}>
                                    <td className="checkbox-col">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.has(c.id)} 
                                            onChange={() => c.status === 'Accrued' && toggleSelect(c.id)}
                                            disabled={c.status !== 'Accrued'}
                                        />
                                    </td>
                                    <td>{c.employee}</td>
                                    <td>{c.date}</td>
                                    <td>{c.jobCard}</td>
                                    <td>{c.service}</td>
                                    <td style={{ fontWeight: 600 }}>SAR {c.amount.toFixed(2)}</td>
                                    <td>
                                        <span className={`status-badge ${c.status.toLowerCase()}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td>{c.payoutRef}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {payoutModalOpen && (
                <Modal 
                    title="Confirm Commission Payout" 
                    onClose={() => setPayoutModalOpen(false)}
                    footer={(
                        <div className="modal-footer-actions">
                            <button className="btn-secondary" onClick={() => setPayoutModalOpen(false)}>Cancel</button>
                            <button 
                                className="btn-confirm-payout" 
                                onClick={confirmPayout}
                                disabled={!selectedAccount}
                            >
                                Confirm Payout
                            </button>
                        </div>
                    )}
                >
                    <div className="payout-modal-body">
                        <div className="payout-summary-box">
                            <span className="summary-label">Payout Summary</span>
                            <span className="summary-count">{selectedIds.size} commission(s)</span>
                            <span className="summary-amount">SAR {stats.selected.toFixed(2)}</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Cash / Bank Account (Credit)</label>
                            <select 
                                className="form-input-field"
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                            >
                                <option value="">Select account...</option>
                                {ACCOUNTS.map(acc => (
                                    <option key={acc} value={acc}>{acc}</option>
                                ))}
                            </select>
                        </div>

                        <p className="journal-footnote">
                            Journal: Dr Commission Payable / Cr Selected Account
                        </p>
                    </div>
                </Modal>
            )}
        </div>
    );
}
