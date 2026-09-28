import type { ThemeRegistration } from 'shiki'

/** Token colours layered over a bundled Shiki theme to match the code block design. */
export interface CodeThemePalette {
  background: string
  foreground: string
  reservedWord: string
  operator: string
  constant: string
  type: string
  number: string
  punctuation: string
  comment: string
}

// Values are taken from the Figma code block frames. Accents are shared
// between the themes; only the surface, body text and keywords change.
export const LIGHT_CODE_PALETTE: CodeThemePalette = {
  background: '#FFFFFF',
  foreground: '#383A42',
  reservedWord: '#80409D',
  operator: '#08A4E5',
  constant: '#E08E1D',
  type: '#1F65F5',
  number: '#FE640C',
  punctuation: '#4D4F69',
  comment: '#8B8FA0'
}

export const DARK_CODE_PALETTE: CodeThemePalette = {
  ...LIGHT_CODE_PALETTE,
  background: '#000000',
  foreground: '#C9C9C9',
  reservedWord: '#959FF9'
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
      // Plain identifiers read as body text; the base themes colour `variable`.
      // The JS grammar tags every `const` declaration as a constant, so only
      // references keep the constant colour (in practice, ALL_CAPS names).
      {
        scope: [
          'meta.definition.variable variable.other.constant',
          'variable',
          'variable.other',
          'variable.other.readwrite',
          'variable.other.object',
          'variable.other.property',
          'variable.parameter',
          'meta.object-literal.key',
          'storage.type.numeric.bigint'
        ],
        settings: { foreground: palette.foreground }
      },
      {
        scope: [
          'storage.type',
          'storage.modifier',
          'keyword.control',
          'variable.language'
        ],
        settings: { foreground: palette.reservedWord }
      },
      {
        scope: ['keyword.operator', 'punctuation.separator.key-value'],
        settings: { foreground: palette.operator }
      },
      {
        scope: ['variable.other.constant', 'support.constant'],
        settings: { foreground: palette.constant }
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
        scope: [
          'meta.brace',
          'punctuation.definition.block',
          'punctuation.definition.parameters',
          'punctuation.accessor',
          'punctuation.separator.comma',
          'punctuation.terminator'
        ],
        settings: { foreground: palette.punctuation }
      },
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: palette.comment }
      }
    ]
  }
}
