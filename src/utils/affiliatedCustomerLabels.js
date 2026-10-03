/** Canonical affiliated branch customer label (workshop parent · branch customer). */
export function formatAffiliatedBranchCustomerLabel(workshopName, branchName) {
    const ws = String(workshopName ?? '').trim() || 'Workshop';
    const br = String(branchName ?? '').trim() || 'Branch';
    return `${ws} — ${br}`;
}

/** Workshop-wide pin when no branch is selected. */
export function formatAffiliatedWorkshopCustomerLabel(workshopName) {
    const ws = String(workshopName ?? '').trim() || 'Workshop';
    return `${ws} (all branches)`;
}
