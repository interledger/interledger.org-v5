import type { ContentTypes } from './config'
import type { MDXFile } from './scan'
import {
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema
} from './siteSchemas'

const SCHEMAS = {
  'foundation-pages': foundationPageFrontmatterSchema,
  'summit-pages': summitPageFrontmatterSchema
}

export interface ValidationError {
  filepath: string
  slug: string
  locale: string
  errors: string[]
}

export function validateFrontmatter(
  contentType: keyof ContentTypes,
  mdx: MDXFile
): ValidationError | null {
  const schema = SCHEMAS[contentType]
  let validationError: ValidationError | null = null

  if (schema) {
    const toValidate = {
      ...mdx.frontmatter,
      slug: mdx.slug
    }

    const result = schema.safeParse(toValidate)

    if (!result.success) {
      const errors = result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message}`
      })

      validationError = {
        filepath: mdx.filepath,
        slug: mdx.slug,
        locale: mdx.locale,
        errors
      }
    }
  }

  return validationError
}

export function validateMdxFiles(
  contentType: keyof ContentTypes,
  mdxFiles: MDXFile[]
): { valid: MDXFile[]; invalid: ValidationError[] } {
  const valid: MDXFile[] = []
  const invalid: ValidationError[] = []

  for (const mdx of mdxFiles) {
    const error = validateFrontmatter(contentType, mdx)
    if (error) {
      invalid.push(error)
    } else {
      valid.push(mdx)
    }
  }

  return { valid, invalid }
}
