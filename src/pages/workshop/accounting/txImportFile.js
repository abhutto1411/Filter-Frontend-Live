/** Read an import file (CSV / TXT / XLSX / XLS) as CSV text. xlsx is loaded on demand. */
/** First sheet of an .xlsx / .xls file → CSV text (dates as YYYY-MM-DD). */
async function excelToCsv(file) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return '';
    for (const k of Object.keys(ws)) {
        const c = ws[k];
        if (k[0] !== '!' && c && c.t === 'd' && c.v instanceof Date && !Number.isNaN(c.v.getTime())) {
            const d = c.v;
            c.w = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }
    return XLSX.utils.sheet_to_csv(ws, { FS: ',', blankrows: false });
}

export async function readImportFile(file) {
    const name = String(file?.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) return excelToCsv(file);
    return file.text();
}
