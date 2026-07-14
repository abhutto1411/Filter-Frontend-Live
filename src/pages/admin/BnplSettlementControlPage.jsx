import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Banknote,
    Building2,
    CheckCircle2,
    FileSpreadsheet,
    FileText,
    Loader2,
    RefreshCw,
    Wallet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Modal from '../../components/Modal';
import ClickableInvoiceNo from '../../components/accounting/ClickableInvoiceNo';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';
import {
    generateBnplSettlement,
    getBnplDashboard,
    listBnplUnsettledTransactions,
    listBnplSettlementStatements,
    previewBnplSettlement,
} from '../../services/bnplSettlementApi';
import { getBranches, getWorkshops } from '../../services/superAdminApi';
import {
    exportAccountLedgerExcel,
    exportAccountLedgerPdf,
} from '../../utils/supplierLedgerExport';
import {
    loadSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from './saAccountingDateRange';
import { openInvoiceViewAndDownloadPdf } from '../../utils/posInvoiceActions';
import '../../styles/admin/AccountingPage.css';

const ACCOUNT_CODE = '1300';
const ACCOUNT_NAME = 'POS Settlement Receivable';

function fmt(n) {
    return Number(n ?? 0).toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function money(n) {
    return `SAR ${fmt(n)}`;
}

function providerLabel(p) {
    const s = String(p ?? '').toLowerCase();
    if (s === 'tabby') return 'Tabby';
    if (s === 'tamara') return 'Tamara';
    return p || '—';
}

function buildUnsettledLedgerRows(rows) {
    let balance = 0;
    return rows.map((r) => {
        const amt = Number(r.amount ?? 0);
        balance += amt;
        const date = r.paidAt?.slice?.(0, 10) ?? r.date ?? '—';
        const inv = r.invoiceNo || '—';
        return {
            id: r.paymentId,
            invoiceId: r.invoiceId,
            date,
            description: `${providerLabel(r.provider)} POS payment — Inv ${inv}`,
            provider: r.provider,
            invoiceNo: inv,
            workshopName: r.workshopName,
            branchName: r.branchName,
            workshopId: r.workshopId,
            debit: amt,
            credit: 0,
            runningBalance: balance,
        };
    });
}

function ledgerTotalsFromRows(rows, openingBalance = 0) {
    const totalDebit = rows.reduce((s, r) => s + Number(r.debit ?? 0), 0);
    const totalCredit = rows.reduce((s, r) => s + Number(r.credit ?? 0), 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;
    return {
        totalDebit,
        totalCredit,
        closingBalance,
    };
}

export default function BnplSettlementControlPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [dateFrom, setDateFrom] = useState(
        () => searchParams.get('dateFrom') || loadSaAccountingDateRange().dateFrom || startOfMonthISO(),
    );
    const [dateTo, setDateTo] = useState(
        () => searchParams.get('dateTo') || loadSaAccountingDateRange().dateTo || todayISO(),
    );
    const [provider, setProvider] = useState('all');
    const [workshopId, setWorkshopId] = useState('');
    const [branchIds, setBranchIds] = useState([]);
    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    const [tab, setTab] = useState('ledger');

    const [kpis, setKpis] = useState(null);
    const [unsettledRows, setUnsettledRows] = useState([]);
    const [statements, setStatements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pdfExporting, setPdfExporting] = useState(false);

    const [genOpen, setGenOpen] = useState(false);
    const [genProvider, setGenProvider] = useState('tabby');
    const [serviceCharge, setServiceCharge] = useState('');
    const [genNotes, setGenNotes] = useState('');
    const [preview, setPreview] = useState(null);
    const [genLoading, setGenLoading] = useState(false);
    const [genError, setGenError] = useState('');

    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceModalData, setInvoiceModalData] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState('');

    const filterParams = useMemo(
        () => ({
            dateFrom,
            dateTo,
            provider,
            ...(workshopId ? { workshopId } : {}),
            ...(branchIds.length ? { branchIds } : {}),
        }),
        [dateFrom, dateTo, provider, workshopId, branchIds],
    );

    const selectedWorkshopName = useMemo(
        () => workshops.find((w) => String(w.id) === String(workshopId))?.name
            ?? workshops.find((w) => String(w.id) === String(workshopId))?.workshopName
            ?? '',
        [workshops, workshopId],
    );

    const ledgerRows = useMemo(
        () => buildUnsettledLedgerRows(unsettledRows),
        [unsettledRows],
    );

    const ledgerTotals = useMemo(
        () => ledgerTotalsFromRows(ledgerRows, 0),
        [ledgerRows],
    );

    useEffect(() => {
        getWorkshops({ status: 'approved', limit: 500 })
            .then((res) => setWorkshops(res?.workshops ?? res?.data ?? []))
            .catch(() => setWorkshops([]));
    }, []);

    useEffect(() => {
        if (!workshopId) {
            setBranches([]);
            setBranchIds([]);
            return;
        }
        getBranches({ workshopId })
            .then((res) => setBranches(res?.branches ?? res?.data ?? []))
            .catch(() => setBranches([]));
    }, [workshopId]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const dash = await getBnplDashboard(filterParams);
            setKpis(dash?.kpis ?? null);
            const tx = await listBnplUnsettledTransactions(filterParams);
            setUnsettledRows(tx?.rows ?? []);
            const st = await listBnplSettlementStatements({ ...filterParams, limit: 200 });
            setStatements(st?.statements ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load BNPL settlement ledger.');
            setKpis(null);
            setUnsettledRows([]);
            setStatements([]);
        } finally {
            setLoading(false);
        }
    }, [filterParams]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const openGenerate = () => {
        if (!workshopId) {
            setError('Select a workshop before generating settlement.');
            return;
        }
        setGenProvider(provider === 'tamara' ? 'tamara' : 'tabby');
        setServiceCharge('');
        setGenNotes('');
        setPreview(null);
        setGenError('');
        setGenOpen(true);
    };

    const runPreview = useCallback(async () => {
        if (!workshopId) return;
        setGenLoading(true);
        setGenError('');
        try {
            const res = await previewBnplSettlement({
                workshopId,
                branchIds,
                provider: genProvider,
                dateFrom,
                dateTo,
            });
            setPreview(res?.preview ?? null);
        } catch (e) {
            setPreview(null);
            setGenError(e?.message || 'Preview failed.');
        } finally {
            setGenLoading(false);
        }
    }, [workshopId, branchIds, genProvider, dateFrom, dateTo]);

    useEffect(() => {
        if (!genOpen) return;
        void runPreview();
    }, [genOpen, runPreview]);

    const confirmGenerate = async () => {
        if (!preview) return;
        const charge = Number(serviceCharge || 0);
        if (charge > Number(preview.grossAmount)) {
            setGenError('Service charge cannot exceed gross unsettled amount.');
            return;
        }
        setGenLoading(true);
        setGenError('');
        try {
            await generateBnplSettlement({
                workshopId,
                branchIds,
                provider: genProvider,
                dateFrom,
                dateTo,
                serviceCharge: charge,
                notes: genNotes,
            });
            setGenOpen(false);
            setTab('settled');
            await loadData();
        } catch (e) {
            setGenError(e?.message || 'Settlement failed.');
        } finally {
            setGenLoading(false);
        }
    };

    const exportHeader = useMemo(
        () => ({
            companyName: 'FILTER ERP — HQ Books',
            accountCode: ACCOUNT_CODE,
            accountName: ACCOUNT_NAME,
            accountType: 'ASSET',
            from: dateFrom,
            to: dateTo,
            currencyCode: 'SAR',
            workshopName: selectedWorkshopName || 'All workshops',
            providerFilter:
                provider === 'all' ? 'Tabby & Tamara' : providerLabel(provider),
        }),
        [dateFrom, dateTo, selectedWorkshopName, provider],
    );

    const handleExportPdf = async () => {
        setPdfExporting(true);
        try {
            exportAccountLedgerPdf({
                header: exportHeader,
                openingBalance: 0,
                rows: ledgerRows.map((r) => ({
                    date: r.date,
                    description: `${r.description} · ${r.workshopName} / ${r.branchName}`,
                    debit: r.debit,
                    credit: r.credit,
                    runningBalance: r.runningBalance,
                })),
                totals: {
                    totalDebit: ledgerTotals.totalDebit,
                    totalCredit: ledgerTotals.totalCredit,
                    closingBalance: kpis?.closingBalance ?? ledgerTotals.closingBalance,
                },
            });
        } finally {
            setPdfExporting(false);
        }
    };

    const handleExportExcel = () => {
        if (tab === 'settled') {
            const aoa = [
                ['BNPL Settlement Statements — [1300] POS Settlement Receivable'],
                [`Period: ${dateFrom} to ${dateTo}`],
                [`Workshop: ${selectedWorkshopName || 'All'}`],
                [],
                [
                    'Date',
                    'Reference',
                    'Provider',
                    'Workshop',
                    'Branch',
                    'Gross',
                    'Service Charge',
                    'Net Received',
                    'Payments',
                ],
                ...statements.map((s) => [
                    s.createdAt?.slice?.(0, 10),
                    s.settlementRef,
                    s.provider,
                    s.workshopName,
                    s.branchName ?? 'All',
                    Number(s.grossAmount),
                    Number(s.serviceCharge),
                    Number(s.netReceived),
                    s.paymentCount,
                ]),
            ];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Settlements');
            XLSX.writeFile(wb, `BNPL_Settlements_${dateFrom}_${dateTo}.xlsx`);
            return;
        }

        exportAccountLedgerExcel({
            header: exportHeader,
            openingBalance: 0,
            rows: ledgerRows.map((r) => ({
                date: r.date,
                description: `${r.description} · ${r.workshopName} / ${r.branchName}`,
                debit: r.debit,
                credit: r.credit,
                runningBalance: r.runningBalance,
            })),
            totals: {
                totalDebit: ledgerTotals.totalDebit,
                totalCredit: ledgerTotals.totalCredit,
                closingBalance: kpis?.closingBalance ?? ledgerTotals.closingBalance,
            },
        });
    };

    const toggleBranch = (id) => {
        setBranchIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const netPreview = preview
        ? Number(preview.grossAmount) - Number(serviceCharge || 0)
        : 0;

    const backToCoa = () => navigate('/admin/accounting/chart-of-accounts');

    const openInvoicePdf = async (ctx) => {
        const key = ctx?.invoiceId || ctx?.invoiceNo;
        if (!key) return;
        setInvoiceLoadingId(String(key));
        setError('');
        try {
            const invoice = await openInvoiceViewAndDownloadPdf(ctx);
            setInvoiceModalData(invoice);
            setInvoiceModalOpen(true);
        } catch (e) {
            setError(e?.message || 'Could not open invoice PDF.');
        } finally {
            setInvoiceLoadingId('');
        }
    };

    return (
        <div className="corporate-ar-page bnpl-settlement-page">
            <header className="corporate-ar-header">
                <button type="button" className="cash-bank-register-back" onClick={backToCoa}>
                    <ArrowLeft size={18} /> Back to Chart of Accounts
                </button>
                <div>
                    <h2 className="cash-bank-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wallet size={22} />
                        [{ACCOUNT_CODE}] {ACCOUNT_NAME}
                    </h2>
                    <p className="cash-bank-desc" style={{ margin: '4px 0 0' }}>
                        Tabby &amp; Tamara BNPL settlement ledger — unsettled POS receivables and posted settlement batches.
                    </p>
                </div>
            </header>

            <div className="cash-bank-register-filters bnpl-settlement-filters">
                <label className="cash-bank-register-field">
                    <span>From</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                <label className="cash-bank-register-field">
                    <span>To</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </label>
                <label className="cash-bank-register-field">
                    <span>Workshop</span>
                    <select value={workshopId} onChange={(e) => setWorkshopId(e.target.value)}>
                        <option value="">All workshops</option>
                        {workshops.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name ?? w.workshopName}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="cash-bank-register-field bnpl-branch-field">
                    <span>Branches</span>
                    {!workshopId ? (
                        <p className="bnpl-branch-hint">Select a workshop to filter branches</p>
                    ) : branches.length === 0 ? (
                        <p className="bnpl-branch-hint">No branches</p>
                    ) : (
                        <div className="bnpl-branch-chips">
                            {branches.map((b) => {
                                const active = branchIds.includes(String(b.id));
                                return (
                                    <button
                                        key={b.id}
                                        type="button"
                                        className={`bnpl-branch-chip${active ? ' bnpl-branch-chip--active' : ''}`}
                                        onClick={() => toggleBranch(String(b.id))}
                                    >
                                        {b.name}
                                    </button>
                                );
                            })}
                            {branchIds.length > 0 ? (
                                <button
                                    type="button"
                                    className="bnpl-branch-clear"
                                    onClick={() => setBranchIds([])}
                                >
                                    Clear
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>
                <label className="cash-bank-register-field">
                    <span>Provider</span>
                    <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                        <option value="all">Tabby &amp; Tamara</option>
                        <option value="tabby">Tabby only</option>
                        <option value="tamara">Tamara only</option>
                    </select>
                </label>
                <button type="button" className="btn-portal-outline" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Apply
                </button>
                <button
                    type="button"
                    className="btn-portal-outline cash-bank-register-export-btn"
                    disabled={loading || pdfExporting || (tab === 'ledger' && ledgerRows.length === 0)}
                    onClick={() => void handleExportPdf()}
                >
                    <FileText size={16} style={{ marginRight: 6 }} />
                    {pdfExporting ? 'Generating…' : 'Download PDF'}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline cash-bank-register-export-btn"
                    disabled={
                        loading
                        || (tab === 'ledger' && ledgerRows.length === 0)
                        || (tab === 'settled' && statements.length === 0)
                    }
                    onClick={handleExportExcel}
                >
                    <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> Download Excel
                </button>
                <button
                    type="button"
                    className="btn-portal bnpl-generate-btn"
                    disabled={!workshopId}
                    onClick={openGenerate}
                >
                    <Banknote size={16} /> Generate Settlement
                </button>
            </div>

            {error ? <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>{error}</p> : null}

            {kpis ? (
                <div className="cash-bank-stats cash-bank-register-kpis">
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><Wallet size={22} /></div>
                        <div>
                            <p className="cash-bank-stat-label">Total Settlement Receivable</p>
                            <p className="cash-bank-stat-value">{money(kpis.totalSettlementReceivable)}</p>
                            <p className="cash-bank-stat-meta">{kpis.unsettledCount ?? 0} unsettled payments</p>
                        </div>
                    </div>
                    <div className="cash-bank-stat-card cash-bank-stat-card--muted">
                        <div className="cash-bank-stat-icon"><CheckCircle2 size={22} /></div>
                        <div>
                            <p className="cash-bank-stat-label">Total Settlements Received</p>
                            <p className="cash-bank-stat-value">{money(kpis.totalSettlementsReceived)}</p>
                            <p className="cash-bank-stat-meta">{kpis.settledStatementCount ?? 0} posted batches</p>
                        </div>
                    </div>
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><Building2 size={22} /></div>
                        <div>
                            <p className="cash-bank-stat-label">Closing Balance</p>
                            <p className="cash-bank-stat-value">{money(kpis.closingBalance)}</p>
                            <p className="cash-bank-stat-meta">Outstanding on [1300]</p>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="cash-bank-tabs">
                <button
                    type="button"
                    className={`cash-bank-tab${tab === 'ledger' ? ' active' : ''}`}
                    onClick={() => setTab('ledger')}
                >
                    Ledger Statement
                </button>
                <button
                    type="button"
                    className={`cash-bank-tab${tab === 'settled' ? ' active' : ''}`}
                    onClick={() => setTab('settled')}
                >
                    Settled Statements
                </button>
            </div>

            <p className="cash-bank-desc" style={{ margin: '0 0 12px' }}>
                Period: {dateFrom} — {dateTo}
                {selectedWorkshopName ? ` · Workshop: ${selectedWorkshopName}` : ' · All workshops'}
                {provider !== 'all' ? ` · ${providerLabel(provider)}` : ''}
            </p>

            {loading ? (
                <p className="table-empty" style={{ padding: 24 }}>
                    <Loader2 size={18} className="spin" style={{ marginRight: 8 }} /> Loading ledger…
                </p>
            ) : tab === 'ledger' ? (
                <section className="premium-table cash-bank-table corporate-ar-ledger-table">
                    <table className="ws-table" style={{ width: '100%', minWidth: 1100 }}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Provider</th>
                                <th>Invoice</th>
                                <th>Workshop</th>
                                <th>Branch</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Debit</th>
                                <th style={{ textAlign: 'right' }}>Credit</th>
                                <th style={{ textAlign: 'right' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="cash-bank-register-opening-row">
                                <td colSpan={8}><strong>Opening balance</strong></td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(0)}</td>
                            </tr>
                            {ledgerRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="table-cell table-empty">
                                        No unsettled Tabby/Tamara payments in this period.
                                    </td>
                                </tr>
                            ) : (
                                ledgerRows.map((row) => (
                                    <tr key={row.id}>
                                        <td>{row.date}</td>
                                        <td>
                                            <span className={`bnpl-provider-badge bnpl-provider-badge--${row.provider}`}>
                                                {providerLabel(row.provider)}
                                            </span>
                                        </td>
                                        <td>
                                            <ClickableInvoiceNo
                                                invoiceId={row.invoiceId}
                                                invoiceNo={row.invoiceNo}
                                                workshopId={row.workshopId}
                                                loadingId={invoiceLoadingId}
                                                onOpen={openInvoicePdf}
                                            />
                                        </td>
                                        <td>{row.workshopName}</td>
                                        <td>{row.branchName}</td>
                                        <td style={{ maxWidth: 280 }}>{row.description}</td>
                                        <td style={{ textAlign: 'right' }}>{money(row.debit)}</td>
                                        <td style={{ textAlign: 'right' }}>—</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(row.runningBalance)}</td>
                                    </tr>
                                ))
                            )}
                            <tr className="cash-bank-register-closing-row">
                                <td colSpan={8}><strong>Closing balance (unsettled receivable)</strong></td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                    {money(kpis?.closingBalance ?? ledgerTotals.closingBalance)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            ) : (
                <section className="premium-table cash-bank-table corporate-ar-ledger-table">
                    <table className="ws-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Reference</th>
                                <th>Provider</th>
                                <th>Workshop</th>
                                <th>Branch</th>
                                <th style={{ textAlign: 'right' }}>Gross</th>
                                <th style={{ textAlign: 'right' }}>Service Charge</th>
                                <th style={{ textAlign: 'right' }}>Net Received</th>
                                <th>Payments</th>
                                <th>Period</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statements.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="table-cell table-empty">
                                        No settlement statements posted yet for this filter.
                                    </td>
                                </tr>
                            ) : (
                                statements.map((s) => (
                                    <tr key={s.id}>
                                        <td>{s.createdAt?.slice?.(0, 10)}</td>
                                        <td className="cell-main-text">{s.settlementRef}</td>
                                        <td>
                                            <span className={`bnpl-provider-badge bnpl-provider-badge--${s.provider}`}>
                                                {providerLabel(s.provider)}
                                            </span>
                                        </td>
                                        <td>{s.workshopName}</td>
                                        <td>{s.branchName ?? 'All branches'}</td>
                                        <td style={{ textAlign: 'right' }}>{money(s.grossAmount)}</td>
                                        <td style={{ textAlign: 'right', color: '#DC2626' }}>{money(s.serviceCharge)}</td>
                                        <td style={{ textAlign: 'right', color: '#059669' }}>{money(s.netReceived)}</td>
                                        <td>{s.paymentCount}</td>
                                        <td>{s.periodStart} — {s.periodEnd}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </section>
            )}

            {genOpen ? (
                <Modal
                    title="Generate BNPL Settlement"
                    size="large"
                    onClose={() => setGenOpen(false)}
                    footer={
                        <>
                            <button type="button" className="btn-secondary" onClick={() => setGenOpen(false)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-submit"
                                disabled={genLoading || !preview || netPreview < 0}
                                onClick={() => void confirmGenerate()}
                            >
                                {genLoading ? 'Posting…' : 'Confirm & Post to Books'}
                            </button>
                        </>
                    }
                >
                    <div className="bnpl-gen-modal">
                        <p className="bnpl-gen-intro">
                            Post settlement for <strong>{selectedWorkshopName}</strong>
                            {branchIds.length
                                ? ` · ${branchIds.length} branch(es) selected`
                                : ' · all branches'}
                            · Period {dateFrom} — {dateTo}
                        </p>

                        <div className="bnpl-gen-provider-row">
                            <span className="bnpl-gen-label">Settlement provider</span>
                            <div className="bnpl-gen-provider-pills">
                                <button
                                    type="button"
                                    className={`bnpl-gen-pill${genProvider === 'tabby' ? ' active' : ''}`}
                                    onClick={() => setGenProvider('tabby')}
                                >
                                    Tabby
                                </button>
                                <button
                                    type="button"
                                    className={`bnpl-gen-pill${genProvider === 'tamara' ? ' active' : ''}`}
                                    onClick={() => setGenProvider('tamara')}
                                >
                                    Tamara
                                </button>
                            </div>
                        </div>

                        {genLoading && !preview ? (
                            <p className="bnpl-gen-loading"><Loader2 size={16} className="spin" /> Loading preview…</p>
                        ) : preview ? (
                            <div className="bnpl-gen-summary-grid">
                                <div className="bnpl-gen-summary-card">
                                    <span>Gross unsettled</span>
                                    <strong>{money(preview.grossAmount)}</strong>
                                </div>
                                <div className="bnpl-gen-summary-card">
                                    <span>Payments included</span>
                                    <strong>{preview.paymentCount}</strong>
                                </div>
                                <div className="bnpl-gen-summary-card bnpl-gen-summary-card--highlight">
                                    <span>Net to bank (after fee)</span>
                                    <strong>{money(netPreview)}</strong>
                                </div>
                            </div>
                        ) : (
                            <p className="form-help-text" style={{ color: '#B45309' }}>
                                No unsettled payments for this provider and selection.
                            </p>
                        )}

                        <div className="bnpl-gen-form-grid">
                            <label className="bnpl-gen-field">
                                <span>Service charge (SAR)</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={serviceCharge}
                                    onChange={(e) => setServiceCharge(e.target.value)}
                                    placeholder="Tabby / Tamara processing fee"
                                />
                                <small>Deducted from gross; auto-posted to Bank Charges [6500]</small>
                            </label>
                            <label className="bnpl-gen-field">
                                <span>Notes (optional)</span>
                                <textarea
                                    value={genNotes}
                                    onChange={(e) => setGenNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Settlement reference notes…"
                                />
                            </label>
                        </div>

                        {preview ? (
                            <div className="bnpl-gen-posting-note">
                                <strong>Journal posting:</strong> DR Bank {money(netPreview)}
                                {Number(serviceCharge || 0) > 0
                                    ? ` · DR Bank Charges ${money(serviceCharge)}`
                                    : ''}
                                · CR [1300] {money(preview.grossAmount)}
                            </div>
                        ) : null}

                        {genError ? <p className="form-help-text" style={{ color: '#DC2626' }}>{genError}</p> : null}
                    </div>
                </Modal>
            ) : null}

            <InvoiceDetailsModal
                invoice={invoiceModalData}
                isOpen={invoiceModalOpen}
                onClose={() => {
                    setInvoiceModalOpen(false);
                    setInvoiceModalData(null);
                }}
                footerVariant="corporate"
            />
        </div>
    );
}
