export const SF_SALES_INVOICE_TYPES = [
    'storage_fee',
    'stock_sale',
    'withdrawal_to_owner',
];

export const SF_PURCHASE_INVOICE_TYPES = ['stock_purchase'];

export function sfInvoiceTypeLabel(type) {
    switch (type) {
        case 'storage_fee':
            return 'Storage fee';
        case 'stock_sale':
            return 'Stock sale';
        case 'withdrawal_to_owner':
            return 'Withdrawal to warehouse';
        case 'stock_purchase':
            return 'Stock purchase';
        default:
            return type || '—';
    }
}
