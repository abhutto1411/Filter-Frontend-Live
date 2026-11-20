import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
    createWorkshopCashBankAccount,
    listWorkshopCashBankAccounts,
    updateWorkshopCashBankAccount,
} from '../../services/workshopStaffApi';
import { setAllowNegativeBalance } from '../../services/cashBankApi';
import AllowNegativeBalanceToggle from '../../components/accounting/AllowNegativeBalanceToggle';
import { useAuth } from '../../context/AuthContext';
import { getPlatformHqInfo } from '../../services/superAdminApi';
import {
    setAccountingHqBooksMode,
    setAccountingWorkshopScopeId,
} from '../../utils/accountingWorkshopScope';
import { loadSaAccountingScope } from './saAccountingScope';
import { accT } from '../../utils/accountingI18n';
import {
    apiCashBankTypeToUi,
    todayIsoDate,
    uiCashBankTypeToApi,
} from '../workshop/accounting/workshopAccountingShared';
import { mapCashBankAccountFromApi } from '../../utils/cashBankScreen';
import SelectCombo from '../../components/SelectCombo';
import '../../styles/admin/AccountingPage.css';
import '../../styles/accounting/accounting-ui-kit.css';

/**
 * Full-page create / edit for Platform HQ cash & bank registers (no branch linkage).
 * Layout aligned with workshop Cash & Bank (P-A21B) — no modals.
 */
export default function HqCashBankAccountPage() {
    const { accountId } = useParams();
    const isEdit = Boolean(accountId);
    const navigate = useNavigate();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const { user } = useAuth();
    const [allowNegativeBalance, setAllowNegative] = useState(false);
    const scope = loadSaAccountingScope();

    const [hqWorkshopId, setHqWorkshopId] = useState(scope.hqWorkshopId || '');
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const [name, setName] = useState('');
    const [type, setType] = useState('Cash');
    const [openingBalance, setOpeningBalance] = useState('0');
    const [openingBalanceDate, setOpeningBalanceDate] = useState(() => todayIsoDate());
    const [status, setStatus] = useState('active');
    const [bankName, setBankName] = useState('');
    const [iban, setIban] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [coaLink, setCoaLink] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getPlatformHqInfo().catch(() => ({}));
                const id = res?.workshopId || scope.hqWorkshopId;
                if (!cancelled && id) {
                    const sid = String(id);
                    setHqWorkshopId(sid);
                    setAccountingWorkshopScopeId(sid);
                    setAccountingHqBooksMode(true);
                }
            } catch {
                /* optional */
            }
        })();
        return () => {
            cancelled = true;
            setAccountingWorkshopScopeId(null);
            setAccountingHqBooksMode(false);
        };
    }, [scope.hqWorkshopId]);

    const loadAccount = useCallback(async () => {
        if (!isEdit || !accountId) return;
        setLoading(true);
        setErr('');
        try {
            const res = await listWorkshopCashBankAccounts();
            const list = res?.accounts || res?.data || [];
            const raw = list.find((a) => String(a.id) === String(accountId));
            if (!raw) {
                setErr(t('cb.err.notFound'));
                return;
            }
            const row = mapCashBankAccountFromApi(raw) || raw;
            setName(row.name || '');
            setType(row.typeUi || apiCashBankTypeToUi(raw.type));
            setOpeningBalance(String(row.openingBalance ?? 0));
            setStatus(row.status || 'active');
            setBankName(raw.bankName || '');
            setIban(raw.iban || '');
            setAccountNumber(raw.accountNumber || '');
            setCoaLink(row.coaLink || '—');
            setAllowNegative(raw.allowNegativeBalance === true || row.allowNegativeBalance === true);
        } catch (e) {
            setErr(e?.message || t('cb.err.load'));
        } finally {
            setLoading(false);
        }
    }, [accountId, isEdit, t]);

    useEffect(() => {
        if (hqWorkshopId) {
            setAccountingWorkshopScopeId(hqWorkshopId);
            setAccountingHqBooksMode(true);
        }
        if (isEdit) void loadAccount();
    }, [hqWorkshopId, isEdit, loadAccount]);

    const goBack = () => navigate('/admin/accounting/cash-bank');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        const trimmed = name.trim();
        if (!trimmed) {
            setErr(t('cb.err.name'));
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: trimmed,
                type: uiCashBankTypeToApi(type),
                openingBalance: Number(openingBalance) || 0,
                status,
                workshopId: hqWorkshopId,
                hqBooks: 'true',
            };
            if (type === 'Bank') {
                body.bankName = bankName.trim() || undefined;
                body.iban = iban.trim() || undefined;
                body.accountNumber = accountNumber.trim() || undefined;
            }
            if (isEdit) {
                await updateWorkshopCashBankAccount(accountId, body);
            } else {
                await createWorkshopCashBankAccount(body);
            }
            goBack();
        } catch (ex) {
            setErr(ex?.message || (isEdit ? t('cb.err.save') : t('cb.err.create')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="accounting-page module-container"
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            data-acct-ui=""
        >
            <div className="cash-bank-view" style={{ maxWidth: 720 }}>
                <button
                    type="button"
                    className="btn-portal-outline"
                    style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    onClick={goBack}
                >
                    <ArrowLeft size={16} />
                    {t('cb.hq.back')}
                </button>

                <header className="cash-bank-header">
                    <p
                        style={{
                            margin: 0,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#6b7280',
                            letterSpacing: 0.3,
                        }}
                    >
                        {t('cb.breadcrumb')}
                    </p>
                    <h2 className="cash-bank-title">
                        {isEdit ? t('cb.hq.editTitle') : t('cb.hq.newTitle')}
                    </h2>
                    <p className="cash-bank-desc">{t('cb.desc.hq')}</p>
                </header>

                {loading ? (
                    <p className="form-help-text">{t('cb.loading')}</p>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="acct-panel"
                        style={{ display: 'grid', gap: 12 }}
                        data-testid="hq-cb-account-form"
                    >
                        {err ? (
                            <p className="form-help-text" style={{ color: '#dc2626', margin: 0 }} role="alert">
                                {err}
                            </p>
                        ) : null}

                        {isEdit ? (
                            <AllowNegativeBalanceToggle
                                account={{ id: accountId, allowNegativeBalance }}
                                user={user}
                                isHq
                                hasPermission={undefined}
                                locale={locale}
                                t={t}
                                onSave={(id, body) => setAllowNegativeBalance(id, body)}
                                onSaved={(next) => setAllowNegative(next)}
                            />
                        ) : null}

                        <label className="coa-range-field">
                            <span>{t('cb.field.name')}</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('cb.field.namePh')}
                                required
                            />
                        </label>

                        <label className="coa-range-field">
                            <span>{t('cb.field.type')}</span>
                            <SelectCombo value={type} onChange={(e) => setType(e.target.value)}>
                                <option value="Cash">{t('cb.tab.cash')}</option>
                                <option value="Bank">{t('cb.tab.bank')}</option>
                                <option value="Petty Cash">{t('cb.tab.petty')}</option>
                            </SelectCombo>
                        </label>

                        {type === 'Bank' ? (
                            <>
                                <label className="coa-range-field">
                                    <span>{t('cb.field.bankName')}</span>
                                    <input
                                        type="text"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                    />
                                </label>
                                <label className="coa-range-field">
                                    <span>{t('cb.field.iban')}</span>
                                    <input
                                        type="text"
                                        value={iban}
                                        onChange={(e) => setIban(e.target.value)}
                                    />
                                </label>
                                <label className="coa-range-field">
                                    <span>{t('cb.field.accountNumber')}</span>
                                    <input
                                        type="text"
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                    />
                                </label>
                            </>
                        ) : null}

                        {isEdit ? (
                            <label className="coa-range-field">
                                <span>{t('cb.field.coaReadonly')}</span>
                                <input type="text" readOnly value={coaLink} />
                                <span className="form-help-text">{t('cb.field.coaHelp')}</span>
                            </label>
                        ) : null}

                        <label className="coa-range-field">
                            <span>{t('cb.field.opening')}</span>
                            <input
                                type="number"
                                step="0.01"
                                value={openingBalance}
                                onChange={(e) => setOpeningBalance(e.target.value)}
                            />
                        </label>

                        <label className="coa-range-field">
                            <span>{t('cb.field.openingDate')}</span>
                            <input
                                type="date"
                                value={openingBalanceDate}
                                onChange={(e) => setOpeningBalanceDate(e.target.value)}
                            />
                            <span className="form-help-text">{t('cb.field.openingDateHelp')}</span>
                        </label>

                        <label className="coa-range-field">
                            <span>{t('cb.field.status')}</span>
                            <SelectCombo value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="active">{t('cb.status.active')}</option>
                                <option value="inactive">{t('cb.status.inactive')}</option>
                            </SelectCombo>
                        </label>

                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                justifyContent: 'flex-end',
                                flexWrap: 'wrap',
                                marginTop: 8,
                                paddingTop: 12,
                                borderTop: '1px solid #e5e7eb',
                            }}
                        >
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={goBack}
                                disabled={saving}
                            >
                                {t('cb.modal.cancel')}
                            </button>
                            <button type="submit" className="btn-submit btn-dark" disabled={saving}>
                                {saving
                                    ? isEdit
                                        ? t('cb.modal.saving')
                                        : t('cb.modal.creating')
                                    : isEdit
                                      ? t('cb.modal.save')
                                      : t('cb.modal.create')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
