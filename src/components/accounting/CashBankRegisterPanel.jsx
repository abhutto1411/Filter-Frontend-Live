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
import { accT } from '../../utils/accountingI18n';

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

const REGISTER_TITLE_KEYS = {
    CASH: 'register.cash',
    BANK: 'register.bank',
    PETTY_CASH: 'register.petty',
};

/**
 * Drill-down register for one register type (Cash / Bank / Petty Cash).
 * KPI cards filter the movement ledger; COA combobox narrows to one linked account.
 */
export default function CashBankRegisterPanel({
    registerType,
    initialCoaAccountId = '',
    onClose,
    locale: localeProp,
}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

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
            setError(e?.message || t('register.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [registerType, coaAccountId, dateFrom, dateTo, t]);

    useEffect(() => {
        load();
    }, [load]);

    const allAccountsLabel = t('register.allAccounts');

    const coaOptions = useMemo(() => {
        const opts = data?.coaOptions ?? [];
        return [
            { id: '', label: allAccountsLabel },
            ...opts.map((o) => ({
                id: o.coaAccountId,
                label: o.label,
                searchText: `${o.code} ${o.name} ${o.registerName}`,
            })),
        ];
    }, [data?.coaOptions, allAccountsLabel]);

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

    const title = t(REGISTER_TITLE_KEYS[registerType] || 'register.register');

    const exportHeader = useMemo(() => {
        const registerSlug = registerType || 'register';
        const accountLabel = selectedCoaLabel || allAccountsLabel;
        let filterNote = '';
        if (ledgerFilter === 'receipts') filterNote = t('register.filter.receipts');
        else if (ledgerFilter === 'payments') filterNote = t('register.filter.payments');
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
    }, [title, registerType, selectedCoaLabel, allAccountsLabel, coaAccountId, dateFrom, dateTo, ledgerFilter, t]);

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

    const emptyMessage =
        ledgerFilter !== 'all'
            ? t('register.emptyFiltered', {
                filter: t(`register.filterKey.${ledgerFilter}`),
            })
            : t('register.empty');

    return (
        <div className="cash-bank-register-panel">
            <header className="cash-bank-register-header">
                <button type="button" className="cash-bank-register-back" onClick={onClose}>
                    <ArrowLeft size={18} /> {t('register.back')}
                </button>
                <div>
                    <h3 className="cash-bank-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wallet size={22} /> {title}
                    </h3>
                    <p className="cash-bank-desc" style={{ margin: '4px 0 0' }}>
                        {t('register.desc')}
                    </p>
                </div>
            </header>

            <div className="cash-bank-register-filters">
                <label className="cash-bank-register-field">
                    <span>{t('register.from')}</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                <label className="cash-bank-register-field">
                    <span>{t('register.to')}</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </label>
                <label className="cash-bank-register-field cash-bank-register-coa">
                    <span>{t('register.coa')}</span>
                    <SearchableEntityCombobox
                        className="ws-filter-combobox"
                        options={coaOptions}
                        value={coaAccountId}
                        displayText={coaSearch || selectedCoaLabel}
                        onDisplayTextChange={(txt) => {
                            setCoaSearch(txt);
                            if (!txt.trim()) setCoaAccountId('');
                        }}
                        onSelect={(opt) => {
                            setCoaAccountId(opt?.id != null ? String(opt.id) : '');
                            setCoaSearch(opt?.label ?? '');
                        }}
                        placeholder={t('register.coaPh')}
                        entityLabel={t('register.entityAccount')}
                        emptyHint={t('register.coaEmpty')}
                    />
                </label>
                <button type="button" className="btn-portal-outline" onClick={load} disabled={loading}>
                    <RefreshCw size={16} style={{ marginRight: 6, opacity: loading ? 0.5 : 1 }} />
                    {t('register.apply')}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline cash-bank-register-export-btn"
                    onClick={handleExportPdf}
                    disabled={exportDisabled}
                    title={t('register.pdfTitle')}
                >
                    <FileText size={16} style={{ marginRight: 6 }} />
                    {t('register.pdf')}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline cash-bank-register-export-btn"
                    onClick={handleExportExcel}
                    disabled={exportDisabled}
                    title={t('register.excelTitle')}
                >
                    <FileSpreadsheet size={16} style={{ marginRight: 6 }} />
                    {t('register.excel')}
                </button>
            </div>

            {error ? (
                <p className="form-help-text" style={{ color: '#B45309' }} role="alert">{error}</p>
            ) : null}

            <div className="cash-bank-stats cash-bank-register-kpis">
                <div className="cash-bank-stat-card cash-bank-stat-card--muted">
                    <div className="cash-bank-stat-icon"><Wallet size={22} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('register.opening')}</p>
                        <p className="cash-bank-stat-value">SAR {fmt(summary.openingBalance)}</p>
                        <p className="cash-bank-stat-meta">{t('register.openingMeta')}</p>
                    </div>
                </div>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'receipts' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'receipts' ? 'all' : 'receipts'))}
                    title={t('register.title.receipts')}
                >
                    <div className="cash-bank-stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                        <ArrowDownCircle size={22} />
                    </div>
                    <div>
                        <p className="cash-bank-stat-label">{t('register.receipts')}</p>
                        <p className="cash-bank-stat-value">SAR {fmt(summary.totalReceipts)}</p>
                        <p className="cash-bank-stat-meta">{t('register.receiptsMeta')}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'payments' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'payments' ? 'all' : 'payments'))}
                    title={t('register.title.payments')}
                >
                    <div className="cash-bank-stat-icon" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                        <ArrowUpCircle size={22} />
                    </div>
                    <div>
                        <p className="cash-bank-stat-label">{t('register.payments')}</p>
                        <p className="cash-bank-stat-value">SAR {fmt(summary.totalPayments)}</p>
                        <p className="cash-bank-stat-meta">{t('register.paymentsMeta')}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter('all')}
                    title={t('register.title.all')}
                >
                    <div className="cash-bank-stat-icon"><Wallet size={22} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('register.closing')}</p>
                        <p className="cash-bank-stat-value">SAR {fmt(summary.closingBalance)}</p>
                        <p className="cash-bank-stat-meta">{t('register.closingMeta')}</p>
                    </div>
                </button>
            </div>

            <section className="premium-table cash-bank-table">
                <table className="ws-table" style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th>{t('register.th.date')}</th>
                            <th>{t('register.th.coaReg')}</th>
                            <th>{t('register.th.desc')}</th>
                            <th>{t('register.th.ref')}</th>
                            <th style={{ textAlign: 'right' }}>{t('register.th.in')}</th>
                            <th style={{ textAlign: 'right' }}>{t('register.th.out')}</th>
                            <th style={{ textAlign: 'right' }}>{t('register.th.balance')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="table-cell table-empty">{t('register.loading')}</td></tr>
                        ) : (
                            <>
                                <tr className="cash-bank-register-opening-row">
                                    <td colSpan={6}><strong>{t('register.openingRow')}</strong></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(summary.openingBalance)}</td>
                                </tr>
                                {filteredLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="table-cell table-empty">
                                            {emptyMessage}
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
                                    <td colSpan={6}><strong>{t('register.closingRow')}</strong></td>
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
