import React, { useCallback, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import { todayISO } from '../../accounting/SupplierAccountingShared';
import { useSfT } from '../useSfT';
import { sfMoney } from '../sfFormat';
import {
    StorageBrandReportAsOf,
    StorageBrandReportError,
    StorageBrandReportSkeleton,
    StorageBrandReportStatus,
    StorageBrandStatementSection,
} from './StorageBrandReportToolbar';
import '../../../../styles/ui.css';

export default function StorageBrandBalanceSheetTab({ brandId }) {
    const t = useSfT();
    const accountingApi = useStorageFacilityAccountingApi();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [asOf, setAsOf] = useState(todayISO());
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await accountingApi.getBrandBalanceSheet(brandId, { asOf });
            setData(res);
            setLoadError(false);
        } catch {
            setData(null);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, asOf, accountingApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    const money = (v) => sfMoney(t, v);

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('acct.bs.lead')}</p>
            <StorageBrandReportAsOf asOf={asOf} onChange={setAsOf} />

            {loading ? (
                <StorageBrandReportSkeleton sections={3} lines={3} />
            ) : loadError ? (
                <StorageBrandReportError
                    title={t('acct.bs.errLoad')}
                    onRetry={() => setReloadKey((k) => k + 1)}
                />
            ) : !data ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Scale size={18} /></div>
                    <div className="ui-empty-title">{t('acct.bs.emptyTitle')}</div>
                    <div className="ui-empty-sub">{t('acct.bs.emptySub')}</div>
                </div>
            ) : (
                <>
                    <StorageBrandStatementSection
                        title={t('acct.bs.assets')}
                        rows={data.assets || []}
                        totalLabel={t('acct.bs.totalAssets')}
                        total={data.totalAssets}
                        emptyLabel={t('acct.bs.none')}
                        money={money}
                    />
                    <StorageBrandStatementSection
                        title={t('acct.bs.liabilities')}
                        rows={data.liabilities || []}
                        totalLabel={t('acct.bs.totalLiabilities')}
                        total={data.totalLiabilities}
                        emptyLabel={t('acct.bs.none')}
                        money={money}
                    />
                    <StorageBrandStatementSection
                        title={t('acct.bs.equity')}
                        rows={data.equity || []}
                        totalLabel={t('acct.bs.totalEquity')}
                        total={data.totalEquity}
                        emptyLabel={t('acct.bs.none')}
                        money={money}
                    />

                    <div className="ui-panel ui-panel-pad">
                        <div className="ui-sum">
                            <div className="ui-sum-row ui-sum-row--total">
                                <span>{t('acct.bs.totalLiabEquity')}</span>
                                <span>{money(data.totalLiabilitiesAndEquity)}</span>
                            </div>
                        </div>
                    </div>

                    <StorageBrandReportStatus
                        ok={data.isBalanced}
                        okLabel={t('acct.bs.ok')}
                        badLabel={t('acct.bs.bad', { amount: money(data.difference) })}
                    />
                </>
            )}
        </div>
    );
}
