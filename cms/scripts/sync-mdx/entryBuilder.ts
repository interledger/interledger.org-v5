import { marked } from 'marked'
import { type MDXFile } from './scan'
import type { ContentTypes } from './config'
import type { StrapiEntry } from './strapi'
import {
  pageFrontmatterSchema
} from '../../../src/schemas/content'

marked.use({ headerIds: false })

const PAGE_TYPES = ['foundation-pages', 'summit-pages'] as const

export function getEntryField(entry: StrapiEntry | null, key: string): unknown {
  if (!entry) return null
  return (
    entry[key] ??
    (entry as Record<string, unknown>).attributes?.[key as keyof typeof entry] ??
    null
  )
}

export function isPageType(contentType: keyof ContentTypes): boolean {
  return PAGE_TYPES.includes(contentType as (typeof PAGE_TYPES)[number])
}

export function buildEntryData(
  contentType: keyof ContentTypes,
  mdx: MDXFile,
  existingEntry: StrapiEntry | null = null
): Record<string, unknown> | null {
  if (isPageType(contentType)) {
    const parsed = pageFrontmatterSchema.parse({
      ...mdx.frontmatter,
      slug: mdx.slug
    })
    const data: Record<string, unknown> = {
      title: parsed.title,
      slug: parsed.slug,
      publishedAt: new Date().toISOString()
    }

    if (parsed.heroTitle || parsed.heroDescription) {
      data.hero = {
        title: parsed.heroTitle || parsed.title,
        description: parsed.heroDescription || ''
      }
    } else {
      const existingHero = getEntryField(existingEntry, 'hero')
      if (existingHero) {
        data.hero = existingHero
      }
    }

    const mdxBody = (mdx.content || '').trim()
    if (mdxBody.length > 0) {
      data.content = [
        {
          __component: 'blocks.paragraph',
          content: marked.parse(mdx.content)
        }
      ]
    } else {
      const existingContent = getEntryField(existingEntry, 'content')
      if (existingContent) {
        data.content = existingContent
      }
    }

    return data
  }

  return null
}
