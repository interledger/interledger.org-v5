import { describe, expect, it } from 'vitest'
import type { ThemeRegistration } from 'shiki'
import {
  buildCodeTheme,
  DARK_CODE_PALETTE,
  LIGHT_CODE_PALETTE,
  type CodeThemePalette
} from './codeTheme'

const BASE_RULE = { scope: 'string', settings: { foreground: '#123456' } }

const base: ThemeRegistration = {
  name: 'base',
  type: 'light',
  colors: { 'editor.background': '#000000', 'editor.lineHighlight': '#111111' },
  tokenColors: [BASE_RULE]
}

function colorFor(theme: ThemeRegistration, scope: string): string | undefined {
  // Last match wins in TextMate scope resolution, mirroring Shiki.
  const rule = [...(theme.tokenColors ?? [])]
    .reverse()
    .find((r) =>
      Array.isArray(r.scope) ? r.scope.includes(scope) : r.scope === scope
    )
  return rule?.settings.foreground
}

describe('buildCodeTheme', () => {
  it.each([
    ['light', LIGHT_CODE_PALETTE],
    ['dark', DARK_CODE_PALETTE]
  ] as const)(
    'maps every design accent for the %s palette',
    (_, palette: CodeThemePalette) => {
      const theme = buildCodeTheme(base, 'test', palette)

      expect(colorFor(theme, 'keyword.control')).toBe(palette.reservedWord)
      expect(colorFor(theme, 'variable.language')).toBe(palette.reservedWord)
      expect(colorFor(theme, 'keyword.operator')).toBe(palette.operator)
      expect(colorFor(theme, 'variable.other.constant')).toBe(palette.variable)
      expect(colorFor(theme, 'entity.name.function')).toBe(palette.type)
      expect(colorFor(theme, 'support.class')).toBe(palette.type)
      expect(colorFor(theme, 'constant.numeric')).toBe(palette.number)
      expect(colorFor(theme, 'comment')).toBe(palette.comment)
    }
  )

  it('sets name, background and foreground from the palette', () => {
    const theme = buildCodeTheme(
      base,
      'interledger-code-dark',
      DARK_CODE_PALETTE
    )

    expect(theme.name).toBe('interledger-code-dark')
    expect(theme.bg).toBe(DARK_CODE_PALETTE.background)
    expect(theme.fg).toBe(DARK_CODE_PALETTE.foreground)
    expect(theme.colors?.['editor.background']).toBe(
      DARK_CODE_PALETTE.background
    )
    expect(theme.colors?.['editor.foreground']).toBe(
      DARK_CODE_PALETTE.foreground
    )
  })

  it('keeps base token rules and editor colours it does not override', () => {
    const theme = buildCodeTheme(base, 'test', LIGHT_CODE_PALETTE)

    expect(theme.tokenColors?.[0]).toEqual(BASE_RULE)
    expect(theme.colors?.['editor.lineHighlight']).toBe('#111111')
  })

  it('handles a base theme with no token colours or editor colours', () => {
    const theme = buildCodeTheme(
      { name: 'bare', type: 'dark' },
      'test',
      DARK_CODE_PALETTE
    )

    expect(colorFor(theme, 'comment')).toBe(DARK_CODE_PALETTE.comment)
    expect(theme.colors?.['editor.background']).toBe(
      DARK_CODE_PALETTE.background
    )
  })

  it('does not mutate the base theme', () => {
    const before = structuredClone(base)
    buildCodeTheme(base, 'test', DARK_CODE_PALETTE)
    expect(base).toEqual(before)
  })
})
