import React, { useState } from 'react';
import { Lock, LogOut } from 'lucide-react';
import Modal from '../Modal';
import { forceClosePosSession } from '../../services/workshopStaffApi';

const CATEGORIES = [
    { key: 'cash', label: 'Cash Account' },
    { key: 'bank', label: 'Bank / Cards' },
    { key: 'corporate', label: 'Corporate' },
    { key: 'tamara', label: 'Tamara' },
    { key: 'tabby', label: 'Tabby' },
    { key: 'others', label: 'Others' },
];

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Empty or invalid input → 0 (same as POS store closing). */
const parsePhysical = (value) => {
    if (value === '' || value == null) return 0;
    const n = parseFloat(String(value).trim());
    return Number.isFinite(n) ? Math.max(0, n) : 0;
};

function ReconResultTable({ reconciliation, grossSystemSales, systemTotalSales, salesReturnsTotal, totalDifference }) {
    const rows = [
        { label: 'Cash Account', key: 'physicalCash' },
        { label: 'Bank / Cards', key: 'bankCardSlips' },
        { label: 'Corporate', key: 'corporateInvoice' },
        { label: 'Tamara', key: 'tamaraCredits' },
        { label: 'Tabby', key: 'tabbyCredits' },
        { label: 'Others', key: 'others' },
    ];

    return (
        <div>
            <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '0.9rem' }}>Reconciliation</p>
            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ margin: 0 }}>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th style={{ textAlign: 'right' }}>System (gross)</th>
                            <th style={{ textAlign: 'right' }}>Physical</th>
                            <th style={{ textAlign: 'right' }}>Diff (net)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ label, key }) => {
                            const line = reconciliation?.[key] || {};
                            const diff = toNum(line.difference);
                            const diffColor = Math.abs(diff) < 0.01 ? 'var(--color-text-muted)' : diff < 0 ? '#B91C1C' : '#15803D';
                            return (
                                <tr key={key}>
                                    <td>{label}</td>
                                    <td style={{ textAlign: 'right' }}>{toNum(line.systemGross ?? line.system).toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{toNum(line.physical).toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: diffColor }}>
                                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {toNum(salesReturnsTotal) > 0.001 && (
                <p style={{ margin: '12px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Sales returns: SAR {toNum(salesReturnsTotal).toFixed(2)} · Gross SAR {toNum(grossSystemSales).toFixed(2)} · Net SAR {toNum(systemTotalSales).toFixed(2)}
                </p>
            )}
            <div
                style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: Math.abs(toNum(totalDifference)) < 0.01 ? '#DCFCE7' : '#FFF7ED',
                    border: `1px solid ${Math.abs(toNum(totalDifference)) < 0.01 ? '#86EFAC' : '#FDBA74'}`,
                }}
            >
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem' }}>
                    {Math.abs(toNum(totalDifference)) < 0.01
                        ? 'Shift balanced'
                        : `Total difference: SAR ${toNum(totalDifference).toFixed(2)}`}
                </p>
            </div>
        </div>
    );
}

export default function ForceCashierLogoutModal({ counter, onClose, onCompleted }) {
    const [step, setStep] = useState('form');
    const [closeResult, setCloseResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [counts, setCounts] = useState({
        cash: '',
        bank: '',
        corporate: '',
        tamara: '',
        tabby: '',
        others: '',
    });
    const [notes, setNotes] = useState('');

    const posSessionId = counter?.posSessionId;

    const handleCloseShift = async () => {
        setSubmitting(true);
        setError('');
        try {
            const body = {
                physicalCash: parsePhysical(counts.cash),
                physicalBank: parsePhysical(counts.bank),
                physicalCorporate: parsePhysical(counts.corporate),
                physicalTamara: parsePhysical(counts.tamara),
                physicalTabby: parsePhysical(counts.tabby),
                physicalOthers: parsePhysical(counts.others),
                clientClosedAt: new Date().toISOString(),
            };
            if (notes.trim()) body.notes = notes.trim();

            const res = await forceClosePosSession(posSessionId, body);
            if (!res?.success) {
                throw new Error(res?.message || 'Force close failed.');
            }
            setCloseResult(res);
            setStep('result');
        } catch (err) {
            setError(err.message || 'Failed to close shift.');
        } finally {
            setSubmitting(false);
        }
    };

    const title = step === 'result'
        ? `Store closing — ${counter?.cashierName || 'Cashier'}`
        : `Force logout — ${counter?.cashierName || 'Cashier'}`;

    const footer = step === 'result' ? (
        <button type="button" className="btn-portal" onClick={onCompleted}>
            <LogOut size={14} /> Logout cashier
        </button>
    ) : (
        <>
            <button type="button" className="btn-portal" onClick={onClose} disabled={submitting} style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid #e2e8f0' }}>
                Cancel
            </button>
            <button type="button" className="btn-portal" onClick={handleCloseShift} disabled={submitting}>
                <Lock size={14} /> {submitting ? 'Closing shift…' : 'Close shift'}
            </button>
        </>
    );

    return (
        <Modal
            title={title}
            onClose={step === 'result' ? undefined : onClose}
            disableClose={submitting}
            footer={footer}
            width={640}
            contentClassName="force-cashier-logout-modal"
        >
            {error && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#FEE2E2', color: '#B91C1C', fontSize: '0.85rem' }}>
                    {error}
                </div>
            )}

            {step === 'form' && (
                <>
                    <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: '0.95rem' }}>Physical counts</p>
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                            {CATEGORIES.map((c) => (
                                <div key={c.key}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                                        {c.label} (SAR)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={counts[c.key]}
                                        onChange={(e) => setCounts((prev) => ({ ...prev, [c.key]: e.target.value }))}
                                        placeholder="0.00"
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '11px 14px',
                                            border: '1.5px solid #e5e7eb',
                                            borderRadius: 10,
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            fontFamily: 'inherit',
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Notes (optional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Reason for force logout, discrepancies, etc."
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '11px 14px',
                                    border: '1.5px solid #e5e7eb',
                                    borderRadius: 10,
                                    fontSize: '0.88rem',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    minHeight: 70,
                                }}
                            />
                        </div>
                    </div>
                </>
            )}

            {step === 'result' && closeResult && (
                <ReconResultTable
                    reconciliation={closeResult.reconciliation}
                    grossSystemSales={closeResult.grossSystemSales}
                    systemTotalSales={closeResult.systemTotalSales}
                    salesReturnsTotal={closeResult.salesReturnsTotal}
                    totalDifference={closeResult.totalDifference}
                />
            )}
        </Modal>
    );
}
