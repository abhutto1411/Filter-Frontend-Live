/**
 * When headingReclassOnly, list every heading with a direct balance at any depth,
 * even if the tree is collapsed.
 */
export function buildHeadingReclassRows(
    filteredTree,
    headingDirectIds,
    flattenVisibleTree,
    {
        expandedIds = new Set(),
        searchActive = false,
        headingReclassOnly = false,
        mergeRow = (row) => row,
    } = {},
) {
    const forceExpand = Boolean(searchActive) || Boolean(headingReclassOnly);
    const rows = flattenVisibleTree(filteredTree, expandedIds, forceExpand).map((row) =>
        mergeRow(row),
    );
    if (!headingReclassOnly) return rows;
    const ids = headingDirectIds instanceof Set ? headingDirectIds : new Set(headingDirectIds || []);
    return rows.filter((row) => ids.has(String(row.id)));
}
