export const INVENTORY_ADJUSTMENT_REASON_OPENING_QTY = 'Opening qty';
export const INVENTORY_ADJUSTMENT_REASON_INFINITE_QTY = 'Infinite qty';

export const INVENTORY_ADJUST_REASON_OPTIONS = [
    { value: INVENTORY_ADJUSTMENT_REASON_OPENING_QTY, label: 'Opening qty' },
    { value: INVENTORY_ADJUSTMENT_REASON_INFINITE_QTY, label: 'Infinite qty' },
    { value: 'Damaged Stock', label: 'Damaged Stock' },
    { value: 'Inventory Count Correction', label: 'Inventory Count Correction' },
    { value: 'Expired Item', label: 'Expired Item' },
    { value: 'Returns/Exchanges', label: 'Returns/Exchanges' },
    { value: 'Other', label: 'Other (Manual Entry)' },
];
