import { useEffect, useMemo, useState } from 'react';
import { Loader } from 'lucide-react';
import AdminModalAsScreen from './AdminModalAsScreen';
import { listGeneratedBillCashAccounts, markGeneratedBillPaid } from '../../services/superAdminApi';
import { todayISO } from '../../pages/admin/saAccountingDateRange';

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
    const [proofFile, setProofFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open || !billId) {
            setAccounts([]);
            setCashBankAccountId('');
            setReceivedDate(todayISO());
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
    }, [open, billId, t]);

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
        <>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                {t('btn.cancel')}
            </button>
            <button
                type="button"
                className="btn-submit"
                disabled={submitting || loadingAccounts || !cashBankAccountId || !proofFile}
                onClick={submit}
            >
                {submitting ? (
                    <>
                        <Loader size={14} className="spin" /> {t('btn.submittingApproval')}
                    </>
                ) : (
                    t('btn.submitForApproval')
                )}
            </button>
        </>
    );

    return (
        <AdminModalAsScreen
            title={t('modal.markPaidTitle')}
            onClose={onClose}
            footer={footer}
            backDisabled={submitting}
        >
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                {t('modal.billNo')} <strong>{billNo}</strong>
            </p>

            <div className="form-group">
                <label className="form-label">{t('modal.amountDue')}</label>
                <input
                    type="text"
                    className="form-input-field"
                    value={t('money.sar', { amount: fmt(balanceDue) })}
                    readOnly
                    disabled
                />
            </div>

            <div className="form-group">
                <label className="form-label">{t('modal.cashBankAccount')} *</label>
                {loadingAccounts ? (
                    <p className="form-help-text">
                        <Loader size={14} className="spin" /> {t('loading.cashAccounts')}
                    </p>
                ) : (
                    <select
                        className="form-input-field"
                        value={cashBankAccountId}
                        onChange={(e) => {
                            setError('');
                            setCashBankAccountId(e.target.value);
                        }}
                        disabled={submitting || accounts.length === 0}
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
                        {grouped.workshop.length > 0 ? (
                            <optgroup
                                label={
                                    grouped.workshop[0]?.workshopName
                                        ? t('modal.workshopAccounts', {
                                              name: grouped.workshop[0].workshopName,
                                          })
                                        : t('modal.workshopAccountsGeneric')
                                }
                            >
                                {grouped.workshop.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                        {a.branchName ? ` · ${a.branchName}` : ''} ({a.type})
                                    </option>
                                ))}
                            </optgroup>
                        ) : null}
                    </select>
                )}
                {!loadingAccounts && accounts.length === 0 ? (
                    <p className="form-help-text" style={{ color: '#b45309' }}>
                        {t('err.noCashAccounts')}
                    </p>
                ) : null}
            </div>

            <div className="form-group">
                <label className="form-label">{t('modal.receivedDate')} *</label>
                <input
                    type="date"
                    className="form-input-field"
                    value={receivedDate || ''}
                    onChange={(e) => {
                        setError('');
                        setReceivedDate(e.target.value);
                    }}
                    disabled={submitting}
                    required
                />
            </div>

            <div className="form-group">
                <label className="form-label">{t('modal.paymentProof')} *</label>
                <input
                    type="file"
                    className="form-input-field"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    onChange={onProofChange}
                    disabled={submitting}
                />
                {proofFile ? (
                    <p className="form-help-text" style={{ marginTop: 6 }}>
                        {proofFile.name} ({Math.round(proofFile.size / 1024)} KB)
                    </p>
                ) : (
                    <p className="form-help-text">{t('modal.paymentProofHint')}</p>
                )}
            </div>

            {error ? (
                <p
                    style={{
                        margin: '0 0 8px',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: '#fef2f2',
                        color: '#b91c1c',
                        fontSize: '0.85rem',
                    }}
                >
                    {error}
                </p>
            ) : null}

            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 0 }}>
                {t('modal.markPaidHint')}
            </p>
        </AdminModalAsScreen>
    );
}
