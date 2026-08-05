import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowDownCircle,
    ArrowLeft,
    ArrowUpCircle,
    FileSpreadsheet,
    FileText,
    RefreshCw,
    Wallet,
} from 'lucide-react';
import SearchableEntityCombobox from '../SearchableEntityCombobox';
import { getWorkshopCashBankRegister } from '../../services/workshopStaffApi';
import {
    exportCashBankRegisterExcel,
    exportCashBankRegisterPdf,
} from '../../utils/cashBankRegisterExport';

function startOfMonthISO() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const REGISTER_LABELS = {
    CASH: 'Cash Register',
    BANK: 'Bank Register',
    PETTY_CASH: 'Petty Cash Register',
};

/**
 * Drill-down register for one register type (Cash / Bank / Petty Cash).
 * KPI cards filter the movement ledger; COA combobox narrows to one linked account.
 */
export default function CashBankRegisterPanel({ registerType, initialCoaAccountId = '', onClose }) {
    const [dateFrom, setDateFrom] = useState(startOfMonthISO);
    const [dateTo, setDateTo] = useState(todayISO);
    const [coaAccountId, setCoaAccountId] = useState(initialCoaAccountId || '');
    const [coaSearch, setCoaSearch] = useState('');
    const [ledgerFilter, setLedgerFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getWorkshopCashBankRegister({
                registerType,
                coaAccountId: coaAccountId || undefined,
                dateFrom,
                dateTo,
            });
            setData(res);
        } catch (e) {
            setData(null);
            setError(e?.message || 'Could not load register.');
        } finally {
            setLoading(false);
        }
    }, [registerType, coaAccountId, dateFrom, dateTo]);

    useEffect(() => {
        load();
    }, [load]);

    const coaOptions = useMemo(() => {
        const opts = data?.coaOptions ?? [];
        return [
            { id: '', label: 'All accounts in this register' },
            ...opts.map((o) => ({
                id: o.coaAccountId,
                label: o.label,
                searchText: `${o.code} ${o.name} ${o.registerName}`,
            })),
        ];
    }, [data?.coaOptions]);

    const selectedCoaLabel = useMemo(() => {
        if (!coaAccountId) return '';
        const hit = coaOptions.find((o) => String(o.id) === String(coaAccountId));
        return hit?.label ?? '';
    }, [coaAccountId, coaOptions]);

    const summary = data?.summary ?? {
        openingBalance: 0,
        totalReceipts: 0,
        totalPayments: 0,
        closingBalance: 0,
    };

    const filteredLines = useMemo(() => {
        const lines = data?.lines ?? [];
        if (ledgerFilter === 'receipts') return lines.filter((l) => l.direction === 'in');
        if (ledgerFilter === 'payments') return lines.filter((l) => l.direction === 'out');
        return lines;
    }, [data?.lines, ledgerFilter]);

    const title = REGISTER_LABELS[registerType] || 'Register';

    const exportHeader = useMemo(() => {
        const registerSlug = registerType || 'register';
        const accountLabel = selectedCoaLabel || 'All accounts in this register';
        let filterNote = '';
        if (ledgerFilter === 'receipts') filterNote = 'Receipts (IN) only';
        else if (ledgerFilter === 'payments') filterNote = 'Payments (OUT) only';
        return {
            companyName: 'FILTER ERP',
            registerTitle: title,
            registerSlug,
            accountLabel,
            accountSlug: coaAccountId || 'all_accounts',
            from: dateFrom,
            to: dateTo,
            currencyCode: 'SAR',
            filterNote: filterNote || undefined,
        };
    }, [title, registerType, selectedCoaLabel, coaAccountId, dateFrom, dateTo, ledgerFilter]);

    const handleExportPdf = () => {
        exportCashBankRegisterPdf({
            header: exportHeader,
            summary,
            lines: filteredLines,
        });
    };

    const handleExportExcel = () => {
        exportCashBankRegisterExcel({
            header: exportHeader,
            summary,
            lines: filteredLines,
        });
    };

    const exportDisabled = loading || !!error;

    return (
        <div className="cash-bank-register-panel">
            <header className="cash-bank-register-header">
                <button type="button" className="cash-bank-register-back" onClick={onClose}>
                    <ArrowLeft size={18} /> Back to Cash &amp; Bank
                </button>
                <div>
                    <h3 className="cash-bank-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wallet size={22} /> {title}
                    </h3>
                    <p className="cash-bank-desc" style={{ margin: '4px 0 0' }}>
                        Track IN (receipts) and OUT (payments) per linked Chart of Accounts account.
                    </p>
                </div>
            </header>

            <div className="cash-bank-register-filters">
                <label className="cash-bank-register-field">
                    <span>From</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                <label className="cash-bank-register-field">
                    <span>To</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </label>
                <label className="cash-bank-register-field cash-bank-register-coa">
                    <span>Chart of Accounts</span>
                    <SearchableEntityCombobox
                        className="ws-filter-combobox"
                        options={coaOptions}
                        value={coaAccountId}
                        displayText={coaSearch || selectedCoaLabel}
                        onDisplayTextChange={(t) => {
                            setCoaSearch(t);
                            if (!t.trim()) setCoaAccountId('');
                        }}
                        onSelect={(opt) => {
                            setCoaAccountId(opt?.id != null ? String(opt.id) : '');
                            setCoaSearch(opt?.label ?? '');
                        }}
                        placeholder="Type code or name — ↑↓ Enter to select"
                        entityLabel="account"
                        emptyHint="No matching COA accounts"
                    />
                </label>
                <button type="button" className="btn-portal-outline" onClick={load} disabled={loading}>
                    <RefreshCw size={16} style={{ marginRight: 6, opacity: loading ? 0.5 : 1 }} />
                    Apply
                </button>
                <button
                    type="button"
                    className="btn-portal-outline cash-bank-register-export-btn"
                    onClick={handleExportPdf}
                    disabled={exportDisabled}
                    title="Download register statement as PDF"
                >
                    <FileText size={16} style={{ marginRight: 6 }} />
                    Download PDF
                </button>
                <button
                    type="button"
                    className="btn-portal-outline cash-bank-register-export-btn"
                    onClick={handleExportExcel}
                    disabled={exportDisabled}
                    title="Download register statement as Excel"
                >
                    <FileSpreadsheet size={16} style={{ marginRight: 6 }} />
                    Download Excel
                </button>
            </div>

            {error ? (
                <p className="form-help-text" style={{ color: '#B45309' }} role="alert">{error}</p>
            ) : null}

            <div className="cash-bank-stats cash-bank-register-kpis">
                <div className="cash-bank-stat-card cash-bank-stat-card--muted">
                    <div className="cash-bank-stat-icon"><Wallet size={22} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Opening Balance</p>
                        <p className="cash-bank-stat-value">SAR {fmt(summary.openingBalance)}</p>
                        <p className="cash-bank-stat-meta">As of day before From date</p>
                    </div>
                </div>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'receipts' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'receipts' ? 'all' : 'receipts'))}
                    title="Show receipt (IN) lines only"
                >
                    <div className="cash-bank-stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                        <ArrowDownCircle size={22} />
                    </div>
                    <div>
                        <p className="cash-bank-stat-label">Total Receipts</p>
                        <p className="cash-bank-stat-value">SAR {fmt(summary.totalReceipts)}</p>
                        <p className="cash-bank-stat-meta">Click to verify IN lines</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'payments' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'payments' ? 'all' : 'payments'))}
                    title="Show payment (OUT) lines only"
                >
                    <div className="cash-bank-stat-icon" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                        <ArrowUpCircle size={22} />
                    </div>
                    <div>
                        <p className="cash-bank-stat-label">Total Payments</p>
                        <p className="cash-bank-stat-value">SAR {fmt(summary.totalPayments)}</p>
                        <p className="cash-bank-stat-meta">Click to verify OUT lines</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter('all')}
                    title="Show full ledger with closing balance"
                >
                    <div className="cash-bank-stat-icon"><Wallet size={22} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Closing Balance</p>
                        <p className="cash-bank-stat-value">SAR {fmt(summary.closingBalance)}</p>
                        <p className="cash-bank-stat-meta">GL balance as of To date</p>
                    </div>
                </button>
            </div>

            <section className="premium-table cash-bank-table">
                <table className="ws-table" style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>COA / Register</th>
                            <th>Description</th>
                            <th>Reference</th>
                            <th style={{ textAlign: 'right' }}>IN</th>
                            <th style={{ textAlign: 'right' }}>OUT</th>
                            <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="table-cell table-empty">Loading register…</td></tr>
                        ) : (
                            <>
                                <tr className="cash-bank-register-opening-row">
                                    <td colSpan={6}><strong>Opening balance</strong></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(summary.openingBalance)}</td>
                                </tr>
                                {filteredLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="table-cell table-empty">
                                            No movements in this period
                                            {ledgerFilter !== 'all' ? ` (${ledgerFilter})` : ''}.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLines.map((row) => (
                                        <tr key={row.id}>
                                            <td>{String(row.entryDate).slice(0, 10)}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>
                                                    {row.coaCode ? `[${row.coaCode}] ${row.coaName}` : row.accountName}
                                                </div>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>{row.accountName}</div>
                                            </td>
                                            <td>{row.description || '—'}</td>
                                            <td>{row.reference || row.sourceType || '—'}</td>
                                            <td style={{ textAlign: 'right', color: '#059669' }}>
                                                {row.direction === 'in' ? `SAR ${fmt(row.amount)}` : '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#DC2626' }}>
                                                {row.direction === 'out' ? `SAR ${fmt(row.amount)}` : '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>SAR {fmt(row.balance)}</td>
                                        </tr>
                                    ))
                                )}
                                <tr className="cash-bank-register-closing-row">
                                    <td colSpan={6}><strong>Closing balance</strong></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(summary.closingBalance)}</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
