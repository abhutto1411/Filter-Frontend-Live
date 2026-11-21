import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileUp, X } from 'lucide-react';
import { txImportTemplateCsv } from '../../../utils/txImport';

const TYPE_BADGE = {
    payment: { code: 'PE', bg: '#FEE2E2', fg: '#B91C1C' },
    receipt: { code: 'RV', bg: '#E0F2FE', fg: '#0369A1' },
    journal: { code: 'JE', bg: '#EDE9FE', fg: '#6D28D9' },
};

function downloadTemplate() {
    const blob = new Blob([txImportTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * "Enter many at once" card on the Transactions page: import a CSV / Excel file (or a
 * saved batch draft) into the SAME Payment / Receipt / Journal forms. Each group is
 * opened in its form, reviewed and saved with that form's own buttons.
 */
export default function TxImportPanel({
    t,
    imported,
    activeKey,
    busy = false,
    batchesRoute,
    onFile,
    onOpen,
    onClear,
    registerName,
    branchName,
    /** Accept a file dropped anywhere on the card. */
    dropzone = false,
    /** Draw attention to the import action (opened from "Import CSV / Excel"). */
    highlight = false,
}) {
    const fileRef = useRef(null);
    const [showIssues, setShowIssues] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const entries = imported?.entries || [];
    const issues = imported?.issues || [];
    const savedCount = entries.filter((e) => e.status === 'saved').length;

    const dropProps = dropzone
        ? {
              onDragOver: (e) => {
                  e.preventDefault();
                  if (!dragOver) setDragOver(true);
              },
              onDragLeave: (e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
              },
              onDrop: (e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer?.files?.[0];
                  if (f && !busy) onFile?.(f);
              },
          }
        : {};

    return (
        <section
            className={`acct-panel tx-import-panel${highlight ? ' is-highlight' : ''}${dragOver ? ' is-drag' : ''}`}
            data-testid="tx-import-panel"
            {...dropProps}
        >
            <div className="tx-import-head">
                <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>{t('tx.bulk.title')}</strong>
                    <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.45 }}>{t('tx.bulk.blurb2')}</p>
                    {dropzone ? (
                        <p className="tx-import-drop" data-testid="tx-import-drop">
                            {dragOver ? t('tx.imp.dropNow') : t('tx.imp.dropHint')}
                        </p>
                    ) : null}
                </div>
                <div className="tx-import-actions">
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.txt,.xlsx,.xls,text/csv"
                        hidden
                        data-testid="tx-import-file"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) onFile?.(f);
                        }}
                    />
                    <button
                        type="button"
                        className="btn-submit btn-dark"
                        disabled={busy}
                        onClick={() => fileRef.current?.click()}
                        data-testid="tx-import-btn"
                    >
                        <FileUp size={14} /> {busy ? t('tx.imp.reading') : t('tx.imp.btn')}
                    </button>
                    <button type="button" className="btn-portal-outline" onClick={downloadTemplate}>
                        <Download size={14} /> {t('tx.imp.template')}
                    </button>
                    {batchesRoute ? (
                        <Link to={batchesRoute} className="btn-portal-outline" style={{ textDecoration: 'none' }}>
                            {t('tx.bulk.batches')}
                        </Link>
                    ) : null}
                </div>
            </div>

            {imported ? (
                <div className="tx-import-body" data-testid="tx-import-result">
                    <div className="tx-import-summary">
                        <span>
                            {imported.source?.kind === 'draft'
                                ? t('tx.imp.draftTitle', { no: imported.source.batchNo || imported.source.batchId, n: imported.counts?.loaded ?? 0 })
                                : t('tx.imp.summary', {
                                      name: imported.source?.name || '',
                                      rows: imported.counts?.rows ?? 0,
                                      loaded: imported.counts?.loaded ?? 0,
                                      skipped: imported.counts?.skipped ?? 0,
                                  })}
                        </span>
                        <button type="button" className="tx-import-clear" onClick={onClear} aria-label={t('tx.imp.clear')}>
                            <X size={14} /> {t('tx.imp.clear')}
                        </button>
                    </div>
                    {imported.source?.kind === 'draft' ? (
                        <p className="tx-import-note">{t('tx.imp.draftHint')}</p>
                    ) : null}
                    {imported.notice ? (
                        <p className={`tx-import-note ${imported.noticeTone === 'error' ? 'is-err' : 'is-ok'}`} role="status">
                            {imported.notice}
                        </p>
                    ) : null}

                    {entries.length ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table tx-import-table">
                                <thead>
                                    <tr>
                                        <th>{t('tx.imp.th.type')}</th>
                                        <th>{t('tx.imp.th.register')}</th>
                                        <th style={{ textAlign: 'end' }}>{t('tx.imp.th.lines')}</th>
                                        <th style={{ textAlign: 'end' }}>{t('tx.imp.th.total')}</th>
                                        <th>{t('tx.imp.th.problems')}</th>
                                        <th>{t('tx.imp.th.status')}</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((e) => {
                                        const b = TYPE_BADGE[e.type] || TYPE_BADGE.payment;
                                        const isOpen = activeKey === e.key;
                                        const where =
                                            e.type === 'journal'
                                                ? branchName?.(e.header.branchId) || t('tx.allBranches')
                                                : registerName?.(e.header.cashAccountId) ||
                                                  (e.header.registerName
                                                      ? `${e.header.registerName} ⚠`
                                                      : t('tx.imp.noRegister'));
                                        return (
                                            <tr key={e.key} data-testid={`tx-import-entry-${e.type}`} className={isOpen ? 'is-open' : ''}>
                                                <td>
                                                    <span className="tx-import-badge" style={{ background: b.bg, color: b.fg }}>
                                                        {b.code}
                                                    </span>
                                                </td>
                                                <td style={{ minWidth: 160 }}>{where}</td>
                                                <td style={{ textAlign: 'end' }}>{e.rows.length}</td>
                                                <td style={{ textAlign: 'end' }} dir="ltr">{e.total}</td>
                                                <td>
                                                    {e.issues.length ? (
                                                        <span className="tx-import-warn">{t('tx.imp.problems', { n: e.issues.length })}</span>
                                                    ) : (
                                                        <span className="tx-import-ok">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`tx-import-status is-${isOpen ? 'open' : e.status}`}>
                                                        {t(`tx.imp.status.${isOpen ? 'open' : e.status}`)}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'end' }}>
                                                    {e.status !== 'saved' ? (
                                                        <button
                                                            type="button"
                                                            className="btn-portal-outline"
                                                            onClick={() => onOpen?.(e)}
                                                            data-testid={`tx-import-open-${e.type}`}
                                                        >
                                                            {isOpen ? t('tx.imp.reopen') : t('tx.imp.open')}
                                                        </button>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : null}

                    {entries.length && savedCount === entries.length ? (
                        <p className="tx-import-note is-ok">{t('tx.imp.allSaved')}</p>
                    ) : null}

                    {issues.length ? (
                        <div className="tx-import-issues">
                            <button type="button" className="tx-import-clear" onClick={() => setShowIssues((v) => !v)}>
                                {t('tx.imp.issuesToggle', { n: issues.length })}
                            </button>
                            {showIssues ? (
                                <ul data-testid="tx-import-issues">
                                    {issues.map((it, i) => (
                                        <li key={`${it.line}-${it.key}-${i}`}>
                                            {it.line ? `${t('tx.imp.line', { line: it.line })}: ` : ''}
                                            {t(it.key, { value: it.value ?? '' })}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}

            <style>{`
                .tx-import-panel { margin-bottom: 14px; padding: 14px; border: 1px solid #E2E8F0; border-radius: 12px; background: #F8FAFC; transition: border-color .15s, background .15s; }
                .tx-import-panel.is-highlight { border: 2px solid #F59E0B; background: #FFFBEB; }
                .tx-import-panel.is-drag { border: 2px dashed #0F172A; background: #F1F5F9; }
                .tx-import-drop { margin: 8px 0 0; font-size: 12px; color: #64748B; }
                .tx-import-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; justify-content: space-between; }
                .tx-import-actions { display: flex; flex-wrap: wrap; gap: 8px; }
                .tx-import-actions button, .tx-import-actions a { display: inline-flex; align-items: center; gap: 6px; }
                .tx-import-body { margin-top: 12px; border-top: 1px solid #E2E8F0; padding-top: 12px; }
                .tx-import-summary { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #0F172A; flex-wrap: wrap; }
                .tx-import-clear { border: 0; background: transparent; color: #475569; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; }
                .tx-import-note { margin: 8px 0; font-size: 12px; color: #475569; }
                .tx-import-note.is-ok { color: #047857; font-weight: 600; }
                .tx-import-note.is-err { color: #B91C1C; font-weight: 600; }
                .tx-import-table { width: 100%; margin-top: 8px; font-size: 13px; }
                .tx-import-table tr.is-open td { background: #FFFBEB; }
                .tx-import-badge { display: inline-block; padding: 3px 8px; border-radius: 8px; font-weight: 800; font-size: 12px; }
                .tx-import-warn { color: #B45309; font-weight: 600; }
                .tx-import-ok { color: #94A3B8; }
                .tx-import-status { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #E2E8F0; color: #334155; white-space: nowrap; }
                .tx-import-status.is-open { background: #FEF3C7; color: #92400E; }
                .tx-import-status.is-saved { background: #DCFCE7; color: #166534; }
                .tx-import-issues ul { margin: 6px 0 0; padding-inline-start: 18px; font-size: 12px; color: #92400E; max-height: 180px; overflow: auto; }
            `}</style>
        </section>
    );
}
