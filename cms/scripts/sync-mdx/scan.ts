import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { ContentTypes } from './config'

export interface MDXFile {
  file: string
  filepath: string
  slug: string
  locale: string
  frontmatter: Record<string, unknown>
  content: string
  isLocalization: boolean
  localizes: string | null
}

interface ScanOptions {
  baseDir: string
  locale: string
  isLocalization: boolean
}

function scanDirectory({ baseDir, locale, isLocalization }: ScanOptions): MDXFile[] {
  const mdxFiles: MDXFile[] = []

  if (!fs.existsSync(baseDir)) {
    return mdxFiles
  }

  let files: string[]
  try {
    files = fs.readdirSync(baseDir)
  } catch (error) {
    console.error(`Failed to read directory: ${baseDir}`, error)
    return mdxFiles
  }

  for (const file of files) {
    if (!file.endsWith('.mdx')) continue

    const filepath = path.join(baseDir, file)
    let fileContent: string
    try {
      fileContent = fs.readFileSync(filepath, 'utf-8')
    } catch (error) {
      console.error(`Failed to read file: ${filepath}`, error)
      continue
    }
    const { data: frontmatter, content } = matter(fileContent)
    const trimmedContent = content.trim()

    let slug = frontmatter.slug as string
    if (!slug) {
      slug = file.replace(/\.mdx$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
    }

    mdxFiles.push({
      file,
      filepath,
      slug,
      locale: (frontmatter.locale as string) || locale,
      frontmatter,
      content: trimmedContent,
      isLocalization,
      localizes: (frontmatter.localizes as string) || null
    })
  }

  return mdxFiles
}

export function scanMDXFiles(
  contentType: keyof ContentTypes,
  contentTypes: ContentTypes
): MDXFile[] {
  const config = contentTypes[contentType]
  const baseDir = config.dir
  const mdxFiles: MDXFile[] = []

  // Base directory (default locale)
  mdxFiles.push(
    ...scanDirectory({
      baseDir,
      locale: 'en',
      isLocalization: false
    })
  )

  // Locale directories: src/content/<locale>/<contentTypeDir>
  const contentDir = path.dirname(baseDir)
  if (!fs.existsSync(contentDir)) {
    return mdxFiles
  }

  let localeDirs: fs.Dirent[]
  try {
    localeDirs = fs.readdirSync(contentDir, { withFileTypes: true })
  } catch (error) {
    console.error(`Failed to read content directory: ${contentDir}`, error)
    return mdxFiles
  }
  for (const localeDir of localeDirs) {
    if (!localeDir.isDirectory()) continue
    if (localeDir.name === path.basename(baseDir)) continue

    const localeContentDir = path.join(
      contentDir,
      localeDir.name,
      path.basename(baseDir)
    )

    if (!fs.existsSync(localeContentDir)) continue

    mdxFiles.push(
      ...scanDirectory({
        baseDir: localeContentDir,
        locale: localeDir.name,
        isLocalization: true
      })
    )
  }

  return mdxFiles
}

/** Locales to check for orphan deletion. Returns union across ALL content types
 * so we delete e.g. es/sobre-nosotros in Strapi even when es/foundation-pages dir was removed. */
export function getLocalesToCheck(
  _contentType: keyof ContentTypes,
  contentTypes: ContentTypes
): string[] {
  const locales = new Set<string>(['en'])

  for (const contentType of Object.keys(contentTypes) as Array<keyof ContentTypes>) {
    const config = contentTypes[contentType]
    const baseDir = config.dir
    const contentDir = path.dirname(baseDir)

    if (!fs.existsSync(contentDir)) continue

    try {
      for (const ent of fs.readdirSync(contentDir, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue
        if (ent.name === path.basename(baseDir)) continue
        const localeContentDir = path.join(contentDir, ent.name, path.basename(baseDir))
        if (fs.existsSync(localeContentDir)) {
          locales.add(ent.name.split('-')[0])
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(locales)
}
