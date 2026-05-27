/**
 * Starlight registers middleware that pulls docs CSS into a shared chunk
 * (see src/styles/README.md — INTORG-639). Main-site HTML must not link it.
 *
 * Works with external stylesheets (`inlineStylesheets: 'auto' | 'never'`).
 * When using `inlineStylesheets: 'always'`, docs CSS may still be present
 * inside merged `<style>` tags — fix that at the bundle boundary separately.
 */
import type { AstroIntegration } from 'astro'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Marker for Starlight / docs-design-system bundles in dist/_astro/*.css */
const DOCS_ONLY_CSS_MARKER = '.sl-markdown-content'

const DEVELOPERS_PATH_SEGMENT = `${path.sep}developers${path.sep}`

const STYLESHEET_LINK_RE =
  /<link\s+rel="stylesheet"\s+href="\/_astro\/([^"]+\.css)">/g

export function removeDocsStylesheetLinks(
  html: string,
  docsStylesheetNames: ReadonlySet<string>
): string {
  if (docsStylesheetNames.size === 0) return html
  return html.replace(STYLESHEET_LINK_RE, (match, fileName: string) =>
    docsStylesheetNames.has(fileName) ? '' : match
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

export function stripDocsCssFromMainSite(): AstroIntegration {
  return {
    name: 'strip-docs-css-from-main-site',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir)
        const astroDir = path.join(distDir, '_astro')
        const docsStylesheets = await findDocsOnlyStylesheetNames(astroDir)

        if (docsStylesheets.size === 0) {
          logger.warn(
            '[strip-docs-css] No docs-only CSS found in dist/_astro; skipping'
          )
          return
        }

        const htmlFiles = await collectHtmlFiles(distDir)
        let updatedPages = 0

        for (const filePath of htmlFiles) {
          if (filePath.includes(DEVELOPERS_PATH_SEGMENT)) continue

          const html = await readFile(filePath, 'utf8')
          const next = removeDocsStylesheetLinks(html, docsStylesheets)
          if (next === html) continue

          await writeFile(filePath, next)
          updatedPages += 1
        }

        logger.info(
          `[strip-docs-css] Removed Starlight docs CSS links from ${updatedPages} main-site page(s) (${[...docsStylesheets].join(', ')})`
        )
      }
    }
  }
}
