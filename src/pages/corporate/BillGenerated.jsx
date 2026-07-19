import { useCallback, useEffect, useState } from 'react';
import {
    Loader2,
    Download,
    Wallet,
    ChevronDown,
    ChevronUp,
    FileText,
    X,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import '../../styles/admin/CustomersPage.css';
import {
    billingStatusBadgeClass,
    fmtBillingCellAmount,
    fmtBillingMoney,
    fmtPeriodLabel,
} from '../../utils/corporateBillingFormat';
import {
    exportCorporateGeneratedBillPdf,
    formatLedgerTypeShort,
} from '../../utils/corporateArLedgerExport';

const num = (v) => `SAR ${fmtBillingMoney(v)}`;
const fmtCell = fmtBillingCellAmount;

function fmtBillPeriod(bill) {
    const start = bill?.periodStartDate;
    const end = bill?.periodEndDate;
    if (!start && !end) return 'All transactions';
    const toIso = (v) => {
        if (!v) return null;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
    };
    return fmtPeriodLabel(toIso(start), toIso(end), false);
}

const PAYMENT_METHODS = ['Wallet', 'Bank Transfer', 'Cash', 'Card', 'Cheque'];

function billStatusLabel(status) {
    if (status === 'paid') return 'Paid';
    if (status === 'awaiting_approval') return 'Awaiting approval';
    if (status === 'rejected') return 'Rejected';
    return 'Pending payment';
}

function billStatusClass(status) {
    if (status === 'paid') return 'ws-badge ws-badge--green';
    if (status === 'awaiting_approval') return 'ws-badge ws-badge--yellow';
    if (status === 'rejected') return 'ws-badge ws-badge--red';
    return 'ws-badge ws-badge--gray';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

export default function BillGenerated({ onWalletBalanceChange }) {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState('');
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [walletBal, setWalletBal] = useState(0);
    const [payOpen, setPayOpen] = useState(false);
    const [payBill, setPayBill] = useState(null);
    const [payMethod, setPayMethod] = useState('Wallet');
    const [proofFile, setProofFile] = useState(null);
    const [proofNotes, setProofNotes] = useState('');
    const [paySubmitting, setPaySubmitting] = useState(false);
    const [payError, setPayError] = useState('');
    const [pdfExporting, setPdfExporting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [billsRes, walletRes] = await Promise.all([
                apiFetch('/corporate/billing/generated-bills'),
                apiFetch('/corporate/wallet').catch(() => null),
            ]);
            setBills(Array.isArray(billsRes?.bills) ? billsRes.bills : []);
            const bal = Number(walletRes?.balance ?? walletRes?.wallet?.balance ?? 0);
            setWalletBal(bal);
            onWalletBalanceChange?.(bal);
        } catch (e) {
            setError(e?.message || 'Could not load generated bills');
            setBills([]);
        } finally {
            setLoading(false);
        }
    }, [onWalletBalanceChange]);

    useEffect(() => {
        void load();
    }, [load]);

    const openDetail = async (billId) => {
        if (expandedId === billId) {
            setExpandedId('');
            setDetail(null);
            return;
        }
        setExpandedId(billId);
        setDetailLoading(true);
        try {
            const res = await apiFetch(`/corporate/billing/generated-bills/${encodeURIComponent(billId)}`);
            setDetail(res?.bill ?? null);
        } catch (e) {
            setError(e?.message || 'Could not load bill detail');
            setDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const openPay = (bill) => {
        setPayBill(bill);
        setPayMethod(Number(walletBal) > 0.05 ? 'Wallet' : 'Bank Transfer');
        setProofFile(null);
        setProofNotes('');
        setPayError('');
        setPayOpen(true);
    };

    const handleWalletPay = async () => {
        if (!payBill?.id) return;
        setPaySubmitting(true);
        setPayError('');
        try {
            await apiFetch(
                `/corporate/billing/generated-bills/${encodeURIComponent(payBill.id)}/wallet-pay`,
                { method: 'POST' },
            );
            setPayOpen(false);
            setPayBill(null);
            await load();
            if (expandedId === payBill.id) {
                await openDetail(payBill.id);
            }
        } catch (e) {
            setPayError(e?.message || 'Wallet payment failed');
        } finally {
            setPaySubmitting(false);
        }
    };

    const handleProofPay = async () => {
        if (!payBill?.id) return;
        if (!proofFile) {
            setPayError('Upload payment proof');
            return;
        }
        setPaySubmitting(true);
        setPayError('');
        try {
            const proofImage = await readFileAsDataUrl(proofFile);
            await apiFetch(
                `/corporate/billing/generated-bills/${encodeURIComponent(payBill.id)}/payment-proof`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        paymentMethod: payMethod,
                        proofImage,
                        proofMimeType: proofFile.type || undefined,
                        proofFileName: proofFile.name || undefined,
                        notes: proofNotes.trim() || undefined,
                    }),
                },
            );
            setPayOpen(false);
            setPayBill(null);
            await load();
        } catch (e) {
            setPayError(e?.message || 'Could not submit payment proof');
        } finally {
            setPaySubmitting(false);
        }
    };

    const handleConfirmPay = () => {
        if (!payBill) return;
        if (payMethod === 'Wallet') {
            const due = Number(payBill.kpis?.balance ?? 0);
            if (due - Number(walletBal) > 0.05) {
                setPayError(`Insufficient wallet balance (available ${num(walletBal)})`);
                return;
            }
            void handleWalletPay();
            return;
        }
        void handleProofPay();
    };

    const downloadBillPdf = async (bill, statement, ledgerStatement) => {
        if (!bill) return;
        const period = fmtBillPeriod(bill);
        const rows = statement?.rows ?? [];
        const kpis = bill.kpis ?? statement?.kpis ?? {};
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;
        printWindow.document.write(`
            <!DOCTYPE html><html><head><title>${bill.billNo}</title>
            <style>
                body{font-family: 'Poppins', sans-serif;padding:32px;color:#111827}
                h1{font-size:22px;margin:0 0 4px}
                .sub{font-size:13px;color:#6B7280;margin-bottom:16px}
                .kpi{font-size:13px;margin:6px 0;font-weight:600}
                table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
                th,td{padding:8px 6px;border-bottom:1px solid #E5E7EB;text-align:left}
                .num{text-align:right}
            </style></head><body>
            <h1>Corporate Billing Statement</h1>
            <p class="sub">${bill.billNo}</p>
            <p class="sub">Billing for the period of ${period}</p>
            <p class="sub">Due date: ${bill.dueDate}</p>
            <div class="kpi">Total Invoice Amount: ${num(kpis.totalInvoiceAmount)}</div>
            <div class="kpi">Sales Return: ${num(kpis.totalSalesReturn)}</div>
            <div class="kpi">Receipts: ${num(kpis.totalReceipts)}</div>
            <div class="kpi">Balance (amount due): ${num(kpis.balance)}</div>
            ${Number(kpis.totalUnpaidInvoices ?? 0) > 0.05 ? `<div class="kpi">Unpaid invoices: ${num(kpis.totalUnpaidInvoices)}</div>` : ''}
            <table><thead><tr>
                <th>Date</th><th>Ref No</th><th>Vehicle Number</th><th>Workshop / Branch</th><th>Type</th><th>Status</th>
                <th class="num">Invoice</th><th class="num">Return</th><th class="num">Receipt</th>
            </tr></thead><tbody>
            ${rows.map((r) => `<tr>
                <td>${r.date}</td><td>${r.refNo}</td><td>${r.vehicleNumber}</td><td>${r.workshopBranch}</td><td>${r.type}</td><td>${r.status ?? '—'}</td>
                <td class="num">${fmtCell(r.invoiceAmount)}</td><td class="num">${fmtCell(r.salesReturn)}</td><td class="num">${fmtCell(r.receipts)}</td>
            </tr>`).join('')}
            </tbody></table>
            </body></html>`);
        printWindow.document.close();
        printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
    };

    const activeBill = detail ?? bills.find((b) => b.id === expandedId);
    const activeStatement = detail?.statement;
    const activeLedger = detail?.ledgerStatement;
    const ledgerLines = activeLedger?.lines ?? [];
    const ledgerSum = activeLedger?.summary ?? activeBill?.kpis ?? {};

    return (
        <div>
            <header style={{ marginBottom: 20 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    Bill Generated
                </h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', maxWidth: 640 }}>
                    Monthly bills published by Filter Super Admin. Pay the full balance or download PDF.
                </p>
            </header>

            {error ? (
                <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: '0.875rem' }}>
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Loader2 className="spin" size={32} style={{ color: '#0d9488' }} />
                </div>
            ) : bills.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 48, color: '#64748b', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                    No generated bills yet. Super Admin will publish bills here after generating them.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {bills.map((bill) => {
                        const open = expandedId === bill.id;
                        return (
                            <div
                                key={bill.id}
                                style={{
                                    background: '#fff',
                                    borderRadius: 14,
                                    border: '1px solid #e2e8f0',
                                    overflow: 'hidden',
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => openDetail(bill.id)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                        padding: '16px 18px',
                                        border: 'none',
                                        background: open ? '#f8fafc' : '#fff',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                                            {bill.billNo}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                                            Period {fmtBillPeriod(bill)} · Due {bill.dueDate}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{num(bill.kpis?.balance)}</div>
                                            <span className={billStatusClass(bill.status)}>{billStatusLabel(bill.status)}</span>
                                        </div>
                                        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </button>

                                {open && (
                                    <div style={{ padding: '0 18px 18px', borderTop: '1px solid #e2e8f0' }}>
                                        {detailLoading ? (
                                            <div style={{ padding: 24, textAlign: 'center' }}>
                                                <Loader2 className="spin" size={24} />
                                            </div>
                                        ) : activeLedger?.lines?.length || activeStatement?.rows?.length ? (
                                            <>
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                                        gap: 10,
                                                        margin: '16px 0',
                                                    }}
                                                >
                                                    {activeLedger?.lines?.length ? (
                                                        [
                                                            ['Opening', ledgerSum.openingBalance],
                                                            ['Invoices', ledgerSum.totalInvoiceAmount],
                                                            ['Receipts', ledgerSum.totalReceipts],
                                                            ['Discounts', ledgerSum.totalDiscounts],
                                                            ['Returns', ledgerSum.totalSalesReturns],
                                                            ['Closing', ledgerSum.closingBalance],
                                                        ].map(([label, val]) => (
                                                            <div key={label} style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                                                                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>{label}</div>
                                                                <div style={{ fontWeight: 800, marginTop: 4 }}>{num(val)}</div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        [
                                                            ['Invoice Amount', bill.kpis?.totalInvoiceAmount],
                                                            ['Sales Return', bill.kpis?.totalSalesReturn],
                                                            ['Receipts', bill.kpis?.totalReceipts],
                                                            ['Balance (due)', bill.kpis?.balance],
                                                        ].map(([label, val]) => (
                                                            <div key={label} style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                                                                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>{label}</div>
                                                                <div style={{ fontWeight: 800, marginTop: 4, color: label.includes('Balance') ? '#b91c1c' : '#0f172a' }}>{num(val)}</div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                                                    {activeLedger?.lines?.length ? (
                                                        <table className="ws-table" style={{ minWidth: 960 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Date</th>
                                                                    <th>Inv No.</th>
                                                                    <th>Vehicle</th>
                                                                    <th>Products &amp; Services</th>
                                                                    <th>Type</th>
                                                                    <th style={{ textAlign: 'right' }}>Excl VAT</th>
                                                                    <th style={{ textAlign: 'right' }}>VAT</th>
                                                                    <th style={{ textAlign: 'right' }}>Incl VAT</th>
                                                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                <tr>
                                                                    <td colSpan={8}><strong>Opening balance</strong></td>
                                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{num(ledgerSum.openingBalance)}</td>
                                                                </tr>
                                                                {ledgerLines.map((row) => (
                                                                    <tr key={row.id}>
                                                                        <td>{row.date}</td>
                                                                        <td>{row.invoiceNo}</td>
                                                                        <td>{row.vehicleNo}</td>
                                                                        <td>
                                                                            <div>{row.productsServicesEn ?? row.productsServices}</div>
                                                                            {row.productsServicesAr ? (
                                                                                <div style={{ fontSize: 12, color: '#64748b', direction: 'rtl' }}>{row.productsServicesAr}</div>
                                                                            ) : null}
                                                                        </td>
                                                                        <td>{formatLedgerTypeShort(row.type)}</td>
                                                                        <td style={{ textAlign: 'right' }}>{fmtCell(row.invoiceExclVat)}</td>
                                                                        <td style={{ textAlign: 'right' }}>{fmtCell(row.vat15)}</td>
                                                                        <td style={{ textAlign: 'right' }}>{fmtCell(row.invoiceInclusiveVat)}</td>
                                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{num(row.runningBalance)}</td>
                                                                    </tr>
                                                                ))}
                                                                <tr>
                                                                    <td colSpan={8}><strong>Closing balance</strong></td>
                                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{num(ledgerSum.closingBalance)}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    ) : (
                                                        <table className="ws-table" style={{ minWidth: 720 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Date</th>
                                                                    <th>Ref No</th>
                                                                    <th>Vehicle Number</th>
                                                                    <th>Workshop / Branch</th>
                                                                    <th>Type</th>
                                                                    <th>Status</th>
                                                                    <th style={{ textAlign: 'right' }}>Invoice</th>
                                                                    <th style={{ textAlign: 'right' }}>Return</th>
                                                                    <th style={{ textAlign: 'right' }}>Receipt</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(activeStatement.rows ?? []).map((r, idx) => (
                                                                    <tr key={`${r.refNo}-${idx}`}>
                                                                        <td>{r.date}</td>
                                                                        <td>{r.refNo}</td>
                                                                        <td>{r.vehicleNumber}</td>
                                                                        <td>{r.workshopBranch}</td>
                                                                        <td>{r.type}</td>
                                                                        <td>
                                                                            <span className={`billing-status-badge ${billingStatusBadgeClass(r.status)}`}>
                                                                                {r.status ?? '—'}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ textAlign: 'right' }}>{fmtCell(r.invoiceAmount)}</td>
                                                                        <td style={{ textAlign: 'right' }}>{fmtCell(r.salesReturn)}</td>
                                                                        <td style={{ textAlign: 'right' }}>{fmtCell(r.receipts)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        className="btn-portal-outline"
                                                        disabled={pdfExporting}
                                                        onClick={() => downloadBillPdf(activeBill, activeStatement, activeLedger)}
                                                    >
                                                        <Download size={16} /> {pdfExporting ? 'Generating…' : 'Download Bill PDF'}
                                                    </button>
                                                    {(bill.status === 'pending' || bill.status === 'rejected') &&
                                                    Number(bill.kpis?.balance ?? 0) > 0.05 ? (
                                                        <button
                                                            type="button"
                                                            className="btn-portal"
                                                            onClick={() => openPay(bill)}
                                                            style={{
                                                                background: 'linear-gradient(135deg,#059669,#047857)',
                                                                color: '#fff',
                                                                border: 'none',
                                                                boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                                                            }}
                                                        >
                                                            <Wallet size={16} /> Pay full bill
                                                        </button>
                                                    ) : null}
                                                </div>
                                                {bill.rejectionReason ? (
                                                    <p style={{ marginTop: 12, color: '#b91c1c', fontSize: '0.8125rem' }}>
                                                        Rejected: {bill.rejectionReason}
                                                    </p>
                                                ) : null}
                                            </>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {payOpen && payBill ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            padding: 24,
                            width: 'min(440px, 100%)',
                            boxShadow: '0 20px 40px rgba(15,23,42,0.2)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Pay full bill</h3>
                            <button
                                type="button"
                                aria-label="Close"
                                disabled={paySubmitting}
                                onClick={() => setPayOpen(false)}
                                style={{
                                    border: 'none',
                                    background: '#f1f5f9',
                                    borderRadius: 10,
                                    padding: 8,
                                    cursor: paySubmitting ? 'not-allowed' : 'pointer',
                                    lineHeight: 0,
                                    flexShrink: 0,
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.875rem' }}>
                            {payBill.billNo} · Balance <strong>{num(payBill.kpis?.balance)}</strong>
                        </p>
                        <label style={{ display: 'block', marginBottom: 12, fontSize: '0.8125rem', fontWeight: 600 }}>
                            Payment method
                            <select
                                value={payMethod}
                                onChange={(e) => setPayMethod(e.target.value)}
                                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                            >
                                {PAYMENT_METHODS.map((m) => (
                                    <option key={m} value={m}>
                                        {m}{m === 'Wallet' ? ` — ${num(walletBal)} available` : ''}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {payMethod !== 'Wallet' ? (
                            <>
                                <label style={{ display: 'block', marginBottom: 12, fontSize: '0.8125rem', fontWeight: 600 }}>
                                    Payment proof
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                                        style={{ display: 'block', marginTop: 6, width: '100%' }}
                                    />
                                </label>
                                <label style={{ display: 'block', marginBottom: 12, fontSize: '0.8125rem', fontWeight: 600 }}>
                                    Notes
                                    <textarea
                                        value={proofNotes}
                                        onChange={(e) => setProofNotes(e.target.value)}
                                        rows={2}
                                        style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                                    />
                                </label>
                            </>
                        ) : null}
                        {payError ? <p style={{ color: '#b91c1c', fontSize: '0.8125rem', margin: '0 0 12px' }}>{payError}</p> : null}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setPayOpen(false)}
                                disabled={paySubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={handleConfirmPay}
                                disabled={paySubmitting}
                                style={{
                                    background: 'linear-gradient(135deg,#059669,#047857)',
                                    color: '#fff',
                                    border: 'none',
                                    minWidth: 140,
                                    justifyContent: 'center',
                                }}
                            >
                                {paySubmitting ? (
                                    <Loader2 className="spin" size={16} />
                                ) : null}
                                Confirm payment
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
