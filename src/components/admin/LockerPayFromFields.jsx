import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { listAdminWalletCashAccounts } from '../../services/adminWalletApi';
import { getWorkshopOptions } from '../../services/superAdminApi';
import { awT } from '../../utils/adminWalletsI18n';

function useAwLocale() {
    const locale =
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null)
        || 'en';
    return (key, vars) => awT(locale, key, vars);
}

function fmt(value) {
    const n = Number(value ?? 0);
    return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function lockerFromAccounts(res) {
    const list = Array.isArray(res?.accounts)
        ? res.accounts
        : Array.isArray(res?.cashAccounts)
            ? res.cashAccounts
            : [];
    return list
        .filter((row) => row?.kind === 'SYSTEM_LOCKER_VAULT')
        .map((row) => ({
            id: String(row.id),
            name: row.name || 'Locker Wallet',
            balance: Number(row.currentBalance ?? row.balance ?? 0),
        }));
}

/**
 * Pick a workshop, then show only that workshop's Locker Wallet.
 * onChange receives { blocked, blockReason, sourceAccountId, sourceAccountName, balance }.
 */
export default function LockerPayFromFields({ amount, busy = false, onChange }) {
    const t = useAwLocale();
    const [workshops, setWorkshops] = useState([]);
    const [workshopsLoading, setWorkshopsLoading] = useState(true);
    const [workshopsError, setWorkshopsError] = useState('');
    const [workshopId, setWorkshopId] = useState('');
    const [locker, setLocker] = useState(null);
    const [lockerLoading, setLockerLoading] = useState(false);
    const [lockerError, setLockerError] = useState('');

    const amt = Number(amount ?? 0);

    useEffect(() => {
        let cancelled = false;
        setWorkshopsLoading(true);
        setWorkshopsError('');
        getWorkshopOptions()
            .then((res) => {
                if (cancelled) return;
                const rows = Array.isArray(res?.workshops) ? res.workshops : [];
                setWorkshops(rows.filter((row) => row?.id != null && row?.name));
            })
            .catch((err) => {
                if (!cancelled) setWorkshopsError(err?.message || t('locker.errWorkshops'));
            })
            .finally(() => {
                if (!cancelled) setWorkshopsLoading(false);
            });
        return () => { cancelled = true; };
        // t is a new function each render; the workshop list does not depend on it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!workshopId) {
            setLocker(null);
            setLockerError('');
            setLockerLoading(false);
            return undefined;
        }
        let cancelled = false;
        setLockerLoading(true);
        setLockerError('');
        setLocker(null);
        listAdminWalletCashAccounts({ workshopId })
            .then((res) => {
                if (cancelled) return;
                const rows = lockerFromAccounts(res);
                setLocker(rows[0] || null);
                if (!rows[0]) setLockerError(t('locker.none'));
            })
            .catch((err) => {
                if (!cancelled) setLockerError(err?.message || t('locker.errLocker'));
            })
            .finally(() => {
                if (!cancelled) setLockerLoading(false);
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId]);

    const short = Boolean(locker && amt > 0 && locker.balance + 0.001 < amt);
    let blockReason = '';
    if (workshopsError) blockReason = workshopsError;
    else if (workshopsLoading) blockReason = t('locker.loadingWorkshops');
    else if (!workshopId) blockReason = t('locker.selectWorkshop');
    else if (lockerLoading) blockReason = t('locker.loading');
    else if (lockerError) blockReason = lockerError;
    else if (!locker) blockReason = t('locker.none');
    else if (short) {
        blockReason = t('locker.short', {
            balance: fmt(locker.balance),
            amount: fmt(amt),
        });
    }

    const blocked = workshopsLoading || lockerLoading || Boolean(blockReason);

    useEffect(() => {
        onChange?.({
            blocked,
            blockReason,
            sourceAccountId: locker?.id || '',
            sourceAccountName: locker?.name || '',
            balance: locker?.balance ?? null,
            workshopId,
        });
    }, [
        blocked,
        blockReason,
        locker,
        workshopId,
    ]);

    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                {t('locker.workshop')}
            </label>
            {workshopsLoading ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                    <Loader2 size={14} className="spin" /> {t('locker.loadingWorkshops')}
                </p>
            ) : (
                <select
                    value={workshopId}
                    disabled={busy}
                    onChange={(e) => setWorkshopId(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                    }}
                >
                    <option value="">{t('locker.workshopPh')}</option>
                    {workshops.map((row) => (
                        <option key={row.id} value={String(row.id)}>
                            {row.name}
                        </option>
                    ))}
                </select>
            )}

            {workshopId ? (
                <div
                    style={{
                        marginTop: 10,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: short ? '#fef2f2' : '#f8fafc',
                        border: `1px solid ${short ? '#fecaca' : '#e2e8f0'}`,
                    }}
                >
                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        {t('locker.wallet')}
                    </p>
                    {lockerLoading ? (
                        <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                            {t('locker.loading')}
                        </p>
                    ) : locker ? (
                        <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#0f172a' }}>
                            <strong>{locker.name}</strong>
                            {' · '}
                            {t('locker.balance')} <strong>SAR {fmt(locker.balance)}</strong>
                        </p>
                    ) : (
                        <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#b91c1c' }}>
                            {lockerError || t('locker.none')}
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
