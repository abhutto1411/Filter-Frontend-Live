import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    ArrowDownToLine,
    Building2,
    Factory,
    FileSpreadsheet,
    Inbox,
    Landmark,
    Package,
    Receipt,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import SupplierCashBank from './SupplierCashBank';
import SupplierExpenses from './SupplierExpenses';
import SupplierSuperSupplierPurchasesPanel from './SupplierSuperSupplierPurchasesPanel';
import SupplierCOAManager from './accounting/SupplierCOAManager';
import SupplierVatReport from './accounting/SupplierVatReport';
import SupplierTransactionHub from './accounting/SupplierTransactionHub';
import SupplierJournalLogs from './accounting/SupplierJournalLogs';
import SupplierAccountingReports from './accounting/SupplierAccountingReports';
import {
    getSupplierChartOfAccounts,
    listSupplierCashBankLedger,
    listSupplierPayments,
    listSupplierSuperSuppliers,
} from '../../services/supplierApi';
import { Shimmer, ShimmerKpiGrid, ShimmerLine, ShimmerTable } from '../../components/supplier/Shimmer';
import '../../styles/admin/AccountingPage.css';
import './SupplierChartOfAccounts.css';
import { saccT } from '../../utils/supplierAccountingI18n';

function extractArray(res, keys) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res)) return res;
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
    }
    return [];
}

function money(currency, v) {
    const n = Number(v || 0);
    return `${currency || 'SAR'} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function coaStatusBadgeClass(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('paid') || s.includes('approv') || s.includes('deliver')) return 'supplier-coa__badge supplier-coa__badge--success';
    if (s.includes('pending') || s.includes('unpaid') || s.includes('partial')) return 'supplier-coa__badge supplier-coa__badge--warn';
    if (s.includes('reject') || s.includes('cancel') || s.includes('overdue')) return 'supplier-coa__badge supplier-coa__badge--danger';
    return 'supplier-coa__badge supplier-coa__badge--neutral';
}

function CoaSection({ icon: Icon, title, desc, children }) {
    return (
        <section className="supplier-coa__card">
            <div className="supplier-coa__card-head">
                <div className="supplier-coa__card-icon" aria-hidden>
                    {Icon ? <Icon size={20} strokeWidth={2.25} /> : null}
                </div>
                <div className="supplier-coa__card-titles">
                    <h3 className="supplier-coa__card-title">{title}</h3>
                    {desc ? <p className="supplier-coa__card-desc">{desc}</p> : null}
                </div>
            </div>
            {children}
        </section>
    );
}

function CoaEmpty({ icon: Icon, message }) {
    return (
        <div className="supplier-coa__empty">
            {Icon ? <Icon className="supplier-coa__empty-icon" size={38} strokeWidth={1.4} aria-hidden /> : null}
            {message}
        </div>
    );
}

function CoaSectionShimmer({ tableColumns = 4, tableRows = 4 }) {
    return (
        <section className="supplier-coa__card" aria-hidden>
            <div className="supplier-coa__card-head">
                <Shimmer style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <ShimmerLine height={15} width="38%" style={{ marginBottom: 8 }} />
                    <ShimmerLine height={11} width="72%" />
                </div>
            </div>
            <div className="supplier-coa__table-wrap">
                <ShimmerTable rows={tableRows} columns={tableColumns} />
            </div>
        </section>
    );
}

/** Skeleton matching Chart of accounts layout until `getSupplierChartOfAccounts` resolves. */
function SupplierChartOfAccountsShimmer() {
    return (
        <div className="supplier-coa" role="status" aria-live="polite" aria-busy="true" aria-label="Loading chart of accounts">
            <header className="supplier-coa__hero">
                <div className="supplier-coa__hero-inner">
                    <Shimmer style={{ height: 26, width: 140, borderRadius: 999, alignSelf: 'flex-start' }} />
                    <ShimmerLine height={26} width="72%" style={{ marginTop: 4, maxWidth: 320 }} />
                    <ShimmerLine height={13} width="96%" style={{ maxWidth: 520 }} />
                    <ShimmerLine height={13} width="88%" style={{ maxWidth: 440 }} />
                </div>
            </header>

            <div className="supplier-coa__body">
                <div className="supplier-coa__intro" style={{ marginBottom: 20 }}>
                    <ShimmerLine height={12} width="100%" />
                    <ShimmerLine height={12} width="94%" style={{ marginTop: 10 }} />
                </div>

                <ShimmerKpiGrid cards={6} />

                <CoaSectionShimmer tableColumns={4} tableRows={3} />
                <CoaSectionShimmer tableColumns={2} tableRows={2} />
                <CoaSectionShimmer tableColumns={5} tableRows={4} />
            </div>
        </div>
    );
}

function SupplierChartOfAccountsTab({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [currency, setCurrency] = useState('SAR');
    const [chart, setChart] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await getSupplierChartOfAccounts();
                if (cancelled) return;
                setCurrency(res?.currencyCode || 'SAR');
                setChart(res && typeof res === 'object' ? res : {});
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('page.err.coa'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return <SupplierChartOfAccountsShimmer />;
    }
    if (err) {
        return (
            <div className="supplier-coa">
                <div className="supplier-coa__err">{err}</div>
            </div>
        );
    }

    const ledger = extractArray(chart, ['ledgerAccounts', 'accounts']).map((a) => ({
        id: String(a.id),
        name: a.name || '—',
        type: a.accountType || '—',
        opening: Number(a.openingBalance ?? 0),
        balance: Number(a.balance ?? 0),
    }));
    const memo = extractArray(chart, ['memoAccounts']).map((a) => ({
        id: String(a.id),
        name: a.name || '—',
        balance: Number(a.balance ?? 0),
    }));
    const roll = chart?.rollups || {};
    const receivableRecords = extractArray(chart, ['receivableRecords']);
    const payableRecords = extractArray(chart, ['payableRecords']);
    const supplierPayments = extractArray(chart, ['supplierPayments']);
    const expenseByCategory = extractArray(chart, ['expenseByCategory']);
    const expenseRecords = extractArray(chart, ['expenseRecords']);
    const superSupplierPurchases = extractArray(chart, ['superSupplierPurchases']);
    const workshopPurchaseInvoices = extractArray(chart, ['workshopPurchaseInvoices']);

    const kpiItems = [
        { key: 'ar', label: t('page.kpi.ar'), value: roll.accountsReceivable, Icon: TrendingUp },
        { key: 'ap', label: t('page.kpi.ap'), value: roll.accountsPayable, Icon: TrendingDown },
        { key: 'pay', label: t('page.kpi.pay'), value: roll.paymentsReceivedTotal, Icon: ArrowDownToLine },
        { key: 'exp', label: t('page.kpi.exp'), value: roll.expenseAmountTotal, Icon: Receipt },
        { key: 'ssp', label: t('page.kpi.ssp'), value: roll.superSupplierPurchasesTotal, Icon: Package },
        { key: 'wpi', label: t('page.kpi.wpi'), value: roll.workshopPurchaseInvoicesTotal, Icon: Factory },
    ];

    return (
        <div className="supplier-coa">
            <header className="supplier-coa__hero">
                <div className="supplier-coa__hero-inner">
                    <span className="supplier-coa__hero-badge">
                        <Sparkles size={14} strokeWidth={2.5} aria-hidden />
                        {t('page.hero.badge')}
                    </span>
                    <h2 className="supplier-coa__hero-title">{t('page.hero.title')}</h2>
                    <p className="supplier-coa__hero-sub">
                        {t('page.hero.sub')}
                    </p>
                </div>
            </header>

            <div className="supplier-coa__body">
                <p className="supplier-coa__intro">
                    {t('page.intro')}
                </p>

                <div className="ws-kpi-grid">
                    {kpiItems.map(({ key, label, value, Icon }) => (
                        <div key={key} className="ws-kpi-card">
                            <div>
                                <p className="ws-kpi-label">{label.toUpperCase()}</p>
                                <p className="ws-kpi-value">{money(currency, value)}</p>
                            </div>
                            <div className="ws-kpi-icon ws-kpi-icon--dark">
                                <Icon size={22} strokeWidth={2.25} aria-hidden />
                            </div>
                        </div>
                    ))}
                </div>

                <CoaSection
                    icon={Landmark}
                    title={t('page.sec.ledger')}
                    desc={t('page.sec.ledgerDesc')}
                >
                    {ledger.length === 0 ? (
                        <CoaEmpty icon={Wallet} message={t('page.empty.ledger')} />
                    ) : (
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.account')}</th>
                                        <th>{t('page.th.type')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.opening')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.balance')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.map((row) => (
                                        <tr key={row.id}>
                                            <td>{row.name}</td>
                                            <td>
                                                <span className={coaStatusBadgeClass(row.type)}>{row.type}</span>
                                            </td>
                                            <td className="supplier-coa__td-num">{money(currency, row.opening)}</td>
                                            <td className="supplier-coa__td-num">{money(currency, row.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CoaSection>

                {memo.length > 0 ? (
                    <CoaSection
                        icon={FileSpreadsheet}
                        title={t('page.sec.memo')}
                        desc={t('page.sec.memoDesc')}
                    >
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.description')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.amount')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {memo.map((row) => (
                                        <tr key={row.id}>
                                            <td>{row.name}</td>
                                            <td className="supplier-coa__td-num">{money(currency, row.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CoaSection>
                ) : null}

                <CoaSection
                    icon={TrendingUp}
                    title={t('page.sec.ar')}
                    desc={t('page.sec.arDesc')}
                >
                    {receivableRecords.length === 0 ? (
                        <CoaEmpty icon={Inbox} message={t('page.empty.ar')} />
                    ) : (
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.invoice')}</th>
                                        <th>{t('page.th.workshop')}</th>
                                        <th>{t('page.th.due')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.outstanding')}</th>
                                        <th>{t('page.th.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receivableRecords.map((r) => (
                                        <tr key={r.invoiceId ?? r.invoiceNo}>
                                            <td>{r.invoiceNo ?? r.invoiceId}</td>
                                            <td>{r.workshopName ?? '—'}</td>
                                            <td>{(r.dueDate ?? '').toString().slice(0, 10)}</td>
                                            <td className="supplier-coa__td-num">{money(currency, r.outstanding)}</td>
                                            <td>
                                                <span className={coaStatusBadgeClass(r.status)}>{r.status ?? '—'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CoaSection>

                <CoaSection icon={Building2} title={t('page.sec.ap')} desc={t('page.sec.apDesc')}>
                    {payableRecords.length === 0 ? (
                        <CoaEmpty icon={Inbox} message={t('page.empty.ap')} />
                    ) : (
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.vendor')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.openingBal')}</th>
                                        <th>{t('page.th.created')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payableRecords.map((p) => (
                                        <tr key={p.id}>
                                            <td>{p.companyName ?? '—'}</td>
                                            <td className="supplier-coa__td-num">{money(currency, p.openingBalance)}</td>
                                            <td>{(p.createdAt ?? '').toString().slice(0, 10)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CoaSection>

                <CoaSection
                    icon={ArrowDownToLine}
                    title={t('page.sec.paymentsIn')}
                    desc={t('page.sec.paymentsInDesc')}
                >
                    {supplierPayments.length === 0 ? (
                        <CoaEmpty icon={Inbox} message={t('page.empty.payments')} />
                    ) : (
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.date')}</th>
                                        <th>{t('page.th.invoice')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.amount')}</th>
                                        <th>{t('page.th.method')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplierPayments.map((p) => (
                                        <tr key={p.id}>
                                            <td>{(p.paidAt ?? '').toString().slice(0, 10)}</td>
                                            <td>{p.invoiceNo ?? '—'}</td>
                                            <td className="supplier-coa__td-num">{money(currency, p.amount)}</td>
                                            <td>{p.method ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CoaSection>

                <CoaSection
                    icon={Receipt}
                    title={t('page.sec.expCat')}
                    desc={t('page.sec.expCatDesc')}
                >
                    {expenseByCategory.length === 0 ? (
                        <CoaEmpty icon={Inbox} message={t('page.empty.expCat')} />
                    ) : (
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.category')}</th>
                                        <th>{t('page.th.records')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.total')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenseByCategory.map((c) => (
                                        <tr key={c.categoryName}>
                                            <td>{c.categoryName}</td>
                                            <td>{c.recordCount}</td>
                                            <td className="supplier-coa__td-num">{money(currency, c.totalAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CoaSection>

                <CoaSection
                    icon={Receipt}
                    title={t('page.sec.expLines')}
                    desc={t('page.sec.expLinesDesc')}
                >
                    {expenseRecords.length === 0 ? (
                        <CoaEmpty icon={Inbox} message={t('page.empty.exp')} />
                    ) : (
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.date')}</th>
                                        <th>{t('page.th.category')}</th>
                                        <th>{t('page.th.description')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.total')}</th>
                                        <th>{t('page.th.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenseRecords.map((e) => (
                                        <tr key={e.id}>
                                            <td>{(e.expenseDate ?? '').toString().slice(0, 10)}</td>
                                            <td>{e.categoryName ?? '—'}</td>
                                            <td>{e.description ?? '—'}</td>
                                            <td className="supplier-coa__td-num">{money(currency, e.totalAmount)}</td>
                                            <td>
                                                <span className={coaStatusBadgeClass(e.status)}>{e.status ?? '—'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CoaSection>

                <CoaSection
                    icon={Package}
                    title={t('page.sec.purchases')}
                    desc={t('page.sec.purchasesDesc')}
                >
                    {superSupplierPurchases.length === 0 ? (
                        <CoaEmpty icon={Inbox} message={t('page.empty.purchases')} />
                    ) : (
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.ref')}</th>
                                        <th>{t('page.th.vendor')}</th>
                                        <th>{t('page.th.date')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.total')}</th>
                                        <th>{t('page.th.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {superSupplierPurchases.map((p) => (
                                        <tr key={p.id}>
                                            <td>{p.invoiceNo ?? p.id}</td>
                                            <td>{p.superSupplierName ?? '—'}</td>
                                            <td>{(p.purchaseDate ?? '').toString().slice(0, 10)}</td>
                                            <td className="supplier-coa__td-num">{money(currency, p.total)}</td>
                                            <td>
                                                <span className={coaStatusBadgeClass(p.status)}>{p.status ?? '—'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CoaSection>

                <CoaSection
                    icon={Factory}
                    title={t('page.sec.wpi')}
                    desc={t('page.sec.wpiDesc')}
                >
                    {workshopPurchaseInvoices.length === 0 ? (
                        <CoaEmpty icon={Inbox} message={t('page.empty.wpi')} />
                    ) : (
                        <div className="supplier-coa__table-wrap">
                            <table className="supplier-coa__table">
                                <thead>
                                    <tr>
                                        <th>{t('page.th.invoiceNo')}</th>
                                        <th>{t('page.th.workshop')}</th>
                                        <th>{t('page.th.issue')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.grandTotal')}</th>
                                        <th className="supplier-coa__th-num">{t('page.th.balance')}</th>
                                        <th>{t('page.th.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workshopPurchaseInvoices.map((w) => (
                                        <tr key={w.id}>
                                            <td>{w.invoiceNumber ?? w.id}</td>
                                            <td>{w.workshopName ?? '—'}</td>
                                            <td>{(w.issueDate ?? '').toString().slice(0, 10)}</td>
                                            <td className="supplier-coa__td-num">{money(currency, w.grandTotal)}</td>
                                            <td className="supplier-coa__td-num">{money(currency, w.balance)}</td>
                                            <td>
                                                <span className={coaStatusBadgeClass(w.status)}>{w.status ?? '—'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CoaSection>
            </div>
        </div>
    );
}

function SupplierCashBankLedgerTab({ variant, locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [rows, setRows] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listSupplierCashBankLedger({ limit: 400 });
            const raw = extractArray(res, ['ledger', 'entries', 'list']);
            const mapped = raw.map((r) => ({
                id: String(r.id ?? ''),
                date: (r.entryDate ?? '').toString().slice(0, 10),
                account: r.accountName ?? r.account?.name ?? '—',
                direction: (r.direction || '').toLowerCase(),
                amount: Number(r.amount ?? 0),
                source: r.sourceType ?? '—',
                description: r.description ?? '—',
            }));
            setRows(mapped);
        } catch (e) {
            setErr(e?.message || t('page.err.ledger'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return (
            <div className="ws-section" style={{ padding: 24, color: 'var(--color-text-muted)' }}>
                {t('loading')}
            </div>
        );
    }
    if (err) {
        return (
            <div className="ws-section" style={{ padding: 16, background: '#FEF2F2', borderRadius: 12, color: '#B91C1C' }}>
                {err}
            </div>
        );
    }

    const isJournal = variant === 'journal' || variant === 'ledger';

    return (
        <div className="ws-section" style={{ paddingTop: 12 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                {variant === 'transactions'
                    ? t('page.ledger.txHint')
                    : t('page.ledger.jeHint')}
            </p>
            <table className="ws-table">
                <thead>
                    <tr>
                        <th>{t('page.th.date')}</th>
                        <th>{t('page.th.account')}</th>
                        {isJournal ? (
                            <>
                                <th>{t('page.th.debit')}</th>
                                <th>{t('page.th.credit')}</th>
                            </>
                        ) : (
                            <>
                                <th>{t('page.th.direction')}</th>
                                <th>{t('page.th.amount')}</th>
                            </>
                        )}
                        <th>{t('page.th.source')}</th>
                        <th>{t('page.th.description')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={isJournal ? 6 : 6} style={{ textAlign: 'center', padding: 24 }}>
                                {t('page.ledger.empty')}
                            </td>
                        </tr>
                    ) : (
                        rows.map((r) => (
                            <tr key={r.id}>
                                <td>{r.date || '—'}</td>
                                <td>{r.account}</td>
                                {isJournal ? (
                                    <>
                                        <td>{r.direction === 'debit' ? money('SAR', r.amount) : '—'}</td>
                                        <td>{r.direction === 'credit' ? money('SAR', r.amount) : '—'}</td>
                                    </>
                                ) : (
                                    <>
                                        <td>{r.direction === 'debit' ? t('page.dir.in') : t('page.dir.out')}</td>
                                        <td>{money('SAR', r.amount)}</td>
                                    </>
                                )}
                                <td>{r.source}</td>
                                <td>{r.description}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

function SupplierReceiptsTab({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [rows, setRows] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await listSupplierPayments({ limit: 100 });
                if (cancelled) return;
                const raw = extractArray(res, ['payments', 'list']);
                setRows(
                    raw.map((p) => ({
                        id: String(p.id),
                        date: (p.paidAt ?? '').toString().slice(0, 10),
                        invoiceNo: p.invoiceNo ?? p.invoiceId ?? '—',
                        amount: Number(p.amount ?? 0),
                        method: p.method ?? '—',
                        reference: p.reference ?? '—',
                        notes: p.notes ?? '',
                    })),
                );
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('page.err.receipts'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return <div className="ws-section" style={{ padding: 24 }}>{t('page.receipts.loading')}</div>;
    }
    if (err) {
        return (
            <div className="ws-section" style={{ padding: 16, background: '#FEF2F2', borderRadius: 12, color: '#B91C1C' }}>
                {err}
            </div>
        );
    }

    return (
        <div className="ws-section" style={{ paddingTop: 12 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                {t('page.receipts.hint')}
            </p>
            <table className="ws-table">
                <thead>
                    <tr>
                        <th>{t('page.th.date')}</th>
                        <th>{t('page.th.invoice')}</th>
                        <th>{t('page.th.amount')}</th>
                        <th>{t('page.th.method')}</th>
                        <th>{t('page.th.reference')}</th>
                        <th>{t('page.th.notes')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                                {t('page.receipts.empty')}
                            </td>
                        </tr>
                    ) : (
                        rows.map((r) => (
                            <tr key={r.id}>
                                <td>{r.date}</td>
                                <td>{r.invoiceNo}</td>
                                <td style={{ fontWeight: 700 }}>{money('SAR', r.amount)}</td>
                                <td>{r.method}</td>
                                <td>{r.reference}</td>
                                <td>{r.notes}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

function SupplierPaymentsOutTab({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [rows, setRows] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await listSupplierCashBankLedger({ limit: 400 });
                if (cancelled) return;
                const raw = extractArray(res, ['ledger', 'entries', 'list']);
                const credits = raw
                    .filter((r) => String(r.direction || '').toLowerCase() === 'credit')
                    .map((r) => ({
                        id: String(r.id),
                        date: (r.entryDate ?? '').toString().slice(0, 10),
                        account: r.accountName ?? '—',
                        amount: Number(r.amount ?? 0),
                        source: r.sourceType ?? '—',
                        description: r.description ?? '—',
                    }));
                setRows(credits);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('page.err.payments'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return <div className="ws-section" style={{ padding: 24 }}>{t('loading')}</div>;
    }
    if (err) {
        return (
            <div className="ws-section" style={{ padding: 16, background: '#FEF2F2', borderRadius: 12, color: '#B91C1C' }}>
                {err}
            </div>
        );
    }

    return (
        <div className="ws-section" style={{ paddingTop: 12 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                {t('page.payments.hint')}
            </p>
            <table className="ws-table">
                <thead>
                    <tr>
                        <th>{t('page.th.date')}</th>
                        <th>{t('page.th.account')}</th>
                        <th>{t('page.th.amount')}</th>
                        <th>{t('page.th.source')}</th>
                        <th>{t('page.th.description')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                                {t('page.payments.empty')}
                            </td>
                        </tr>
                    ) : (
                        rows.map((r) => (
                            <tr key={r.id}>
                                <td>{r.date}</td>
                                <td>{r.account}</td>
                                <td style={{ fontWeight: 700 }}>{money('SAR', r.amount)}</td>
                                <td>{r.source}</td>
                                <td>{r.description}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

function SupplierAdvancesTab({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    return (
        <div className="ws-section" style={{ padding: 24, maxWidth: 560 }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {t('page.advances.hint')}
            </p>
        </div>
    );
}

function SupplierAccountingPurchasesTab({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [superSuppliers, setSuperSuppliers] = useState([]);

    const reloadSs = useCallback(() => {
        return listSupplierSuperSuppliers()
            .then((r) => {
                const raw = r?.superSuppliers ?? r?.data ?? [];
                setSuperSuppliers(Array.isArray(raw) ? raw : []);
            })
            .catch(() => {
                setSuperSuppliers([]);
            });
    }, []);

    useEffect(() => {
        let cancelled = false;
        listSupplierSuperSuppliers()
            .then((r) => {
                if (cancelled) return;
                const raw = r?.superSuppliers ?? r?.data ?? [];
                setSuperSuppliers(Array.isArray(raw) ? raw : []);
            })
            .catch(() => {
                if (!cancelled) setSuperSuppliers([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                {t('page.purchases.hint')}
            </p>
            <SupplierSuperSupplierPurchasesPanel
                superSuppliers={superSuppliers}
                onPurchasesMutated={() => {
                    void reloadSs();
                }}
            />
        </div>
    );
}

export default function SupplierAccountingPage({ activeSubTab: propActiveTab, locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const { subTab } = useParams();

    const getActiveSub = () => {
        const raw = (propActiveTab || subTab || 'accounting_coa').replace('accounting_', '');
        const mapping = {
            coa: 'chart-of-accounts',
            hub: 'hub',
            logs_payments: 'logs-payments',
            logs_receipts: 'logs-receipts',
            logs_journals: 'logs-journals',
            vat: 'vat',
            reports_tb: 'reports-tb',
            reports_pl: 'reports-pl',
            reports_bs: 'reports-bs',
            reports_cf: 'reports-cf',
            cash_bank: 'cash-bank',
            journal: 'journal-entries',
            transactions: 'transactions',
            purchases: 'purchases',
            expenses: 'expenses',
            receipts: 'receipts',
            payments: 'payments',
            advances: 'advances',
            ledger: 'ledger',
        };
        return mapping[raw] || raw;
    };

    const activeSub = getActiveSub();

    return (
        <div className="accounting-page module-container">
            {/* New accounting (v2) sub-tabs */}
            {activeSub === 'chart-of-accounts' && <SupplierCOAManager locale={locale} />}
            {activeSub === 'hub' && <SupplierTransactionHub locale={locale} />}
            {activeSub === 'logs-payments' && <SupplierJournalLogs initialTab="payments" locale={locale} />}
            {activeSub === 'logs-receipts' && <SupplierJournalLogs initialTab="receipts" locale={locale} />}
            {activeSub === 'logs-journals' && <SupplierJournalLogs initialTab="journals" locale={locale} />}
            {activeSub === 'vat' && <SupplierVatReport locale={locale} />}
            {activeSub === 'reports-tb' && <SupplierAccountingReports initialTab="tb" locale={locale} />}
            {activeSub === 'reports-pl' && <SupplierAccountingReports initialTab="pl" locale={locale} />}
            {activeSub === 'reports-bs' && <SupplierAccountingReports initialTab="bs" locale={locale} />}
            {activeSub === 'reports-cf' && <SupplierAccountingReports initialTab="cf" locale={locale} />}

            {/* Legacy sub-tabs */}
            {activeSub === 'cash-bank' && <SupplierCashBank locale={locale} />}
            {activeSub === 'transactions' && <SupplierCashBankLedgerTab variant="transactions" locale={locale} />}
            {activeSub === 'journal-entries' && <SupplierCashBankLedgerTab variant="journal" locale={locale} />}
            {activeSub === 'purchases' && <SupplierAccountingPurchasesTab locale={locale} />}
            {activeSub === 'expenses' && <SupplierExpenses locale={locale} />}
            {activeSub === 'receipts' && <SupplierReceiptsTab locale={locale} />}
            {activeSub === 'payments' && <SupplierPaymentsOutTab locale={locale} />}
            {activeSub === 'advances' && <SupplierAdvancesTab locale={locale} />}
            {activeSub === 'ledger' && <SupplierCashBankLedgerTab variant="ledger" locale={locale} />}
        </div>
    );
}
