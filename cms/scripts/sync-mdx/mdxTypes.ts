/**
 * Shared MDX file type used across the sync pipeline.
 * Kept in its own file (no intra-package imports) so both scan.ts and
 * config.ts can import it without creating circular dependencies.
 */

export interface MDXFile {
  file: string
  filepath: string
  slug: string
  locale: string
  frontmatter: Record<string, unknown>
  content: string
  isLocalization: boolean
  localizes: string | null
}
