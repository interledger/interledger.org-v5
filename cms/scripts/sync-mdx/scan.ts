import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { LOCALES, defaultLang } from '@/utils/mdx'
import type { ContentTypes } from './config'
import type { MDXFile } from './mdxTypes'

/** Top-level MDX directory names that denote a non-default locale (e.g. `es/`). */
const LOCALE_DIR_NAMES = new Set(LOCALES.filter((l) => l !== defaultLang))

/**
 * Rightmost locale directory segment in a path (before the filename); defaults to {@link defaultLang}.
 * Examples: `es/page.mdx` → es; `es/grants/page.mdx` → es; `grants/page.mdx` → en.
 */
function inferLocaleFromRelativePath(relPath: string): string {
  const parts = relPath.split(/[/\\]/).filter(Boolean)
  const dirs = parts.slice(0, -1)
  for (let i = dirs.length - 1; i >= 0; i--) {
    const part = dirs[i]!
    if (LOCALE_DIR_NAMES.has(part)) return part
  }
  return defaultLang
}

/**
 * Path slug fallback from relative path: drop locale folder segments, strip extension.
 * Used when frontmatter has no pathSlug.
 */
function pathSlugFallbackFromRelativePath(relPath: string): string {
  const withoutExt = relPath.replace(/\.(mdx|md)$/i, '')
  return withoutExt
    .split(/[/\\]/)
    .filter((p) => !LOCALE_DIR_NAMES.has(p))
    .join('/')
}

/**
 * Scans MDX files for a content type: one recursive walk from the collection root.
 *
 * Locale is inferred from directory structure (rightmost `es/` segment before the file),
 * overridden by `locale` in frontmatter when present. `isLocalization` follows the
 * resolved locale (frontmatter wins for unusual placements).
 *
 * English files may live at any depth (e.g. `grant/page.mdx`). Localized files use
 * a collection-level locale directory such as `es/grant/...`.
 */
export function scanMDXFiles(
  contentType: keyof ContentTypes,
  contentTypes: ContentTypes
): MDXFile[] {
  const config = contentTypes[contentType]
  const baseDir = config.dir
  const mdxFiles: MDXFile[] = []

  if (!fs.existsSync(baseDir)) {
    return mdxFiles
  }

  let relPaths: string[]
  try {
    relPaths = fs.readdirSync(baseDir, { recursive: true }) as string[]
  } catch (error) {
    console.error(`Failed to read content directory: ${baseDir}`, error)
    return mdxFiles
  }

  for (const rel of relPaths) {
    if (!rel.endsWith('.mdx') && !rel.endsWith('.md')) {
      continue
    }

    const filepath = path.join(baseDir, rel)

    let fileContent: string
    try {
      fileContent = fs.readFileSync(filepath, 'utf-8')
    } catch (error) {
      console.error(`Failed to read file: ${filepath}`, error)
      continue
    }

    const { data: frontmatter, content } = matter(fileContent)
    const trimmedContent = content.trim()

    const inferredLocale = inferLocaleFromRelativePath(rel)
    const fileLocale = (frontmatter.locale as string) || inferredLocale
    const isLocalization = fileLocale !== defaultLang

    let pathSlug: string
    if (frontmatter.pathSlug && typeof frontmatter.pathSlug === 'string') {
      pathSlug = frontmatter.pathSlug.replace(/^\/+|\/+$/g, '')
    } else {
      pathSlug = pathSlugFallbackFromRelativePath(rel)
    }

    const localizesValue = (frontmatter.localizes as string) || null

    mdxFiles.push({
      file: rel.split(/[/\\]/).join('/'),
      filepath,
      pathSlug,
      locale: fileLocale,
      frontmatter,
      content: trimmedContent,
      isLocalization,
      localizes: localizesValue
    })
  }

  return mdxFiles
}

/**
 * Gets all locales that exist across ALL content types for orphan deletion.
 *
 * This ensures we check for orphaned entries in all locales, even if a specific
 * content type's locale directory was removed.
 *
 * Example: If foundation-pages/es/ is removed but summit-pages/es/ still exists,
 * we still check for orphaned "es" entries in Strapi.
 *
 * Only directories whose names are in LOCALE_DIR_NAMES are treated as locale dirs.
 *
 * @param _contentType - Content type (unused, kept for API consistency)
 * @param contentTypes - All content type configurations
 * @returns Array of locale codes (e.g., ['en', 'es'])
 */
export function getLocalesToCheck(
  _contentType: keyof ContentTypes,
  contentTypes: ContentTypes
): string[] {
  const locales = new Set<string>([defaultLang])

  // Check all content types to find all locales that exist
  for (const contentType of Object.keys(contentTypes) as Array<
    keyof ContentTypes
  >) {
    const config = contentTypes[contentType]
    const baseDir = config.dir

    if (!fs.existsSync(baseDir)) {
      continue
    }

    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        if (LOCALE_DIR_NAMES.has(entry.name)) {
          // Direct locale dir: e.g., foundation-pages/es/
          locales.add(entry.name)
        }
      }
    } catch {
      // Ignore errors when reading directories
    }
  }

  return Array.from(locales)
}
