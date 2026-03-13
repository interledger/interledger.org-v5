import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { ContentTypes } from './config'
import type { MDXFile } from './mdxTypes'

interface ScanOptions {
  baseDir: string
  locale: string
  isLocalization: boolean
}

/**
 * Scans a directory for MDX files and extracts their metadata and content.
 *
 * @param baseDir - Directory path to scan for MDX files
 * @param locale - Default locale for files in this directory
 * @param isLocalization - Whether files in this directory are localizations (not English)
 * @returns Array of parsed MDX file objects
 */
function scanDirectory({
  baseDir,
  locale,
  isLocalization
}: ScanOptions): MDXFile[] {
  const mdxFiles: MDXFile[] = []

  // Skip if directory doesn't exist
  if (!fs.existsSync(baseDir)) {
    return mdxFiles
  }

  // Read all files in the directory
  let files: string[]
  try {
    files = fs.readdirSync(baseDir)
  } catch (error) {
    console.error(`Failed to read directory: ${baseDir}`, error)
    return mdxFiles
  }

  // Process each file
  for (const filename of files) {
    // Skip non-MD/MDX files
    if (!filename.endsWith('.mdx') && !filename.endsWith('.md')) {
      continue
    }

    const filepath = path.join(baseDir, filename)

    // Read file content
    let fileContent: string
    try {
      fileContent = fs.readFileSync(filepath, 'utf-8')
    } catch (error) {
      console.error(`Failed to read file: ${filepath}`, error)
      continue
    }

    // Parse frontmatter and content from MDX file
    const { data: frontmatter, content } = matter(fileContent)
    const trimmedContent = content.trim()

    // Extract pathSlug: prefer frontmatter.pathSlug, otherwise derive from filename
    let pathSlug: string
    if (frontmatter.pathSlug && typeof frontmatter.pathSlug === 'string') {
      pathSlug = frontmatter.pathSlug
    } else {
      // Remove .mdx extension and date prefix (e.g., "2025-01-15-") if present
      pathSlug = filename
        .replace(/\.(mdx|md)$/, '')
        .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    }

    // Extract locale: prefer frontmatter, otherwise use directory locale
    const fileLocale = (frontmatter.locale as string) || locale

    // Extract localizes field (which English entry this localizes)
    const localizesValue = (frontmatter.localizes as string) || null

    mdxFiles.push({
      file: filename,
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
 * Scans MDX files for a specific content type from base directory and all locale directories.
 *
 * Scans:
 * - Base directory: src/content/<contentTypeDir>/ (English files)
 * - Locale directories: src/content/<contentTypeDir>/<locale>/ (localized files)
 *
 * @param contentType - Content type to scan (e.g., 'foundation-pages')
 * @param contentTypes - Content type configurations
 * @returns Array of all MDX files found (English + all locales)
 */
export function scanMDXFiles(
  contentType: keyof ContentTypes,
  contentTypes: ContentTypes
): MDXFile[] {
  const config = contentTypes[contentType]
  const baseDir = config.dir
  const mdxFiles: MDXFile[] = []

  // Scan base directory for English files (default locale)
  const englishFiles = scanDirectory({
    baseDir,
    locale: 'en',
    isLocalization: false
  })
  mdxFiles.push(...englishFiles)

  // Scan locale directories for translated files
  // Structure: src/content/<contentTypeDir>/<locale>/
  if (!fs.existsSync(baseDir)) {
    return mdxFiles
  }

  // Read all directories in the content folder
  let localeDirs: fs.Dirent[]
  try {
    localeDirs = fs.readdirSync(baseDir, { withFileTypes: true })
  } catch (error) {
    console.error(`Failed to read content directory: ${baseDir}`, error)
    return mdxFiles
  }

  // Process each locale directory
  for (const localeDir of localeDirs) {
    // Skip files (only process directories)
    if (!localeDir.isDirectory()) {
      continue
    }

    // Build path to locale-specific content directory
    // Example: src/content/foundation-pages/es/
    const localeContentDir = path.join(baseDir, localeDir.name)

    // Skip if locale directory doesn't have this content type
    if (!fs.existsSync(localeContentDir)) {
      continue
    }

    // Scan locale directory for translated files
    const localeFiles = scanDirectory({
      baseDir: localeContentDir,
      locale: localeDir.name,
      isLocalization: true
    })
    mdxFiles.push(...localeFiles)
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
 * @param _contentType - Content type (unused, kept for API consistency)
 * @param contentTypes - All content type configurations
 * @returns Array of locale codes (e.g., ['en', 'es'])
 */
export function getLocalesToCheck(
  _contentType: keyof ContentTypes,
  contentTypes: ContentTypes
): string[] {
  const locales = new Set<string>(['en'])

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
      // Read all directories in the content folder
      const entries = fs.readdirSync(baseDir, { withFileTypes: true })

      for (const entry of entries) {
        // Skip files, only process directories
        if (!entry.isDirectory()) {
          continue
        }

        // Check if this locale has content for this content type
        // Example: src/content/foundation-pages/es/
        const localeContentDir = path.join(baseDir, entry.name)
        if (fs.existsSync(localeContentDir)) {
          locales.add(entry.name)
        }
      }
    } catch {
      // Ignore errors when reading directories
    }
  }

  return Array.from(locales)
}
