import React, { useCallback, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import { startOfMonthISO, todayISO } from '../../accounting/SupplierAccountingShared';
import { useSfT } from '../useSfT';
import { sfMoney } from '../sfFormat';
import UiPager from '../../../../components/UiPager';
import { usePagedRows } from '../../../../hooks/usePagedRows';
import {
    StorageBrandReportDateRange,
    StorageBrandReportError,
    StorageBrandReportStatus,
} from './StorageBrandReportToolbar';
import '../../../../styles/ui.css';

export default function StorageBrandTrialBalanceTab({ brandId, onAccountClick }) {
    const t = useSfT();
    const accountingApi = useStorageFacilityAccountingApi();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [{ dateFrom, dateTo }, setRange] = useState({
        dateFrom: startOfMonthISO(),
        dateTo: todayISO(),
    });
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await accountingApi.getBrandTrialBalance(brandId, { dateFrom, dateTo });
            setData(res);
            setLoadError(false);
        } catch {
            setData(null);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, dateFrom, dateTo, accountingApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    const accounts = data?.accounts ?? [];
    // The whole chart comes back in one response; totals below are the API's,
    // over the period rather than the page.
    const paging = usePagedRows(accounts, { resetKey: `${brandId}|${dateFrom}|${dateTo}` });
    const money = (v) => sfMoney(t, v);

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('acct.tb.lead')}</p>
            <StorageBrandReportDateRange dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />

            {loadError && !loading ? (
                <StorageBrandReportError
                    title={t('acct.tb.errLoad')}
                    onRetry={() => setReloadKey((k) => k + 1)}
                />
            ) : (
                <>
                    <div className="ui-table-wrap">
                        {!loading && accounts.length === 0 ? (
                            <div className="ui-empty">
                                <div className="ui-empty-icon"><Scale size={18} /></div>
                                <div className="ui-empty-title">{t('acct.tb.emptyTitle')}</div>
                                <div className="ui-empty-sub">{t('acct.tb.emptySub')}</div>
                            </div>
                        ) : (
                            <table className={`ui-table${onAccountClick ? ' ui-table--pick' : ''}`}>
                                <thead>
                                    <tr>
                                        <th>{t('acct.tb.th.code')}</th>
                                        <th>{t('acct.tb.th.account')}</th>
                                        <th>{t('acct.tb.th.type')}</th>
                                        <th className="ui-num">{t('acct.tb.th.debit')}</th>
                                        <th className="ui-num">{t('acct.tb.th.credit')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <tr key={`sk-${i}`} className="ui-sk-row">
                                                <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                                <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                                <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                                <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                                <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                            </tr>
                                        ))
                                    ) : paging.pagedRows.map((a) => (
                                        <tr
                                            key={a.accountId}
                                            onClick={onAccountClick ? () => onAccountClick(a.accountId) : undefined}
                                        >
                                            <td data-label={t('acct.tb.th.code')}>
                                                {/* The code carries the drill-down, so a
                                                    keyboard reaches every account. */}
                                                {onAccountClick ? (
                                                    <button
                                                        type="button"
                                                        className="ui-link"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAccountClick(a.accountId);
                                                        }}
                                                    >
                                                        {a.code}
                                                    </button>
                                                ) : (
                                                    <span className="ui-mono">{a.code}</span>
                                                )}
                                            </td>
                                            <td data-label={t('acct.tb.th.account')}>
                                                <span className="ui-strong">{a.name}</span>
                                            </td>
                                            <td data-label={t('acct.tb.th.type')}>
                                                {t(`acct.type.${a.type}`)}
                                            </td>
                                            <td data-label={t('acct.tb.th.debit')} className="ui-num">
                                                {a.debitBalance > 0 ? money(a.debitBalance) : '—'}
                                            </td>
                                            <td data-label={t('acct.tb.th.credit')} className="ui-num">
                                                {a.creditBalance > 0 ? money(a.creditBalance) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {!loading && accounts.length > 0 ? (
                                    <tfoot>
                                        <tr className="ui-row-sum ui-row-sum--close">
                                            <td colSpan={3} className="ui-num">
                                                {t('acct.tb.totals')}
                                            </td>
                                            <td className="ui-num">{money(data.totalDebits)}</td>
                                            <td className="ui-num">{money(data.totalCredits)}</td>
                                        </tr>
                                    </tfoot>
                                ) : null}
                            </table>
                        )}
                        <UiPager {...paging.pagerProps} />
                    </div>

                    {!loading && accounts.length > 0 ? (
                        <StorageBrandReportStatus
                            ok={data.isBalanced}
                            okLabel={t('acct.tb.ok')}
                            badLabel={t('acct.tb.bad', { amount: money(data.difference) })}
                        />
                    ) : null}
                </>
            )}
        </div>
    );
}
