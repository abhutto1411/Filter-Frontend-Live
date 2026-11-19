import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { parseWorkshopCorporateAccountId } from '../../utils/workshopCorporatePath';
import { wcorpT } from '../../utils/workshopCorporateI18n';
import { cbT } from '../../utils/corporateBillingI18n';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import {
    getWorkshopMonthlyBillPreview,
    postWorkshopMonthlyBill,
} from '../../services/workshopStaffApi';
import CorporateGenerateBillPage from '../../components/admin/CorporateGenerateBillPage';

function billingPeriodDateParam(dateStr) {
    const s = String(dateStr || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/**
 * Workshop full-page generate monthly bill. Document only — does not assign AR to HQ.
 * Browser Back returns to the statement with the same dates.
 */
export default function WorkshopCorporateGenerateBillPage({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => cbT(locale, key, vars), [locale]);
    const wt = useCallback((key, vars) => wcorpT(locale, key, vars), [locale]);
    const isAr = String(locale).startsWith('ar');
    const location = useLocation();
    const params = useParams();
    const corporateAccountId =
        parseWorkshopCorporateAccountId(location.pathname) || params.corporateAccountId || null;
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const today = toRiyadhDateISO(new Date()) || '';
    const dateFrom = searchParams.get('dateFrom') || (today ? `${today.slice(0, 8)}01` : '');
    const dateTo = searchParams.get('dateTo') || today;

    const [dueDate, setDueDate] = useState(dateTo || '');
    const [ledger, setLedger] = useState(null);
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const statementHref = (extra = {}) => {
        const q = new URLSearchParams();
        q.set('dateFrom', dateFrom);
        q.set('dateTo', dateTo);
        if (extra.tab) q.set('tab', extra.tab);
        if (extra.billId) q.set('billId', String(extra.billId));
        return `/workshop/corporate-management/${encodeURIComponent(corporateAccountId || '')}?${q.toString()}`;
    };

    const loadPreview = useCallback(async () => {
        if (!corporateAccountId) {
            setLoading(false);
            setError(wt('err.missingAccount'));
            setLedger(null);
            return;
        }
        if (!dateFrom || !dateTo) {
            setLoading(false);
            setError(wt('err.generatePreview'));
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await getWorkshopMonthlyBillPreview(corporateAccountId, {
                startDate: billingPeriodDateParam(dateFrom),
                endDate: billingPeriodDateParam(dateTo),
                dueDate: billingPeriodDateParam(dueDate || dateTo),
            });
            setLedger(res?.ledgerStatement || res?.ledger || null);
            setCompanyName(
                res?.corporateAccount?.companyName ||
                    res?.ledgerStatement?.corporateAccount?.companyName ||
                    '',
            );
        } catch (e) {
            setError(e?.message || wt('err.generatePreview'));
            setLedger(null);
        } finally {
            setLoading(false);
        }
    }, [corporateAccountId, dateFrom, dateTo, dueDate, wt]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    const onClose = () => {
        if (generating) return;
        navigate(statementHref());
    };

    const onGenerate = async (opts = {}) => {
        const lineOverrides = Array.isArray(opts?.lineOverrides) ? opts.lineOverrides : [];
        const excludeInvoiceIds = Array.isArray(opts?.excludeInvoiceIds) ? opts.excludeInvoiceIds : [];
        const includeOpeningBalance = opts?.includeOpeningBalance !== false;
        if (!corporateAccountId || !dueDate.trim()) return;
        setGenerating(true);
        setError('');
        try {
            const res = await postWorkshopMonthlyBill(corporateAccountId, {
                startDate: billingPeriodDateParam(dateFrom),
                endDate: billingPeriodDateParam(dateTo),
                dueDate: dueDate.trim(),
                lineOverrides,
                excludeInvoiceIds,
                includeOpeningBalance,
            });
            navigate(
                statementHref({
                    tab: 'generated-bills',
                    billId: res?.bill?.id || '',
                }),
                {
                    state: { generatedBillNo: res?.bill?.billNo || '' },
                },
            );
        } catch (e) {
            setError(e?.message || wt('err.generate'));
        } finally {
            setGenerating(false);
        }
    };

    if (loading && !ledger) {
        return (
            <div className="ws-section" style={{ margin: 16 }} data-testid="wcorp-generate-page">
                {wt('btn.refreshing')}
            </div>
        );
    }

    return (
        <div data-testid="wcorp-generate-page">
            {error && !ledger ? (
                <div className="ws-section" style={{ margin: 16, color: '#B91C1C' }}>
                    {error}
                    <button type="button" className="btn-portal-outline" style={{ marginInlineStart: 12 }} onClick={onClose}>
                        {wt('stmt.back')}
                    </button>
                </div>
            ) : (
                <CorporateGenerateBillPage
                    onClose={onClose}
                    t={t}
                    isAr={isAr}
                    companyName={companyName}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    dueDate={dueDate}
                    onDueDateChange={setDueDate}
                    ledger={ledger}
                    generating={generating}
                    submitError={error}
                    onGenerate={onGenerate}
                />
            )}
        </div>
    );
}
