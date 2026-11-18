import React, { useMemo, useState } from 'react';

/**
 * Shared Branch / Month / Format / Language download dialog for salary & advance sheets.
 */
export default function PayrollSheetDownloadDialog({
  open,
  title,
  t,
  branches = [],
  defaultBranchId = 'all',
  defaultMonth = '',
  showDateRange = false,
  busy = false,
  error = '',
  onClose,
  onDownload,
}) {
  const [branchId, setBranchId] = useState(defaultBranchId || 'all');
  const [month, setMonth] = useState(defaultMonth || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState('pdf');
  const [language, setLanguage] = useState('en+ar');

  const opts = useMemo(
    () => [
      { id: 'all', name: t('adv.allBranches') },
      ...branches.map((b) => ({ id: String(b.id), name: b.name })),
    ],
    [branches, t],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 11000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          width: 'min(480px, 100%)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>{title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            {t('pr.filter.branch')}
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
            >
              {opts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            {t('pr.sheet.month')}
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
            />
          </label>
          {showDateRange ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                {t('pr.sheet.from')}
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
                />
              </label>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                {t('pr.sheet.to')}
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
                />
              </label>
            </div>
          ) : null}
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            {t('pr.sheet.format')}
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            {t('pr.sheet.language')}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
            >
              <option value="en+ar">EN + AR</option>
              <option value="en">EN</option>
              <option value="ar">AR</option>
            </select>
          </label>
        </div>
        {error ? (
          <p role="alert" style={{ color: '#B45309', fontSize: 13, marginTop: 10 }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn-portal-outline" onClick={onClose} disabled={busy}>
            {t('adv.confirm.no')}
          </button>
          <button
            type="button"
            className="btn-submit btn-dark"
            disabled={busy}
            onClick={() =>
              onDownload({
                branchId: branchId === 'all' ? '' : branchId,
                month,
                from,
                to,
                format,
                language,
              })
            }
          >
            {t('pr.sheet.download')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function isPayrollSheetReady(status) {
  const s = String(status || '').toLowerCase();
  return s === 'approved' || s === 'paid' || s === 'partially_paid';
}

export function isAdvanceSheetReady(row) {
  const s = String(row?.status || '').toLowerCase();
  return s === 'approved' && (row?.journalId != null && String(row.journalId) !== '');
}
