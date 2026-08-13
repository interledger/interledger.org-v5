/**
 * Media types seeded from disk into Strapi's Media Library (bootstrap and
 * POST /api/seed-media). Kept in sync with `shouldGitSyncUpload` in index.ts:
 * anything git-committed and served from the repo (images, video, PDF) must
 * also be seedable, or an MDX reference resolves to no media record.
 * Larger media storage is tracked in INTORG-902.
 */
export const SEED_MIME_BY_EXT: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.tiff': 'image/tiff',
  // Video (matches VideoEmbed externalUrl regex extensions)
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  // Documents
  '.pdf': 'application/pdf'
}

/** Extensions scanned by seedUploadsFromDisk and cms/scripts/sync-images.ts. */
export const SEEDABLE_EXTENSIONS = new Set(Object.keys(SEED_MIME_BY_EXT))
