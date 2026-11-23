import React, { lazy, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { wstT } from '../../utils/workshopStockI18n';
import WorkshopInventory from './WorkshopInventory';
import './workshopStock.css';

const WorkshopStockValuation = lazy(() => import('./WorkshopStockValuation'));
const WorkshopStockCountScreen = lazy(() => import('./WorkshopStockCountScreen'));

const VIEWS = ['inventory', 'valuation', 'counts'];

/**
 * Manage Inventory = three first-class tabs (no modals):
 *   Inventory · Stock valuation · Physical count / Make zero
 * The tab lives in `?view=` so it survives refresh and is linkable.
 */
export default function WorkshopInventoryShell(props) {
    const { selectedBranchId = 'all', branches = [], locale: localeProp } = props;
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wstT(locale, key, vars), [locale]);
    const [params, setParams] = useSearchParams();
    const raw = params.get('view');
    const view = VIEWS.includes(raw) ? raw : 'inventory';
    const { workshop } = useAuth();
    const workshopId = useMemo(() => {
        const id = workshop?.id ?? workshop?._id ?? workshop?.workshopId;
        return id != null && String(id).trim() !== '' ? String(id) : undefined;
    }, [workshop]);
    const branchId = selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '';
    const branchName = branches.find((b) => String(b.id) === branchId)?.name || '';

    const setView = (v) => {
        const next = new URLSearchParams(params);
        if (v === 'inventory') next.delete('view');
        else next.set('view', v);
        next.delete('count');
        next.delete('posted');
        setParams(next);
    };

    return (
        <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="wsk-tabs" role="tablist" aria-label="Inventory">
                {VIEWS.map((v) => (
                    <button
                        key={v}
                        type="button"
                        role="tab"
                        aria-selected={view === v}
                        className={`wsk-tab${view === v ? ' wsk-tab--active' : ''}`}
                        onClick={() => setView(v)}
                    >
                        {t(`tab.${v}`)}
                    </button>
                ))}
            </div>
            {view === 'inventory' ? (
                <WorkshopInventory {...props} />
            ) : (
                <div className="wsk-page">
                    <Suspense fallback={<div className="wsk-muted">{t('common.loading')}</div>}>
                        {!branchId ? (
                            <div className="wsk-error">{t('common.noBranch')}</div>
                        ) : view === 'valuation' ? (
                            <WorkshopStockValuation t={t} branchId={branchId} branchName={branchName} locale={locale} />
                        ) : (
                            <WorkshopStockCountScreen t={t} branchId={branchId} branchName={branchName} workshopId={workshopId} />
                        )}
                    </Suspense>
                </div>
            )}
        </div>
    );
}
