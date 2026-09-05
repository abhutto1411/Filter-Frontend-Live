import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupplierAccounts, unwrapSupplierAccountingList } from '../../../services/supplierAccountingApi';
import {
    listSupplierAffiliatedWorkshops,
    listSupplierExternalParties,
    listSupplierStaff,
    listSupplierSuperSuppliers,
} from '../../../services/supplierApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import {
    AcctCard,
    AcctError,
    AcctLoading,
} from './SupplierAccountingShared';
import { PaymentReceiptGrid, buildCustomerOptions } from './SupplierPayReceiptBulkGrid';
import { LogTab } from './SupplierJournalLogs';
import { extractArray } from './SupplierManagerAccountingShared';

export default function SupplierPaymentsPage({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);

    const [accounts, setAccounts] = useState([]);
    const [superSuppliers, setSuperSuppliers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [affiliated, setAffiliated] = useState([]);
    const [externals, setExternals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [refreshToken, setRefreshToken] = useState(0);

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
                {loading ? (
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
                        onPosted={() => setRefreshToken((n) => n + 1)}
                    />
                )}
            </AcctCard>
            <AcctCard title={t('mgr.pay.title')}>
                <LogTab tab="payments" locale={locale} t={t} refreshToken={refreshToken} />
            </AcctCard>
        </div>
    );
}
