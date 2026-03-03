import { getContentPath } from '@/utils/paths'
import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import {
  buildPagePayload,
  buildBlogPayload,
  buildAmbassadorPayload
} from './mdxTransformer'
import {
  ambassadorFrontmatterSchema,
  foundationBlogFrontmatterSchema,
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
  'foundation-blog-posts': ContentTypeConfig
  ambassadors: ContentTypeConfig
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
      dir: getContentPath(projectRoot, 'summitPages'),
      apiId: 'summit-pages',
      schema: summitPageFrontmatterSchema,
      buildPayload: async (mdx, _strapi, existing) =>
        buildPagePayload(summitPageFrontmatterSchema, mdx, existing)
    },
    'foundation-blog-posts': {
      dir: getContentPath(projectRoot, 'blog'),
      apiId: 'foundation-blog-posts',
      schema: foundationBlogFrontmatterSchema,
      buildPayload: async (mdx, _strapi, _existing) =>
        buildBlogPayload(foundationBlogFrontmatterSchema, mdx)
    },
    ambassadors: {
      dir: getContentPath(projectRoot, 'ambassadors'),
      apiId: 'ambassadors',
      schema: ambassadorFrontmatterSchema,
      buildPayload: (mdx, strapi, _existing) =>
        buildAmbassadorPayload(ambassadorFrontmatterSchema, mdx, strapi)
    }
  }
}
