import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import { startOfMonthISO, todayISO } from '../../accounting/SupplierAccountingShared';
import { useSfT } from '../useSfT';
import { sfMoney } from '../sfFormat';
import {
    StorageBrandReportDateRange,
    StorageBrandReportError,
    StorageBrandReportSkeleton,
    StorageBrandStatementSection,
} from './StorageBrandReportToolbar';
import '../../../../styles/ui.css';

export default function StorageBrandIncomeStatementTab({ brandId }) {
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
            const res = await accountingApi.getBrandProfitLoss(brandId, { dateFrom, dateTo });
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

    const money = (v) => sfMoney(t, v);
    const positive = Number(data?.netIncome || 0) >= 0;

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('acct.pl.lead')}</p>
            <StorageBrandReportDateRange dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />

            {loading ? (
                <StorageBrandReportSkeleton sections={2} lines={4} />
            ) : loadError ? (
                <StorageBrandReportError
                    title={t('acct.pl.errLoad')}
                    onRetry={() => setReloadKey((k) => k + 1)}
                />
            ) : !data ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><TrendingUp size={18} /></div>
                    <div className="ui-empty-title">{t('acct.pl.emptyTitle')}</div>
                    <div className="ui-empty-sub">{t('acct.pl.emptySub')}</div>
                </div>
            ) : (
                <>
                    <StorageBrandStatementSection
                        title={t('acct.pl.revenue')}
                        rows={data.revenue || []}
                        totalLabel={t('acct.pl.totalRevenue')}
                        total={data.totalRevenue}
                        emptyLabel={t('acct.pl.none')}
                        money={money}
                    />
                    <StorageBrandStatementSection
                        title={t('acct.pl.expenses')}
                        rows={data.expenses || []}
                        totalLabel={t('acct.pl.totalExpenses')}
                        total={data.totalExpenses}
                        emptyLabel={t('acct.pl.none')}
                        money={money}
                    />

                    {/* The bottom line is the figure the screen exists for. */}
                    <div className={`ui-metric ui-metric--${positive ? 'ok' : 'dang'}`}>
                        <div className="ui-metric-label">{t('acct.pl.net')}</div>
                        <div className="ui-metric-value">{money(data.netIncome)}</div>
                    </div>
                </>
            )}
        </div>
    );
}
