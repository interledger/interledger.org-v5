import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z, getCollection: vi.fn().mockResolvedValue([]) }
})

const { siteSectionFromPathname, getApply404ThemeScript } =
  await import('./siteSection')
const { ROUTE_BASES } = await import('./routes')

describe('siteSectionFromPathname', () => {
  it('treats the site root as foundation', () => {
    expect(siteSectionFromPathname('/')).toBe('foundation')
    expect(siteSectionFromPathname('')).toBe('foundation')
  })

  it('treats grant, blog, and other foundation paths as foundation', () => {
    expect(siteSectionFromPathname('/grant/innovation')).toBe('foundation')
    expect(siteSectionFromPathname('/blog')).toBe('foundation')
    expect(siteSectionFromPathname('/es/grant/our-grantmaking')).toBe(
      'foundation'
    )
  })

  it('does not treat a lookalike prefix as hackathon or summit', () => {
    expect(siteSectionFromPathname('/hackathons')).toBe('foundation')
    expect(siteSectionFromPathname('/summits')).toBe('foundation')
  })

  it('classifies hackathon paths, including locale prefix and trailing slash', () => {
    expect(siteSectionFromPathname('/hackathon')).toBe('hackathon')
    expect(siteSectionFromPathname('/hackathon/')).toBe('hackathon')
    expect(siteSectionFromPathname('/hackathon/overview')).toBe('hackathon')
    expect(siteSectionFromPathname('/es/hackathon/missing-page')).toBe(
      'hackathon'
    )
  })

  it('classifies summit paths, including locale prefix', () => {
    expect(siteSectionFromPathname('/summit')).toBe('summit')
    expect(siteSectionFromPathname('/summit/2025')).toBe('summit')
    expect(siteSectionFromPathname('/es/summit/talks')).toBe('summit')
  })
})

describe('getApply404ThemeScript', () => {
  it('embeds the same route bases and locale prefixes the matcher uses', () => {
    const script = getApply404ThemeScript()
    expect(script).toContain(JSON.stringify(ROUTE_BASES['hackathon-pages']))
    expect(script).toContain(JSON.stringify(ROUTE_BASES['summit-pages']))
    expect(script).toContain(JSON.stringify(['es']))
  })

  it('paints html theme, site, and foundation header before first paint', () => {
    const script = getApply404ThemeScript()
    expect(script).toContain("setAttribute('data-theme', 'dark')")
    expect(script).toContain("setAttribute('data-site', section)")
    expect(script).toContain('[data-component="FoundationHeader"]')
    expect(script).toContain('MutationObserver')
  })

  it('darkens the document and retargets home for a hackathon miss', () => {
    const painted = paint404Theme('/hackathon/not-a-page')
    expect(painted.html['data-theme']).toBe('dark')
    expect(painted.html['data-site']).toBe('hackathon')
    expect(painted.header['data-theme']).toBe('dark')
    expect(painted.home.href).toBe('/hackathon/overview')
  })

  it('darkens the document and retargets home for a summit miss', () => {
    const painted = paint404Theme('/es/summit/missing')
    expect(painted.html['data-theme']).toBe('dark')
    expect(painted.html['data-site']).toBe('summit')
    expect(painted.home.href).toBe('/summit/home')
  })

  it('leaves a foundation miss on the light theme', () => {
    const painted = paint404Theme('/grant/not-a-page')
    expect(painted.html['data-theme']).toBe('light')
    expect(painted.html['data-site']).toBeUndefined()
    expect(painted.header['data-theme']).toBe('light')
    expect(painted.home.href).toBe('/')
  })
})

function paint404Theme(pathname: string) {
  const html: Record<string, string> = { 'data-theme': 'light' }
  const header: Record<string, string> = { 'data-theme': 'light' }
  const home: Record<string, string> = {
    href: '/',
    'data-home-hackathon': '/hackathon/overview',
    'data-home-summit': '/summit/home'
  }

  runInNewContext(getApply404ThemeScript(), {
    location: { pathname },
    document: {
      documentElement: {
        setAttribute(name: string, value: string) {
          html[name] = value
        }
      },
      querySelector(selector: string) {
        if (selector === '[data-component="FoundationHeader"]') {
          return {
            setAttribute(name: string, value: string) {
              header[name] = value
            }
          }
        }
        if (selector === '[data-404-home]') {
          return {
            getAttribute(name: string) {
              return home[name] ?? null
            },
            setAttribute(name: string, value: string) {
              home[name] = value
            }
          }
        }
        return null
      }
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    }
  })

  return { html, header, home }
}
