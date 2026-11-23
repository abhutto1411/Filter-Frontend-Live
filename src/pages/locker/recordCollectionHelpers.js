import { compactTaxId, corporateVatError } from '../../utils/saudiTaxId.js';
import { expenseLineAccounting, expenseVatTooHigh } from '../../utils/collectionExpenseVat.js';

/** BE RecordCollectionDto: ArrayMaxSize(10) on `expenses`. */
export const MAX_STAGE_A_EXPENSE_LINES = 10;

export function newRecordIdempotencyKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function newExpenseLine(overrides = {}) {
    const key =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `exp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
        key,
        expenseAccountId: '',
        purposeId: '',
        purposeLabel: '',
        description: '',
        gross: '',
        vat: '',
        supplierVatNumber: '',
        billNo: '',
        branchId: '',
        proofUrl: '',
        proofPreview: null,
        proofName: '',
        ...overrides,
    };
}

const ARABIC_DIGIT_RE = /[٠-٩۰-۹]/g;
const toAsciiDigit = (d) => {
    const code = d.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return d;
};

/**
 * Money text input (no native spinner): Arabic-Indic digits → ASCII,
 * digits + one decimal point only, at most 2 decimals.
 */
export function sanitizeMoneyInput(raw) {
    let s = String(raw ?? '')
        .replace(ARABIC_DIGIT_RE, toAsciiDigit)
        .replace(/[٫,]/g, '.')
        .replace(/[^\d.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
        const [whole, frac = ''] = s.split('.');
        s = `${whole}.${frac.slice(0, 2)}`;
    }
    return s;
}

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

/**
 * Parse a money string (incl. Arabic-Indic digits) to integer halalas (½-up at 3rd decimal).
 */
export function toHalalas(str) {
    let s = String(str ?? '')
        .replace(ARABIC_DIGIT_RE, toAsciiDigit)
        .replace(/[٫,]/g, '.')
        .replace(/[^\d.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    if (!s || s === '.') return 0;
    const [wholeRaw, fracRaw = ''] = s.split('.');
    const whole = parseInt(wholeRaw || '0', 10);
    if (!Number.isFinite(whole)) return 0;
    const digits = fracRaw.replace(/\D/g, '');
    const two = digits.slice(0, 2).padEnd(2, '0');
    const third = digits.charAt(2);
    let halas = whole * 100 + parseInt(two, 10);
    if (third >= '5') halas += 1;
    return halas;
}

export function halalasToSar(h) {
    if (h == null || !Number.isFinite(h)) return null;
    return h / 100;
}

/** Whether the user typed cash received (empty = not entered; "0" is valid). */
export function isReceivedAmountEntered(raw) {
    return String(raw ?? '').trim() !== '';
}

export function sumExpenseGrossHalalas(lines) {
    if (!Array.isArray(lines)) return 0;
    return lines.reduce((s, ln) => s + toHalalas(ln?.gross), 0);
}

export function sumExpenseGross(lines) {
    return sumExpenseGrossHalalas(lines) / 100;
}

/** Integer halalas: counted − received − expenseGrossHalalas */
export function pickupVarianceHalalas(counted, received, expenseGrossHalalas) {
    const c = counted == null || counted === '' ? null : toHalalas(counted);
    const r = received == null || received === '' ? null : toHalalas(received);
    const e = Number(expenseGrossHalalas);
    if (c == null || r == null || !Number.isFinite(e)) return null;
    return c - r - e;
}

/** SAR wrapper for UI that expects decimal riyals. */
export function pickupVarianceSar(counted, received, expenseGrossOrLines) {
    const expenseH =
        typeof expenseGrossOrLines === 'number' && Number.isFinite(expenseGrossOrLines)
            ? expenseGrossOrLines
            : sumExpenseGrossHalalas(expenseGrossOrLines);
    return halalasToSar(pickupVarianceHalalas(counted, received, expenseH));
}

export function mergeOpenDetailFormState(prev, requestId) {
    return { ...prev, requestId: String(requestId) };
}

/**
 * Per-field problems for one Stage A expense line (mirrors BE recordCollection checks):
 * gross > 0 with ≤ 2 decimals; 0 ≤ VAT ≤ gross; supplier VAT number, when typed, must be a
 * valid Saudi VAT number (only then is input VAT claimable to 1310); receipt required.
 * Values are i18n keys except `vatNumber`, which is the localized saudiTaxId message.
 */
export function stageAExpenseLineErrors(ln, locale = 'en', vatPercent = 15) {
    const errors = {};
    const g = String(ln?.gross ?? '').trim();
    const v = String(ln?.vat ?? '').trim();
    if (!MONEY_RE.test(g) || toHalalas(g) <= 0) errors.gross = 'record.expense.errGross';
    if (v !== '' && (!MONEY_RE.test(v) || (MONEY_RE.test(g) && toHalalas(v) > toHalalas(g)))) {
        errors.vat = 'record.expense.errVat';
    } else if (MONEY_RE.test(g) && expenseVatTooHigh(ln, vatPercent)) {
        errors.vat = 'record.expense.errVatTooHigh';
    }
    const vatNoErr = corporateVatError(ln?.supplierVatNumber, locale);
    if (vatNoErr) errors.vatNumber = vatNoErr;
    if (!String(ln?.expenseAccountId || '').trim()) {
        errors.expenseAccountId = 'record.expense.accountRequired';
    }
    return errors;
}

/** True when VAT was typed but no (valid) supplier VAT number → VAT stays in the expense cost. */
export function stageAVatNotClaimable(ln) {
    const v = Number(ln?.vat);
    if (!(v > 0)) return false;
    const vatNo = compactTaxId(ln?.supplierVatNumber);
    return !vatNo || Boolean(corporateVatError(vatNo, 'en'));
}

export function stageAExpensesValid(lines, vatPercent = 15) {
    if (!Array.isArray(lines) || lines.length === 0) return false;
    if (lines.length > MAX_STAGE_A_EXPENSE_LINES) return false;
    return lines.every((ln) => Object.keys(stageAExpenseLineErrors(ln, 'en', vatPercent)).length === 0);
}

/**
 * Expense lines for the "on approval" journal preview: chosen account, and how the
 * approval will split it (valid supplier VAT number → net to the account + VAT to 1310;
 * otherwise the whole gross to the account).
 */
export function expensesForJournalPreview(lines, { branchLabelFor } = {}) {
    if (!Array.isArray(lines)) return [];
    return lines
        .filter((ln) => Number(ln?.gross) > 0)
        .map((ln) => {
            const a = expenseLineAccounting(ln);
            return {
                amount: Number(ln.gross),
                code: ln?.expenseAccountCode || undefined,
                name: ln?.expenseAccountName || undefined,
                vatAmount: a.claimable ? a.vatDebitH / 100 : 0,
                expenseAmount: Number.isFinite(a.expenseDebitH) ? a.expenseDebitH / 100 : Number(ln.gross),
                branchLabel: branchLabelFor ? branchLabelFor(ln) : undefined,
            };
        });
}

/**
 * POST /locker/record-collection `expenses` — BE field names
 * (RecordCollectionExpenseLineDto: expensePurposeId, grossAmount, vatAmount, note,
 * proofUrl, supplierVatNumber, billNo, category). Money as 2-dp strings.
 */
export function buildStageAExpensesPayload(lines) {
    if (!Array.isArray(lines)) return [];
    return lines.map((ln) => {
        const vatNo = compactTaxId(ln?.supplierVatNumber);
        const vatRaw = String(ln?.vat ?? '').trim();
        const proof = String(ln?.proofUrl || '').trim();
        return {
            expenseAccountId: ln?.expenseAccountId ? String(ln.expenseAccountId) : undefined,
            expensePurposeId: ln?.purposeId ? String(ln.purposeId) : undefined,
            category: String(ln?.purposeLabel || '').trim() || undefined,
            note: String(ln?.description || ln?.note || '').trim() || undefined,
            grossAmount: (toHalalas(ln?.gross || 0) / 100).toFixed(2),
            vatAmount: (toHalalas(vatRaw === '' ? 0 : vatRaw) / 100).toFixed(2),
            supplierVatNumber: vatNo || undefined,
            billNo: String(ln?.billNo || '').trim() || undefined,
            branchId: ln?.branchId ? String(ln.branchId) : undefined,
            proofUrl: proof || undefined,
        };
    });
}