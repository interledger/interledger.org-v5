import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about the project's custom font-size tokens (defined in
// src/styles/theme.css). Without this, twMerge sees `text-caption` and
// `text-neutral-0` as both being in the catch-all `text-*` group and drops
// the earlier one as a conflict, even though one is font-size and the other
// is colour.
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

export const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZE_TOKENS }]
    }
  }
})
