import { getContentPath } from '@/utils'
import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import {
  buildPagePayload,
  buildBlogPayload,
  buildAmbassadorPayload,
  buildGrantPagePayload,
  buildGrantOverviewPagePayload,
  type StrapiUploadContext
} from './mdxTransformer'
import {
  ambassadorFrontmatterSchema,
  foundationBlogFrontmatterSchema,
  foundationPageFrontmatterSchema,
  grantOverviewPageFrontmatterSchema,
  grantPageFrontmatterSchema,
  summitPageFrontmatterSchema
} from './siteSchemas'
// Side-effect imports: register component handlers
import './ambassadorHandler'
import './blockquoteHandler'
import './calloutTextHandler'
import './ctaStripHandler'
import './paragraphHandler'
import './pdfEmbedHandler'
import './videoEmbedHandler'
import './codeBlockHandler'
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
  /**
   * Builds the Strapi payload from an MDX file. Returns an Error on
   * frontmatter validation failure, missing Strapi upload, parser failure,
   * or transport failure. Callers narrow with `instanceof Error`.
   */
  buildPayload: (
    mdx: MDXFile,
    strapi: StrapiClient,
    existing: StrapiEntry | null,
    dryRun: boolean
  ) => Promise<Record<string, unknown> | Error>
}

export interface ContentTypes {
  'foundation-pages': ContentTypeConfig
  'grant-pages': ContentTypeConfig
  'grant-overview-pages': ContentTypeConfig
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
        if (id instanceof Error) throw id
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
    'grant-pages': {
      dir: getContentPath(projectRoot, 'grantPages'),
      apiId: 'grant-pages',
      schema: grantPageFrontmatterSchema,
      buildPayload: (mdx, _strapi, _existing, _dryRun) =>
        buildGrantPagePayload(grantPageFrontmatterSchema, mdx)
    },
    'grant-overview-pages': {
      dir: getContentPath(projectRoot, 'grantOverviewPages'),
      apiId: 'grant-overview-pages',
      schema: grantOverviewPageFrontmatterSchema,
      buildPayload: (mdx, _strapi, _existing, _dryRun) =>
        buildGrantOverviewPagePayload(grantOverviewPageFrontmatterSchema, mdx)
    },
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
            if (id instanceof Error) throw id
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
