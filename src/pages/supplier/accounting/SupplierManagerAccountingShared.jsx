import { unwrapSupplierAccountingList } from '../../../services/supplierAccountingApi';
import { coaNetBalance, money } from './SupplierAccountingShared';

export function unwrapPayload(res) {
    if (!res || typeof res !== 'object') return res;
    if (res.success && res.data !== undefined) return res.data;
    return res;
}

export function extractArray(res, keys = []) {
    const body = unwrapPayload(res);
    if (Array.isArray(body)) return body;
    if (body && typeof body === 'object') {
        for (const k of keys) {
            if (Array.isArray(body[k])) return body[k];
        }
    }
    if (res && typeof res === 'object') {
        for (const k of keys) {
            if (Array.isArray(res[k])) return res[k];
        }
    }
    return [];
}

export function journalBalance(debit, credit) {
    const d = Math.round((Number(debit) || 0) * 100) / 100;
    const c = Math.round((Number(credit) || 0) * 100) / 100;
    const difference = Math.round((d - c) * 100) / 100;
    return {
        debit: d,
        credit: c,
        difference,
        balanced: Math.abs(difference) < 0.005,
    };
}

export function isManualJournal(j) {
    return Boolean(j && (j.origin === 'manual' || j.source === 'manual_journal'));
}

export function canEditManualJournal(j) {
    return isManualJournal(j) && String(j.status || '') !== 'void';
}

export function journalsFrom(res) {
    const body = unwrapPayload(res);
    if (Array.isArray(body?.journals)) return body;
    if (Array.isArray(body)) return { journals: body, total: body.length };
    return { journals: [], total: Number(body?.total || 0), ...body };
}

export function accountsFrom(res) {
    return unwrapSupplierAccountingList(unwrapPayload(res) || res);
}

export function cashLabel(a, locale = 'en') {
    const rd = Number(a.closingDebit) || 0;
    const rc = Number(a.closingCredit) || 0;
    const bal = coaNetBalance(a.type, rd, rc);
    return `[${a.code}] ${a.name} — ${money(bal, 'SAR', { locale })}`;
}

export function findAccountByCode(accounts, code) {
    return (accounts || []).find((a) => String(a.code || '').trim() === String(code));
}

export function findArAccountId(accounts, kind) {
    const leaves = (accounts || []).filter((a) => !a.hasChildren && !a.isCashEquivalent);
    const code = kind === 'external' ? '1110' : '1100';
    const byCode = findAccountByCode(leaves, code);
    if (byCode?.id) return String(byCode.id);
    const needle = kind === 'external' ? /non-affiliated.*receivable/i : /affiliated.*receivable/i;
    const byName = leaves.find((a) => needle.test(String(a.name || '')));
    return byName?.id ? String(byName.id) : '';
}

export function findApAccountId(accounts) {
    const leaves = (accounts || []).filter((a) => !a.hasChildren && !a.isCashEquivalent);
    const byCode = findAccountByCode(leaves, '2000');
    if (byCode?.id) return String(byCode.id);
    const byName = leaves.find((a) => /payable.*super/i.test(String(a.name || '')));
    return byName?.id ? String(byName.id) : '';
}

export function partyFromPaidBy(paidBy, payeeValue) {
    if (paidBy === 'affiliated') {
        const [kind, id] = String(payeeValue || '').split('|');
        if (kind === 'branch' && id) return { partyType: 'branch', partyId: id };
        if (kind === 'workshop' && id) return { partyType: 'workshop', partyId: id };
        return {};
    }
    if (paidBy === 'nonaff' && payeeValue) {
        return { partyType: 'external_party', externalPartyId: String(payeeValue) };
    }
    if (paidBy === 'super' && payeeValue) {
        return { partyType: 'super_supplier', partyId: String(payeeValue) };
    }
    return {};
}
