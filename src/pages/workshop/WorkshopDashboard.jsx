import './workshopDashboard.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Users, Package, Wrench, TrendingUp, Building2, RefreshCw } from 'lucide-react';
import { buildProofHref } from '../../components/accounting/reports/reportProofLinks';
import { DASHBOARD_KPI_PROOF } from '../../components/accounting/reports/tbBsProofKeys';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { qs, branchScopeParams } from '../../services/workshopStaffApi';
import { ShimmerKpiGrid } from '../../components/supplier/Shimmer';
import { wsDashT } from '../../utils/workshopDashboardI18n';
import {
    INV_COST_BASIS_WEIGHTED,
    parseInventoryCostBasisParam,
    pickLowStockApiCount,
    wiT,
} from '../../utils/workshopInventoryI18n';
import {
    addCalendarDaysYmd,
    dashboardLedgerCalendarDates,
    inclusiveCalendarRangeToInclusiveMidnight,
    riyadhRangeToApiIso,
    workshopDashboardRangeQueryParams,
} from '../../utils/riyadhBusinessRange';
import SelectCombo from '../../components/SelectCombo';
import { getPLReport } from '../../services/accountsApi';
import DashboardKpiCards from './dashboardKpiCards';
import WorkshopDashboardCharts from './WorkshopDashboardCharts';
import { dashboardPeriodRange, mapDashboardKpiCards, previousRiyadhYmdWindow, riyadhYmd } from './dashboardKpiMapper';
import {
    saveWorkshopAdminDatetimeRange,
    clearWorkshopAdminDatetimeRange,
} from './workshopAdminDatetimeRange';
import {
    isStaleLoad,
    kpiSummaryQueryParams,
    loadDashboardAccountingBasis,
    nextLoadGen,
    parseAccountingBasis,
    plBasisQueryParams,
    resolveAuthorizedBranchId,
    saveDashboardAccountingBasis,
    unwrapKpiSummary,
    unwrapPlPayload,
} from './workshopDashboardScope';
import {
    DASH_SERIES_REFRESH_MS,
    coerceDashboardGrain,
    dashboardAllowedGrains,
    dashboardContextKey,
    dashboardSeriesQueryParams,
    formatRiyadhDateTime,
    isSeriesContextMatch,
    lowStockPanelState,
    paymentMethodKey,
    shouldSkipHiddenRefresh,
    isLiveDashboardRange,
} from './workshopDashboardSeries';

export default function WorkshopDashboard({
    onTabChange,
    selectedBranchId = 'all',
    branches = [],
    onBranchChange,
    branchLocked = false,
    onLowStockAlertsChange,
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wsDashT(locale, key, vars), [locale]);
    const tInventoryCostBasis = useCallback((key, vars) => wiT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const costBasis = parseInventoryCostBasisParam(searchParams.get('costBasis'), INV_COST_BASIS_WEIGHTED);
    const setCostBasis = useCallback((next) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('costBasis', parseInventoryCostBasisParam(next, INV_COST_BASIS_WEIGHTED));
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams]);
    const { hasPermission } = useAuth();
    const canReadLedgerKpis = hasPermission('workshop.accounting.chart-of-accounts.profit-loss');
    const toNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [rangeError, setRangeError] = useState('');
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [series, setSeries] = useState(null);
    const [seriesError, setSeriesError] = useState('');
    const [seriesLoading, setSeriesLoading] = useState(false);
    const [seriesFreshAt, setSeriesFreshAt] = useState('');
    const [seriesBoundKey, setSeriesBoundKey] = useState('');
    const [dashBoundKey, setDashBoundKey] = useState('');
    const [dashUnauthorized, setDashUnauthorized] = useState(false);
    const [vatMode, setVatMode] = useState('ex');
    const [grain, setGrain] = useState('daily');
    // Draft = inputs; applied = what the API uses. Always opens on Today (Riyadh);
    // a wider range is used only after the user picks a preset or clicks Apply
    // (a range saved by another page is not restored here — it made the dashboard
    // open on, and keep refreshing, large historical windows).
    const [initialToday] = useState(() => {
        const p = dashboardPeriodRange('today');
        return inclusiveCalendarRangeToInclusiveMidnight(p.dateFrom, p.dateTo);
    });
    const [draftRangeFrom, setDraftRangeFrom] = useState(initialToday.dateFrom);
    const [draftRangeTo, setDraftRangeTo] = useState(initialToday.dateTo);
    const [appliedRangeFrom, setAppliedRangeFrom] = useState(initialToday.dateFrom);
    const [appliedRangeTo, setAppliedRangeTo] = useState(initialToday.dateTo);
    const [periodPreset, setPeriodPreset] = useState('today');
    const [compareMode, setCompareMode] = useState('previous');
    const [kpiSummary, setKpiSummary] = useState(null);
    const [kpiSummaryError, setKpiSummaryError] = useState('');
    const [valuationSummary, setValuationSummary] = useState(null);
    const [plLedger, setPlLedger] = useState(null);
    const [plLedgerError, setPlLedgerError] = useState('');
    const [accountingBasis, setAccountingBasis] = useState(() => loadDashboardAccountingBasis());
    const dashLoadGenRef = useRef(0);
    const seriesLoadGenRef = useRef(0);
    const seriesAbortRef = useRef(null);
    const seriesInFlightRef = useRef(false);

    const rangeDirty =
        draftRangeFrom !== appliedRangeFrom || draftRangeTo !== appliedRangeTo;

    const loadDashboard = useCallback(async () => {
        const gen = nextLoadGen(dashLoadGenRef);
        setIsLoading(true);
        setLoadError('');
        // Declared outside try so the catch below can mark this load dropped
        // (it was block-scoped inside try, so the catch threw a ReferenceError).
        let dropped = false;
        try {
            const isAll = !selectedBranchId || selectedBranchId === 'all';
            const params = { kpi: 'headline' };
            if (!isAll) params.branchId = String(selectedBranchId);
            if (appliedRangeFrom && appliedRangeTo) {
                Object.assign(
                    params,
                    workshopDashboardRangeQueryParams(appliedRangeFrom, appliedRangeTo),
                );
            }
            const ymd = dashboardLedgerCalendarDates(appliedRangeFrom, appliedRangeTo);
            const ledgerParams = kpiSummaryQueryParams({
                dateFrom: ymd.dateFrom,
                dateTo: ymd.dateTo,
                branchId: selectedBranchId,
            });
            const valParams = { costBasis };
            if (!isAll) valParams.branchId = String(selectedBranchId);
            if (ymd.dateTo) valParams.asOf = ymd.dateTo;
            const basis = parseAccountingBasis(accountingBasis);

            const dashP = apiFetch(`/workshop-staff/dashboard${qs(params)}`).catch((err) => err);
            const valP = apiFetch(`/workshop-staff/inventory-valuation-summary${qs(valParams)}`).catch(() => null);
            const kpiP = canReadLedgerKpis
                ? apiFetch(`/accounts/kpi-summary${qs(ledgerParams)}`).then(
                    (value) => ({ ok: true, value }),
                    (error) => ({ ok: false, error }),
                )
                : Promise.resolve({ ok: true, value: null });
            const plP = canReadLedgerKpis && ymd.dateFrom && ymd.dateTo
                ? getPLReport(plBasisQueryParams({
                    dateFrom: ymd.dateFrom,
                    dateTo: ymd.dateTo,
                    branchId: selectedBranchId,
                    basis,
                    compare: null,
                })).then(
                    (value) => ({ ok: true, value }),
                    (error) => ({ ok: false, error }),
                )
                : Promise.resolve({ ok: true, value: null });

            const bound = dashboardContextKey({
                branchId: selectedBranchId,
                rangeFrom: appliedRangeFrom,
                rangeTo: appliedRangeTo,
                basis: parseAccountingBasis(accountingBasis),
            });
            const still = () => !dropped && !isStaleLoad(dashLoadGenRef, gen);

            // Valuation and P&L fill their own cards when they return.
            // The sales row paints as soon as the dashboard payload arrives.
            const valDone = valP.then((valRes) => {
                if (!still()) return;
                setValuationSummary(valRes && typeof valRes === 'object' ? (valRes.data && !Array.isArray(valRes.data) ? valRes.data : valRes) : null);
            });
            const plDone = plP.then(async (plRes) => {
                if (!still()) return;
                const current = unwrapPlPayload(plRes?.ok ? plRes.value : null);
                setPlLedger(current);
                setPlLedgerError(plRes?.ok ? '' : (plRes?.error?.message || t('error.plLedger')));
                if (!current || !ymd.dateFrom || !ymd.dateTo) return;
                const prevWin = previousRiyadhYmdWindow(ymd.dateFrom, ymd.dateTo);
                if (!prevWin.from || !prevWin.to) return;
                try {
                    const prevRes = await getPLReport(plBasisQueryParams({
                        dateFrom: prevWin.from,
                        dateTo: prevWin.to,
                        branchId: selectedBranchId,
                        basis,
                        compare: null,
                    }));
                    if (!still()) return;
                    const prev = unwrapPlPayload(prevRes);
                    if (!prev) return;
                    setPlLedger((cur) => cur ? {
                        ...cur,
                        comparison: {
                            netRevenue: prev.netRevenue,
                            grossProfit: prev.grossProfit,
                            totalOperatingExpenses: prev.totalOperatingExpenses,
                            totalOtherExpenses: prev.totalOtherExpenses,
                            netIncome: prev.netIncome,
                        },
                    } : cur);
                } catch {
                    // The SAR amounts stay. The versus-last-month percent stays blank.
                }
            });

            const response = await dashP;
            if (!still()) return;
            if (response instanceof Error) {
                const status = Number(response.status);
                if (status === 404 || status === 403) {
                    setDashUnauthorized(status === 403);
                    setDashboardData({});
                    setDashBoundKey(bound);
                } else {
                    setDashboardData(null);
                    setDashBoundKey('');
                    throw new Error(response.message || t('error.load'));
                }
            } else if (response?.success) {
                setDashUnauthorized(false);
                setDashboardData(response);
                setDashBoundKey(bound);
            } else {
                setDashUnauthorized(false);
                setDashboardData(response && typeof response === 'object' ? response : {});
                setDashBoundKey(bound);
            }
            setIsLoading(false);

            const kpiRes = await kpiP;
            if (!still()) return;
            setKpiSummary(unwrapKpiSummary(kpiRes?.ok ? kpiRes.value : null));
            setKpiSummaryError(kpiRes?.ok ? '' : (kpiRes?.error?.message || t('error.kpiSummary')));
            await Promise.all([valDone, plDone]);
        } catch (error) {
            dropped = true;
            if (isStaleLoad(dashLoadGenRef, gen)) return;
            setLoadError(error.message || t('error.load'));
            setDashboardData(null);
            setDashBoundKey('');
            setDashUnauthorized(false);
            setKpiSummary(null);
            setKpiSummaryError('');
            setValuationSummary(null);
            setPlLedger(null);
            setPlLedgerError('');
        } finally {
            if (!isStaleLoad(dashLoadGenRef, gen)) setIsLoading(false);
        }
    }, [selectedBranchId, appliedRangeFrom, appliedRangeTo, canReadLedgerKpis, accountingBasis, costBasis, t]);

    const applyDateRange = useCallback(() => {
        setRangeError('');
        const from = String(draftRangeFrom || '').trim();
        const to = String(draftRangeTo || '').trim();
        if (!from && !to) {
            setAppliedRangeFrom('');
            setAppliedRangeTo('');
            clearWorkshopAdminDatetimeRange();
            return;
        }
        if (!from || !to) {
            setRangeError(t('error.rangeBoth'));
            return;
        }
        try {
            riyadhRangeToApiIso(from, to);
        } catch (e) {
            setRangeError(e?.message || t('error.rangeInvalid'));
            return;
        }
        setAppliedRangeFrom(from);
        setAppliedRangeTo(to);
        saveWorkshopAdminDatetimeRange({ dateFrom: from, dateTo: to });
    }, [draftRangeFrom, draftRangeTo, t]);

    const applyPreset = useCallback((id) => {
        setPeriodPreset(id);
        if (id === 'custom') return;
        const p = dashboardPeriodRange(id);
        const dt = inclusiveCalendarRangeToInclusiveMidnight(p.dateFrom, p.dateTo);
        setDraftRangeFrom(dt.dateFrom);
        setDraftRangeTo(dt.dateTo);
        setAppliedRangeFrom(dt.dateFrom);
        setAppliedRangeTo(dt.dateTo);
        setRangeError('');
        saveWorkshopAdminDatetimeRange({ dateFrom: dt.dateFrom, dateTo: dt.dateTo });
        try {
            const q = workshopDashboardRangeQueryParams(dt.dateFrom, dt.dateTo);
            const calendar = Boolean(q.dateFrom && q.dateTo && !q.startDate);
            // Presets stay on the invoice_date calendar day (Riyadh midnight),
            // not the 07:00–06:59 operational day. These ISO strings only size the grain.
            const startIso = q.startDate || (q.dateFrom ? `${q.dateFrom}T00:00:00+03:00` : '');
            const endIso = q.endDate || (q.dateTo ? `${addCalendarDaysYmd(q.dateTo, 1)}T00:00:00+03:00` : '');
            const allowed = dashboardAllowedGrains({
                startIso,
                endIso,
                instantWindow: !calendar,
            });
            setGrain(allowed[0] || 'daily');
        } catch {
            /* keep current grain */
        }
    }, []);

    const rangeParams = useMemo(() => {
        if (!appliedRangeFrom || !appliedRangeTo) return {};
        try {
            return workshopDashboardRangeQueryParams(appliedRangeFrom, appliedRangeTo);
        } catch {
            return {};
        }
    }, [appliedRangeFrom, appliedRangeTo]);

    const allowedGrains = useMemo(() => {
        const calendar = Boolean(rangeParams.dateFrom && rangeParams.dateTo && !rangeParams.startDate);
        // Same invoice_date midnight basis as applyPreset. June stays 678,584.89.
        const startIso = rangeParams.startDate || (rangeParams.dateFrom ? `${rangeParams.dateFrom}T00:00:00+03:00` : '');
        const endIso = rangeParams.endDate || (rangeParams.dateTo ? `${addCalendarDaysYmd(rangeParams.dateTo, 1)}T00:00:00+03:00` : '');
        if (!startIso || !endIso) return ['daily', 'monthly'];
        return dashboardAllowedGrains({
            startIso,
            endIso,
            instantWindow: !calendar,
        });
    }, [rangeParams]);

    const effectiveGrain = coerceDashboardGrain(grain, allowedGrains);

    const loadSeries = useCallback(async ({ quiet = false } = {}) => {
        const gen = nextLoadGen(seriesLoadGenRef);
        if (seriesAbortRef.current) seriesAbortRef.current.abort();
        const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
        seriesAbortRef.current = ac;
        seriesInFlightRef.current = true;
        if (!quiet) setSeriesLoading(true);
        setSeriesError('');
        try {
            const params = dashboardSeriesQueryParams({
                rangeParams,
                branchId: selectedBranchId,
                grain: effectiveGrain,
                compare: compareMode,
            });
            const response = await apiFetch(`/workshop-staff/dashboard/series${qs(params)}`, ac ? { signal: ac.signal } : {});
            if (isStaleLoad(seriesLoadGenRef, gen)) return;
            if (response instanceof Error) {
                throw new Error(response.message || t('error.seriesLoad'));
            }
            if (!response || response.success === false) {
                throw new Error(t('error.seriesLoad'));
            }
            const expected = {
                branchId: selectedBranchId,
                grain: effectiveGrain,
                compare: compareMode === 'none' ? 'none' : 'previous',
                rangeStart: response.rangeStart,
                rangeEnd: response.rangeEnd,
            };
            if (!isSeriesContextMatch(response, expected)) {
                setSeries(null);
                setSeriesBoundKey('');
                setSeriesError(t('charts.stale'));
                return;
            }
            setSeries(response);
            setSeriesBoundKey(dashboardContextKey({
                branchId: selectedBranchId,
                rangeFrom: appliedRangeFrom,
                rangeTo: appliedRangeTo,
                grain: response.grain || effectiveGrain,
                compare: compareMode,
            }));
            setSeriesFreshAt(response.generatedAt || '');
            if (response.grain && response.grain !== grain) setGrain(response.grain);
        } catch (error) {
            if (error?.name === 'AbortError') return;
            if (isStaleLoad(seriesLoadGenRef, gen)) return;
            setSeriesError(error.message || t('error.seriesLoad'));
            setSeries(null);
            setSeriesBoundKey('');
            setSeriesFreshAt('');
        } finally {
            if (!isStaleLoad(seriesLoadGenRef, gen)) {
                setSeriesLoading(false);
                seriesInFlightRef.current = false;
            }
        }
    }, [rangeParams, selectedBranchId, effectiveGrain, compareMode, grain, t]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        loadSeries();
        return () => {
            if (seriesAbortRef.current) seriesAbortRef.current.abort();
        };
    }, [loadSeries]);

    useEffect(() => {
        const tick = () => {
            if (shouldSkipHiddenRefresh(document.visibilityState)) return;
            if (seriesInFlightRef.current) return;
            // Past ranges cannot change — load once, do not poll (checked per tick
            // so a range ending today stops polling after Riyadh midnight).
            const rangeTo = dashboardLedgerCalendarDates(appliedRangeFrom, appliedRangeTo)?.dateTo;
            if (!isLiveDashboardRange(rangeTo, riyadhYmd())) return;
            loadSeries({ quiet: true });
        };
        const onVis = () => {
            if (document.visibilityState === 'visible') tick();
        };
        const id = setInterval(tick, DASH_SERIES_REFRESH_MS);
        document.addEventListener('visibilitychange', onVis);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [loadSeries, appliedRangeFrom, appliedRangeTo]);

    useEffect(() => {
        if (!dashboardData || !Array.isArray(dashboardData.lowStockItems)) return;
        const n = pickLowStockApiCount(dashboardData);
        if (n != null) onLowStockAlertsChange?.(n);
    }, [dashboardData, onLowStockAlertsChange]);

    const loadPendingApprovalsCount = useCallback(async () => {
        try {
            const branch = branchScopeParams(selectedBranchId);
            const [pettyRes, supplierRes] = await Promise.all([
                apiFetch(
                    `/workshop-staff/petty-cash/requests${qs({
                        limit: 1,
                        offset: 0,
                        queue: 'all',
                        status: 'pending',
                        ...branch,
                    })}`,
                ),
                apiFetch(
                    `/workshop-staff/supplier-sales-invoices${qs({
                        limit: 1,
                        offset: 0,
                        ...branch,
                    })}`,
                ).catch(() => ({ success: false, total: 0 })),
            ]);
            const petty = pettyRes?.success ? Number(pettyRes.total) || 0 : 0;
            const sup = supplierRes?.success ? Number(supplierRes.total) || 0 : 0;
            setPendingApprovalsCount(petty + sup);
        } catch {
            setPendingApprovalsCount(0);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadPendingApprovalsCount();
    }, [loadPendingApprovalsCount]);

    useEffect(() => {
        const handleApprovalsUpdated = () => {
            loadPendingApprovalsCount();
        };

        window.addEventListener('workshop-approvals-updated', handleApprovalsUpdated);
        return () => {
            window.removeEventListener('workshop-approvals-updated', handleApprovalsUpdated);
        };
    }, [loadPendingApprovalsCount]);

    const dashCurrentKey = dashboardContextKey({
        branchId: selectedBranchId,
        rangeFrom: appliedRangeFrom,
        rangeTo: appliedRangeTo,
        basis: parseAccountingBasis(accountingBasis),
    });
    const seriesCurrentKey = dashboardContextKey({
        branchId: selectedBranchId,
        rangeFrom: appliedRangeFrom,
        rangeTo: appliedRangeTo,
        grain: effectiveGrain,
        compare: compareMode,
    });
    const dashLive = dashBoundKey === dashCurrentKey ? dashboardData : null;
    const seriesLive = seriesBoundKey === seriesCurrentKey ? series : null;
    const seriesStale = Boolean(series && !seriesLive);

    const branchPerformance = dashLive?.branchPerformance || [];
    const mappedKpis = useMemo(
        () => {
            const ymd = dashboardLedgerCalendarDates(appliedRangeFrom, appliedRangeTo);
            const branchName = !selectedBranchId || selectedBranchId === 'all'
                ? ''
                : (branches.find((b) => String(b.id) === String(selectedBranchId))?.name || '');
            return mapDashboardKpiCards({
                dashboard: dashLive,
                kpiSummary,
                valuation: valuationSummary,
                canReadLedger: canReadLedgerKpis,
                compare: compareMode,
                dateTo: ymd.dateTo,
                branchName,
                basis: accountingBasis,
                plLedger,
                kpiError: kpiSummaryError,
                plError: plLedgerError,
            });
        },
        [dashLive, kpiSummary, valuationSummary, canReadLedgerKpis, compareMode, appliedRangeFrom, appliedRangeTo, selectedBranchId, branches, accountingBasis, plLedger, kpiSummaryError, plLedgerError],
    );
    const compareWindow = useMemo(() => {
        const ymd = dashboardLedgerCalendarDates(appliedRangeFrom, appliedRangeTo);
        return previousRiyadhYmdWindow(ymd.dateFrom, ymd.dateTo);
    }, [appliedRangeFrom, appliedRangeTo]);

    const lowStockRows = useMemo(() => {
        const api = dashLive?.lowStockItems;
        if (!Array.isArray(api)) return [];
        return api.map((p) => ({
            id: `${p.branchId || ''}-${p.productId || p.name}`,
            name: p.name,
            stock_qty: p.qty,
            critical_level: p.criticalQty,
            branchName: p.branchName,
        }));
    }, [dashLive]);
    const lowStockState = lowStockPanelState({
        loading: isLoading,
        error: Boolean(loadError),
        unauthorized: dashUnauthorized,
        items: dashLive ? dashLive.lowStockItems : undefined,
        contextMatch: Boolean(dashLive) && dashBoundKey === dashCurrentKey,
    });

    const paymentRows = seriesLive?.paymentMethods?.rows || [];

    useEffect(() => {
        if (!allowedGrains.includes(grain)) setGrain(effectiveGrain);
    }, [allowedGrains, grain, effectiveGrain]);

    const handleKpiDrillDown = useCallback(
        (card) => {
            const proof = DASHBOARD_KPI_PROOF[card?.id];
            if (proof) {
                const ymd = dashboardLedgerCalendarDates(appliedRangeFrom, appliedRangeTo);
                const branchId =
                    !selectedBranchId || selectedBranchId === 'all'
                        ? ''
                        : String(selectedBranchId);
                navigate(
                    buildProofHref({
                        report: proof.report,
                        key: proof.key,
                        filters: {
                            dateFrom: ymd.dateFrom,
                            dateTo: ymd.dateTo,
                            branchId,
                            basis: parseAccountingBasis(accountingBasis),
                        },
                        column: 'total',
                        backHref: `${location.pathname}${location.search}`,
                    }),
                );
                return;
            }
            const tab = card?.drillDownTab;
            if (!tab) return;
            if (appliedRangeFrom && appliedRangeTo) {
                saveWorkshopAdminDatetimeRange({ dateFrom: appliedRangeFrom, dateTo: appliedRangeTo });
            }
            onTabChange?.(tab);
        },
        [
            appliedRangeFrom,
            appliedRangeTo,
            location.pathname,
            location.search,
            navigate,
            onTabChange,
            selectedBranchId,
            accountingBasis,
        ],
    );

    const handleBranchSelect = useCallback(
        (raw) => {
            if (branchLocked || typeof onBranchChange !== 'function') return;
            const next = resolveAuthorizedBranchId(raw, {
                branches,
                lockedId: branchLocked ? selectedBranchId : null,
                allowAll: !branchLocked,
            });
            if (next == null) return;
            onBranchChange(next);
        },
        [branchLocked, branches, onBranchChange, selectedBranchId],
    );

    const handleBasisSelect = useCallback((raw) => {
        const next = saveDashboardAccountingBasis(raw);
        setAccountingBasis(next);
        if (next !== 'cash') setPlLedger(null);
    }, []);
    const quickActions = [
        { label: t('quick.employees'), tab: 'employees', Icon: Users },
        { label: t('quick.departments'), tab: 'departments', Icon: Package },
        { label: t('quick.approvals'), tab: 'approvals', badge: pendingApprovalsCount, Icon: ClipboardCheck },
        { label: t('quick.suppliers'), tab: 'suppliers', Icon: Wrench },
        { label: t('quick.reports'), tab: 'reports', Icon: TrendingUp },
        { label: t('quick.branches'), tab: 'branches', Icon: Building2 },
    ];
    return (
        <div className="ws-dashboard">
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('title')}</h2>
                    <p className="ws-page-sub">{t('subtitle')}</p>
                </div>
                <button
                    type="button"
                    className="btn-portal wsd-refresh"
                    onClick={() => {
                        loadDashboard();
                        loadSeries();
                        loadPendingApprovalsCount();
                    }}
                    disabled={isLoading || seriesLoading}
                >
                    <RefreshCw size={15}/> {isLoading || seriesLoading ? t('refreshing') : t('refresh')}
                </button>
            </div>

            <div className="wsd-bar">
                <div className="wsd-seg" role="tablist" aria-label={t('period.aria')}>
                    {['today', 'this_week', 'this_month', 'custom'].map((id) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={periodPreset === id}
                            className={`wsd-seg__btn${periodPreset === id ? ' wsd-seg__btn--active' : ''}`}
                            onClick={() => applyPreset(id)}
                        >
                            {t(`period.${id === 'this_week' ? 'thisWeek' : id === 'this_month' ? 'thisMonth' : id}`)}
                        </button>
                    ))}
                </div>
                {periodPreset === 'custom' ? (
                    <>
                        <label>
                            {t('filter.from')}
                            <input
                                type="datetime-local"
                                value={draftRangeFrom}
                                onChange={(e) => {
                                    setPeriodPreset('custom');
                                    setDraftRangeFrom(e.target.value);
                                }}
                                step={60}
                                aria-label={t('label.fromDatetime')}
                                title="Asia/Riyadh"
                            />
                        </label>
                        <label>
                            {t('filter.to')}
                            <input
                                type="datetime-local"
                                value={draftRangeTo}
                                onChange={(e) => {
                                    setPeriodPreset('custom');
                                    setDraftRangeTo(e.target.value);
                                }}
                                step={60}
                                aria-label={t('label.toDatetime')}
                                title="Asia/Riyadh"
                            />
                        </label>
                    </>
                ) : null}
                <label>
                    {t('compare.aria')}
                    <SelectCombo
                        size="sm"
                        aria-label={t('compare.aria')}
                        value={compareMode}
                        onChange={(e) => setCompareMode(e.target.value)}
                        title={compareMode === 'previous' ? t('compare.previous', { from: compareWindow.from || '—', to: compareWindow.to || '—' }) : t('compare.none')}
                    >
                        <option value="previous">{t('compare.previousShort')}</option>
                        <option value="none">{t('compare.none')}</option>
                    </SelectCombo>
                </label>
                <label>
                    {t('filter.branch')}
                    <SelectCombo
                        size="sm"
                        aria-label={t('filter.branch')}
                        value={selectedBranchId || 'all'}
                        disabled={branchLocked || typeof onBranchChange !== 'function'}
                        title={branchLocked ? t('filter.branchLocked') : t('filter.branch')}
                        onChange={(e) => handleBranchSelect(e.target.value)}
                    >
                        {!branchLocked ? <option value="all">{t('filter.allBranches')}</option> : null}
                        {(branches || []).map((b) => (
                            <option key={String(b.id)} value={String(b.id)}>{b.name}</option>
                        ))}
                    </SelectCombo>
                </label>
                <label title={canReadLedgerKpis ? t('filter.basisTitle') : t('filter.basisNoLedger')}>
                    {t('filter.basis')}
                    <SelectCombo
                        size="sm"
                        aria-label={t('filter.basis')}
                        value={parseAccountingBasis(accountingBasis)}
                        disabled={!canReadLedgerKpis}
                        title={canReadLedgerKpis ? t('filter.basisTitle') : t('filter.basisNoLedger')}
                        onChange={(e) => handleBasisSelect(e.target.value)}
                    >
                        <option value="accrual">{t('filter.basisAccrual')}</option>
                        <option value="cash">{t('filter.basisCash')}</option>
                    </SelectCombo>
                </label>
                {periodPreset === 'custom' ? (
                    <button
                        type="button"
                        className="wsd-bar__apply"
                        onClick={applyDateRange}
                        disabled={isLoading || !rangeDirty}
                    >
                        {isLoading ? t('btn.loading') : t('btn.apply')}
                    </button>
                ) : null}
            </div>
            {rangeError ? (
                <div role="alert" className="wsd-alert">{rangeError}</div>
            ) : null}

            {loadError && (
                <div className="wsd-alert wsd-alert--panel" role="alert">
                    {loadError}
                    <button type="button" className="wsd-bar__showall wsd-alert__retry" onClick={() => loadDashboard()}>
                        {t('btn.retry')}
                    </button>
                </div>
            )}
            {isLoading && !dashLive ? (
                <div className="wsd-block">
                    <ShimmerKpiGrid cards={10} />
                </div>
            ) : (
                <div className="wsd-block">
                    <DashboardKpiCards
                        cards={mappedKpis.cards}
                        onDrillDown={handleKpiDrillDown}
                        onRetry={() => loadDashboard()}
                        t={t}
                        inventoryCostBasis={costBasis}
                        onInventoryCostBasisChange={setCostBasis}
                        tInventoryCostBasis={tInventoryCostBasis}
                    />
                </div>
            )}
            <WorkshopDashboardCharts
                series={seriesLive}
                grain={effectiveGrain}
                vatMode={vatMode}
                onVatMode={setVatMode}
                locale={locale}
                t={t}
                loading={seriesLoading}
                error={seriesError}
                stale={seriesStale}
                allowedGrains={allowedGrains}
                onGrain={setGrain}
                compareMode={compareMode}
                freshAt={seriesLive && seriesFreshAt ? formatRiyadhDateTime(seriesFreshAt, locale) : ''}
                latencyMs={seriesLive?.queryDurationMs}
            />
            <div className="wsd-split wsd-split--3">
                <section className="wsd-panel">
                    <div className="wsd-panel__head">
                        <h3 className="wsd-panel__title" title={t('branches.measure')}>{t('branches.title')}</h3>
                    </div>
                    {branchPerformance.length === 0 ? (
                        <p className="wsd-empty">{t('branches.empty')}</p>
                    ) : (
                        <div className="wsd-panel__body wsd-panel__body--scroll">
                            {(() => {
                                const maxSales = Math.max(0, ...branchPerformance.map((b) => toNumber(b.monthlySales)));
                                return branchPerformance.map((branch) => {
                                    const amt = toNumber(branch.monthlySales);
                                    const pct = maxSales > 0 ? Math.round((amt / maxSales) * 100) : 0;
                                    const top = maxSales > 0 && amt === maxSales;
                                    return (
                                        <div key={branch.id} className="wsd-hbar">
                                            <div className="wsd-hbar__meta">
                                                <p className="wsd-name">{branch.name}</p>
                                                <span className="wsd-amount">{t('money.sar', { amount: amt.toLocaleString() })}</span>
                                            </div>
                                            <div className="wsd-hbar__track" aria-hidden="true">
                                                <div
                                                    className={`wsd-hbar__fill${top ? ' wsd-hbar__fill--accent' : ''}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}
                </section>
                <section className="wsd-panel">
                    <div className="wsd-panel__head">
                        <h3 className="wsd-panel__title" title={t('pay.hint')}>{t('pay.title')}</h3>
                    </div>
                    {seriesError && !seriesLive ? (
                        <p className="wsd-alert">{t('pay.unavailable')}</p>
                    ) : seriesStale ? (
                        <p className="wsd-empty">{t('pay.stale')}</p>
                    ) : !seriesLive && seriesLoading ? (
                        <p className="wsd-empty">{t('charts.loading')}</p>
                    ) : paymentRows.length === 0 ? (
                        <p className="wsd-empty">{t('pay.empty')}</p>
                    ) : (
                        <div className="wsd-panel__body wsd-panel__body--scroll">
                            {paymentRows.map((row) => (
                                <div key={row.method || 'unknown'} className="wsd-row">
                                    <p className="wsd-name">{t(`pay.method.${paymentMethodKey(row.method)}`, { method: row.method || t('pay.unknown') })}</p>
                                    <span className="wsd-amount">{t('money.sar', { amount: toNumber(row.amount).toLocaleString() })}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
                <section className="wsd-panel">
                    <div className="wsd-panel__head">
                        <h3 className="wsd-panel__title" title={t('lowStock.hint')}>{t('lowStock.title')}</h3>
                    </div>
                    {lowStockState === 'loading' ? (
                        <p className="wsd-empty">{t('lowStock.loading')}</p>
                    ) : lowStockState === 'error' ? (
                        <p className="wsd-alert">{t('lowStock.error')}</p>
                    ) : lowStockState === 'unauthorized' ? (
                        <p className="wsd-alert">{t('lowStock.unauthorized')}</p>
                    ) : lowStockState === 'unavailable' || lowStockState === 'stale' ? (
                        <p className="wsd-empty">{t(lowStockState === 'stale' ? 'lowStock.stale' : 'lowStock.unavailable')}</p>
                    ) : lowStockState === 'empty' ? (
                        <p className="wsd-empty">{t('lowStock.verifiedEmpty')}</p>
                    ) : (
                        <div className="wsd-panel__body wsd-panel__body--scroll">
                            {lowStockRows.map((p) => (
                                <div key={p.id} className="wsd-row">
                                    <p className="wsd-name">{p.name || t('lowStock.unnamed')}</p>
                                    <span className="wsd-chip wsd-chip--warn">{t('lowStock.badge')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
            <section className="wsd-panel">
                <h3 className="wsd-panel__title">{t('quick.title')}</h3>
                <div className="wsd-quick-grid">
                    {quickActions.map((a) => (
                        <button
                            key={a.tab}
                            type="button"
                            className="wsd-quick"
                            onClick={() => onTabChange(a.tab)}
                        >
                            {a.badge > 0 ? <span className="wsd-quick__count">{a.badge}</span> : null}
                            <span className="wsd-quick__icon" aria-hidden="true"><a.Icon size={22} /></span>
                            <span className="wsd-quick__label">{a.label}</span>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
