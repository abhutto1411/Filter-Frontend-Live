import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

const PREFILL_KEY = 'transactionHubReceiptPrefill';

function readPrefill(location) {
    const fromState = location?.state?.[PREFILL_KEY];
    if (fromState) return fromState;
    try {
        const raw = sessionStorage.getItem(PREFILL_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export default function SupplierReceiptsPage({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const location = useLocation();
    const prefill = useMemo(() => readPrefill(location), [location]);

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
            <AcctCard title={t('mgr.rec.new')}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>{t('mgr.rec.hint')}</p>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading locale={locale} />
                ) : (
                    <PaymentReceiptGrid
                        variant="receipt"
                        accounts={accounts}
                        superSuppliers={superSuppliers}
                        staff={staff}
                        customerOptions={customerOptions}
                        locale={locale}
                        t={t}
                        cashFieldLabel={t('logs.col.receivedIn')}
                        initialPrefill={prefill}
                        onPosted={() => {
                            try {
                                sessionStorage.removeItem(PREFILL_KEY);
                            } catch {
                                /* ignore */
                            }
                            setRefreshToken((n) => n + 1);
                        }}
                    />
                )}
            </AcctCard>
            <AcctCard title={t('mgr.rec.title')}>
                <LogTab tab="receipts" locale={locale} t={t} refreshToken={refreshToken} />
            </AcctCard>
        </div>
    );
}
