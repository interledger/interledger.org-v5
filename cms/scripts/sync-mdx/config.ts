import { getContentPath } from '@/utils'
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
import './pdfEmbedHandler'
import './videoEmbedHandler'
import { createRelationResolver } from './ambassadorHandler'
import { type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

/**
 * Minimal schema interface for frontmatter validation.
 * Structural (duck-typed) so it works with any Zod version or compatible library.
 */
export interface FrontmatterSchema {
  parse(data: unknown): unknown
  safeParse(data: unknown): {
    success: boolean
    error?: { issues: Array<{ path: PropertyKey[]; message: string }> }
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
    existing: StrapiEntry | null,
    dryRun: boolean
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
  existing: StrapiEntry | null,
  strapiUploadContext: StrapiUploadContext,
  updatedAltIds: Map<number, string | null>,
  dryRun: boolean
) {
  const locale = mdx.locale || 'en'
  return buildPagePayload(
    schema,
    mdx,
    existing,
    {
      locale,
      resolveRelation: createRelationResolver(strapi, locale),
      resolveMediaUpload: async (url: string) => {
        const id = await strapi.findUploadByUrl(url)
        if (!id) {
          throw new MdxParserError({
            code: ParserErrorCode.UNRESOLVED_RELATION,
            message: `Upload "${url}" could not be resolved to a Strapi file ID.`
          })
        }
        return id
      }
    },
    strapiUploadContext,
    updatedAltIds,
    dryRun
  )
}

export function buildContentTypes(
  projectRoot: string,
  strapiUrl: string,
  strapiToken: string
): ContentTypes {
  // One Map per content type per sync run — guards against updating the same
  // upload file's alt text multiple times with potentially different values.
  const ambassadorAltIds = new Map<number, string | null>()
  const blogAltIds = new Map<number, string | null>()
  const pageAltIds = new Map<number, string | null>()

  return {
    ambassadors: {
      dir: getContentPath(projectRoot, 'ambassadors'),
      apiId: 'ambassadors',
      schema: ambassadorFrontmatterSchema,
      buildPayload: (mdx, strapi, _existing, dryRun) =>
        buildAmbassadorPayload(
          ambassadorFrontmatterSchema,
          mdx,
          strapi,
          ambassadorAltIds,
          dryRun
        )
    },
    'foundation-pages': {
      dir: getContentPath(projectRoot, 'foundationPages'),
      apiId: 'foundation-pages',
      schema: foundationPageFrontmatterSchema,
      buildPayload: (mdx, strapi, existing, dryRun) =>
        buildParsedPagePayload(
          foundationPageFrontmatterSchema,
          mdx,
          strapi,
          existing,
          {
            strapi,
            STRAPI_URL: strapiUrl,
            STRAPI_TOKEN: strapiToken,
            dryRun
          },
          pageAltIds,
          dryRun
        )
    },
    'summit-pages': {
      dir: getContentPath(projectRoot, 'summitPages'),
      apiId: 'summit-pages',
      schema: summitPageFrontmatterSchema,
      buildPayload: (mdx, strapi, existing, dryRun) =>
        buildParsedPagePayload(
          summitPageFrontmatterSchema,
          mdx,
          strapi,
          existing,
          {
            strapi,
            STRAPI_URL: strapiUrl,
            STRAPI_TOKEN: strapiToken,
            dryRun
          },
          pageAltIds,
          dryRun
        )
    },
    'foundation-blog-posts': {
      dir: getContentPath(projectRoot, 'blog'),
      apiId: 'foundation-blog-posts',
      schema: foundationBlogFrontmatterSchema,
      buildPayload: async (mdx, strapi, _existing, dryRun) => {
        const uploadContext: StrapiUploadContext = {
          strapi,
          STRAPI_URL: strapiUrl,
          STRAPI_TOKEN: strapiToken,
          dryRun
        }
        const locale = mdx.locale || 'en'
        const parserCtx: ParserContext = {
          locale,
          resolveRelation: createRelationResolver(strapi, locale),
          resolveMediaUpload: async (url: string) => {
            const id = await strapi.findUploadByUrl(url)
            if (!id) {
              throw new MdxParserError({
                code: ParserErrorCode.UNRESOLVED_RELATION,
                message: `Upload "${url}" could not be resolved to a Strapi file ID.`
              })
            }
            return id
          }
        }
        return buildBlogPayload(
          foundationBlogFrontmatterSchema,
          mdx,
          uploadContext,
          blogAltIds,
          parserCtx,
          dryRun
        )
      }
    }
  }
}
