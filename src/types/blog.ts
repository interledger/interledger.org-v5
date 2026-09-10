export interface BlogThumbnail {
  src: string
  alt: string
  /** Base64 LQIP blur placeholder for `src`, when its source field has one. */
  blur?: string
}
