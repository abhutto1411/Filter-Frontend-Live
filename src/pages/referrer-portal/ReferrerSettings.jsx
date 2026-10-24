import React, { useEffect, useState } from 'react';
import { Copy, Share2, Globe, Landmark, User, Info, QrCode, KeyRound } from 'lucide-react';
import QRCode from 'qrcode';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { rfT } from '../../utils/referrerPortalI18n';
import { formatRuleValue, useReferrerPortal } from './useReferrerPortal';
import { publicReferralSharePath } from '../../utils/referralCodeCapture';
import { referrerPortalChangePassword, referrerPortalUpdateProfile } from '../../services/referrerPortalApi';

const TABS = [
    { id: 'code', labelKey: 'set.tabCode' },
    { id: 'profile', labelKey: 'set.tabProfile' },
    { id: 'password', labelKey: 'set.tabPassword' },
    { id: 'program', labelKey: 'set.tabProgram' },
];

export default function ReferrerSettings() {
    const { updateUser } = useAuth();
    const { locale, setLocale, overview, overviewError, reloadOverview, isCommunity } = useReferrerPortal();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab');
    const [tab, setTab] = useState(TABS.some((t) => t.id === requestedTab) ? requestedTab : 'code');
    const [copied, setCopied] = useState(false);
    const [qrSrc, setQrSrc] = useState('');
    const [form, setForm] = useState({ name: '', phone: '', email: '', bankName: '', iban: '' });
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [saveError, setSaveError] = useState('');
    const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdMsg, setPwdMsg] = useState('');
    const [pwdError, setPwdError] = useState('');

    const profile = overview?.profile || null;
    const referralCode = profile?.referralCode || '';
    const shareUrl =
        typeof window !== 'undefined' && referralCode
            ? `${window.location.origin}${publicReferralSharePath(referralCode)}`
            : '';

    useEffect(() => {
        if (TABS.some((t) => t.id === requestedTab) && requestedTab !== tab) {
            setTab(requestedTab);
        }
    }, [requestedTab, tab]);

    useEffect(() => {
        if (!profile) return;
        setForm({
            name: profile.name || '',
            phone: profile.phone || '',
            email: profile.email || '',
            bankName: profile.bankName || '',
            iban: profile.iban || '',
        });
    }, [profile]);

    useEffect(() => {
        if (!referralCode) {
            setQrSrc('');
            return;
        }
        QRCode.toDataURL(String(referralCode), { width: 168, margin: 1, errorCorrectionLevel: 'M' })
            .then(setQrSrc)
            .catch(() => setQrSrc(''));
    }, [referralCode]);

    const selectTab = (id) => {
        setTab(id);
        setSearchParams(id === 'code' ? {} : { tab: id }, { replace: true });
    };

    const copyCode = async () => {
        if (!referralCode) return;
        try {
            await navigator.clipboard.writeText(String(referralCode));
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };

    const shareCode = async () => {
        if (!referralCode) return;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: rfT(locale, 'set.code'),
                    text: referralCode,
                    url: shareUrl || undefined,
                });
                return;
            }
            await navigator.clipboard.writeText(shareUrl || referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            /* cancelled */
        }
    };

    const saveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveMsg('');
        setSaveError('');
        try {
            const res = await referrerPortalUpdateProfile({
                name: form.name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim(),
                ...(isCommunity
                    ? {}
                    : {
                        bankName: form.bankName.trim(),
                        iban: form.iban.trim(),
                    }),
            });
            updateUser?.({
                name: res?.profile?.name || form.name.trim(),
                email: res?.profile?.email || form.email.trim(),
                mobile: res?.profile?.phone || form.phone.trim(),
            });
            await reloadOverview?.();
            setSaveMsg(rfT(locale, 'set.saved'));
        } catch (err) {
            setSaveError(err?.message || rfT(locale, 'set.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const savePassword = async (e) => {
        e.preventDefault();
        setPwdMsg('');
        setPwdError('');
        if (pwd.newPassword !== pwd.confirm) {
            setPwdError(rfT(locale, 'set.pwdMismatch'));
            return;
        }
        setPwdSaving(true);
        try {
            await referrerPortalChangePassword({
                currentPassword: pwd.currentPassword,
                newPassword: pwd.newPassword,
            });
            setPwd({ currentPassword: '', newPassword: '', confirm: '' });
            setPwdMsg(rfT(locale, 'set.pwdSaved'));
        } catch (err) {
            setPwdError(err?.message || rfT(locale, 'set.pwdFailed'));
        } finally {
            setPwdSaving(false);
        }
    };

    const commission = overview?.commissionRule;
    const benefit = overview?.benefitRule;

    return (
        <div className="rf-page">
            <p className="rf-page-lead">{rfT(locale, 'set.subtitle')}</p>
            {overviewError ? (
                <div className="rf-hint">
                    <Info size={16} />
                    <span>{overviewError}</span>
                </div>
            ) : null}

            <div className="rf-settings-tabs" role="tablist">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        className={`rf-settings-tab ${tab === item.id ? 'is-on' : ''}`}
                        onClick={() => selectTab(item.id)}
                    >
                        {rfT(locale, item.labelKey)}
                    </button>
                ))}
            </div>

            {tab === 'code' ? (
                <div className="rf-card">
                    <h3 className="rf-card-title" style={{ marginBottom: 16 }}>{rfT(locale, 'set.code')}</h3>
                    <div className="rf-code-row">
                        <div className="rf-code-chip">{referralCode || '—'}</div>
                        <button type="button" className="rf-btn-outline" onClick={copyCode} disabled={!referralCode}>
                            <Copy size={16} />
                            {copied ? rfT(locale, 'set.copied') : rfT(locale, 'set.copy')}
                        </button>
                        <button type="button" className="rf-btn-outline" onClick={shareCode} disabled={!referralCode}>
                            <Share2 size={16} />
                            {rfT(locale, 'set.share')}
                        </button>
                    </div>
                    {qrSrc ? (
                        <div className="rf-qr-wrap">
                            <img src={qrSrc} alt={rfT(locale, 'set.shareQr')} width={140} height={140} />
                            <p className="rf-muted">
                                <QrCode size={14} /> {rfT(locale, 'set.qrHint')}
                            </p>
                        </div>
                    ) : null}
                    <p className="rf-page-lead" style={{ marginTop: 16 }}>{rfT(locale, 'set.codeHint')}</p>
                </div>
            ) : null}

            {tab === 'profile' ? (
                <form className="rf-stack" onSubmit={saveProfile}>
                    <div className="rf-card">
                        <div className="rf-card-header">
                            <h3 className="rf-card-title">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <User size={18} />
                                    {rfT(locale, 'set.profile')}
                                </span>
                            </h3>
                        </div>
                        {saveMsg ? <div className="rf-hint">{saveMsg}</div> : null}
                        {saveError ? <div className="rf-hint">{saveError}</div> : null}
                        <div className="rf-form-grid">
                            <div className="rf-form-group">
                                <label className="rf-label">{rfT(locale, 'set.fullName')}</label>
                                <input className="rf-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="rf-form-group">
                                <label className="rf-label">{rfT(locale, 'set.mobile')}</label>
                                <input className="rf-input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                            </div>
                            <div className="rf-form-group">
                                <label className="rf-label">{rfT(locale, 'set.email')}</label>
                                <input className="rf-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div className="rf-form-group">
                                <label className="rf-label">{rfT(locale, 'set.type')}</label>
                                <input className="rf-input" value={profile?.category || rfT(locale, isCommunity ? 'layout.communityRole' : 'layout.role')} readOnly />
                            </div>
                        </div>
                        {isCommunity ? (
                            <div className="rf-form-actions" style={{ marginTop: 16 }}>
                                <button type="submit" className="rf-btn-primary" disabled={saving}>
                                    {saving ? rfT(locale, 'set.saving') : rfT(locale, 'set.save')}
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {!isCommunity ? (
                    <div className="rf-card">
                        <div className="rf-card-header">
                            <h3 className="rf-card-title">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <Landmark size={18} />
                                    {rfT(locale, 'set.bank')}
                                </span>
                            </h3>
                        </div>
                        <div className="rf-form-grid">
                            <div className="rf-form-group">
                                <label className="rf-label">{rfT(locale, 'set.bankName')}</label>
                                <input className="rf-input" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
                            </div>
                            <div className="rf-form-group">
                                <label className="rf-label">{rfT(locale, 'set.iban')}</label>
                                <input className="rf-input" value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))} placeholder="SA…" />
                            </div>
                        </div>
                        <div className="rf-form-actions" style={{ marginTop: 16 }}>
                            <button type="submit" className="rf-btn-primary" disabled={saving}>
                                {saving ? rfT(locale, 'set.saving') : rfT(locale, 'set.save')}
                            </button>
                        </div>
                    </div>
                    ) : null}

                    <div className="rf-card">
                        <div className="rf-card-header">
                            <h3 className="rf-card-title">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <Globe size={18} />
                                    {rfT(locale, 'set.language')}
                                </span>
                            </h3>
                        </div>
                        <div className="rf-lang-row">
                            <button
                                type="button"
                                className={locale === 'en' ? 'rf-btn-primary' : 'rf-btn-outline'}
                                onClick={() => setLocale?.('en')}
                            >
                                {rfT(locale, 'set.en')}
                            </button>
                            <button
                                type="button"
                                className={locale === 'ar' ? 'rf-btn-primary' : 'rf-btn-outline'}
                                onClick={() => setLocale?.('ar')}
                            >
                                {rfT(locale, 'set.ar')}
                            </button>
                        </div>
                    </div>
                </form>
            ) : null}

            {tab === 'password' ? (
                <form className="rf-card rf-stack" style={{ maxWidth: 520 }} onSubmit={savePassword}>
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <KeyRound size={18} />
                                {rfT(locale, 'set.password')}
                            </span>
                        </h3>
                    </div>
                    {pwdMsg ? <div className="rf-hint">{pwdMsg}</div> : null}
                    {pwdError ? <div className="rf-hint">{pwdError}</div> : null}
                    <div className="rf-form-group">
                        <label className="rf-label">{rfT(locale, 'set.currentPassword')}</label>
                        <input className="rf-input" type="password" value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} />
                    </div>
                    <div className="rf-form-group">
                        <label className="rf-label">{rfT(locale, 'set.newPassword')}</label>
                        <input className="rf-input" type="password" value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} />
                    </div>
                    <div className="rf-form-group">
                        <label className="rf-label">{rfT(locale, 'set.confirmPassword')}</label>
                        <input className="rf-input" type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} />
                    </div>
                    <div className="rf-form-actions">
                        <button type="submit" className="rf-btn-primary" disabled={pwdSaving}>
                            {pwdSaving ? rfT(locale, 'set.saving') : rfT(locale, 'set.changePassword')}
                        </button>
                    </div>
                    <p className="rf-muted">{rfT(locale, 'set.pwdHint')}</p>
                </form>
            ) : null}

            {tab === 'program' ? (
                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">{rfT(locale, 'set.rules')}</h3>
                    </div>
                    <div className="rf-hint">
                        <Info size={16} />
                        <span>{rfT(locale, 'set.rulesHint')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                        {!isCommunity ? (
                        <div className="rf-rule">
                            <div className="rf-rule-top">
                                <span className="rf-rule-target">{rfT(locale, 'set.commission')}</span>
                                {commission ? (
                                    <span className="rf-badge rf-badge-converted">
                                        {commission.scope === 'referrer'
                                            ? rfT(locale, 'set.yourRule')
                                            : rfT(locale, 'set.globalRule')}
                                    </span>
                                ) : null}
                            </div>
                            {commission ? (
                                <div className="rf-rule-metrics">
                                    <div>
                                        <p className="k">{rfT(locale, 'set.commission')}</p>
                                        <p className="v" style={{ color: 'var(--color-primary)' }}>
                                            {formatRuleValue(commission, 'commission')}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="rf-muted">{rfT(locale, 'set.noCommission')}</p>
                            )}
                        </div>
                        ) : null}

                        <div className="rf-rule">
                            <div className="rf-rule-top">
                                <span className="rf-rule-target">{rfT(locale, 'set.customerBenefit')}</span>
                                {benefit ? (
                                    <span className="rf-badge rf-badge-converted">
                                        {benefit.scope === 'referrer'
                                            ? rfT(locale, 'set.yourRule')
                                            : rfT(locale, 'set.globalRule')}
                                    </span>
                                ) : null}
                            </div>
                            {benefit ? (
                                <div className="rf-rule-metrics">
                                    <div>
                                        <p className="k">{rfT(locale, 'set.discount')}</p>
                                        <p className="v" style={{ color: 'var(--color-primary)' }}>
                                            {formatRuleValue(benefit, 'benefit')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="k">{rfT(locale, 'set.minOrder')}</p>
                                        <p className="v">{Number(benefit.minOrderValue || 0).toFixed(2)} SAR</p>
                                    </div>
                                    <div>
                                        <p className="k">{rfT(locale, 'set.newOnly')}</p>
                                        <p className="v">{rfT(locale, 'yes')}</p>
                                    </div>
                                    <div>
                                        <p className="k">{rfT(locale, 'set.once')}</p>
                                        <p className="v">
                                            {benefit.oncePerCustomer ? rfT(locale, 'yes') : rfT(locale, 'no')}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="rf-muted">{rfT(locale, 'set.noBenefit')}</p>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
