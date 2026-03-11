/**
 * Shared utilities for locale-aware MDX lifecycle hooks.
 * Used by pageLifecycle and flat locale lifecycles (e.g. ambassador).
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { LOCALES, MATTER_STRINGIFY_OPTIONS } from './mdx'

/**
 * Removes the `localizes` field from locale MDX files that reference the given
 * English slug. Call when the English version is deleted so locale files no
 * longer point to a non-existent source.
 */
export function removeLocalizesFromLocaleFiles(
  englishSlug: string,
  getLocaleDir: (locale: string) => string,
  label: string
): void {
  const nonEnLocales = LOCALES.filter((l) => l !== 'en')
  for (const locale of nonEnLocales) {
    const dir = getLocaleDir(locale)
    if (fs.existsSync(dir)) {
      const mdxFiles = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
      for (const filename of mdxFiles) {
        const filepath = path.join(dir, filename)
        try {
          const raw = fs.readFileSync(filepath, 'utf-8')
          const { data: frontmatter, content } = matter(raw)
          if (frontmatter.localizes === englishSlug) {
            const rest = { ...(frontmatter as Record<string, unknown>) }
            delete rest.localizes
            fs.writeFileSync(
              filepath,
              matter.stringify(content, rest, MATTER_STRINGIFY_OPTIONS),
              'utf-8'
            )
            console.log(
              `✏️  Removed localizes from ${locale} ${label} MDX: ${filepath}`
            )
          }
        } catch (error) {
          console.error(
            `Failed to remove localizes from ${locale} ${label} MDX: ${filepath}`,
            error
          )
        }
      }
    }
  }
}

/**
 * Deletes MDX files for all locales (e.g. on content delete).
 */
export function deleteLocaleMdxFiles(
  getFilePath: (locale: string) => string,
  label: string
): void {
  for (const locale of LOCALES) {
    const filepath = getFilePath(locale)
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath)
        console.log(`🗑️  Deleted ${locale} ${label} MDX: ${filepath}`)
      } catch (error) {
        console.error(
          `Failed to delete ${locale} ${label} MDX: ${filepath}`,
          error
        )
      }
    }
  }
}
