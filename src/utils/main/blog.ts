import type { CollectionEntry } from 'astro:content'

type FoundationBlogEntry = CollectionEntry<'foundation-blog'>

/** Max number of posts shown in the featured section atop the blog listing. */
export const FEATURED_POST_LIMIT = 3

/**
 * Fallback thumbnail for migrated tech/developer blog posts that have no
 * feature image or thumbnail (the current Engineering blog image). Used once
 * the tech and foundation blogs merge (INTORG-691). Swap this path if comms
 * provides a dedicated asset.
 */
export const TECH_BLOG_FALLBACK_THUMBNAIL = '/img/og-developers.png'

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
  const { thumbnailImage, featureImage, legacy } = post.data
  if (thumbnailImage) return thumbnailImage
  if (featureImage) return featureImage
  if (legacy) return TECH_BLOG_FALLBACK_THUMBNAIL
  return null
}

export function getReadingTime(text: string | undefined): number {
  if (!text) return 0
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  //Average reading speed: 200 words/minute
  const minutes = Math.max(1, Math.ceil(wordCount / 200))

  return minutes
}
