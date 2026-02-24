/**
 * Frontmatter Validation
 *
 * Validates MDX frontmatter against Zod schemas before syncing to Strapi.
 * Invalid files are filtered out during sync to prevent corrupting CMS data.
 */
import type { ContentTypeConfig } from './config'
import type { MDXFile } from './mdxTypes'

export interface ValidationError {
  filepath: string
  slug: string
  locale: string
  errors: string[]
}

export function validateFrontmatter(
  config: ContentTypeConfig,
  mdx: MDXFile
): ValidationError | null {
  const { schema } = config
  if (!schema) return null

  const result = schema.safeParse({
    ...mdx.frontmatter,
    slug: mdx.slug
  })

  if (!result.success && result.error) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    return {
      filepath: mdx.filepath,
      slug: mdx.slug,
      locale: mdx.locale,
      errors
    }
  }

  return null
}

export function validateMdxFiles(
  config: ContentTypeConfig,
  mdxFiles: MDXFile[]
): { valid: MDXFile[]; invalid: ValidationError[] } {
  const valid: MDXFile[] = []
  const invalid: ValidationError[] = []

  for (const mdx of mdxFiles) {
    const error = validateFrontmatter(config, mdx)
    if (error) {
      invalid.push(error)
    } else {
      valid.push(mdx)
    }
  }

  return { valid, invalid }
}
