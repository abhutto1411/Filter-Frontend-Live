import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { internalTransferWorkshopCashBank } from '../../../services/workshopStaffApi';
import {
    cashBankRegisterClass,
    cashBankRegisterClassLabelKey,
    displayCashBankBalance,
    isCitOfficerRegister,
    mapCashBankTransferError,
} from '../../../utils/cashBankScreen';
import { todayIsoDate } from './workshopAccountingShared';

function formatSar2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function newClientRequestId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `xfer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapXferError(err, t) {
    return mapCashBankTransferError(err, t);
}

/**
 * Cash & Bank internal transfer tab (restored + hardened with clientRequestId).
 */
export default function WorkshopCashBankTransferPanel({
    accounts = [],
    accountsLoading = false,
    t,
    onTransferred,
}) {
    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [fromDisplay, setFromDisplay] = useState('');
    const [toDisplay, setToDisplay] = useState('');
    const [amount, setAmount] = useState('');
    const [entryDate, setEntryDate] = useState(() => todayIsoDate());
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const clientRequestIdRef = useRef(newClientRequestId());

    const options = useMemo(
        () =>
            (accounts || []).map((acc) => {
                const cls = cashBankRegisterClass(acc);
                const kindLabel = t(cashBankRegisterClassLabelKey(cls));
                const bal = displayCashBankBalance(acc);
                const citOfficer = isCitOfficerRegister(acc);
                const citReason = citOfficer ? t('cb.xfer.citOfficerDisabled') : '';
                return {
                    id: String(acc.id),
                    label: acc.name || '—',
                    subtitle: citOfficer
                        ? `${acc.branch || '—'} · ${kindLabel} · ${citReason}`
                        : `${acc.branch || '—'} · ${kindLabel}`,
                    trailing: `SAR ${formatSar2(bal)}`,
                    searchText: `${acc.name} ${acc.branch} ${acc.coaLink || ''} ${kindLabel}`,
                    balance: bal,
                    disabled: citOfficer,
                    disabledReason: citReason || undefined,
                };
            }),
        [accounts, t],
    );

    const fromAcc = useMemo(
        () => accounts.find((a) => String(a.id) === String(fromId)),
        [accounts, fromId],
    );
    const fromBal = fromAcc ? displayCashBankBalance(fromAcc) : null;
    const amtNum = Number(amount);
    const afterBal =
        fromBal != null && Number.isFinite(amtNum) && amount !== ''
            ? fromBal - amtNum
            : null;

    const resetForm = useCallback(() => {
        setFromId('');
        setToId('');
        setFromDisplay('');
        setToDisplay('');
        setAmount('');
        setNote('');
        setEntryDate(todayIsoDate());
        clientRequestIdRef.current = newClientRequestId();
    }, []);

    const handleSubmit = async () => {
        setError('');
        setSuccess(null);
        if (!fromId || !toId) {
            setError(t('cb.xfer.err.both'));
            return;
        }
        if (fromId === toId) {
            setError(t('cb.xfer.err.diff'));
            return;
        }
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setError(t('cb.xfer.err.amount'));
            return;
        }
        if (!/^\d+(\.\d{1,2})?$/.test(String(amount).trim())) {
            setError(t('cb.xfer.err.amount2dp'));
            return;
        }
        setSubmitting(true);
        try {
            const res = await internalTransferWorkshopCashBank({
                fromAccountId: fromId,
                toAccountId: toId,
                amount: amt,
                entryDate,
                description: note.trim() || undefined,
                clientRequestId: clientRequestIdRef.current,
            });
            const ref = res?.reference || res?.entryNumber || '';
            const journalId = res?.journalId ? String(res.journalId) : '';
            setSuccess({
                ref,
                journalId,
                entryNumber: res?.entryNumber || '',
            });
            resetForm();
            onTransferred?.(res);
        } catch (e) {
            setError(mapXferError(e, t));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section
            className="cash-bank-internal-xfer"
            data-testid="cb-transfer-tab"
            style={{
                marginBottom: 20,
                padding: '16px 18px',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'var(--accounting-card-bg, #fafafa)',
            }}
        >
            <h3
                className="cash-bank-title"
                style={{
                    fontSize: '1.05rem',
                    margin: '0 0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}
            >
                <ArrowLeftRight size={20} aria-hidden />
                {t('cb.xfer.title')}
            </h3>
            <p className="form-help-text" style={{ marginBottom: 12 }}>
                {t('cb.xfer.desc')}
            </p>
            {error ? (
                <p
                    className="form-help-text"
                    style={{ color: '#B45309', marginBottom: 10 }}
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
            {success ? (
                <p
                    className="form-help-text"
                    style={{ color: '#0E7C66', marginBottom: 10 }}
                    role="status"
                >
                    {t('cb.xfer.done', { ref: success.ref || success.entryNumber || '—' })}
                    {success.journalId ? (
                        <>
                            {' '}
                            <Link to={`../journal-entries?journal=${encodeURIComponent(success.journalId)}`}>
                                {success.entryNumber || success.journalId}
                            </Link>
                        </>
                    ) : null}
                </p>
            ) : null}
            <div className="modal-form-grid" style={{ alignItems: 'end' }}>
                <div className="form-group">
                    <label className="form-label">{t('cb.xfer.from')}</label>
                    <SearchableEntityCombobox
                        options={options}
                        value={fromId}
                        displayText={fromDisplay}
                        onDisplayTextChange={(text) => {
                            setFromDisplay(text);
                            if (!text.trim()) setFromId('');
                        }}
                        onSelect={(opt) => {
                            setFromId(String(opt?.id || ''));
                            setFromDisplay('');
                        }}
                        placeholder={t('cb.xfer.searchPh')}
                        entityLabel="account"
                        emptyHint={t('cb.xfer.noMatch')}
                        loading={accountsLoading}
                        maxInitial={80}
                        maxFiltered={150}
                        menuMinWidth={320}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('cb.xfer.to')}</label>
                    <SearchableEntityCombobox
                        options={options}
                        value={toId}
                        displayText={toDisplay}
                        onDisplayTextChange={(text) => {
                            setToDisplay(text);
                            if (!text.trim()) setToId('');
                        }}
                        onSelect={(opt) => {
                            setToId(String(opt?.id || ''));
                            setToDisplay('');
                        }}
                        placeholder={t('cb.xfer.searchPh')}
                        entityLabel="account"
                        emptyHint={t('cb.xfer.noMatch')}
                        loading={accountsLoading}
                        maxInitial={80}
                        maxFiltered={150}
                        menuMinWidth={320}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('cb.xfer.amount')}</label>
                    <input
                        type="number"
                        className="form-input-field"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('cb.xfer.date')}</label>
                    <input
                        type="date"
                        className="form-input-field"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                    />
                </div>
                <div className="form-group form-group-full">
                    <label className="form-label">{t('cb.xfer.note')}</label>
                    <input
                        type="text"
                        className="form-input-field"
                        placeholder={t('cb.xfer.notePh')}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>
                {afterBal != null ? (
                    <div className="form-group form-group-full">
                        <p className="form-help-text" style={{ margin: 0 }}>
                            {t('cb.xfer.balanceAfter')}:{' '}
                            <strong style={{ color: afterBal < 0 ? '#B45309' : undefined }}>
                                SAR {formatSar2(afterBal)}
                            </strong>
                        </p>
                    </div>
                ) : null}
                <div className="form-group form-group-full" style={{ marginTop: 4 }}>
                    <button
                        type="button"
                        className="btn-submit btn-dark"
                        disabled={submitting || accounts.length < 2}
                        onClick={handleSubmit}
                    >
                        {submitting ? t('cb.xfer.submitting') : t('cb.xfer.submit')}
                    </button>
                </div>
            </div>
        </section>
    );
}
