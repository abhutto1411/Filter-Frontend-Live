import React, { useCallback, useEffect, useState } from 'react';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    money,
    todayISO,
} from '../../accounting/SupplierAccountingShared';
import { StorageBrandReportStatus } from './StorageBrandReportToolbar';

function BsSection({ title, rows, total }) {
    return (
        <div className="sf-pl-section">
            <h4 className="sf-pl-section-title">{title}</h4>
            {rows.length === 0 ? (
                <p className="sf-pl-empty">—</p>
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
                <span>Total {title.toLowerCase()}</span>
                <span>{money(total)}</span>
            </div>
        </div>
    );
}

export default function StorageBrandBalanceSheetTab({ brandId }) {
    const accountingApi = useStorageFacilityAccountingApi();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [asOf, setAsOf] = useState(todayISO());

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await accountingApi.getBrandBalanceSheet(brandId, { asOf });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load balance sheet');
        } finally {
            setLoading(false);
        }
    }, [brandId, asOf, accountingApi]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <AcctCard title="Balance sheet">
            <p className="sf-acct-report-lead">Position as of the date below.</p>
            <div className="sf-acct-report-toolbar">
                <label className="sf-acct-report-field">
                    <span>As of</span>
                    <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
                </label>
            </div>
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : !data ? (
                <AcctEmpty message="No data." />
            ) : (
                <div className="sf-pl-sheet">
                    <BsSection title="Assets" rows={data.assets || []} total={data.totalAssets} />
                    <BsSection
                        title="Liabilities"
                        rows={data.liabilities || []}
                        total={data.totalLiabilities}
                    />
                    <BsSection title="Equity" rows={data.equity || []} total={data.totalEquity} />
                    <div className="sf-pl-section-total sf-pl-section-total--emph">
                        <span>Total liabilities & equity</span>
                        <span>{money(data.totalLiabilitiesAndEquity)}</span>
                    </div>
                    <StorageBrandReportStatus
                        ok={data.isBalanced}
                        okLabel="Assets equal liabilities plus equity."
                        badLabel={`Difference: ${money(data.difference)}.`}
                    />
                </div>
            )}
        </AcctCard>
    );
}
