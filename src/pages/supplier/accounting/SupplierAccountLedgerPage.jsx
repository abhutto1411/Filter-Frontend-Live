import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ProfessionalLedgerStatementDocument from '../../../components/accounting/ProfessionalLedgerStatementDocument';
import {
    accountNormalDebit,
    derivePartyFilterKey,
    isBankCashLedgerAccount,
    partyQueryFromFilterKey,
    unwrapLedgerPayload,
} from '../../../utils/accountLedgerStatementUtils';
import {
    exportAccountLedgerExcel,
    exportAccountLedgerPdf,
} from '../../../utils/supplierLedgerExport';
import { saccT } from '../../../utils/supplierAccountingI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../../utils/supplierPermissions';
import SupplierRiyalAmount from '../SupplierRiyalAmount';
import { getSupplierAccountLedger, getSupplierAccounts } from '../../../services/supplierAccountingApi';
import {
    startOfMonthISO,
    todayISO,
} from './SupplierAccountingShared';

/**
 * Supplier portal — full-page COA account ledger statement.
 */
export default function SupplierAccountLedgerPage({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);

    const location = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const accountId = useMemo(() => {
        const m = location.pathname.match(/^\/supplier\/accounting\/ledger\/([^/]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    }, [location.pathname]);

    const [accountMeta, setAccountMeta] = useState(null);
    const [allAccounts, setAllAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);
    const loadSeqRef = useRef(0);

    const openedFromPartyList = useMemo(() => {
        const from = (searchParams.get('from') || '').trim();
        return (
            from === 'affiliated_workshops' ||
            from === 'nonaffiliated_customers' ||
            from === 'purchase_invoices'
        );
    }, [searchParams]);

    // GL / aging drills pass their own dates in the URL (statement = same window as the report).
    // SP-19: report drills (TB / P&L / BS / GRNI) also pass the report's own date range.
    const openedFromGl = ['general_ledger', 'ar_aging', 'ap_aging', 'cash_book', 'period_close', 'trial_balance', 'profit_loss', 'balance_sheet', 'grni'].includes(
        (searchParams.get('from') || '').trim(),
    );
    const postedOnly = (searchParams.get('postedOnly') || '').trim() === '1';
    const [dateFrom, setDateFrom] = useState(() =>
        openedFromGl
            ? (searchParams.get('dateFrom') || '')
            : openedFromPartyList ? '' : startOfMonthISO(),
    );
    const [dateTo, setDateTo] = useState(() =>
        openedFromGl
            ? (searchParams.get('dateTo') || '')
            : openedFromPartyList ? '' : todayISO(),
    );
    const [pageInfo, setPageInfo] = useState(null);
    const [partyFilterKey, setPartyFilterKey] = useState(() =>
        derivePartyFilterKey({
            partyType: searchParams.get('partyType') || '',
            partyId: searchParams.get('partyId') || '',
            externalPartyId: searchParams.get('externalPartyId') || '',
        }),
    );
    const [offsetAccountFilterId, setOffsetAccountFilterId] = useState('');

    const accountsById = useMemo(() => {
        const m = new Map();
        for (const a of allAccounts || []) {
            if (a?.id != null) m.set(String(a.id), a);
        }
        return m;
    }, [allAccounts]);

    const account = accountMeta || accountsById.get(String(accountId)) || null;

    const isCashLedger = useMemo(
        () =>
            data?.isCashLedger === true ||
            isBankCashLedgerAccount(account, accountsById),
        [data?.isCashLedger, account, accountsById],
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await getSupplierAccounts();
                if (cancelled) return;
                const arr = Array.isArray(list) ? list : list?.accounts || list?.data || [];
                setAllAccounts(arr);
                const found = arr.find((a) => String(a.id) === String(accountId));
                if (found) setAccountMeta(found);
            } catch {
                /* optional */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accountId]);

    const ledgerQueryBase = useMemo(() => {
        const partyQ = partyQueryFromFilterKey(partyFilterKey);
        return {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            ...partyQ,
            offsetAccountId: offsetAccountFilterId || undefined,
            postedOnly: postedOnly ? '1' : undefined,
        };
    }, [dateFrom, dateTo, partyFilterKey, offsetAccountFilterId, postedOnly]);

    /**
     * SP-09 — fetch EVERY line of the window: the API pages from the first line
     * (offset/limit ≤ 10,000, each page with its own opening); keep requesting until
     * `total` is exhausted. Opening / totals / closing come from the first page (whole window).
     */
    const fetchAllPages = useCallback(async (onProgress) => {
        const PAGE = 10000;
        let offset = 0;
        let first = null;
        let rows = [];
        for (let guard = 0; guard < 1000; guard += 1) {
            const res = unwrapLedgerPayload(
                await getSupplierAccountLedger(accountId, { ...ledgerQueryBase, limit: PAGE, offset }),
            );
            if (!first) first = res;
            const pageRows = res?.rows ?? [];
            rows = rows.concat(pageRows);
            const total = Number(res?.total ?? rows.length);
            onProgress?.(rows.length, total);
            if (!res?.hasMore || pageRows.length === 0 || rows.length >= total) break;
            offset += pageRows.length;
        }
        return { ...(first || {}), rows, returned: rows.length };
    }, [accountId, ledgerQueryBase]);

    const load = useCallback(async () => {
        if (!accountId) return;
        const seq = ++loadSeqRef.current;
        setLoading(true);
        setErr('');
        try {
            const all = await fetchAllPages((loaded, total) => {
                if (seq === loadSeqRef.current) setPageInfo({ loaded, total });
            });
            if (seq !== loadSeqRef.current) return;
            setData(all);
            setPageInfo({ loaded: all.rows.length, total: Number(all.total ?? all.rows.length) });
        } catch (e) {
            if (seq !== loadSeqRef.current) return;
            setErr(e?.message || t('ledger.err.load'));
            setData(null);
        } finally {
            if (seq === loadSeqRef.current) setLoading(false);
        }
    }, [accountId, fetchAllPages, t]);

    useEffect(() => {
        void load();
    }, [load]);

    async function fetchForExport() {
        // Full statement: every line of the window (not just one page).
        return fetchAllPages();
    }

    function buildExportHeader(root) {
        const partyLabel = root?.header?.partyLabel || null;
        return {
            ...(root?.header || {}),
            accountCode: root?.header?.accountCode || account?.code || '',
            accountName:
                (root?.header?.accountName || account?.name || '') +
                (partyLabel ? ` · ${partyLabel}` : ''),
            accountType: root?.header?.accountType || account?.type || '',
            companyName: root?.header?.companyName || undefined,
            from: root?.header?.from || dateFrom || undefined,
            to: root?.header?.to || dateTo || undefined,
            currencyCode: root?.header?.currencyCode || 'SAR',
        };
    }

    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    async function onExportPdf() {
        setErr('');
        try {
            const root = await fetchForExport();
            await exportAccountLedgerPdf({
                header: buildExportHeader(root),
                openingBalance: root?.openingBalance ?? 0,
                rows: root?.rows ?? [],
                totals: root?.totals,
                riyalSymbol: true,
            });
        } catch (e) {
            setErr(e?.message || t('ledger.err.pdf'));
        }
    }

    async function onExportExcel() {
        setErr('');
        try {
            const root = await fetchForExport();
            exportAccountLedgerExcel({
                header: buildExportHeader(root),
                openingBalance: root?.openingBalance ?? 0,
                rows: root?.rows ?? [],
                totals: root?.totals,
                riyalSymbol: true,
            });
        } catch (e) {
            setErr(e?.message || t('ledger.err.excel'));
        }
    }

    const fromPage = (searchParams.get('from') || '').trim();
    const urlPartyLabel = (searchParams.get('partyLabel') || '').trim();
    const partyLocked =
        fromPage === 'affiliated_workshops' ||
        fromPage === 'nonaffiliated_customers' ||
        fromPage === 'purchase_invoices';

    useEffect(() => {
        setPartyFilterKey(
            derivePartyFilterKey({
                partyType: searchParams.get('partyType') || '',
                partyId: searchParams.get('partyId') || '',
                externalPartyId: searchParams.get('externalPartyId') || '',
            }),
        );
    }, [searchParams]);

    function clearRange() {
        if (partyLocked) {
            setDateFrom('');
            setDateTo('');
        } else {
            setDateFrom(startOfMonthISO());
            setDateTo(todayISO());
            setPartyFilterKey('');
        }
        setOffsetAccountFilterId('');
    }

    const accountType = data?.header?.accountType || account?.type || '';
    const normalDebit = accountNormalDebit(accountType);
    const filterOptions = data?.filterOptions ?? { parties: [], offsetAccounts: [] };
    const em = t('emdash');
    const partyLabel = data?.header?.partyLabel || urlPartyLabel || '';

    const REPORT_BACK_TAB = { trial_balance: 'tb', profit_loss: 'pl', balance_sheet: 'bs', grni: 'grni' };
    const backHref =
        REPORT_BACK_TAB[fromPage]
            ? `/supplier/accounting_reports_tb?tab=${REPORT_BACK_TAB[fromPage]}`
            : fromPage === 'period_close'
            ? '/supplier/accounting/period-close'
            : fromPage === 'general_ledger'
            ? '/supplier/accounting_reports_tb?tab=gl'
            : fromPage === 'cash_book'
            ? '/supplier/cash_accounts'
            : fromPage === 'ar_aging' || fromPage === 'ap_aging'
            ? `/supplier/accounting_reports_tb?tab=aging&aging=${fromPage === 'ap_aging' ? 'ap' : 'ar'}`
            : fromPage === 'affiliated_workshops'
            ? '/supplier/affiliated_workshops'
            : fromPage === 'nonaffiliated_customers'
              ? '/supplier/nonaffiliated_customers'
              : fromPage === 'purchase_invoices'
                ? '/supplier/purchase_invoices'
                : '/supplier/accounting/coa';
    const backLabel =
        REPORT_BACK_TAB[fromPage]
            ? t(`ledger.back.${REPORT_BACK_TAB[fromPage]}`)
            : fromPage === 'period_close'
            ? t('ledger.back.periodClose')
            : fromPage === 'general_ledger'
            ? t('ledger.back.gl')
            : fromPage === 'cash_book'
            ? t('ledger.back.cashBook')
            : fromPage === 'ar_aging' || fromPage === 'ap_aging'
            ? t('ledger.back.aging')
            : fromPage === 'affiliated_workshops'
            ? t('ledger.back.affiliated')
            : fromPage === 'nonaffiliated_customers'
              ? t('ledger.back.nonaffiliated')
              : fromPage === 'purchase_invoices'
                ? t('ledger.back.purchases')
                : t('ledger.back');

    const accountInactive =
        String(account?.status || data?.header?.status || 'active').toLowerCase() ===
        'inactive';

    return (
        <div className="accounting-page module-container">
            {accountInactive ? (
                <div
                    style={{
                        margin: '0 0 12px',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: '#FEF2F2',
                        color: '#991B1B',
                        fontSize: 13,
                        fontWeight: 600,
                    }}
                >
                    {t('ledger.inactiveHint')}
                </div>
            ) : null}
            {isCashLedger ? (
                <h2 data-book-type={String(account?.cashKind || '').toLowerCase() === 'bank' || account?.seedKey === 'BANK' ? 'bank' : 'cash'} style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                    {String(account?.cashKind || '').toLowerCase() === 'bank' || account?.seedKey === 'BANK'
                        ? t('cashbook.bankBook')
                        : t('cashbook.cashBook')}
                    {' — '}
                    [{data?.header?.accountCode || account?.code || ''}] {data?.header?.accountName || account?.name || ''}
                </h2>
            ) : null}
            {partyFilterKey && data && !loading ? (
                <div
                    data-statement-party={partyLabel || undefined}
                    style={{
                        margin: '0 0 10px',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 16,
                        alignItems: 'center',
                        fontSize: 13,
                    }}
                >
                    <strong style={{ color: '#0F172A' }}>{t('ledger.statementOf', { party: partyLabel || em })}</strong>
                    <span style={{ color: '#475569' }}>{t('ledger.periodLabel', { from: data?.header?.from || em, to: data?.header?.to || em })}</span>
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        {t('ledger.openingLabel')} <SupplierRiyalAmount amount={data?.openingBalance ?? 0} size={12} />
                    </span>
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontWeight: 700 }}>
                        {t('ledger.closingLabel')} <SupplierRiyalAmount amount={data?.totals?.closingBalance ?? 0} size={12} />
                    </span>
                </div>
            ) : null}
            {pageInfo && pageInfo.total > 0 ? (
                <div
                    role="status"
                    style={{
                        margin: '0 0 10px',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: pageInfo.loaded >= pageInfo.total ? '#ECFDF5' : '#FFFBEB',
                        color: pageInfo.loaded >= pageInfo.total ? '#065F46' : '#92400E',
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    {pageInfo.loaded >= pageInfo.total
                        ? t('ledger.showingAll', { from: 1, to: pageInfo.total, total: pageInfo.total })
                        : t('ledger.loadingMore', { loaded: pageInfo.loaded, total: pageInfo.total })}
                    {postedOnly ? ` · ${t('ledger.postedOnly')}` : ''}
                </div>
            ) : null}
            <ProfessionalLedgerStatementDocument
                onBack={() => navigate(backHref)}
                backLabel={backLabel}
                loading={loading}
                error={err}
                accountCode={data?.header?.accountCode || account?.code || ''}
                accountName={data?.header?.accountName || account?.name || ''}
                partyLabel={partyLabel}
                accountType={accountType}
                companyName={data?.header?.companyName}
                sellerName={
                    data?.header?.sellerName ||
                    data?.header?.companyName ||
                    ''
                }
                vatNumber={data?.header?.vatNumber || ''}
                sellerVatNumber={data?.header?.sellerVatNumber || ''}
                crNumber={data?.header?.crNumber || ''}
                partyAddress={data?.header?.partyAddress || ''}
                partyPhone={data?.header?.partyPhone || ''}
                contactPerson={data?.header?.contactPerson || ''}
                partyName={data?.header?.partyName || ''}
                periodFrom={data?.header?.from || dateFrom || em}
                periodTo={data?.header?.to || dateTo || em}
                openingBalance={data?.openingBalance ?? 0}
                rows={data?.rows ?? []}
                totals={data?.totals}
                normalDebit={normalDebit}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onApply={() => void load()}
                onClear={clearRange}
                onExportPdf={() => void onExportPdf()}
                onExportExcel={() => void onExportExcel()}
                exportDisabled={!data || loading || !canExport}
                showCashLedgerColumns={isCashLedger}
                counterpartyColumnLabel={t('ledger.counterpartyCol')}
                offsetAccountColumnLabel={t('ledger.offsetCol')}
                filterOptions={filterOptions}
                hidePartyFilter={partyLocked}
                partyFilterKey={partyFilterKey}
                onPartyFilterKeyChange={setPartyFilterKey}
                offsetAccountFilterId={offsetAccountFilterId}
                onOffsetAccountFilterIdChange={setOffsetAccountFilterId}
                // SP-19: movement → journal voucher (that line highlighted); the voucher links back here.
                onRowOpen={(r) => {
                    const qs = new URLSearchParams();
                    if (/^\d+$/.test(String(r.id))) qs.set('highlightLine', String(r.id));
                    qs.set('back', `${location.pathname}${location.search}`);
                    qs.set('backLabel', `${data?.header?.accountCode || account?.code || ''} ${data?.header?.accountName || account?.name || ''}`.trim());
                    navigate(`${r.proof.sourceHref}?${qs.toString()}`);
                }}
                rowOpenLabel={(r) => t('ledger.openJournal', { entry: r.proof?.journalEntryNumber || '' })}
            />
        </div>
    );
}
