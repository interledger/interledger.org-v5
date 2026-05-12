import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about the project's custom design-system tokens
// (defined in src/styles/theme.css). Without these registrations, twMerge
// can't see that, e.g., `py-lg` and `py-0` target the same CSS property
// and would silently keep both — letting cascade order decide rather than
// caller intent.

// Custom font-size tokens: without this, `text-caption` and `text-neutral-0`
// both look like generic `text-*` classes to twMerge and one gets dropped.
const FONT_SIZE_TOKENS = [
  'caption',
  'h1',
  'h1-md',
  'h1-lg',
  'h2',
  'h2-md',
  'h2-lg',
  'h3',
  'h3-md',
  'h3-lg',
  'h4',
  'h4-md',
  'h4-lg',
  'h5',
  'h5-md',
  'h5-lg',
  'body-lg-emphasis',
  'body-lg-emphasis-md',
  'body-lg-standard',
  'body-lg-standard-md',
  'body-sm-emphasis',
  'body-sm-standard',
  'step--2',
  'step--1',
  'step-0',
  'step-1',
  'step-2',
  'step-3',
  'step-4',
  'step-5',
  'step-6'
]

// Custom spacing tokens. The new design system adds an `xs..7xl` t-shirt
// scale (plus `3xl-tight` and the legacy `space-*` fluid scale). These tokens
// power every spacing utility (p-*, m-*, gap-*, w-*, h-*, etc.), so we
// register them as a single shared list against each affected group.
const SPACING_TOKENS = [
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '3xl-tight',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  'space-3xs',
  'space-2xs',
  'space-xs',
  'space-s',
  'space-m',
  'space-l',
  'space-xl',
  'space-2xl',
  'space-3xl'
]

export const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZE_TOKENS }],
      // Padding (all axes + shorthand)
      p: [{ p: SPACING_TOKENS }],
      px: [{ px: SPACING_TOKENS }],
      py: [{ py: SPACING_TOKENS }],
      ps: [{ ps: SPACING_TOKENS }],
      pe: [{ pe: SPACING_TOKENS }],
      pt: [{ pt: SPACING_TOKENS }],
      pr: [{ pr: SPACING_TOKENS }],
      pb: [{ pb: SPACING_TOKENS }],
      pl: [{ pl: SPACING_TOKENS }],
      // Margin (all axes + shorthand)
      m: [{ m: SPACING_TOKENS }],
      mx: [{ mx: SPACING_TOKENS }],
      my: [{ my: SPACING_TOKENS }],
      ms: [{ ms: SPACING_TOKENS }],
      me: [{ me: SPACING_TOKENS }],
      mt: [{ mt: SPACING_TOKENS }],
      mr: [{ mr: SPACING_TOKENS }],
      mb: [{ mb: SPACING_TOKENS }],
      ml: [{ ml: SPACING_TOKENS }],
      // Gap
      gap: [{ gap: SPACING_TOKENS }],
      'gap-x': [{ 'gap-x': SPACING_TOKENS }],
      'gap-y': [{ 'gap-y': SPACING_TOKENS }],
      // Sizing
      w: [{ w: SPACING_TOKENS }],
      'min-w': [{ 'min-w': SPACING_TOKENS }],
      'max-w': [{ 'max-w': SPACING_TOKENS }],
      h: [{ h: SPACING_TOKENS }],
      'min-h': [{ 'min-h': SPACING_TOKENS }],
      'max-h': [{ 'max-h': SPACING_TOKENS }],
      size: [{ size: SPACING_TOKENS }]
    }
  }
})
