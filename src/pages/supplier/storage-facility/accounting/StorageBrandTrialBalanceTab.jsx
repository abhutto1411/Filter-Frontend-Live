import React, { useCallback, useEffect, useState } from 'react';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';

import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    money,
    startOfMonthISO,
    todayISO,
} from '../../accounting/SupplierAccountingShared';
import { StorageBrandReportDateRange, StorageBrandReportStatus } from './StorageBrandReportToolbar';

export default function StorageBrandTrialBalanceTab({ brandId, onAccountClick }) {
    const accountingApi = useStorageFacilityAccountingApi();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [{ dateFrom, dateTo }, setRange] = useState({
        dateFrom: startOfMonthISO(),
        dateTo: todayISO(),
    });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await accountingApi.getBrandTrialBalance(brandId, { dateFrom, dateTo });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load trial balance');
        } finally {
            setLoading(false);
        }
    }, [brandId, dateFrom, dateTo]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <AcctCard title="Trial balance">
            <p className="sf-acct-report-lead">
                Debits and credits for the period. Click an account to open its ledger.
            </p>
            <StorageBrandReportDateRange dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : !data?.accounts?.length ? (
                <AcctEmpty message="No balances for this period." />
            ) : (
                <>
                    <div className="premium-table mgr-si-table-wrap sf-acct-report-table-wrap">
                        <table className="mgr-si-table">
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">Code</th>
                                    <th className="table-th">Account</th>
                                    <th className="table-th">Type</th>
                                    <th className="table-th" style={{ textAlign: 'right' }}>
                                        Debit
                                    </th>
                                    <th className="table-th" style={{ textAlign: 'right' }}>
                                        Credit
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.accounts.map((a) => (
                                    <tr
                                        key={a.accountId}
                                        className={
                                            onAccountClick
                                                ? 'table-row sf-acct-report-row--clickable'
                                                : 'table-row'
                                        }
                                        onClick={() => onAccountClick?.(a.accountId)}
                                    >
                                        <td className="table-cell" style={{ fontWeight: 700 }}>
                                            {a.code}
                                        </td>
                                        <td className="table-cell">{a.name}</td>
                                        <td className="table-cell">{a.type}</td>
                                        <td className="table-cell" style={{ textAlign: 'right' }}>
                                            {a.debitBalance > 0 ? money(a.debitBalance) : '—'}
                                        </td>
                                        <td className="table-cell" style={{ textAlign: 'right' }}>
                                            {a.creditBalance > 0 ? money(a.creditBalance) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="table-row">
                                    <td
                                        colSpan={3}
                                        className="table-cell"
                                        style={{ textAlign: 'right', fontWeight: 800 }}
                                    >
                                        Totals
                                    </td>
                                    <td
                                        className="table-cell"
                                        style={{ textAlign: 'right', fontWeight: 800 }}
                                    >
                                        {money(data.totalDebits)}
                                    </td>
                                    <td
                                        className="table-cell"
                                        style={{ textAlign: 'right', fontWeight: 800 }}
                                    >
                                        {money(data.totalCredits)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <StorageBrandReportStatus
                        ok={data.isBalanced}
                        okLabel="Books balance for this period."
                        badLabel={`Out of balance by ${money(data.difference)}.`}
                    />
                </>
            )}
        </AcctCard>
    );
}
