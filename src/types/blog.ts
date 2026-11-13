export interface BlogThumbnail {
  src: string
  alt: string
  /** Base64 LQIP blur placeholder for `src`, when its source field has one. */
  blur?: string
}

/**
 * A thumbnail as shipped in the blog search catalog. Client-rendered rows get
 * a precomputed `srcset` because they cannot go through `OptimizedImage`'s
 * build-time `<picture>`; it is absent when the source has no variants (an SVG,
 * or a file missing from this deploy's catalog).
 */
export interface BlogSearchThumbnail extends BlogThumbnail {
  srcset?: string
}

/**
 * A post's first author as shipped in the blog search catalog, already in the
 * shape BlogCardByline renders: `href` is null when the bio has no link or one
 * with a rejected scheme, `avatarSrc` is null when the bio has no image (the
 * row then shows the fallback icon).
 */
export interface BlogSearchAuthor {
  name: string
  href: string | null
  avatarSrc: string | null
}
