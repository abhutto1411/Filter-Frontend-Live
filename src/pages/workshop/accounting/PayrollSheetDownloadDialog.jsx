import { validateSheetFilters } from './payrollSheetFilters';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';


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
  mode = 'salary',
  downloadLabel,
  busy = false,
  error = '',
  isRtl = false,
  onClose,
  onDownload,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const [branchId, setBranchId] = useState(defaultBranchId || 'all');
  const [month, setMonth] = useState(defaultMonth || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState('pdf');
  const [language, setLanguage] = useState('en+ar');
  const [localError, setLocalError] = useState('');

  // Reset the form whenever the dialog (re)opens (adjust during render, no effect).
  const openKey = open ? `open|${defaultBranchId}|${defaultMonth}` : 'closed';
  const [lastOpenKey, setLastOpenKey] = useState(openKey);
  if (lastOpenKey !== openKey) {
    setLastOpenKey(openKey);
    if (open) {
      setBranchId(defaultBranchId || 'all');
      setMonth(defaultMonth || '');
      setFrom('');
      setTo('');
      setFormat('pdf');
      setLanguage('en+ar');
      setLocalError('');
    }
  }

  const opts = useMemo(
    () => [
      { id: 'all', name: t('adv.allBranches') },
      ...branches.map((b) => ({ id: String(b.id), name: b.name })),
    ],
    [branches, t],
  );

  const downloadText =
    downloadLabel ||
    (mode === 'advance' ? t('pr.sheet.advDownload') : t('pr.sheet.download'));

  const trapFocus = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const nodes = [...focusable].filter((el) => !el.disabled);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [busy, onClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    const first = panelRef.current?.querySelector('button, input, select');
    first?.focus();
    return undefined;
  }, [open]);

  if (!open) return null;

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  };

  const fieldLabel = {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748B',
    display: 'block',
  };

  const handleDownload = () => {
    const v = validateSheetFilters({ month, from, to, showDateRange, mode });
    if (!v.ok) {
      if (v.code === 'range') setLocalError(t('pr.sheet.err.range'));
      else setLocalError(t('pr.sheet.err.filterRequired'));
      return;
    }
    setLocalError('');
    onDownload({
      branchId: branchId === 'all' ? '' : branchId,
      month,
      from,
      to,
      format,
      language,
    });
  };

  const displayError = localError || error;

  return (
    <div
      role="presentation"
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
      onClick={() => {
        if (!busy) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          width: 'min(560px, 100%)',
          maxHeight: 'min(90vh, 640px)',
          overflow: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <h3 id={titleId} style={{ margin: '0 0 12px', fontSize: 18 }}>
          {title}
        </h3>
        <div style={gridStyle}>
          <label style={fieldLabel}>
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
          <label style={fieldLabel}>
            {t('pr.sheet.month')}
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
            />
          </label>
          {showDateRange || mode === 'advance' ? (
            <>
              <label style={fieldLabel}>
                {t('pr.sheet.from')}
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
                />
              </label>
              <label style={fieldLabel}>
                {t('pr.sheet.to')}
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 36 }}
                />
              </label>
            </>
          ) : null}
          <label style={fieldLabel}>
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
          <label style={fieldLabel}>
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
        {displayError ? (
          <p role="alert" style={{ color: '#B45309', fontSize: 13, marginTop: 10 }}>
            {displayError}
          </p>
        ) : null}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 16,
            flexWrap: 'wrap',
          }}
        >
          <button type="button" className="btn-portal-outline" onClick={onClose} disabled={busy}>
            {t('adv.confirm.no')}
          </button>
          <button
            type="button"
            className="btn-submit btn-dark"
            disabled={busy}
            onClick={handleDownload}
          >
            {busy ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid rgba(255,255,255,0.35)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                {downloadText}
              </span>
            ) : (
              downloadText
            )}
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
  const posted =
    s === 'approved' || s === 'partial' || s === 'settled';
  return posted && row?.journalId != null && String(row.journalId) !== '';
}

