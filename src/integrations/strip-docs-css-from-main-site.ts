/**
 * Starlight registers middleware that pulls docs CSS into a shared chunk
 * (see src/styles/README.md — INTORG-639). Main-site HTML must not load it.
 */
import type { AstroIntegration } from 'astro'
import type { Plugin as VitePlugin } from 'vite'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Marker for Starlight / docs-design-system bundles in dist/_astro/*.css */
const DOCS_ONLY_CSS_MARKER = '.sl-markdown-content'

const DEVELOPERS_PATH_SEGMENT = `${path.sep}developers${path.sep}`

const STYLESHEET_LINK_RE =
  /<link\s+rel="stylesheet"\s+href="\/_astro\/([^"]+\.css)">/g

const STYLE_TAG_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi

/** CSS asset sources captured during Vite emit (keyed by bundle file name). */
const docsCssSources = new Set<string>()

function createCaptureDocsCssPlugin(): VitePlugin {
  return {
    name: 'strip-docs-css-capture',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'asset' || !item.fileName.endsWith('.css')) continue
        const source =
          typeof item.source === 'string'
            ? item.source
            : new TextDecoder().decode(item.source)
        if (source.includes(DOCS_ONLY_CSS_MARKER)) {
          docsCssSources.add(source)
        }
      }
    }
  }
}

export function removeDocsStylesheetLinks(
  html: string,
  docsStylesheetNames: ReadonlySet<string>
): string {
  if (docsStylesheetNames.size === 0) return html
  return html.replace(STYLESHEET_LINK_RE, (match, fileName: string) =>
    docsStylesheetNames.has(fileName) ? '' : match
  )
}

export function removeDocsCssFromInlineStyles(
  html: string,
  docsCssChunks: ReadonlySet<string>
): string {
  if (docsCssChunks.size === 0) return html

  return html.replace(STYLE_TAG_RE, (match, css: string) => {
    let next = css
    for (const chunk of docsCssChunks) {
      if (!next.includes(chunk)) continue
      next = next.replaceAll(chunk, '')
    }
    if (next === css) return match
    return match.replace(css, next)
  })
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
    if (head.includes(DOCS_ONLY_CSS_MARKER)) {
      names.add(entry)
      docsCssSources.add(head)
    }
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

function stripMainSiteHtml(
  html: string,
  docsStylesheetNames: ReadonlySet<string>
): string {
  let next = removeDocsStylesheetLinks(html, docsStylesheetNames)
  next = removeDocsCssFromInlineStyles(next, docsCssSources)
  return next
}

export function stripDocsCssFromMainSite(): AstroIntegration {
  return {
    name: 'strip-docs-css-from-main-site',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [createCaptureDocsCssPlugin()]
          }
        })
      },
      'astro:build:done': async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir)
        const astroDir = path.join(distDir, '_astro')
        const docsStylesheets = await findDocsOnlyStylesheetNames(astroDir)

        if (docsStylesheets.size === 0 && docsCssSources.size === 0) {
          logger.warn(
            '[strip-docs-css] No docs-only CSS found; skipping main-site strip'
          )
          return
        }

        const htmlFiles = await collectHtmlFiles(distDir)
        let updatedPages = 0

        for (const filePath of htmlFiles) {
          if (filePath.includes(DEVELOPERS_PATH_SEGMENT)) continue

          const html = await readFile(filePath, 'utf8')
          const next = stripMainSiteHtml(html, docsStylesheets)
          if (next === html) continue

          await writeFile(filePath, next)
          updatedPages += 1
        }

        const removedNames = [...docsStylesheets]
        logger.info(
          `[strip-docs-css] Stripped Starlight docs CSS from ${updatedPages} main-site page(s)` +
            (removedNames.length > 0
              ? ` (links: ${removedNames.join(', ')})`
              : '') +
            (docsCssSources.size > 0
              ? `; ${docsCssSources.size} inlined chunk(s) removed`
              : '')
        )
      }
    }
  }
}
