import type {
  BlogSearchAuthor,
  BlogSearchThumbnail,
  BlogThumbnail
} from '@/types/blog'
import type { AuthorBioType } from '@/schemas/content'
import { foldSearchText } from '../shared/foldSearchText'
import { safeAbsoluteHref } from '../shared/url'
import { createExcerpt } from './create-excerpt'
import { truncateText } from './text'
import { getBlogThumbnail, getReadingTime } from './blog'
import { getBlogPosts } from './blogPosts'
import { defaultLocale } from './i18'
import { getBlogPostPath } from './translatePath'
import {
  buildImageSrcset,
  getOptimizedImage,
  type OptimizedImage
} from './images'
import {
  AVATAR_CDN_WIDTHS,
  SEARCH_THUMBNAIL_CDN_WIDTHS,
  sanitizeBlurPlaceholder
} from './imagePaths'
import type { Locale } from './locales'

// matchesBlogSearch/filterBlogPosts live in blogSearchFilters.ts and are
// deliberately not re-exported here: this module imports astro:content
// (getCollection) at load time, so forwarding them through it would let a
// client-side import pull that server-only dependency in by extension.
// Import them from './blogSearchFilters' (or '@/utils', which re-exports
// straight from there) instead.

const SEARCH_SNIPPET_MAX_LENGTH = 160
// Bounds the per-post contribution to the shared JSON catalog. A full post
// body would make the fetched-on-first-keystroke index needlessly large;
// title/description plus the opening of the body covers what people actually
// search for.
const SEARCH_TEXT_EXCERPT_MAX_LENGTH = 1000

/**
 * A single post's fields as shipped in the client-side search catalog (see
 * `blog-search-index.json.ts` and `src/scripts/blog-search.ts`). Trimmed to
 * what a slim search-result row needs — no raw MDX body.
 */
export interface BlogSearchEntry {
  id: string
  title: string
  descriptionSnippet: string
  categories: string[]
  date: string
  postPath: string
  thumbnail: BlogSearchThumbnail | null
  author: BlogSearchAuthor | null
  readingTime: number
  locale: Locale
  searchText: string
}

function stripMarkdownSyntax(body: string): string {
  return createExcerpt(body).replace(/\s+/g, ' ').trim()
}

/**
 * The narrowest variant rather than `fullSrc`, because `fullSrc` means
 * different things in the two image modes: the widest CDN rung with the CDN
 * on, but the *original-dimension* `-full.webp` in build-encoder mode, which
 * would put a full-size file in a small search-row slot on any non-CDN build.
 * Falls back to `fullSrc`, then the raw path, only when there are no variants
 * at all (an SVG, or a source missing from this deploy's catalog).
 */
function narrowestImageSrc(
  { variants, fullSrc }: OptimizedImage,
  rawSrc: string
): string {
  return variants[0]?.src ?? fullSrc ?? rawSrc
}

/**
 * Build the thumbnail a client-rendered search row gets.
 *
 * Rows are cloned from a `<template>` in the browser, so they never pass
 * through `OptimizedImage`'s build-time `<picture>`. The responsive data is
 * therefore precomputed here and shipped in the catalog: a `srcset` the row's
 * plain `<img>` can use, so the browser still picks per device rather than
 * being handed one fixed width. `src` is the fallback for browsers that ignore
 * the `srcset` (see `narrowestImageSrc`).
 *
 * The LQIP rides along so rows blur up like the static BlogCard, sanitised
 * here rather than in the browser — it ends up inside a CSS `url()`, and the
 * catalog is the last point where the value is still ours to validate.
 */
function toSearchThumbnail(
  thumbnail: BlogThumbnail | null
): BlogSearchThumbnail | null {
  if (!thumbnail) return null

  const optimized = getOptimizedImage(
    thumbnail.src,
    SEARCH_THUMBNAIL_CDN_WIDTHS
  )
  const { variants } = optimized
  const blur = sanitizeBlurPlaceholder(thumbnail.blur)
  const srcset = variants.length > 0 ? buildImageSrcset(variants) : undefined

  return {
    src: narrowestImageSrc(optimized, thumbnail.src),
    alt: thumbnail.alt,
    ...(srcset ? { srcset } : {}),
    ...(blur ? { blur } : {})
  }
}

/**
 * The byline BlogCard renders, reduced to data a client-rendered row can use.
 * The avatar is a single URL rather than a srcset: it only ever renders at
 * 40px. With the CDN that URL is the 240px avatar rung; without it, the
 * narrowest encoded file (the source's own width, at most 640px). Either is
 * wide enough for DPR 3 (120px) unless the source itself is narrower.
 */
function toSearchAuthor(
  bio: AuthorBioType | undefined
): BlogSearchAuthor | null {
  if (!bio) return null

  return {
    name: bio.author,
    href: safeAbsoluteHref(bio.link),
    avatarSrc: bio.image
      ? narrowestImageSrc(
          getOptimizedImage(bio.image, AVATAR_CDN_WIDTHS),
          bio.image
        )
      : null
  }
}

/**
 * Builds the combined EN+ES search catalog. One file for both content
 * languages — unlike routeLocale-scoped endpoints elsewhere, the blog's
 * ContentLangFilter toggle is independent of the site's UI locale, so a
 * single fetch covers both without a reload.
 */
export async function getBlogSearchIndex(): Promise<BlogSearchEntry[]> {
  // Gated and newest-first — blogPosts.ts is the authority on both, so the
  // index can never offer a post the listing has not published yet.
  const posts = await getBlogPosts()

  return posts.map((post) => {
    const { title, description, categories, date } = post.data
    const locale = (post.data.locale as Locale | undefined) ?? defaultLocale
    const excerpt = stripMarkdownSyntax(post.body ?? '')
    const descriptionSnippet = truncateText(
      description || excerpt,
      SEARCH_SNIPPET_MAX_LENGTH
    )

    const searchText = foldSearchText(
      [
        title,
        description,
        truncateText(excerpt, SEARCH_TEXT_EXCERPT_MAX_LENGTH),
        ...categories
      ].join(' ')
    )

    return {
      id: post.id,
      title,
      descriptionSnippet,
      categories,
      date: date.toISOString(),
      postPath: getBlogPostPath(post),
      thumbnail: toSearchThumbnail(getBlogThumbnail(post)),
      // First author only, as BlogCard shows.
      author: toSearchAuthor(post.data.articleBios[0]),
      readingTime: getReadingTime(post.body),
      locale,
      searchText
    }
  })
}
