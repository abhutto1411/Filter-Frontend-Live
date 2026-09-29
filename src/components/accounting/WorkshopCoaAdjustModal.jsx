import React, { useMemo, useState } from 'react';
import Modal from '../Modal';
import SupplierAccountingCombobox from '../../pages/supplier/accounting/SupplierAccountingCombobox';

const todayIso = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

/**
 * Shared +/− adjust modal: date, signed amount, user-picked contra, reason.
 */
export default function WorkshopCoaAdjustModal({
    title,
    currentBalance = 0,
    accounts = [],
    excludeAccountId = '',
    t,
    onClose,
    onSubmit,
    submitting = false,
    error = '',
}) {
    const [amount, setAmount] = useState('');
    const [entryDate, setEntryDate] = useState(() => todayIso());
    const [contraAccountId, setContraAccountId] = useState('');
    const [reason, setReason] = useState('');

    const contraOptions = useMemo(
        () =>
            (accounts || [])
                .filter((a) => String(a.id) !== String(excludeAccountId))
                .map((a) => ({
                    id: String(a.id),
                    label: a.label || `${a.code || ''} — ${a.name || ''}`.trim(),
                    searchText: `${a.code || ''} ${a.name || ''} ${a.label || ''}`,
                    subtitle: a.type,
                })),
        [accounts, excludeAccountId],
    );

    const preview = useMemo(() => {
        const current = Number(currentBalance ?? 0);
        const delta = Number(amount);
        if (!Number.isFinite(delta) || amount === '' || amount === '-' || amount === '+') {
            return { current, next: current };
        }
        return { current, next: current + delta };
    }, [currentBalance, amount]);

    const handleSubmit = () => {
        onSubmit?.({
            amount,
            entryDate,
            contraAccountId,
            reason,
        });
    };

    return (
        <Modal
            title={title}
            onClose={submitting ? () => {} : onClose}
            width="min(560px, 96vw)"
            footer={
                <div className="ws-aff-modal-footer">
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        {t('coa.adjust.cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? t('coa.adjust.submitting') : t('coa.adjust.submit')}
                    </button>
                </div>
            }
        >
            <p className="form-help-text" style={{ marginBottom: 12 }}>
                {t('coa.adjust.desc')}
            </p>
            {error ? (
                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 10 }} role="alert">
                    {error}
                </p>
            ) : null}
            <div className="modal-form-grid">
                <div className="form-group">
                    <label className="form-label">{t('coa.adjust.current')}</label>
                    <input
                        type="text"
                        className="form-input-field"
                        readOnly
                        value={`SAR ${fmtMoney(preview.current)}`}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('coa.adjust.preview')}</label>
                    <input
                        type="text"
                        className="form-input-field"
                        readOnly
                        value={`SAR ${fmtMoney(preview.next)}`}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('coa.adjust.amount')}</label>
                    <input
                        type="number"
                        step="0.01"
                        className="form-input-field"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={t('coa.adjust.amountPh')}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('coa.adjust.date')}</label>
                    <input
                        type="date"
                        className="form-input-field"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                    />
                </div>
                <div className="form-group form-group-full">
                    <label className="form-label">{t('coa.adjust.contra')}</label>
                    <SupplierAccountingCombobox
                        className="acct-table-combobox acct-filter-combobox"
                        value={contraAccountId}
                        onChange={(v) => setContraAccountId(String(v || ''))}
                        placeholder={t('coa.adjust.contraPh')}
                        entityLabel="account"
                        emptyHint={t('coa.adjust.contraEmpty')}
                        options={contraOptions}
                    />
                </div>
                <div className="form-group form-group-full">
                    <label className="form-label">{t('coa.adjust.reason')}</label>
                    <textarea
                        className="form-input-field"
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('coa.adjust.reasonPh')}
                    />
                </div>
            </div>
        </Modal>
    );
}
