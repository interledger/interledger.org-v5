import { getCollection } from 'astro:content'
import type { BlogThumbnail } from '@/types/blog'
import { foldSearchText } from '../shared/foldSearchText'
import { createExcerpt } from './create-excerpt'
import { truncateText } from './text'
import { getBlogThumbnail } from './blog'
import { getBlogPostPath, defaultLocale } from './i18'
import { getOptimizedImage } from './images'
import {
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
  thumbnail: BlogThumbnail | null
  locale: Locale
  searchText: string
}

function stripMarkdownSyntax(body: string): string {
  return createExcerpt(body).replace(/\s+/g, ' ').trim()
}

/**
 * Client-rendered search rows use a plain <img> (no build-time <picture>
 * pipeline), so route the thumbnail through the same single-URL-context
 * pattern as getHeroSectionStyle/VideoEmbed: take the optimized/CDN fullSrc,
 * falling back to the raw path when optimization isn't available (SVG/GIF
 * sources, or a source not yet in the deployed-sources catalog).
 *
 * The narrow ladder matters here: fullSrc is the widest rung offered, so the
 * default would hand a ~340 px column a 1920 px file. The LQIP rides along so
 * search rows blur up like the static BlogCard does, and is sanitised now
 * rather than in the browser — it ends up inside a CSS `url()`, and the
 * catalog is the last point where the value is still ours to validate.
 */
function toSearchThumbnail(
  thumbnail: BlogThumbnail | null
): BlogThumbnail | null {
  if (!thumbnail) return null
  const fullSrc = getOptimizedImage(
    thumbnail.src,
    SEARCH_THUMBNAIL_CDN_WIDTHS
  ).fullSrc
  const blur = sanitizeBlurPlaceholder(thumbnail.blur)
  return {
    src: fullSrc ?? thumbnail.src,
    alt: thumbnail.alt,
    ...(blur ? { blur } : {})
  }
}

/**
 * Builds the combined EN+ES search catalog. One file for both content
 * languages — unlike routeLocale-scoped endpoints elsewhere, the blog's
 * ContentLangFilter toggle is independent of the site's UI locale, so a
 * single fetch covers both without a reload.
 */
export async function getBlogSearchIndex(): Promise<BlogSearchEntry[]> {
  // Newest-first, to match the order the listing renders in (see
  // fetchPostsAndTerms in tagFilter.ts). getCollection yields glob order, which
  // for date-prefixed filenames is oldest-first — the opposite of the listing.
  const posts = (await getCollection('foundation-blog')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  )

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
      locale,
      searchText
    }
  })
}
