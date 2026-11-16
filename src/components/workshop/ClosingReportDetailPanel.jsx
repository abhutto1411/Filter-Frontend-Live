import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import RiyalIcon from '../RiyalIcon';
import './ClosingReportDetailPanel.css';

const MINUS = '\u2212';

const BUCKETS = [
    { labelKey: 'force.cat.cash', system: 'systemCash', physical: 'physicalCash', diff: 'diffCash' },
    { labelKey: 'force.cat.bank', system: 'systemBank', physical: 'physicalBank', diff: 'diffBank' },
    { labelKey: 'force.cat.corporate', system: 'systemCorporate', physical: 'physicalCorporate', diff: 'diffCorporate' },
    { labelKey: 'force.cat.tamara', system: 'systemTamara', physical: 'physicalTamara', diff: 'diffTamara' },
    { labelKey: 'force.cat.tabby', system: 'systemTabby', physical: 'physicalTabby', diff: 'diffTabby' },
    { labelKey: 'closing.cat.othersEmp', system: 'systemOthers', physical: 'physicalOthers', diff: 'diffOthers', highlight: true },
];

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const formatTime = (epochMs, fallback, emdash) => {
    if (epochMs != null && Number.isFinite(Number(epochMs))) {
        return new Date(Number(epochMs)).toLocaleString();
    }
    if (fallback) return String(fallback);
    return emdash;
};

/** Display diff as physical − system (same sign as GL cashDiff). */
const lineDiff = (report, systemKey, physicalKey, diffKey) => {
    const system = toNum(report[systemKey]);
    const physical = toNum(report[physicalKey]);
    const diff =
        report[diffKey] != null && report[diffKey] !== ''
            ? toNum(report[diffKey])
            : physical - system;
    return { system, physical, diff };
};

function RiyalAmt({ value, color }) {
    const d = toNum(value);
    const sign = d < 0 ? MINUS : d > 0 ? '+' : '';
    return (
        <bdi dir="ltr">
            <span style={{ fontWeight: 800, color, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', textAlign: 'end' }}>
                {sign}
                <RiyalIcon size={13} />
                {Math.abs(d).toFixed(2)}
            </span>
        </bdi>
    );
}

function DiffCell({ value, t, orangeShort = false }) {
    const d = toNum(value);
    const balanced = Math.abs(d) < 0.01;
    const word = balanced ? null : d < 0 ? t('closing.word.short') : t('closing.word.over');
    const color = balanced
        ? 'var(--color-text-muted)'
        : d < 0
          ? orangeShort
            ? '#C2410C'
            : '#B91C1C'
          : '#15803D';
    return (
        <span style={{ fontWeight: 800, color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {balanced ? t('emdash') : (
                <>
                    <span
                        style={{
                            fontSize: 10,
                            textTransform: 'uppercase',
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: `${color}18`,
                        }}
                    >
                        {word}
                    </span>
                    <RiyalAmt value={d} color={color} />
                </>
            )}
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

/** Inline closing-report detail (expandable row / panel). */
export default function ClosingReportDetailPanel({ report, t, onClose }) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!report) return null;

    const totalDiff = toNum(report.reconciliationTotalDifference);
    const balanced = Math.abs(totalDiff) < 0.01;
    const cashLine = lineDiff(report, 'systemCash', 'physicalCash', 'diffCash');
    const bankLine = lineDiff(report, 'systemBank', 'physicalBank', 'diffBank');
    const statusLabel = balanced
        ? t('closing.status.balanced')
        : totalDiff < 0
          ? t('closing.status.short')
          : t('closing.word.over');
    const statusColor = balanced ? '#15803D' : totalDiff < 0 ? '#B91C1C' : '#15803D';
    const oppositeSigns =
        Math.abs(cashLine.diff) >= 0.01 &&
        Math.abs(bankLine.diff) >= 0.01 &&
        cashLine.diff * bankLine.diff < 0;
    const mixup =
        oppositeSigns &&
        Math.abs(totalDiff) < Math.min(Math.abs(cashLine.diff), Math.abs(bankLine.diff));
    const wordFor = (d) =>
        Math.abs(d) < 0.01 ? t('closing.status.balanced') : d < 0 ? t('closing.word.short') : t('closing.word.over');
    const colorFor = (d, orangeCash = false) =>
        Math.abs(d) < 0.01 ? '#64748b' : d < 0 ? (orangeCash ? '#C2410C' : '#B91C1C') : '#15803D';
    const em = t('emdash');

    const openedAt = formatTime(report.openedAtEpochMs, report.openedAt ?? report.startTime, em);
    const closedAt = formatTime(report.closedAtEpochMs, report.closedAt ?? report.endTime, em);

    return (
        <div
            className="cash-bank-stat-card"
            style={{ margin: 0, padding: 16 }}
            data-testid="pos-closing-detail-panel"
            role="region"
            aria-label={t('closing.title', { name: report.cashierName || em })}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                    {t('closing.title', { name: report.cashierName || em })}
                </h3>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onClose}
                    aria-label={t('btn.close')}
                    style={{ height: 32, padding: '0 10px' }}
                >
                    <X size={14} />
                </button>
            </div>

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
                <MetaItem label={t('th.cashier')} value={report.cashierName || em} />
                <MetaItem label={t('th.branch')} value={report.branchName || em} />
                <MetaItem label={t('closing.closingId')} value={report.closingId || em} />
                <div>
                    <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('th.status')}</p>
                    <span className="ws-badge ws-badge--blue">{report.shiftStatus || t('status.closed')}</span>
                </div>
                <MetaItem label={t('closing.openedAt')} value={openedAt} />
                <MetaItem label={t('closing.closedAt')} value={closedAt} />
                <MetaItem
                    label={t('closing.glStatus')}
                    value={report.glLabel || (report.glStatus ? t(`closing.gl.${report.glStatus}`, { reason: report.glReason || em }) : em)}
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem' }}>{t('closing.paymentRecon')}</p>
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
                            <th>{t('force.th.category')}</th>
                            <th style={{ textAlign: 'end' }}>{t('closing.th.system')}</th>
                            <th style={{ textAlign: 'end' }}>{t('force.th.physical')}</th>
                            <th style={{ textAlign: 'end' }}>{t('th.totalDifference')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {BUCKETS.map(({ labelKey, system, physical, diff: diffKey, highlight }) => {
                            const { system: sys, physical: phy, diff } = lineDiff(report, system, physical, diffKey);
                            return (
                                <tr key={labelKey} style={highlight ? { background: '#FFFBEB' } : undefined}>
                                    <td style={{ fontWeight: highlight ? 700 : 500 }}>{t(labelKey)}</td>
                                    <td style={{ textAlign: 'end' }}><RiyalAmt value={sys} color="#0f172a" /></td>
                                    <td style={{ textAlign: 'end', fontWeight: 700 }}><RiyalAmt value={phy} color="#0f172a" /></td>
                                    <td style={{ textAlign: 'end' }}>
                                        <DiffCell value={diff} t={t} orangeShort={system === 'systemCash'} />
                                    </td>
                                </tr>
                            );
                        })}
                        <tr style={{ fontWeight: 900, borderTop: '2px solid #e2e8f0' }}>
                            <td>{t('closing.total')}</td>
                            <td style={{ textAlign: 'end' }}><RiyalAmt value={toNum(report.systemTotalSales)} color="#0f172a" /></td>
                            <td style={{ textAlign: 'end' }}><RiyalAmt value={toNum(report.physicalTotal)} color="#0f172a" /></td>
                            <td style={{ textAlign: 'end' }}><DiffCell value={totalDiff} t={t} /></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div
                style={{
                    marginTop: 16,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: balanced ? '#DCFCE7' : cashLine.diff < -0.005 ? '#FFF7ED' : '#F0FDF4',
                    border: `1px solid ${balanced ? '#86EFAC' : cashLine.diff < -0.005 ? '#FDBA74' : '#86EFAC'}`,
                }}
            >
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {balanced ? (
                        t('closing.balancedMsg')
                    ) : (
                        <>
                            <span style={{ color: colorFor(cashLine.diff, true) }}>
                                {t('force.cat.cash')} {wordFor(cashLine.diff)}{' '}
                                <RiyalAmt value={cashLine.diff} color={colorFor(cashLine.diff, true)} />
                            </span>
                            <span aria-hidden="true">·</span>
                            <span style={{ color: colorFor(bankLine.diff) }}>
                                {t('force.cat.bank')} {wordFor(bankLine.diff)}{' '}
                                <RiyalAmt value={bankLine.diff} color={colorFor(bankLine.diff)} />
                            </span>
                            <span aria-hidden="true">·</span>
                            <span style={{ color: colorFor(totalDiff) }}>
                                {t('closing.net')} {wordFor(totalDiff)}{' '}
                                <RiyalAmt value={totalDiff} color={colorFor(totalDiff)} />
                            </span>
                        </>
                    )}
                </p>
                {mixup ? (
                    <p className="closing-mixup-callout">
                        {t('closing.mixup')}
                    </p>
                ) : null}
                {report.glStatus === 'queued' || report.glStatus === 'failed' ? (
                    <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#B91C1C', fontWeight: 700 }}>
                        {report.glLabel || t(`closing.gl.${report.glStatus}`, { reason: report.glReason || em })}
                    </p>
                ) : report.glStatus === 'clean' ? (
                    <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#15803D' }}>
                        {t('closing.gl.clean')}
                    </p>
                ) : null}
                {report.commissionStatus === 'failed' && report.commissionError ? (
                    <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#B91C1C', fontWeight: 700 }}>
                        {t('closing.commissionFailed', { reason: report.commissionError })}
                    </p>
                ) : null}
                {toNum(report.systemCategorySum) > 0 && Math.abs(toNum(report.systemCategorySum) - toNum(report.systemTotalSales)) > 0.01 ? (
                    <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        {t('closing.categorySum', { amount: toNum(report.systemCategorySum).toFixed(2) })}
                    </p>
                ) : null}
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-portal-outline" onClick={onClose}>
                    {t('btn.close')}
                </button>
            </div>
        </div>
    );
}
