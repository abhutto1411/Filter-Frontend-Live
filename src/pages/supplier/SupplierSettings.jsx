import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import {
    getSupplierProfile,
    updateSupplierProfile,
} from '../../services/supplierApi';
import { ssT } from '../../utils/supplierSettingsI18n';
import '../../styles/admin/AccountingPage.css';

const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const COUNTRY_OPTIONS = [
    { value: 'Kingdom of Saudi Arabia', labelEn: 'Kingdom of Saudi Arabia', labelAr: 'المملكة العربية السعودية' },
    { value: 'United Arab Emirates', labelEn: 'United Arab Emirates', labelAr: 'الإمارات العربية المتحدة' },
    { value: 'Bahrain', labelEn: 'Bahrain', labelAr: 'البحرين' },
    { value: 'Kuwait', labelEn: 'Kuwait', labelAr: 'الكويت' },
    { value: 'Oman', labelEn: 'Oman', labelAr: 'عُمان' },
    { value: 'Qatar', labelEn: 'Qatar', labelAr: 'قطر' },
    { value: 'Egypt', labelEn: 'Egypt', labelAr: 'مصر' },
    { value: 'Jordan', labelEn: 'Jordan', labelAr: 'الأردن' },
    { value: 'Other', labelEn: 'Other', labelAr: 'أخرى' },
];

function emptyForm() {
    return {
        companyName: '',
        address: '',
        country: 'Kingdom of Saudi Arabia',
        vatId: '',
        logoUrl: '',
    };
}

function profileToForm(res) {
    if (!res || typeof res !== 'object') return emptyForm();
    const s = res.supplier && typeof res.supplier === 'object' ? res.supplier : res;
    return {
        companyName: String(s.companyName || s.name || ''),
        address: String(s.address || [s.street, s.cityDistrict].filter(Boolean).join('\n') || ''),
        country: String(s.country || 'Kingdom of Saudi Arabia'),
        vatId: String(s.vatId || ''),
        logoUrl: String(s.logoUrl || ''),
    };
}

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: '0.9375rem',
    background: '#fff',
    boxSizing: 'border-box',
};

export default function SupplierSettings({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => ssT(locale, key, vars), [locale]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState(emptyForm);
    const [baseline, setBaseline] = useState(emptyForm);
    const fileRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getSupplierProfile();
            const next = profileToForm(res);
            setForm(next);
            setBaseline(next);
        } catch (err) {
            setError(err?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const dirty = useMemo(
        () => JSON.stringify(form) !== JSON.stringify(baseline),
        [form, baseline],
    );

    const onPickLogo = (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!LOGO_TYPES.has(String(file.type || '').toLowerCase())) {
            setError(t('err.imageType'));
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            setError(t('err.imageSize'));
            return;
        }
        setError('');
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (dataUrl) setForm((f) => ({ ...f, logoUrl: dataUrl }));
        };
        reader.readAsDataURL(file);
    };

    const onReset = () => {
        setForm(baseline);
        setError('');
        setSuccess('');
    };

    const onSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await updateSupplierProfile({
                companyName: form.companyName.trim(),
                address: form.address.trim() || null,
                country: form.country.trim() || null,
                vatId: form.vatId.trim() || null,
                logoUrl: form.logoUrl || null,
            });
            const next = profileToForm(res);
            setForm(next);
            setBaseline(next);
            setSuccess(t('success.saved'));
        } catch (err) {
            setError(err?.message || t('err.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mgr-si-page" style={{ maxWidth: 720 }}>
            <header className="mgr-si-header" style={{ marginBottom: 20 }}>
                <div className="mgr-si-breadcrumb">{t('page.breadcrumb')}</div>
                <h1 className="mgr-si-title" style={{ margin: '8px 0 4px' }}>
                    {t('page.title')}
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', lineHeight: 1.45 }}>
                    {t('page.subtitle')}
                </p>
            </header>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    <Loader2 size={22} className="supplier-sales-last-sale-spinner" />
                </div>
            ) : (
                <form
                    onSubmit={onSubmit}
                    style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 18,
                    }}
                >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t('field.name')}</span>
                        <input
                            style={inputStyle}
                            value={form.companyName}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, companyName: e.target.value }))
                            }
                            placeholder={t('ph.name')}
                            required
                            disabled={saving}
                        />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {t('field.address')}
                        </span>
                        <textarea
                            style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
                            value={form.address}
                            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                            placeholder={t('ph.address')}
                            disabled={saving}
                        />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {t('field.country')}
                        </span>
                        <select
                            style={inputStyle}
                            value={
                                COUNTRY_OPTIONS.some((c) => c.value === form.country)
                                    ? form.country
                                    : form.country
                                      ? 'Other'
                                      : 'Kingdom of Saudi Arabia'
                            }
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v === 'Other') {
                                    setForm((f) => ({
                                        ...f,
                                        country: f.country === 'Other' ? '' : f.country || '',
                                    }));
                                    return;
                                }
                                setForm((f) => ({ ...f, country: v }));
                            }}
                            disabled={saving}
                        >
                            {COUNTRY_OPTIONS.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {locale === 'ar' ? c.labelAr : c.labelEn}
                                </option>
                            ))}
                        </select>
                        {!COUNTRY_OPTIONS.some((c) => c.value === form.country) ||
                        form.country === 'Other' ||
                        (form.country &&
                            !COUNTRY_OPTIONS.some(
                                (c) => c.value === form.country && c.value !== 'Other',
                            )) ? (
                            <input
                                style={{ ...inputStyle, marginTop: 8 }}
                                value={form.country === 'Other' ? '' : form.country}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, country: e.target.value }))
                                }
                                placeholder={t('ph.country')}
                                disabled={saving}
                            />
                        ) : null}
                    </label>

                    <div
                        style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: 14,
                            background: '#f8fafc',
                        }}
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 10 }}>
                            {t('field.tax')}
                        </div>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: '0.8125rem', color: '#475569' }}>
                                {t('field.vatLabel')}
                            </span>
                            <input
                                style={inputStyle}
                                value={form.vatId}
                                onChange={(e) => setForm((f) => ({ ...f, vatId: e.target.value }))}
                                placeholder={t('ph.vat')}
                                disabled={saving}
                                dir="ltr"
                            />
                        </label>
                    </div>

                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 6 }}>
                            {t('field.image')}
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#64748b' }}>
                            {t('field.imageHint')}
                        </p>
                        <div
                            style={{
                                position: 'relative',
                                width: 160,
                                height: 160,
                                borderRadius: 12,
                                border: '1px dashed #cbd5e1',
                                background: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                            }}
                        >
                            {form.logoUrl ? (
                                <>
                                    <img
                                        src={form.logoUrl}
                                        alt=""
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            objectFit: 'contain',
                                        }}
                                    />
                                    <button
                                        type="button"
                                        title={t('field.imageRemove')}
                                        onClick={() => setForm((f) => ({ ...f, logoUrl: '' }))}
                                        disabled={saving}
                                        style={{
                                            position: 'absolute',
                                            top: 6,
                                            right: 6,
                                            border: 'none',
                                            background: '#fee2e2',
                                            color: '#b91c1c',
                                            borderRadius: 8,
                                            padding: 6,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={saving}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 8,
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        fontSize: '0.8125rem',
                                    }}
                                >
                                    <ImagePlus size={28} />
                                    {t('field.imageChoose')}
                                </button>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            style={{ display: 'none' }}
                            onChange={onPickLogo}
                        />
                        {form.logoUrl ? (
                            <button
                                type="button"
                                className="btn-portal-outline"
                                style={{ marginTop: 10, padding: '6px 12px' }}
                                onClick={() => fileRef.current?.click()}
                                disabled={saving}
                            >
                                {t('field.imageChoose')}
                            </button>
                        ) : null}
                    </div>

                    {error ? (
                        <div
                            style={{
                                padding: '10px 12px',
                                borderRadius: 8,
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                color: '#B91C1C',
                                fontSize: '0.875rem',
                            }}
                        >
                            {error}
                        </div>
                    ) : null}
                    {success ? (
                        <div
                            style={{
                                padding: '10px 12px',
                                borderRadius: 8,
                                background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                color: '#047857',
                                fontSize: '0.875rem',
                            }}
                        >
                            {success}
                        </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button
                            type="button"
                            onClick={onReset}
                            disabled={saving || !dirty}
                            style={{
                                padding: '10px 18px',
                                borderRadius: 8,
                                border: 'none',
                                background: dirty ? '#DC2626' : '#fecaca',
                                color: '#fff',
                                fontWeight: 600,
                                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                            }}
                        >
                            {t('btn.reset')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !dirty}
                            style={{
                                padding: '10px 18px',
                                borderRadius: 8,
                                border: 'none',
                                background: dirty ? '#16A34A' : '#86efac',
                                color: '#fff',
                                fontWeight: 600,
                                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={16} className="supplier-sales-last-sale-spinner" />
                                    {t('btn.saving')}
                                </>
                            ) : (
                                t('btn.update')
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
