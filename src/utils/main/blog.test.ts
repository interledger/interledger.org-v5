import { describe, it, expect } from 'vitest'
import type { CollectionEntry } from 'astro:content'
import {
  getFeaturedPosts,
  getBlogThumbnail,
  TECH_BLOG_FALLBACK_THUMBNAIL
} from './blog'

type Entry = CollectionEntry<'foundation-blog'>

interface FakePost {
  slug: string
  date: string
  featured?: boolean
  thumbnailImage?: string
  featureImage?: string
  legacy?: boolean
}

// Minimal stand-in for a content collection entry; only the fields the helpers
// read are populated.
function makePost(post: FakePost): Entry {
  return {
    id: post.slug,
    data: {
      pathSlug: post.slug,
      date: new Date(post.date),
      featured: post.featured ?? false,
      thumbnailImage: post.thumbnailImage,
      featureImage: post.featureImage,
      legacy: post.legacy ?? false
    }
  } as unknown as Entry
}

describe('getFeaturedPosts', () => {
  it('returns an empty array when there are no posts', () => {
    expect(getFeaturedPosts([])).toEqual([])
  })

  it('returns featured posts newest-first when there are more than the limit', () => {
    const posts = [
      makePost({ slug: 'a', date: '2025-01-01', featured: true }),
      makePost({ slug: 'b', date: '2025-03-01', featured: true }),
      makePost({ slug: 'c', date: '2025-02-01', featured: true }),
      makePost({ slug: 'd', date: '2025-04-01', featured: true })
    ]

    const result = getFeaturedPosts(posts).map((p) => p.data.pathSlug)

    expect(result).toEqual(['d', 'b', 'c'])
  })

  it('pads with the most recent non-featured posts when fewer than the limit are featured', () => {
    const posts = [
      makePost({ slug: 'feat', date: '2025-01-01', featured: true }),
      makePost({ slug: 'recent', date: '2025-05-01' }),
      makePost({ slug: 'old', date: '2024-01-01' })
    ]

    const result = getFeaturedPosts(posts).map((p) => p.data.pathSlug)

    // featured first, then newest non-featured to fill the section
    expect(result).toEqual(['feat', 'recent', 'old'])
  })

  it('never returns more than the limit', () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      makePost({ slug: `p${i}`, date: `2025-01-0${(i % 9) + 1}` })
    )

    expect(getFeaturedPosts(posts)).toHaveLength(3)
  })

  it('returns fewer than the limit when not enough posts exist', () => {
    const posts = [makePost({ slug: 'only', date: '2025-01-01' })]

    expect(getFeaturedPosts(posts)).toHaveLength(1)
  })
})

describe('getBlogThumbnail', () => {
  it('falls back to the feature image when no thumbnail', () => {
    const post = makePost({
      slug: 'a',
      date: '2025-01-01',
      featureImage: '/feature.jpg'
    })

    expect(getBlogThumbnail(post)).toBe('/feature.jpg')
  })

  it('uses the tech fallback for legacy posts with no images', () => {
    const post = makePost({ slug: 'a', date: '2025-01-01', legacy: true })

    expect(getBlogThumbnail(post)).toBe(TECH_BLOG_FALLBACK_THUMBNAIL)
  })

  it('returns null when nothing is available and the post is not legacy', () => {
    const post = makePost({ slug: 'a', date: '2025-01-01' })

    expect(getBlogThumbnail(post)).toBeNull()
  })
})
