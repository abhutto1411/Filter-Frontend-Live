import { useEffect, useMemo, useState } from 'react';
import { Loader, Search } from 'lucide-react';
import AdminModalAsScreen from './AdminModalAsScreen';
import { listCorporateArCustomers } from '../../services/accountsApi';
import '../../styles/ui.css';

export default function CorporateTransferInvoiceModal({
    open,
    onClose,
    t,
    invoiceNo,
    fromCompanyName,
    fromCorporateAccountId,
    submitting,
    submitError,
    onConfirm,
}) {
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [toCorporateAccountId, setToCorporateAccountId] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        listCorporateArCustomers({ limit: 1000 })
            .then((res) => {
                if (cancelled) return;
                setCustomers(res?.customers ?? []);
            })
            .catch((e) => {
                if (cancelled) return;
                setCustomers([]);
                setLoadError(e?.message || t('err.loadCustomers'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, t]);

    const targets = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (customers || []).filter((c) => {
            if (String(c.corporateAccountId) === String(fromCorporateAccountId)) {
                return false;
            }
            if (!q) return true;
            const hay = [
                c.companyName,
                c.vatNumber,
                c.contactPerson,
                c.mobile,
                c.customerName,
                c.workshopName,
            ]
                .map((v) => String(v || '').toLowerCase())
                .join(' ');
            return hay.includes(q);
        });
    }, [customers, fromCorporateAccountId, search]);

    const selected = targets.find(
        (c) => String(c.corporateAccountId) === String(toCorporateAccountId),
    );

    const submit = () => {
        if (!toCorporateAccountId) {
            setError(t('err.selectTarget'));
            return;
        }
        setError('');
        onConfirm({
            toCorporateAccountId,
            reason: reason.trim() || undefined,
            toCompanyName: selected?.companyName || '',
        });
    };

    if (!open) return null;

    const footer = (
        <div className="ui-panel-end">
            <button
                type="button"
                className="ui-btn ui-btn--default"
                onClick={onClose}
                disabled={submitting}
            >
                {t('btn.cancel')}
            </button>
            <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={submit}
                disabled={submitting || !toCorporateAccountId}
            >
                {submitting ? (
                    <><Loader size={14} className="ui-spin" /> {t('btn.transferring')}</>
                ) : (
                    t('btn.confirmTransfer')
                )}
            </button>
        </div>
    );

    return (
        <AdminModalAsScreen
            title={t('modal.transferTitle')}
            onClose={onClose}
            footer={footer}
            backDisabled={submitting}
        >
            <p className="ui-lead">
                {t('modal.transferInvoice')}: <strong>{invoiceNo || '—'}</strong>
                <br />
                {t('modal.transferHint')}
            </p>

            <div className="ui-stack">
                <div className="ui-field">
                    <label htmlFor="cti-from">{t('modal.transferFrom')}</label>
                    <input
                        id="cti-from"
                        type="text"
                        className="ui-input"
                        value={fromCompanyName || '—'}
                        readOnly
                        disabled
                    />
                </div>

                <div className="ui-field">
                    <label htmlFor="cti-to">{t('modal.transferTo')} *</label>
                    <div className="ui-search" style={{ maxWidth: 'none' }}>
                        <Search size={14} />
                        <input
                            type="search"
                            className="ui-input"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setError('');
                            }}
                            placeholder={t('modal.transferSearch')}
                            disabled={submitting}
                        />
                    </div>
                    {loading ? (
                        <div className="ui-sk ui-sk--input" aria-label={t('loading')} />
                    ) : loadError ? (
                        <p className="ui-help ui-help--err">{loadError}</p>
                    ) : targets.length === 0 ? (
                        <div className="ui-empty">
                            <div className="ui-empty-title">{t('empty.transferTargets')}</div>
                        </div>
                    ) : (
                        <select
                            id="cti-to"
                            className="ui-select"
                            style={{ height: 'auto' }}
                            value={toCorporateAccountId}
                            onChange={(e) => {
                                setToCorporateAccountId(e.target.value);
                                setError('');
                            }}
                            disabled={submitting}
                            size={Math.min(8, Math.max(4, targets.length + 1))}
                        >
                            <option value="">{t('modal.transferTo')}</option>
                            {targets.map((c) => (
                                <option key={c.corporateAccountId} value={c.corporateAccountId}>
                                    {c.companyName || c.customerName || c.corporateAccountId}
                                    {c.vatNumber ? ` · ${c.vatNumber}` : ''}
                                    {c.workshopName ? ` · ${c.workshopName}` : ''}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="ui-field">
                    <label htmlFor="cti-reason">{t('modal.transferReason')}</label>
                    <textarea
                        id="cti-reason"
                        className="ui-textarea"
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('modal.transferReasonPlaceholder')}
                        disabled={submitting}
                    />
                </div>

                {error || submitError ? (
                    <div className="ui-banner ui-banner--dang" role="alert">
                        {error || submitError}
                    </div>
                ) : null}
            </div>
        </AdminModalAsScreen>
    );
}
