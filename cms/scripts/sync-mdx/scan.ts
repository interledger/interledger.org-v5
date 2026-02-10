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

  const files = fs.readdirSync(baseDir)
  for (const file of files) {
    if (!file.endsWith('.mdx')) continue

    const filepath = path.join(baseDir, file)
    const fileContent = fs.readFileSync(filepath, 'utf-8')
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

  const localeDirs = fs.readdirSync(contentDir, { withFileTypes: true })
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
