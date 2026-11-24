import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../Modal';
import SupplierAccountingCombobox from '../../pages/supplier/accounting/SupplierAccountingCombobox';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';

function newClientRequestId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `hr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function mapReclassError(err, t) {
    const code = String(err?.code || '').trim();
    const key = `err.${code}`;
    const mapped = t(key);
    if (mapped && mapped !== key) return mapped;
    return err?.message || t('coa.reclass.err.failed');
}

/**
 * Super Admin: move a heading's direct posted balance onto a leaf descendant.
 */
export default function WorkshopCoaHeadingReclassModal({
    heading,
    buckets = [],
    defaultEntryDate,
    t,
    onClose,
    onSubmit,
    submitting = false,
    error = '',
    success = null,
}) {
    const clientRequestIdRef = useRef(newClientRequestId());
    const branchBuckets = useMemo(
        () =>
            (buckets || []).filter(
                (b) => String(b.headingId) === String(heading?.id || ''),
            ),
        [buckets, heading?.id],
    );
    const [branchId, setBranchId] = useState(() =>
        branchBuckets[0]?.branchId != null ? String(branchBuckets[0].branchId) : '',
    );
    const selectedBucket = useMemo(() => {
        const want = branchId === '' ? null : branchId;
        return (
            branchBuckets.find((b) =>
                want == null
                    ? b.branchId == null || b.branchId === ''
                    : String(b.branchId) === String(want),
            ) || branchBuckets[0] || null
        );
    }, [branchBuckets, branchId]);

    const leafOptions = useMemo(
        () =>
            (selectedBucket?.leaves || [])
                .filter((l) => !l.isApSupplierChild)
                .map((l) => ({
                    id: String(l.id),
                    label: `${l.code || ''} — ${l.name || ''}`.trim(),
                    searchText: `${l.code || ''} ${l.name || ''}`,
                    subtitle: l.branchId ? `Branch ${l.branchId}` : undefined,
                })),
        [selectedBucket],
    );

    const [targetLeafId, setTargetLeafId] = useState('');
    const [amount, setAmount] = useState('');
    const [entryDate, setEntryDate] = useState(
        () => defaultEntryDate || toRiyadhDateISO(),
    );
    const [reason, setReason] = useState('');

    const remaining = Number(selectedBucket?.net ?? 0);

    const handleSubmit = () => {
        onSubmit?.({
            targetLeafId,
            amount,
            branchId: selectedBucket?.branchId ?? null,
            entryDate,
            reason,
            clientRequestId: clientRequestIdRef.current,
        });
    };

    return (
        <Modal
            title={`${t('coa.reclass.title')} — ${heading?.code || ''} ${heading?.name || ''}`}
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
                        className="btn-submit btn-dark"
                        onClick={handleSubmit}
                        disabled={submitting || Boolean(success)}
                    >
                        {submitting ? t('coa.adjust.submitting') : t('coa.reclass.submit')}
                    </button>
                </div>
            }
        >
            {error ? (
                <p role="alert" style={{ color: '#B45309', marginBottom: 10 }}>
                    {typeof error === 'string' ? error : mapReclassError(error, t)}
                </p>
            ) : null}
            {success ? (
                <p role="status" style={{ color: '#0E7C66', marginBottom: 10 }}>
                    {t('coa.reclass.done', { no: success.entryNumber || success.journalId })}
                    {success.journalId ? (
                        <>
                            {' '}
                            <Link
                                to={`../journal-entries?journal=${encodeURIComponent(success.journalId)}`}
                            >
                                {success.entryNumber || success.journalId}
                            </Link>
                        </>
                    ) : null}
                </p>
            ) : null}

            <p className="form-help-text" style={{ marginTop: 0 }}>
                {t('coa.reclass.direct')}
                {selectedBucket
                    ? `: SAR ${fmtMoney(selectedBucket.net)} (${selectedBucket.lineCount} lines)`
                    : ''}
            </p>

            {branchBuckets.length > 1 ? (
                <div className="form-group">
                    <label className="form-label">{t('coa.reclass.branch') || 'Branch'}</label>
                    <select
                        className="form-input-field"
                        value={branchId}
                        onChange={(e) => {
                            setBranchId(e.target.value);
                            setTargetLeafId('');
                        }}
                        disabled={submitting}
                    >
                        {branchBuckets.map((b) => (
                            <option
                                key={String(b.branchId ?? 'null')}
                                value={b.branchId == null ? '' : String(b.branchId)}
                            >
                                {b.branchId == null
                                    ? 'All / unassigned'
                                    : `Branch ${b.branchId}`}{' '}
                                — {fmtMoney(b.net)}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}

            <div className="form-group">
                <label className="form-label" htmlFor="hr-target">
                    {t('coa.reclass.target')}
                </label>
                <SupplierAccountingCombobox
                    options={leafOptions}
                    value={targetLeafId}
                    onChange={setTargetLeafId}
                    placeholder={t('coa.reclass.target')}
                    disabled={submitting}
                />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="hr-amount">
                    {t('coa.reclass.amount')}
                </label>
                <input
                    id="hr-amount"
                    type="number"
                    className="form-input-field"
                    min="0.01"
                    step="0.01"
                    max={Math.abs(remaining) || undefined}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={submitting}
                    aria-label={t('coa.reclass.amount')}
                />
                <p className="form-help-text" style={{ margin: '4px 0 0' }}>
                    Max {fmtMoney(Math.abs(remaining))}
                </p>
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="hr-date">
                    {t('coa.reclass.date')}
                </label>
                <input
                    id="hr-date"
                    type="date"
                    className="form-input-field"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    disabled={submitting}
                    aria-label={t('coa.reclass.date')}
                />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="hr-reason">
                    {t('coa.reclass.reason')}
                </label>
                <input
                    id="hr-reason"
                    type="text"
                    className="form-input-field"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={submitting}
                    minLength={5}
                    aria-label={t('coa.reclass.reason')}
                />
            </div>
        </Modal>
    );
}

export { mapReclassError, newClientRequestId };
