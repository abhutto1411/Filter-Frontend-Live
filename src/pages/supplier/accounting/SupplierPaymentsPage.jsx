import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSupplierAccounts, unwrapSupplierAccountingList } from '../../../services/supplierAccountingApi';
import {
    listSupplierAffiliatedWorkshops,
    listSupplierExternalParties,
    listSupplierStaff,
    listSupplierSuperSuppliers,
} from '../../../services/supplierApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../../utils/supplierPermissions';
import {
    AcctCard,
    AcctError,
    AcctLoading,
} from './SupplierAccountingShared';
import { PaymentReceiptGrid, buildCustomerOptions, journalToMoneyPrefill } from './SupplierPayReceiptBulkGrid';
import { LogTab } from './SupplierJournalLogs';
import { extractArray } from './SupplierManagerAccountingShared';

export default function SupplierPaymentsPage({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [searchParams, setSearchParams] = useSearchParams();
    const rawPaymentId = searchParams.get('paymentId') || '';
    const deepLinkPaymentId = /^\d+$/.test(rawPaymentId) ? rawPaymentId : null;
    const clearDeepLink = useCallback(() => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.delete('paymentId');
                return next;
            },
            { replace: true },
        );
    }, [setSearchParams]);
    const canPost = useSupplierCan()(SUPPLIER_PERM.paymentPost); // SP-22

    const [accounts, setAccounts] = useState([]);
    const [superSuppliers, setSuperSuppliers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [affiliated, setAffiliated] = useState([]);
    const [externals, setExternals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [refreshToken, setRefreshToken] = useState(0);
    const [editPrefill, setEditPrefill] = useState(null);

    const customerOptions = useMemo(
        () => buildCustomerOptions(affiliated, externals, t),
        [affiliated, externals, t],
    );

    const loadLookups = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [acc, ss, st, aff, ext] = await Promise.all([
                getSupplierAccounts({ status: 'active' }),
                listSupplierSuperSuppliers().catch(() => ({})),
                listSupplierStaff({ status: 'active' }).catch(() => ({})),
                listSupplierAffiliatedWorkshops().catch(() => ({})),
                listSupplierExternalParties().catch(() => ({})),
            ]);
            setAccounts(unwrapSupplierAccountingList(acc));
            setSuperSuppliers(extractArray(ss, ['superSuppliers', 'data']));
            setStaff(extractArray(st, ['staff', 'data']));
            setAffiliated(extractArray(aff, ['rows', 'data']));
            setExternals(extractArray(ext, ['parties', 'rows', 'data']));
        } catch (e) {
            setErr(e?.message || t('hub.err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadLookups();
    }, [loadLookups]);

    return (
        <div className="module-container">
            <AcctCard title={t('mgr.pay.new')}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>{t('mgr.pay.hint')}</p>
                <AcctError message={err} />
                {!canPost ? (
                    <p className="sp-perm-denied" role="status">{t('perm.denied')}</p>
                ) : loading ? (
                    <AcctLoading locale={locale} />
                ) : (
                    <PaymentReceiptGrid
                        variant="payment"
                        accounts={accounts}
                        superSuppliers={superSuppliers}
                        staff={staff}
                        customerOptions={customerOptions}
                        locale={locale}
                        t={t}
                        cashFieldLabel={t('logs.col.paidFrom')}
                        initialPrefill={editPrefill}
                        onPosted={() => {
                            setEditPrefill(null);
                            setRefreshToken((n) => n + 1);
                        }}
                    />
                )}
            </AcctCard>
            <AcctCard title={t('mgr.pay.title')}>
                <LogTab
                    tab="payments"
                    locale={locale}
                    t={t}
                    refreshToken={refreshToken}
                    accounts={accounts}
                    // MZ-12 (2): journal "Open source document" → `/supplier/payments?paymentId=<journalId>`
                    // opens that payment's detail (the hub payment IS its journal).
                    initialDetailId={deepLinkPaymentId}
                    onDetailClosed={clearDeepLink}
                    onEdit={(journal) => {
                        const next = journalToMoneyPrefill(journal, 'payment');
                        if (next) {
                            setEditPrefill(next);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}
                />
            </AcctCard>
        </div>
    );
}
