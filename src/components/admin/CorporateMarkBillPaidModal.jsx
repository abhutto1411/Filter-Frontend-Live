import { useEffect, useMemo, useState } from 'react';
import { Loader } from 'lucide-react';
import AdminModalAsScreen from './AdminModalAsScreen';
import { listGeneratedBillCashAccounts, markGeneratedBillPaid } from '../../services/superAdminApi';
import { todayISO } from '../../pages/admin/saAccountingDateRange';
import {
    classifyCorporateBillPayment,
    parseCorporateReceivedAmount,
    remainingAfterCorporateReceipt,
    CORPORATE_BILL_PAY_EPS,
} from '../../utils/corporateBillPayment';
import '../../styles/ui.css';

function fmt(n) {
    return Number(n ?? 0).toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

const ALLOWED_PROOF_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
]);

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Corporate Billing: submit mark-as-paid with proof for Super Admin approval.
 */
export default function CorporateMarkBillPaidModal({
    open,
    onClose,
    t,
    billId,
    billNo,
    balanceDue,
    onPaid,
}) {
    const [accounts, setAccounts] = useState([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [cashBankAccountId, setCashBankAccountId] = useState('');
    const [receivedDate, setReceivedDate] = useState(() => todayISO());
    const [receivedAmount, setReceivedAmount] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const due = Number(balanceDue) || 0;
    const parsedReceived = parseCorporateReceivedAmount(receivedAmount);
    const receiptStatus = Number.isFinite(parsedReceived)
        ? classifyCorporateBillPayment(due, parsedReceived)
        : null;
    const remainingHint = Number.isFinite(parsedReceived)
        ? remainingAfterCorporateReceipt(due, parsedReceived)
        : 0;
    const excessHint =
        Number.isFinite(parsedReceived) && parsedReceived > due + CORPORATE_BILL_PAY_EPS
            ? Math.round((parsedReceived - due) * 100) / 100
            : 0;

    useEffect(() => {
        if (!open || !billId) {
            setAccounts([]);
            setCashBankAccountId('');
            setReceivedDate(todayISO());
            setReceivedAmount('');
            setProofFile(null);
            setError('');
            setSubmitting(false);
            return;
        }
        let cancelled = false;
        setLoadingAccounts(true);
        setError('');
        setCashBankAccountId('');
        setReceivedDate(todayISO());
        setReceivedAmount(Number(balanceDue || 0).toFixed(2));
        setProofFile(null);
        listGeneratedBillCashAccounts(billId)
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.accounts) ? res.accounts : [];
                setAccounts(list);
                if (list.length === 1) setCashBankAccountId(list[0].id);
            })
            .catch((e) => {
                if (!cancelled) {
                    setAccounts([]);
                    setError(e?.message || t('err.loadCashAccounts'));
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingAccounts(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, billId, balanceDue, t]);

    const grouped = useMemo(() => {
        const hq = accounts.filter((a) => a.scope === 'hq');
        const workshop = accounts.filter((a) => a.scope !== 'hq');
        return { hq, workshop };
    }, [accounts]);

    if (!open) return null;

    const onProofChange = (e) => {
        setError('');
        const file = e.target.files?.[0] || null;
        if (!file) {
            setProofFile(null);
            return;
        }
        if (!ALLOWED_PROOF_TYPES.has(String(file.type || '').toLowerCase())) {
            setProofFile(null);
            setError(t('err.proofType'));
            e.target.value = '';
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            setProofFile(null);
            setError(t('err.proofSize'));
            e.target.value = '';
            return;
        }
        setProofFile(file);
    };

    const submit = async () => {
        setError('');
        if (!cashBankAccountId) {
            setError(t('err.selectCashAccount'));
            return;
        }
        if (!receivedDate) {
            setError(t('err.selectReceivedDate'));
            return;
        }
        const received = parseCorporateReceivedAmount(receivedAmount);
        if (!Number.isFinite(received) || received <= CORPORATE_BILL_PAY_EPS) {
            setError(t('err.receivedAmount'));
            return;
        }
        if (!proofFile) {
            setError(t('err.proofRequired'));
            return;
        }
        setSubmitting(true);
        try {
            const proofImage = await readFileAsDataUrl(proofFile);
            const res = await markGeneratedBillPaid({
                id: billId,
                cashBankAccountId,
                receivedDate,
                receivedAmount: received,
                proofImage,
                proofMimeType: proofFile.type || undefined,
                proofFileName: proofFile.name || undefined,
            });
            onPaid?.(res);
            onClose?.();
        } catch (e) {
            setError(e?.message || t('err.markPaid'));
        } finally {
            setSubmitting(false);
        }
    };

    const footer = (
        <div className="ui-panel-end">
            <button type="button" className="ui-btn ui-btn--default" onClick={onClose} disabled={submitting}>
                {t('btn.cancel')}
            </button>
            <button
                type="button"
                className="ui-btn ui-btn--primary"
                disabled={submitting || loadingAccounts || !cashBankAccountId || !proofFile}
                onClick={submit}
            >
                {submitting ? (
                    <><Loader size={14} className="ui-spin" /> {t('btn.submittingApproval')}</>
                ) : (
                    t('btn.submitForApproval')
                )}
            </button>
        </div>
    );

    return (
        <AdminModalAsScreen
            title={t('modal.markPaidTitle')}
            onClose={onClose}
            footer={footer}
            backDisabled={submitting}
        >
            <p className="ui-lead">
                {t('modal.billNo')} <strong>{billNo}</strong>
                <br />
                {t('modal.markPaidHint')}
            </p>

            <div className="ui-form-grid">
                <div className="ui-field ui-col-6">
                    <label htmlFor="cmp-due">{t('modal.amountDue')}</label>
                    <input
                        id="cmp-due"
                        type="text"
                        className="ui-input"
                        value={t('money.sar', { amount: fmt(balanceDue) })}
                        readOnly
                        disabled
                    />
                </div>

                <div className="ui-field ui-col-6">
                    <label htmlFor="cmp-received">{t('modal.receivedAmount')} *</label>
                    <input
                        id="cmp-received"
                        type="number"
                        className="ui-input"
                        min="0.01"
                        step="0.01"
                        value={receivedAmount}
                        onChange={(e) => {
                            setError('');
                            setReceivedAmount(e.target.value);
                        }}
                        disabled={submitting}
                        required
                    />
                    {receiptStatus === 'partially_paid' ? (
                        <p className="ui-help ui-help--err">
                            {t('modal.receivedHintPartial', { amount: fmt(remainingHint) })}
                        </p>
                    ) : null}
                    {receiptStatus === 'overpaid' ? (
                        <p className="ui-help">
                            {t('modal.receivedHintOver', { amount: fmt(excessHint) })}
                        </p>
                    ) : null}
                    {receiptStatus === 'paid' ? (
                        <p className="ui-help">{t('modal.receivedHintPaid')}</p>
                    ) : null}
                </div>

                <div className="ui-field ui-col-6">
                    <label htmlFor="cmp-account">{t('modal.cashBankAccount')} *</label>
                    {loadingAccounts ? (
                        <div className="ui-sk ui-sk--input" aria-label={t('loading.cashAccounts')} />
                    ) : accounts.length === 0 ? (
                        <p className="ui-help ui-help--err">{t('err.noCashAccounts')}</p>
                    ) : (
                        <select
                            id="cmp-account"
                            className="ui-select"
                            value={cashBankAccountId}
                            onChange={(e) => {
                                setError('');
                                setCashBankAccountId(e.target.value);
                            }}
                            disabled={submitting}
                        >
                            <option value="">{t('modal.selectCashAccount')}</option>
                            {grouped.hq.length > 0 ? (
                                <optgroup label={t('modal.hqAccounts')}>
                                    {grouped.hq.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} ({a.type})
                                        </option>
                                    ))}
                                </optgroup>
                            ) : null}
                        </select>
                    )}
                </div>

                <div className="ui-field ui-col-6">
                    <label htmlFor="cmp-date">{t('modal.receivedDate')} *</label>
                    <input
                        id="cmp-date"
                        type="date"
                        className="ui-input"
                        value={receivedDate || ''}
                        onChange={(e) => {
                            setError('');
                            setReceivedDate(e.target.value);
                        }}
                        disabled={submitting}
                        required
                    />
                </div>

                <div className="ui-field ui-col-12">
                    <label htmlFor="cmp-proof">{t('modal.paymentProof')} *</label>
                    <input
                        id="cmp-proof"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        onChange={onProofChange}
                        disabled={submitting}
                    />
                    <p className="ui-help">
                        {proofFile
                            ? `${proofFile.name} (${Math.round(proofFile.size / 1024)} KB)`
                            : t('modal.paymentProofHint')}
                    </p>
                </div>

                {error ? (
                    <div className="ui-banner ui-banner--dang ui-col-12" role="alert">{error}</div>
                ) : null}
            </div>
        </AdminModalAsScreen>
    );
}
