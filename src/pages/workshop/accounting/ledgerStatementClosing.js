/**
 * Pure helpers for ledger statement closing (K19).
 * 0 filtered lines ⇒ closing equals opening (never all-time server balance).
 */

export function statementClosingZeroLines(statementOpening) {
  return Number(statementOpening) || 0;
}

export function computeStatementClosing({
  filteredLinesLength,
  statementOpening,
  totalsDebit,
  totalsCredit,
  normalDebit = true,
}) {
  if (!filteredLinesLength) {
    return statementClosingZeroLines(statementOpening);
  }
  const opening = Number(statementOpening) || 0;
  const debit = Number(totalsDebit) || 0;
  const credit = Number(totalsCredit) || 0;
  const movement = normalDebit ? debit - credit : credit - debit;
  return Number((opening + movement).toFixed(2));
}
