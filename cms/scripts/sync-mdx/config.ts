import { getContentPath } from '@/utils/paths'
import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import {
  buildPagePayload,
  buildBlogPayload,
  buildAmbassadorPayload,
  type StrapiUploadContext
} from './mdxTransformer'
import {
  ambassadorFrontmatterSchema,
  foundationBlogFrontmatterSchema,
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema
} from './siteSchemas'
// Side-effect imports: register component handlers
import './ambassadorHandler'
import './blockquoteHandler'
import './calloutTextHandler'
import './paragraphHandler'
import { createRelationResolver } from './ambassadorHandler'

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

/** Build a page payload with the MDX block parser wired in. */
function buildParsedPagePayload(
  schema: FrontmatterSchema,
  mdx: MDXFile,
  strapi: StrapiClient,
  existing: StrapiEntry | null
) {
  const locale = mdx.locale || 'en'
  return buildPagePayload(schema, mdx, existing, {
    locale,
    resolveRelation: createRelationResolver(strapi, locale)
  })
}

export function buildContentTypes(
  projectRoot: string,
  strapiUrl: string,
  strapiToken: string
): ContentTypes {
  // One Map per content type per sync run — guards against updating the same
  // upload file's alt text multiple times with potentially different values.
  const ambassadorAltIds = new Map<number, string>()
  const blogAltIds = new Map<number, string>()

  return {
    ambassadors: {
      dir: getContentPath(projectRoot, 'ambassadors'),
      apiId: 'ambassadors',
      schema: ambassadorFrontmatterSchema,
      buildPayload: (mdx, strapi, _existing) =>
        buildAmbassadorPayload(
          ambassadorFrontmatterSchema,
          mdx,
          strapi,
          ambassadorAltIds
        )
    },
    'foundation-pages': {
      dir: getContentPath(projectRoot, 'foundationPages'),
      apiId: 'foundation-pages',
      schema: foundationPageFrontmatterSchema,
      buildPayload: (mdx, strapi, existing) =>
        buildParsedPagePayload(
          foundationPageFrontmatterSchema,
          mdx,
          strapi,
          existing
        )
    },
    'summit-pages': {
      dir: getContentPath(projectRoot, 'summitPages'),
      apiId: 'summit-pages',
      schema: summitPageFrontmatterSchema,
      buildPayload: (mdx, strapi, existing) =>
        buildParsedPagePayload(
          summitPageFrontmatterSchema,
          mdx,
          strapi,
          existing
        )
    },
    'foundation-blog-posts': {
      dir: getContentPath(projectRoot, 'blog'),
      apiId: 'foundation-blog-posts',
      schema: foundationBlogFrontmatterSchema,
      buildPayload: async (mdx, strapi, _existing) => {
        const uploadContext: StrapiUploadContext = {
          strapi,
          STRAPI_URL: strapiUrl,
          STRAPI_TOKEN: strapiToken
        }
        return buildBlogPayload(
          foundationBlogFrontmatterSchema,
          mdx,
          uploadContext,
          blogAltIds
        )
      }
    }
  }
}
