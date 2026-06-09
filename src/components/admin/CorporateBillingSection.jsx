import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileText, Loader, Printer, Search } from 'lucide-react';
import Modal from '../Modal';
import {
    generateCorporateBill,
    getCorporateBillingStatement,
    getCustomers,
} from '../../services/superAdminApi';

function mapCorporateCustomers(d) {
    return (Array.isArray(d) ? d : (d?.customers ?? []))
        .filter((c) => c.customerType === 'corporate' || c.corporateAccount)
        .map((c) => ({
            id: String(c.id ?? ''),
            corporateAccountId: c.corporateAccount?.id != null ? String(c.corporateAccount.id) : '',
            workshopName: c.workshopName ?? '—',
            name: c.corporateAccount?.companyName ?? c.name ?? '—',
            mobile: c.mobile ?? '—',
            contactPerson: c.corporateAccount?.contactPerson ?? '—',
        }));
}

function defaultBillingRange() {
    const now = new Date();
    const endY = now.getFullYear();
    const endM = now.getMonth();
    const endDay = new Date(endY, endM + 1, 0).getDate();
    const start = new Date(endY, endM - 11, 1);
    const pad = (n) => String(n).padStart(2, '0');
    return {
        startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
        endDate: `${endY}-${pad(endM + 1)}-${pad(endDay)}`,
    };
}

function fmtMoney(n) {
    return Number(n ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function fmtCellAmount(val) {
    if (val == null || val === '') return '—';
    return fmtMoney(val);
}

export default function CorporateBillingSection() {
    const printRef = useRef(null);
    const loadRequestRef = useRef(0);
    const defaultRange = useMemo(() => defaultBillingRange(), []);

    const [accounts, setAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [startDate, setStartDate] = useState(defaultRange.startDate);
    const [endDate, setEndDate] = useState(defaultRange.endDate);
    const [dueDate, setDueDate] = useState('');
    const [statement, setStatement] = useState(null);
    const [statementLoading, setStatementLoading] = useState(false);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [generateDueDate, setGenerateDueDate] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setAccountsLoading(true);
        getCustomers({ customerType: 'corporate' })
            .then((d) => setAccounts(mapCorporateCustomers(d)))
            .catch(() => setAccounts([]))
            .finally(() => setAccountsLoading(false));
    }, []);

    const filteredAccounts = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return accounts;
        return accounts.filter((a) =>
            [a.name, a.mobile, a.contactPerson, a.workshopName]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q)),
        );
    }, [accounts, search]);

    const selectedAccount = useMemo(
        () => accounts.find((a) => a.corporateAccountId === selectedAccountId) ?? null,
        [accounts, selectedAccountId],
    );

    const loadStatement = useCallback(async (corpId, range = {}) => {
        if (!corpId) {
            setStatement(null);
            return;
        }
        const sd = range.startDate ?? startDate;
        const ed = range.endDate ?? endDate;
        if (sd && ed && sd > ed) {
            setStatement(null);
            setError('From date must be on or before To date');
            return;
        }
        const reqId = ++loadRequestRef.current;
        setStatementLoading(true);
        setError('');
        try {
            const res = await getCorporateBillingStatement({
                corporateAccountId: corpId,
                startDate: sd,
                endDate: ed,
                dueDate: (range.dueDate ?? dueDate) || undefined,
            });
            if (reqId !== loadRequestRef.current) return;
            setStatement(res);
            if (range.dueDate) setDueDate(range.dueDate);
        } catch (e) {
            if (reqId !== loadRequestRef.current) return;
            setStatement(null);
            setError(e?.message || 'Failed to load billing statement');
        } finally {
            if (reqId === loadRequestRef.current) {
                setStatementLoading(false);
            }
        }
    }, [startDate, endDate, dueDate]);

    useEffect(() => {
        if (!selectedAccountId) {
            setStatement(null);
            return;
        }
        void loadStatement(selectedAccountId, { startDate, endDate });
    }, [selectedAccountId, startDate, endDate, loadStatement]);

    const openAccount = (corporateAccountId) => {
        if (!corporateAccountId) return;
        setSelectedAccountId(corporateAccountId);
        setDueDate('');
        setError('');
    };

    const backToList = () => {
        setSelectedAccountId('');
        setStatement(null);
        setDueDate('');
        setError('');
    };

    const handleGenerateBill = async () => {
        if (!selectedAccountId || !generateDueDate.trim()) return;
        setGenerating(true);
        setError('');
        try {
            const res = await generateCorporateBill({
                corporateAccountId: selectedAccountId,
                startDate,
                endDate,
                dueDate: generateDueDate.trim(),
            });
            setStatement(res);
            setDueDate(generateDueDate.trim());
            setGenerateOpen(false);
            if (res?.bill?.billNo) {
                alert(`Bill generated and sent to corporate portal: ${res.bill.billNo}`);
            }
        } catch (e) {
            setError(e?.message || 'Failed to generate bill');
        } finally {
            setGenerating(false);
        }
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Corporate Billing — ${selectedAccount?.name ?? ''}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
                        h1 { font-size: 22px; margin: 0 0 4px 0; }
                        .sub { font-size: 13px; color: #6B7280; margin-bottom: 20px; }
                        .kpi-line { font-size: 13px; margin: 6px 0; font-weight: 600; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        th { text-align: left; padding: 8px 6px; border-bottom: 2px solid #E5E7EB; font-size: 10px; text-transform: uppercase; color: #6B7280; }
                        td { padding: 8px 6px; border-bottom: 1px solid #F3F4F6; }
                        .num { text-align: right; }
                        @media print { body { padding: 16px; } }
                    </style>
                </head>
                <body>${content.innerHTML}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
    };

    const kpis = statement?.kpis;
    const rows = statement?.rows ?? [];
    const periodLabel = statement?.period
        ? `${statement.period.startDate} — ${statement.period.endDate}`
        : `${startDate} — ${endDate}`;

    /* ── Step 1: corporate accounts list only ── */
    if (!selectedAccountId) {
        return (
            <>
                <header className="corporate-billing-header">
                    <div>
                        <h1 className="corporate-billing-title">Corporate Billing</h1>
                        <p className="corporate-billing-subtitle">
                            Select a corporate account to view monthly billing
                        </p>
                    </div>
                </header>

                <div className="billing-search-row">
                    <div className="search-bar-mini">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search corporate accounts…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <section className="premium-table corporate-billing-accounts-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">COMPANY</th>
                                <th className="table-th">CONTACT</th>
                                <th className="table-th">WORKSHOP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accountsLoading ? (
                                <tr>
                                    <td colSpan={3} className="table-cell table-empty">
                                        <Loader size={18} className="spin" /> Loading…
                                    </td>
                                </tr>
                            ) : filteredAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="table-cell table-empty">No corporate accounts.</td>
                                </tr>
                            ) : (
                                filteredAccounts.map((a) => (
                                    <tr
                                        key={a.corporateAccountId || a.id}
                                        className="table-row corporate-billing-account-row"
                                        onClick={() => openAccount(a.corporateAccountId)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') openAccount(a.corporateAccountId);
                                        }}
                                    >
                                        <td className="table-cell">
                                            <div className="cell-main-text">{a.name}</div>
                                        </td>
                                        <td className="table-cell">
                                            <div className="cell-main-text">{a.contactPerson}</div>
                                            <div className="cell-sub-text">{a.mobile}</div>
                                        </td>
                                        <td className="table-cell">{a.workshopName}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </section>
            </>
        );
    }

    /* ── Step 2: billing detail for selected corporate ── */
    return (
        <>
            <button type="button" className="corporate-billing-back-btn" onClick={backToList}>
                <ArrowLeft size={18} /> Back to corporate list
            </button>

            <section className="corporate-billing-detail">
                <div className="corporate-billing-detail-header">
                    <div>
                        <h1 className="corporate-billing-title">{selectedAccount?.name ?? 'Corporate Billing'}</h1>
                        <p className="corporate-billing-detail-sub">
                            Monthly billing statement · {selectedAccount?.workshopName ?? '—'}
                        </p>
                    </div>
                    <div className="corporate-billing-detail-actions">
                        <label className="billing-date-field">
                            <span>From</span>
                            <input
                                type="date"
                                value={startDate}
                                max={endDate || undefined}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </label>
                        <label className="billing-date-field">
                            <span>To</span>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </label>
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={() => {
                                setGenerateDueDate(dueDate || '');
                                setGenerateOpen(true);
                            }}
                        >
                            <FileText size={16} /> Generate Bill
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handlePrint}
                            disabled={!statement || statementLoading}
                        >
                            <Printer size={16} /> Print PDF
                        </button>
                    </div>
                </div>

                {error && <p className="billing-error">{error}</p>}

                {statementLoading ? (
                    <div className="billing-empty">
                        <Loader size={24} className="spin" />
                        <p>Loading statement…</p>
                    </div>
                ) : statement ? (
                    <>
                        <div className="billing-stats">
                            <div className="billing-stat-card">
                                <span className="billing-stat-label">Total Invoice Amount</span>
                                <span className="billing-stat-val">SAR {fmtMoney(kpis?.totalInvoiceAmount)}</span>
                            </div>
                            <div className="billing-stat-card">
                                <span className="billing-stat-label">Sales Return</span>
                                <span className="billing-stat-val">SAR {fmtMoney(kpis?.totalSalesReturn)}</span>
                            </div>
                            <div className="billing-stat-card">
                                <span className="billing-stat-label">Receipts</span>
                                <span className="billing-stat-val">SAR {fmtMoney(kpis?.totalReceipts)}</span>
                            </div>
                            <div className="billing-stat-card billing-stat-balance">
                                <span className="billing-stat-label">Balance</span>
                                <span className="billing-stat-val">SAR {fmtMoney(kpis?.balance)}</span>
                            </div>
                        </div>

                        {dueDate && (
                            <p className="billing-due-date-banner">
                                Due date: <strong>{dueDate}</strong>
                            </p>
                        )}

                        <section className="premium-table corporate-billing-ledger-table">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr className="table-header-row">
                                        <th className="table-th">DATE</th>
                                        <th className="table-th">REF NO</th>
                                        <th className="table-th">VEHICLE NUMBER</th>
                                        <th className="table-th">WORKSHOP / BRANCH</th>
                                        <th className="table-th">TYPE</th>
                                        <th className="table-th billing-th-num">INVOICE AMOUNT</th>
                                        <th className="table-th billing-th-num">SALES RETURN</th>
                                        <th className="table-th billing-th-num">RECEIPTS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="table-cell table-empty">
                                                No transactions in this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((r, idx) => (
                                            <tr key={`${r.refNo}-${r.date}-${idx}`} className="table-row">
                                                <td className="table-cell">{r.date}</td>
                                                <td className="table-cell font-bold">{r.refNo}</td>
                                                <td className="table-cell">{r.vehicleNumber}</td>
                                                <td className="table-cell">{r.workshopBranch}</td>
                                                <td className="table-cell">
                                                    <span className={`billing-type-badge billing-type-${r.type.replace(/\s+/g, '-').toLowerCase()}`}>
                                                        {r.type}
                                                    </span>
                                                </td>
                                                <td className="table-cell billing-td-num">{fmtCellAmount(r.invoiceAmount)}</td>
                                                <td className="table-cell billing-td-num">{fmtCellAmount(r.salesReturn)}</td>
                                                <td className="table-cell billing-td-num">{fmtCellAmount(r.receipts)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </section>
                    </>
                ) : null}
            </section>

            <div ref={printRef} style={{ display: 'none' }} aria-hidden="true">
                <h1>Corporate Billing Statement</h1>
                <p className="sub">{statement?.corporateAccount?.companyName ?? selectedAccount?.name ?? ''}</p>
                <p className="sub">Billing for the period of {periodLabel}</p>
                {dueDate && <p className="sub">Due date: {dueDate}</p>}
                <div className="kpi-line">Total Invoice Amount: SAR {fmtMoney(kpis?.totalInvoiceAmount)}</div>
                <div className="kpi-line">Sales Return: SAR {fmtMoney(kpis?.totalSalesReturn)}</div>
                <div className="kpi-line">Receipts: SAR {fmtMoney(kpis?.totalReceipts)}</div>
                <div className="kpi-line">Balance: SAR {fmtMoney(kpis?.balance)}</div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Ref No</th>
                            <th>Vehicle Number</th>
                            <th>Workshop / Branch</th>
                            <th>Type</th>
                            <th className="num">Invoice Amount</th>
                            <th className="num">Sales Return</th>
                            <th className="num">Receipts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, idx) => (
                            <tr key={`print-${r.refNo}-${idx}`}>
                                <td>{r.date}</td>
                                <td>{r.refNo}</td>
                                <td>{r.vehicleNumber}</td>
                                <td>{r.workshopBranch}</td>
                                <td>{r.type}</td>
                                <td className="num">{fmtCellAmount(r.invoiceAmount)}</td>
                                <td className="num">{fmtCellAmount(r.salesReturn)}</td>
                                <td className="num">{fmtCellAmount(r.receipts)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {generateOpen && (
                <Modal
                    title="Generate Monthly Bill"
                    onClose={() => setGenerateOpen(false)}
                    footer={
                        <>
                            <button type="button" className="btn-secondary" onClick={() => setGenerateOpen(false)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-submit"
                                onClick={handleGenerateBill}
                                disabled={generating || !generateDueDate.trim()}
                            >
                                {generating ? (
                                    <>
                                        <Loader size={14} className="spin" /> Generating…
                                    </>
                                ) : (
                                    'Generate Bill'
                                )}
                            </button>
                        </>
                    }
                >
                    <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Period: <strong>{startDate}</strong> to <strong>{endDate}</strong>
                        <br />
                        Company: <strong>{selectedAccount?.name}</strong>
                    </p>
                    <div className="form-group">
                        <label className="form-label">Due Date *</label>
                        <input
                            type="date"
                            className="form-input-field"
                            value={generateDueDate}
                            onChange={(e) => setGenerateDueDate(e.target.value)}
                            required
                        />
                    </div>
                </Modal>
            )}
        </>
    );
}
