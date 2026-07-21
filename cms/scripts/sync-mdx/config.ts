import { getContentPath } from '@/utils'
import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import { scanMDXFiles } from './scan'
import {
  buildPagePayload,
  buildBlogPayload,
  buildProfilePayload,
  buildGrantPagePayload,
  buildGrantOverviewPagePayload,
  buildFaqPayload,
  buildReportPayload,
  createMediaUploadResolver,
  type StrapiUploadContext
} from './mdxTransformer'
import {
  foundationBlogFrontmatterSchema,
  foundationPageFrontmatterSchema,
  grantOverviewPageFrontmatterSchema,
  grantPageFrontmatterSchema,
  summitPageFrontmatterSchema,
  profileFrontmatterSchema,
  faqFrontmatterSchema,
  reportFrontmatterSchema
} from './siteSchemas'
// Side-effect imports: register component handlers
import './profileHandler'
import './blockquoteHandler'
import './calloutTextHandler'
import './ctaStripHandler'
import './paragraphHandler'
import './pdfEmbedHandler'
import './videoEmbedHandler'
import './codeBlockHandler'
import './splitLayoutHandler'
import './carouselHandler'
import './imageBlockHandler'
import './numberTilesHandler'
import './titleCardGridHandler'
import { createRelationResolver } from './profileHandler'
import { type ParserContext } from './mdxBlockParser'

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
  profiles: ContentTypeConfig
  faqs: ContentTypeConfig
  reports: ContentTypeConfig
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
      resolveRelation: createRelationResolver(
        strapi,
        locale,
        dryRun,
        strapiUploadContext.profilePathSlugs
      ),
      resolveMediaUpload: createMediaUploadResolver(strapi, dryRun)
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
  const profileAltIds = new Map<number, string | null>()
  const blogAltIds = new Map<number, string | null>()
  const pageAltIds = new Map<number, string | null>()
  const grantPageAltIds = new Map<number, string | null>()
  const grantOverviewPageAltIds = new Map<number, string | null>()

  const contentTypes: ContentTypes = {
    profiles: {
      dir: getContentPath(projectRoot, 'profiles'),
      apiId: 'profile-pages',
      schema: profileFrontmatterSchema,
      buildPayload: (mdx, strapi, existing, dryRun) => {
        const locale = mdx.locale || 'en'
        return buildProfilePayload(
          profileFrontmatterSchema,
          mdx,
          strapi,
          existing,
          {
            locale,
            resolveRelation: createRelationResolver(
              strapi,
              locale,
              dryRun,
              profilePathSlugs
            ),
            resolveMediaUpload: createMediaUploadResolver(strapi, dryRun)
          },
          profileAltIds,
          dryRun
        )
      }
    },
    faqs: {
      dir: getContentPath(projectRoot, 'faqs'),
      apiId: 'faqs',
      schema: faqFrontmatterSchema,
      buildPayload: (mdx, _strapi, existing, _dryRun) => {
        const locale = mdx.locale || 'en'
        // No resolveRelation/resolveMediaUpload: the FAQ content zone only
        // allows blocks.paragraph, which never resolves relations or media.
        return buildFaqPayload(faqFrontmatterSchema, mdx, existing, { locale })
      }
    },
    reports: {
      dir: getContentPath(projectRoot, 'reports'),
      apiId: 'reports',
      schema: reportFrontmatterSchema,
      buildPayload: (mdx, _strapi, existing, _dryRun) => {
        const locale = mdx.locale || 'en'
        // No resolveRelation/resolveMediaUpload: the report content zone only
        // allows blocks.paragraph, which never resolves relations or media.
        return buildReportPayload(reportFrontmatterSchema, mdx, existing, {
          locale
        })
      }
    },
    'grant-pages': {
      dir: getContentPath(projectRoot, 'grantPages'),
      apiId: 'grant-pages',
      schema: grantPageFrontmatterSchema,
      buildPayload: (mdx, strapi, existing, dryRun) =>
        buildGrantPagePayload(
          grantPageFrontmatterSchema,
          mdx,
          {
            strapi,
            STRAPI_URL: strapiUrl,
            STRAPI_TOKEN: strapiToken,
            dryRun,
            profilePathSlugs
          },
          existing,
          grantPageAltIds,
          dryRun
        )
    },
    'grant-overview-pages': {
      dir: getContentPath(projectRoot, 'grantOverviewPages'),
      apiId: 'grant-overview-pages',
      schema: grantOverviewPageFrontmatterSchema,
      buildPayload: (mdx, strapi, existing, dryRun) =>
        buildGrantOverviewPagePayload(
          grantOverviewPageFrontmatterSchema,
          mdx,
          {
            strapi,
            STRAPI_URL: strapiUrl,
            STRAPI_TOKEN: strapiToken,
            dryRun,
            profilePathSlugs
          },
          existing,
          grantOverviewPageAltIds,
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
            dryRun,
            profilePathSlugs
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
            dryRun,
            profilePathSlugs
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
          dryRun,
          profilePathSlugs
        }
        const locale = mdx.locale || 'en'
        const parserCtx: ParserContext = {
          locale,
          resolveRelation: createRelationResolver(
            strapi,
            locale,
            dryRun,
            profilePathSlugs
          ),
          resolveMediaUpload: createMediaUploadResolver(strapi, dryRun)
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

  // profile-pages is the only relation target other content types reference
  // (ProfileCard/ProfileGrid — see profileHandler.ts). Snapshotting its
  // pathSlugs from source lets createRelationResolver's dry-run fallback
  // tell "would be created by this same run" apart from a genuinely broken
  // reference, since dry-run never persists anything for a live lookup to find.
  const profilePathSlugs = new Set(
    scanMDXFiles('profiles', contentTypes).map((f) => f.pathSlug)
  )

  return contentTypes
}
