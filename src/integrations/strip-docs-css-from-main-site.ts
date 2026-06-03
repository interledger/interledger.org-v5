/**
 * Post-build CSS fixes for main-site Lighthouse:
 *
 * 1. Drop Starlight docs stylesheets that leak onto foundation routes (INTORG-639).
 * 2. Force-inline remaining blocking /_astro/*.css links when Astro leaves them external
 *    (e.g. stale Netlify cache or inlineStylesheets not applied).
 *
 * See src/styles/README.md — Starlight Docs Isolation.
 */
import type { AstroIntegration } from 'astro'
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Marker for Starlight / docs-design-system bundles in dist/_astro/*.css */
const DOCS_ONLY_CSS_MARKER = '.sl-markdown-content'

const DEVELOPERS_PATH_SEGMENT = `${path.sep}developers${path.sep}`

const STYLESHEET_LINK_RE =
  /<link\s+rel="stylesheet"\s+href="\/_astro\/([^"]+\.css)"([^>]*)>/g

const PRINT_MEDIA_RE = /media\s*=\s*["']print["']/i

export function removeDocsStylesheetLinks(
  html: string,
  docsStylesheetNames: ReadonlySet<string>
): string {
  if (docsStylesheetNames.size === 0) return html
  return html.replace(STYLESHEET_LINK_RE, (match, fileName: string) =>
    docsStylesheetNames.has(fileName) ? '' : match
  )
}

export function inlineBlockingStylesheetLinks(
  html: string,
  readCss: (fileName: string) => string | undefined,
  skipFiles: ReadonlySet<string> = new Set()
): string {
  return html.replace(
    STYLESHEET_LINK_RE,
    (match, fileName: string, attrs: string) => {
      if (skipFiles.has(fileName)) return ''
      if (PRINT_MEDIA_RE.test(attrs)) return match
      const css = readCss(fileName)
      if (!css) return match
      return `<style>${css}</style>`
    }
  )
}

export function optimizeMainSiteCss(
  html: string,
  docsStylesheetNames: ReadonlySet<string>,
  readCss: (fileName: string) => string | undefined
): string {
  const withoutDocs = removeDocsStylesheetLinks(html, docsStylesheetNames)
  return inlineBlockingStylesheetLinks(
    withoutDocs,
    readCss,
    docsStylesheetNames
  )
}

async function findDocsOnlyStylesheetNames(
  astroDir: string
): Promise<Set<string>> {
  const names = new Set<string>()
  let entries: string[]
  try {
    entries = await readdir(astroDir)
  } catch {
    return names
  }

  for (const entry of entries) {
    if (!entry.endsWith('.css')) continue
    const filePath = path.join(astroDir, entry)
    const head = await readFile(filePath, { encoding: 'utf8' })
    if (head.includes(DOCS_ONLY_CSS_MARKER)) names.add(entry)
  }

  return names
}

async function collectHtmlFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath)
    }
  }
  return files
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export function stripDocsCssFromMainSite(): AstroIntegration {
  return {
    name: 'strip-docs-css-from-main-site',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir)
        const astroDir = path.join(distDir, '_astro')
        const docsStylesheets = await findDocsOnlyStylesheetNames(astroDir)
        const cssCache = new Map<string, string>()

        const htmlFiles = await collectHtmlFiles(distDir)
        let updatedPages = 0
        let inlinedLinks = 0
        let strippedDocsLinks = 0

        for (const filePath of htmlFiles) {
          if (filePath.includes(DEVELOPERS_PATH_SEGMENT)) continue

          const html = await readFile(filePath, 'utf8')
          const linkMatches = [...html.matchAll(STYLESHEET_LINK_RE)]
          if (linkMatches.length === 0) continue

          for (const match of linkMatches) {
            const fileName = match[1]
            if (docsStylesheets.has(fileName)) {
              strippedDocsLinks += 1
              continue
            }
            if (PRINT_MEDIA_RE.test(match[2] ?? '')) continue
            if (!cssCache.has(fileName)) {
              const cssPath = path.join(astroDir, fileName)
              if (!(await fileExists(cssPath))) continue
              cssCache.set(fileName, await readFile(cssPath, 'utf8'))
            }
            if (cssCache.has(fileName)) inlinedLinks += 1
          }

          const readCssBound = (fileName: string): string | undefined => {
            const value = cssCache.get(fileName)
            return value === undefined ? undefined : value
          }

          const next = optimizeMainSiteCss(html, docsStylesheets, readCssBound)
          if (next === html) continue

          await writeFile(filePath, next)
          updatedPages += 1
        }

        if (updatedPages === 0) {
          logger.info('[strip-docs-css] Main-site HTML already optimized')
          return
        }

        logger.info(
          `[strip-docs-css] Optimized ${updatedPages} main-site page(s)` +
            (strippedDocsLinks > 0
              ? `; removed ${strippedDocsLinks} docs CSS link(s)`
              : '') +
            (inlinedLinks > 0
              ? `; inlined ${inlinedLinks} stylesheet link(s)`
              : '') +
            (docsStylesheets.size > 0
              ? ` (docs bundles: ${[...docsStylesheets].join(', ')})`
              : '')
        )
      }
    }
  }
}
