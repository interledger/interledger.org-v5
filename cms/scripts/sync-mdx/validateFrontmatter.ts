import type { ContentTypes } from './config'
import type { MDXFile } from './scan'
import {
  pageFrontmatterSchema
} from '../../../src/schemas/content'

const SCHEMAS = {
  'foundation-pages': pageFrontmatterSchema,
  'summit-pages': pageFrontmatterSchema
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
  if (!schema) return null

  const toValidate = {
    ...mdx.frontmatter,
    slug: mdx.slug
  }

  const result = schema.safeParse(toValidate)
  if (result.success) return null

  const issues = result.error.issues
  const errors = (issues ?? []).flatMap((e: { path: unknown[]; message: string }) =>
    Array.isArray(e.path) && e.path.length > 0
      ? [`${e.path.join('.')}: ${e.message}`]
      : [e.message]
  )

  return {
    filepath: mdx.filepath,
    slug: mdx.slug,
    locale: mdx.locale || 'en',
    errors
  }
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
