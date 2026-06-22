export const TAB_SPACING_MIN = -8;
export const TAB_SPACING_MAX = 20;
export const TAB_SPACING_DEFAULT = 2;

export function normalizeTabSpacing(value) {
  if (typeof value === 'string') {
    if (value === 'tight') return -4;
    if (value === 'loose') return 6;
    return TAB_SPACING_DEFAULT;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return TAB_SPACING_DEFAULT;
  return Math.min(TAB_SPACING_MAX, Math.max(TAB_SPACING_MIN, Math.round(n)));
}

export function getTabSpacingCssVars(spacingPx) {
  const spacing = normalizeTabSpacing(spacingPx);
  const listPadY = Math.max(0, Math.round(spacing * 0.25));
  return {
    tabSpacing: String(spacing),
    listPadding: `${listPadY}px 8px`,
  };
}
