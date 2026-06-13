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
import { StorageBrandReportDateRange } from './StorageBrandReportToolbar';

function StatementSection({ title, rows, totalLabel, total }) {
    return (
        <div className="sf-pl-section">
            <h4 className="sf-pl-section-title">{title}</h4>
            {rows.length === 0 ? (
                <p className="sf-pl-empty">None in this period</p>
            ) : (
                <ul className="sf-pl-lines">
                    {rows.map((r) => (
                        <li key={r.id}>
                            <span className="sf-pl-line-name">
                                [{r.code}] {r.name}
                            </span>
                            <span className="sf-pl-line-amt">{money(r.amount)}</span>
                        </li>
                    ))}
                </ul>
            )}
            <div className="sf-pl-section-total">
                <span>{totalLabel}</span>
                <span>{money(total)}</span>
            </div>
        </div>
    );
}

export default function StorageBrandIncomeStatementTab({ brandId }) {
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
            const res = await accountingApi.getBrandProfitLoss(brandId, { dateFrom, dateTo });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load income statement');
        } finally {
            setLoading(false);
        }
    }, [brandId, dateFrom, dateTo]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <AcctCard title="Income statement">
            <p className="sf-acct-report-lead">
                Revenue and expenses for the selected period.
            </p>
            <StorageBrandReportDateRange dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : !data ? (
                <AcctEmpty message="No data." />
            ) : (
                <div className="sf-pl-sheet">
                    <StatementSection
                        title="Revenue"
                        rows={data.revenue || []}
                        totalLabel="Total revenue"
                        total={data.totalRevenue}
                    />
                    <StatementSection
                        title="Expenses"
                        rows={data.expenses || []}
                        totalLabel="Total expenses"
                        total={data.totalExpenses}
                    />
                    <div className="sf-pl-net">
                        <span>Net income</span>
                        <span
                            className={
                                data.netIncome >= 0
                                    ? 'sf-pl-net-amt sf-pl-net-amt--pos'
                                    : 'sf-pl-net-amt sf-pl-net-amt--neg'
                            }
                        >
                            {money(data.netIncome)}
                        </span>
                    </div>
                </div>
            )}
        </AcctCard>
    );
}
