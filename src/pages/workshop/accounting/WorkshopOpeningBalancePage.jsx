import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import { useAuth } from '../../../context/AuthContext';
import {
  getOpeningBalanceWorkspace,
  getOpeningBalanceSubledger,
  previewOpeningBalance,
  postOpeningBalance,
  reverseOpeningBalance,
  saveOpeningBalanceDraft,
} from '../../../services/openingBalanceApi';
import {
  buildObAccountTree,
  buildObInputFingerprint,
  filterObWorkspaceAccounts,
  formatObSavedTime,
  formatSarLatn,
  isObRowEditable,
  mapJournalPreviewLines,
  mapObTrueUpTotals,
  newIdempotencyKey,
  obDiffSide,
  obErrorCodeToKey,
  obPreviewMatchesInputs,
  resolveObViewState,
  validateObMoneyInput,
  validatePostReason,
  ymdToDisplay,
} from '../../../utils/openingBalanceDisplay';
import ObAccountSearch from './ObAccountSearch';
import RiyalIcon from '../../../components/RiyalIcon';
import '../../../styles/admin/AccountingPage.css';
import './OpeningBalancePage.css';

function errCode(e) {
  return String(e?.code || e?.body?.code || e?.response?.data?.code || '');
}

function Money({ amount, dir = 'ltr' }) {
  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        unicodeBidi: 'isolate',
        direction: 'ltr',
        display: 'inline-block',
      }}
      dir={dir}
    >
      <RiyalIcon size={12} />{' '}
      <bdi dir="ltr">{formatSarLatn(amount)}</bdi>
    </span>
  );
}

export default function WorkshopOpeningBalancePage({ locale: localeProp }) {
  const { hasPermission, user } = useAuth();
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('portal-locale')
      : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const fontFamily =
    locale === 'ar' ? '"Noto Naskh Arabic", Cairo, sans-serif' : undefined;
  const headingFont = locale === 'ar' ? 'Cairo, sans-serif' : undefined;

  const ut = String(user?.userType || '').toLowerCase();
  const canPost =
    hasPermission('workshop.accounting.journal-entries.approve') ||
    hasPermission('accounting.journal-entries.approve') ||
    ut === 'platform_admin' ||
    ut === 'workshop_admin' ||
    ut === 'workshop_owner' ||
    ut === 'owner' ||
    ut === 'accountant';

  const canView =
    canPost ||
    hasPermission('workshop.accounting.journal-entries.view') ||
    hasPermission('workshop.accounting.journal-entries.create') ||
    hasPermission('workshop.accounting.chart-of-accounts.view');

  const [startDate, setStartDate] = useState('');
  const [needsStartDate, setNeedsStartDate] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [targets, setTargets] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);
  const [filter, setFilter] = useState({
    search: '',
    type: 'all',
    onlyDifferences: false,
  });
  const [pickedAccountId, setPickedAccountId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [sectionCollapsed, setSectionCollapsed] = useState(() => new Set());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [errCodeState, setErrCodeState] = useState('');
  const [toast, setToast] = useState('');

  const [preview, setPreview] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);
  const [reason, setReason] = useState('');
  const [lockAfterPost, setLockAfterPost] = useState(true);
  const [enableCutover, setEnableCutover] = useState(true);
  const [reverseLegacyConfirmed, setReverseLegacyConfirmed] = useState(false);
  const [needsReReview, setNeedsReReview] = useState(false);
  const [reReviewCode, setReReviewCode] = useState('');
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState('');
  const idemRef = useRef(newIdempotencyKey());
  const rowRefs = useRef({});
  const previewRef = useRef(null);
  previewRef.current = preview;

  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [reversing, setReversing] = useState(false);

  const [drawer, setDrawer] = useState(null);
  const [subItems, setSubItems] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subErr, setSubErr] = useState('');

  const mapApiErr = useCallback(
    (e, fallbackKey) => {
      const code = errCode(e);
      if (!code) return e?.message || t(fallbackKey);
      const key = obErrorCodeToKey(code);
      const details =
        e?.details && typeof e.details === 'object' && !Array.isArray(e.details)
          ? e.details
          : {};
      if (code === 'OB_SUBLEDGER_MISMATCH' || code === 'SUBLEDGER_CONTROL_MISMATCH') {
        const control = details.control;
        const parties = details.parties;
        const difference = details.difference;
        if (control != null || parties != null || difference != null) {
          return t(key, {
            control: control != null ? String(control) : '',
            parties: parties != null ? String(parties) : '',
            difference: difference != null ? String(difference) : '',
          });
        }
        return t('ob.err.subledgerMismatch');
      }
      if (code === 'OB_LEGACY_OPENING_AFTER_START') {
        const fromDetails = Array.isArray(details.journals)
          ? details.journals
          : [];
        const latestPreview = previewRef.current;
        const fromPreview = Array.isArray(latestPreview?.legacyOpeningsAfterStart)
          ? latestPreview.legacyOpeningsAfterStart
          : [];
        const journals = fromDetails.length ? fromDetails : fromPreview;
        const numbers = journals
          .map((j) => j.number || j.entryNumber || j.id)
          .filter(Boolean)
          .join(', ');
        if (numbers) return t(key, { numbers });
        return t('ob.err.legacyOpeningPlain');
      }
      if (
        code === 'OB_LEGACY_OPENING_CHANGED' ||
        code === 'OB_LEGACY_NOT_REVERSIBLE'
      ) {
        return t(key);
      }
      return t(key);
    },
    [t],
  );

  const mapApiErrRef = useRef(mapApiErr);
  mapApiErrRef.current = mapApiErr;

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setErr('');
    setErrCodeState('');
    try {
      // B: first load without a date — take startDate from response only.
      const res = await getOpeningBalanceWorkspace({});
      setWorkspace(res);
      const need = Boolean(res?.needsStartDate) || res?.startDate == null;
      setNeedsStartDate(need);
      const sd = res?.startDate != null ? String(res.startDate).slice(0, 10) : '';
      setStartDate(sd);
      const next = {};
      for (const a of res?.accounts || []) {
        if (a.mode === 'entry' && a.isLeaf) {
          next[String(a.accountId)] = String(a.target ?? a.baseline ?? '0.00');
        }
      }
      if (res?.draft?.accounts) {
        Object.assign(next, res.draft.accounts);
      }
      setTargets(next);
      setDraftVersion(Number(res?.draft?.draftVersion ?? 0) || 0);
      setDirty(false);
      setPreview(null);
      setReviewOpen(false);
      setConfirmPost(false);
      setPickedAccountId(null);
    } catch (e) {
      setErr(mapApiErrRef.current(e, 'ob.err.workspace'));
      setErrCodeState(errCode(e));
      setWorkspace(null);
      setNeedsStartDate(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    loadWorkspace();
  }, [canView, loadWorkspace]);

  useEffect(() => {
    if (!dirty || !canPost || !startDate) return undefined;
    const id = setInterval(() => {
      saveDraftSilent();
    }, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, canPost, startDate, targets, draftVersion]);

  const accounts = workspace?.accounts || [];
  const viewState = resolveObViewState({
    loading,
    needsStartDate,
    error: err,
    accounts,
  });

  const filterForTable = useMemo(() => {
    if (pickedAccountId) {
      const keep = new Set([String(pickedAccountId)]);
      let cur = accounts.find((a) => String(a.accountId) === String(pickedAccountId));
      while (cur?.parentId) {
        keep.add(String(cur.parentId));
        cur = accounts.find((a) => String(a.accountId) === String(cur.parentId));
      }
      return {
        ...filter,
        search: '',
        _pickIds: keep,
      };
    }
    return filter;
  }, [filter, pickedAccountId, accounts]);

  const filtered = useMemo(() => {
    let rows = filterObWorkspaceAccounts(accounts, {
      search: filterForTable.search,
      type: filterForTable.type,
      onlyDifferences: filterForTable.onlyDifferences,
    });
    if (filterForTable._pickIds) {
      rows = accounts.filter((a) =>
        filterForTable._pickIds.has(String(a.accountId)),
      );
    }
    return rows;
  }, [accounts, filterForTable]);

  const byType = useMemo(() => {
    const groups = { asset: [], liability: [], equity: [] };
    for (const a of filtered) {
      const typ = String(a.type || '').toLowerCase();
      if (groups[typ]) groups[typ].push(a);
      else if (typ === 'assets') groups.asset.push(a);
    }
    return {
      asset: buildObAccountTree(groups.asset),
      liability: buildObAccountTree(groups.liability),
      equity: buildObAccountTree(groups.equity),
    };
  }, [filtered]);

  const inputFingerprint = useMemo(
    () => buildObInputFingerprint(startDate, targets),
    [startDate, targets],
  );

  const legacyForCutover =
    workspace?.status !== 'posted' &&
    Array.isArray(preview?.legacyOpeningsAfterStart)
      ? preview.legacyOpeningsAfterStart
      : [];
  const postEnabled =
    Boolean(preview?.previewHash) &&
    obPreviewMatchesInputs(preview, inputFingerprint) &&
    !loading &&
    !needsReReview;
  const postConfirmEnabled =
    postEnabled &&
    (legacyForCutover.length === 0 || reverseLegacyConfirmed);

  const statusChip = useMemo(() => {
    const st = workspace?.status;
    if (st === 'posted') {
      const je =
        workspace?.posted?.journalNo || workspace?.posted?.journalId || '—';
      const d = String(workspace?.posted?.postedAt || '').slice(0, 10);
      return {
        label: t('ob.status.postedChip', {
          je,
          date: ymdToDisplay(d, locale) || d || '—',
        }),
        tone: 'posted',
      };
    }
    if (st === 'reversed') {
      return { label: t('ob.status.reversed'), tone: 'reversed' };
    }
    if (workspace?.draft?.savedAt) {
      const time = formatObSavedTime(workspace.draft.savedAt, locale);
      return {
        label: t('ob.status.draft', { time }),
        tone: 'draft',
      };
    }
    if (st === 'draft') {
      return { label: t('ob.status.draft', { time: '—' }), tone: 'draft' };
    }
    return { label: t('ob.status.notStarted'), tone: 'idle' };
  }, [workspace, t, locale]);

  const liveTotals = useMemo(() => {
    if (preview?.trueUp && obPreviewMatchesInputs(preview, inputFingerprint)) {
      return mapObTrueUpTotals(preview.trueUp);
    }
    let dr = 0;
    let cr = 0;
    for (const a of accounts) {
      if (!a.isLeaf || a.mode === 'plug' || a.mode === 'system') continue;
      const baseline = Number(String(a.baseline || 0).replace(/,/g, '')) || 0;
      const target =
        targets[String(a.accountId)] != null
          ? Number(String(targets[String(a.accountId)]).replace(/,/g, '')) || 0
          : Number(String(a.target || a.baseline || 0).replace(/,/g, '')) || 0;
      const delta = Math.round((target - baseline) * 100) / 100;
      if (delta === 0) continue;
      const typ = String(a.type || '');
      if (typ === 'asset') {
        if (delta > 0) dr += delta;
        else cr += -delta;
      } else {
        if (delta > 0) cr += delta;
        else dr += -delta;
      }
    }
    const plug = Math.round((dr - cr) * 100) / 100;
    if (plug > 0) cr += plug;
    else if (plug < 0) dr += -plug;
    return mapObTrueUpTotals({
      totalDebit: dr.toFixed(2),
      totalCredit: cr.toFixed(2),
      balanced: Math.abs(dr - cr) < 0.005,
      plug: plug.toFixed(2),
    });
  }, [preview, accounts, targets, inputFingerprint]);

  const setTarget = (accountId, value) => {
    const v = validateObMoneyInput(value);
    setFieldErrors((p) => {
      const next = { ...p };
      if (!v.ok && String(value).trim() !== '') next[accountId] = t('ob.money.invalid');
      else delete next[accountId];
      return next;
    });
    setTargets((p) => ({ ...p, [String(accountId)]: value }));
    setDirty(true);
    setPreview(null);
  };

  const saveDraftSilent = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;
    try {
      const res = await saveOpeningBalanceDraft({
        startDate,
        accounts: targets,
        draftVersion,
        notes: null,
      });
      setDraftVersion(Number(res?.draft?.draftVersion ?? draftVersion + 1));
      setDirty(false);
      const time = formatObSavedTime(
        res?.draft?.savedAt || new Date().toISOString(),
        locale,
      );
      setToast(t('ob.status.draftSaved', { time }));
    } catch (e) {
      setErr(mapApiErr(e, 'ob.err.draft'));
      setErrCodeState(errCode(e));
    }
  };

  const onSaveDraft = async () => {
    setErr('');
    setErrCodeState('');
    await saveDraftSilent();
  };

  const onReview = async () => {
    setErr('');
    setErrCodeState('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;
    setLoading(true);
    try {
      const res = await previewOpeningBalance({
        startDate,
        accounts: targets,
        useDraft: false,
        page: 1,
        pageSize: 10000,
      });
      setPreview({ ...res, _inputFingerprint: inputFingerprint });
      setReviewOpen(true);
      setNeedsReReview(false);
      setReReviewCode('');
      setReverseLegacyConfirmed(false);
    } catch (e) {
      setErr(mapApiErr(e, 'ob.err.preview'));
      setErrCodeState(errCode(e));
    } finally {
      setLoading(false);
    }
  };

  const openPost = () => {
    idemRef.current = newIdempotencyKey();
    setPostErr('');
    setReason('');
    setReverseLegacyConfirmed(false);
    setConfirmPost(true);
  };

  const onPost = async () => {
    const v = validatePostReason(reason);
    if (!v.ok) {
      setPostErr(t('ob.err.reason'));
      return;
    }
    if (!postConfirmEnabled) {
      setPostErr(
        legacyForCutover.length > 0 && !reverseLegacyConfirmed
          ? t('ob.err.reverseLegacyRequired')
          : t('ob.err.previewFirst'),
      );
      return;
    }
    setPosting(true);
    setPostErr('');
    try {
      const legacyIds =
        reverseLegacyConfirmed && legacyForCutover.length > 0
          ? legacyForCutover.map((j) => String(j.id))
          : undefined;
      const res = await postOpeningBalance({
        startDate,
        previewHash: preview.previewHash,
        reason: reason.trim(),
        enableCutover,
        lockAfterPost,
        idempotencyKey: idemRef.current,
        accounts: targets,
        ...(legacyIds ? { reverseLegacyOpeningIds: legacyIds } : {}),
      });
      setConfirmPost(false);
      setReviewOpen(false);
      setNeedsReReview(false);
      setReReviewCode('');
      setReverseLegacyConfirmed(false);
      const syncWarnings = Array.isArray(res?.syncReport?.warnings)
        ? res.syncReport.warnings
        : Array.isArray(res?.warnings)
          ? res.warnings
          : [];
      const revPairs = Array.isArray(res?.legacyReversed)
        ? res.legacyReversed
            .map(
              (r) =>
                `${r.originalNumber || r.originalId} → ${r.reversalNumber || r.reversalId}`,
            )
            .filter(Boolean)
            .join(', ')
        : '';
      if (res?.resyncWarning || syncWarnings.length > 0) {
        setToast(t('ob.status.postedResyncHint'));
      } else if (revPairs) {
        setToast(
          `${t('ob.status.postedJe', {
            je: res?.journalNo || res?.journalId || '—',
            date: startDate,
          })} · ${t('ob.status.legacyReversed', { pairs: revPairs })}`,
        );
      } else {
        setToast(
          t('ob.status.postedJe', {
            je: res?.journalNo || res?.journalId || '—',
            date: startDate,
          }),
        );
      }
      await loadWorkspace();
    } catch (e) {
      const code = errCode(e);
      setPostErr(mapApiErr(e, 'ob.err.post'));
      if (
        code === 'OB_LEGACY_OPENING_CHANGED' ||
        code === 'OB_LEGACY_OPENING_AFTER_START' ||
        code === 'PREVIEW_STALE'
      ) {
        setReverseLegacyConfirmed(false);
        setNeedsReReview(true);
        setReReviewCode(code);
      }
    } finally {
      setPosting(false);
    }
  };

  const onReverse = async () => {
    const v = validatePostReason(reverseReason);
    if (!v.ok) {
      setPostErr(t('ob.err.reason'));
      return;
    }
    setReversing(true);
    setPostErr('');
    try {
      await reverseOpeningBalance({
        reason: reverseReason.trim(),
        idempotencyKey: newIdempotencyKey(),
      });
      setReverseOpen(false);
      await loadWorkspace();
    } catch (e) {
      setPostErr(mapApiErr(e, 'ob.err.reverse'));
    } finally {
      setReversing(false);
    }
  };

  const openDrawer = async (kind, title) => {
    setDrawer({ kind, title });
    setSubLoading(true);
    setSubErr('');
    try {
      const res = await getOpeningBalanceSubledger(kind, {
        startDate: startDate || undefined,
        page: 1,
        pageSize: 50,
      });
      setSubItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      setSubItems([]);
      setSubErr(mapApiErr(e, 'ob.drawer.error'));
    } finally {
      setSubLoading(false);
    }
  };

  const toggleCollapse = (id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAncestors = (accountId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      let cur = accounts.find((a) => String(a.accountId) === String(accountId));
      while (cur?.parentId) {
        next.delete(String(cur.parentId));
        cur = accounts.find((a) => String(a.accountId) === String(cur.parentId));
      }
      return next;
    });
    const typ = String(
      accounts.find((a) => String(a.accountId) === String(accountId))?.type || '',
    ).toLowerCase();
    if (typ) {
      setSectionCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(typ);
        return next;
      });
    }
  };

  const onPickAccount = (acct) => {
    const id = String(acct.accountId);
    setPickedAccountId(id);
    setFilter((p) => ({ ...p, search: '' }));
    expandAncestors(id);
    setHighlightId(id);
    requestAnimationFrame(() => {
      const el = rowRefs.current[id];
      if (el?.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const input = el?.querySelector?.('input');
      if (input && !input.disabled) input.focus();
    });
    setTimeout(() => setHighlightId(null), 2000);
  };

  const expandAll = () => {
    setCollapsed(new Set());
    setSectionCollapsed(new Set());
  };
  const collapseAll = () => {
    const ids = new Set(accounts.filter((a) => a.parentId == null).map((a) => String(a.accountId)));
    setCollapsed(ids);
    setSectionCollapsed(new Set(['asset', 'liability', 'equity']));
  };

  const sectionSubtotals = (nodes) => {
    let opening = 0;
    let diff = 0;
    const walk = (list) => {
      for (const n of list) {
        if (n.isLeaf) {
          const baseline = Number(String(n.baseline || 0).replace(/,/g, '')) || 0;
          const targetVal =
            targets[String(n.accountId)] != null
              ? Number(String(targets[String(n.accountId)]).replace(/,/g, '')) || 0
              : Number(String(n.target || n.baseline || 0).replace(/,/g, '')) || 0;
          opening += targetVal;
          diff += targetVal - baseline;
        }
        if (n.children?.length) walk(n.children);
      }
    };
    walk(nodes);
    return {
      opening: opening.toFixed(2),
      diff: diff.toFixed(2),
      count: nodes.reduce((acc, n) => {
        const c = (x) =>
          1 + (x.children || []).reduce((s, ch) => s + c(ch), 0);
        return acc + c(n);
      }, 0),
    };
  };

  const renderRows = (nodes, depth = 0) => {
    const rows = [];
    for (const n of nodes) {
      const id = String(n.accountId);
      const hasKids = Array.isArray(n.children) && n.children.length > 0;
      const isCollapsed = collapsed.has(id);
      const baseline = n.baseline ?? '0.00';
      const targetVal =
        targets[id] != null ? targets[id] : String(n.target ?? baseline);
      const deltaNum =
        n.mode === 'entry' && n.isLeaf
          ? (Number(String(targetVal).replace(/,/g, '')) || 0) -
            (Number(String(baseline).replace(/,/g, '')) || 0)
          : Number(String(n.delta ?? '0').replace(/,/g, '')) || 0;
      const delta = deltaNum.toFixed(2);
      const side = obDiffSide(n.type, delta);
      const diffColor =
        deltaNum > 0 ? '#2563EB' : deltaNum < 0 ? '#DC2626' : '#64748B';
      const editable = isObRowEditable(n, workspace?.status);
      const changed =
        editable &&
        Math.abs(
          (Number(String(targetVal).replace(/,/g, '')) || 0) -
            (Number(String(baseline).replace(/,/g, '')) || 0),
        ) > 0.0001;
      const hi = highlightId === id;

      rows.push(
        <tr
          key={id}
          ref={(el) => {
            if (el) rowRefs.current[id] = el;
          }}
          style={{
            opacity: n.mode === 'carry' ? 0.75 : 1,
            background: hi ? 'rgba(252, 194, 69, 0.35)' : undefined,
            transition: 'background 0.4s ease',
          }}
        >
          <td
            className="table-cell"
            style={{ paddingInlineStart: 8 + depth * 14 }}
          >
            {hasKids ? (
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                style={{ padding: '0 4px', marginInlineEnd: 4 }}
                onClick={() => toggleCollapse(id)}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
            ) : null}
            <code>{n.code}</code>
          </td>
          <td className="table-cell">
            {n.name}
            {n.mode === 'stock_count' ? (
              <span className="ob-tag">
                <Link to="/workshop/inventory">{t('ob.tag.stockCount')}</Link>
              </span>
            ) : null}
            {n.mode === 'party' ? (
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                style={{ marginInlineStart: 8, fontSize: 12, padding: '2px 8px' }}
                onClick={() =>
                  openDrawer(
                    n.subledgerKind || 'ar_walkin',
                    `${n.code} ${n.name}`,
                  )
                }
              >
                {String(n.subledgerKind || '').startsWith('ap')
                  ? t('ob.act.editSuppliers')
                  : t('ob.act.editCustomers')}
              </button>
            ) : null}
            {n.mode === 'carry' ? (
              <span className="ob-tag">{t('ob.tag.carried')}</span>
            ) : null}
            {n.mode === 'subledger' ? (
              <span className="ob-tag">{t('ob.tag.subledger')}</span>
            ) : null}
            {n.mode === 'system' || n.mode === 'plug' ? (
              <span
                style={{
                  marginInlineStart: 8,
                  fontSize: 11,
                  color: 'var(--color-text-muted, #64748B)',
                }}
              >
                {n.mode === 'plug' ? t('ob.tag.plug') : t('ob.tag.system')}
              </span>
            ) : null}
            {n.mode === 'subledger' && n.isLeaf ? (
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                style={{ marginInlineStart: 8, fontSize: 12 }}
                onClick={() =>
                  openDrawer(
                    n.subledgerKind || 'cashbank',
                    `${n.code} ${n.name}`,
                  )
                }
              >
                {t('ob.act.details')}
              </button>
            ) : null}
            {(() => {
              const today = n.currentToday ?? baseline;
              const startN = Number(String(baseline).replace(/,/g, '')) || 0;
              const todayN = Number(String(today).replace(/,/g, '')) || 0;
              if (Math.abs(startN - todayN) < 0.0001) return null;
              return (
                <div className="ob-live-note">
                  <span>
                    {t('ob.note.liveAfterS', {
                      date: ymdToDisplay(startDate) || startDate || 'S',
                    })}
                  </span>{' '}
                  <a
                    href={`/workshop/accounting/chart-of-accounts?accountId=${encodeURIComponent(id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('ob.note.viewLedger')}
                  </a>
                </div>
              );
            })()}
          </td>
          <td className="table-cell" style={{ textAlign: 'end' }}>
            <Money amount={baseline} />
          </td>
          <td className="table-cell" style={{ textAlign: 'end' }}>
            <Money amount={n.currentToday ?? baseline} />
          </td>
          <td className="table-cell" style={{ textAlign: 'end' }}>
            {editable ? (
              <div>
                <input
                  className="form-input"
                  style={{
                    width: 120,
                    textAlign: 'end',
                    borderColor: changed
                      ? 'var(--color-primary, #FCC245)'
                      : undefined,
                    borderWidth: changed ? 2 : undefined,
                  }}
                  value={targetVal}
                  onChange={(e) => setTarget(id, e.target.value)}
                  disabled={!canPost}
                  aria-label={`${n.code} opening`}
                  inputMode="decimal"
                />
                {fieldErrors[id] ? (
                  <div
                    role="alert"
                    style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}
                  >
                    {fieldErrors[id]}
                  </div>
                ) : null}
              </div>
            ) : (
              <Money amount={targetVal} />
            )}
          </td>
          <td className="table-cell" style={{ textAlign: 'end', color: diffColor }}>
            <Money amount={delta} />
            {side ? (
              <span
                style={{
                  marginInlineStart: 6,
                  fontSize: 11,
                  color: 'var(--color-text-muted, #64748B)',
                }}
              >
                {side}
              </span>
            ) : null}
          </td>
        </tr>,
      );
      if (hasKids && !isCollapsed) {
        rows.push(...renderRows(n.children, depth + 1));
      }
    }
    return rows;
  };

  const renderSection = (key, titleKey, tree) => {
    if (!tree.length && viewState === 'ready' && filter.type !== 'all' && filter.type !== key) {
      return null;
    }
    if (!tree.length) return null;
    const collapsedSec = sectionCollapsed.has(key);
    const sub = sectionSubtotals(tree);
    return (
      <tbody key={key}>
        <tr
          style={{
            background: 'var(--color-bg-canvas, #F8FAFC)',
            cursor: 'pointer',
          }}
          onClick={() =>
            setSectionCollapsed((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
        >
          <td className="table-cell" colSpan={2} style={{ fontFamily: headingFont }}>
            <strong>{t(titleKey)}</strong>{' '}
            <span style={{ color: 'var(--color-text-muted, #64748B)', fontSize: 12 }}>
              {t('ob.section.count', { n: sub.count })}
            </span>
          </td>
          <td className="table-cell" style={{ textAlign: 'end', fontSize: 12 }}>
            <Money amount={sub.opening} />
          </td>
          <td className="table-cell" style={{ textAlign: 'end', fontSize: 12 }}>
            —
          </td>
          <td className="table-cell" style={{ textAlign: 'end', fontSize: 12 }}>
            <Money amount={sub.diff} />
          </td>
        </tr>
        {!collapsedSec ? renderRows(tree) : null}
      </tbody>
    );
  };

  if (!canView) {
    return (
      <div className="accounting-page" dir={dir} style={{ fontFamily }}>
        <p role="alert">{t('ob.err.forbidden')}</p>
      </div>
    );
  }

  const posted = workspace?.status === 'posted';
  const stepReview = confirmPost || posted ? 3 : reviewOpen && preview ? 2 : 1;
  const stepsDone = posted;

  const badgeStyle = {
    posted: { background: '#ECFDF5', color: '#047857' },
    draft: { background: '#FFF7ED', color: '#C2410C' },
    reversed: { background: '#F1F5F9', color: '#475569' },
    idle: { background: '#F1F5F9', color: '#334155' },
  }[statusChip.tone] || { background: '#F1F5F9', color: '#334155' };

  const skeletonRows = Array.from({ length: 6 }, (_, i) => (
    <tr key={`sk-${i}`}>
      <td className="table-cell" colSpan={6}>
        <div
          style={{
            height: 14,
            borderRadius: 4,
            background: 'linear-gradient(90deg,#e2e8f0,#f8fafc,#e2e8f0)',
            opacity: 0.7,
          }}
        />
      </td>
    </tr>
  ));

  return (
    <div
      className="accounting-page ob-page"
      dir={dir}
      style={{ fontFamily, paddingBottom: viewState === 'ready' ? 120 : 24 }}
    >
      <nav style={{ fontSize: 13, marginBottom: 8 }}>
        <Link to="/workshop/accounting/settings">{t('ob.crumb')}</Link>
      </nav>

      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 16,
          padding: 16,
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: 10,
          background: 'var(--color-bg-canvas, #fff)',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <h1 style={{ margin: 0, fontFamily: headingFont, fontSize: 22 }}>
            {t('ob.title')}
          </h1>
          <p
            style={{
              margin: '6px 0 0',
              color: 'var(--color-text-muted, #64748B)',
              fontSize: 13,
            }}
          >
            {t('ob.subtitle')}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {startDate ? (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--color-border, #E2E8F0)',
                fontSize: 13,
                background: '#fff',
              }}
            >
              {t('ob.startChip', { date: ymdToDisplay(startDate, locale) || startDate })}
              {' · '}
              <Link to="/workshop/accounting/settings">{t('ob.changeInSettings')}</Link>
            </span>
          ) : null}
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 13,
              ...badgeStyle,
            }}
          >
            {statusChip.label}
          </span>
          <button
            type="button"
            className="ob-btn ob-btn--ghost"
            onClick={() => loadWorkspace()}
            disabled={loading}
            title={t('ob.tooltip.refresh')}
            aria-label={t('ob.tooltip.refresh')}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <ol
        aria-label={t('ob.stepper')}
        style={{
          display: 'flex',
          gap: 12,
          listStyle: 'none',
          padding: 0,
          margin: '0 0 16px',
          fontSize: 13,
          flexWrap: 'wrap',
        }}
      >
        {[
          { n: 1, key: 'ob.step.enter' },
          { n: 2, key: 'ob.step.review' },
          { n: 3, key: 'ob.step.postLock' },
        ].map((s) => {
          const active = stepReview === s.n;
          const done = stepsDone || stepReview > s.n;
          return (
            <li
              key={s.n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: active ? 600 : 400,
                color: done || active ? '#0F172A' : '#94A3B8',
                fontFamily: headingFont,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'inline-grid',
                  placeItems: 'center',
                  background:
                    done || active
                      ? 'var(--color-primary, #FCC245)'
                      : '#E2E8F0',
                  fontSize: 12,
                }}
              >
                {done ? '✓' : s.n}
              </span>
              {t(s.key)}
            </li>
          );
        })}
      </ol>

      {toast ? (
        <p role="status" style={{ color: '#047857' }}>
          {toast}
        </p>
      ) : null}
      {workspace?.status !== 'posted' && legacyForCutover.length > 0 ? (
        <div
          role="alert"
          data-testid="ob-legacy-banner"
          style={{
            marginBottom: 12,
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid #F59E0B',
            background: '#FFFBEB',
            color: '#92400E',
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: '0 0 6px' }}>{t('ob.warn.legacyOpening')}</p>
              <ul style={{ margin: '0 0 8px', paddingInlineStart: 18 }}>
                {legacyForCutover.map((j) => {
                  const partyName =
                    Array.isArray(j.parties) && j.parties[0]?.name
                      ? String(j.parties[0].name).trim()
                      : '';
                  const bannerName = partyName || String(j.description || '').trim();
                  return (
                    <li key={String(j.id || j.number)}>
                      {j.number || j.id}
                      {j.date
                        ? ` · ${ymdToDisplay(j.date, locale) || j.date}`
                        : ''}
                      {j.total != null ? (
                        <>
                          {' · '}
                          <Money amount={j.total} />
                        </>
                      ) : null}
                      {bannerName
                        ? ` · ${t('ob.warn.openingBalanceFor', { name: bannerName })}`
                        : ''}
                      {j.id ? (
                        <>
                          {' · '}
                          <Link
                            to={`/workshop/accounting/journal-entries?journal=${encodeURIComponent(String(j.id))}`}
                            style={{ fontWeight: 600 }}
                          >
                            {t('ob.warn.openJournal')}
                          </Link>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p style={{ margin: '0 0 8px' }}>{t('ob.warn.legacyOpeningAction')}</p>
              <p style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.9 }}>
                {t('ob.warn.legacyOpeningAlt', {
                  lastDate:
                    ymdToDisplay(
                      legacyForCutover[legacyForCutover.length - 1]?.date,
                      locale,
                    ) ||
                    legacyForCutover[legacyForCutover.length - 1]?.date ||
                    '—',
                })}{' '}
                <Link to="/workshop/accounting/settings" style={{ fontWeight: 600 }}>
                  {t('ob.warn.accountingSettings')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {!canPost ? (
        <p style={{ color: 'var(--color-text-muted, #64748B)', fontSize: 13 }}>
          {t('ob.readonlyNote')}
        </p>
      ) : null}

      {viewState === 'needsStart' ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: 10,
            background: 'var(--color-bg-canvas, #F8FAFC)',
          }}
        >
          <h2 style={{ fontFamily: headingFont, marginTop: 0 }}>
            {t('ob.empty.noStart.title')}
          </h2>
          <p style={{ color: 'var(--color-text-muted, #64748B)' }}>
            {t('ob.empty.noStart.body')}
          </p>
          <Link className="ob-btn ob-btn--primary" to="/workshop/accounting/settings">
            {t('ob.empty.noStart.cta')}
          </Link>
        </div>
      ) : null}

      {viewState === 'error' ? (
        <div
          role="alert"
          style={{
            padding: 20,
            border: '1px solid #FECACA',
            borderRadius: 10,
            background: '#FEF2F2',
          }}
        >
          <p style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
            <AlertTriangle size={16} /> {err}
          </p>
          {errCodeState ? (
            <p style={{ fontSize: 12, color: '#64748B', margin: '8px 0' }}>
              {t('ob.err.code', { code: errCodeState })}
            </p>
          ) : null}
          <button type="button" className="ob-btn ob-btn--secondary" onClick={() => loadWorkspace()}>
            {t('ob.retry')}
          </button>
        </div>
      ) : null}

      {viewState === 'empty' ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: 10,
          }}
        >
          <h2 style={{ fontFamily: headingFont }}>{t('ob.empty.noAccounts.title')}</h2>
          <p style={{ color: 'var(--color-text-muted, #64748B)' }}>
            {t('ob.empty.noAccounts.body')}
          </p>
          <Link to="/workshop/accounting/chart-of-accounts">
            {t('ob.empty.noAccounts.cta')}
          </Link>
        </div>
      ) : null}

      {(viewState === 'loading' || viewState === 'ready') && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 10,
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 220, flex: '1 1 220px' }}>
              <ObAccountSearch
                accounts={accounts}
                value={filter.search}
                onChange={(v) => {
                  setPickedAccountId(null);
                  setFilter((p) => ({ ...p, search: v }));
                }}
                onPick={onPickAccount}
                onClear={() => {
                  setPickedAccountId(null);
                  setFilter((p) => ({ ...p, search: '' }));
                }}
                locale={locale}
                placeholder={t('ob.filter.searchPh')}
                emptyText={t('ob.empty.noMatch')}
                hint="↑ ↓ Enter Esc"
              />
            </div>
            {pickedAccountId ? (
              <button
                type="button"
                className="ob-btn ob-btn--secondary"
                onClick={() => setPickedAccountId(null)}
              >
                {t('ob.act.showAll')}
              </button>
            ) : null}
            <select
              className="form-input"
              value={filter.type}
              disabled={viewState === 'loading'}
              onChange={(e) => setFilter((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="all">{t('ob.filter.typeAll')}</option>
              <option value="asset">{t('ob.filter.typeAsset')}</option>
              <option value="liability">{t('ob.filter.typeLiability')}</option>
              <option value="equity">{t('ob.filter.typeEquity')}</option>
            </select>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={filter.onlyDifferences}
                disabled={viewState === 'loading'}
                onChange={(e) =>
                  setFilter((p) => ({ ...p, onlyDifferences: e.target.checked }))
                }
              />
              {t('ob.filter.onlyDiff')}
            </label>
            <button
              type="button"
              className="ob-btn ob-btn--ghost"
              disabled={viewState === 'loading'}
              onClick={expandAll}
            >
              {t('ob.act.expandAll')}
            </button>
            <button
              type="button"
              className="ob-btn ob-btn--ghost"
              disabled={viewState === 'loading'}
              onClick={collapseAll}
            >
              {t('ob.act.collapseAll')}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: drawer ? '1fr 340px' : '1fr',
              gap: 12,
            }}
          >
            <div
              style={{
                overflowX: 'auto',
                border: '1px solid var(--color-border, #E2E8F0)',
                borderRadius: 8,
              }}
            >
              <table
                className="ws-table"
                style={{ width: '100%', tableLayout: 'fixed' }}
              >
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="table-th">{t('ob.th.code')}</th>
                    <th className="table-th">{t('ob.th.account')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('ob.col.atStart', {
                        date: ymdToDisplay(startDate) || startDate || 'S',
                      })}
                    </th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('ob.col.today')}
                    </th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('ob.col.opening')}
                    </th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('ob.col.diff')}
                    </th>
                  </tr>
                </thead>
                {viewState === 'loading' ? (
                  <tbody>{skeletonRows}</tbody>
                ) : filtered.length === 0 ? (
                  <tbody>
                    <tr>
                      <td className="table-cell" colSpan={6} style={{ textAlign: 'center' }}>
                        <p>{t('ob.empty.noMatch')}</p>
                        <button
                          type="button"
                          className="ob-btn ob-btn--secondary"
                          onClick={() => {
                            setPickedAccountId(null);
                            setFilter({
                              search: '',
                              type: 'all',
                              onlyDifferences: false,
                            });
                          }}
                        >
                          {t('ob.empty.clearFilters')}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <>
                    {renderSection('asset', 'ob.section.assets', byType.asset)}
                    {renderSection(
                      'liability',
                      'ob.section.liabilities',
                      byType.liability,
                    )}
                    {renderSection('equity', 'ob.section.equity', byType.equity)}
                  </>
                )}
              </table>
            </div>

            {drawer ? (
              <aside
                style={{
                  border: '1px solid var(--color-border, #E2E8F0)',
                  borderRadius: 8,
                  padding: 12,
                  background: 'var(--color-bg-canvas, #F8FAFC)',
                  maxHeight: '70vh',
                  overflow: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <strong style={{ fontFamily: headingFont }}>{drawer.title}</strong>
                  <button
                    type="button"
                    className="ob-btn ob-btn--ghost"
                    onClick={() => setDrawer(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                {subErr ? (
                  <p role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>
                    {subErr}
                  </p>
                ) : null}
                {String(drawer.kind).includes('inventory') ? (
                  <p style={{ fontSize: 12, color: '#92400E' }}>{t('ob.inv.banner')}</p>
                ) : null}
                {subLoading ? (
                  <p>{t('ob.loading')}</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
                    {subItems.map((it) => (
                      <li
                        key={it.partyId || `${it.branchId}-${it.productId}`}
                        style={{
                          padding: '8px 0',
                          borderBottom: '1px solid var(--color-border, #E2E8F0)',
                          fontSize: 13,
                        }}
                      >
                        <div>{it.name || it.partyId}</div>
                        {it.value != null ? (
                          <div style={{ color: 'var(--color-text-muted, #64748B)' }}>
                            qty {it.qtyAtStart} · <Money amount={it.value} />
                            {it.qtyBasis === 'live'
                              ? ` · ${t('ob.inv.qtyBasis.live')}`
                              : ''}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--color-text-muted, #64748B)' }}>
                            {t('ob.col.current')}: <Money amount={it.baseline} /> ·{' '}
                            {t('ob.col.opening')}: <Money amount={it.target} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            ) : null}
          </div>
        </>
      )}

      {viewState === 'ready' ? (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            marginTop: 16,
            padding: '14px 16px',
            background: '#0F172A',
            color: '#F8FAFC',
            borderRadius: '10px 10px 0 0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 5,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 280px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
              <span>
                {t('ob.totals.debit')}: <Money amount={liveTotals.totalDebit} />
              </span>
              <span>
                {t('ob.totals.credit')}: <Money amount={liveTotals.totalCredit} />
              </span>
              <span>
                {t('ob.totals.plugLabel')}{' '}
                <Money amount={liveTotals.plugAbs} />{' '}
                {liveTotals.plugSide}
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: liveTotals.balanced ? '#065F46' : '#7F1D1D',
                  fontSize: 12,
                }}
              >
                {liveTotals.balanced
                  ? t('ob.totals.balanced')
                  : t('ob.totals.unbalanced')}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>
              {t('ob.footer.plugExplain')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {posted && canPost ? (
              <button
                type="button"
                className="ob-btn ob-btn--secondary"
                style={{ borderColor: '#F87171', color: '#FECACA' }}
                onClick={() => setReverseOpen(true)}
              >
                {t('ob.act.reverse')}
              </button>
            ) : null}
            {!posted && canPost ? (
              <>
                <button
                  type="button"
                  className="ob-btn ob-btn--secondary"
                  onClick={onSaveDraft}
                  disabled={loading}
                  style={{ background: '#1E293B', color: '#F8FAFC' }}
                >
                  {t('ob.act.saveDraft')}
                </button>
                <button
                  type="button"
                  className="ob-btn ob-btn--primary"
                  onClick={onReview}
                  disabled={loading}
                  style={{ background: 'var(--color-primary, #FCC245)', color: '#0F172A' }}
                >
                  {t('ob.act.reviewJournal')}
                </button>
                <button
                  type="button"
                  className="ob-btn ob-btn--secondary"
                  onClick={openPost}
                  disabled={!postEnabled}
                  title={!postEnabled ? t('ob.tooltip.reviewFirst') : undefined}
                  style={{
                    background: postEnabled ? '#F8FAFC' : '#334155',
                    color: postEnabled ? '#0F172A' : '#94A3B8',
                  }}
                >
                  {t('ob.act.postLock')}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {reviewOpen && preview ? (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 40,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 20,
              width: 'min(720px, 94vw)',
              maxHeight: '85vh',
              overflow: 'auto',
              fontFamily,
            }}
          >
            <h2 style={{ marginTop: 0, fontFamily: headingFont }}>
              {t('ob.act.reviewJournal')}
            </h2>
            <p style={{ fontSize: 13, color: '#64748B' }}>
              {t('ob.je.meta', { date: startDate })}
            </p>
            <table className="ws-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th className="table-th">{t('ob.th.account')}</th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('lj.th.debit')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('lj.th.credit')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {mapJournalPreviewLines(
                  preview.trueUp || preview.journalPreview,
                ).map((l) => (
                  <tr key={l.id}>
                    <td className="table-cell">{l.account}</td>
                    <td className="table-cell" style={{ textAlign: 'end' }}>
                      <Money amount={l.debit} />
                    </td>
                    <td className="table-cell" style={{ textAlign: 'end' }}>
                      <Money amount={l.credit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <button
                type="button"
                className="ob-btn ob-btn--secondary"
                onClick={() => setReviewOpen(false)}
              >
                {t('ob.act.back')}
              </button>
              {canPost ? (
                <button
                  type="button"
                  className="ob-btn ob-btn--primary"
                  onClick={openPost}
                  disabled={!postEnabled}
                >
                  {t('ob.act.postLock')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {confirmPost ? (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 20,
              width: 'min(480px, 94vw)',
              fontFamily,
            }}
          >
            <h2 style={{ marginTop: 0, fontFamily: headingFont }}>
              {t('ob.act.postLock')}
            </h2>
            <label style={{ display: 'block', marginBottom: 8 }}>
              {t('ob.post.reason')}
              <textarea
                className="form-input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={lockAfterPost}
                onChange={(e) => setLockAfterPost(e.target.checked)}
              />
              {t('ob.lockNote', { date: startDate })}
            </label>
            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={enableCutover}
                onChange={(e) => setEnableCutover(e.target.checked)}
              />
              {t('ob.post.enableCutover')}
            </label>
            {legacyForCutover.length > 0 ? (
              <label
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                <input
                  type="checkbox"
                  data-testid="ob-reverse-legacy"
                  checked={reverseLegacyConfirmed}
                  onChange={(e) => setReverseLegacyConfirmed(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  {t('ob.post.reverseLegacy', {
                    list: legacyForCutover
                      .map((j) => {
                        const d = j.date
                          ? ymdToDisplay(j.date, locale) || j.date
                          : '';
                        const tot =
                          j.total != null ? String(j.total) : '';
                        return `${j.number || j.id}${d ? ` (${d}${tot ? `, ${tot}` : ''})` : tot ? ` (${tot})` : ''}`;
                      })
                      .join(', '),
                  })}
                </span>
              </label>
            ) : null}
            {legacyForCutover.length > 0 && !reverseLegacyConfirmed ? (
              <p role="alert" data-testid="ob-reverse-legacy-required" style={{ color: '#B91C1C', fontSize: 13 }}>
                {t('ob.err.reverseLegacyRequired')}
              </p>
            ) : null}
            {needsReReview ? (
              <p role="status" style={{ color: '#B45309', fontSize: 13 }}>
                {reReviewCode === 'PREVIEW_STALE'
                  ? t('ob.err.previewStaleReview')
                  : t('ob.err.legacyOpeningChanged')}
              </p>
            ) : null}
            {postErr ? (
              <p role="alert" style={{ color: '#B91C1C' }}>
                {postErr}
              </p>
            ) : null}
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <button
                type="button"
                className="ob-btn ob-btn--secondary"
                onClick={() => setConfirmPost(false)}
              >
                {t('ob.post.cancel')}
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                data-testid="ob-post-confirm"
                disabled={posting || !postConfirmEnabled}
                onClick={onPost}
              >
                {posting ? t('ob.loading') : t('ob.post.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reverseOpen ? (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 20,
              width: 'min(480px, 94vw)',
              fontFamily,
            }}
          >
            <h2 style={{ marginTop: 0, fontFamily: headingFont }}>
              {t('ob.act.reverse')}
            </h2>
            <textarea
              className="form-input"
              rows={3}
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              style={{ width: '100%' }}
              placeholder={t('ob.post.reason')}
            />
            {postErr ? (
              <p role="alert" style={{ color: '#B91C1C' }}>
                {postErr}
              </p>
            ) : null}
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <button
                type="button"
                className="ob-btn ob-btn--secondary"
                onClick={() => setReverseOpen(false)}
              >
                {t('ob.post.cancel')}
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                disabled={reversing}
                onClick={onReverse}
              >
                {reversing ? t('ob.loading') : t('ob.act.reverse')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
