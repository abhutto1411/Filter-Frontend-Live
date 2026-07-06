import { exportRowsToExcel, exportRowsToPdf } from './tableExport';

const EXPORT_HEADERS = [
    'When',
    'Product',
    'SKU',
    'Reason / note',
    'Purchase value (SAR)',
    'Price source',
    'Stock before',
    'Stock after',
    'Value before (SAR)',
    'Value after (SAR)',
    'Diff qty',
    'Diff value (SAR)',
    'Changed by',
];

function fmtPlain(n, decimals = 2) {
    if (n == null || n === '' || Number.isNaN(Number(n))) return '';
    return Number(n).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function fmtSignedQtyPlain(n) {
    if (n == null || Number.isNaN(Number(n))) return '';
    const v = Number(n);
    if (v === 0) return '0';
    return v > 0 ? `+${v}` : String(v);
}

function fmtSignedSarPlain(n) {
    if (n == null || Number.isNaN(Number(n))) return '';
    const v = Number(n);
    if (v === 0) return '0.00';
    const sign = v > 0 ? '+' : '-';
    return `${sign}${fmtPlain(Math.abs(v))}`;
}

export function buildAdjustmentExportRows(adjustments, { metricsForRow, formatWhen, displayCell }) {
    return (adjustments || []).map((row) => {
        const m = metricsForRow(row);
        const pr = row.product ?? {};
        const source =
            pr.purchasePriceSource === 'last_purchase'
                ? 'Last purchase'
                : pr.purchasePriceSource === 'profile'
                  ? 'Product profile'
                  : '';
        return [
            formatWhen(row),
            displayCell(pr.name),
            displayCell(pr.sku),
            displayCell(row.note),
            fmtPlain(m.purchasePrice),
            source,
            m.beforeQty,
            m.afterQty,
            fmtPlain(m.valueBefore),
            fmtPlain(m.valueAfter),
            fmtSignedQtyPlain(m.diffQty),
            fmtSignedSarPlain(m.diffValue),
            displayCell(row.actor),
        ];
    });
}

function buildSubtitle({ workshop, branch, from, to, kpis }) {
    const parts = [];
    if (workshop) parts.push(`Workshop: ${workshop}`);
    if (branch) parts.push(`Branch: ${branch}`);
    if (from || to) parts.push(`Period: ${from || '…'} to ${to || '…'}`);
    if (kpis) {
        parts.push(
            `Total value before: SAR ${fmtPlain(kpis.totalValueBefore)} · after: SAR ${fmtPlain(kpis.totalValueAfter)} · difference: ${fmtSignedSarPlain(kpis.totalDiffValue)} (qty ${fmtSignedQtyPlain(kpis.totalDiffQty)})`,
        );
    }
    return parts.join(' · ');
}

export function exportAdjustmentReportPdf({
    adjustments,
    metricsForRow,
    formatWhen,
    displayCell,
    workshop,
    branch,
    from,
    to,
    kpis,
}) {
    exportRowsToPdf({
        title: 'Inventory adjustment report',
        subtitle: buildSubtitle({ workshop, branch, from, to, kpis }),
        headers: EXPORT_HEADERS,
        rows: buildAdjustmentExportRows(adjustments, { metricsForRow, formatWhen, displayCell }),
        filenameBase: 'inventory-adjustment-report',
    });
}

export function exportAdjustmentReportExcel({
    adjustments,
    metricsForRow,
    formatWhen,
    displayCell,
    workshop,
    branch,
}) {
    const slug = (v) =>
        String(v ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'branch';
    exportRowsToExcel({
        sheetName: 'Adjustments',
        headers: EXPORT_HEADERS,
        rows: buildAdjustmentExportRows(adjustments, { metricsForRow, formatWhen, displayCell }),
        filenameBase: `inventory-adjustments-${slug(workshop)}-${slug(branch)}`,
    });
}
