import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Filter,
  Printer,
  Receipt,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { PaginationControls } from '../../../components/PaginationControls';
import {
  listCashBankTransactionsLog,
  listLogFilterUsers,
  listReceiptPaymentMethods,
} from '../../../services/accountingLogsApi';
import {
  getWorkshopRecentOrderPdf,
  workshopReportsAnalyticsParams,
} from '../../../services/workshopStaffApi';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import CashierTaxInvoiceView from '../../../components/pos/modern/CashierTaxInvoiceView';
import '../../../components/pos/modern/CashierTaxInvoiceView.css';
import { downloadPosInvoicePdf } from '../../../utils/posInvoiceActions';
import { formatPlateLettersFirst } from '../../../utils/formatPlate';
import { accT } from '../../../utils/accountingI18n';
import { riyadhBoundToApiIso } from '../../../utils/riyadhBusinessRange';
import {
  PAYMENT_SOURCE_OPTIONS,
  RECEIPT_SOURCE_OPTIONS,
  TX_LOG_PAGE_SIZE,
  filterRowsBySource,
  formatBusinessDate,
  formatSarLatn,
  mapTxAccountDr,
  mapTxLink,
  mapTxPartyLabel,
  mapTxSourceKey,
  mapTxSummaryCards,
} from '../../../utils/txLogDisplay';
import '../../../styles/admin/AccountingPage.css';

const SOURCE_FETCH_CAP = 500;

function sidebarBranchToFilter(selectedBranchId) {
  return selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '';
}

function formatFilterUserLabel(u) {
  const name = u.name || u.email || u.id;
  const role = u.role ? String(u.role).replace(/_/g, ' ') : '';
  return role ? `${name} (${role})` : name;
}

/** Map workshop-staff PDF/details payload → CashierTaxInvoiceView shape. */
function mapRecentPdfToInvoice(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw?.invoice && typeof raw.invoice === 'object' ? raw.invoice : raw;
  const salesOrder = src.salesOrder && typeof src.salesOrder === 'object' ? src.salesOrder : {};
  const customer = salesOrder.customer && typeof salesOrder.customer === 'object' ? salesOrder.customer : {};
  const items = Array.isArray(src.items)
    ? src.items
    : Array.isArray(src.lines)
      ? src.lines
      : Array.isArray(salesOrder.items)
        ? salesOrder.items
        : [];
  return {
    ...src,
    invoiceId: src.invoiceId ?? src.id,
    invoiceNo: src.invoiceNo || src.number || '',
    plate: formatPlateLettersFirst(src.plate || salesOrder.plate || ''),
    customerName: src.customerName || customer.name || '',
    items,
  };
}

function sourceLabel(t, key) {
  if (!key || key === 'all') return t('txlog.source.all');
  const map = {
    invoice: 'txlog.source.invoice',
    employee_repayment: 'txlog.source.employeeRepayment',
    corporate: 'txlog.source.corporate',
    transactions: 'txlog.source.transactions',
    other: 'txlog.source.other',
    payroll_payout: 'txlog.source.payrollPayout',
    global_advance: 'txlog.source.globalAdvance',
    supplier_payment: 'txlog.source.supplierPayment',
  };
  return t(map[key] || 'txlog.source.other');
}

function linkLabel(t, kind) {
  if (kind === 'invoice') return t('txlog.link.invoice');
  if (kind === 'statement') return t('txlog.link.statement');
  if (kind === 'payslip') return t('txlog.link.payslip');
  if (kind === 'supplier') return t('txlog.link.supplier');
  if (kind === 'ar') return t('txlog.link.ar');
  return '—';
}

/**
 * Shared receipts (in) / payments (out) log — mockups 23 & 24.
 * Also used by admin AccountingPage HQ activity (no direction).
 */
export default function WorkshopTransactionsLog({
  title,
  subtitle,
  emptyHint,
  direction,
  branches = [],
  selectedBranchId = 'all',
  locale: localeProp,
  initialDateFrom = '',
  initialDateTo = '',
  hidePageChrome = false,
}) {
  const outletCtx = useOutletContext() || {};
  const navigate = useNavigate();
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const isReceipts = direction === 'in';
  const isPayments = direction === 'out';
  const tableTopRef = useRef(null);

  const emptyApplied = {
    method: 'all',
    branchId: sidebarBranchToFilter(selectedBranchId),
    userId: '',
    dateFrom: initialDateFrom || '',
    dateTo: initialDateTo || '',
    source: 'all',
  };

  const [method, setMethod] = useState('all');
  const [methodDisplay, setMethodDisplay] = useState('');
  const [branchId, setBranchId] = useState(() => sidebarBranchToFilter(selectedBranchId));
  const [branchDisplay, setBranchDisplay] = useState('');
  const [userId, setUserId] = useState('');
  const [userDisplay, setUserDisplay] = useState('');
  const [dateFrom, setDateFrom] = useState(initialDateFrom || '');
  const [dateTo, setDateTo] = useState(initialDateTo || '');
  const [source, setSource] = useState('all');
  const [applied, setApplied] = useState(emptyApplied);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [payloadExtra, setPayloadExtra] = useState({});
  const [users, setUsers] = useState([]);
  const [methodOptions, setMethodOptions] = useState([{ id: 'all', label: 'all' }]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMoreCols, setShowMoreCols] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [linkBusyId, setLinkBusyId] = useState(null);
  const invoicePanelRef = useRef(null);

  const resolvedEmpty = emptyHint ?? t('txlog.emptyDefault');

  useEffect(() => {
    if (!invoicePreview) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setInvoicePreview(null);
    };
    document.addEventListener('keydown', onKey);
    invoicePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return () => document.removeEventListener('keydown', onKey);
  }, [invoicePreview]);

  const sourceOptions = useMemo(() => {
    if (isPayments) return PAYMENT_SOURCE_OPTIONS;
    if (isReceipts) return RECEIPT_SOURCE_OPTIONS;
    return [
      'all',
      ...new Set(
        [...RECEIPT_SOURCE_OPTIONS, ...PAYMENT_SOURCE_OPTIONS].filter((k) => k !== 'all'),
      ),
    ];
  }, [isPayments, isReceipts]);

  const methodComboOptions = useMemo(() => {
    const list = Array.isArray(methodOptions) ? methodOptions : [];
    const hasAll = list.some((m) => String(m.id) === 'all');
    const base = hasAll
      ? list
      : [{ id: 'all', label: t('txlog.allMethods') }, ...list];
    return base.map((m) => ({
      id: String(m.id),
      label: String(m.id) === 'all' ? t('txlog.allMethods') : m.label || m.id,
    }));
  }, [methodOptions, t]);

  const branchComboOptions = useMemo(
    () => [
      { id: 'all', label: t('txlog.allBranches') },
      ...branches.map((b) => ({ id: String(b.id), label: b.name || String(b.id) })),
    ],
    [branches, t],
  );

  const userComboOptions = useMemo(
    () => [
      { id: 'all', label: t('txlog.allUsers') },
      ...users.map((u) => ({ id: String(u.id), label: formatFilterUserLabel(u) })),
    ],
    [users, t],
  );

  useEffect(() => {
    let cancelled = false;
    setMethodsLoading(true);
    listReceiptPaymentMethods()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.methods) ? res.methods : [];
        setMethodOptions(
          list.length
            ? list.map((m) =>
                typeof m === 'string'
                  ? { id: m, label: m }
                  : { id: String(m.id ?? m.key ?? m.method), label: m.label || m.method || m.id },
              )
            : [{ id: 'all', label: t('txlog.allMethods') }],
        );
      })
      .catch(() => {
        if (!cancelled) {
          setMethodOptions([
            { id: 'all', label: t('txlog.allMethods') },
            { id: 'Cash', label: t('txlog.cash') },
            { id: 'bank', label: t('txlog.bank') },
            { id: 'petty_cash', label: t('txlog.pettyCash') },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const nextBranch = sidebarBranchToFilter(selectedBranchId);
    setBranchId(nextBranch);
    setBranchDisplay('');
    setUserDisplay('');
    setApplied((prev) => ({ ...prev, branchId: nextBranch, userId: '' }));
    setUserId('');
    setOffset(0);
  }, [selectedBranchId]);

  useEffect(() => {
    if (initialDateFrom) setDateFrom(initialDateFrom);
    if (initialDateTo) setDateTo(initialDateTo);
  }, [initialDateFrom, initialDateTo]);

  const branchScopeForUsers = branchId || undefined;

  useEffect(() => {
    listLogFilterUsers({
      branchId: branchScopeForUsers,
      ...(isReceipts || isPayments ? { excludeTechnicians: true } : {}),
    })
      .then((res) => {
        const nextUsers = res?.users ?? [];
        setUsers(nextUsers);
        setUserId((prev) => {
          if (prev && nextUsers.some((u) => String(u.id) === String(prev))) return prev;
          setUserDisplay('');
          return '';
        });
      })
      .catch(() => {
        setUsers([]);
        setUserId('');
        setUserDisplay('');
      });
  }, [branchScopeForUsers, isReceipts, isPayments]);

  const buildListParams = useCallback(
    (filters, { limit, offset: off }) => ({
      direction: direction || undefined,
      method: filters.method && filters.method !== 'all' ? filters.method : undefined,
      branchId: filters.branchId || undefined,
      userId: filters.userId || undefined,
      dateFrom: filters.dateFrom ? riyadhBoundToApiIso(filters.dateFrom, 'start') : undefined,
      dateTo: filters.dateTo ? riyadhBoundToApiIso(filters.dateTo, 'end') : undefined,
      limit,
      offset: off,
    }),
    [direction],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const sourceFilter = applied.source && applied.source !== 'all';
      const res = await listCashBankTransactionsLog(
        buildListParams(applied, {
          limit: sourceFilter ? SOURCE_FETCH_CAP : TX_LOG_PAGE_SIZE,
          offset: sourceFilter ? 0 : offset,
        }),
      );
      const raw = Array.isArray(res?.items) ? res.items : [];
      const filtered = filterRowsBySource(raw, applied.source);
      if (sourceFilter) {
        const pageRows = filtered.slice(offset, offset + TX_LOG_PAGE_SIZE);
        setRows(pageRows);
        setTotal(filtered.length);
        setTotalAmount(filtered.reduce((s, r) => s + Number(r.amount || 0), 0));
      } else {
        setRows(filtered);
        setTotal(Number(res?.total ?? filtered.length));
        const amountFromApi = Number(res?.totalAmount);
        setTotalAmount(Number.isFinite(amountFromApi) ? amountFromApi : 0);
      }
      setPayloadExtra(res && typeof res === 'object' ? res : {});
    } catch (e) {
      setRows([]);
      setTotal(0);
      setTotalAmount(0);
      setPayloadExtra({});
      setError(e?.message || t('txlog.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [applied, offset, buildListParams, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const cards = useMemo(
    () =>
      mapTxSummaryCards(isPayments ? 'out' : 'in', {
        ...payloadExtra,
        total,
        totalAmount,
      }),
    [isPayments, payloadExtra, total, totalAmount],
  );

  const cardMeta = useMemo(() => {
    const countLabel = isPayments
      ? t('txlog.card.payments')
      : isReceipts
        ? t('txlog.card.receipts')
        : t('txlog.card.rows');
    return {
      count: { label: countLabel, Icon: isPayments ? ArrowUpCircle : Receipt, money: false },
      total: { label: t('txlog.card.total'), Icon: Wallet, money: true },
      cash: { label: t('txlog.card.cash'), Icon: Banknote, money: true },
      repayments: { label: t('txlog.card.repayments'), Icon: Users, money: true },
      payroll: { label: t('txlog.card.payroll'), Icon: Users, money: true },
      advances: { label: t('txlog.card.advances'), Icon: Banknote, money: true },
    };
  }, [isPayments, isReceipts, t]);

  const applyFilters = () => {
    setApplied({
      method,
      branchId,
      userId,
      dateFrom,
      dateTo,
      source,
    });
    setOffset(0);
  };

  const showAll = () => {
    setMethod('all');
    setMethodDisplay('');
    setBranchId(sidebarBranchToFilter(selectedBranchId));
    setBranchDisplay('');
    setUserId('');
    setUserDisplay('');
    setDateFrom('');
    setDateTo('');
    setSource('all');
    setApplied({
      method: 'all',
      branchId: sidebarBranchToFilter(selectedBranchId),
      userId: '',
      dateFrom: '',
      dateTo: '',
      source: 'all',
    });
    setOffset(0);
  };

  const openInvoiceLink = useCallback(
    async (row) => {
      if (!row?.sourceId) return;
      setLinkBusyId(String(row.id));
      setError('');
      try {
        const rowBranch =
          row.account?.branchId != null && String(row.account.branchId).trim() !== ''
            ? String(row.account.branchId)
            : '';
        const scopeBranch =
          rowBranch || applied.branchId || sidebarBranchToFilter(selectedBranchId) || 'all';
        const params = workshopReportsAnalyticsParams(scopeBranch, {});
        const res = await getWorkshopRecentOrderPdf(row.sourceId, params);
        const payload =
          res && typeof res === 'object' && res.data && typeof res.data === 'object'
            ? res.data
            : res;
        const invoiceObj = mapRecentPdfToInvoice(payload);
        if (!invoiceObj) throw new Error(t('txlog.detail.invalidInvoice'));
        setInvoicePreview(invoiceObj);
      } catch (e) {
        setError(e?.message || t('txlog.detail.loadFailed'));
      } finally {
        setLinkBusyId(null);
      }
    },
    [t, applied.branchId, selectedBranchId],
  );

  const openLink = (row) => {
    const link = mapTxLink(row);
    if (!link) return;
    if (link.openInvoice) {
      openInvoiceLink(row);
      return;
    }
    if (link.href) navigate(link.href);
  };

  const pageTitle =
    title ||
    (isPayments ? t('pay.paymentsLog') : isReceipts ? t('rcpt.receiptsLog') : t('txlog.title'));

  const showAccountDr = isPayments || !direction;

  return (
    <div className="accounting-page module-container" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {!hidePageChrome ? (
        <header className="cash-bank-header">
          <p className="form-help-text" style={{ marginBottom: 4 }}>
            <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
            {' / '}
            <span>{pageTitle}</span>
          </p>
          <h2 className="cash-bank-title">
            {isReceipts ? (
              <ArrowDownCircle size={20} style={{ marginInlineEnd: 8, color: '#16A34A' }} />
            ) : null}
            {isPayments ? (
              <ArrowUpCircle size={20} style={{ marginInlineEnd: 8, color: '#DC2626' }} />
            ) : null}
            {pageTitle}
          </h2>
          {subtitle ? <p className="cash-bank-desc">{subtitle}</p> : null}
        </header>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            padding: 12,
            marginBottom: 12,
            color: '#B45309',
            background: '#FFFBEB',
            borderRadius: 8,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button type="button" className="btn-portal-outline" onClick={reload}>
            {t('adv.err.retry')}
          </button>
        </div>
      ) : null}

      <section className="acct-filter-bar">
        <div>
          <label className="form-label" htmlFor="txlog-from">
            {t('txlog.from')}
          </label>
          <input
            id="txlog-from"
            type="date"
            className="form-input-field"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="txlog-to">
            {t('txlog.to')}
          </label>
          <input
            id="txlog-to"
            type="date"
            className="form-input-field"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">{t('txlog.branch')}</label>
          <SearchableEntityCombobox
            options={branchComboOptions}
            value={branchId || 'all'}
            displayText={branchDisplay}
            onDisplayTextChange={setBranchDisplay}
            onSelect={(opt) => {
              const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
              setBranchId(next);
              setBranchDisplay('');
              setUserId('');
              setUserDisplay('');
            }}
            placeholder={t('txlog.branchSearchPh')}
            entityLabel="branch"
            maxInitial={80}
            maxFiltered={120}
            menuMinWidth={220}
          />
        </div>
        <div>
          <label className="form-label">{t('txlog.user')}</label>
          <SearchableEntityCombobox
            options={userComboOptions}
            value={userId || 'all'}
            displayText={userDisplay}
            onDisplayTextChange={setUserDisplay}
            onSelect={(opt) => {
              const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
              setUserId(next);
              setUserDisplay('');
            }}
            placeholder={t('txlog.userSearchPh')}
            entityLabel="user"
            maxInitial={80}
            maxFiltered={120}
            menuMinWidth={220}
          />
        </div>
        <div>
          <label className="form-label">{t('txlog.method')}</label>
          <SearchableEntityCombobox
            options={methodComboOptions}
            value={method}
            displayText={methodDisplay}
            onDisplayTextChange={setMethodDisplay}
            onSelect={(opt) => {
              setMethod(String(opt?.id || 'all'));
              setMethodDisplay('');
            }}
            placeholder={t('txlog.methodSearchPh')}
            entityLabel="method"
            loading={methodsLoading}
            maxInitial={80}
            maxFiltered={120}
            menuMinWidth={220}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="txlog-source">
            {t('txlog.source')}
          </label>
          <select
            id="txlog-source"
            className="form-input-field"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {sourceOptions.map((k) => (
              <option key={k} value={k}>
                {sourceLabel(t, k)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <button type="button" className="btn-submit btn-dark" onClick={applyFilters} disabled={loading}>
            <Filter size={14} style={{ marginInlineEnd: 6 }} />
            {t('txlog.apply')}
          </button>
          <button type="button" className="btn-portal-outline" onClick={showAll} disabled={loading}>
            {t('txlog.showAll')}
          </button>
        </div>
      </section>

      <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
        {cards.map((c) => {
          const meta = cardMeta[c.id] || cardMeta.total;
          const Icon = meta.Icon;
          return (
            <div key={c.id} className="acct-kpi-card">
              <div className="cash-bank-stat-icon">
                <Icon size={24} />
              </div>
              <div>
                <p className="acct-kpi-label">{meta.label}</p>
                <p className="acct-kpi-value">
                  {meta.money
                    ? t('money.sar', { n: formatSarLatn(c.value) })
                    : String(c.value ?? 0)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          className="btn-portal-outline"
          onClick={() => setShowMoreCols((v) => !v)}
        >
          {showMoreCols ? t('txlog.hideMoreCols') : t('txlog.moreCols')}
        </button>
      </div>

      <section className="premium-table cash-bank-table" ref={tableTopRef}>
        <WsTableScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header-row">
                <th className="table-th">{t('txlog.th.date')}</th>
                <th className="table-th">{t('txlog.th.ref')}</th>
                <th className="table-th">{t('txlog.th.source')}</th>
                <th className="table-th">
                  {isPayments
                    ? t('txlog.th.to')
                    : isReceipts
                      ? t('txlog.th.from')
                      : t('txlog.th.party')}
                </th>
                {!isPayments ? <th className="table-th">{t('txlog.th.method')}</th> : null}
                {showAccountDr ? <th className="table-th">{t('txlog.th.accountDr')}</th> : null}
                <th className="table-th">{t('txlog.th.amount')}</th>
                <th className="table-th">{t('txlog.th.link')}</th>
                {showMoreCols ? (
                  <>
                    <th className="table-th">{t('txlog.th.direction')}</th>
                    <th className="table-th">{t('txlog.th.account')}</th>
                    <th className="table-th">{t('txlog.th.branch')}</th>
                    <th className="table-th">{t('txlog.th.owner')}</th>
                    <th className="table-th">{t('txlog.th.description')}</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={showMoreCols ? 12 : isPayments ? 8 : 7}
                    className="table-cell table-empty"
                  >
                    {loading ? t('loading') : resolvedEmpty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const sk = mapTxSourceKey(r);
                  const link = mapTxLink(r);
                  const busy = linkBusyId === String(r.id);
                  return (
                    <tr key={r.id}>
                      <td className="table-cell">
                        {formatBusinessDate(r.entryDate || r.date || r.createdAt)}
                      </td>
                      <td className="table-cell">{r.reference || r.ref || '—'}</td>
                      <td className="table-cell">
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#EFF6FF',
                            color: '#1E40AF',
                          }}
                        >
                          {sourceLabel(t, sk)}
                        </span>
                      </td>
                      <td className="table-cell">
                        {mapTxPartyLabel(r, isPayments ? 'out' : 'in')}
                      </td>
                      {!isPayments ? (
                        <td className="table-cell">{r.method || '—'}</td>
                      ) : null}
                      {showAccountDr ? (
                        <td className="table-cell">{mapTxAccountDr(r)}</td>
                      ) : null}
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {formatSarLatn(r.amount)}
                      </td>
                      <td className="table-cell">
                        {link ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openLink(r)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#2563EB',
                              fontWeight: 600,
                              cursor: busy ? 'wait' : 'pointer',
                              textDecoration: 'underline',
                              textUnderlineOffset: 2,
                            }}
                          >
                            {busy ? t('loading') : linkLabel(t, link.kind)}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      {showMoreCols ? (
                        <>
                          <td
                            className="table-cell"
                            style={{ color: r.direction === 'in' ? '#16A34A' : '#DC2626' }}
                          >
                            {r.direction === 'in' ? t('txlog.dir.in') : t('txlog.dir.out')}
                          </td>
                          <td className="table-cell">{r.account?.name || '—'}</td>
                          <td className="table-cell">{r.account?.branchName || '—'}</td>
                          <td className="table-cell">{r.account?.ownerUserName || '—'}</td>
                          <td className="table-cell">{r.description || '—'}</td>
                        </>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </WsTableScroll>
        <PaginationControls
          total={total}
          limit={TX_LOG_PAGE_SIZE}
          offset={offset}
          loading={loading}
          onPageChange={(nextOffset) => {
            setOffset(nextOffset);
            tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      </section>

      {invoicePreview ? (
        <section
          ref={invoicePanelRef}
          className="acct-panel"
          data-testid="txlog-invoice-detail-panel"
          role="region"
          aria-label={t('txlog.detail.title', {
            no: invoicePreview.invoiceNo || invoicePreview.invoiceId || '',
          })}
          style={{ marginTop: 16, padding: 16 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
              {t('txlog.detail.title', {
                no: invoicePreview.invoiceNo || invoicePreview.invoiceId || '—',
              })}
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-portal-outline"
                onClick={async () => {
                  try {
                    await downloadPosInvoicePdf(invoicePreview);
                  } catch (e) {
                    setError(e?.message || t('txlog.detail.pdfFailed'));
                  }
                }}
              >
                <Printer size={14} style={{ marginInlineEnd: 6 }} />
                {t('btn.print')}
              </button>
              <button
                type="button"
                className="btn-submit btn-dark"
                onClick={() => setInvoicePreview(null)}
                aria-label={t('txlog.detail.close')}
              >
                <X size={14} style={{ marginInlineEnd: 6 }} />
                {t('txlog.detail.close')}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
            <CashierTaxInvoiceView invoice={invoicePreview} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
