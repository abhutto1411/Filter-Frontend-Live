/** P-A12K — Employee payee purpose (Advance 1250-E vs Salary payable 2250-E). */

export const EMPLOYEE_PURPOSE_ADVANCE = 'advance';
export const EMPLOYEE_PURPOSE_SALARY = 'salary_payable';

export const EMPLOYEE_PURPOSE_OPTIONS = [
  EMPLOYEE_PURPOSE_ADVANCE,
  EMPLOYEE_PURPOSE_SALARY,
];

/** True when payee type is Employee (payment flow requires purpose). */
export function isEmployeePayeeType(type) {
  return String(type || '').toLowerCase() === 'employee';
}

/**
 * Find COA account id for purpose.
 * Prefer per-employee child `1250-E{id}` / `2250-E{id}`, else parent `1250` / `2250`.
 */
export function resolveEmployeePurposeAccountId(accounts, purpose, employeeUserId) {
  const list = Array.isArray(accounts) ? accounts : [];
  const emp = employeeUserId != null && String(employeeUserId).trim() !== ''
    ? String(employeeUserId).replace(/^(?:er|record):/i, '')
    : '';
  const childRe =
    purpose === EMPLOYEE_PURPOSE_SALARY
      ? emp
        ? new RegExp(`^2250-E${emp}$`, 'i')
        : null
      : emp
        ? new RegExp(`^1250-E${emp}$`, 'i')
        : null;
  const parentCode = purpose === EMPLOYEE_PURPOSE_SALARY ? '2250' : '1250';

  if (childRe) {
    const child = list.find((a) => childRe.test(String(a.code || '')));
    if (child?.id != null) return String(child.id);
  }
  const parent = list.find((a) => String(a.code || '').toUpperCase() === parentCode);
  if (parent?.id != null) return String(parent.id);
  return '';
}

export function purposeCodeLabel(purpose) {
  if (purpose === EMPLOYEE_PURPOSE_SALARY) return '2250-E';
  if (purpose === EMPLOYEE_PURPOSE_ADVANCE) return '1250-E';
  return '';
}

export function isAdvanceAccountCode(code) {
  const c = String(code || '').toUpperCase();
  return c === '1250' || /^1250-E\d+$/.test(c);
}

/** Recent payee label with optional "(advance)" tag. */
export function formatRecentPayeeLabel(row) {
  const name = String(row?.payeeName || row?.description || '').trim() || '—';
  const code = row?.accountCode || row?.account?.code || '';
  if (isAdvanceAccountCode(code) || row?.employeePurpose === EMPLOYEE_PURPOSE_ADVANCE) {
    return `${name} (advance)`;
  }
  return name;
}

/**
 * Live journal preview for employee payment purpose.
 * @returns {string|null} null when purpose incomplete
 */
export function buildEmployeePurposePreview({
  purpose,
  employeeName,
  cashLabel,
  t,
}) {
  if (!purpose) return null;
  const emp = employeeName || '—';
  const cash = cashLabel || '—';
  const code = purposeCodeLabel(purpose);
  if (purpose === EMPLOYEE_PURPOSE_ADVANCE) {
    return t
      ? t('tx.purpose.previewAdvance', { code, emp, cash })
      : `Dr ${code} ${emp} / Cr ${cash} · also listed in the Advance register (source Transactions)`;
  }
  return t
    ? t('tx.purpose.previewSalary', { code, emp, cash })
    : `Dr ${code} ${emp} / Cr ${cash}`;
}

/** Validate employee rows before post. Returns error key or null. */
export function validateEmployeePurposeRows(rows, { isPayment }) {
  if (!isPayment) return null;
  const list = Array.isArray(rows) ? rows : [];
  for (const r of list) {
    if (!isEmployeePayeeType(r.type)) continue;
    if (!(Number(r.amount) > 0)) continue;
    if (!EMPLOYEE_PURPOSE_OPTIONS.includes(r.employeePurpose)) {
      return 'tx.purpose.required';
    }
  }
  return null;
}

/** Routes for bulk entry (P-A18). Import = P-A18C. */
export function bulkTransactionRoutes() {
  return {
    newMany: '/workshop/accounting/transactions/batch/new',
    importCsv: '/workshop/accounting/transactions/batch/import',
    batches: '/workshop/accounting/transactions/batches',
  };
}

export function hasBulkTransactionRoutes() {
  const r = bulkTransactionRoutes();
  return Boolean(r.newMany || r.importCsv || r.batches);
}
