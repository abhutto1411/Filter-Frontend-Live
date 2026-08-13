import React from 'react';
import Modal from '../Modal';

const BUCKETS = [
    { label: 'Cash Account', system: 'systemCash', physical: 'physicalCash' },
    { label: 'Bank / Cards', system: 'systemBank', physical: 'physicalBank' },
    { label: 'Corporate', system: 'systemCorporate', physical: 'physicalCorporate' },
    { label: 'Tamara', system: 'systemTamara', physical: 'physicalTamara' },
    { label: 'Tabby', system: 'systemTabby', physical: 'physicalTabby' },
    { label: 'Others (Employees)', system: 'systemOthers', physical: 'physicalOthers', highlight: true },
];

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const formatTime = (epochMs, fallback) => {
    if (epochMs != null && Number.isFinite(Number(epochMs))) {
        return new Date(Number(epochMs)).toLocaleString();
    }
    if (fallback) return String(fallback);
    return '—';
};

/** Display diff as system − physical (short if positive). */
const lineDiff = (report, systemKey, physicalKey) => {
    const system = toNum(report[systemKey]);
    const physical = toNum(report[physicalKey]);
    return { system, physical, diff: system - physical };
};

function DiffCell({ value }) {
    const d = toNum(value);
    const balanced = Math.abs(d) < 0.01;
    const color = balanced ? 'var(--color-text-muted)' : d > 0 ? '#B91C1C' : '#15803D';
    return (
        <span style={{ fontWeight: 800, color }}>
            {balanced ? '—' : `${d > 0 ? '−' : '+'} SAR ${Math.abs(d).toFixed(2)}`}
        </span>
    );
}

function MetaItem({ label, value }) {
    return (
        <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{value}</p>
        </div>
    );
}

export default function ClosingReportDetailModal({ report, onClose }) {
    if (!report) return null;

    const totalDiff = toNum(report.reconciliationTotalDifference);
    const balanced = Math.abs(totalDiff) < 0.01;
    const statusLabel = balanced ? 'BALANCED' : totalDiff > 0 ? 'SHORT' : 'EXCESS';
    const statusColor = balanced ? '#15803D' : totalDiff > 0 ? '#B91C1C' : '#15803D';

    const openedAt = formatTime(report.openedAtEpochMs, report.openedAt ?? report.startTime);
    const closedAt = formatTime(report.closedAtEpochMs, report.closedAt ?? report.endTime);

    return (
        <Modal
            title={`Closing report — ${report.cashierName || 'Cashier'}`}
            onClose={onClose}
            width={760}
            contentClassName="closing-report-detail-modal"
            footer={(
                <button type="button" className="btn-portal" onClick={onClose}>
                    Close
                </button>
            )}
        >
            <div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 16,
                        marginBottom: 20,
                        padding: '14px 16px',
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                    }}
                >
                    <MetaItem label="Cashier" value={report.cashierName || '—'} />
                    <MetaItem label="Branch" value={report.branchName || '—'} />
                    <MetaItem label="Closing ID" value={report.closingId || '—'} />
                    <div>
                        <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 }}>Status</p>
                        <span className="ws-badge ws-badge--blue">{report.shiftStatus || 'CLOSED'}</span>
                    </div>
                    <MetaItem label="Opened at" value={openedAt} />
                    <MetaItem label="Closed at" value={closedAt} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem' }}>Payment reconciliation</p>
                    <span
                        style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            color: statusColor,
                            background: `${statusColor}14`,
                            border: `1px solid ${statusColor}33`,
                        }}
                    >
                        {statusLabel}
                    </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table" style={{ margin: 0 }}>
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th style={{ textAlign: 'right' }}>System</th>
                                <th style={{ textAlign: 'right' }}>Physical</th>
                                <th style={{ textAlign: 'right' }}>Difference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {BUCKETS.map(({ label, system, physical, highlight }) => {
                                const { system: sys, physical: phy, diff } = lineDiff(report, system, physical);
                                return (
                                    <tr
                                        key={label}
                                        style={highlight ? { background: '#FFFBEB' } : undefined}
                                    >
                                        <td style={{ fontWeight: highlight ? 700 : 500 }}>{label}</td>
                                        <td style={{ textAlign: 'right' }}>SAR {sys.toFixed(2)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {phy.toFixed(2)}</td>
                                        <td style={{ textAlign: 'right' }}><DiffCell value={diff} /></td>
                                    </tr>
                                );
                            })}
                            <tr style={{ fontWeight: 900, borderTop: '2px solid #e2e8f0' }}>
                                <td>Total</td>
                                <td style={{ textAlign: 'right' }}>SAR {toNum(report.systemTotalSales).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>SAR {toNum(report.physicalTotal).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}><DiffCell value={totalDiff} /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div
                    style={{
                        marginTop: 16,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: balanced ? '#DCFCE7' : '#FFF7ED',
                        border: `1px solid ${balanced ? '#86EFAC' : '#FDBA74'}`,
                    }}
                >
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem' }}>
                        {balanced
                            ? 'Shift balanced — system and physical totals match.'
                            : `Total difference (system − physical): SAR ${totalDiff.toFixed(2)}`}
                    </p>
                    {toNum(report.systemCategorySum) > 0 && Math.abs(toNum(report.systemCategorySum) - toNum(report.systemTotalSales)) > 0.01 && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                            System category sum: SAR {toNum(report.systemCategorySum).toFixed(2)}
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
}
