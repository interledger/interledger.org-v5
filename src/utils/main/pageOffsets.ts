/**
 * Padding-top applied to the first block below the sticky/fixed site header
 * (typically the breadcrumbs wrapper) so its distance from the very top of
 * the viewport is a consistent 80px / 120px / 160px across mobile, tablet,
 * and desktop, regardless of the header's own height at each breakpoint.
 */
export const PAGE_TOP_OFFSET_CLASS =
  'pt-[calc(var(--spacing-5xl)-var(--site-header-height))] tablet:pt-[calc(var(--spacing-6xl)-var(--site-header-height))] desktop:pt-[calc(var(--spacing-7xl)-var(--site-header-height-desktop))]'
