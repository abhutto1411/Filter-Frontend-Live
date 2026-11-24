/** P-A12L — Ledger filter/cards/column helpers. */

export const LEDGER_PAGE_SIZE = 25;

export function formatSarLatn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatBusinessDate(value) {
  if (!value) return '—';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** Opening / Debit / Credit / Closing from API + computed totals (no client invent). */
export function mapLedgerSummaryCards({ opening, debit, credit, closing }) {
  return [
    { id: 'opening', value: Number(opening) || 0 },
    { id: 'debit', value: Number(debit) || 0 },
    { id: 'credit', value: Number(credit) || 0 },
    { id: 'closing', value: Number(closing) || 0 },
  ];
}

export function findAccountByCode(accounts, code) {
  const c = String(code || '').toUpperCase();
  if (!c) return null;
  return (accounts || []).find((a) => String(a.code || '').toUpperCase() === c) || null;
}

export function findEmployeeChildAccount(accounts, prefix, employeeUserId) {
  const id = String(employeeUserId || '').replace(/^(?:er|record):/i, '');
  if (!id) return null;
  const re = new RegExp(`^${prefix}-E${id}$`, 'i');
  return (accounts || []).find((a) => re.test(String(a.code || ''))) || null;
}

/**
 * Unified Account-or-employee combo options.
 * Option ids: acct:{id} | emp:{userId}:1250 | emp:{userId}:2250 | corp:{id|overage|shortage} | ap:{type}:{id}
 */
export function buildLedgerPickerOptions({
  accounts = [],
  employees = [],
  corpCustomers = [],
  apSuppliers = [],
  apType = null,
  t = (k) => k,
}) {
  const opts = [];
  const ar1110 = findAccountByCode(accounts, '1110');
  const apAff = findAccountByCode(accounts, '2001');
  const apLocal = findAccountByCode(accounts, '2010');
  const parent1250 = findAccountByCode(accounts, '1250');
  const parent2250 = findAccountByCode(accounts, '2250');

  for (const a of accounts) {
    if (a?.hasChildren || a?.isHeading) continue;
    const code = a.code || '';
    const name = a.name || '';
    opts.push({
      id: `acct:${a.id}`,
      label: `${code} · ${name}`,
      subtitle: String(a.type || 'Account'),
      searchText: `${code} ${name} ${a.type || ''}`,
      group: 'account',
      accountId: String(a.id),
    });
  }

  for (const emp of employees) {
    const userId = String(emp.id ?? emp.userId ?? '').trim();
    if (!userId) continue;
    const name = emp.name || emp.email || userId;
    const child1250 = findEmployeeChildAccount(accounts, '1250', userId) || parent1250;
    const child2250 = findEmployeeChildAccount(accounts, '2250', userId) || parent2250;
    if (child1250) {
      opts.push({
        id: `emp:${userId}:1250`,
        label: `${name} (1250-E)`,
        subtitle: child1250.code || '1250',
        searchText: `${name} 1250 advance ${userId}`,
        group: 'employee',
        accountId: String(child1250.id),
      });
    }
    if (child2250) {
      opts.push({
        id: `emp:${userId}:2250`,
        label: `${name} (2250-E)`,
        subtitle: child2250.code || '2250',
        searchText: `${name} 2250 salary ${userId}`,
        group: 'employee',
        accountId: String(child2250.id),
      });
    }
  }

  if (ar1110) {
    opts.push({
      id: 'corp:all',
      label: t('ledger.corp.all'),
      subtitle: '1110',
      searchText: 'corporate ar all 1110',
      group: 'corp',
      accountId: String(ar1110.id),
      corpParty: 'all',
    });
    opts.push({
      id: 'corp:overage',
      label: t('ledger.corp.overage'),
      subtitle: '1110',
      searchText: 'corporate overage',
      group: 'corp',
      accountId: String(ar1110.id),
      corpParty: 'overage',
    });
    opts.push({
      id: 'corp:shortage',
      label: t('ledger.corp.shortage'),
      subtitle: '1110',
      searchText: 'corporate shortage',
      group: 'corp',
      accountId: String(ar1110.id),
      corpParty: 'shortage',
    });
    for (const c of corpCustomers) {
      const id = String(c.id ?? '');
      if (!id) continue;
      const label = c.name || c.companyName || id;
      opts.push({
        id: `corp:${id}`,
        label,
        subtitle: '1110 · corporate',
        searchText: `${label} corporate ${id}`,
        group: 'corp',
        accountId: String(ar1110.id),
        corpParty: `corp:${id}`,
      });
    }
  }

  const apAcct = apType === 'affiliated' ? apAff : apType === 'local' ? apLocal : null;
  if (apAcct) {
    opts.push({
      id: 'ap:all',
      label: t('ledger.ap.all'),
      subtitle: apAcct.code,
      searchText: 'all suppliers ap',
      group: 'ap',
      accountId: String(apAcct.id),
      apParty: 'all',
    });
    for (const s of apSuppliers) {
      const id = String(s.id ?? '');
      if (!id) continue;
      const label = s.name || id;
      opts.push({
        id: `ap:${apType}:${id}`,
        label,
        subtitle: apAcct.code,
        searchText: `${label} supplier ${apType} ${id}`,
        group: 'ap',
        accountId: String(apAcct.id),
        apParty: `sup:${apType}:${id}`,
      });
    }
  }

  return opts;
}

export function applyPickerSelection(opt) {
  if (!opt) {
    return { accountId: '', corpParty: 'all', apParty: 'all', pickerId: '' };
  }
  return {
    accountId: String(opt.accountId || ''),
    corpParty: opt.corpParty != null ? opt.corpParty : 'all',
    apParty: opt.apParty != null ? opt.apParty : 'all',
    pickerId: String(opt.id || ''),
  };
}

export function mapLedgerLineRef(line) {
  if (!line) return '—';
  return String(line.entryNumber || line.reference || line.ref || '—');
}

export function mapLedgerLineAccount(line, selectedAccount) {
  if (line?.accountCode) return String(line.accountCode);
  if (line?.account?.code) return String(line.account.code);
  if (selectedAccount?.code) return String(selectedAccount.code);
  return '—';
}

export function mapLedgerLineSource(line) {
  if (!line) return '—';
  const s = line.source ?? line.journalSource ?? line.refType ?? line.journalType;
  if (s == null || s === '') return '—';
  return String(s);
}
