import { useEffect, useMemo, useState } from 'react';
import { Loader, Search } from 'lucide-react';
import AdminModalAsScreen from './AdminModalAsScreen';
import { listCorporateArCustomers } from '../../services/accountsApi';

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
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [toCorporateAccountId, setToCorporateAccountId] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) {
            setSearch('');
            setCustomers([]);
            setToCorporateAccountId('');
            setReason('');
            setError('');
            setLoadError('');
            return;
        }
        let cancelled = false;
        setLoading(true);
        setLoadError('');
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
        <>
            <button
                type="button"
                className="btn-portal-outline"
                onClick={onClose}
                disabled={submitting}
            >
                {t('btn.cancel')}
            </button>
            <button
                type="button"
                className="btn-portal"
                onClick={submit}
                disabled={submitting || !toCorporateAccountId}
            >
                {submitting ? (
                    <>
                        <Loader size={14} className="spin" /> {t('btn.transferring')}
                    </>
                ) : (
                    t('btn.confirmTransfer')
                )}
            </button>
        </>
    );

    return (
        <AdminModalAsScreen
            title={t('modal.transferTitle')}
            onClose={onClose}
            footer={footer}
            backDisabled={submitting}
        >
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                {t('modal.transferInvoice')}: <strong>{invoiceNo || '—'}</strong>
            </p>
            <p className="form-help-text" style={{ marginTop: 0 }}>
                {t('modal.transferHint')}
            </p>

            <div className="form-group">
                <label className="form-label">{t('modal.transferFrom')}</label>
                <input
                    type="text"
                    className="form-input-field"
                    value={fromCompanyName || '—'}
                    readOnly
                    disabled
                />
            </div>

            <div className="form-group">
                <label className="form-label">{t('modal.transferTo')} *</label>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search
                        size={14}
                        style={{
                            position: 'absolute',
                            left: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#64748b',
                        }}
                    />
                    <input
                        type="search"
                        className="form-input-field"
                        style={{ paddingLeft: 30 }}
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
                    <p className="form-help-text">
                        <Loader size={14} className="spin" /> {t('loading')}
                    </p>
                ) : loadError ? (
                    <p className="form-help-text" style={{ color: '#dc2626' }}>
                        {loadError}
                    </p>
                ) : (
                    <select
                        className="form-input-field"
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
                {!loading && !loadError && targets.length === 0 ? (
                    <p className="form-help-text">{t('empty.transferTargets')}</p>
                ) : null}
            </div>

            <div className="form-group">
                <label className="form-label">{t('modal.transferReason')}</label>
                <textarea
                    className="form-input-field"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('modal.transferReasonPlaceholder')}
                    disabled={submitting}
                />
            </div>

            {error || submitError ? (
                <p className="form-help-text" style={{ color: '#dc2626' }}>
                    {error || submitError}
                </p>
            ) : null}
        </AdminModalAsScreen>
    );
}
