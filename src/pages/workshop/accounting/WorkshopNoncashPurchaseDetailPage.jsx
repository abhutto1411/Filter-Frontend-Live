import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import { useAuth } from '../../../context/AuthContext';
import {
  approveNoncashPurchase,
  getNoncashPurchase,
  getNoncashPurchaseProofBlob,
  rejectNoncashPurchase,
  reverseNoncashPurchase,
} from '../../../services/noncashPurchasesApi';
import { mergeAccountingScopeParams } from '../../../utils/accountingWorkshopScope';
import {
  listCoaAccounts,
  listExpensePurposesAdmin,
} from '../../../services/workshopAccountingApi';
import { listLocalSuppliers } from '../../../services/workshopSuppliersApi';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import CoaAccountSearchCombobox from '../../../components/accounting/CoaAccountSearchCombobox';
import {
  formatSarLatn,
  halalasToMoney,
  moneyHalalas,
  previewInclusiveVat,
} from '../../../utils/noncashReviewDisplay';
import RiyalIcon from '../../../components/RiyalIcon';
import '../../../styles/admin/AccountingPage.css';

function idFromPath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const i = parts.indexOf('noncash-purchases');
  if (i >= 0 && parts[i + 1]) return parts[i + 1];
  return null;
}

export default function WorkshopNoncashPurchaseDetailPage({
  locale: localeProp,
}) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const id = idFromPath(location.pathname);
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const canApprove =
    hasPermission('workshop.approvals.expense.approve') ||
    hasPermission('workshop.approvals.approve');
  const canAccountOverride =
    hasPermission('workshop.accounting.journal-entries.approve') ||
    hasPermission('workshop.accounting.journal-entries.create') ||
    hasPermission('accounting.journal-entries.approve');
  const canReverse =
    hasPermission('workshop.accounting.journal-entries.approve') ||
    hasPermission('workshop.accounting.journal-entries.delete') ||
    hasPermission('accounting.journal-entries.approve');

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [zoom, setZoom] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [supplierLabel, setSupplierLabel] = useState('');
  const [supplierVat, setSupplierVat] = useState('');
  const [supplierOpts, setSupplierOpts] = useState([]);
  const [purposeId, setPurposeId] = useState('');
  const [purposeLabel, setPurposeLabel] = useState('');
  const [purposeAccountId, setPurposeAccountId] = useState('');
  const [purposes, setPurposes] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [billHasVat, setBillHasVat] = useState(false);
  const [vatAmount, setVatAmount] = useState('');
  const [acceptDup, setAcceptDup] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [timeoutRetry, setTimeoutRetry] = useState(null);
  const idemRef = useRef(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    setActionErr('');
    try {
      const res = await getNoncashPurchase(id);
      setDetail(res);
      if (res?.supplier?.id) {
        setSupplierId(String(res.supplier.id));
        setSupplierLabel(res.supplier.name || '');
        setSupplierVat(res.supplier.vatNumber || '');
        setBillHasVat(Boolean(res.supplier.vatNumber));
      }
      if (res?.suggestedPurpose?.id) {
        setPurposeId(String(res.suggestedPurpose.id));
        setPurposeLabel(res.suggestedPurpose.nameEn || '');
        setPurposeAccountId(
          res.suggestedPurpose.accountId
            ? String(res.suggestedPurpose.accountId)
            : '',
        );
      }
      const pv = previewInclusiveVat(res?.amount, 15);
      setVatAmount(pv.vat);
    } catch (e) {
      setDetail(null);
      setErr(e?.message || t('nc.err.loadOne'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  function newIdemKey() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `nc-${Date.now()}`;
  }

  useEffect(() => {
    idemRef.current = newIdemKey();
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const [sup, pur, coa] = await Promise.all([
          listLocalSuppliers({ limit: 200 }),
          listExpensePurposesAdmin({}),
          listCoaAccounts('all'),
        ]);
        const sList = Array.isArray(sup?.items)
          ? sup.items
          : Array.isArray(sup?.suppliers)
            ? sup.suppliers
            : Array.isArray(sup)
              ? sup
              : [];
        setSupplierOpts(
          sList.map((s) => ({
            id: String(s.id),
            label: `${s.name || s.id}${s.vatId || s.vatNumber ? ` · VAT ${s.vatId || s.vatNumber}` : ''}`,
            vat: s.vatId || s.vatNumber || '',
            name: s.name,
          })),
        );
        const pList = Array.isArray(pur?.items)
          ? pur.items
          : Array.isArray(pur?.purposes)
            ? pur.purposes
            : Array.isArray(pur)
              ? pur
              : [];
        setPurposes(
          pList
            .filter((p) => String(p.kind || 'expense') === 'expense')
            .map((p) => ({
              id: String(p.id),
              label: `${p.nameEn || p.code}${p.coaAccountId ? ` → ${p.coaAccountId}` : ''}`,
              accountId: p.coaAccountId ? String(p.coaAccountId) : '',
              nameEn: p.nameEn,
            })),
        );
        setCoaAccounts(coa?.accounts ?? []);
      } catch {
        /* lookups optional on staging */
      }
    })();
  }, []);

  const [proofBlob, setProofBlob] = useState('');
  useEffect(() => {
    let cancelled = false;
    let url = '';
    (async () => {
      if (!detail?.hasInlineProof || !id) {
        setProofBlob('');
        return;
      }
      try {
        url = await getNoncashPurchaseProofBlob(id, mergeAccountingScopeParams({}));
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        setProofBlob(url);
      } catch {
        if (!cancelled) setProofBlob('');
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [detail?.hasInlineProof, id]);

  const photos = useMemo(() => {
    if (!detail) return [];
    if (proofBlob) return [proofBlob];
    const http = [];
    if (Array.isArray(detail.photos)) {
      for (const p of detail.photos) {
        if (/^https?:\/\//i.test(String(p))) http.push(String(p));
      }
    }
    if (detail.proofUrl && /^https?:\/\//i.test(String(detail.proofUrl))) {
      http.push(String(detail.proofUrl));
    }
    return http;
  }, [detail, proofBlob]);

  const gross = detail?.amount || '0';
  const vatClaimable = Boolean(supplierVat && billHasVat);
  const preview = useMemo(() => {
    if (!vatClaimable) {
      return {
        net: String(gross),
        vat: '0.00',
        gross: String(gross),
      };
    }
    const base = previewInclusiveVat(gross, 15);
    if (vatAmount != null && String(vatAmount).trim() !== '') {
      const vatH = moneyHalalas(vatAmount);
      const gH = moneyHalalas(gross);
      if (gH > 0 && vatH >= 0 && vatH <= gH) {
        return {
          net: halalasToMoney(gH - vatH),
          vat: halalasToMoney(vatH),
          gross: halalasToMoney(gH),
        };
      }
    }
    return base;
  }, [gross, vatAmount, vatClaimable]);

  const journalLines = useMemo(() => {
    if (detail?.journalPreview?.lines?.length) return detail.journalPreview.lines;
    const expCode = accountLabel || purposeLabel || t('nc.preview.expense');
    const lines = [
      {
        code: expCode,
        name: '',
        debit: preview.net,
        credit: '',
      },
    ];
    if (vatClaimable && Number(preview.vat) > 0) {
      lines.push({
        code: '1310',
        name: t('nc.preview.vatInput'),
        debit: preview.vat,
        credit: '',
      });
    }
    lines.push({
      code: supplierLabel || '2010',
      name: '',
      debit: '',
      credit: preview.gross,
    });
    return lines;
  }, [
    detail,
    accountLabel,
    purposeLabel,
    preview,
    vatClaimable,
    supplierLabel,
    t,
  ]);

  const status = String(detail?.status || '').toLowerCase();
  const approved = status === 'approved';

  async function onApprove() {
    if (!canApprove || !supplierId) {
      setActionErr(t('nc.err.supplierRequired'));
      return;
    }
    setBusy(true);
    setActionErr('');
    try {
      const res = await approveNoncashPurchase(id, {
        supplierId,
        purposeId: purposeId || undefined,
        accountId: accountId || undefined,
        vatMode: vatClaimable ? 'inclusive' : 'none',
        vatAmount: vatClaimable ? vatAmount : undefined,
        billNo: detail?.parsed?.billNo || undefined,
        acceptDuplicate: acceptDup || undefined,
        idempotencyKey: idemRef.current,
      });
      setTimeoutRetry(null);
      setInfo(t('nc.info.approved', { je: res?.journalId || '' }));
      idemRef.current = newIdemKey();
      await load();
    } catch (e) {
      const code = e?.code || e?.response?.data?.code;
      if (code === 'TX_TIMEOUT') {
        setActionErr(t('nc.err.txTimeout'));
        setTimeoutRetry('approve');
      } else {
        setTimeoutRetry(null);
        setActionErr(
          code === 'NONCASH_POSSIBLE_DUPLICATE'
            ? t('nc.err.duplicate')
            : e?.message || t('nc.err.approve'),
        );
        idemRef.current = newIdemKey();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!canApprove || rejectReason.trim().length < 3) {
      setActionErr(t('nc.err.reason'));
      return;
    }
    setBusy(true);
    setActionErr('');
    try {
      await rejectNoncashPurchase(id, {
        reason: rejectReason.trim(),
        idempotencyKey: idemRef.current,
      });
      setTimeoutRetry(null);
      setRejectOpen(false);
      setInfo(t('nc.info.rejected'));
      idemRef.current = newIdemKey();
      await load();
    } catch (e) {
      const code = e?.code || e?.response?.data?.code;
      if (code === 'TX_TIMEOUT') {
        setActionErr(t('nc.err.txTimeout'));
        setTimeoutRetry('reject');
      } else {
        setTimeoutRetry(null);
        setActionErr(e?.message || t('nc.err.reject'));
        idemRef.current = newIdemKey();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onReverse() {
    if (!canReverse || reverseReason.trim().length < 3) {
      setActionErr(t('nc.err.reason'));
      return;
    }
    setBusy(true);
    setActionErr('');
    try {
      await reverseNoncashPurchase(id, {
        reason: reverseReason.trim(),
        idempotencyKey: idemRef.current,
      });
      setTimeoutRetry(null);
      setReverseOpen(false);
      setInfo(t('nc.info.reversed'));
      idemRef.current = newIdemKey();
      await load();
    } catch (e) {
      const code = e?.code || e?.response?.data?.code;
      if (code === 'TX_TIMEOUT') {
        setActionErr(t('nc.err.txTimeout'));
        setTimeoutRetry('reverse');
      } else {
        setTimeoutRetry(null);
        setActionErr(e?.message || t('nc.err.reverse'));
        idemRef.current = newIdemKey();
      }
    } finally {
      setBusy(false);
    }
  }

  const parsed = detail?.parsed || {};
  const billTitle = parsed.billNo || id || '—';

  if (loading) {
    return (
      <div className="module-container" dir={dir}>
        <p role="status">{t('nc.loading')}</p>
      </div>
    );
  }

  if (err || !detail) {
    return (
      <div className="module-container" dir={dir}>
        <div role="alert" style={{ color: '#B91C1C' }}>
          {err || t('nc.err.loadOne')}{' '}
          <button type="button" className="btn-portal-outline" onClick={load}>
            {t('nc.retry')}
          </button>
        </div>
        <Link to="/workshop/accounting/noncash-purchases">{t('nc.act.backQueue')}</Link>
      </div>
    );
  }

  return (
    <div className="module-container noncash-detail-page" dir={dir}>
      <header style={{ marginBottom: 12 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
          {' / '}
          <span>{t('nc.crumb.purchases')}</span>
          {' / '}
          <Link to="/workshop/accounting/noncash-purchases">{t('nc.crumb.review')}</Link>
          {' / '}
          <span>{billTitle}</span>
        </p>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          {t('nc.title.detail', { bill: billTitle })}
        </h2>
      </header>

      {actionErr ? (
        <div role="alert" style={{ marginBottom: 10, color: '#B91C1C' }}>
          {actionErr}{' '}
          {actionErr === t('nc.err.txTimeout') ? (
            <button
              type="button"
              className="btn-portal-outline"
              disabled={busy}
              onClick={
                timeoutRetry === 'reject'
                  ? onReject
                  : timeoutRetry === 'reverse'
                    ? onReverse
                    : onApprove
              }
            >
              {t('nc.act.retry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {info ? (
        <div role="status" style={{ marginBottom: 10, color: '#166534' }}>
          {info}
        </div>
      ) : null}

      <div
        className="nc-detail-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
          gap: 16,
        }}
      >
        <div>
          <section className="acct-panel" style={{ padding: 14, marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>
              {t('nc.photo.title', { n: photos.length })}
            </h3>
            {photos.length ? (
              <div>
                <div
                  style={{
                    position: 'relative',
                    background: '#0F172A',
                    borderRadius: 8,
                    minHeight: 180,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={photos[photoIdx]}
                    alt={t('nc.photo.alt', { bill: billTitle })}
                    style={{
                      maxWidth: zoom ? '200%' : '100%',
                      maxHeight: zoom ? 480 : 280,
                      objectFit: 'contain',
                      cursor: 'zoom-in',
                    }}
                    onClick={() => setZoom((z) => !z)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={photoIdx <= 0}
                    onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="form-help-text">
                    {photoIdx + 1} / {photos.length}
                  </span>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={photoIdx >= photos.length - 1}
                    onClick={() =>
                      setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))
                    }
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => setZoom((z) => !z)}
                  >
                    <ZoomIn size={14} /> {t('nc.photo.zoom')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="form-help-text">{t('nc.photo.empty')}</p>
            )}
          </section>

          <section className="acct-panel" style={{ padding: 14, marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>{t('nc.pos.title')}</h3>
            <table className="ws-table" style={{ width: '100%' }}>
              <tbody>
                {[
                  [t('nc.pos.date'), parsed.expenseDate || '—'],
                  [
                    t('nc.pos.branchCashier'),
                    [detail.branch?.name, detail.cashier?.name]
                      .filter(Boolean)
                      .join(' · ') || '—',
                  ],
                  [
                    t('nc.pos.supplier'),
                    `${parsed.supplierName || '—'}${
                      parsed.supplierId ? ` (id ${parsed.supplierId})` : ''
                    }`,
                  ],
                  [t('nc.pos.department'), parsed.departmentName || '—'],
                  [t('nc.pos.type'), parsed.expenseType || '—'],
                  [t('nc.pos.amount'), <><bdi dir="ltr">{formatSarLatn(detail.amount)}</bdi> <RiyalIcon size={12} /></>],
                  [t('nc.pos.remarks'), parsed.remarks || '—'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="table-cell" style={{ fontWeight: 600, width: '40%' }}>
                      {k}
                    </td>
                    <td className="table-cell">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {approved || detail.links?.journalId ? (
            <section className="acct-panel" style={{ padding: 14 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>{t('nc.after.title')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {detail.links?.journalId ? (
                  <Link
                    to={`/workshop/accounting/journal-entries?id=${encodeURIComponent(
                      detail.links.journalId,
                    )}`}
                  >
                    {t('nc.after.journal')} {detail.links.journalId}
                  </Link>
                ) : null}
                {detail.links?.supplierStatementUrl ? (
                  <Link to={detail.links.supplierStatementUrl}>
                    {t('nc.after.statement')}
                  </Link>
                ) : null}
                {detail.links?.payBillPrefill ? (
                  <Link
                    to={`/workshop/accounting/payments?payeeType=Supplier&supplierId=${encodeURIComponent(
                      detail.links.payBillPrefill.supplierId || '',
                    )}&amount=${encodeURIComponent(
                      detail.links.payBillPrefill.amount || '',
                    )}&reference=${encodeURIComponent(
                      detail.links.payBillPrefill.reference || '',
                    )}`}
                  >
                    {t('nc.after.pay')}
                  </Link>
                ) : null}
                {canReverse && approved ? (
                  <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => setReverseOpen(true)}
                  >
                    {t('nc.after.reverse')}
                  </button>
                ) : null}
              </div>
              {reverseOpen ? (
                <div
                  role="group"
                  style={{
                    marginTop: 10,
                    padding: 10,
                    background: '#FEF3C7',
                    borderRadius: 8,
                  }}
                >
                  <label style={{ display: 'block' }}>
                    <span className="form-help-text">{t('nc.reverse.reason')}</span>
                    <input
                      className="form-input"
                      value={reverseReason}
                      onChange={(e) => setReverseReason(e.target.value)}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-portal-outline"
                      onClick={() => setReverseOpen(false)}
                    >
                      {t('nc.act.cancel')}
                    </button>
                    <button
                      type="button"
                      className="btn-submit btn-dark"
                      disabled={busy}
                      onClick={onReverse}
                    >
                      {t('nc.act.confirmReverse')}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <section className="acct-panel" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>
            {t('nc.approve.title', { bill: billTitle })}
          </h3>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <span className="form-help-text">{t('nc.approve.supplier')}</span>
            <SearchableEntityCombobox
              options={supplierOpts}
              value={supplierId}
              displayText={supplierLabel}
              onDisplayTextChange={setSupplierLabel}
              onSelect={(opt) => {
                setSupplierId(opt?.id ? String(opt.id) : '');
                setSupplierLabel(opt?.name || opt?.label || '');
                setSupplierVat(opt?.vat || '');
                setBillHasVat(Boolean(opt?.vat));
              }}
              placeholder={t('nc.approve.supplierPh')}
            />
            <a
              href="/workshop/accounting/suppliers"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12 }}
            >
              {t('nc.approve.createSupplier')}
            </a>
          </label>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <span className="form-help-text">{t('nc.approve.purpose')}</span>
            <SearchableEntityCombobox
              options={purposes}
              value={purposeId}
              displayText={purposeLabel}
              onDisplayTextChange={setPurposeLabel}
              onSelect={(opt) => {
                setPurposeId(opt?.id ? String(opt.id) : '');
                setPurposeLabel(opt?.nameEn || opt?.label || '');
                setPurposeAccountId(opt?.accountId || '');
              }}
              placeholder={t('nc.approve.purposePh')}
            />
          </label>

          {canAccountOverride ? (
            <label style={{ display: 'block', marginBottom: 10 }}>
              <span className="form-help-text">{t('nc.approve.account')}</span>
              <CoaAccountSearchCombobox
                accounts={coaAccounts}
                value={accountId || purposeAccountId}
                onChange={(aid) => {
                  setAccountId(aid ? String(aid) : '');
                  const hit = (coaAccounts || []).find(
                    (a) => String(a.id) === String(aid),
                  );
                  setAccountLabel(
                    hit
                      ? `${hit.code || ''} ${hit.name || ''}`.trim()
                      : '',
                  );
                }}
                placeholder={t('nc.approve.accountPh')}
              />
            </label>
          ) : null}

          <label
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              marginBottom: 10,
              opacity: supplierVat ? 1 : 0.6,
            }}
          >
            <input
              type="checkbox"
              checked={billHasVat && Boolean(supplierVat)}
              disabled={!supplierVat}
              onChange={(e) => setBillHasVat(e.target.checked)}
            />
            <span>
              {t('nc.approve.billHasVat')}
              {!supplierVat ? (
                <span className="form-help-text"> — {t('nc.approve.vatHint')}</span>
              ) : null}
            </span>
          </label>

          {vatClaimable ? (
            <label style={{ display: 'block', marginBottom: 10 }}>
              <span className="form-help-text">{t('nc.approve.vatAmount')}</span>
              <input
                className="form-input"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
              />
            </label>
          ) : null}

          <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
            <div className="acct-kpi-card">
              <p className="acct-kpi-label">{t('nc.card.net')}</p>
              <p className="acct-kpi-value"><bdi dir="ltr">{formatSarLatn(preview.net)}</bdi> <RiyalIcon size={12} /></p>
            </div>
            <div className="acct-kpi-card">
              <p className="acct-kpi-label">{t('nc.card.vat')}</p>
              <p className="acct-kpi-value"><bdi dir="ltr">{formatSarLatn(preview.vat)}</bdi> <RiyalIcon size={12} /></p>
            </div>
            <div className="acct-kpi-card">
              <p className="acct-kpi-label">{t('nc.card.gross')}</p>
              <p className="acct-kpi-value"><bdi dir="ltr">{formatSarLatn(preview.gross)}</bdi> <RiyalIcon size={12} /></p>
            </div>
          </div>

          {!vatClaimable && billHasVat ? (
            <p className="form-help-text" role="status">
              {t('nc.approve.vatNotClaimable')}
            </p>
          ) : null}

          <table className="ws-table" style={{ width: '100%', marginBottom: 12 }}>
            <thead>
              <tr>
                <th className="table-th">{t('nc.th.account')}</th>
                <th className="table-th" style={{ textAlign: 'end' }}>
                  {t('nc.th.dr')}
                </th>
                <th className="table-th" style={{ textAlign: 'end' }}>
                  {t('nc.th.cr')}
                </th>
              </tr>
            </thead>
            <tbody>
              {journalLines.map((l, i) => (
                <tr key={i}>
                  <td className="table-cell">
                    {l.code || l.accountId}
                    {l.name ? ` ${l.name}` : ''}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {l.debit ? <><bdi dir="ltr">{formatSarLatn(l.debit)}</bdi> <RiyalIcon size={12} /></> : ''}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {l.credit ? <><bdi dir="ltr">{formatSarLatn(l.credit)}</bdi> <RiyalIcon size={12} /></> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(detail.duplicateCandidates || []).length > 0 ? (
            <div
              role="alert"
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
                color: '#991B1B',
                fontSize: 13,
              }}
            >
              {t('nc.dup.warn')}
              <label style={{ display: 'flex', gap: 8, marginTop: 8, color: '#0F172A' }}>
                <input
                  type="checkbox"
                  checked={acceptDup}
                  onChange={(e) => setAcceptDup(e.target.checked)}
                />
                {t('nc.dup.accept')}
              </label>
            </div>
          ) : null}

          {!approved && status !== 'rejected' && canApprove ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className="btn-portal-outline"
                disabled={busy}
                onClick={() => setRejectOpen(true)}
              >
                {t('nc.act.reject')}
              </button>
              <button
                type="button"
                className="btn-submit btn-dark"
                disabled={busy || ((detail.duplicateCandidates || []).length > 0 && !acceptDup)}
                onClick={onApprove}
              >
                {t('nc.act.approve')}
              </button>
            </div>
          ) : null}

          {rejectOpen ? (
            <div
              role="group"
              style={{
                marginTop: 12,
                padding: 10,
                background: '#FEF3C7',
                borderRadius: 8,
              }}
            >
              <label style={{ display: 'block' }}>
                <span className="form-help-text">{t('nc.reject.reason')}</span>
                <input
                  className="form-input"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn-portal-outline"
                  onClick={() => setRejectOpen(false)}
                >
                  {t('nc.act.cancel')}
                </button>
                <button
                  type="button"
                  className="btn-submit btn-dark"
                  disabled={busy}
                  onClick={onReject}
                >
                  {t('nc.act.confirmReject')}
                </button>
              </div>
            </div>
          ) : null}

          <p style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn-portal-outline"
              onClick={() => navigate('/workshop/accounting/noncash-purchases')}
            >
              {t('nc.act.backQueue')}
            </button>
          </p>
        </section>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .nc-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
