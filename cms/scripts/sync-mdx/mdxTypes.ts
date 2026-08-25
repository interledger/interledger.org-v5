/**
 * Shared MDX file type used across the sync pipeline.
 * Kept in its own file (no intra-package imports) so both scan.ts and
 * config.ts can import it without creating circular dependencies.
 */

export interface MDXFile {
  file: string
  filepath: string
  pathSlug: string
  /**
   * `section` frontmatter, or null when the content type has no such field.
   * Cross-section collections store a section-relative pathSlug, so section
   * is part of an entry's identity. See entryIdentity.ts.
   */
  section: string | null
  locale: string
  frontmatter: Record<string, unknown>
  content: string
  isLocalization: boolean
  localizes: string | null
}
