import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle, RefreshCw, Upload, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { lockerCollectionErrorMessage } from '../../utils/lockerCollectionErrors';
import {
    buildStageAExpensesPayload,
    expensesForJournalPreview,
    halalasToSar,
    isReceivedAmountEntered,
    mergeOpenDetailFormState,
    newExpenseLine,
    newRecordIdempotencyKey,
    pickupVarianceHalalas,
    stageAExpensesValid,
    sumExpenseGrossHalalas,
} from './recordCollectionHelpers';
import {
    MAX_COLLECTION_PROOF_FILE_BYTES,
    recordCollectionPayloadWithinLimit,
} from './recordCollectionLimits';
import {
    getCollectionRequest,
    getRecordPostingContext,
    listCollectionRequests,
    listLockerTeam,
    nullableMoney,
    previewOfficerCitProvision,
    provisionOfficerCit,
} from '../../services/lockerCollectionApi';
import SearchSelect from '../../components/SearchSelect';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useLockerPortal } from './useLockerPortal';
import ApprovalsScreen from './ApprovalsScreen';
import {
    buildCollectionRecordJournalPreview,
    collectionRecordBannerKind,
    collectionRecordDebitFromContext,
    formatCitMoneyLatn,
    formatCollectionSessionHint,
    formatRiyadhDateTime,
    formatRiyadhSessionStamp,
    lockerCitErrorI18nKey,
} from '../../utils/lockerCitDisplay';
import RelocateCitHeadingPanel from '../../components/locker/RelocateCitHeadingPanel';
import CollectionExpenseLines from '../../components/locker/CollectionExpenseLines';

const rowCashierName = (row, fallback) =>
    row?.cashierName || row?.cashier?.name || row?.cashierUser?.name || fallback;

function isOpenCollectionRequest(detail) {
    if (!detail || typeof detail !== 'object') return false;
    if (detail.collection) return false;
    const ui = String(detail.uiStatus || '').toUpperCase();
    if (ui === 'PENDING_APPROVAL' || ui === 'APPROVED' || ui === 'REJECTED') {
        return false;
    }
    const status = String(detail.status || detail.requestStatus || '').toLowerCase();
    if (status && status !== 'pending' && status !== 'assigned') return false;
    return true;
}

function paymentBreakdown(detail, key) {
    const cc = detail?.counterClosing;
    if (!cc) return { physical: null, system: null, diff: null };
    const nested = cc[key];
    if (nested && typeof nested === 'object') {
        return {
            physical: nullableMoney(nested.physical),
            system: nullableMoney(nested.system),
            diff: nullableMoney(nested.diff),
        };
    }
    const prefix = key === 'cash' ? 'Cash' : key.charAt(0).toUpperCase() + key.slice(1);
    return {
        physical: nullableMoney(cc[`physical${prefix}`]),
        system: nullableMoney(cc[`system${prefix}Total`]),
        diff: nullableMoney(cc[`${key}Diff`] ?? cc[`${key === 'cash' ? 'cash' : key}Diff`]),
    };
}

function ClosingRow({ label, physical, system, diff, editable, value, onChange, hideFigures }) {
    const { t, money } = useLockerPortal();
    const dash = t('emdash');
    const show = (n) => (hideFigures || n == null ? dash : money(n));
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 1fr 1fr',
                gap: 12,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid #eef2f7',
            }}
        >
            <div style={{ fontWeight: 700, color: '#1f2937' }}>{label}</div>
            <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>
                    {t('record.physical')}
                </div>
                {editable ? (
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        placeholder="0.00"
                    />
                ) : (
                    <strong>{show(physical)}</strong>
                )}
            </div>
            <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>
                    {t('record.system')}
                </div>
                <span style={{ color: '#475569' }}>{show(system)}</span>
            </div>
            <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>
                    {t('common.difference')}
                </div>
                <span
                    style={{
                        color: hideFigures || diff == null || diff === 0 ? '#16a34a' : '#dc2626',
                        fontWeight: 700,
                    }}
                >
                    {show(diff)}
                </span>
            </div>
        </div>
    );
}

function ProofPicker({ fileInputRef, cameraInputRef, proofFile, proofPreview, onPick, onClear }) {
    const { t } = useLockerPortal();
    return (
        <div>
            <div
                onClick={() => !proofPreview && fileInputRef.current?.click()}
                style={{
                    minHeight: 120,
                    borderRadius: 12,
                    border: `1.5px dashed ${proofPreview ? '#16a34a' : '#cbd5e1'}`,
                    background: proofPreview ? '#fff' : '#FAFBFC',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: proofPreview ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={onPick}
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={onPick}
                />
                {proofPreview ? (
                    <img
                        src={proofPreview}
                        alt={t('record.proofAlt')}
                        style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain' }}
                    />
                ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: 12 }}>
                        <Upload size={20} />
                        <div style={{ marginTop: 6, fontSize: '0.85rem' }}>{t('record.proofAttach')}</div>
                        <div style={{ fontSize: '0.75rem' }}>{t('record.proofHint')}</div>
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {proofPreview ? (
                    <button type="button" className="btn-secondary" onClick={onClear}>
                        <X size={14} /> {t('record.remove')}
                    </button>
                ) : null}
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload size={14} /> {t('record.upload')}
                </button>
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => cameraInputRef.current?.click()}
                >
                    <Camera size={14} /> {t('record.photo')}
                </button>
            </div>
            {proofFile?.name ? (
                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    {proofFile.name}
                </p>
            ) : null}
        </div>
    );
}

const panelStyle = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: 16,
};

function lineAccountLabel(line) {
    const codeName = [line?.code, line?.name].filter(Boolean).join(' ').trim();
    return codeName || line?.name || line?.account || '—';
}

const confirmBar = {
    background: '#FEF3C7',
    border: '1px solid #F59E0B',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
};

export default function RecordCollection({
    portalRole = 'supervisor',
    selectedBranchId = 'all',
    branchLockedId = null,
    showBreadcrumb = false,
    onTabChange,
} = {}) {
    const { user } = useAuth();
    const { t, can, money, locale } = useLockerPortal();
    const dash = t('emdash');
    const stampLang = locale === 'ar' ? 'ar' : 'en';
    const canRecord = can('collections.record');
    const isCollector = portalRole === 'collector';
    const [searchParams, setSearchParams] = useSearchParams();
    const requestIdFromUrl = searchParams.get('requestId') || '';
    const scopeBranch =
        branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : undefined);

    const [requests, setRequests] = useState([]);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [listError, setListError] = useState('');
    const [detailError, setDetailError] = useState('');
    const [contextError, setContextError] = useState('');
    const [contextLoading, setContextLoading] = useState(false);
    const [postingContext, setPostingContext] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [recordedIds, setRecordedIds] = useState(() => new Set());
    const [form, setForm] = useState({
        requestId: '',
        receivedAmount: '',
        notes: '',
        citOfficerUserId: '',
        receiveIntoVaultNow: false,
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const [officerOptions, setOfficerOptions] = useState([]);
    const [collectionMode, setCollectionMode] = useState('cash_only');
    const [expenseLines, setExpenseLines] = useState(() => [newExpenseLine()]);
    const [varianceNote, setVarianceNote] = useState('');
    const [alreadyCollectedBanner, setAlreadyCollectedBanner] = useState('');
    const idempotencyKeyRef = useRef(null);
    const [provisioning, setProvisioning] = useState(false);
    const [provisionPlan, setProvisionPlan] = useState(null);
    const [provisionApplying, setProvisionApplying] = useState(false);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const requestOptions = useMemo(
        () =>
            requests.map((r) => {
                const ref = r.referenceCode || dash;
                const cashier = rowCashierName(r, dash);
                const sessionNo = r.posSessionNo || r.posSessionId || '—';
                const amt = money(r.expectedAmount ?? r.countedAmount);
                const hint = formatCollectionSessionHint(
                    {
                        branchName: r.branchName,
                        cashierName: cashier,
                        sessionOpenedAt: r.sessionOpenedAt,
                        sessionClosedAt: r.sessionClosedAt,
                    },
                    stampLang,
                );
                const age =
                    r.ageDays != null && Number.isFinite(Number(r.ageDays))
                        ? `${r.ageDays}d`
                        : '';
                const till = r.tillAccountCode || '';
                const officer = r.assignedOfficerName || '';
                const variance =
                    r.closingCashVariance != null
                        ? formatCitMoneyLatn(r.closingCashVariance)
                        : '';
                return {
                    value: String(r.id),
                    label: `${ref} · Session #${sessionNo} · ${amt}`,
                    hint: [r.branchName, cashier, till ? `Till ${till}` : null, age, officer, variance ? `Δ ${variance}` : null]
                        .filter(Boolean)
                        .join(' · '),
                    searchText: `${ref} ${sessionNo} ${r.branchName || ''} ${cashier} ${till} ${officer} ${hint} ${formatRiyadhSessionStamp(r.sessionOpenedAt, stampLang)} ${formatRiyadhSessionStamp(r.sessionClosedAt, stampLang)} ${formatRiyadhSessionStamp(r.counterClosedAt, stampLang)}`,
                };
            }),
        [requests, money, dash, stampLang],
    );

    const setRequestParam = useCallback(
        (requestId) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (requestId) next.set('requestId', requestId);
                else next.delete('requestId');
                return next;
            });
        },
        [setSearchParams],
    );

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setListError('');
        try {
            const res = await listCollectionRequests({
                view: isCollector ? 'collector' : 'supervisor',
                status: 'open',
                limit: 100,
                ...(scopeBranch ? { branchId: scopeBranch } : {}),
            });
            setRequests(Array.isArray(res.items) ? res.items : []);
        } catch (e) {
            setRequests([]);
            setListError(e?.message || t('record.errLoadRequests'));
        } finally {
            setLoading(false);
        }
    }, [isCollector, scopeBranch, t]);

    const loadDetail = useCallback(
        async (requestId) => {
            if (!requestId) {
                setDetail(null);
                setDetailError('');
                return;
            }
            setDetailLoading(true);
            setDetailError('');
            try {
                const res = await getCollectionRequest(requestId);
                if (!isOpenCollectionRequest(res)) {
                    setDetail(null);
                    setDetailError(t('record.errNotOpen'));
                    setRequestParam('');
                    return;
                }
                setDetail(res);
                setForm((f) => mergeOpenDetailFormState(f, requestId));
            } catch (e) {
                setDetail(null);
                setDetailError(e?.message || t('record.errLoadDetail'));
                setRequestParam('');
            } finally {
                setDetailLoading(false);
            }
        },
        [t, setRequestParam],
    );

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    useEffect(() => {
        if (isCollector) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await listLockerTeam();
                const users = Array.isArray(res.users) ? res.users : [];
                if (!cancelled) {
                    setOfficerOptions(
                        users
                            .filter(
                                (u) =>
                                    u &&
                                    (u.role === 'collector' ||
                                        u.lockerPortalRole === 'collector' ||
                                        u.role === 'supervisor' ||
                                        u.lockerPortalRole === 'supervisor'),
                            )
                            .map((u) => ({
                                value: String(u.id),
                                label: [
                                    u.name || u.email || String(u.id),
                                    u.citAccountCode || u.walletCode || null,
                                ]
                                    .filter(Boolean)
                                    .join(' · '),
                                code: u.citAccountCode || u.walletCode || null,
                                name: u.name || u.email || String(u.id),
                            })),
                    );
                }
            } catch {
                if (!cancelled) setOfficerOptions([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isCollector]);

    useEffect(() => {
        if (requestIdFromUrl) {
            setForm((f) => ({ ...f, requestId: requestIdFromUrl }));
            loadDetail(requestIdFromUrl);
        }
    }, [requestIdFromUrl, loadDetail]);

    useEffect(() => {
        let cancelled = false;
        const requestId = form.requestId || requestIdFromUrl || '';
        const officerUserId = form.citOfficerUserId || '';
        setContextLoading(true);
        setContextError('');
        (async () => {
            try {
                const ctx = await getRecordPostingContext(requestId, {
                    officerUserId: officerUserId || undefined,
                });
                if (!cancelled) setPostingContext(ctx);
            } catch (e) {
                if (!cancelled) {
                    setPostingContext(null);
                    const mapped = lockerCitErrorI18nKey(e);
                    setContextError(mapped ? t(mapped) : t('record.errLoadContext'));
                }
            } finally {
                if (!cancelled) setContextLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [form.requestId, form.citOfficerUserId, requestIdFromUrl, t]);

    useEffect(() => {
        if (!detail || isCollector) return;
        const assignedId =
            detail?.assignedOfficer?.id ||
            detail?.assignedOfficerUserId ||
            detail?.assignedOfficerId ||
            null;
        if (assignedId) {
            setForm((f) => ({
                ...f,
                citOfficerUserId:
                    f.citOfficerUserId && f.citOfficerUserId !== ''
                        ? f.citOfficerUserId
                        : String(assignedId),
                receiveIntoVaultNow: false,
            }));
        } else {
            setForm((f) => ({
                ...f,
                receiveIntoVaultNow: false,
            }));
        }
    }, [detail, isCollector]);

    useEffect(() => {
        if (!isCollector || !user?.id) return;
        setForm((f) => ({ ...f, citOfficerUserId: String(user.id) }));
    }, [isCollector, user?.id]);

    const clearProof = () => {
        setProofFile(null);
        setProofPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const onPickProof = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) {
            setError(t('record.errPickImage'));
            e.target.value = '';
            return;
        }
        if (f.size > MAX_COLLECTION_PROOF_FILE_BYTES) {
            setError(t('record.errImageTooLarge'));
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setProofFile(f);
            setProofPreview(reader.result);
            setError('');
        };
        reader.readAsDataURL(f);
    };

    const onRequestChange = (requestId) => {
        setForm({
            requestId,
            receivedAmount: '',
            notes: '',
            citOfficerUserId: '',
            receiveIntoVaultNow: false,
        });
        setCollectionMode('cash_only');
        setExpenseLines([newExpenseLine()]);
        setVarianceNote('');
        idempotencyKeyRef.current = null;
        setConfirmOpen(false);
        clearProof();
        setDetailError('');
        setRequestParam(requestId);
        if (requestId) loadDetail(requestId);
        else setDetail(null);
    };

    const doSubmit = async () => {
        if (submitDisabled) return;
        if (alreadyRecorded) {
            setError(t('record.alreadyRecorded'));
            return;
        }
        if (!form.requestId) {
            setError(t('record.errSelectRequest'));
            return;
        }
        const amt = Number(form.receivedAmount);
        if (!(amt >= 0)) {
            setError(t('record.errReceivedNumber'));
            return;
        }
        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = newRecordIdempotencyKey();
        }
        if (
            !recordCollectionPayloadWithinLimit({
                proofUrl: proofPreview,
                expenses: expenseLines,
            })
        ) {
            setError(t('record.errPayloadTooLarge'));
            return;
        }
        setSubmitting(true);
        setError('');
        setSuccess(null);
        setAlreadyCollectedBanner('');
        try {
            const res = await apiFetch('/locker/record-collection', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: form.requestId,
                    receivedAmount: amt,
                    notes: form.notes || undefined,
                    mode: collectionMode,
                    varianceNote:
                        pickupVarianceHal != null && pickupVarianceHal !== 0
                            ? String(varianceNote || '').trim() || undefined
                            : undefined,
                    idempotencyKey: idempotencyKeyRef.current,
                    ...(proofPreview ? { proofUrl: proofPreview } : {}),
                    ...(collectionMode === 'with_expenses'
                        ? { expenses: buildStageAExpensesPayload(expenseLines) }
                        : {}),
                    ...(!isCollector && form.citOfficerUserId
                        ? { citOfficerUserId: form.citOfficerUserId }
                        : {}),
                    ...(!isCollector
                        ? { receiveIntoVaultNow: Boolean(form.receiveIntoVaultNow) }
                        : {}),
                }),
            });
            if (res?.success === false) throw new Error(res?.message || t('record.errRecord'));
            const recordedId = String(form.requestId);
            setRecordedIds((prev) => {
                const next = new Set(prev);
                next.add(recordedId);
                return next;
            });
            setSuccess(res);
            setConfirmOpen(false);
            setForm({
                requestId: '',
                receivedAmount: '',
                notes: '',
                citOfficerUserId: '',
                receiveIntoVaultNow: false,
            });
            clearProof();
            setDetail(null);
            setRequestParam('');
            idempotencyKeyRef.current = null;
            setCollectionMode('cash_only');
            setExpenseLines([newExpenseLine()]);
            setVarianceNote('');
            await loadRequests();
        } catch (e) {
            const collectionMsg = lockerCollectionErrorMessage(e, { locale, t });
            if (e?.code === 'LOCKER_ALREADY_COLLECTED') {
                setAlreadyCollectedBanner(collectionMsg || e.message || t('err.alreadyCollected'));
                setDetail(null);
                setForm({
                    requestId: '',
                    receivedAmount: '',
                    notes: '',
                    citOfficerUserId: isCollector && user?.id ? String(user.id) : '',
                    receiveIntoVaultNow: false,
                });
                setRequestParam('');
                idempotencyKeyRef.current = null;
                await loadRequests();
                onTabChange?.(isCollector ? 'collectible' : 'pending');
            } else {
                const mapped = lockerCitErrorI18nKey(e);
                const backendMsg =
                    typeof e?.message === 'string' && e.message.trim() ? e.message.trim() : '';
                setError(collectionMsg || backendMsg || (mapped ? t(mapped) : t('record.errRecord')));
            }
            setConfirmOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    const onProvisionOfficer = async () => {
        const officerId = form.citOfficerUserId;
        if (!officerId || provisioning || !canProvisionCit) return;
        setProvisioning(true);
        setError('');
        setProvisionPlan(null);
        try {
            const plan = await previewOfficerCitProvision(officerId);
            setProvisionPlan(plan && typeof plan === 'object' ? plan : null);
        } catch (e) {
            const mapped = lockerCitErrorI18nKey(e);
            setError(mapped ? t(mapped) : t('cit.err.unavailable'));
        } finally {
            setProvisioning(false);
        }
    };

    const onApplyProvision = async () => {
        const officerId = form.citOfficerUserId;
        if (!officerId || provisionApplying || !canProvisionCit) return;
        if (provisionPlan?.collision) {
            setError(t('cit.err.collision'));
            return;
        }
        setProvisionApplying(true);
        setError('');
        try {
            await provisionOfficerCit(officerId);
            setProvisionPlan(null);
            const ctx = await getRecordPostingContext(form.requestId, {
                officerUserId: officerId,
            });
            setPostingContext(ctx);
        } catch (e) {
            const mapped = lockerCitErrorI18nKey(e);
            setError(mapped ? t(mapped) : t('cit.err.unavailable'));
        } finally {
            setProvisionApplying(false);
        }
    };

    // After a CIT heading relocate: drop the stale provision plan and reload the posting
    // context so the preview resolves the new heading (officer wallets via Provision next).
    const onCitRelocated = async () => {
        setProvisionPlan(null);
        setError('');
        try {
            const ctx = await getRecordPostingContext(form.requestId || requestIdFromUrl || '', {
                officerUserId: form.citOfficerUserId || undefined,
            });
            setPostingContext(ctx);
            setContextError('');
        } catch (e) {
            const mapped = lockerCitErrorI18nKey(e);
            setContextError(mapped ? t(mapped) : t('record.errLoadContext'));
        }
    };

    const tryConfirm = () => {
        setError('');
        idempotencyKeyRef.current = newRecordIdempotencyKey();
        if (submitDisabled) return;
        if (!form.requestId) {
            setError(t('record.errSelectRequest'));
            return;
        }
        const amt = Number(form.receivedAmount);
        if (!(amt >= 0)) {
            setError(t('record.errReceivedNumber'));
            return;
        }
        if (!isCollector) {
            setConfirmOpen(true);
            return;
        }
        void doSubmit();
    };

    const cashBreakdown = detail ? paymentBreakdown(detail, 'cash') : null;
    const bankBreakdown = detail ? paymentBreakdown(detail, 'bank') : null;
    const tabbyBreakdown = detail ? paymentBreakdown(detail, 'tabby') : null;
    const tamaraBreakdown = detail ? paymentBreakdown(detail, 'tamara') : null;
    const corporateBreakdown = detail ? paymentBreakdown(detail, 'corporate') : null;
    const successBannerKind = collectionRecordBannerKind(success);
    const successBannerText =
        successBannerKind === 'receipt_failed'
            ? success?.message || t('record.successReceiptFailed')
            : successBannerKind === 'pickup_pending'
              ? t('record.successPending')
              : successBannerKind === 'pickup_cit'
                ? t('record.successCitHeld')
                : t('record.successApproved');
    const successBannerWarn = successBannerKind === 'receipt_failed';

    const selectedOfficer = officerOptions.find(
        (o) => String(o.value) === String(form.citOfficerUserId),
    );
    const debitFromContext = collectionRecordDebitFromContext(postingContext);
    const citEnabled = postingContext?.citEnabled === true;
    const pendingExpenses = useMemo(() => {
        const raw = detail?.pendingExpenses ?? detail?.expenses;
        return Array.isArray(raw) ? raw : [];
    }, [detail]);

    const stageExpenses = useMemo(() => {
        if (collectionMode !== 'with_expenses') return [];
        return expensesForJournalPreview(expenseLines);
    }, [collectionMode, expenseLines]);

    const journalExpenses =
        collectionMode === 'with_expenses' && stageExpenses.length
            ? stageExpenses
            : pendingExpenses;

    const journalPreview = useMemo(
        () =>
            buildCollectionRecordJournalPreview({
                expected:
                    detail?.expectedAmount ??
                    detail?.totalSecuredAsset ??
                    undefined,
                received: form.receivedAmount,
                citEnabled,
                citLeafCode: debitFromContext.debitCode,
                debitCode: debitFromContext.debitCode,
                debitName: debitFromContext.debitName,
                officer: selectedOfficer
                    ? { name: selectedOfficer.name || '' }
                    : null,
                expenses: journalExpenses,
                tillCode:
                    detail?.tillAccountCode ||
                    detail?.cashierTillCode ||
                    detail?.cashier?.tillCode ||
                    detail?.counterClosing?.tillCode ||
                    '1001-C',
                tillName: detail?.cashier?.name || detail?.cashierName || '',
                branch: detail?.branch,
                branchLabel: detail?.branch?.name || detail?.branchName || '',
                receiveIntoVaultNow: Boolean(form.receiveIntoVaultNow) && citEnabled,
                blocked: debitFromContext.blocked,
                officerLeafStatus: debitFromContext.officerLeafStatus,
                officerSelected:
                    !citEnabled ||
                    Boolean(form.citOfficerUserId) ||
                    Boolean(detail?.assignedOfficer?.id),
                amountEmpty:
                    form.receivedAmount === '' ||
                    form.receivedAmount == null,
            }),
        [
            form.receivedAmount,
            form.receiveIntoVaultNow,
            form.citOfficerUserId,
            selectedOfficer,
            detail,
            journalExpenses,
            debitFromContext.debitCode,
            debitFromContext.debitName,
            debitFromContext.blocked,
            debitFromContext.officerLeafStatus,
            citEnabled,
        ],
    );
    const journalBundles = Array.isArray(journalPreview?.journals)
        ? journalPreview.journals
        : [];
    const pageError = error || listError || detailError || contextError;
    const figuresBlocked =
        loading ||
        detailLoading ||
        contextLoading ||
        Boolean(listError) ||
        Boolean(detailError) ||
        Boolean(contextError) ||
        !detail;
    const alreadyRecorded = recordedIds.has(String(form.requestId || ''));
    const canProvisionCit = !isCollector && can('cash-in-transit.receive');

    const closingAt =
        detail?.counterClosedAt ||
        detail?.sessionClosedAt ||
        detail?.counterClosing?.closedAt ||
        detail?.shiftCloseTime ||
        detail?.counterClosing?.closingTime ||
        detail?.closedAt ||
        detail?.counterClosingAt ||
        null;
    const sessionOpenedAt =
        detail?.sessionOpenedAt || detail?.posSession?.openedAt || null;
    const sessionClosedAt =
        detail?.sessionClosedAt || detail?.posSession?.closedAt || null;
    const posSessionLabel =
        detail?.posSessionNo || detail?.posSessionId || dash;
    const tillLabel =
        detail?.tillAccountCode ||
        detail?.cashierTillCode ||
        detail?.cashier?.tillCode ||
        dash;
    const cashierDisplay = [detail?.cashier?.name || detail?.cashierName, tillLabel !== dash ? tillLabel : null]
        .filter(Boolean)
        .join(' · ') || dash;
    const countedPhysical = cashBreakdown?.physical ?? detail?.countedAmount ?? null;
    const countedSystem = cashBreakdown?.system ?? null;
    const countedDiff = cashBreakdown?.diff ?? detail?.closingCashVariance ?? null;
    const uiStatus =
        detail?.uiStatus || detail?.systemStatus || detail?.status || dash;

    const blockedReasonText = (preview) => {
        const key =
            preview?.blocked?.reasonKey ||
            preview?.previewError ||
            null;
        if (!key) return '';
        const i18n =
            key === 'LOCKER_CIT_NOT_PROVISIONED' ||
            key === 'LOCKER_CIT_NAMESPACE_COLLISION'
                ? lockerCitErrorI18nKey({ code: key })
                : `record.blocked.${key}`;
        return t(i18n, preview?.blocked?.params || {});
    };
    const expectedAmt =
        detail?.totalSecuredAsset ??
        detail?.expectedAmount ??
        cashBreakdown?.physical ??
        null;
    const assignedName =
        detail?.assignedOfficer?.name ||
        detail?.previousAssigneeName ||
        detail?.assignedOfficerName ||
        null;
    const refCode = detail?.referenceCode || t('emdash');

    const expenseGrossHalalas =
        collectionMode === 'with_expenses' ? sumExpenseGrossHalalas(expenseLines) : 0;
    const pickupVarianceHal = isReceivedAmountEntered(form.receivedAmount)
        ? pickupVarianceHalalas(
              countedPhysical ?? expectedAmt,
              form.receivedAmount,
              expenseGrossHalalas,
          )
        : null;
    const pickupVariance =
        pickupVarianceHal != null ? halalasToSar(pickupVarianceHal) : null;
    const varianceNeedsNote = pickupVarianceHal != null && pickupVarianceHal !== 0;
    const varianceNoteOk = !varianceNeedsNote || String(varianceNote).trim().length >= 5;
    const expensesValid =
        collectionMode !== 'with_expenses' || stageAExpensesValid(expenseLines);

    const submitDisabled =
        submitting ||
        figuresBlocked ||
        debitFromContext.blocked ||
        alreadyRecorded ||
        !canRecord ||
        !isReceivedAmountEntered(form.receivedAmount) ||
        !varianceNoteOk ||
        !expensesValid;

    const setCollectionModeGuarded = (mode) => {
        if (mode === 'cash_only' && collectionMode === 'with_expenses' && expenseLines.some((ln) => ln.gross)) {
            if (!window.confirm(t('record.mode.clearExpensesConfirm'))) return;
            setExpenseLines([newExpenseLine()]);
        }
        setCollectionMode(mode);
    };

    const reconciliationBadge =
        pickupVarianceHal == null
            ? null
            : pickupVarianceHal > 0
              ? 'short'
              : pickupVarianceHal < 0
                ? 'over'
                : 'exact';

    /* ---------- Collector UI (unchanged layout + My wallet) ---------- */
    if (isCollector) {
        return (
            <div>
                <div className="ws-page-header" style={{ alignItems: 'center' }}>
                    <div>
                        <h2 className="ws-page-title">{t('record.title')}</h2>
                        <p className="ws-page-sub">{t('record.subCollector')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Link to="/locker/my-wallet" className="btn-secondary">
                            {t('record.myWallet')}
                        </Link>
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                loadRequests();
                                if (form.requestId) loadDetail(form.requestId);
                            }}
                            disabled={loading || detailLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <RefreshCw
                                size={14}
                                className={loading || detailLoading ? 'spin' : ''}
                            />{' '}
                            {t('common.refresh')}
                        </button>
                    </div>
                </div>

                {alreadyCollectedBanner ? (
                    <div className="wlk-error" role="alert" style={{ marginBottom: 12 }}>
                        <AlertTriangle size={14} /> {alreadyCollectedBanner}
                    </div>
                ) : null}
                {pageError ? (
                    <div className="wlk-error" role="alert" style={{ marginBottom: 12 }}>
                        <AlertTriangle size={14} /> {pageError}
                    </div>
                ) : null}
                {success ? (
                    <div
                        className="wlk-error"
                        role="status"
                        style={{
                            marginBottom: 12,
                            background: successBannerWarn ? '#fef3c7' : '#dcfce7',
                            color: successBannerWarn ? '#92400e' : '#15803d',
                            borderColor: successBannerWarn ? '#fcd34d' : '#bbf7d0',
                        }}
                    >
                        {successBannerWarn ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}{' '}
                        {successBannerText}
                    </div>
                ) : null}

                <div className="ws-section" style={{ maxWidth: 920, padding: 24 }}>
                    {!requestIdFromUrl ? (
                        <div className="ws-form-grid" style={{ marginBottom: 20 }}>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>{t('record.request')}</label>
                                <SearchSelect
                                    options={requestOptions}
                                    value={form.requestId}
                                    onChange={(v) => onRequestChange(String(v))}
                                    ariaLabel={t('record.request')}
                                    placeholder={t('record.selectRequest')}
                                    emptyHint={t('common.noMatches')}
                                    menuMinWidth={360}
                                />
                            </div>
                        </div>
                    ) : null}
                    {loading ? (
                        <p style={{ color: '#64748b' }}>{t('common.loading')}</p>
                    ) : null}
                    {listError ? null : !loading && requests.length === 0 ? (
                        <p style={{ color: '#94A3B8' }}>{t('record.emptyRequests')}</p>
                    ) : null}
                    {detailLoading ? (
                        <p style={{ color: '#64748b' }}>{t('record.loadingDetail')}</p>
                    ) : null}
                    {detail && !figuresBlocked ? (
                        <>
                            <div style={{ marginBottom: 20 }}>
                                <ClosingRow
                                    label={t('method.cash')}
                                    physical={cashBreakdown.physical}
                                    system={cashBreakdown.system}
                                    diff={cashBreakdown.diff}
                                    hideFigures={figuresBlocked}
                                    editable={canRecord}
                                    value={form.receivedAmount}
                                    onChange={(value) =>
                                        setForm((f) => ({ ...f, receivedAmount: value }))
                                    }
                                />
                                <ClosingRow
                                    label={t('method.bank')}
                                    physical={bankBreakdown.physical}
                                    system={bankBreakdown.system}
                                    diff={bankBreakdown.diff}
                                    hideFigures={figuresBlocked}
                                />
                                <ClosingRow
                                    label={t('method.tabby')}
                                    physical={tabbyBreakdown.physical}
                                    system={tabbyBreakdown.system}
                                    diff={tabbyBreakdown.diff}
                                    hideFigures={figuresBlocked}
                                />
                                <ClosingRow
                                    label={t('method.tamara')}
                                    physical={tamaraBreakdown.physical}
                                    system={tamaraBreakdown.system}
                                    diff={tamaraBreakdown.diff}
                                    hideFigures={figuresBlocked}
                                />
                                <ClosingRow
                                    label={t('method.corporate')}
                                    physical={corporateBreakdown.physical}
                                    system={corporateBreakdown.system}
                                    diff={corporateBreakdown.diff}
                                    hideFigures={figuresBlocked}
                                />
                            </div>
                            {canRecord ? (
                                <>
                                    <fieldset style={{ border: 'none', margin: '12px 0', padding: 0 }}>
                                        <legend style={{ fontWeight: 700, marginBottom: 6 }}>
                                            {t('record.mode.cashOnly')} / {t('record.mode.withExpenses')}
                                        </legend>
                                        <label style={{ display: 'block', marginBottom: 4 }}>
                                            <input
                                                type="radio"
                                                name="collection-mode-collector"
                                                checked={collectionMode === 'cash_only'}
                                                onChange={() => setCollectionModeGuarded('cash_only')}
                                            />{' '}
                                            {t('record.mode.cashOnly')}
                                        </label>
                                        <label style={{ display: 'block' }}>
                                            <input
                                                type="radio"
                                                name="collection-mode-collector"
                                                checked={collectionMode === 'with_expenses'}
                                                onChange={() => setCollectionMode('with_expenses')}
                                            />{' '}
                                            {t('record.mode.withExpenses')}
                                        </label>
                                    </fieldset>
                                    {collectionMode === 'with_expenses' ? (
                                        <CollectionExpenseLines
                                            t={t}
                                            locale={locale}
                                            lines={expenseLines}
                                            setLines={(updater) => {
                                                setExpenseLines(updater);
                                                setConfirmOpen(false);
                                            }}
                                            disabled={submitting}
                                            onError={setError}
                                            idPrefix={isCollector ? 'rc-exp-col' : 'rc-exp-sup'}
                                        />
                                    ) : null}
                                    {reconciliationBadge ? (
                                        <div
                                            style={{
                                                marginTop: 12,
                                                padding: 10,
                                                borderRadius: 8,
                                                background:
                                                    reconciliationBadge === 'short'
                                                        ? '#FEF2F2'
                                                        : reconciliationBadge === 'over'
                                                          ? '#EFF6FF'
                                                          : '#F0FDF4',
                                            }}
                                        >
                                            <strong>
                                                {t(`record.reconciliation.${reconciliationBadge}`)}
                                            </strong>
                                            <span dir="ltr" style={{ marginInlineStart: 8 }}>
                                                {pickupVariance != null ? formatCitMoneyLatn(pickupVariance) : dash}
                                            </span>
                                        </div>
                                    ) : null}
                                    {varianceNeedsNote ? (
                                        <div className="ws-field" style={{ marginTop: 12 }}>
                                            <label>{t('record.varianceNote')}</label>
                                            <textarea
                                                value={varianceNote}
                                                onChange={(e) => setVarianceNote(e.target.value)}
                                                rows={2}
                                                placeholder={t('record.varianceNotePh')}
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                    ) : null}
                                    <label>{t('record.proof')}</label>
                                    <ProofPicker
                                        fileInputRef={fileInputRef}
                                        cameraInputRef={cameraInputRef}
                                        proofFile={proofFile}
                                        proofPreview={proofPreview}
                                        onPick={onPickProof}
                                        onClear={clearProof}
                                    />
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 12,
                                            justifyContent: 'flex-end',
                                            marginTop: 24,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => onRequestChange('')}
                                            disabled={submitting}
                                        >
                                            {t('common.cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-submit"
                                            onClick={tryConfirm}
                                            disabled={submitDisabled}
                                        >
                                            {submitting
                                                ? t('record.recording')
                                                : t('record.submitCollector')}
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </>
                    ) : null}
                </div>
            </div>
        );
    }

    /* ---------- Supervisor / accountant mockup 33 ---------- */
    return (
        <div className="cit-record-page">
            {showBreadcrumb ? (
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 8 }}>
                    <Link to="/workshop/accounting/locker-cash-in-transit">
                        {t('record.breadcrumbCit')}
                    </Link>
                    {' / '}
                    {t('record.breadcrumbRecord')}
                </div>
            ) : null}

            <div className="ws-page-header" style={{ alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 className="ws-page-title" style={{ margin: 0 }}>
                        {t('record.titleSupervisor')}
                    </h2>
                </div>
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                        loadRequests();
                        if (form.requestId) loadDetail(form.requestId);
                    }}
                    disabled={loading || detailLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading || detailLoading ? 'spin' : ''} />{' '}
                    {t('common.refresh')}
                </button>
            </div>

            {alreadyCollectedBanner ? (
                <div className="wlk-error" role="alert" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} /> {alreadyCollectedBanner}
                </div>
            ) : null}
            {pageError ? (
                <div className="wlk-error" role="alert" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} /> {pageError}
                </div>
            ) : null}
            {success ? (
                <div
                    role="status"
                    style={{
                        marginBottom: 12,
                        padding: 10,
                        background: successBannerWarn ? '#fef3c7' : '#dcfce7',
                        color: successBannerWarn ? '#92400e' : '#15803d',
                        borderRadius: 8,
                    }}
                >
                    {successBannerWarn ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}{' '}
                    {successBannerText}
                    {success.collection?.journalId ? (
                        <> · {t('record.jeNo', { id: success.collection.journalId })}</>
                    ) : null}
                </div>
            ) : null}

            <div
                className="cit-record-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 1fr)',
                    gap: 16,
                    alignItems: 'start',
                }}
            >
                <section style={panelStyle}>
                    <div className="ws-field" style={{ marginBottom: 12 }}>
                        <label htmlFor="cit-rec-request">{t('record.request')}</label>
                        <SearchSelect
                            id="cit-rec-request"
                            options={requestOptions}
                            value={form.requestId}
                            onChange={(v) => onRequestChange(String(v))}
                            ariaLabel={t('record.request')}
                            placeholder={t('record.selectRequest')}
                            emptyHint={t('common.noMatches')}
                            menuMinWidth={360}
                        />
                        {loading ? (
                            <p style={{ color: '#64748b', margin: '8px 0 0' }}>
                                {t('common.loading')}
                            </p>
                        ) : null}
                        {listError ? null : !loading && requests.length === 0 ? (
                            <p style={{ color: '#94A3B8', margin: '8px 0 0' }}>
                                {t('record.emptyRequests')}
                            </p>
                        ) : null}
                    </div>

                    {detailLoading ? (
                        <p style={{ color: '#64748b' }}>{t('record.loadingDetail')}</p>
                    ) : null}

                    {!detail && !detailLoading ? (
                        <p style={{ color: '#94A3B8' }}>{t('record.pickHint')}</p>
                    ) : null}

                    {detail ? (
                        <>
                            <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>
                                {t('record.cardTitle', { ref: refCode })}
                            </h3>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                    gap: 10,
                                    marginBottom: 12,
                                }}
                            >
                                {[
                                    {
                                        label: t('record.tile.cashier'),
                                        value: cashierDisplay,
                                    },
                                    {
                                        label: t('record.tile.branch'),
                                        value: detail.branch?.name || detail.branchName || dash,
                                    },
                                    {
                                        label: t('record.tile.session'),
                                        value: posSessionLabel,
                                    },
                                    {
                                        label: t('record.tile.status'),
                                        value: uiStatus,
                                    },
                                    {
                                        label: t('record.tile.sessionOpened'),
                                        value: sessionOpenedAt
                                            ? formatRiyadhDateTime(sessionOpenedAt, stampLang)
                                            : dash,
                                    },
                                    {
                                        label: t('record.tile.sessionClosed'),
                                        value: sessionClosedAt
                                            ? formatRiyadhDateTime(sessionClosedAt, stampLang)
                                            : dash,
                                    },
                                    {
                                        label: t('record.tile.counterClosing'),
                                        value: closingAt
                                            ? formatRiyadhDateTime(closingAt, stampLang)
                                            : dash,
                                    },
                                    {
                                        label: t('record.tile.counted'),
                                        value:
                                            figuresBlocked || countedPhysical == null
                                                ? dash
                                                : `${formatCitMoneyLatn(countedPhysical)} / ${countedSystem != null ? formatCitMoneyLatn(countedSystem) : dash} · ${t('record.tile.diff')} ${countedDiff != null ? formatCitMoneyLatn(countedDiff) : dash}`,
                                    },
                                ].map((tile) => (
                                    <div
                                        key={tile.label}
                                        style={{
                                            border: '1px solid #E2E8F0',
                                            borderRadius: 8,
                                            padding: '10px 12px',
                                            background: '#F8FAFC',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '0.7rem',
                                                color: '#64748B',
                                                marginBottom: 4,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {tile.label}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>
                                            {tile.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {assignedName ? (
                                <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#94A3B8' }}>
                                    {t('record.field.previousAssignee')}: {assignedName}
                                </p>
                            ) : null}

                            {canRecord ? (
                                <>
                                    <div className="ws-field" style={{ marginTop: 14 }}>
                                        <label htmlFor="cit-officer-hold">
                                            {t('record.citOfficerFull')}
                                        </label>
                                        <SearchSelect
                                            id="cit-officer-hold"
                                            options={officerOptions}
                                            value={form.citOfficerUserId}
                                            onChange={(v) => {
                                                setForm((f) => ({
                                                    ...f,
                                                    citOfficerUserId: String(v || ''),
                                                }));
                                                setConfirmOpen(false);
                                            }}
                                            ariaLabel={t('record.citOfficerFull')}
                                            placeholder={t('record.citOfficerPh')}
                                            emptyHint={t('common.noMatches')}
                                            menuMinWidth={280}
                                        />
                                    </div>
                                    <fieldset style={{ border: 'none', margin: '12px 0 0', padding: 0 }}>
                                        <label style={{ display: 'block', marginBottom: 4 }}>
                                            <input
                                                type="radio"
                                                name="collection-mode-supervisor"
                                                checked={collectionMode === 'cash_only'}
                                                onChange={() => setCollectionModeGuarded('cash_only')}
                                            />{' '}
                                            {t('record.mode.cashOnly')}
                                        </label>
                                        <label style={{ display: 'block' }}>
                                            <input
                                                type="radio"
                                                name="collection-mode-supervisor"
                                                checked={collectionMode === 'with_expenses'}
                                                onChange={() => setCollectionMode('with_expenses')}
                                            />{' '}
                                            {t('record.mode.withExpenses')}
                                        </label>
                                    </fieldset>
                                    {citEnabled && debitFromContext.blocked ? (
                                        <div
                                            role="alert"
                                            style={{
                                                marginTop: 10,
                                                padding: 10,
                                                background: '#FEF3C7',
                                                border: '1px solid #F59E0B',
                                                borderRadius: 8,
                                                display: 'flex',
                                                gap: 8,
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <AlertTriangle size={14} />
                                            {t('record.citNotProvisionedNotice')}
                                            {canProvisionCit && form.citOfficerUserId ? (
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => void onProvisionOfficer()}
                                                    disabled={provisioning || provisionApplying}
                                                >
                                                    {t('record.provisionBtn')}
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    {provisionPlan ? (
                                        <div
                                            role="region"
                                            aria-label={t('record.provisionPreviewTitle')}
                                            style={{
                                                marginTop: 10,
                                                padding: 10,
                                                background: '#F8FAFC',
                                                border: '1px solid #CBD5E1',
                                                borderRadius: 8,
                                                fontSize: '0.85rem',
                                            }}
                                        >
                                            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                                                {t('record.provisionPreviewTitle')}
                                            </p>
                                            {provisionPlan.collision ? (
                                                <div role="alert" style={{ margin: '0 0 8px', color: '#B45309' }}>
                                                    <p style={{ margin: '0 0 6px' }}>
                                                        {t('record.provisionCollision')}
                                                    </p>
                                                    <p style={{ margin: '0 0 4px', color: '#92400E' }}>
                                                        {provisionPlan.collision.accountName ||
                                                            provisionPlan.collision.accountCode ||
                                                            '—'}
                                                        {provisionPlan.collision.accountType
                                                            ? ` · ${provisionPlan.collision.accountType}`
                                                            : ''}
                                                        {provisionPlan.collision.postedLineCount != null
                                                            ? ` · ${t('record.provisionPostedLines')}: ${provisionPlan.collision.postedLineCount}`
                                                            : ''}
                                                    </p>
                                                    {provisionPlan.collision.relocateAvailable ? (
                                                        <RelocateCitHeadingPanel t={t} onApplied={onCitRelocated} />
                                                    ) : null}
                                                </div>
                                            ) : provisionPlan.existed ? (
                                                <p style={{ margin: '0 0 8px' }}>
                                                    {t('record.provisionExisted')}
                                                </p>
                                            ) : null}
                                            <p style={{ margin: '0 0 4px' }}>
                                                {provisionPlan.code} — {provisionPlan.name}
                                            </p>
                                            <p style={{ margin: '0 0 4px' }}>
                                                {t('record.provisionParent')}: {provisionPlan.parentCode}{' '}
                                                {provisionPlan.parentName}
                                            </p>
                                            <p style={{ margin: '0 0 4px' }}>
                                                {t('record.provisionType')}: {provisionPlan.type || 'ASSET'}
                                            </p>
                                            <p style={{ margin: '0 0 4px' }}>
                                                {t('record.provisionWorkshop')}: {provisionPlan.workshopId}
                                            </p>
                                            <p style={{ margin: '0 0 4px' }}>
                                                {t('record.provisionBranch')}:{' '}
                                                {provisionPlan.branchId || t('record.provisionNone')}
                                            </p>
                                            <p style={{ margin: '0 0 8px' }}>
                                                {t('record.provisionOfficer')}:{' '}
                                                {provisionPlan.officerName ||
                                                    selectedOfficer?.name ||
                                                    provisionPlan.officerUserId}
                                            </p>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    onClick={() => setProvisionPlan(null)}
                                                    disabled={provisionApplying}
                                                >
                                                    {t('record.provisionCancel')}
                                                </button>
                                                {!provisionPlan.collision ? (
                                                    <button
                                                        type="button"
                                                        className="btn-submit btn-dark"
                                                        onClick={() => void onApplyProvision()}
                                                        disabled={provisionApplying}
                                                    >
                                                        {t('record.provisionApply')}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className="ws-field" style={{ marginTop: 10 }}>
                                        <label htmlFor="cit-received">
                                            {t('record.receivedSar')}
                                        </label>
                                        <input
                                            id="cit-received"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.receivedAmount}
                                            onChange={(e) => {
                                                setForm((f) => ({
                                                    ...f,
                                                    receivedAmount: e.target.value,
                                                }));
                                                setConfirmOpen(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                height: 36,
                                                borderRadius: 8,
                                                border: '1px solid #CBD5E1',
                                                padding: '0 10px',
                                            }}
                                        />
                                    </div>
                                    {collectionMode === 'with_expenses' ? (
                                        <CollectionExpenseLines
                                            t={t}
                                            locale={locale}
                                            lines={expenseLines}
                                            setLines={(updater) => {
                                                setExpenseLines(updater);
                                                setConfirmOpen(false);
                                            }}
                                            disabled={submitting}
                                            onError={setError}
                                            idPrefix={isCollector ? 'rc-exp-col' : 'rc-exp-sup'}
                                        />
                                    ) : null}
                                    {reconciliationBadge ? (
                                        <div
                                            style={{
                                                marginTop: 12,
                                                padding: 10,
                                                borderRadius: 8,
                                                background:
                                                    reconciliationBadge === 'short'
                                                        ? '#FEF2F2'
                                                        : reconciliationBadge === 'over'
                                                          ? '#EFF6FF'
                                                          : '#F0FDF4',
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                                {t('record.reconciliation.title')}
                                            </div>
                                            <strong>
                                                {t(`record.reconciliation.${reconciliationBadge}`)}
                                            </strong>
                                            <span dir="ltr" style={{ marginInlineStart: 8 }}>
                                                {pickupVariance != null ? formatCitMoneyLatn(pickupVariance) : dash}
                                            </span>
                                        </div>
                                    ) : null}
                                    {varianceNeedsNote ? (
                                        <div className="ws-field" style={{ marginTop: 10 }}>
                                            <label>{t('record.varianceNote')}</label>
                                            <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#64748B' }}>
                                                {t('record.varianceNoteRequired')}
                                            </p>
                                            <textarea
                                                value={varianceNote}
                                                onChange={(e) => setVarianceNote(e.target.value)}
                                                rows={2}
                                                placeholder={t('record.varianceNotePh')}
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                    ) : null}
                                    {citEnabled ? (
                                    <label
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            marginTop: 10,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={Boolean(form.receiveIntoVaultNow)}
                                            onChange={(e) => {
                                                setForm((f) => ({
                                                    ...f,
                                                    receiveIntoVaultNow: e.target.checked,
                                                }));
                                                setConfirmOpen(false);
                                            }}
                                        />
                                        {t('record.receiveVaultNowFull')}
                                    </label>
                                    ) : null}
                                    <div style={{ marginTop: 12 }}>
                                        <label>{t('record.proof')}</label>
                                        <ProofPicker
                                            fileInputRef={fileInputRef}
                                            cameraInputRef={cameraInputRef}
                                            proofFile={proofFile}
                                            proofPreview={proofPreview}
                                            onPick={onPickProof}
                                            onClear={clearProof}
                                        />
                                    </div>

                                    {!confirmOpen ? (
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 8,
                                                marginTop: 16,
                                                justifyContent: 'flex-end',
                                            }}
                                        >
                                            <button
                                                type="button"
                                                className="btn-portal-outline"
                                                onClick={() => onRequestChange('')}
                                                disabled={submitting}
                                            >
                                                {t('common.cancel')}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-submit btn-dark"
                                                onClick={tryConfirm}
                                                disabled={submitDisabled}
                                            >
                                                {t('record.btnRecord')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={confirmBar} role="group">
                                            <p style={{ margin: '0 0 8px' }}>
                                                {form.receiveIntoVaultNow
                                                    ? t('record.confirmReceive')
                                                    : t('record.confirmPost')}
                                            </p>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    onClick={() => setConfirmOpen(false)}
                                                    disabled={submitting}
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-submit btn-dark"
                                                    onClick={() => void doSubmit()}
                                                    disabled={submitDisabled}
                                                >
                                                    {submitting
                                                        ? t('record.recording')
                                                        : t('record.btnRecord')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </>
                    ) : null}
                </section>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <section style={panelStyle}>
                        <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>
                            {t('record.journalsTitle')}
                        </h3>
                        {contextError ? (
                            <p role="alert" style={{ color: '#B45309', margin: 0, fontSize: '0.85rem' }}>
                                {contextError}
                            </p>
                        ) : journalPreview.previewError || journalPreview.blocked ? (
                            <div role="alert" style={{ margin: 0 }}>
                                <p style={{ color: '#B45309', margin: '0 0 6px', fontSize: '0.85rem' }}>
                                    {blockedReasonText(journalPreview) ||
                                        t(
                                            lockerCitErrorI18nKey({
                                                code: journalPreview.previewError,
                                            }) || 'record.journalsBlocked',
                                        )}
                                </p>
                                {journalPreview.blocked?.actionKey === 'relocateCit' ? (
                                    <RelocateCitHeadingPanel t={t} onApplied={onCitRelocated} />
                                ) : null}
                            </div>
                        ) : journalBundles.length === 0 ? (
                            <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.85rem' }}>
                                {t('record.journalsEmpty')}
                            </p>
                        ) : (
                            <>
                                <p
                                    style={{
                                        margin: '0 0 8px',
                                        fontSize: '0.8rem',
                                        color: journalPreview.balanced ? '#15803D' : '#DC2626',
                                        fontWeight: 600,
                                    }}
                                >
                                    {journalPreview.balanced
                                        ? t('record.journalsBalanced')
                                        : t('record.journalsUnbalanced')}
                                </p>
                                {journalBundles.map((journal) => (
                                    <div key={journal.journalNo} style={{ marginBottom: 12 }}>
                                        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '0.85rem' }}>
                                            {t('record.journals.jeHeading', {
                                                no: journal.journalNo,
                                                title: journal.title || '',
                                            })}
                                        </p>
                                        <WsTableScroll>
                                            <table className="ws-table">
                                                <thead>
                                                    <tr>
                                                        <th className="table-th" style={{ width: 48 }}>
                                                            {t('record.journals.side')}
                                                        </th>
                                                        <th className="table-th">
                                                            {t('record.journals.account')}
                                                        </th>
                                                        <th className="table-th">
                                                            {t('record.journals.branchCol')}
                                                        </th>
                                                        <th className="table-th" style={{ textAlign: 'end' }}>
                                                            {t('record.journals.amount')}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(journal.lines || []).map((line, i) => (
                                                        <tr key={i}>
                                                            <td className="table-cell">{line.side}</td>
                                                            <td className="table-cell">
                                                                {lineAccountLabel(line)}
                                                            </td>
                                                            <td className="table-cell">
                                                                {line.branchLabel || dash}
                                                            </td>
                                                            <td
                                                                className="table-cell"
                                                                style={{ textAlign: 'end' }}
                                                            >
                                                                {formatCitMoneyLatn(line.amount)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </WsTableScroll>
                                    </div>
                                ))}
                            </>
                        )}
                    </section>

                    <section
                        style={{
                            ...panelStyle,
                            background: '#EFF6FF',
                            borderColor: '#BFDBFE',
                            fontSize: '0.85rem',
                            color: '#1E3A8A',
                            lineHeight: 1.45,
                        }}
                    >
                        {t('record.rulesNote')}
                    </section>

                    <section style={panelStyle}>
                        <ApprovalsScreen
                            selectedBranchId={selectedBranchId}
                            branchLockedId={branchLockedId}
                            embedded
                            requestIdFromUrl={
                                form.requestId || requestIdFromUrl || undefined
                            }
                        />
                    </section>
                </div>
            </div>

            <style>{`
                @media (max-width: 1100px) {
                  .cit-record-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}
