/** Place a fixed combo menu so it stays on-screen and can open upward over fields above. */
export function computeFixedComboMenuStyle(
    rect,
    {
        menuMinWidth = 320,
        viewportWidth = 1280,
        viewportHeight = 800,
        gap = 6,
        edge = 12,
        zIndex = 5000,
    } = {},
) {
    const width = Math.min(
        Math.max(Number(rect?.width) || 0, menuMinWidth),
        Math.max(viewportWidth - edge * 2, 240),
    );
    const left = Math.min(
        Math.max(edge, Number(rect?.left) || 0),
        Math.max(edge, viewportWidth - width - edge),
    );
    const bottom = Number(rect?.bottom) || 0;
    const top = Number(rect?.top) || 0;
    const spaceBelow = viewportHeight - bottom - gap - edge;
    const spaceAbove = top - gap - edge;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(320, Math.max(openUp ? spaceAbove : spaceBelow, 180));
    return {
        position: 'fixed',
        left,
        width,
        zIndex,
        maxHeight,
        '--ms-combo-menu-width': `${width}px`,
        openUp,
        ...(openUp
            ? { top: 'auto', bottom: viewportHeight - top + gap }
            : { top: bottom + gap, bottom: 'auto' }),
    };
}

/** Move keyboard highlight through combo options; clamps to the list. */
export function stepComboHighlightIdx(current, delta, length) {
    const len = Number(length) || 0;
    if (len <= 0) return 0;
    const from = Number.isFinite(Number(current)) ? Number(current) : 0;
    const step = Number.isFinite(Number(delta)) ? Number(delta) : 0;
    return Math.max(0, Math.min(len - 1, from + step));
}
