import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    getAccountTypesMeta,
    getAccounts,
    getAccountsBranches,
    getNextAccountCode,
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
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import SelectCombo from '../../../components/SelectCombo';

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
    return toRiyadhDateISO();
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
        const detailKey = `coa.detail.${key}`;
        const detail = t(detailKey);
        if (detail !== detailKey) return detail;
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

function detailTypesFromMeta(meta, type, subType) {
    if (!meta?.detailTypesBySubtype) return [];
    if (type === 'LIABILITY' && subType === 'CURRENT') {
        return meta.liabilityCurrentDetailTypes || [];
    }
    return meta.detailTypesBySubtype[subType] || [];
}

/**
 * Full-page create / edit for a workshop Chart of Accounts account.
 * Reached from `/workshop/accounting/chart-of-accounts/new` or `/:id/edit`.
 */
export default function WorkshopCoaAccountPage({
    locale: localeProp,
    // `selectedBranchId` is still passed by callers but ignored: new accounts default
    // to workshop-wide (not the topbar branch).
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
    // Default workshop-wide (empty). Only honor an explicit ?branchId= query.
    const [branchId, setBranchId] = useState(() => {
        if (queryBranchId && queryBranchId !== 'all') return String(queryBranchId);
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
    const [nameAr, setNameAr] = useState('');
    const [detailType, setDetailType] = useState('');
    const [defaultTaxCode, setDefaultTaxCode] = useState('');
    const [allowReconcile, setAllowReconcile] = useState(false);
    const [isHeader, setIsHeader] = useState(false);
    const [typeMeta, setTypeMeta] = useState(null);
    const [suggestingCode, setSuggestingCode] = useState(false);
    /** Live availability of the typed code (GET /accounts/next-code?check=). */
    const [codeCheck, setCodeCheck] = useState(null);
    const [initialCode, setInitialCode] = useState('');
    /** Edit only: type / subtype locked once journal lines exist. */
    const [hasPostings, setHasPostings] = useState(false);
    /** Edit only: system (auto-seed / role) accounts lock code, type and parent. */
    const [isSystemLocked, setIsSystemLocked] = useState(false);
    const saveAndNewRef = useRef(false);

    const statementPart = isIncomeStatementAccountType(type)
        ? COA_STATEMENT_PARTS.INCOME_STATEMENT
        : COA_STATEMENT_PARTS.BALANCE_SHEET;
    const isPl = statementPart === COA_STATEMENT_PARTS.INCOME_STATEMENT;

    const pageTitle = isEdit
        ? t('coa.page.editTitle')
        : queryStatement === COA_STATEMENT_PARTS.INCOME_STATEMENT
            ? t('coa.page.newPlTitle')
            : queryStatement === COA_STATEMENT_PARTS.BALANCE_SHEET
                ? t('coa.page.newBsTitle')
                : t('coa.page.newTitle');

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
        getAccountTypesMeta()
            .then((meta) => setTypeMeta(meta?.data ?? meta))
            .catch(() => setTypeMeta(null));
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
                setInitialCode(acc.code || '');
                setHasPostings(Boolean(acc.hasPostings));
                setIsSystemLocked(Boolean(acc.isSystemLocked));
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
                setNameAr(acc.nameAr || '');
                setDetailType(acc.detailType || '');
                setDefaultTaxCode(acc.defaultTaxCode || '');
                setAllowReconcile(Boolean(acc.allowReconcile));
                setIsHeader(Boolean(acc.isHeader || acc.isHeading));
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

    const detailTypeOptions = useMemo(
        () => detailTypesFromMeta(typeMeta, type, subType),
        [typeMeta, type, subType],
    );

    const showTaxPicker = type === 'INCOME' || type === 'EXPENSE';
    const showReconcileToggle = type === 'ASSET' || type === 'LIABILITY';

    // Parent = same type AND a header (group) or an account that already has children.
    const parentOptions = useMemo(() => {
        const q = parentSearch.trim().toLowerCase();
        return accounts
            .filter((acc) => !accountId || String(acc.id) !== String(accountId))
            .filter((acc) => !type || String(acc.type || '').toUpperCase() === type)
            .filter((acc) => Boolean(acc.isHeader || acc.hasChildren || acc.isHeading))
            .filter((acc) => (
                q ? `${acc.code || ''} ${acc.name || ''}`.toLowerCase().includes(q) : true
            ));
    }, [accounts, accountId, parentSearch, type]);

    const changeType = (nextType) => {
        setType(nextType);
        const nextSub = firstSubtype(nextType);
        setSubType(nextSub);
        setParentId('');
        setDetailType('');
        if (nextType !== 'INCOME' && nextType !== 'EXPENSE') setDefaultTaxCode('');
        if (nextType !== 'ASSET' && nextType !== 'LIABILITY') setAllowReconcile(false);
        if (nextType !== 'ASSET') {
            setRegisterType('');
            setBankName('');
            setIban('');
            setAccountNumber('');
        }
    };

    const suggestCode = async () => {
        setSuggestingCode(true);
        try {
            const res = await getNextAccountCode({
                type,
                subType,
                ...(parentId ? { parentId } : {}),
            });
            const next = res?.code ?? res?.suggestedCode ?? res?.nextCode;
            if (next) setCode(String(next));
        } catch {
            /* keep manual code */
        } finally {
            setSuggestingCode(false);
        }
    };

    // Debounced live check of a typed code (only when it differs from the saved one).
    useEffect(() => {
        const c = code.trim();
        if (!c || (isEdit && c === initialCode)) {
            setCodeCheck(null);
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const res = await getNextAccountCode({ type, subType, check: c });
                if (!cancelled) setCodeCheck(res || null);
            } catch {
                if (!cancelled) setCodeCheck(null);
            }
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [code, type, subType, isEdit, initialCode]);

    const resetForNew = () => {
        setName('');
        setNameAr('');
        setCode('');
        setCodeCheck(null);
        setDescription('');
        setOpeningBalance('0');
        setOpeningOffsetAccountId('');
        setDetailType('');
        setDefaultTaxCode('');
        setAllowReconcile(false);
        setIsHeader(false);
        setRegisterType('');
        setBankName('');
        setIban('');
        setAccountNumber('');
    };

    const typeLocked = isEdit && (hasPostings || isSystemLocked);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const andNew = saveAndNewRef.current;
        saveAndNewRef.current = false;
        if (codeCheck && codeCheck.available === false) {
            setErr(t(`coa.page.err.code.${codeCheck.reason || 'taken'}`));
            return;
        }
        const trimmedName = name.trim();
        if (!trimmedName) {
            setErr(t('coa.page.err.name'));
            return;
        }
        const opening = Number(openingBalance);
        const openingAmt = Number.isFinite(opening) ? opening : 0;
        const canSetOpening = !hasChildren && !isHeader && !isPl;
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
                isHeader: isHeader || undefined,
            };
            if (nameAr.trim()) payload.nameAr = nameAr.trim();
            if (detailType) payload.detailType = detailType;
            if (showTaxPicker && defaultTaxCode) payload.defaultTaxCode = defaultTaxCode;
            if (showReconcileToggle && allowReconcile) payload.allowReconcile = true;
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
                if (isSystemLocked) delete payload.code;
                await updateAccount(accountId, payload);
            } else {
                await createAccount(payload);
            }
            if (!isEdit && andNew) {
                resetForNew();
                return;
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

                        <div className="coa-account-columns">
                        <div className="coa-account-col">
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
                                <div className="form-group coa-account-span-2">
                                    <label className="form-label" htmlFor="coa-acc-name-ar">
                                        {t('coa.field.nameAr')}
                                    </label>
                                    <input
                                        id="coa-acc-name-ar"
                                        type="text"
                                        className="form-input-field"
                                        dir="rtl"
                                        placeholder={t('coa.field.nameArPh')}
                                        value={nameAr}
                                        onChange={(e) => setNameAr(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="coa-acc-code">
                                        {t('coa.page.code')}
                                    </label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input
                                            id="coa-acc-code"
                                            type="text"
                                            maxLength={20}
                                            className="form-input-field"
                                            placeholder={t('coa.page.codePh')}
                                            dir="ltr"
                                            inputMode="numeric"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            disabled={isEdit && isSystemLocked}
                                            aria-invalid={codeCheck?.available === false ? 'true' : undefined}
                                            aria-describedby="coa-acc-code-status"
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            onClick={() => { void suggestCode(); }}
                                            disabled={suggestingCode || (isEdit && isSystemLocked)}
                                        >
                                            {suggestingCode ? t('coa.page.suggestCodeBusy') : t('coa.page.suggestCode')}
                                        </button>
                                    </div>
                                    <p
                                        id="coa-acc-code-status"
                                        className="form-help-text"
                                        role="status"
                                        style={
                                            codeCheck
                                                ? { color: codeCheck.available === false ? '#DC2626' : '#15803D' }
                                                : undefined
                                        }
                                    >
                                        {isEdit && isSystemLocked
                                            ? t('coa.page.systemLocked')
                                            : codeCheck
                                              ? codeCheck.available === false
                                                  ? t(`coa.page.err.code.${codeCheck.reason || 'taken'}`)
                                                  : t('coa.page.codeAvailable')
                                              : t('coa.page.codeHint')}
                                    </p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('coa.field.normalBal')}</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        readOnly
                                        value={normalBalance(type, t)}
                                    />
                                    <p className="form-help-text" data-testid="coa-statement-badge">
                                        {t('coa.field.statement')}: {isPl ? t('coa.part.pl') : t('coa.part.bs')}
                                        {' · '}
                                        {t('coa.field.currency')}: <span dir="ltr">SAR</span>
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="coa-account-section">
                            <h2>{t('coa.page.section.classify')}</h2>
                            <p className="coa-account-section-hint">
                                {typeLocked
                                    ? hasPostings
                                        ? t('coa.page.typeLockedPostings')
                                        : t('coa.page.systemLocked')
                                    : t('coa.page.typeHint')}
                            </p>
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
                                            disabled={typeLocked && !active}
                                            data-testid={`coa-type-${typeKey}`}
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
                                    <SelectCombo
                                        id="coa-acc-subtype"
                                        className="form-input-field"
                                        value={subType}
                                        disabled={typeLocked}
                                        onChange={(e) => {
                                            setSubType(e.target.value);
                                            setDetailType('');
                                        }}
                                    >
                                        {(SUBTYPE_BY_TYPE[type] || []).map((sub) => (
                                            <option key={sub} value={sub}>{toLabel(sub, t)}</option>
                                        ))}
                                    </SelectCombo>
                                </div>
                                {detailTypeOptions.length > 0 ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="coa-acc-detail">
                                            {t('coa.field.detailType')}
                                        </label>
                                        <SelectCombo
                                            id="coa-acc-detail"
                                            className="form-input-field"
                                            value={detailType}
                                            onChange={(e) => setDetailType(e.target.value)}
                                        >
                                            <option value="">{t('coa.field.detailTypeNone')}</option>
                                            {detailTypeOptions.map((dt) => (
                                                <option key={dt} value={dt}>{toLabel(dt, t)}</option>
                                            ))}
                                        </SelectCombo>
                                    </div>
                                ) : null}
                                {showTaxPicker ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="coa-acc-tax">
                                            {t('coa.field.defaultTax')}
                                        </label>
                                        <SelectCombo
                                            id="coa-acc-tax"
                                            className="form-input-field"
                                            value={defaultTaxCode}
                                            onChange={(e) => setDefaultTaxCode(e.target.value)}
                                        >
                                            <option value="">{t('coa.field.defaultTaxNone')}</option>
                                            {['VAT15', 'ZERO', 'EXEMPT', 'OUT_OF_SCOPE'].map((tc) => (
                                                <option key={tc} value={tc}>
                                                    {t(`coa.tax.${tc}`)}
                                                </option>
                                            ))}
                                        </SelectCombo>
                                    </div>
                                ) : null}
                                <div className="form-group">
                                    <label className="form-label" htmlFor="coa-acc-header">
                                        <input
                                            id="coa-acc-header"
                                            type="checkbox"
                                            checked={isHeader}
                                            onChange={(e) => setIsHeader(e.target.checked)}
                                            style={{ marginInlineEnd: 8 }}
                                        />
                                        {t('coa.field.isHeader')}
                                    </label>
                                    <p className="form-help-text">{t('coa.field.isHeaderHelp')}</p>
                                </div>
                                {showReconcileToggle && !isHeader ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="coa-acc-reconcile">
                                            <input
                                                id="coa-acc-reconcile"
                                                type="checkbox"
                                                checked={allowReconcile}
                                                onChange={(e) => setAllowReconcile(e.target.checked)}
                                                style={{ marginInlineEnd: 8 }}
                                            />
                                            {t('coa.field.allowReconcile')}
                                        </label>
                                    </div>
                                ) : null}
                                <div className="form-group">
                                    <label className="form-label" htmlFor="coa-acc-branch">
                                        {t('coa.field.branch')}
                                    </label>
                                    <SelectCombo
                                        id="coa-acc-branch"
                                        className="form-input-field"
                                        value={branchId}
                                        onChange={(e) => setBranchId(e.target.value)}
                                    >
                                        <option value="">{t('coa.field.branchShared')}</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </SelectCombo>
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
                                    <SelectCombo
                                        id="coa-acc-parent"
                                        className="form-input-field"
                                        value={parentId}
                                        onChange={(e) => setParentId(e.target.value)}
                                        disabled={parentsLoading || (isEdit && isSystemLocked)}
                                    >
                                        <option value="">{t('coa.field.parentNone')}</option>
                                        {parentOptions.map((acc) => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.code} — {acc.name}
                                            </option>
                                        ))}
                                    </SelectCombo>
                                </div>
                            </div>
                        </section>
                        </div>

                        <div className="coa-account-col">
                        <section className="coa-account-section">
                            <h2>{t('coa.page.section.opening')}</h2>
                            {isPl ? (
                                <p className="form-help-text">{t('coa.page.openingPl')}</p>
                            ) : hasChildren || isHeader ? (
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
                                            <SelectCombo
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
                                            </SelectCombo>
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
                                    <SelectCombo
                                        id="coa-acc-status"
                                        className="form-input-field"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="active">{t('coa.status.active')}</option>
                                        <option value="inactive">{t('coa.status.inactive')}</option>
                                    </SelectCombo>
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
                        </div>
                        </div>

                        <div className="coa-account-footer">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={goBack}
                                disabled={saving}
                            >
                                {t('btn.cancel')}
                            </button>
                            {!isEdit ? (
                                <button
                                    type="submit"
                                    className="btn-portal-outline"
                                    disabled={saving}
                                    onClick={() => {
                                        saveAndNewRef.current = true;
                                    }}
                                >
                                    {t('coa.saveAndNew')}
                                </button>
                            ) : null}
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
                <style>{`
                    .coa-account-columns { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
                    .coa-account-col { min-width: 0; }
                    .coa-account-columns .coa-account-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
                    .coa-account-columns .coa-account-grid > * { min-width: 0; }
                    @media (min-width: 1280px) {
                        .coa-account-page { max-width: 1200px; }
                        .coa-account-columns { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
                    }
                    @media (max-width: 640px) {
                        .coa-account-columns .coa-account-grid { grid-template-columns: minmax(0, 1fr); }
                    }
                `}</style>
            </div>
        </div>
    );
}
