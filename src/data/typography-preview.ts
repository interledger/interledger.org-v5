/** Typography preset catalog for the internal /preview/typography page. Values mirror @theme tokens in src/styles/theme.css. */

export type TypographyTier = 'mobile' | 'tablet' | 'desktop'

export interface TypographyPreset {
  /** Short label shown in the preview column (e.g. H1). */
  label: string
  /** Tailwind `text-*` utility for this tier. */
  className: string
  fontWeight: 400 | 500 | 600
  fontSizePx: number
  lineHeightPx: number
}

export const TYPOGRAPHY_SAMPLE =
  'The quick brown fox jumps over the lazy dog'

export const TYPOGRAPHY_TIER_HEADINGS: Record<
  TypographyTier,
  { title: string; breakpoint: string }
> = {
  mobile: { title: 'Mobile', breakpoint: '< 810px (base tokens)' },
  tablet: { title: 'Tablet', breakpoint: '810px+ (tablet: / *-md tokens)' },
  desktop: { title: 'Desktop', breakpoint: '1200px+ (desktop: / *-lg tokens)' }
}

export function fontWeightLabel(weight: TypographyPreset['fontWeight']): string {
  if (weight === 600) return 'SemiBold'
  if (weight === 500) return 'Medium'
  return 'Regular'
}

const MOBILE_PRESETS: TypographyPreset[] = [
  { label: 'H1', className: 'text-h1', fontWeight: 600, fontSizePx: 56, lineHeightPx: 68 },
  { label: 'H2', className: 'text-h2', fontWeight: 600, fontSizePx: 32, lineHeightPx: 40 },
  { label: 'H3', className: 'text-h3', fontWeight: 500, fontSizePx: 20, lineHeightPx: 28 },
  { label: 'H4', className: 'text-h4', fontWeight: 400, fontSizePx: 18, lineHeightPx: 28 },
  { label: 'H5', className: 'text-h5', fontWeight: 400, fontSizePx: 16, lineHeightPx: 26 },
  {
    label: 'Body LG emphasis',
    className: 'text-body-lg-emphasis',
    fontWeight: 500,
    fontSizePx: 15,
    lineHeightPx: 24
  },
  {
    label: 'Body LG standard',
    className: 'text-body-lg-standard',
    fontWeight: 400,
    fontSizePx: 15,
    lineHeightPx: 24
  },
  {
    label: 'Body SM emphasis',
    className: 'text-body-sm-emphasis',
    fontWeight: 500,
    fontSizePx: 14,
    lineHeightPx: 24
  },
  {
    label: 'Body SM standard',
    className: 'text-body-sm-standard',
    fontWeight: 400,
    fontSizePx: 14,
    lineHeightPx: 24
  },
  {
    label: 'Caption',
    className: 'text-caption',
    fontWeight: 400,
    fontSizePx: 13,
    lineHeightPx: 16
  }
]

const TABLET_PRESETS: TypographyPreset[] = [
  { label: 'H1', className: 'text-h1-md', fontWeight: 600, fontSizePx: 70, lineHeightPx: 76 },
  { label: 'H2', className: 'text-h2-md', fontWeight: 600, fontSizePx: 36, lineHeightPx: 48 },
  { label: 'H3', className: 'text-h3-md', fontWeight: 500, fontSizePx: 28, lineHeightPx: 36 },
  { label: 'H4', className: 'text-h4-md', fontWeight: 400, fontSizePx: 20, lineHeightPx: 30 },
  { label: 'H5', className: 'text-h5-md', fontWeight: 400, fontSizePx: 18, lineHeightPx: 28 },
  {
    label: 'Body LG emphasis',
    className: 'text-body-lg-emphasis-md',
    fontWeight: 500,
    fontSizePx: 16,
    lineHeightPx: 26
  },
  {
    label: 'Body LG standard',
    className: 'text-body-lg-standard-md',
    fontWeight: 400,
    fontSizePx: 16,
    lineHeightPx: 26
  },
  {
    label: 'Body SM emphasis',
    className: 'text-body-sm-emphasis',
    fontWeight: 500,
    fontSizePx: 14,
    lineHeightPx: 24
  },
  {
    label: 'Body SM standard',
    className: 'text-body-sm-standard',
    fontWeight: 400,
    fontSizePx: 14,
    lineHeightPx: 24
  },
  {
    label: 'Caption',
    className: 'text-caption',
    fontWeight: 400,
    fontSizePx: 13,
    lineHeightPx: 16
  }
]

const DESKTOP_PRESETS: TypographyPreset[] = [
  { label: 'H1', className: 'text-h1-lg', fontWeight: 600, fontSizePx: 100, lineHeightPx: 100 },
  { label: 'H2', className: 'text-h2-lg', fontWeight: 600, fontSizePx: 56, lineHeightPx: 64 },
  { label: 'H3', className: 'text-h3-lg', fontWeight: 500, fontSizePx: 40, lineHeightPx: 56 },
  { label: 'H4', className: 'text-h4-lg', fontWeight: 400, fontSizePx: 24, lineHeightPx: 34 },
  { label: 'H5', className: 'text-h5-lg', fontWeight: 400, fontSizePx: 20, lineHeightPx: 30 },
  {
    label: 'Body LG emphasis',
    className: 'text-body-lg-emphasis-md',
    fontWeight: 500,
    fontSizePx: 16,
    lineHeightPx: 26
  },
  {
    label: 'Body LG standard',
    className: 'text-body-lg-standard-md',
    fontWeight: 400,
    fontSizePx: 16,
    lineHeightPx: 26
  },
  {
    label: 'Body SM emphasis',
    className: 'text-body-sm-emphasis',
    fontWeight: 500,
    fontSizePx: 14,
    lineHeightPx: 24
  },
  {
    label: 'Body SM standard',
    className: 'text-body-sm-standard',
    fontWeight: 400,
    fontSizePx: 14,
    lineHeightPx: 24
  },
  {
    label: 'Caption',
    className: 'text-caption',
    fontWeight: 400,
    fontSizePx: 13,
    lineHeightPx: 16
  }
]

export const TYPOGRAPHY_PRESETS_BY_TIER: Record<TypographyTier, TypographyPreset[]> =
  {
    mobile: MOBILE_PRESETS,
    tablet: TABLET_PRESETS,
    desktop: DESKTOP_PRESETS
  }

export const TYPOGRAPHY_TIER_ORDER: TypographyTier[] = [
  'mobile',
  'tablet',
  'desktop'
]
