import React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { money } from './SupplierAccountingShared';

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.12)',
};

const summaryCardStyle = {
    padding: 14,
    borderRadius: 12,
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
};

const summaryLabelStyle = {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
};

const summaryValueStyle = {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#0F172A',
};

function fmtMoneyCell(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Shared ledger statement layout (opening balance, dated lines, period totals, export).
 * Used by Chart of Accounts drill-down and non-affiliated customer ledger.
 */
export default function AccountLedgerStatement({
    loading = false,
    error = '',
    accountLabel = '',
    accountLabelCaption = 'Ledger account',
    currentBalanceLabel = 'Current balance',
    currentBalanceText,
    companyName,
    periodFrom = '—',
    periodTo = '—',
    openingBalance = 0,
    rows = [],
    totals,
    dateFrom = '',
    dateTo = '',
    onDateFromChange,
    onDateToChange,
    onApply,
    onClear,
    onExportPdf,
    onExportExcel,
    exportDisabled = false,
    showCashLedgerColumns = false,
    counterpartyColumnLabel = 'Paid to / Received from',
    offsetAccountColumnLabel = 'Expense / AR account',
    filterOptions = null,
    partyFilterKey = '',
    onPartyFilterKeyChange,
    offsetAccountFilterId = '',
    onOffsetAccountFilterIdChange,
    children,
}) {
    const parties = filterOptions?.parties ?? [];
    const offsetAccounts = filterOptions?.offsetAccounts ?? [];
    const colSpan = showCashLedgerColumns ? 7 : 5;
    return (
        <>
            {error ? (
                <div
                    style={{
                        marginBottom: 12,
                        padding: 10,
                        borderRadius: 8,
                        fontSize: '0.8125rem',
                        color: '#B91C1C',
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                    }}
                >
                    {error}
                </div>
            ) : null}

            {accountLabel ? (
                <div
                    style={{
                        marginBottom: 16,
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                    }}
                >
                    <div
                        style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#64748B',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        {accountLabelCaption}
                    </div>
                    <div
                        style={{
                            fontWeight: 800,
                            fontSize: '1.2rem',
                            marginTop: 6,
                            color: '#0F172A',
                            lineHeight: 1.35,
                        }}
                    >
                        {accountLabel}
                    </div>
                </div>
            ) : null}

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid var(--color-border, #e2e8f0)',
                    background: '#F8FAFC',
                }}
            >
                <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>
                        {currentBalanceLabel}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 4 }}>
                        {currentBalanceText || money(0)}
                    </div>
                </div>
                {companyName ? (
                    <div style={{ flex: '1 1 200px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>
                            Your business
                        </div>
                        <div style={{ fontWeight: 600, marginTop: 4 }}>{companyName}</div>
                    </div>
                ) : null}
                <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>
                        Statement period
                    </div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                        {periodFrom} — {periodTo}
                    </div>
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'flex-end',
                    marginBottom: 16,
                }}
            >
                <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>From</div>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => onDateFromChange?.(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>To</div>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => onDateToChange?.(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <button
                    type="button"
                    className="btn-portal"
                    onClick={onApply}
                    disabled={loading}
                >
                    {loading ? 'Loading…' : 'Apply filters'}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onClear}
                    disabled={loading}
                >
                    Clear filters
                </button>
                {showCashLedgerColumns ? (
                    <div style={{ minWidth: 240, flex: '1 1 240px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>
                            Party (payment / receipt)
                        </div>
                        <select
                            value={partyFilterKey}
                            onChange={(e) =>
                                onPartyFilterKeyChange?.(e.target.value)
                            }
                            style={inputStyle}
                        >
                            <option value="">All parties</option>
                            {parties.map((p) => (
                                <option key={p.key} value={p.key}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
                {showCashLedgerColumns ? (
                    <div style={{ minWidth: 240, flex: '1 1 240px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>
                            Expense / AR account
                        </div>
                        <select
                            value={offsetAccountFilterId}
                            onChange={(e) =>
                                onOffsetAccountFilterIdChange?.(e.target.value)
                            }
                            style={inputStyle}
                        >
                            <option value="">All accounts</option>
                            {offsetAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.label}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
                <div style={{ flex: 1, minWidth: 12 }} />
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onExportPdf}
                    disabled={exportDisabled || loading}
                >
                    <FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Download PDF
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onExportExcel}
                    disabled={exportDisabled || loading}
                >
                    <FileSpreadsheet size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Download Excel
                </button>
            </div>

            <div
                style={{
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: 16,
                }}
            >
                <table className="ws-table" style={{ margin: 0 }}>
                    <thead>
                        <tr>
                            <th style={{ width: 110 }}>Date</th>
                            {showCashLedgerColumns ? (
                                <>
                                    <th>{counterpartyColumnLabel}</th>
                                    <th>{offsetAccountColumnLabel}</th>
                                </>
                            ) : null}
                            <th>Description</th>
                            <th style={{ width: 120, textAlign: 'right' }}>Debit</th>
                            <th style={{ width: 120, textAlign: 'right' }}>Credit</th>
                            <th style={{ width: 130, textAlign: 'right' }}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                            <td>—</td>
                            {showCashLedgerColumns ? (
                                <>
                                    <td>—</td>
                                    <td>—</td>
                                </>
                            ) : null}
                            <td>Opening balance</td>
                            <td style={{ textAlign: 'right' }}>—</td>
                            <td style={{ textAlign: 'right' }}>—</td>
                            <td style={{ textAlign: 'right' }}>{money(openingBalance)}</td>
                        </tr>
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24 }}>
                                    Loading ledger…
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24 }}>
                                    No transactions in this period.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                                    {showCashLedgerColumns ? (
                                        <>
                                            <td
                                                style={{ maxWidth: 200 }}
                                                title={r.counterpartyLabel || ''}
                                            >
                                                {r.counterpartyLabel || '—'}
                                            </td>
                                            <td
                                                style={{ maxWidth: 240 }}
                                                title={r.offsetAccountLabel || ''}
                                            >
                                                {r.offsetAccountLabel || '—'}
                                            </td>
                                        </>
                                    ) : null}
                                    <td>{r.description || '—'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.debit > 0 ? money(r.debit) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.credit > 0 ? money(r.credit) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{money(r.runningBalance)}</td>
                                </tr>
                            ))
                        )}
                        {totals ? (
                            <tr
                                style={{
                                    background: '#FFF7ED',
                                    fontWeight: 800,
                                    borderTop: '1px solid #FED7AA',
                                }}
                            >
                                <td />
                                {showCashLedgerColumns ? (
                                    <>
                                        <td />
                                        <td />
                                    </>
                                ) : null}
                                <td>Closing summary</td>
                                <td style={{ textAlign: 'right' }}>{money(totals.totalDebit)}</td>
                                <td style={{ textAlign: 'right' }}>{money(totals.totalCredit)}</td>
                                <td style={{ textAlign: 'right' }}>{money(totals.closingBalance)}</td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>

            {totals ? (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 12,
                        marginBottom: children ? 16 : 0,
                    }}
                >
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>Total Debit</div>
                        <div style={{ ...summaryValueStyle, color: '#B91C1C' }}>
                            {money(totals.totalDebit)}
                        </div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>Total Credit</div>
                        <div style={{ ...summaryValueStyle, color: '#0F766E' }}>
                            {money(totals.totalCredit)}
                        </div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>Closing Balance</div>
                        <div style={summaryValueStyle}>{money(totals.closingBalance)}</div>
                    </div>
                </div>
            ) : null}

            {children}
        </>
    );
}

export { fmtMoneyCell };
