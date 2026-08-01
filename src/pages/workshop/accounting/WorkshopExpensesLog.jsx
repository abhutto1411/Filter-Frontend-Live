import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Filter, RefreshCw, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    listLogFilterUsers,
    listPettyCashExpensesLog,
} from '../../../services/accountingLogsApi';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { ExportMenu } from '../../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../../utils/tableExport';
import { expLogT } from '../../../utils/expensesLogI18n';
import '../../../styles/admin/AccountingPage.css';

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 10000;

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function sidebarBranchToFilter(selectedBranchId) {
    return selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '';
}

function formatFilterUserLabel(u) {
    const name = u.name || u.email || u.id;
    const role = u.role ? String(u.role).replace(/_/g, ' ') : '';
    return role ? `${name} (${role})` : name;
}

function formatExpenseDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
}

function buildExpenseExportTable(list, t) {
    const headers = [
        t('th.date'),
        t('th.amount'),
        t('th.category'),
        t('th.user'),
        t('th.branch'),
        t('th.approvedBy'),
        t('th.reference'),
        t('th.description'),
    ];
    const rows = list.map((r) => [
        formatExpenseDate(r.approvedAt),
        fmt(r.amount),
        r.category?.name
            ? (r.source === 'admin_wallet' ? `${r.category.name} (${t('source.adminWallet')})` : r.category.name)
            : '—',
        r.requestedBy?.name || r.requestedBy?.email || '—',
        r.branch?.name || '—',
        r.approvedBy?.name || '—',
        r.reference || '—',
        r.description || '—',
    ]);
    return { headers, rows };
}

const emptyApplied = {
    branchId: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
};

export default function WorkshopExpensesLog({ branches = [], selectedBranchId = 'all' }) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => expLogT(locale, key, vars), [locale]);

    const [branchId, setBranchId] = useState(() => sidebarBranchToFilter(selectedBranchId));
    const [branchDisplay, setBranchDisplay] = useState('');
    const [userId, setUserId] = useState('');
    const [userDisplay, setUserDisplay] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState(() => ({
        ...emptyApplied,
        branchId: sidebarBranchToFilter(selectedBranchId),
    }));
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);

    const branchComboOptions = useMemo(() => [
        { id: 'all', label: t('opt.allBranches') },
        ...branches.map((b) => ({ id: String(b.id), label: b.name || String(b.id) })),
    ], [branches, t]);

    const userComboOptions = useMemo(() => [
        { id: 'all', label: t('opt.allUsers') },
        ...users.map((u) => ({ id: String(u.id), label: formatFilterUserLabel(u) })),
    ], [users, t]);

    const buildListParams = useCallback((filters, { limit, offset }) => ({
        branchId: filters.branchId || undefined,
        userId: filters.userId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        search: filters.search.trim() || undefined,
        limit,
        offset,
    }), []);

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listPettyCashExpensesLog(
                buildListParams(applied, {
                    limit: PAGE_SIZE,
                    offset: (page - 1) * PAGE_SIZE,
                }),
            );
            setRows(res?.items ?? []);
            setTotal(Number(res?.total ?? 0));
            const amountFromApi = Number(res?.totalAmount);
            if (Number.isFinite(amountFromApi)) {
                setTotalAmount(amountFromApi);
            } else {
                const sum = (res?.items ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
                setTotalAmount(sum);
            }
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [applied, page, buildListParams, t]);

    useEffect(() => {
        const nextBranch = sidebarBranchToFilter(selectedBranchId);
        setBranchId(nextBranch);
        setBranchDisplay('');
        setUserDisplay('');
        setApplied((prev) => ({ ...prev, branchId: nextBranch, userId: '' }));
        setUserId('');
        setPage(1);
    }, [selectedBranchId]);

    const branchScopeForUsers = branchId || undefined;

    useEffect(() => {
        listLogFilterUsers({
            branchId: branchScopeForUsers,
            walletOrCashier: true,
        })
            .then((res) => {
                const nextUsers = res?.users ?? [];
                setUsers(nextUsers);
                setUserId((prev) => {
                    if (prev && nextUsers.some((u) => String(u.id) === String(prev))) return prev;
                    setUserDisplay('');
                    return '';
                });
            })
            .catch(() => {
                setUsers([]);
                setUserId('');
                setUserDisplay('');
            });
    }, [branchScopeForUsers]);

    useEffect(() => { reload(); }, [reload]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const applyFilters = () => {
        setApplied({
            branchId,
            userId,
            dateFrom,
            dateTo,
            search,
        });
        setPage(1);
    };

    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setError('');
        try {
            const res = await listPettyCashExpensesLog(
                buildListParams(applied, { limit: EXPORT_LIMIT, offset: 0 }),
            );
            const list = Array.isArray(res?.items) ? res.items : [];
            const { headers, rows: outRows } = buildExpenseExportTable(list, t);
            const subtitleLine = (applied.dateFrom || applied.dateTo)
                ? t('export.subtitleRange', {
                    n: outRows.length,
                    from: applied.dateFrom || '…',
                    to: applied.dateTo || '…',
                })
                : t('export.subtitle', { n: outRows.length });
            if (kind === 'pdf') {
                exportRowsToPdf({
                    title: t('export.title'),
                    subtitle: subtitleLine,
                    headers,
                    rows: outRows,
                    filenameBase: 'expenses-log',
                });
            } else {
                exportRowsToExcel({
                    sheetName: t('export.sheet'),
                    headers,
                    rows: outRows,
                    filenameBase: 'expenses-log',
                });
            }
            if (Number(res?.total ?? 0) > list.length) {
                setError(t('export.truncated', { n: list.length, total: res.total }));
            }
        } catch (e) {
            setError(e?.message || t('export.failed'));
        } finally {
            setExporting(false);
        }
    }, [applied, buildListParams, t]);

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title"><Wallet size={20} style={{ marginRight: 8 }} />{t('title')}</h2>
                <p className="cash-bank-desc">
                    {t('subtitle')}
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div>
                    <label className="form-label">{t('label.branch')}</label>
                    <SearchableEntityCombobox
                        options={branchComboOptions}
                        value={branchId || 'all'}
                        displayText={branchDisplay}
                        onDisplayTextChange={setBranchDisplay}
                        onSelect={(opt) => {
                            const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
                            setBranchId(next);
                            setBranchDisplay('');
                            setUserId('');
                            setUserDisplay('');
                        }}
                        placeholder={t('search.branchPh')}
                        entityLabel="branch"
                        maxInitial={80}
                        maxFiltered={120}
                        menuMinWidth={220}
                    />
                </div>
                <div>
                    <label className="form-label">{t('label.user')}</label>
                    <SearchableEntityCombobox
                        options={userComboOptions}
                        value={userId || 'all'}
                        displayText={userDisplay}
                        onDisplayTextChange={setUserDisplay}
                        onSelect={(opt) => {
                            const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
                            setUserId(next);
                            setUserDisplay('');
                        }}
                        placeholder={t('search.userPh')}
                        entityLabel="user"
                        maxInitial={80}
                        maxFiltered={120}
                        menuMinWidth={220}
                    />
                </div>
                <div>
                    <label className="form-label">{t('label.from')}</label>
                    <input type="date" className="form-input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">{t('label.to')}</label>
                    <input type="date" className="form-input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">{t('label.search')}</label>
                    <input
                        type="text"
                        className="form-input-field"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                applyFilters();
                            }
                        }}
                        placeholder={t('search.placeholder')}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal" onClick={applyFilters} disabled={loading}>
                        <Filter size={14} style={{ marginRight: 6 }} /> {t('btn.apply')}
                    </button>
                </div>
            </section>

            <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Wallet size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('stat.totalApproved')}</p>
                        <p className="cash-bank-stat-value">SAR {fmt(totalAmount)}</p>
                        <p className="cash-bank-stat-meta">{t('stat.rowsMeta', { shown: rows.length, total })}</p>
                    </div>
                </div>
            </div>

            <section className="premium-table cash-bank-table">
                <header style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <strong>
                        {loading
                            ? t('header.loading')
                            : t('header.pageEntries', {
                                shown: rows.length,
                                total,
                                page,
                                pages: totalPages,
                            })}
                    </strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ExportMenu
                            locale={locale}
                            busy={exporting}
                            disabled={loading || total === 0}
                            onPdf={() => runExport('pdf')}
                            onExcel={() => runExport('excel')}
                        />
                        <button type="button" className="btn-portal-outline" onClick={reload} disabled={loading}>
                            <RefreshCw size={14} style={{ marginRight: 6 }} /> {t('btn.refresh')}
                        </button>
                    </div>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('th.date')}</th>
                            <th className="table-th">{t('th.amount')}</th>
                            <th className="table-th">{t('th.category')}</th>
                            <th className="table-th">{t('th.user')}</th>
                            <th className="table-th">{t('th.branch')}</th>
                            <th className="table-th">{t('th.approvedBy')}</th>
                            <th className="table-th">{t('th.reference')}</th>
                            <th className="table-th">{t('th.description')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={8} className="table-cell table-empty">{loading ? t('header.loading') : t('empty')}</td></tr>
                        ) : rows.map((r) => (
                            <tr key={r.id}>
                                <td className="table-cell">{formatExpenseDate(r.approvedAt)}</td>
                                <td className="table-cell">SAR {fmt(r.amount)}</td>
                                <td className="table-cell">
                                    {r.category?.name ?? '—'}
                                    {r.source === 'admin_wallet' ? (
                                        <span style={{ marginLeft: 6, color: '#64748B', fontSize: '0.7rem' }}>
                                            · {t('source.adminWallet')}
                                        </span>
                                    ) : null}
                                </td>
                                <td className="table-cell">{r.requestedBy?.name ?? r.requestedBy?.email ?? '—'}</td>
                                <td className="table-cell">{r.branch?.name ?? '—'}</td>
                                <td className="table-cell">{r.approvedBy?.name ?? '—'}</td>
                                <td className="table-cell">{r.reference ?? '—'}</td>
                                <td className="table-cell" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.description ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <footer style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <span style={{ color: '#64748B', fontSize: 13 }}>
                        {t('pageSizeHint', { n: PAGE_SIZE })}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft size={14} style={{ marginRight: 4 }} />
                            {t('prev')}
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 90, textAlign: 'center' }}>
                            {t('pageOf', { page, pages: totalPages })}
                        </span>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            {t('next')}
                            <ChevronRight size={14} style={{ marginLeft: 4 }} />
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    );
}
