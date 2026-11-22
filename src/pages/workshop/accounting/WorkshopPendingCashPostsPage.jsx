import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listPendingCashPosts,
  postPendingCashPost,
} from '../../../services/workshopAccountingApi';
import CashBalanceHint from '../../../components/accounting/CashBalanceHint';
import { useCashBalance } from '../../../hooks/useCashBalance';
import { handleCashGuard409 } from '../../../hooks/useCashBalance';
import { accT } from '../../../utils/accountingI18n';
import WsTableScroll from '../../../components/workshop/WsTableScroll';

const SAR = '⃁';

function fmt2(n) {
  const v = Number(n);
  return `${SAR}${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
}

function RowPostButton({ row, locale, busyId, onPost }) {
  const bal = useCashBalance({
    cashBankAccountId: row?.payFrom?.id,
    enabled: Boolean(row?.payFrom?.id),
  });
  const blocked = !row.canPost || bal.available == null
    ? !row.canPost
    : Number(bal.available) + 0.0000001 < Number(row.amount) && !bal.allowNegative;
  const isAr = String(locale).toLowerCase().startsWith('ar');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
      <CashBalanceHint
        locale={locale}
        available={bal.available ?? row.available}
        required={row.amount}
        allowNegative={bal.allowNegative}
        loading={bal.loading}
      />
      <button
        type="button"
        className="btn-submit btn-dark"
        disabled={busyId === row.id || blocked}
        onClick={() => onPost(row)}
      >
        {busyId === row.id
          ? isAr
            ? 'جاري الترحيل…'
            : 'Posting…'
          : isAr
            ? 'ترحيل'
            : 'Post'}
      </button>
    </div>
  );
}

export default function WorkshopPendingCashPostsPage({
  locale = 'en',
  selectedBranchId,
}) {
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const isAr = String(locale).toLowerCase().startsWith('ar');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listPendingCashPosts({
        ...(selectedBranchId && selectedBranchId !== 'all'
          ? { branchId: String(selectedBranchId) }
          : {}),
      });
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (err) {
      setRows([]);
      setError(err?.message || (isAr ? 'تعذر التحميل' : 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPost = async (row) => {
    setBusyId(row.id);
    setError('');
    try {
      const res = await postPendingCashPost('transaction', row.id);
      if (res?.result === 'noop' || res?.result === 'posted' || res?.success) {
        await load();
      }
    } catch (err) {
      const msg = handleCashGuard409(err, locale)?.message || err?.message;
      setError(msg || (isAr ? 'فشل الترحيل' : 'Post failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="module-container" dir={isAr ? 'rtl' : 'ltr'}>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 6 }}>
        <Link to="/workshop/accounting/cash-bank">
          {isAr ? 'النقد والبنك' : 'Cash & Bank'}
        </Link>
        {' / '}
        {isAr ? 'مسودات بانتظار الترحيل' : 'Saved / pending post'}
      </div>
      <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>
        {isAr ? 'المدفوعات والإيصالات فقط' : 'Payments & receipts only'}
        {rows.length ? (
          <span className="ws-badge ws-badge--yellow" style={{ marginInlineStart: 8 }}>
            {rows.length}
          </span>
        ) : null}
      </h2>
      <p style={{ fontSize: 13, color: '#64748B', marginTop: 0 }}>
        {isAr
          ? 'مسودات المدفوعات والإيصالات فقط. الترحيل يطبّق حارس الرصيد.'
          : 'Draft payments and receipts only. Posting re-checks the cash guard.'}
      </p>
      {error ? (
        <p role="alert" style={{ color: '#991B1B' }}>
          {error}
        </p>
      ) : null}
      {loading ? <p>{t('accSettings.loading')}</p> : null}
      {!loading ? (
        <WsTableScroll>
          <table className="ws-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{isAr ? 'النوع' : 'Kind'}</th>
                <th>{isAr ? 'المرجع' : 'Ref'}</th>
                <th>{isAr ? 'المستفيد' : 'Payee'}</th>
                <th>{isAr ? 'المبلغ' : 'Amount'}</th>
                <th>{isAr ? 'الدفع من' : 'Pay from'}</th>
                <th>{isAr ? 'ترحيل' : 'Post'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: '#64748B' }}>
                    {isAr ? 'لا توجد مسودات.' : 'No pending drafts.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.transactionType || row.kind}</td>
                    <td>{row.ref}</td>
                    <td>{row.payee}</td>
                    <td>{fmt2(row.amount)}</td>
                    <td>{row.payFrom?.name || '—'}</td>
                    <td>
                      <RowPostButton
                        row={row}
                        locale={locale}
                        busyId={busyId}
                        onPost={onPost}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </WsTableScroll>
      ) : null}
    </div>
  );
}
