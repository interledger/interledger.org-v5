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
  buildHackathonPagePayload,
  buildPodcastPagePayload,
  createMediaAltUpdater,
  createMediaUploadResolver,
  type StrapiUploadContext
} from './mdxTransformer'
import {
  foundationBlogFrontmatterSchema,
  foundationPageFrontmatterSchema,
  grantOverviewPageFrontmatterSchema,
  grantPageFrontmatterSchema,
  summitPageFrontmatterSchema,
  hackathonPageFrontmatterSchema,
  profileFrontmatterSchema,
  faqFrontmatterSchema,
  reportFrontmatterSchema,
  podcastPageFrontmatterSchema
} from './siteSchemas'
// Side-effect imports: register component handlers
import './profileHandler'
import './blockquoteHandler'
import './quoteHandler'
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
import './cardGridHandler'
import './agendaHandler'
import './faqHandler'
import './reportSectionHandler'
import './eventCardHandler'
import './ctaLinkHandler'
import './ctaButtonsHandler'
import './hackathonAnimationHandler'
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
   * True when `pathSlug` is relative to the `section` field, so an entry is
   * identified by (locale, section, pathSlug) rather than (locale, pathSlug).
   * See entryIdentity.ts. Only enable this for a content type whose Strapi
   * schema has a required, non-localized `section` attribute AND whose
   * `pathSlug` is NOT declared unique, otherwise the second section's entry
   * fails to create.
   */
  sectionScopedIdentity?: boolean
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
  'hackathon-pages': ContentTypeConfig
  'foundation-blog-posts': ContentTypeConfig
  profiles: ContentTypeConfig
  faqs: ContentTypeConfig
  reports: ContentTypeConfig
  'podcast-pages': ContentTypeConfig
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
      resolveMediaUpload: createMediaUploadResolver(strapi, dryRun),
      updateMediaAlt: createMediaAltUpdater(
        strapi,
        updatedAltIds,
        mdx.pathSlug,
        dryRun
      )
    },
    strapiUploadContext
  )
}

export function buildContentTypes(
  projectRoot: string,
  strapiUrl: string,
  strapiToken: string
): ContentTypes {
  // Alt-text maps guard against updating the same upload file's alt text
  // multiple times per sync run with potentially different values. Foundation,
  // summit and hackathon pages share one: they allow the same blocks and draw
  // on the same partner-logo uploads, so a name that differs between them is a
  // conflict worth warning about, not a silent overwrite.
  const pageAltIds = new Map<number, string | null>()
  const grantPageAltIds = new Map<number, string | null>()
  const grantOverviewPageAltIds = new Map<number, string | null>()

  const contentTypes: ContentTypes = {
    profiles: {
      dir: getContentPath(projectRoot, 'profiles'),
      apiId: 'profile-pages',
      schema: profileFrontmatterSchema,
      // Same section-relative pathSlug as faqs: a hackathon speaker and a
      // foundation fellow could both be `speakers/jane-doe` (INTORG-1132).
      sectionScopedIdentity: true,
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
          }
        )
      }
    },
    faqs: {
      dir: getContentPath(projectRoot, 'faqs'),
      apiId: 'faqs',
      schema: faqFrontmatterSchema,
      // The foundation FAQ and the hackathon FAQ both use pathSlug 'faq'
      // (INTORG-1132).
      sectionScopedIdentity: true,
      // faqSections is fully specified frontmatter — no MDX body, relation,
      // or media resolution needed.
      buildPayload: (mdx) => buildFaqPayload(faqFrontmatterSchema, mdx)
    },
    reports: {
      dir: getContentPath(projectRoot, 'reports'),
      apiId: 'reports',
      schema: reportFrontmatterSchema,
      // Same section-relative pathSlug as faqs (INTORG-1132).
      sectionScopedIdentity: true,
      buildPayload: (mdx, strapi, existing, dryRun) => {
        const locale = mdx.locale || 'en'
        // Report content blocks don't resolve relations/media, but
        // strapiUploadContext is still needed for author_bio images.
        return buildReportPayload(
          reportFrontmatterSchema,
          mdx,
          existing,
          { locale },
          {
            strapi,
            STRAPI_URL: strapiUrl,
            STRAPI_TOKEN: strapiToken,
            dryRun,
            profilePathSlugs
          }
        )
      }
    },
    'hackathon-pages': {
      dir: getContentPath(projectRoot, 'hackathonPages'),
      apiId: 'hackathon-pages',
      schema: hackathonPageFrontmatterSchema,
      buildPayload: (mdx, strapi, existing, dryRun) => {
        const locale = mdx.locale || 'en'
        return buildHackathonPagePayload(
          hackathonPageFrontmatterSchema,
          mdx,
          existing,
          {
            locale,
            resolveRelation: createRelationResolver(
              strapi,
              locale,
              dryRun,
              profilePathSlugs
            ),
            resolveMediaUpload: createMediaUploadResolver(strapi, dryRun),
            updateMediaAlt: createMediaAltUpdater(
              strapi,
              pageAltIds,
              mdx.pathSlug,
              dryRun
            )
          },
          {
            strapi,
            STRAPI_URL: strapiUrl,
            STRAPI_TOKEN: strapiToken,
            dryRun,
            profilePathSlugs
          }
        )
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
    'podcast-pages': {
      dir: getContentPath(projectRoot, 'podcastPages'),
      apiId: 'podcast-pages',
      schema: podcastPageFrontmatterSchema,
      buildPayload: (mdx, strapi, _existing, dryRun) =>
        buildPodcastPagePayload(podcastPageFrontmatterSchema, mdx, {
          strapi,
          STRAPI_URL: strapiUrl,
          STRAPI_TOKEN: strapiToken,
          dryRun
        })
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
          parserCtx
        )
      }
    }
  }

  // profile-pages is the only relation target other content types reference
  // (ProfileCard/ProfileGrid — see profileHandler.ts). Snapshot locale:pathSlug
  // keys so dry-run only treats a relation as "would be created by this same run"
  // when MDX exists for that locale (not when EN has the slug and ES does not).
  const profilePathSlugs = new Set(
    scanMDXFiles('profiles', contentTypes).map(
      (f) => `${f.locale || 'en'}:${f.pathSlug}`
    )
  )

  return contentTypes
}
