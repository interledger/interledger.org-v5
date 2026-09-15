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
