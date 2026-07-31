import type { CollectionEntry } from 'astro:content'
import type { Locale } from './locales'

type FoundationBlogEntry = CollectionEntry<'foundation-blog'>

/** Max number of posts shown in the featured section atop the blog listing. */
export const FEATURED_POST_LIMIT = 3

/**
 * Fallback thumbnail for migrated tech/developer blog posts that have no
 * feature image or thumbnail (the current Engineering blog image). Used once
 * the tech and foundation blogs merge (INTORG-691). Swap this path if comms
 * provides a dedicated asset.
 */
export const TECH_BLOG_FALLBACK_THUMBNAIL = '/img/tech-thumbnail.svg'

/**
 * Selects the featured posts for the listing header.
 *
 * Posts flagged `featured` win, newest first. When fewer than the limit are
 * flagged, the list is padded with the most recent non-featured posts so the
 * section is always full (up to the number of posts available).
 *
 * Assumes `posts` is already filtered to a single locale; sorts defensively.
 */
export function getFeaturedPosts(
  posts: FoundationBlogEntry[],
  limit = FEATURED_POST_LIMIT
): FoundationBlogEntry[] {
  const byNewest = [...posts].sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  )
  const featured = byNewest.filter((post) => post.data.featured)
  if (featured.length >= limit) return featured.slice(0, limit)

  const fillers = byNewest.filter((post) => !post.data.featured)
  return [...featured, ...fillers].slice(0, limit)
}

/**
 * Resolves the thumbnail to show for a post in listings.
 *
 * Order: explicit thumbnail → desktop feature image → tech fallback (legacy
 * posts only). Returns null when nothing is available so callers can skip the
 * image rather than render a broken one.
 */
export function getBlogThumbnail(post: FoundationBlogEntry): string | null {
  // const { thumbnailImage, featureImage, legacy } = post.data
  // if (thumbnailImage) return thumbnailImage

  // Existing thumbnails have the wrong aspect ratio for the redesigned card layout.
  // Using featureImage as a fallback until thumbnails are replaced. Restore
  // thumbnailImage as the first check once new assets are in place.
  const { featureImage, legacy } = post.data
  if (featureImage) return featureImage
  if (legacy) return TECH_BLOG_FALLBACK_THUMBNAIL
  return null
}

/**
 * Resolves related-article slugs to posts for display.
 *
 * Prefers the post in `contentLocale`, then falls back to `fallbackLocale`
 * when no translation exists. Callers pass the site's default locale (EN),
 * matching the site's EN-fallback rule so an untranslated related post still
 * shows (in EN) instead of the whole section silently vanishing. Slugs that
 * resolve to nothing (e.g. a stale slug) are skipped so the build never breaks.
 *
 * `posts` should be the full collection across locales, since a related post
 * may only exist in the default locale.
 */
export function resolveRelatedPosts(
  posts: FoundationBlogEntry[],
  slugs: readonly string[] | undefined,
  contentLocale: Locale,
  fallbackLocale: Locale
): FoundationBlogEntry[] {
  const findBySlug = (slug: string, locale: Locale) =>
    posts.find(
      (post) => post.data.pathSlug === slug && post.data.locale === locale
    )

  return (slugs ?? [])
    .map(
      (slug) =>
        findBySlug(slug, contentLocale) ?? findBySlug(slug, fallbackLocale)
    )
    .filter((post): post is FoundationBlogEntry => Boolean(post))
}

export function getReadingTime(text: string | undefined): number {
  if (!text) return 0
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  //Average reading speed: 200 words/minute
  const minutes = Math.max(1, Math.ceil(wordCount / 200))

  return minutes
}
