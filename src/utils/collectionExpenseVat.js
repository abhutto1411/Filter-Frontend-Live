import { compactTaxId, corporateVatError } from './saudiTaxId.js';

/**
 * VAT for locker collection expense lines (Stage A record + Stage B receive).
 *
 * The officer enters the amount either including VAT (receipt total), excluding VAT
 * (net), or with no VAT. The line always stores what the API expects:
 *   gross = amount paid (VAT inclusive) · vat = VAT inside gross.
 * Rounding mirrors the backend (`splitInclusive` / `vatExclusive`, halalas, ½-up):
 *   inc: net = round(gross / (1 + r)), vat = gross − net
 *   exc: vat = round(net × r),         gross = net + vat
 * Accounting on approval: valid supplier VAT number → Dr expense net + Dr 1310 VAT;
 * otherwise VAT is not reclaimable and the whole gross is charged to the expense.
 */

export const EXPENSE_VAT_MODES = ['inc', 'exc', 'none'];
export const DEFAULT_EXPENSE_VAT_MODE = 'inc';

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

/** Money string → integer halalas (non-money → NaN). */
export function moneyToHalalas(v) {
    const s = String(v ?? '').trim();
    if (!MONEY_RE.test(s)) return NaN;
    const [w, f = ''] = s.split('.');
    return parseInt(w, 10) * 100 + parseInt(f.padEnd(2, '0'), 10);
}

export function halalasToMoney(h) {
    if (!Number.isFinite(h)) return '';
    const neg = h < 0;
    const a = Math.abs(Math.round(h));
    return `${neg ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

function rate(ratePercent) {
    const r = Number(ratePercent);
    return Number.isFinite(r) && r > 0 ? r : 0;
}

/** VAT contained in a VAT-inclusive gross (halalas). */
export function inclusiveVatHalalas(grossH, ratePercent) {
    const r = rate(ratePercent);
    if (!(grossH > 0) || r <= 0) return 0;
    const netH = Math.round(grossH / (1 + r / 100));
    return grossH - netH;
}

/** VAT on a net amount (halalas). */
export function exclusiveVatHalalas(netH, ratePercent) {
    const r = rate(ratePercent);
    if (!(netH > 0) || r <= 0) return 0;
    return Math.round((netH * r) / 100);
}

/**
 * Amounts for one line from what the user typed.
 * `vatOverride` (string) = VAT typed by hand (supplier invoice rounding); '' / null = computed.
 * → { grossH, vatH, netH } (NaN when the amount is not valid money).
 */
export function computeExpenseVat({ amount, mode = DEFAULT_EXPENSE_VAT_MODE, ratePercent = 15, vatOverride = null }) {
    const amountH = moneyToHalalas(amount);
    if (!Number.isFinite(amountH)) return { grossH: NaN, vatH: NaN, netH: NaN };
    const m = EXPENSE_VAT_MODES.includes(mode) ? mode : DEFAULT_EXPENSE_VAT_MODE;
    if (m === 'none') return { grossH: amountH, vatH: 0, netH: amountH };
    const overrideH =
        vatOverride != null && String(vatOverride).trim() !== '' ? moneyToHalalas(vatOverride) : null;
    if (m === 'inc') {
        const vatH = overrideH != null ? overrideH : inclusiveVatHalalas(amountH, ratePercent);
        return { grossH: amountH, vatH, netH: amountH - vatH };
    }
    const vatH = overrideH != null ? overrideH : exclusiveVatHalalas(amountH, ratePercent);
    return { grossH: amountH + vatH, vatH, netH: amountH };
}

/** Normalised view of a line (older lines carry only gross/vat → treated as "Inc. VAT"). */
export function expenseLineVatState(line) {
    const mode = EXPENSE_VAT_MODES.includes(line?.amountMode) ? line.amountMode : DEFAULT_EXPENSE_VAT_MODE;
    const amount = line?.amount != null ? String(line.amount) : String(line?.gross ?? '');
    return { mode, amount, vatEdited: Boolean(line?.vatEdited) };
}

/**
 * Patch for a line after the amount / mode / VAT field changed.
 * `change` = { amount } | { amountMode } | { vat } (hand-typed VAT).
 * Returns { amount, amountMode, vatEdited, gross, vat } (gross/vat as 2-dp strings or '').
 */
export function expenseVatPatch(line, change, ratePercent = 15) {
    const cur = expenseLineVatState(line);
    const amount = change.amount != null ? String(change.amount) : cur.amount;
    const mode = change.amountMode != null ? change.amountMode : cur.mode;
    let vatEdited = cur.vatEdited;
    let vatOverride = cur.vatEdited ? String(line?.vat ?? '') : null;
    if (change.amount != null || change.amountMode != null) {
        vatEdited = false; // amount / mode changed → recompute VAT
        vatOverride = null;
    }
    if (change.vat != null) {
        vatEdited = String(change.vat).trim() !== '';
        vatOverride = vatEdited ? String(change.vat) : null;
    }
    const { grossH, vatH } = computeExpenseVat({ amount, mode, ratePercent, vatOverride });
    const vatText =
        change.vat != null && vatEdited
            ? String(change.vat) // keep what is being typed ("1.", "1.5")
            : Number.isFinite(vatH)
              ? halalasToMoney(vatH)
              : '';
    return {
        amount,
        amountMode: mode,
        vatEdited,
        gross: Number.isFinite(grossH) && grossH > 0 ? halalasToMoney(grossH) : amount === '' ? '' : String(amount),
        vat: mode === 'none' ? '0.00' : vatText,
    };
}

/** Supplier VAT number usable for an input-VAT claim (ZATCA: 15 digits, starts/ends with 3). */
export function isClaimableVatNumber(raw) {
    const v = compactTaxId(raw);
    return Boolean(v) && !corporateVatError(v, 'en');
}

/**
 * How the approval journal will treat the line:
 *   { grossH, vatH, netH, claimable, expenseDebitH, vatDebitH }
 * claimable only with VAT > 0 and a valid supplier VAT number.
 */
export function expenseLineAccounting(line) {
    const grossH = moneyToHalalas(line?.gross);
    const vatRaw = String(line?.vat ?? '').trim();
    const vatH = vatRaw === '' ? 0 : moneyToHalalas(vatRaw);
    if (!Number.isFinite(grossH) || !Number.isFinite(vatH)) {
        return { grossH: NaN, vatH: NaN, netH: NaN, claimable: false, expenseDebitH: NaN, vatDebitH: 0 };
    }
    const claimable = vatH > 0 && vatH < grossH && isClaimableVatNumber(line?.supplierVatNumber);
    return {
        grossH,
        vatH,
        netH: grossH - vatH,
        claimable,
        expenseDebitH: claimable ? grossH - vatH : grossH,
        vatDebitH: claimable ? vatH : 0,
    };
}

/** VAT above the VAT contained in gross (+1 halala invoice rounding) — rejected by the API. */
export function expenseVatTooHigh(line, ratePercent = 15) {
    const grossH = moneyToHalalas(line?.gross);
    const vatH = moneyToHalalas(String(line?.vat ?? '').trim() || '0');
    if (!Number.isFinite(grossH) || !Number.isFinite(vatH) || grossH <= 0) return false;
    return vatH > inclusiveVatHalalas(grossH, ratePercent) + 1;
}
