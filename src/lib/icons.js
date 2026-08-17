/**
 * Icon tokens.
 *
 * The ui-ux-pro-max pro-rules call out two habits that quietly cheapen an
 * interface: arbitrary icon sizes (20 / 24 / 28 mixed at random) and mixed
 * stroke weights inside one visual layer. Everything in this product draws
 * from the scale below — no bare numbers at call sites.
 */

export const ICON = {
  /** inline with small text, badges, meta rows */
  xs: 14,
  /** default: buttons, list markers, field affordances */
  sm: 16,
  /** section-level and standalone controls */
  md: 20,
  /** confirmation and empty-state marks */
  lg: 24,
};

export const STROKE = {
  /** every icon in the base layer */
  regular: 2,
  /** marks sitting inside a filled indicator, where the shape must read at 12-14px */
  emphasis: 2.5,
};

export default { ICON, STROKE };
