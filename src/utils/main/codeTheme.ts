import type { ThemeRegistration } from 'shiki'

/** Token colours layered over a bundled Shiki theme to match the code block design. */
export interface CodeThemePalette {
  background: string
  foreground: string
  reservedWord: string
  operator: string
  variable: string
  type: string
  number: string
  comment: string
}

export const LIGHT_CODE_PALETTE: CodeThemePalette = {
  background: '#FFFFFF',
  foreground: '#24292E',
  reservedWord: '#994DE4',
  operator: '#24292E',
  variable: '#F69F42',
  type: '#3D79E0',
  number: '#F3762F',
  comment: '#9B9DA2'
}

// Accents are the light palette's hues, lifted where needed to keep WCAG AA
// contrast against the near-black (neutral-150) background.
export const DARK_CODE_PALETTE: CodeThemePalette = {
  background: '#0D0D0D',
  foreground: '#E4E4E4',
  reservedWord: '#B98AF0',
  operator: '#E4E4E4',
  variable: '#F69F42',
  type: '#6C9BEB',
  number: '#F3762F',
  comment: '#9B9DA2'
}

/**
 * Returns `base` with the design's token colours appended. Later token rules
 * win in TextMate scope matching, so these override the base theme's.
 */
export function buildCodeTheme(
  base: ThemeRegistration,
  name: string,
  palette: CodeThemePalette
): ThemeRegistration {
  return {
    ...base,
    name,
    bg: palette.background,
    fg: palette.foreground,
    colors: {
      ...base.colors,
      'editor.background': palette.background,
      'editor.foreground': palette.foreground
    },
    tokenColors: [
      ...(base.tokenColors ?? []),
      {
        scope: [
          'storage.type',
          'storage.modifier',
          'keyword.control',
          'variable.language'
        ],
        settings: { foreground: palette.reservedWord }
      },
      { scope: 'keyword.operator', settings: { foreground: palette.operator } },
      {
        scope: [
          'variable',
          'variable.other',
          'variable.other.constant',
          'variable.other.readwrite'
        ],
        settings: { foreground: palette.variable }
      },
      {
        scope: [
          'entity.name.function',
          'entity.name.type',
          'entity.name.class',
          'support.class',
          'support.type',
          'support.function'
        ],
        settings: { foreground: palette.type }
      },
      {
        scope: ['constant', 'constant.numeric'],
        settings: { foreground: palette.number }
      },
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: palette.comment }
      }
    ]
  }
}
