/** Split datetime-local value into YYYY-MM-DD (local date part). */
export function datetimeLocalToYmd(value) {
    if (value == null || String(value).trim() === '') return '';
    const s = String(value);
    const datePart = s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '';
}

/** datetime-local → ISO string for promotion start/end */
export function datetimeLocalToIso(value) {
    if (value == null || String(value).trim() === '') return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
}

const STRATEGY_SLUG = {
    'Standard Promotion': 'standard_promotion',
    'Cross-Platform Promotion': 'cross_platform_promotion',
    'Zone-Wise Offer': 'zone_wise',
    'Loyalty Reward': 'loyalty_reward',
    'Seasonal Campaign': 'seasonal_campaign',
};

const PROMO_TYPE_SLUG = {
    'Percentage Discount': 'percentage_discount',
    'Fixed Amount Discount': 'fixed_amount_discount',
    'Buy X Get Y Free': 'buy_x_get_y',
};

export function uiStrategyToApi(label) {
    return STRATEGY_SLUG[label] || 'standard_promotion';
}

export function uiPromoTypeToApi(label) {
    return PROMO_TYPE_SLUG[label] || 'percentage_discount';
}

export function uiDiscountTypeToApi(dType) {
    if (dType === 'Fixed (SAR)') return 'amount';
    return 'percentage';
}

export function uiPromotionStatusToApi(statusLabel) {
    const s = String(statusLabel || '').toLowerCase();
    if (s === 'draft') return 'draft';
    if (s === 'scheduled') return 'pending_approval';
    if (s === 'active') return 'active';
    return 'pending_approval';
}

export function apiPromotionStatusToUiClass(status) {
    const x = String(status || '').toLowerCase();
    if (x === 'active' || x === 'approved') return 'active';
    if (x === 'draft') return 'scheduled';
    if (x === 'pending_approval') return 'pending';
    if (x === 'rejected') return 'inactive';
    return 'pending';
}

/** Map API promotion row → Promotions.jsx card shape */
export function mapPromotionRowToCard(p) {
    const val =
        p.discountType === 'percentage' ? `${p.discountValue}%` : `SAR ${p.discountValue}`;
    const lim = p.maxUsageCount != null && p.maxUsageCount > 0 ? p.maxUsageCount : '∞';
    const usage = `${p.usageCount ?? 0} / ${lim}`;
    const strategy = p.marketingStrategy?.replace(/_/g, ' ') || '—';
    const pType = p.promotionType?.replace(/_/g, ' ') || '—';
    return {
        ...p,
        _raw: p,
        val,
        usage,
        expiry: p.validTo ? String(p.validTo).slice(0, 10) : '—',
        type: `${strategy} · ${pType}`,
        strategy,
        pType,
        dType: p.discountType === 'amount' ? 'Fixed (SAR)' : 'Percentage (%)',
        dVal: p.discountValue,
        minPurchase: p.minPurchaseAmount ?? 0,
        maxUsage: p.maxUsageCount ?? 0,
        segment: p.customerSegment || 'All Customers',
        banner: p.invoiceBannerText || '',
        status: String(p.status || '').replace(/_/g, ' '),
        statusApi: p.status,
    };
}

/** Map API promo code → PromoCodes.jsx card shape */
export function mapPromoCodeRowToCard(c) {
    const now = new Date();
    const to = c.validTo ? new Date(c.validTo) : null;
    const expired = to && !Number.isNaN(to.getTime()) && to < now;
    let statusLabel = expired ? 'Expired' : c.isActive ? 'Active' : 'Inactive';
    if (expired) statusLabel = 'Expired';
    const val = c.discountType === 'percentage' ? `${c.discountValue}%` : `SAR ${c.discountValue}`;
    const lim = c.usageLimit != null && c.usageLimit > 0 ? c.usageLimit : '∞';
    const usage = `${c.usageCount ?? 0} / ${lim}`;
    return {
        ...c,
        _raw: c,
        val,
        usage,
        status: statusLabel,
        promo: c.description || '—',
        minPurchase: c.minOrderAmount ?? 0,
        min: c.minOrderAmount ?? 0,
        dType: c.discountType === 'amount' ? 'Fixed (SAR)' : 'Percentage (%)',
        dVal: c.discountValue,
        maxUsage: c.usageLimit ?? 0,
        startDate: c.validFrom ? `${c.validFrom}T00:00` : '',
        endDate: c.validTo ? `${c.validTo}T23:59` : '',
    };
}
