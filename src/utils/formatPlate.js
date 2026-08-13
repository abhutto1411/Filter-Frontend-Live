/**
 * Format Saudi/GCC plate for display: letters - digits (e.g. JHN - 343).
 * Matches POS `formatVehiclePlateLettersFirst`.
 */
export function formatPlateLettersFirst(raw) {
  const original = String(raw ?? '').trim();
  if (!original) return original;

  const n = original.replace(/[\s\-|]/g, '');
  if (!n) return original;

  const isDigit = (c) => /^[0-9]$/.test(c);
  const isLetter = (c) => /^[a-zA-Z\u0621-\u064A]$/.test(c);

  if (isDigit(n[0])) {
    let i = 0;
    while (i < n.length && isDigit(n[i])) i++;
    const digits = n.slice(0, i);
    const letters = n.slice(i);
    if (digits && letters && [...letters].every(isLetter)) {
      return `${letters.toUpperCase()} - ${digits}`;
    }
  } else if (isLetter(n[0])) {
    let i = 0;
    while (i < n.length && isLetter(n[i])) i++;
    const letters = n.slice(0, i);
    const digits = n.slice(i);
    if (letters && digits && [...digits].every(isDigit)) {
      return `${letters.toUpperCase()} - ${digits}`;
    }
  }

  return original;
}

/** Prefer API plateDisplay / plateNumber; else format legacy plateNo. */
export function resolvePlateDisplay(orderOrVehicle) {
  if (!orderOrVehicle) return '';
  const v = orderOrVehicle.vehicle ?? orderOrVehicle;
  const fromApi =
    orderOrVehicle.plateNumber ||
    orderOrVehicle.plateDisplay ||
    v?.plateNumber ||
    v?.plateDisplay;
  if (fromApi && String(fromApi).trim()) return String(fromApi).trim();
  const legacy = v?.plateNo || orderOrVehicle.plateNo || '';
  return formatPlateLettersFirst(legacy);
}
