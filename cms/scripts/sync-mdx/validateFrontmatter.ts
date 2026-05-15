/**
 * Frontmatter Validation
 *
 * Validates MDX frontmatter against Zod schemas before syncing to Strapi.
 * Invalid files are filtered out during sync to prevent corrupting CMS data.
 */
import type { ContentTypeConfig } from './config'
import type { MDXFile } from './mdxTypes'

interface ValidationErrorContext {
  filepath: string
  pathSlug: string
  locale: string
  errors: string[]
}

/**
 * Returned by `validateFrontmatter` when an MDX file fails its schema check.
 * Subclasses Error so callers can narrow with `instanceof ValidationError`
 * (or `instanceof Error`) and so the message field is human-readable in
 * stack traces / logs.
 */
export class ValidationError extends Error {
  public readonly filepath: string
  public readonly pathSlug: string
  public readonly locale: string
  public readonly errors: string[]

  constructor(ctx: ValidationErrorContext) {
    super(`${ctx.filepath}: ${ctx.errors.join('; ')}`)
    this.name = 'ValidationError'
    this.filepath = ctx.filepath
    this.pathSlug = ctx.pathSlug
    this.locale = ctx.locale
    this.errors = ctx.errors
  }
}

/**
 * Validate one MDX file against the schema for its content type.
 * Returns the validated MDX file on success, or a `ValidationError`
 * describing the problem on failure.
 */
export function validateFrontmatter(
  config: ContentTypeConfig,
  mdx: MDXFile
): MDXFile | ValidationError {
  const { schema } = config
  if (!schema) return mdx

  const result = schema.safeParse({
    ...mdx.frontmatter,
    pathSlug: mdx.pathSlug
  })

  if (!result.success && result.error) {
    const errors = result.error.issues.map((issue) => {
      const path =
        issue.path.length > 0 ? `${issue.path.map(String).join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    return new ValidationError({
      filepath: mdx.filepath,
      pathSlug: mdx.pathSlug,
      locale: mdx.locale,
      errors
    })
  }

  return mdx
}

export function validateMdxFiles(
  config: ContentTypeConfig,
  mdxFiles: MDXFile[]
): { valid: MDXFile[]; invalid: ValidationError[] } {
  const valid: MDXFile[] = []
  const invalid: ValidationError[] = []

  for (const mdx of mdxFiles) {
    const result = validateFrontmatter(config, mdx)
    if (result instanceof ValidationError) {
      invalid.push(result)
    } else {
      valid.push(result)
    }
  }

  return { valid, invalid }
}
