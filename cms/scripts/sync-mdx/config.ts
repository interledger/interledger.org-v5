import { getContentPath } from '@/utils/paths'
import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import { buildPagePayload } from './mdxTransformer'
import {
  ambassadorFrontmatterSchema,
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema
} from './siteSchemas'

/**
 * Minimal schema interface for frontmatter validation.
 * Structural (duck-typed) so it works with any Zod version or compatible library.
 */
export interface FrontmatterSchema {
  parse(data: unknown): unknown
  safeParse(data: unknown): {
    success: boolean
    error?: { issues: Array<{ path: (string | number)[]; message: string }> }
  }
}

export interface ContentTypeConfig {
  dir: string
  apiId: string
  /** Optional schema for frontmatter validation. Absent = validation skipped. */
  schema?: FrontmatterSchema
  /** Builds the Strapi payload from an MDX file. May be async (e.g. for photo lookups). */
  buildPayload: (
    mdx: MDXFile,
    strapi: StrapiClient,
    existing: StrapiEntry | null
  ) => Promise<Record<string, unknown>>
}

export interface ContentTypes {
  'foundation-pages': ContentTypeConfig
  'summit-pages': ContentTypeConfig
  ambassadors: ContentTypeConfig
}

/** Coerce YAML null / "null" / empty-string values to null. */
function nullOrValue(v: unknown): string | null {
  if (v === 'null' || v == null || v === '') return null
  return String(v)
}

export function buildContentTypes(projectRoot: string): ContentTypes {
  return {
    'foundation-pages': {
      dir: getContentPath(projectRoot, 'foundationPages'),
      apiId: 'foundation-pages',
      schema: foundationPageFrontmatterSchema,
      buildPayload: async (mdx, _strapi, existing) =>
        buildPagePayload(foundationPageFrontmatterSchema, mdx, existing)
    },
    'summit-pages': {
      dir: getContentPath(projectRoot, 'summit'),
      apiId: 'summit-pages',
      schema: summitPageFrontmatterSchema,
      buildPayload: async (mdx, _strapi, existing) =>
        buildPagePayload(summitPageFrontmatterSchema, mdx, existing)
    },
    ambassadors: {
      dir: getContentPath(projectRoot, 'ambassadors'),
      apiId: 'ambassadors',
      schema: ambassadorFrontmatterSchema,
      buildPayload: async (mdx, strapi, _existing) => {
        const photoUrl = nullOrValue(mdx.frontmatter.photo as string)
        const photoId = photoUrl
          ? await strapi.findUploadByUrl(photoUrl)
          : null
        if (photoUrl && !photoId) {
          console.warn(
            `   ⚠️  Photo not found in Strapi uploads for "${mdx.slug}": ${photoUrl}`
          )
        }
        return {
          name: nullOrValue(mdx.frontmatter.name),
          slug: mdx.slug,
          description: nullOrValue(mdx.frontmatter.description),
          ...(photoId ? { photo: photoId } : {}),
          linkedinUrl: nullOrValue(mdx.frontmatter.linkedinUrl),
          grantReportUrl: nullOrValue(mdx.frontmatter.grantReportUrl),
          publishedAt: new Date().toISOString()
        }
      }
    }
  }
}
