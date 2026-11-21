function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function lineFromHeader(h) {
  if (Array.isArray(h)) return h.map(csvEscape).join(',');
  return csvEscape(h);
}

/** Pure CSV text (BOM + CRLF) for tests and downloads. */
export function buildCsvString(headerLines, headers, rows) {
  const lines = [];
  for (const h of headerLines || []) {
    lines.push(lineFromHeader(h));
  }
  if ((headerLines || []).length) lines.push('');
  if (headers && headers.length) lines.push(headers.map(csvEscape).join(','));
  for (const row of rows || []) {
    lines.push((row || []).map(csvEscape).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename, headerLines, headers, rows) {
  const csv = buildCsvString(headerLines, headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
