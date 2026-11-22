import { useCallback, useEffect, useMemo, useState } from 'react';
import { distributeCorporateBill, getCorporateBillDistribution } from '../../services/superAdminApi';
import { cfx02T } from '../../utils/corporateFix02I18n';
import { VatModelChip } from './CorporateBillDistributionPreview';
import { payoutWithinShare } from '../../utils/corporateBillPayout';
import {
    balanceUnknown,
    buildDistributeAllocations,
    distributeErrorKey,
    distributeTodayYmd,
    distributeTotal,
    payFromOptions,
    payoutConfirmState,
    payoutShortfall,
} from '../../utils/corporateBillDistribute';
import Money from '../Money';
import WalletApprovalAccountFields from './WalletApprovalAccountFields';

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** F3: payout date default = today in Asia/Riyadh (not the browser zone). */
const todayYmd = () => distributeTodayYmd(new Date());

/**
 * FINAL F3: FIX-03 pay-from picker for one workshop row (live balance, empty
 * and loading states, no silent default).
 */
function WorkshopPayFromField({ row, index, amount, busy, t, onPick }) {
    const banks = row.wsBanks;
    const loadWsPayFrom = useCallback(
        async () => payFromOptions(banks, (b) => (String(b.type || '').toUpperCase() === 'BANK' ? t('payout.bank') : t('payout.cash'))),
        [banks, t],
    );
    const onChange = useCallback((v) => onPick(index, v), [index, onPick]);
    const picked = banks.find((b) => String(b.id) === String(row.wsAccount));
    return (
        <div className="ui-field ui-col-8" data-testid={`cfx02-ws-payfrom-${row.workshopId}`}>
            <span>{t('payout.wsAccount')}</span>
            {banks.length === 0 ? (
                <span className="ui-help ui-help--err">{t('payout.noRegister')}</span>
            ) : (
                <WalletApprovalAccountFields
                    mode="fund"
                    showBudget={false}
                    skipRequesterWallet
                    autoSelectFirstPayFrom={false}
                    amount={0}
                    busy={busy}
                    loadCashAccounts={loadWsPayFrom}
                    onChange={onChange}
                />
            )}
            {picked ? (
                <span className="ui-help">
                    {t('payout.availableLabel', { name: picked.name })}{' '}
                    {balanceUnknown(picked.availableBalance) ? t('payout.balanceUnknown') : <Money amount={picked.availableBalance} size={12} />}
                    {' · '}
                    {t('payout.amount')} <Money amount={amount} size={12} />
                </span>
            ) : null}
        </div>
    );
}


/**
 * CORPORATE-FIX-02 G2: Super Admin → Bill detail → Distribute to workshops.
 * Per workshop: net share, collected share, paid, payable now; a pay-from dialog per
 * row and "Distribute all". The backend re-checks every amount.
 */
export default function CorporateBillDistributePanel({ billId, locale, onPosted }) {
    const t = useCallback((k, v) => cfx02T(locale, k, v), [locale]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dialog, setDialog] = useState(null); // { rows:[{workshopId, amount, wsAccount}], hqAccount, date }
    const [posting, setPosting] = useState(false);
    const [notice, setNotice] = useState('');
    const [hqPick, setHqPick] = useState(null); // FIX-03 pay-from state

    const load = useCallback(async () => {
        if (!billId) return;
        setLoading(true);
        setError('');
        try {
            setData(await getCorporateBillDistribution(billId));
        } catch (e) {
            setError(e?.message || 'Error');
        } finally {
            setLoading(false);
        }
    }, [billId]);

    useEffect(() => {
        Promise.resolve().then(load);
    }, [load]);

    const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);
    const hqBanks = useMemo(() => (Array.isArray(data?.hqCashBanks) ? data.hqCashBanks : []), [data]);
    const bill = data?.bill || {};
    const payable = rows.filter((r) => r2(r.payableNow) > 0.005);

    const openDialog = (targetRows) => {
        setNotice('');
        setHqPick(null);
        setDialog({
            date: todayYmd(),
            // FINAL F2: no silent default register.
            hqAccount: '',
            rows: targetRows.map((r) => ({
                workshopId: r.workshopId,
                workshopName: r.workshopName,
                payableNow: r.payableNow,
                amount: String(r.payableNow),
                wsAccount: '',
                wsBanks: r.workshopCashBanks || [],
            })),
        });
    };

    // F4: feed the HQ registers (with live balance) into the FIX-03 picker.
    const loadHqPayFrom = useCallback(
        async () => payFromOptions(hqBanks, (b) => (String(b.type || '').toUpperCase() === 'BANK' ? t('payout.bank') : t('payout.cash'))),
        [hqBanks, t],
    );
    // FINAL F3: workshop-side pick → the row's workshopCashBankAccountId.
    const onWsPayFromChange = useCallback((index, v) => {
        const id = v?.sourceAccountId || '';
        setDialog((d) => {
            if (!d || !d.rows[index] || d.rows[index].wsAccount === id) return d;
            return { ...d, rows: d.rows.map((x, j) => (j === index ? { ...x, wsAccount: id } : x)) };
        });
    }, []);
    const onHqPayFromChange = useCallback((v) => {
        setHqPick(v);
        const id = v?.sourceAccountId || '';
        setDialog((d) => (d && d.hqAccount !== id ? { ...d, hqAccount: id } : d));
    }, []);

    const dialogTotal = distributeTotal(dialog);
    // FINAL F2: only an explicit pick counts (no fallback to the first register).
    const hqPickedId = hqPick?.sourceAccountId || '';
    const hqPicked = hqBanks.find((b) => String(b.id) === String(hqPickedId));
    const ownFlag = hqPicked?.allowNegativeBalance === true;
    const allowNegative = hqPicked?.negativeAllowed != null
        ? hqPicked.negativeAllowed === true
        : ownFlag;
    const peerOff = ownFlag && !allowNegative;
    const confirm = payoutConfirmState({
        hqPickedId,
        hqBalance: hqPicked?.availableBalance,
        total: dialogTotal,
        allowNegative,
        rows: dialog?.rows,
        posting,
        loading: Boolean(hqPick?.loading),
    });
    const shortfall = payoutShortfall({ balance: hqPicked?.availableBalance, total: dialogTotal });
    const hqShort = shortfall > 0 && !allowNegative;
    const hqNegativeHint = shortfall > 0 && allowNegative;
    const confirmBlocked = confirm.disabled;

    const submit = async () => {
        if (!dialog) return;
        if (confirm.disabled) {
            setError(t(confirm.reasonKey || 'payout.pickAccounts'));
            return;
        }
        if (!dialog.hqAccount || dialog.rows.some((r) => !r.wsAccount)) {
            setError(t('payout.pickAccounts'));
            return;
        }
        if (dialog.rows.some((r) => !payoutWithinShare(r, r.amount))) {
            setError(t('payout.exceeds'));
            return;
        }
        setPosting(true);
        setError('');
        try {
            await distributeCorporateBill(billId, {
                date: dialog.date,
                allocations: buildDistributeAllocations(dialog),
            });
            setDialog(null);
            setNotice(t('payout.done'));
            await load();
            onPosted?.();
        } catch (e) {
            const k = distributeErrorKey(e);
            const isAr = String(locale || '').startsWith('ar');
            const msg = isAr ? e?.messageAr || e?.body?.messageAr || '' : e?.message;
            // FINAL F5: known codes always show the localized EN/AR message.
            setError(k ? (isAr ? t(k) : `${t(k)} ${msg || ''}`.trim()) : msg || e?.message || t('payout.reason.busy'));
        } finally {
            setPosting(false);
        }
    };

    if (!billId) return null;

    return (
        <section className="ui-card" data-testid="cfx02-distribute" style={{ marginTop: 12 }}>
            <div className="ui-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <h3 className="ui-card-title" style={{ margin: 0 }}>{t('payout.title')}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <VatModelChip vatModel={bill.vatModel} locale={locale} />
                    <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={load} disabled={loading}>
                        {t('payout.refresh')}
                    </button>
                </div>
            </div>
            {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : null}
            {notice ? <p style={{ color: '#047857' }}>{notice}</p> : null}
            {!loading && rows.length === 0 ? <p className="ui-help">{t('payout.noRows')}</p> : null}
            {rows.length ? (
                <>
                    <div className="ui-kpis">
                        <div className="ui-metric">
                            <div className="ui-metric-label">{t('payout.billedNet')}</div>
                            <div className="ui-metric-value"><Money amount={bill.billedNet} /></div>
                            {r2(bill.creditNotesAfterBill) > 0 ? (
                                <div className="ui-help">{t('payout.afterCnLabel')} <Money amount={bill.creditNotesAfterBill} size={12} /></div>
                            ) : null}
                        </div>
                        <div className="ui-metric">
                            <div className="ui-metric-label">{t('payout.collected')}</div>
                            <div className="ui-metric-value"><Money amount={data?.totals?.collected} /></div>
                        </div>
                        <div className="ui-metric">
                            <div className="ui-metric-label">{t('payout.paid')}</div>
                            <div className="ui-metric-value"><Money amount={data?.totals?.paid} /></div>
                        </div>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t('dist.workshop')}</th>
                                    <th className="ui-num">{t('payout.netShare')}</th>
                                    <th className="ui-num">{t('payout.collectedShare')}</th>
                                    <th className="ui-num">{t('payout.paidCol')}</th>
                                    <th className="ui-num">{t('payout.payableNow')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.workshopId}>
                                        <td>W{r.workshopId} · {r.workshopName || '—'}</td>
                                        <td className="ui-num"><Money amount={r.netShare} /></td>
                                        <td className="ui-num"><Money amount={r.collectedShare} /></td>
                                        <td className="ui-num"><Money amount={r.paid} /></td>
                                        <td className="ui-num"><Money amount={r.payableNow} /></td>
                                        <td>
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                disabled={r2(r.payableNow) <= 0.005 || posting}
                                                onClick={() => openDialog([r])}
                                            >
                                                {t('payout.payFrom')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="ui-help">{t('payout.rule')}</p>
                    <div className="ui-row" style={{ gap: 10 }}>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            disabled={!payable.length || posting}
                            onClick={() => openDialog(payable)}
                            data-testid="cfx02-distribute-all"
                        >
                            {t('payout.distributeAll')}
                        </button>
                        {hqBanks[0] ? (
                            <span className="ui-help">
                                {t('payout.availableLabel', { name: hqBanks[0].name })} <Money amount={hqBanks[0].availableBalance} size={12} />
                            </span>
                        ) : null}
                    </div>
                </>
            ) : null}

            {dialog ? (
                <div role="dialog" aria-modal="true" className="ui-card" style={{ marginTop: 12, border: '1px solid #cbd5e1' }} data-testid="cfx02-payfrom">
                    <h4 style={{ marginTop: 0 }}>
                        {dialog.rows.length === 1
                            ? t('payout.dialogTitle', { workshop: `W${dialog.rows[0].workshopId} · ${dialog.rows[0].workshopName || ''}` })
                            : t('payout.distributeAll')}
                    </h4>
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-6" data-testid="cfx02-hq-payfrom">
                            <span>{t('payout.hqAccount')}</span>
                            {/* F4: the existing FIX-03 pay-from picker (live balance + short-register block). */}
                            {hqBanks.length === 0 ? (
                                <span className="ui-help ui-help--err">{t('payout.noRegister')}</span>
                            ) : (
                                <WalletApprovalAccountFields
                                    mode="fund"
                                    showBudget={false}
                                    skipRequesterWallet
                                    autoSelectFirstPayFrom={false}
                                    amount={dialogTotal}
                                    busy={posting}
                                    loadCashAccounts={loadHqPayFrom}
                                    onChange={onHqPayFromChange}
                                />
                            )}
                            {hqPick?.loading ? <span className="ui-help">{t('payout.loadingRegisters')}</span> : null}
                            {hqPicked ? (
                                <span className={`ui-help${hqShort ? ' ui-help--err' : ''}${hqNegativeHint ? ' ui-help--warn' : ''}`}>
                                    {t('payout.availableLabel', { name: hqPicked.name })}{' '}
                                    {balanceUnknown(hqPicked.availableBalance) ? t('payout.balanceUnknown') : <Money amount={hqPicked.availableBalance} size={12} />}
                                    {' · '}
                                    {t('payout.totalLabel')} <Money amount={dialogTotal} size={12} />
                                    {hqShort ? ` — ${t(peerOff ? 'payout.peerOff' : 'payout.insufficient')}` : ''}
                                    {hqNegativeHint ? (
                                        <>
                                            {' — '}
                                            {t('payout.negativeAllowed')}{' '}
                                            <bdi><Money amount={-shortfall} size={12} /></bdi>
                                        </>
                                    ) : null}
                                </span>
                            ) : null}
                        </div>
                        <label className="ui-field ui-col-6">
                            <span>{t('payout.date')}</span>
                            <input type="date" className="ui-input" value={dialog.date} onChange={(e) => setDialog((d) => ({ ...d, date: e.target.value }))} />
                        </label>
                    </div>
                    {dialog.rows.map((r, i) => (
                        <div className="ui-form-grid" key={r.workshopId}>
                            <label className="ui-field ui-col-4">
                                <span>
                                    {t('payout.amount')} — W{r.workshopId} ({t('payout.payableNow')} <Money amount={r.payableNow} size={12} />)
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="ui-input"
                                    value={r.amount}
                                    onChange={(e) =>
                                        setDialog((d) => ({
                                            ...d,
                                            rows: d.rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                                        }))
                                    }
                                />
                                {!payoutWithinShare(r, r.amount) ? <span className="ui-help ui-help--err">{t('payout.exceeds')}</span> : null}
                            </label>
                            <WorkshopPayFromField
                                row={r}
                                index={i}
                                amount={r.amount}
                                busy={posting}
                                t={t}
                                onPick={onWsPayFromChange}
                            />
                        </div>
                    ))}
                    <div className="ui-row" style={{ gap: 8, marginTop: 8 }}>
                        <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => setDialog(null)} disabled={posting}>
                            {t('payout.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={submit}
                            disabled={confirmBlocked}
                            data-testid="cfx02-confirm"
                        >
                            {posting ? t('payout.posting') : t('payout.confirm')}
                        </button>
                    </div>
                    {confirm.reasonKey ? (
                        <p className={`ui-help${hqShort ? ' ui-help--err' : ''}`} data-testid="cfx02-confirm-reason">
                            {t(confirm.reasonKey)}
                        </p>
                    ) : hqPicked && balanceUnknown(hqPicked.availableBalance) ? (
                        <p className="ui-help">{t('payout.balanceUnknown')}</p>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
