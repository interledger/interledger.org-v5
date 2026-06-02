import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import tailwindConfig from '../../tailwind.config.mjs'
import {
  TYPOGRAPHY_PRESETS_BY_TIER,
  TYPOGRAPHY_TIER_HEADINGS,
  TYPOGRAPHY_TIER_ORDER,
  type TypographyPreset
} from './typography-preview'

const REM_BASE_PX = 16
const THEME_CSS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../styles/theme.css'
)

type ThemeTextToken = {
  fontSizePx: number
  lineHeightPx: number
  fontWeight: number
}

function parseLengthToPx(value: string): number {
  const trimmed = value.trim()

  if (trimmed.endsWith('rem')) {
    return Math.round(parseFloat(trimmed) * REM_BASE_PX)
  }

  if (trimmed.endsWith('px')) {
    return Math.round(parseFloat(trimmed))
  }

  throw new Error(`Unsupported length unit in theme.css: ${value}`)
}

/** Parses `--text-*` font-size, line-height, and font-weight tokens from theme.css. */
function parseThemeTextTokens(css: string): Map<string, ThemeTextToken> {
  const tokens = new Map<string, Partial<ThemeTextToken>>()

  for (const match of css.matchAll(/^  --text-([\w-]+):\s*([^;]+);/gm)) {
    const [, name, value] = match

    if (name.endsWith('--line-height')) {
      const tokenName = name.slice(0, -'--line-height'.length)
      const token = tokens.get(tokenName) ?? {}
      token.lineHeightPx = parseLengthToPx(value)
      tokens.set(tokenName, token)
      continue
    }

    if (name.endsWith('--font-weight')) {
      const tokenName = name.slice(0, -'--font-weight'.length)
      const token = tokens.get(tokenName) ?? {}
      token.fontWeight = Number.parseInt(value.trim(), 10)
      tokens.set(tokenName, token)
      continue
    }

    if (name.includes('--')) continue
    if (name.startsWith('step-') || value.includes('clamp(')) continue

    const token = tokens.get(name) ?? {}
    token.fontSizePx = parseLengthToPx(value)
    tokens.set(name, token)
  }

  const complete = new Map<string, ThemeTextToken>()

  for (const [name, token] of tokens) {
    if (
      token.fontSizePx === undefined ||
      token.lineHeightPx === undefined ||
      token.fontWeight === undefined
    ) {
      throw new Error(`Incomplete --text-${name} token set in theme.css`)
    }

    complete.set(name, token as ThemeTextToken)
  }

  return complete
}

function classNameToTokenName(className: string): string {
  return className.replace(/^text-/, '')
}

function expectPresetMatchesTheme(
  preset: TypographyPreset,
  themeTokens: Map<string, ThemeTextToken>
): void {
  const tokenName = classNameToTokenName(preset.className)
  const themeToken = themeTokens.get(tokenName)

  expect(themeToken, `Missing theme.css token for ${preset.className}`).toBeDefined()
  expect(preset.fontSizePx).toBe(themeToken!.fontSizePx)
  expect(preset.lineHeightPx).toBe(themeToken!.lineHeightPx)
  expect(preset.fontWeight).toBe(themeToken!.fontWeight)
}

describe('typography-preview parity with theme.css', () => {
  const themeTokens = parseThemeTextTokens(readFileSync(THEME_CSS_PATH, 'utf8'))

  it('maps every preset className to a complete theme.css text token', () => {
    for (const tier of TYPOGRAPHY_TIER_ORDER) {
      for (const preset of TYPOGRAPHY_PRESETS_BY_TIER[tier]) {
        expectPresetMatchesTheme(preset, themeTokens)
      }
    }
  })

  it('uses redesign breakpoint labels from tailwind.config.mjs', () => {
    const { tablet, desktop } = tailwindConfig.theme.extend.screens

    expect(TYPOGRAPHY_TIER_HEADINGS.mobile.breakpoint).toContain('< 810px')
    expect(TYPOGRAPHY_TIER_HEADINGS.tablet.breakpoint).toContain(tablet)
    expect(TYPOGRAPHY_TIER_HEADINGS.desktop.breakpoint).toContain(desktop)
  })
})
