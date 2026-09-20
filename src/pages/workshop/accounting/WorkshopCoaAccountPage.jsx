import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Landmark,
    Receipt,
    Scale,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import {
    createAccount,
    getAccountById,
    getAccounts,
    getAccountsBranches,
    updateAccount,
} from '../../../services/accountsApi';
import { filterPortalVisibleBranches } from '../../../services/workshopStaffApi';
import {
    parseWorkshopCoaAccountFormFromPath,
} from '../workshopCoaAccountRouting';
import {
    allowedAccountTypesForStatement,
    COA_STATEMENT_PARTS,
    isIncomeStatementAccountType,
} from '../workshopCoaStatementSplit';
import { accT } from '../../../utils/accountingI18n';
import '../../../styles/admin/AccountingPage.css';

const SUBTYPE_BY_TYPE = {
    ASSET: ['CURRENT', 'FIXED', 'OTHER'],
    LIABILITY: ['CURRENT', 'LONG_TERM', 'OTHER'],
    EQUITY: ['OWNERS_EQUITY', 'RETAINED_EARNINGS', 'OTHER_EQUITY'],
    INCOME: ['OPERATING_REVENUE', 'OTHER_INCOME'],
    EXPENSE: ['COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'OTHER_EXPENSE'],
};

const TYPE_META = {
    ASSET: { color: '#2563eb', Icon: Landmark },
    LIABILITY: { color: '#dc2626', Icon: Scale },
    EQUITY: { color: '#7c3aed', Icon: Wallet },
    INCOME: { color: '#16a34a', Icon: TrendingUp },
    EXPENSE: { color: '#d97706', Icon: Receipt },
};

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function unwrapAccount(res) {
    if (!res) return null;
    if (res.id != null) return res;
    if (res.data?.id != null) return res.data;
    if (res.account?.id != null) return res.account;
    return null;
}

function parseAccountList(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.list)) return res.list;
    if (Array.isArray(res?.items)) return res.items;
    return [];
}

function toLabel(value, t) {
    const key = String(value || '');
    if (t && key) {
        const subKey = `coa.sub.${key}`;
        const sub = t(subKey);
        if (sub !== subKey) return sub;
        const typeKey = `coa.type.${key}`;
        const typ = t(typeKey);
        if (typ !== typeKey) return typ;
        const groupKey = `coa.group.${key}`;
        const group = t(groupKey);
        if (group !== groupKey) return group;
    }
    return String(value)
        .toLowerCase()
        .split('_')
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
}

function normalBalance(type, t) {
    if (type === 'ASSET' || type === 'EXPENSE') return t('coa.normal.debit');
    return t('coa.normal.credit');
}

function firstSubtype(type) {
    return SUBTYPE_BY_TYPE[type]?.[0] || 'CURRENT';
}

/**
 * Full-page create / edit for a workshop Chart of Accounts account.
 * Reached from `/workshop/accounting/chart-of-accounts/new` or `/:id/edit`.
 */
export default function WorkshopCoaAccountPage({
    locale: localeProp,
    selectedBranchId = 'all',
} = {}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const parsed = parseWorkshopCoaAccountFormFromPath(location.pathname) || {
        mode: 'new',
        accountId: '',
    };
    const isEdit = parsed.mode === 'edit';
    const accountId = parsed.accountId;

    const queryType = String(searchParams.get('type') || '').toUpperCase();
    const queryStatement = String(searchParams.get('statement') || '').toLowerCase();
    const queryBranchId = searchParams.get('branchId') || '';
    const allowedTypes = useMemo(
        () => allowedAccountTypesForStatement(queryStatement, queryType),
        [queryStatement, queryType],
    );

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [equityAccounts, setEquityAccounts] = useState([]);
    const [parentsLoading, setParentsLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [parentSearch, setParentSearch] = useState('');

    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [type, setType] = useState(() => (
        allowedTypes.includes(queryType) ? queryType : allowedTypes[0] || 'ASSET'
    ));
    const [subType, setSubType] = useState(() => firstSubtype(
        allowedTypes.includes(queryType) ? queryType : allowedTypes[0] || 'ASSET',
    ));
    const [parentId, setParentId] = useState('');
    const [branchId, setBranchId] = useState(() => {
        if (queryBranchId && queryBranchId !== 'all') return String(queryBranchId);
        if (selectedBranchId && selectedBranchId !== 'all') return String(selectedBranchId);
        return '';
    });
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('active');
    const [openingBalance, setOpeningBalance] = useState('0');
    const [openingBalanceDate, setOpeningBalanceDate] = useState(() => todayIsoDate());
    const [openingOffsetAccountId, setOpeningOffsetAccountId] = useState('');
    const [hasChildren, setHasChildren] = useState(false);
    const [registerType, setRegisterType] = useState('');
    const [bankName, setBankName] = useState('');
    const [iban, setIban] = useState('');
    const [accountNumber, setAccountNumber] = useState('');

    const statementPart = isIncomeStatementAccountType(type)
        ? COA_STATEMENT_PARTS.INCOME_STATEMENT
        : COA_STATEMENT_PARTS.BALANCE_SHEET;
    const isPl = statementPart === COA_STATEMENT_PARTS.INCOME_STATEMENT;

    const pageTitle = isEdit
        ? t('coa.page.editTitle')
        : isPl
            ? t('coa.page.newPlTitle')
            : t('coa.page.newBsTitle');

    const goBack = useCallback(() => {
        navigate('/workshop/accounting/chart-of-accounts');
    }, [navigate]);

    useEffect(() => {
        getAccountsBranches()
            .then((list) => {
                setBranches(filterPortalVisibleBranches(parseAccountList(list)));
            })
            .catch(() => {
                setBranches([]);
            });
    }, []);

    useEffect(() => {
        let alive = true;
        setParentsLoading(true);
        getAccounts(type ? { type } : {})
            .then((list) => {
                if (alive) setAccounts(parseAccountList(list));
            })
            .catch(() => {
                if (alive) setAccounts([]);
            })
            .finally(() => {
                if (alive) setParentsLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [type]);

    useEffect(() => {
        let alive = true;
        getAccounts({ type: 'EQUITY' })
            .then((list) => {
                if (alive) setEquityAccounts(parseAccountList(list));
            })
            .catch(() => {
                if (alive) setEquityAccounts([]);
            });
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (!isEdit || !accountId) {
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await getAccountById(accountId);
                const acc = unwrapAccount(res);
                if (cancelled) return;
                if (!acc) {
                    setErr(t('coa.page.notFound'));
                    return;
                }
                const nextType = String(acc.type || 'ASSET').toUpperCase();
                setName(acc.name || '');
                setCode(acc.code || '');
                setType(nextType);
                setSubType(acc.subType || firstSubtype(nextType));
                setParentId(acc.parentId ? String(acc.parentId) : '');
                setBranchId(acc.branchId ? String(acc.branchId) : '');
                setDescription(acc.description || '');
                setStatus(acc.status || 'active');
                setOpeningBalance(
                    acc.openingBalance != null ? String(acc.openingBalance) : '0',
                );
                setOpeningBalanceDate(
                    acc.openingBalanceDate
                        ? String(acc.openingBalanceDate).slice(0, 10)
                        : todayIsoDate(),
                );
                setOpeningOffsetAccountId(
                    acc.openingOffsetAccountId ? String(acc.openingOffsetAccountId) : '',
                );
                setHasChildren(Boolean(acc.hasChildren || acc.isHeading));
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('coa.err.generic'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accountId, isEdit, t]);

    const equityContraOptions = useMemo(
        () =>
            equityAccounts.filter(
                (acc) =>
                    String(acc.type || '').toUpperCase() === 'EQUITY' &&
                    !acc.hasChildren &&
                    !acc.isHeading &&
                    (!accountId || String(acc.id) !== String(accountId)),
            ),
        [equityAccounts, accountId],
    );

    const parentOptions = useMemo(() => {
        const q = parentSearch.trim().toLowerCase();
        return accounts
            .filter((acc) => !accountId || String(acc.id) !== String(accountId))
            .filter((acc) => !type || String(acc.type || '').toUpperCase() === type)
            .filter((acc) => (
                q ? `${acc.code || ''} ${acc.name || ''}`.toLowerCase().includes(q) : true
            ));
    }, [accounts, accountId, parentSearch, type]);

    const changeType = (nextType) => {
        setType(nextType);
        setSubType(firstSubtype(nextType));
        setParentId('');
        if (nextType !== 'ASSET') {
            setRegisterType('');
            setBankName('');
            setIban('');
            setAccountNumber('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
            setErr(t('coa.page.err.name'));
            return;
        }
        const opening = Number(openingBalance);
        const openingAmt = Number.isFinite(opening) ? opening : 0;
        const canSetOpening = !hasChildren;
        if (canSetOpening && openingAmt !== 0 && !openingBalanceDate) {
            setErr(t('coa.page.err.openingDate'));
            return;
        }

        setSaving(true);
        setErr('');
        try {
            const payload = {
                name: trimmedName,
                type,
                subType,
                parentId: parentId || undefined,
                branchId: branchId || undefined,
                description: description.trim() || undefined,
                status: status || undefined,
            };
            const trimmedCode = code.trim();
            if (trimmedCode) payload.code = trimmedCode;
            if (canSetOpening) {
                payload.openingBalance = openingAmt;
                if (Math.abs(openingAmt) >= 0.005) {
                    payload.openingBalanceDate = openingBalanceDate;
                    if (openingOffsetAccountId) {
                        payload.openingOffsetAccountId = openingOffsetAccountId;
                    } else if (isEdit) {
                        payload.openingOffsetAccountId = '';
                    }
                } else {
                    payload.openingBalanceDate = '';
                    if (isEdit) payload.openingOffsetAccountId = '';
                }
            }
            if (!isEdit) {
                if (type === 'ASSET' && registerType) {
                    payload.cashBankRegisterType = registerType;
                    payload.isCashEquivalent = true;
                    if (registerType === 'BANK') {
                        if (bankName.trim()) payload.bankName = bankName.trim();
                        if (iban.trim()) payload.iban = iban.trim();
                        if (accountNumber.trim()) payload.accountNumber = accountNumber.trim();
                    }
                }
            }
            if (isEdit) {
                await updateAccount(accountId, payload);
            } else {
                await createAccount(payload);
            }
            goBack();
        } catch (ex) {
            setErr(ex?.message || t('coa.err.generic'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="accounting-page module-container">
            <div className="coa-account-page">
                <button
                    type="button"
                    className="btn-portal-outline coa-account-page-back"
                    onClick={goBack}
                >
                    <ArrowLeft size={16} />
                    {t('coa.page.back')}
                </button>

                <header className={`coa-account-hero ${isPl ? 'is-pl' : 'is-bs'}`}>
                    <span className="coa-account-badge">
                        {isPl ? t('coa.part.pl') : t('coa.part.bs')}
                    </span>
                    <h1>{pageTitle}</h1>
                    <p>{isEdit ? t('coa.page.editSubtitle') : t('coa.page.newSubtitle')}</p>
                </header>

                {loading ? (
                    <p className="form-help-text">{t('coa.page.loading')}</p>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {err ? (
                            <p className="coa-account-alert" role="alert">{err}</p>
                        ) : null}

                        <section className="coa-account-section">
                            <h2>{t('coa.page.section.identity')}</h2>
                            <div className="coa-account-grid">
                                <div className="form-group coa-account-span-2">
                                    <label className="form-label" htmlFor="coa-acc-name">
                                        {t('coa.field.name')}
                                    </label>
                                    <input
                                        id="coa-acc-name"
                                        type="text"
                                        className="form-input-field"
                                        placeholder={t('coa.page.namePh')}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="coa-acc-code">
                                        {t('coa.page.code')}
                                    </label>
                                    <input
                                        id="coa-acc-code"
                                        type="text"
                                        maxLength={20}
                                        className="form-input-field"
                                        placeholder={t('coa.page.codePh')}
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                    />
                                    <p className="form-help-text">{t('coa.page.codeHint')}</p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('coa.field.normalBal')}</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        readOnly
                                        value={normalBalance(type, t)}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="coa-account-section">
                            <h2>{t('coa.page.section.classify')}</h2>
                            <p className="coa-account-section-hint">{t('coa.page.typeHint')}</p>
                            <div className="coa-account-type-grid">
                                {allowedTypes.map((typeKey) => {
                                    const meta = TYPE_META[typeKey] || TYPE_META.ASSET;
                                    const Icon = meta.Icon;
                                    const active = type === typeKey;
                                    return (
                                        <button
                                            key={typeKey}
                                            type="button"
                                            className={`coa-account-type-card ${active ? 'is-active' : ''}`}
                                            style={{ '--type-color': meta.color }}
                                            onClick={() => changeType(typeKey)}
                                            aria-pressed={active}
                                        >
                                            <Icon size={18} />
                                            <strong>{toLabel(typeKey, t)}</strong>
                                            <span>{t(`coa.group.${typeKey}`)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="coa-account-grid">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="coa-acc-subtype">
                                        {t('coa.field.subtype')}
                                    </label>
                                    <select
                                        id="coa-acc-subtype"
                                        className="form-input-field"
                                        value={subType}
                                        onChange={(e) => setSubType(e.target.value)}
                                    >
                                        {(SUBTYPE_BY_TYPE[type] || []).map((sub) => (
                                            <option key={sub} value={sub}>{toLabel(sub, t)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="coa-acc-branch">
                                        {t('coa.field.branch')}
                                    </label>
                                    <select
                                        id="coa-acc-branch"
                                        className="form-input-field"
                                        value={branchId}
                                        onChange={(e) => setBranchId(e.target.value)}
                                    >
                                        <option value="">{t('coa.field.branchShared')}</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                    <p className="form-help-text">{t('coa.field.branchHelp')}</p>
                                </div>
                                <div className="form-group coa-account-span-2">
                                    <label className="form-label" htmlFor="coa-acc-parent-search">
                                        {t('coa.field.parent')}
                                    </label>
                                    <input
                                        id="coa-acc-parent-search"
                                        type="text"
                                        className="form-input-field"
                                        placeholder={t('coa.field.parentSearch')}
                                        value={parentSearch}
                                        onChange={(e) => setParentSearch(e.target.value)}
                                        style={{ marginBottom: 8 }}
                                    />
                                    <select
                                        className="form-input-field"
                                        value={parentId}
                                        onChange={(e) => setParentId(e.target.value)}
                                        disabled={parentsLoading}
                                    >
                                        <option value="">{t('coa.field.parentNone')}</option>
                                        {parentOptions.map((acc) => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.code} — {acc.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="coa-account-section">
                            <h2>{t('coa.page.section.opening')}</h2>
                            {hasChildren ? (
                                <p className="form-help-text">{t('coa.page.openingFolder')}</p>
                            ) : (
                                <>
                                    <div className="coa-account-grid">
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="coa-acc-opening">
                                                {t('coa.page.openingBal')}
                                            </label>
                                            <input
                                                id="coa-acc-opening"
                                                type="number"
                                                step="0.01"
                                                className="form-input-field"
                                                value={openingBalance}
                                                onChange={(e) => setOpeningBalance(e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="coa-acc-opening-date">
                                                {t('coa.page.openingDate')}
                                            </label>
                                            <input
                                                id="coa-acc-opening-date"
                                                type="date"
                                                className="form-input-field"
                                                value={openingBalanceDate}
                                                onChange={(e) => setOpeningBalanceDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group coa-account-span-2">
                                            <label className="form-label" htmlFor="coa-acc-opening-contra">
                                                {t('coa.page.openingContra')}
                                            </label>
                                            <select
                                                id="coa-acc-opening-contra"
                                                className="form-input-field"
                                                value={openingOffsetAccountId}
                                                onChange={(e) => setOpeningOffsetAccountId(e.target.value)}
                                            >
                                                <option value="">{t('coa.page.openingSuspense')}</option>
                                                {equityContraOptions.map((acc) => (
                                                    <option key={acc.id} value={acc.id}>
                                                        [{acc.code}] {acc.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <p className="form-help-text">{t('coa.page.openingHint')}</p>
                                    <p className="form-help-text">{t('coa.page.openingContraHint')}</p>
                                </>
                            )}
                        </section>

                        {!isEdit && type === 'ASSET' ? (
                            <section className="coa-account-section">
                                <h2>{t('coa.page.section.register')}</h2>
                                <p className="coa-account-section-hint">{t('coa.page.registerHint')}</p>
                                <div className="coa-account-register-row">
                                    {[
                                        { value: '', label: t('coa.page.registerNone') },
                                        { value: 'CASH', label: t('coa.page.register.cash') },
                                        { value: 'BANK', label: t('coa.page.register.bank') },
                                        { value: 'PETTY_CASH', label: t('coa.page.register.petty') },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value || 'none'}
                                            type="button"
                                            className={`coa-account-chip ${registerType === opt.value ? 'is-active' : ''}`}
                                            onClick={() => setRegisterType(opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {registerType === 'BANK' ? (
                                    <div className="coa-account-grid" style={{ marginTop: 16 }}>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="coa-acc-bank">
                                                {t('coa.page.bankName')}
                                            </label>
                                            <input
                                                id="coa-acc-bank"
                                                type="text"
                                                className="form-input-field"
                                                value={bankName}
                                                onChange={(e) => setBankName(e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="coa-acc-iban">
                                                {t('coa.page.iban')}
                                            </label>
                                            <input
                                                id="coa-acc-iban"
                                                type="text"
                                                className="form-input-field"
                                                value={iban}
                                                onChange={(e) => setIban(e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group coa-account-span-2">
                                            <label className="form-label" htmlFor="coa-acc-number">
                                                {t('coa.page.accountNumber')}
                                            </label>
                                            <input
                                                id="coa-acc-number"
                                                type="text"
                                                className="form-input-field"
                                                value={accountNumber}
                                                onChange={(e) => setAccountNumber(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </section>
                        ) : null}

                        <section className="coa-account-section">
                            <h2>{t('coa.page.section.notes')}</h2>
                            <div className="coa-account-grid">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="coa-acc-status">
                                        {t('coa.field.status')}
                                    </label>
                                    <select
                                        id="coa-acc-status"
                                        className="form-input-field"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="active">{t('coa.status.active')}</option>
                                        <option value="inactive">{t('coa.status.inactive')}</option>
                                    </select>
                                </div>
                                <div className="form-group coa-account-span-2">
                                    <label className="form-label" htmlFor="coa-acc-desc">
                                        {t('coa.field.description')}
                                    </label>
                                    <textarea
                                        id="coa-acc-desc"
                                        rows={3}
                                        className="form-input-field"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        style={{ minHeight: 96, resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="coa-account-footer">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={goBack}
                                disabled={saving}
                            >
                                {t('btn.cancel')}
                            </button>
                            <button type="submit" className="btn-portal-dark" disabled={saving}>
                                {saving
                                    ? t('coa.saving')
                                    : isEdit
                                        ? t('coa.update')
                                        : t('coa.create')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
