import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    getAccountingSettings,
    patchAccountingSettings,
} from '../../../services/accountingSettingsApi';
import { getBooksHealthSummary } from '../../../services/booksHealthApi';
import {
    getStaffAppSettings,
    updateStaffAppSettings,
} from '../../../services/staffAppApi';
import {
    ACC_SETTINGS_PAGE_SIZE,
    branchOverrideTriState,
    fieldLabelKey,
    flattenSettingsHistory,
    normalizeBranchOverrideMap,
    parseYmd,
    setBranchOverrideTriState,
    settingsDirty,
    slicePage,
    unlockDaysCount,
} from '../../../utils/accountingSettingsDisplay';
import { accT } from '../../../utils/accountingI18n';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import { useAuth } from '../../../context/AuthContext';
import { getWorkshopBranches } from '../../../services/workshopStaffApi';
import {
    isPlatformSuperAdmin,
    isSuperAdminPrincipal,
} from '../../../utils/allowNegativeBalance';
import { mapHeadingReclassSettingsError } from '../../../utils/headingReclassSettingsErrors';

const TABS = [
    { id: 'dates', labelKey: 'accSettings.tab.dates' },
    { id: 'basis', labelKey: 'accSettings.tab.basis' },
    { id: 'fiscal', labelKey: 'accSettings.tab.fiscal' },
    { id: 'audit', labelKey: 'accSettings.tab.audit' },
];

const emptyDraft = () => ({
    startDate: '',
    lockedUpTo: '',
    cutoverEnabled: false,
    basis: 'accrual',
    allowNegativeCashBank: false,
    allowNegativeCashBankByBranch: {},
    headingReclassOpen: false,
});

function fmtWhen(iso) {
    if (!iso) return '—';
    const s = String(iso);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s.slice(0, 10);
    }
    return s;
}

function fmtLocalWhen(iso, locale) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return fmtWhen(iso);
    return d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

const cardStyle = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: 16,
};

const helpStyle = { fontSize: 13, color: '#64748B', marginTop: 6, lineHeight: 1.45 };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 };

export default function WorkshopAccountingSettingsPage({
    locale: localeProp = 'en',
    workshopId: workshopIdProp = null,
    crossWorkshopSaScope = false,
}) {
    const locale = localeProp || 'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const { hasPermission, user } = useAuth();
    const isPlatformSA = isPlatformSuperAdmin(user);
    const saBooksReadOnly =
        Boolean(crossWorkshopSaScope) && isSuperAdminPrincipal(user);
    const scopeParams = useMemo(() => {
        const id = workshopIdProp != null && String(workshopIdProp).trim() !== ''
            ? String(workshopIdProp).trim()
            : '';
        return id ? { workshopId: id } : {};
    }, [workshopIdProp]);
    const canView =
        isPlatformSA ||
        hasPermission('workshop.accounting.chart-of-accounts.view') ||
        hasPermission('accounting.chart-of-accounts.view');
    const canSave = canView;
    const isOwner = String(user?.userType || '').toLowerCase() === 'workshop_owner';
    // K3: owner or accountant may edit cash/bank controls.
    const isAccountant =
        String(user?.userType || '').toLowerCase() === 'accountant' ||
        String(user?.role || '').toLowerCase() === 'accountant' ||
        (Array.isArray(user?.roles) &&
            user.roles.some((r) => String(r).toLowerCase() === 'accountant'));
    const canEditCashControls = isOwner || isAccountant;

    const [searchParams, setSearchParams] = useSearchParams();
    const [headingReclassSaving, setHeadingReclassSaving] = useState(false);
    const [headingDialog, setHeadingDialog] = useState(null);
    const [headingReason, setHeadingReason] = useState('');
    const [headingMsg, setHeadingMsg] = useState(null);
    const tabRaw = String(searchParams.get('tab') || 'dates').toLowerCase();
    const tab = TABS.some((x) => x.id === tabRaw) ? tabRaw : 'dates';

    const setTab = (id) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', id);
        setSearchParams(next, { replace: true });
    };

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(null);
    const [draft, setDraft] = useState(emptyDraft);
    const [reason, setReason] = useState('');
    const [confirmUnlock, setConfirmUnlock] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);
    const [auditPage, setAuditPage] = useState(1);
    const [healthLine, setHealthLine] = useState(null);
    const [citEnabled, setCitEnabled] = useState(false);
    const [citSaving, setCitSaving] = useState(false);
    const [citMsg, setCitMsg] = useState(null);
    const [branches, setBranches] = useState([]);
    const [cashToggleReasonOpen, setCashToggleReasonOpen] = useState(false);

    const applySaved = useCallback((s) => {
        const row = s && typeof s === 'object' ? s : {};
        setSaved(row);
        setDraft({
            startDate: parseYmd(row.startDate) || '',
            lockedUpTo: parseYmd(row.lockedUpTo) || '',
            cutoverEnabled: Boolean(row.cutoverEnabled),
            basis: row.basis === 'cash' ? 'cash' : 'accrual',
            allowNegativeCashBank: Boolean(row.allowNegativeCashBank),
            allowNegativeCashBankByBranch: normalizeBranchOverrideMap(
                row.allowNegativeCashBankByBranch,
            ),
            headingReclassOpen: Boolean(
                row.headingReclassEffectiveOpen ?? row.headingReclassOpen,
            ),
        });
        setReason('');
        setConfirmUnlock(false);
        setCashToggleReasonOpen(false);
        setSaveMsg(null);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const s = await getAccountingSettings(scopeParams);
            applySaved(s);
        } catch (err) {
            const status = Number(err?.status);
            if (status === 404) {
                setError(t('accSettings.error.notDeployed'));
            } else if (status === 403) {
                setError(t('accSettings.error.forbidden'));
            } else {
                setError(err?.message || t('accSettings.error.load'));
            }
            setSaved(null);
            setDraft(emptyDraft());
        } finally {
            setLoading(false);
        }
    }, [applySaved, scopeParams, t]);

    useEffect(() => {
        if (!canView) return undefined;
        void load();
        return undefined;
    }, [canView, load]);

    useEffect(() => {
        if (!canView) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await getWorkshopBranches();
                const list = Array.isArray(res?.branches)
                    ? res.branches
                    : Array.isArray(res?.data)
                      ? res.data
                      : Array.isArray(res)
                        ? res
                        : [];
                if (!cancelled) {
                    setBranches(
                        list
                            .map((b) => ({
                                id: String(b.id ?? b.branchId ?? ''),
                                name: b.name || b.branchName || String(b.id ?? ''),
                            }))
                            .filter((b) => b.id),
                    );
                }
            } catch {
                if (!cancelled) setBranches([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [canView]);

    useEffect(() => {
        if (!canView) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await getStaffAppSettings();
                const settings = res?.settings ?? res?.data ?? res ?? {};
                if (!cancelled) {
                    setCitEnabled(Boolean(settings.lockerCashInTransitEnabled));
                }
            } catch {
                if (!cancelled) setCitEnabled(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [canView]);

    const saveCitFlag = async (next) => {
        if (!canEditCashControls) return;
        setCitSaving(true);
        setCitMsg(null);
        try {
            await updateStaffAppSettings({ lockerCashInTransitEnabled: Boolean(next) });
            setCitEnabled(Boolean(next));
            setCitMsg({ tone: 'ok', text: t('cit.settings.saved') });
        } catch (err) {
            setCitMsg({
                tone: 'bad',
                text: err?.message || t('cit.settings.errSave'),
            });
        } finally {
            setCitSaving(false);
        }
    };

    useEffect(() => {
        if (!canView) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const h = await getBooksHealthSummary();
                if (cancelled || !h) return;
                const start = h.accountingStartDate || '—';
                const lock = h.lockedUpTo || '—';
                const pending = Number(h.pendingPostings ?? 0);
                setHealthLine(
                    t('accSettings.cutover.healthLine', {
                        start,
                        lock,
                        pending: String(pending),
                    }),
                );
            } catch {
                if (!cancelled) setHealthLine(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [canView, t]);

    const dirty = useMemo(() => settingsDirty(draft, saved || {}), [draft, saved]);
    const unlockN = useMemo(
        () => unlockDaysCount(saved?.lockedUpTo, draft.lockedUpTo || null),
        [saved, draft.lockedUpTo],
    );

    const historyRows = useMemo(
        () => flattenSettingsHistory(saved?.history),
        [saved],
    );
    const auditPaged = useMemo(
        () => slicePage(historyRows, auditPage, ACC_SETTINGS_PAGE_SIZE),
        [historyRows, auditPage],
    );

    const cancel = () => {
        applySaved(saved);
    };

    const closeHeadingDialog = useCallback(() => {
        if (headingReclassSaving) return;
        setHeadingDialog(null);
        setHeadingReason('');
        setHeadingMsg((prev) => (prev?.tone === 'bad' ? null : prev));
    }, [headingReclassSaving]);

    const confirmHeadingDialog = async () => {
        if (!headingDialog || typeof headingDialog.want !== 'boolean') return;
        const r = String(headingReason || '').trim();
        if (r.length < 5) return;
        const want = headingDialog.want;
        setHeadingReclassSaving(true);
        setHeadingMsg(null);
        try {
            const body = { headingReclassOpen: want, reason: r };
            const next = await patchAccountingSettings(body, scopeParams);
            applySaved(next);
            setHeadingDialog(null);
            setHeadingReason('');
            setHeadingMsg({ tone: 'ok', text: t('accSettings.saved') });
        } catch (err) {
            setHeadingMsg({
                tone: 'bad',
                text: mapHeadingReclassSettingsError(err, t),
            });
        } finally {
            setHeadingReclassSaving(false);
        }
    };

    useEffect(() => {
        if (!headingDialog) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeHeadingDialog();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [headingDialog, closeHeadingDialog]);

    const doSave = async ({ confirmed = false } = {}) => {
        if (!canSave || !dirty || saBooksReadOnly) return;
        const r = String(reason || '').trim();
        if (!r) {
            setSaveMsg({ tone: 'bad', text: t('accSettings.reasonRequired') });
            return;
        }
        if (unlockN > 0 && !confirmed && !confirmUnlock) {
            setConfirmUnlock(true);
            return;
        }
        setSaving(true);
        setSaveMsg(null);
        try {
            const byBranch = normalizeBranchOverrideMap(draft.allowNegativeCashBankByBranch);
            const body = {
                startDate: draft.startDate || null,
                lockedUpTo: draft.lockedUpTo || null,
                cutoverEnabled: Boolean(draft.cutoverEnabled),
                basis: draft.basis === 'cash' ? 'cash' : 'accrual',
                allowNegativeCashBank: Boolean(draft.allowNegativeCashBank),
                allowNegativeCashBankByBranch:
                    Object.keys(byBranch).length > 0 ? byBranch : null,
                reason: r,
            };
            const next = await patchAccountingSettings(body, scopeParams);
            applySaved(next);
            setSaveMsg({ tone: 'ok', text: t('accSettings.saved') });
            setAuditPage(1);
        } catch (err) {
            const status = Number(err?.status);
            let text = err?.message || t('accSettings.error.save');
            if (status === 404) text = t('accSettings.error.notDeployed');
            if (status === 403) text = t('accSettings.error.forbiddenSave');
            if (String(err?.code) === 'REASON_REQUIRED') text = t('accSettings.reasonRequired');
            if (String(err?.code) === 'SUPER_ADMIN_SETTINGS_SCOPE') {
                text = t('settings.saScopeHint');
            }
            setSaveMsg({ tone: 'bad', text });
        } finally {
            setSaving(false);
        }
    };

    if (!canView) {
        return (
            <div className="module-container" role="alert">
                <p>{t('accSettings.error.forbidden')}</p>
            </div>
        );
    }

    const datesForm = (
        <div style={{ ...cardStyle, flex: '1 1 320px', minWidth: 280 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{t('accSettings.card.startTitle')}</h3>
            {saBooksReadOnly ? (
                <p
                    role="status"
                    data-testid="sa-settings-scope-hint"
                    style={{ ...helpStyle, marginTop: 0, marginBottom: 12, color: '#92400E' }}
                >
                    {t('settings.saScopeHint')}
                </p>
            ) : null}
            <label style={labelStyle} htmlFor="acc-start-date">
                {t('accSettings.startDate')}
            </label>
            <input
                id="acc-start-date"
                type="date"
                className="form-input"
                value={draft.startDate}
                onChange={(e) =>
                    setDraft((p) => ({ ...p, startDate: e.target.value.slice(0, 10) }))
                }
                disabled={loading || saving || saBooksReadOnly}
                readOnly={saBooksReadOnly}
            />
            <p style={helpStyle}>
                {t('accSettings.startHelp')}{' '}
                <span style={{ fontWeight: 700 }}>{t('accSettings.legacyBadge')}</span>
                {t('accSettings.startHelp2')}
            </p>

            <label style={{ ...labelStyle, marginTop: 14 }} htmlFor="acc-locked-up-to">
                {t('accSettings.lockedUpTo')}
            </label>
            <input
                id="acc-locked-up-to"
                type="date"
                className="form-input"
                value={draft.lockedUpTo}
                onChange={(e) => {
                    setConfirmUnlock(false);
                    setDraft((p) => ({ ...p, lockedUpTo: e.target.value.slice(0, 10) }));
                }}
                disabled={loading || saving || saBooksReadOnly}
                readOnly={saBooksReadOnly}
            />
            <p style={helpStyle}>{t('accSettings.lockedHelp')}</p>

            <label
                style={{
                    ...labelStyle,
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 500,
                }}
            >
                <input
                    type="checkbox"
                    checked={Boolean(draft.cutoverEnabled)}
                    onChange={(e) =>
                        setDraft((p) => ({ ...p, cutoverEnabled: e.target.checked }))
                    }
                    disabled={loading || saving || saBooksReadOnly}
                />
                {t('accSettings.cutoverSwitch')}
            </label>

            <label style={{ ...labelStyle, marginTop: 14 }} htmlFor="acc-reason">
                {t('accSettings.reason')}
            </label>
            <input
                id="acc-reason"
                type="text"
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading || saving || !dirty}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        void doSave();
                    }
                    if (e.key === 'Escape') cancel();
                }}
            />

            {confirmUnlock && unlockN > 0 ? (
                <div
                    role="status"
                    style={{
                        marginTop: 12,
                        padding: 10,
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        borderRadius: 8,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        alignItems: 'center',
                    }}
                >
                    <span style={{ flex: '1 1 200px' }}>
                        {t('accSettings.unlockConfirm', { n: String(unlockN) })}
                    </span>
                    <button
                        type="button"
                        className="btn-submit btn-dark"
                        disabled={saving}
                        onClick={() => void doSave({ confirmed: true })}
                    >
                        {t('accSettings.confirm')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={saving}
                        onClick={() => setConfirmUnlock(false)}
                    >
                        {t('accSettings.cancel')}
                    </button>
                </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {canSave && !saBooksReadOnly ? (
                    <button
                        type="button"
                        className="btn-submit btn-dark"
                        disabled={loading || saving || !dirty}
                        onClick={() => void doSave()}
                    >
                        {saving ? t('accSettings.saving') : t('accSettings.save')}
                    </button>
                ) : null}
                {!saBooksReadOnly ? (
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={loading || saving || !dirty}
                        onClick={cancel}
                    >
                        {t('accSettings.cancel')}
                    </button>
                ) : null}
            </div>
            {saveMsg ? (
                <p
                    role={saveMsg.tone === 'bad' ? 'alert' : 'status'}
                    style={{
                        marginTop: 10,
                        color: saveMsg.tone === 'bad' ? '#991B1B' : '#065F46',
                        fontSize: 13,
                    }}
                >
                    {saveMsg.text}
                </p>
            ) : null}
        </div>
    );

    const basisCard = (
        <div style={{ ...cardStyle, flex: '1 1 280px', minWidth: 260 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{t('accSettings.card.basisTitle')}</h3>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ ...labelStyle, marginBottom: 8 }}>{t('accSettings.reportBasis')}</legend>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input
                        type="radio"
                        name="acc-basis"
                        checked={draft.basis === 'accrual'}
                        onChange={() => setDraft((p) => ({ ...p, basis: 'accrual' }))}
                        disabled={loading || saving || saBooksReadOnly}
                    />
                    {t('accSettings.basis.accrual')}
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        type="radio"
                        name="acc-basis"
                        checked={draft.basis === 'cash'}
                        onChange={() => setDraft((p) => ({ ...p, basis: 'cash' }))}
                        disabled={loading || saving || saBooksReadOnly}
                    />
                    {t('accSettings.basis.cash')}
                </label>
            </fieldset>
            <p style={{ ...helpStyle, marginTop: 14 }}>
                <strong>{t('accSettings.fiscalYear')}</strong>
                <br />
                {t('accSettings.fiscalYearValue')}
            </p>
            <p style={helpStyle}>
                <strong>{t('accSettings.vatPeriod')}</strong>
                <br />
                {t('accSettings.vatPeriodValue')}
            </p>
            <p style={helpStyle}>
                <strong>{t('accSettings.currency')}</strong>
                <br />
                {t('accSettings.currencyValue')}
            </p>
        </div>
    );

    const cashBankControlsCard = (
        <div
            style={{ ...cardStyle, flex: '1 1 320px', minWidth: 280 }}
            data-testid="cash-bank-controls-card"
        >
            <h3
                style={{
                    margin: '0 0 12px',
                    fontSize: 16,
                    fontFamily: locale === 'ar' ? 'Cairo, sans-serif' : undefined,
                }}
            >
                {t('accSettings.cashBankControlsTitle')}
            </h3>
            <label
                style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    fontWeight: 500,
                }}
            >
                <input
                    type="checkbox"
                    checked={Boolean(draft.allowNegativeCashBank)}
                    onChange={(e) => {
                        const next = e.target.checked;
                        const prev = Boolean(draft.allowNegativeCashBank);
                        setDraft((p) => ({
                            ...p,
                            allowNegativeCashBank: next,
                        }));
                        if (!prev && next) {
                            setCashToggleReasonOpen(true);
                            setTab('basis');
                        }
                    }}
                    disabled={
                        loading || saving || !canEditCashControls || saBooksReadOnly
                    }
                />
                <span>
                    {t('accSettings.allowNegativeCashBank')}
                    <span style={{ ...helpStyle, display: 'block', marginTop: 4 }}>
                        {t('accSettings.allowNegativeCashBankHelp')}
                    </span>
                </span>
            </label>
            {cashToggleReasonOpen ? (
                <p role="status" style={{ ...helpStyle, marginTop: 10, color: '#92400E' }}>
                    {t('accSettings.cashToggleReasonHint')}
                </p>
            ) : null}
            <div
                style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid #E2E8F0',
                }}
                data-testid="heading-reclass-controls"
            >
                <p style={{ ...labelStyle, marginBottom: 6 }}>
                    {t('accSettings.headingReclassOpen')}
                </p>
                <p style={{ ...helpStyle, marginTop: 0, marginBottom: 10 }}>
                    {t('accSettings.headingReclassHelp')}
                </p>
                {isPlatformSA ? (
                    <>
                        <label
                            style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'flex-start',
                                fontWeight: 500,
                                marginBottom: 10,
                            }}
                        >
                            <input
                                type="checkbox"
                                data-testid="heading-reclass-open-checkbox"
                                checked={Boolean(saved?.headingReclassEffectiveOpen)}
                                disabled={loading || headingReclassSaving}
                                onChange={(e) => {
                                    setHeadingMsg(null);
                                    setHeadingReason('');
                                    setHeadingDialog({ want: e.target.checked });
                                }}
                            />
                            <span>{t('accSettings.headingReclassOpen')}</span>
                        </label>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            data-testid="heading-reclass-lock-btn"
                            disabled={
                                loading ||
                                headingReclassSaving ||
                                !saved?.headingReclassEffectiveOpen
                            }
                            onClick={() => {
                                setHeadingMsg(null);
                                setHeadingReason('');
                                setHeadingDialog({ want: false });
                            }}
                        >
                            {t('accSettings.headingReclassLock')}
                        </button>
                    </>
                ) : (
                    <p
                        style={helpStyle}
                        role="status"
                        data-testid="heading-reclass-status"
                    >
                        {saved?.headingReclassEffectiveOpen
                            ? t('accSettings.headingReclassOpenedBy', {
                                  id: String(saved?.headingReclassOpenedBy ?? '—'),
                                  opened: fmtLocalWhen(
                                      saved?.headingReclassOpenedAt,
                                      locale,
                                  ),
                                  expires: fmtLocalWhen(
                                      saved?.headingReclassExpiresAt,
                                      locale,
                                  ),
                              })
                            : t('accSettings.headingReclassLocked')}
                    </p>
                )}
                {isPlatformSA ? (
                    <p
                        style={{ ...helpStyle, marginTop: 8 }}
                        data-testid="heading-reclass-status"
                        role="status"
                    >
                        {saved?.headingReclassEffectiveOpen
                            ? t('accSettings.headingReclassOpenedBy', {
                                  id: String(saved?.headingReclassOpenedBy ?? '—'),
                                  opened: fmtLocalWhen(
                                      saved?.headingReclassOpenedAt,
                                      locale,
                                  ),
                                  expires: fmtLocalWhen(
                                      saved?.headingReclassExpiresAt,
                                      locale,
                                  ),
                              })
                            : t('accSettings.headingReclassLocked')}
                    </p>
                ) : null}
                {headingMsg ? (
                    <p
                        role={headingMsg.tone === 'bad' ? 'alert' : 'status'}
                        data-testid="heading-reclass-msg"
                        style={{
                            marginTop: 8,
                            color: headingMsg.tone === 'bad' ? '#991B1B' : '#065F46',
                            fontSize: 13,
                        }}
                    >
                        {headingMsg.text}
                    </p>
                ) : null}
            </div>
            {!saBooksReadOnly && branches.length > 1 ? (
                <div style={{ marginTop: 16 }} data-testid="cash-bank-branch-overrides">
                    <p style={{ ...labelStyle, marginBottom: 8 }}>
                        {t('accSettings.branchOverridesTitle')}
                    </p>
                    <WsTableScroll>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th className="table-th">{t('accSettings.th.branch')}</th>
                                    <th className="table-th">{t('accSettings.th.override')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {branches.map((b) => {
                                    const tri = branchOverrideTriState(
                                        draft.allowNegativeCashBankByBranch,
                                        b.id,
                                    );
                                    return (
                                        <tr key={b.id}>
                                            <td className="table-cell">{b.name}</td>
                                            <td className="table-cell">
                                                <select
                                                    className="form-input"
                                                    value={tri}
                                                    disabled={
                                                        loading ||
                                                        saving ||
                                                        !canEditCashControls ||
                                                        saBooksReadOnly
                                                    }
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setDraft((p) => ({
                                                            ...p,
                                                            allowNegativeCashBankByBranch:
                                                                setBranchOverrideTriState(
                                                                    p.allowNegativeCashBankByBranch,
                                                                    b.id,
                                                                    v,
                                                                ),
                                                        }));
                                                    }}
                                                >
                                                    <option value="inherit">
                                                        {t('accSettings.override.inherit')}
                                                    </option>
                                                    <option value="allow">
                                                        {t('accSettings.override.allow')}
                                                    </option>
                                                    <option value="block">
                                                        {t('accSettings.override.block')}
                                                    </option>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </WsTableScroll>
                </div>
            ) : null}
        </div>
    );

    const citFlagCard = (
        <div style={{ ...cardStyle, flex: '1 1 280px', minWidth: 260 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{t('cit.settings.flag')}</h3>
            <label
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 500,
                }}
            >
                <input
                    type="checkbox"
                    checked={Boolean(citEnabled)}
                    onChange={(e) => void saveCitFlag(e.target.checked)}
                    disabled={!isOwner || citSaving || loading}
                />
                {t('cit.settings.flag')}
            </label>
            <p style={helpStyle}>{t('cit.settings.flagHelp')}</p>
            {citMsg ? (
                <p
                    role={citMsg.tone === 'bad' ? 'alert' : 'status'}
                    style={{
                        marginTop: 8,
                        color: citMsg.tone === 'bad' ? '#991B1B' : '#065F46',
                        fontSize: 13,
                    }}
                >
                    {citMsg.text}
                </p>
            ) : null}
        </div>
    );

    const auditTable = (
        <div style={{ ...cardStyle, marginTop: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{t('accSettings.auditTitle')}</h3>
            {historyRows.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 13 }}>{t('accSettings.auditEmpty')}</p>
            ) : (
                <>
                    <WsTableScroll>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th className="table-th">{t('accSettings.th.when')}</th>
                                    <th className="table-th">{t('accSettings.th.user')}</th>
                                    <th className="table-th">{t('accSettings.th.field')}</th>
                                    <th className="table-th">{t('accSettings.th.old')}</th>
                                    <th className="table-th">{t('accSettings.th.new')}</th>
                                    <th className="table-th">{t('accSettings.th.reason')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditPaged.rows.map((row, idx) => (
                                    <tr key={`${row.at}-${row.field}-${idx}`}>
                                        <td className="table-cell">{fmtWhen(row.at)}</td>
                                        <td className="table-cell">{row.userId || '—'}</td>
                                        <td className="table-cell">{t(fieldLabelKey(row.field))}</td>
                                        <td className="table-cell">{row.oldValue}</td>
                                        <td className="table-cell">{row.newValue}</td>
                                        <td className="table-cell">{row.reason || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </WsTableScroll>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginTop: 8,
                        }}
                    >
                        <span style={{ fontSize: 13, color: '#64748B' }}>
                            {t('accSettings.showing', {
                                a: String(auditPaged.from),
                                b: String(auditPaged.to),
                                n: String(auditPaged.total),
                            })}
                        </span>
                        <WsTablePagination
                            page={auditPaged.page}
                            pageCount={auditPaged.pageCount}
                            onPageChange={setAuditPage}
                        />
                    </div>
                </>
            )}
        </div>
    );

    const cutoverCard = (
        <div style={{ ...cardStyle, marginTop: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{t('accSettings.cutoverTitle')}</h3>
            <p style={helpStyle}>{t('accSettings.cutoverHelp')}</p>
            <ol style={{ margin: '8px 0', paddingInlineStart: 20, fontSize: 13, color: '#334155' }}>
                <li>{t('accSettings.cutover.step1')}</li>
                <li>
                    <Link to="/workshop/accounting/settings/opening-balance">
                        {t('accSettings.cutover.step2')}
                    </Link>
                </li>
                <li>{t('accSettings.cutover.step3')}</li>
            </ol>
            {healthLine ? (
                <p style={{ fontSize: 13, color: '#475569' }}>{healthLine}</p>
            ) : (
                <p style={{ fontSize: 13, color: '#94A3B8' }}>{t('accSettings.cutover.healthUnavailable')}</p>
            )}
            <p style={{ marginTop: 8 }}>
                <Link to="/workshop/accounting/books-health">{t('accSettings.cutover.booksHealth')}</Link>
                {' · '}
                <Link to="/workshop/accounting/roles-access">{t('accSettings.linkRoles')}</Link>
            </p>
        </div>
    );

    return (
        <div className="module-container" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 6 }}>
                {t('accSettings.breadcrumb')}
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>{t('accSettings.title')}</h2>

            <div
                role="tablist"
                style={{
                    display: 'flex',
                    gap: 4,
                    flexWrap: 'wrap',
                    borderBottom: '1px solid #E2E8F0',
                    marginBottom: 16,
                }}
            >
                {TABS.map((x) => (
                    <button
                        key={x.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === x.id}
                        className={tab === x.id ? 'btn-submit btn-dark' : 'btn-portal-outline'}
                        style={{ borderRadius: '8px 8px 0 0', marginBottom: -1 }}
                        onClick={() => setTab(x.id)}
                    >
                        {t(x.labelKey)}
                    </button>
                ))}
            </div>

            {loading ? <p>{t('accSettings.loading')}</p> : null}
            {error ? (
                <div role="alert" style={{ marginBottom: 12 }}>
                    <p>{error}</p>
                    <button type="button" className="btn-portal-outline" onClick={() => void load()}>
                        {t('accSettings.retry')}
                    </button>
                </div>
            ) : null}

            {!loading && !error && tab === 'dates' ? (
                <>
                    <div
                        style={{
                            display: 'flex',
                            gap: 16,
                            flexWrap: 'wrap',
                            alignItems: 'stretch',
                        }}
                    >
                        {datesForm}
                        {basisCard}
                    </div>
                    {cutoverCard}
                    {auditTable}
                </>
            ) : null}

            {!loading && !error && tab === 'basis' ? (
                <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                        {basisCard}
                        {cashBankControlsCard}
                        {!saBooksReadOnly ? citFlagCard : null}
                    </div>
                    {!saBooksReadOnly ? (
                        <div style={{ ...cardStyle, marginTop: 16 }}>
                            <label style={labelStyle} htmlFor="acc-reason-basis">
                                {t('accSettings.reason')}
                            </label>
                            <input
                                id="acc-reason-basis"
                                type="text"
                                className="form-input"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                disabled={loading || saving || !dirty}
                            />
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 12,
                                    flexWrap: 'wrap',
                                }}
                            >
                                {canSave ? (
                                    <button
                                        type="button"
                                        className="btn-submit btn-dark"
                                        disabled={loading || saving || !dirty}
                                        onClick={() => void doSave()}
                                    >
                                        {saving
                                            ? t('accSettings.saving')
                                            : t('accSettings.save')}
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={loading || saving || !dirty}
                                    onClick={cancel}
                                >
                                    {t('accSettings.cancel')}
                                </button>
                            </div>
                            {saveMsg ? (
                                <p
                                    role={saveMsg.tone === 'bad' ? 'alert' : 'status'}
                                    style={{
                                        marginTop: 10,
                                        color:
                                            saveMsg.tone === 'bad' ? '#991B1B' : '#065F46',
                                        fontSize: 13,
                                    }}
                                >
                                    {saveMsg.text}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                </>
            ) : null}
            {headingDialog ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    data-testid="heading-reclass-reason-dialog"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 12000,
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            ...cardStyle,
                            width: 'min(420px, 100%)',
                            boxShadow: '0 12px 40px rgba(15,23,42,0.2)',
                        }}
                    >
                        <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>
                            {headingDialog.want
                                ? t('accSettings.headingReclassDialogOpen')
                                : t('accSettings.headingReclassDialogLock')}
                        </h3>
                        <label style={labelStyle} htmlFor="heading-reclass-reason">
                            {t('accSettings.reason')}
                        </label>
                        <textarea
                            id="heading-reclass-reason"
                            data-testid="heading-reclass-reason"
                            className="form-input"
                            rows={3}
                            value={headingReason}
                            onChange={(e) => setHeadingReason(e.target.value)}
                            disabled={headingReclassSaving}
                        />
                        <p style={helpStyle}>{t('accSettings.headingReclassReasonMin')}</p>
                        {headingMsg?.tone === 'bad' ? (
                            <p
                                role="alert"
                                data-testid="heading-reclass-dialog-error"
                                style={{ marginTop: 8, color: '#991B1B', fontSize: 13 }}
                            >
                                {headingMsg.text}
                            </p>
                        ) : null}
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                marginTop: 14,
                                flexWrap: 'wrap',
                            }}
                        >
                            <button
                                type="button"
                                className="btn-submit btn-dark"
                                data-testid="heading-reclass-confirm"
                                disabled={
                                    headingReclassSaving ||
                                    String(headingReason || '').trim().length < 5
                                }
                                onClick={() => void confirmHeadingDialog()}
                            >
                                {headingReclassSaving
                                    ? t('accSettings.saving')
                                    : t('accSettings.confirm')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                data-testid="heading-reclass-cancel"
                                disabled={headingReclassSaving}
                                onClick={closeHeadingDialog}
                            >
                                {t('accSettings.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {!loading && !error && tab === 'fiscal' ? (
                <div style={cardStyle}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{t('accSettings.tab.fiscal')}</h3>
                    <p style={helpStyle}>
                        <strong>{t('accSettings.fiscalYear')}</strong>
                        <br />
                        {t('accSettings.fiscalYearValue')}
                    </p>
                    <p style={helpStyle}>
                        <strong>{t('accSettings.vatPeriod')}</strong>
                        <br />
                        {t('accSettings.vatPeriodValue')}
                    </p>
                    <p style={helpStyle}>
                        <strong>{t('accSettings.currency')}</strong>
                        <br />
                        {t('accSettings.currencyValue')}
                    </p>
                    <p style={{ ...helpStyle, marginTop: 12 }}>{t('accSettings.fiscalReadonlyNote')}</p>
                </div>
            ) : null}
            {!loading && !error && tab === 'audit' ? auditTable : null}
        </div>
    );
}
