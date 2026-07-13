import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import {
  scheduleGitSync,
  validateGitSyncRepoOnStartup,
  validateNoNestedJsx,
  validateReportDate,
  normalizeNavigationInput,
  validateHeroFields,
  validateGrantPagePrimaryCta,
  validateGrantPageFaqSection,
  validateGrantInfoCards,
  validateProfileCta,
  validateCtaStrip,
  validateBlogFields,
  validateNavigationLabels,
  mergeValidationErrors,
  LOCALES,
  shouldSkipMdxExport
} from './utils'
import { validateContentBlocks } from './serializers/blocks'
import { errors } from '@strapi/utils'

function copySchemas() {
  const srcDir = path.join(__dirname, '../../src')
  const destDir = path.join(__dirname)

  function copyDir(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath)
      } else if (entry.name.endsWith('.json')) {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  try {
    copyDir(srcDir, destDir)
    console.log('✅ Schema files copied successfully')
  } catch (error) {
    console.error('❌ Error copying schema files:', error)
  }
}

interface DocumentValidationContext {
  uid: string
  action: string
  params: { data?: Record<string, unknown>; [key: string]: unknown }
}

type DocumentValidationMiddleware = (
  ctx: DocumentValidationContext,
  next: () => Promise<unknown>
) => Promise<unknown>

/**
 * Registers a Strapi document-service middleware (`strapi.documents.use`) that
 * validates a content type's business rules and rejects the write with a
 * `ValidationError` before the repository resolves component/dynamic-zone
 * fields into `{ id, __pivot }` DB references — validators need the raw
 * inline shape actually submitted (e.g. `primaryCta: { text, link }`), which
 * no longer exists by the time a `beforeCreate`/`beforeUpdate` content-type
 * lifecycle hook sees `event.params.data`.
 *
 * This runs below both the content-manager admin API and the public content
 * REST API — both controllers strip their own request envelope and call into
 * `strapi.documents(uid).create/update(...)` before this middleware sees the
 * request, so `ctx.params.data` is the same plain shape regardless of which
 * surface (or a future in-process caller) wrote the document.
 */
export function registerDocumentValidation(
  strapi: {
    documents: { use: (middleware: DocumentValidationMiddleware) => void }
  },
  uid: string,
  validate: (
    body: Record<string, unknown>
  ) => errors.ValidationError | undefined
) {
  strapi.documents.use(async (ctx, next) => {
    if (
      ctx.uid === uid &&
      (ctx.action === 'create' || ctx.action === 'update')
    ) {
      const validationErr = validate(ctx.params.data ?? {})
      if (validationErr) throw validationErr
    }
    return next()
  })
}

// Strapi instance type for lifecycle functions
interface StrapiDocumentService {
  findMany: (options: Record<string, unknown>) => Promise<unknown[]>
  create: (options: { data: Record<string, unknown> }) => Promise<unknown>
}

interface StrapiLogger {
  debug: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
}

interface FieldMetadata {
  edit?: {
    label?: string
    description?: string
    [key: string]: unknown
  }
  list?: {
    label?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface EditLayoutField {
  name: string
  size: number
}

interface CmContentTypesService {
  findConfiguration: (obj: { uid: string }) => Promise<{
    metadatas?: Record<string, FieldMetadata>
    layouts?: { edit?: EditLayoutField[][] }
  } | null>
  updateConfiguration: (
    obj: { uid: string },
    config: {
      metadatas?: Record<string, FieldMetadata>
      layouts?: { edit?: EditLayoutField[][] }
    }
  ) => Promise<void>
}

interface CmComponentsService {
  findComponent: (uid: string) => { uid: string } | null
  findConfiguration: (component: { uid: string }) => Promise<{
    metadatas?: Record<string, FieldMetadata>
    layouts?: { edit?: EditLayoutField[][] }
  } | null>
  updateConfiguration: (
    component: { uid: string },
    config: {
      metadatas?: Record<string, FieldMetadata>
      layouts?: { edit?: EditLayoutField[][] }
    }
  ) => Promise<void>
}

interface UploadSettings {
  responsiveDimensions: boolean
  sizeOptimization: boolean
  autoOrientation: boolean
  aiMetadata: boolean
}

interface UploadProvider {
  upload: (file: UploadFile) => Promise<void>
  uploadStream: (file: UploadFile) => Promise<void>
  delete: (file: UploadFile) => Promise<void>
  checkFileSize: (file: UploadFile, options?: unknown) => void
}

interface UploadFile {
  hash: string
  ext: string
  url?: string
  buffer?: Buffer
  stream?: NodeJS.ReadableStream
  getStream?: () => NodeJS.ReadableStream
  [key: string]: unknown
}

interface UploadService {
  getSettings: () => Promise<UploadSettings>
  setSettings: (value: UploadSettings) => Promise<void>
}

interface ImageManipulationService {
  generateThumbnail: (file: unknown) => Promise<unknown>
  generateResponsiveFormats: (file: unknown) => Promise<unknown[]>
  [key: string]: unknown
}

interface StrapiPlugin {
  service: (
    name: string
  ) =>
    | CmContentTypesService
    | CmComponentsService
    | UploadService
    | ImageManipulationService
    | undefined
  provider?: UploadProvider
}

interface UploadFileRecord {
  id: number
  name: string
  hash: string
  ext: string
  mime: string
  size: number
  url: string
  provider: string
  width?: number | null
  height?: number | null
  formats?: Record<string, unknown> | null
  folderPath?: string
}

interface DbQueryApi {
  findOne: (params: {
    where: Record<string, unknown>
    select?: string[]
  }) => Promise<UploadFileRecord | null>
  create: (params: {
    data: Omit<UploadFileRecord, 'id'>
  }) => Promise<UploadFileRecord>
  count: (params: { where: Record<string, unknown> }) => Promise<number>
}
interface StrapiInstance {
  documents: ((uid: string) => StrapiDocumentService) & {
    use: (middleware: DocumentValidationMiddleware) => void
  }
  log: StrapiLogger
  dirs: { static: { public: string } }
  db?: {
    lifecycles?: {
      subscribe: (subscription: {
        models: string[]
        afterCreate?: (event: { result?: Record<string, unknown> }) => void
        afterUpdate?: (event: { result?: Record<string, unknown> }) => void
        afterDelete?: (event: { result?: Record<string, unknown> }) => void
      }) => void
    }
    query: (uid: string) => DbQueryApi
  }
  config: { get: (key: string, defaultValue?: unknown) => unknown }
  plugin: (name: string) => StrapiPlugin | undefined
}

function registerUploadGitSyncLifecycle(strapi: StrapiInstance): void {
  strapi.db?.lifecycles?.subscribe({
    models: ['plugin::upload.file'],
    afterCreate(event) {
      if (shouldSkipMdxExport()) return

      const mime = event.result?.mime
      if (typeof mime === 'string' && !mime.startsWith('image/')) return

      console.log('🖼️  Upload created, scheduling git sync')
      scheduleGitSync('upload')
    },
    afterUpdate(event) {
      if (shouldSkipMdxExport()) return

      const mime = event.result?.mime
      if (typeof mime === 'string' && !mime.startsWith('image/')) return

      console.log('🖼️  Upload updated, scheduling git sync')
      scheduleGitSync('upload')
    },
    afterDelete(event) {
      if (shouldSkipMdxExport()) return

      const mime = event.result?.mime
      if (typeof mime === 'string' && !mime.startsWith('image/')) return

      console.log('🗑️  Upload deleted, scheduling git sync')
      scheduleGitSync('upload')
    }
  })
}

/**
 * Ensures required locales (en, es) are installed in Strapi i18n plugin.
 * Creates locales if they don't exist.
 */
async function ensureLocales(strapi: StrapiInstance) {
  const localeConfigs: Record<string, string> = {
    en: 'English (en)',
    es: 'Spanish (es)'
  }

  for (const localeCode of LOCALES) {
    try {
      // Check if locale already exists
      const existingLocales = await strapi
        .documents('plugin::i18n.locale')
        .findMany({
          filters: { code: localeCode },
          limit: 1
        })

      if (existingLocales && existingLocales.length > 0) {
        strapi.log.debug(`✅ Locale ${localeCode} already exists`)
        continue
      }

      // Create locale if it doesn't exist
      const displayName =
        localeConfigs[localeCode] ||
        `${localeCode.toUpperCase()} (${localeCode})`
      await strapi.documents('plugin::i18n.locale').create({
        data: {
          code: localeCode,
          name: displayName
        }
      })
      strapi.log.info(`✅ Created locale: ${displayName}`)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      // Handle cases where locale might already exist (race condition, etc.)
      if (
        errorMessage?.includes('already exists') ||
        errorMessage?.includes('duplicate') ||
        errorMessage?.includes('unique')
      ) {
        strapi.log.debug(
          `Locale ${localeCode} already exists (checked via error)`
        )
      } else {
        strapi.log.warn(
          `⚠️  Could not create locale ${localeCode}: ${errorMessage}`
        )
      }
    }
  }
}

// ── Upload overrides ──────────────────────────────────────────────────────────
const UPLOAD_SUBDIR = 'img/original'
const UPLOAD_URL_PREFIX = `/uploads/${UPLOAD_SUBDIR}`

/**
 * Redirect the local upload provider so files land in
 * `public/uploads/img/original/` and URLs reflect the new path.
 */
function overrideUploadProvider(strapi: StrapiInstance): void {
  const uploadPlugin = strapi.plugin('upload')
  if (!uploadPlugin?.provider) {
    strapi.log.warn('⚠️  Upload plugin provider not found — skipping override')
    return
  }

  const publicDir = strapi.dirs.static.public
  const uploadPath = path.join(publicDir, 'uploads', UPLOAD_SUBDIR)
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true })
  }

  const provider = uploadPlugin.provider

  provider.uploadStream = async (file: UploadFile) => {
    const stream = file.stream ?? file.getStream?.()
    if (!stream) throw new Error('Missing file stream')
    const dest = path.join(uploadPath, `${file.hash}${file.ext}`)
    await pipeline(stream, fs.createWriteStream(dest))
    file.url = `${UPLOAD_URL_PREFIX}/${file.hash}${file.ext}`
  }

  provider.upload = async (file: UploadFile) => {
    if (!file.buffer) throw new Error('Missing file buffer')
    const dest = path.join(uploadPath, `${file.hash}${file.ext}`)
    fs.writeFileSync(dest, file.buffer)
    file.url = `${UPLOAD_URL_PREFIX}/${file.hash}${file.ext}`
  }

  provider.delete = async (file: UploadFile) => {
    const candidates = [
      path.join(uploadPath, `${file.hash}${file.ext}`),
      ...(file.url ? [path.join(publicDir, file.url)] : [])
    ]
    for (const dest of candidates) {
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest)
        return
      }
    }
  }

  strapi.log.info(`✅ Upload provider redirected to ${uploadPath}`)
}

/**
 * Disable all image variant generation (thumbnails, responsive formats,
 * size optimization). Only the original file is kept.
 */
async function disableImageVariants(strapi: StrapiInstance): Promise<void> {
  const uploadPlugin = strapi.plugin('upload')
  if (!uploadPlugin) return

  const uploadService = uploadPlugin.service('upload') as
    | UploadService
    | undefined
  if (uploadService) {
    await uploadService.setSettings({
      responsiveDimensions: false,
      sizeOptimization: false,
      autoOrientation: false,
      aiMetadata: false
    })
    strapi.log.info('✅ Upload settings: variants disabled')
  }

  const imgService = uploadPlugin.service('image-manipulation') as
    | ImageManipulationService
    | undefined
  if (imgService) {
    imgService.generateThumbnail = async () => null
    imgService.generateResponsiveFormats = async () => []
    strapi.log.info(
      '✅ Image manipulation: thumbnail & responsive formats disabled'
    )
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.tiff': 'image/tiff'
}

const SEEDABLE_EXTENSIONS = new Set(Object.keys(MIME_BY_EXT))

/**
 * Directories under `public/` to scan for seedable images.
 * Each entry maps a disk path (relative to public/) to the URL prefix it's
 * served at. Files found on disk but missing from Strapi's `upload_file`
 * table are inserted so MDX references remain valid after a fresh database.
 */
const SEED_DIRS: ReadonlyArray<{ dir: string; urlPrefix: string }> = [
  { dir: `uploads/${UPLOAD_SUBDIR}`, urlPrefix: `/uploads/${UPLOAD_SUBDIR}` },
  { dir: 'img', urlPrefix: '/img' }
]
const EXCLUDED_SEED_SUBDIRS = new Set(['optimized'])

async function seedUploadsFromDisk(strapi: StrapiInstance): Promise<void> {
  const query = strapi.db?.query('plugin::upload.file')
  if (!query) {
    strapi.log.warn('⚠️  DB query API unavailable — skipping upload seeding')
    return
  }

  const publicDir = strapi.dirs.static.public
  let seeded = 0

  for (const { dir, urlPrefix } of SEED_DIRS) {
    const absDir = path.join(publicDir, dir)
    if (!fs.existsSync(absDir)) continue

    const files = collectImagePaths(absDir)

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase()
      const basename = path.basename(filePath, ext)
      const relativePath = path.relative(absDir, filePath)
      const url = `${urlPrefix}/${relativePath.replace(/\\/g, '/')}`

      const existing = await query.findOne({
        where: { url },
        select: ['id']
      })
      if (existing) continue

      const stat = fs.statSync(filePath)
      const sizeKB = Number((stat.size / 1024).toFixed(2))
      const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'

      await query.create({
        data: {
          name: path.basename(filePath),
          hash: basename,
          ext,
          mime,
          size: sizeKB,
          url,
          provider: 'local',
          width: null,
          height: null,
          formats: null,
          folderPath: '/'
        }
      })
      seeded++
    }
  }

  if (seeded > 0) {
    strapi.log.info(`✅ Seeded ${seeded} upload record(s) from disk`)
  }
}

function collectImagePaths(dir: string): string[] {
  const results: string[] = []

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (EXCLUDED_SEED_SUBDIRS.has(entry.name)) continue
        walk(full)
      } else if (
        SEEDABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        results.push(full)
      }
    }
  }

  walk(dir)
  return results
}

/**
 * Configure pretty labels for field names in the admin panel.
 * This updates the content-manager metadata stored in the database.
 *
 * Content types use service('content-types'); components use service('components').
 * Both services store configuration under different key prefixes, so the correct
 * service must be used for each.
 */
async function configureFieldLabels(strapi: StrapiInstance) {
  const contentTypeLabels: Record<string, Record<string, string>> = {
    'api::profile-page.profile-page': {
      name: 'Name',
      pathSlug: 'URL Slug',
      section: 'Section',
      photo: 'Photo',
      tagline: 'Tag line',
      description: 'Description',
      role: 'Role',
      category: 'Category',
      content: 'Biography'
    },
    'api::foundation-blog-post.foundation-blog-post': {
      title: 'Title',
      description: 'Short Description',
      pathSlug: 'Full Path Slug',
      date: 'Publish Date',
      lastUpdated: 'Last Updated',
      featured: 'Featured',
      featureImage: 'Feature Image (Desktop)',
      featureImageMobile: 'Feature Image (Mobile)',
      thumbnailImage: 'Article Thumbnail',
      content: 'Content',
      articleBio: 'Author',
      categories: 'Categories',
      relatedArticles: 'Other Relevant Articles',
      language: 'Language'
    },
    'api::foundation-page.foundation-page': {
      title: 'Page Title',
      pathSlug: 'Full Path Slug',
      pillar: 'Brand Pillar',
      seo: 'SEO',
      hero: 'Hero',
      content: 'Page Content'
    },
    'api::summit-page.summit-page': {
      title: 'Title',
      pathSlug: 'Full Path Slug',
      seo: 'SEO',
      hero: 'Hero',
      content: 'Content'
    },
    'api::foundation-navigation.foundation-navigation': {
      mainMenu: 'Main Menu',
      ctaButton: 'CTA Button'
    },
    'api::summit-navigation.summit-navigation': {
      mainMenu: 'Main Menu',
      ctaButton: 'CTA Button'
    },
    'api::grant-page.grant-page': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      description: 'Short Description',
      programOverview: 'Program Overview',
      primaryCta: 'Primary Call to Action',
      content: 'Content',
      ctaStrip: 'CTA Strip',
      infoCards: 'Information Cards',
      faqSection: 'FAQ Section'
    },
    'api::grant-overview-page.grant-overview-page': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      description: 'Short Description',
      ctaStrip: 'CTA Strip',
      followUpContent: 'Follow-up Content'
    },
    'api::report.report': {
      title: 'Page Title',
      pathSlug: 'URL Slug',
      section: 'Section',
      heading: 'Heading',
      description: 'Short Description',
      introParagraph: 'Intro Paragraph',
      date: 'Date',
      content: 'Content'
    }
  }

  const contentTypeDescriptions: Record<string, Record<string, string>> = {
    'api::profile-page.profile-page': {
      photo:
        'Click the edit (pencil) icon on the selected image to set Alternative text. Leave it empty for decorative images (renders alt="").',
      role: "Job title or role shown under the profile name on the detail page (e.g. 'Open Web Advocate & Open Source Contributor').",
      section:
        'Site section for routing and breadcrumbs. Use foundation for profiles at the site root or under a full pathSlug (e.g. grant/fellowship/jane-doe); summit or hackathon when the profile lives under that microsite prefix.',
      description:
        'Short intro blurb shown on the profile detail page, above the CTA and biography sections.'
    },
    'api::foundation-page.foundation-page': {
      pathSlug:
        'Path relative to the site root (/). Examples: about-us → /about-us; grant/grant-for-web → /grant/grant-for-web. No leading slash.'
    },
    'api::summit-page.summit-page': {
      pathSlug:
        'Path relative to /summit/. Examples: faq → /summit/faq; schedule → /summit/schedule. Do not include /summit/ or a leading slash.'
    },
    'api::grant-page.grant-page': {
      pathSlug:
        'Path relative to /grant/. Examples: education/on-campus → /grant/education/on-campus; overview → /grant/overview. No leading slash.',
      description:
        'Short description used for SEO and card text. Aim for 120–160 characters.'
    },
    'api::grant-overview-page.grant-overview-page': {
      pathSlug:
        'Path relative to /grant/. Example: education → /grant/education. No leading slash. Must not clash with any Grant Page slug.',
      description:
        'Short description used for SEO and card text. Aim for 120–160 characters.'
    },
    'api::foundation-blog-post.foundation-blog-post': {
      pathSlug:
        'Path relative to /blog/. Example: my-article-title → /blog/my-article-title. Do not include /blog/ or a leading slash.',
      description: 'Aim for 120–160 characters.',
      lastUpdated:
        'Only fill in this field when the post has had a meaningful editorial update (revised text, new sections, or corrected facts).',
      featured:
        'Check to pin this post as a featured article. Up to three featured posts appear in the section at the top of the blog listing page.',
      featureImage:
        'Desktop feature image (required). Dimensions: 720 x 428. Click the edit (pencil) icon on the selected image to set Alternative text.',
      featureImageMobile:
        'Optional mobile feature image. Dimensions: 358 x 240. Falls back to the desktop image when empty.',
      thumbnailImage:
        'Optional listing thumbnail. Dimensions: 260 x 160. Click the edit (pencil) icon on the selected image to set Alternative text.',
      relatedArticles:
        'Add exactly 3 slugs of related blog posts to display in the "You may also like" section. Enter the slug only (e.g. my-related-post), not the full URL.'
    },
    'api::report.report': {
      pathSlug:
        'Full path from the site root, no leading slash. Example: policy-and-advocacy/role-stablecoins-facilitating-low-value-low-cost-transactions.',
      section:
        'Site section for routing and breadcrumbs. Use foundation for reports at the site root or under a full pathSlug; summit or hackathon when the report lives under that microsite prefix.',
      description:
        'Short description used for SEO and card text. Aim for 120–160 characters.',
      heading:
        'The heading shown at the top of the report page. Can differ from the Page Title.',
      introParagraph:
        'Optional intro paragraph shown below the heading and dates.',
      date: 'Optional. Add this component to show a Publish Date (required once added) and an optional Last Updated date.'
    }
  }

  const componentLabels: Record<string, Record<string, string>> = {
    'navigation.menu-group': {
      label: 'Group Label',
      href: 'Link URL',
      items: 'Menu Items'
    },
    'navigation.menu-item': {
      label: 'Label',
      href: 'Link URL',
      openInNewTab: 'Open in New Tab'
    },
    'shared.article-bio': {
      author: 'Name',
      link: 'Link',
      profileBio: 'Short Author Bio',
      profileImage: 'Photo'
    },
    'shared.hero': {
      title: 'Hero Title',
      description: 'Hero Description',
      backgroundImage: 'Background Image',
      hero_call_to_action: 'Call-to-action Buttons'
    },
    'shared.seo': {
      metaDescription: 'Meta Description'
    },
    'blocks.profile': {
      profile: 'Profile'
    },
    'blocks.profile-grid': {
      heading: 'Heading',
      category: 'Category',
      profiles: 'Profiles'
    },
    'blocks.blockquote': {
      quote: 'Quote',
      source: 'Source'
    },
    'blocks.callout-text': {
      content: 'Content'
    },
    'shared.cta-link': {
      link: 'Link',
      text: 'Button Text',
      style: 'Style',
      external: 'External Link'
    },
    'shared.report-date': {
      publishDate: 'Publish Date',
      lastUpdated: 'Last Updated'
    },
    'blocks.paragraph': {
      content: 'Content',
      alignment: 'Alignment'
    },
    'blocks.grant-faq-section': {
      title: 'Section Title',
      subtitle: 'Subtitle',
      description: 'Description',
      ctaText: 'Button Text',
      ctaLink: 'Button Link',
      items: 'FAQ Items'
    },
    'blocks.grant-faq-item': {
      question: 'Question',
      answer: 'Answer'
    },
    'blocks.cards-grid': {
      heading: 'Section Heading',
      subheading: 'Section Description',
      cards: 'Cards',
      columns: 'Number of Columns'
    },
    'blocks.card': {
      title: 'Card Title',
      description: 'Card Description',
      link: 'Link URL',
      linkText: 'Link Text',
      icon: 'Icon',
      openInNewTab: 'Open in New Tab'
    },
    'blocks.card-links-grid': {
      heading: 'Section Heading',
      subheading: 'Section Description',
      cards: 'Cards',
      columns: 'Number of Columns'
    },
    'blocks.card-link': {
      title: 'Card Title',
      description: 'Card Description',
      href: 'Link URL',
      openInNewTab: 'Open in New Tab'
    },
    'blocks.info-cards': {
      heading: 'Section Heading',
      card1: 'Card 1',
      card2: 'Card 2',
      card3: 'Card 3'
    },
    'blocks.info-card': {
      heading: 'Card Heading',
      body: 'Card Body'
    },
    'blocks.carousel': {
      heading: 'Section Heading',
      logos: 'Logos',
      accessibilityLabel: 'Accessible label (screen readers only)'
    },
    'blocks.cta-banner': {
      heading: 'Heading',
      text: 'Body Text',
      primaryButtonText: 'Primary Button Text',
      primaryButtonLink: 'Primary Button URL',
      secondaryButtonText: 'Secondary Button Text',
      secondaryButtonLink: 'Secondary Button URL',
      backgroundColor: 'Background Color'
    },
    'blocks.cta-strip': {
      heading: 'Heading',
      description: 'Description',
      primaryButtonText: 'Primary Button Text',
      primaryButtonLink: 'Primary Button URL',
      secondaryButtonText: 'Secondary Button Text',
      secondaryButtonLink: 'Secondary Button URL',
      color: 'Strip Color'
    },
    'blocks.image-row': {
      heading: 'Heading',
      content: 'Content',
      image: 'Image',
      imagePosition: 'Image Position',
      attribution: 'Image Attribution'
    },
    'blocks.image-block': {
      image: 'Image',
      tabletImage: 'Tablet image variant (optional)',
      mobileImage: 'Mobile image variant (optional)',
      altText: 'Image alt text',
      needsFullView: 'Needs full view',
      needsOutline: 'Needs outline'
    },
    'blocks.code-block': {
      code: 'Code',
      language: 'Language',
      title: 'Title (optional)'
    },
    'blocks.split-layout': {
      layoutType: 'Layout',
      imagePosition: 'Image position',
      image: 'Image',
      imageAlt: 'Image alt text',
      videoUrl: 'Video URL',
      content: 'Content',
      quote: 'Quote',
      quoteSource: 'Quote Attribution',
      cta: 'Call-to-action Button'
    },
    'shared.category': {
      categoryValue: 'Category'
    },
    'shared.related-article': {
      slug: 'Related Post Slug'
    }
  }

  const componentDescriptions: Record<string, Record<string, string>> = {
    'shared.category': {
      categoryValue:
        'You can select multiple categories — click "+ Add an entry" for each category'
    },
    'shared.report-date': {
      lastUpdated:
        'Only fill in when the report has had a meaningful editorial update (revised text, new sections, or corrected facts).'
    },
    'shared.article-bio': {
      link: 'A URL to a personal website, LinkedIn profile, or similar.',
      profileImage:
        'Upload a square image with the subject’s face centred. The image will be cropped to a circle on the page, so keep the face clear of the edges.',
      profileBio: 'We recommend a max of 255 characters'
    },
    'blocks.profile-grid': {
      category: 'Option A: show profiles by category (leave profiles empty)',
      profiles: 'Option B: pick profiles manually (leave category empty)'
    },
    'blocks.image-block': {
      tabletImage:
        'Use if your image needs different proportions or cropping on medium-sized screens.',
      mobileImage:
        'Use if your image needs different proportions or cropping on small screens.',
      altText:
        'Describe the image if it conveys information. Leave blank if the image is purely decorative.',
      needsFullView:
        'Enable for complex images, diagrams, or anything where fine detail matters.',
      needsOutline:
        'Enable if the image has a white or light background and needs a boundary to separate it from blending into the page.'
    },
    'blocks.info-cards': {
      heading:
        'Optional. When filled in, renders as three information cards before the CTA strip. Heading is optional; all three cards require both a heading and body.'
    },
    'blocks.code-block': {
      title:
        'Displayed as the filename label above the code. Leave blank to show the language name.',
      code: 'Paste or type your code here.'
    },
    'blocks.split-layout': {
      layoutType:
        'Choose Image + Text, Image + Quote, Video + Text, or Video + Quote.',
      imagePosition: 'Controls which side the image appears on.',
      imageAlt:
        'Describe the image if it conveys information. Leave blank if the image is purely decorative.',
      videoUrl:
        'YouTube or Vimeo URL. When set, takes precedence over the image.',
      quote:
        'Quote text. When set, renders as a blockquote instead of the Content field.',
      quoteSource: 'Attribution shown below the quote (e.g. "Jane Doe, CEO").',
      content:
        'Rich text for the content column. Leave empty when using a Quote.'
    },
    'blocks.carousel': {
      accessibilityLabel:
        'Describes this group of logos for screen reader users. Not visible on the page.',
      logos:
        'Dimensions: 240×80. Click the edit (pencil) icon on the selected image to set Alternative text.'
    }
  }

  async function applyLabels(
    service: CmContentTypesService | CmComponentsService,
    uid: string,
    labels: Record<string, string>,
    descriptions?: Record<string, string>
  ) {
    const configuration = await service.findConfiguration({ uid })
    if (!configuration?.metadatas) return

    let needsUpdate = false
    const updatedMetadatas = JSON.parse(
      JSON.stringify(configuration.metadatas)
    ) as Record<string, FieldMetadata>

    for (const [fieldName, label] of Object.entries(labels)) {
      const meta = updatedMetadatas[fieldName]
      if (!meta) continue
      const currentLabel = meta.edit?.label
      const description = descriptions?.[fieldName]
      const currentDescription = meta.edit?.description
      const labelChanged = currentLabel !== label
      const descriptionChanged =
        description !== undefined && currentDescription !== description
      if (labelChanged || descriptionChanged) {
        updatedMetadatas[fieldName] = {
          ...meta,
          edit: {
            ...meta.edit,
            ...(labelChanged && { label }),
            ...(descriptionChanged && { description })
          },
          ...(labelChanged && { list: { ...meta.list, label } })
        }
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      await service.updateConfiguration(
        { uid },
        { metadatas: updatedMetadatas }
      )
      strapi.log.info(`✅ Updated field labels for ${uid}`)
    }
  }

  const plugin = strapi.plugin('content-manager')
  if (!plugin) return

  const contentTypeService = plugin.service('content-types') as
    | CmContentTypesService
    | undefined
  const componentService = plugin.service('components') as
    | CmComponentsService
    | undefined

  if (!contentTypeService || !componentService) return

  for (const [uid, labels] of Object.entries(contentTypeLabels)) {
    try {
      await applyLabels(
        contentTypeService,
        uid,
        labels,
        contentTypeDescriptions[uid]
      )
    } catch (error) {
      strapi.log.debug(
        `Could not update labels for ${uid}: ${(error as Error).message}`
      )
    }
  }

  for (const [uid, labels] of Object.entries(componentLabels)) {
    try {
      const component = componentService.findComponent(uid)
      if (!component) {
        strapi.log.debug(`Component ${uid} not found, skipping labels`)
        continue
      }
      await applyLabels(
        componentService,
        uid,
        labels,
        componentDescriptions[uid]
      )
    } catch (error) {
      strapi.log.debug(
        `Could not update labels for ${uid}: ${(error as Error).message}`
      )
    }
  }
}

/**
 * Configure edit view layouts for content types and components where the
 * default auto-layout isn't ideal. Rows are arrays of { name, size } with
 * max row size 12 (12 = full width, 6 = half, 3 = quarter, etc.).
 */
async function configureLayouts(strapi: StrapiInstance) {
  const plugin = strapi.plugin('content-manager')
  if (!plugin) return

  const contentTypeLayouts: Record<string, EditLayoutField[][]> = {
    'api::foundation-blog-post.foundation-blog-post': [
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [
        { name: 'date', size: 4 },
        { name: 'lastUpdated', size: 4 },
        { name: 'language', size: 4 }
      ],
      [
        { name: 'featured', size: 6 },
        { name: 'categories', size: 6 }
      ],
      [
        { name: 'featureImage', size: 6 },
        { name: 'featureImageMobile', size: 6 }
      ],
      [{ name: 'thumbnailImage', size: 6 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'content', size: 12 }],
      [{ name: 'articleBio', size: 12 }],
      [{ name: 'relatedArticles', size: 12 }]
    ],
    'api::profile-page.profile-page': [
      [
        { name: 'name', size: 6 },
        { name: 'section', size: 6 }
      ],
      [{ name: 'pathSlug', size: 12 }],
      [
        { name: 'category', size: 6 },
        { name: 'photo', size: 6 }
      ],
      [{ name: 'role', size: 12 }],
      [{ name: 'tagline', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'content', size: 12 }],
      [{ name: 'cta', size: 12 }]
    ],
    'api::report.report': [
      [
        { name: 'title', size: 6 },
        { name: 'section', size: 6 }
      ],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'heading', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'date', size: 12 }],
      [{ name: 'introParagraph', size: 12 }],
      [{ name: 'content', size: 12 }]
    ],
    'api::foundation-page.foundation-page': [
      [
        { name: 'title', size: 6 },
        { name: 'pillar', size: 6 }
      ],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'seo', size: 12 }],
      [{ name: 'hero', size: 12 }],
      [{ name: 'content', size: 12 }]
    ],
    'api::summit-page.summit-page': [
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'seo', size: 12 }],
      [{ name: 'hero', size: 12 }],
      [{ name: 'content', size: 12 }]
    ],
    'api::grant-page.grant-page': [
      [
        { name: 'title', size: 6 },
        { name: 'pathSlug', size: 6 }
      ],
      [{ name: 'description', size: 6 }],
      [{ name: 'primaryCta', size: 12 }],
      [{ name: 'programOverview', size: 12 }],
      [{ name: 'infoCards', size: 12 }],
      [{ name: 'content', size: 12 }],
      [{ name: 'faqSection', size: 12 }],
      [{ name: 'ctaStrip', size: 12 }]
    ],
    'api::grant-overview-page.grant-overview-page': [
      [
        { name: 'title', size: 6 },
        { name: 'pathSlug', size: 6 }
      ],
      [{ name: 'description', size: 6 }],
      [{ name: 'ctaStrip', size: 12 }],
      [{ name: 'followUpContent', size: 12 }]
    ]
  }

  const componentLayouts: Record<string, EditLayoutField[][]> = {
    'navigation.menu-item': [
      [
        { name: 'label', size: 4 },
        { name: 'href', size: 4 },
        { name: 'openInNewTab', size: 4 }
      ]
    ],
    'shared.article-bio': [
      [
        { name: 'author', size: 6 },
        { name: 'link', size: 6 }
      ],
      [
        { name: 'profileImage', size: 6 },
        { name: 'profileBio', size: 6 }
      ]
    ],
    'blocks.profile-grid': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'category', size: 12 }],
      [{ name: 'profiles', size: 12 }]
    ],
    'blocks.cards-grid': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'subheading', size: 12 }],
      [{ name: 'cards', size: 12 }],
      [{ name: 'columns', size: 4 }]
    ],
    'blocks.card-links-grid': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'subheading', size: 12 }],
      [{ name: 'cards', size: 12 }],
      [{ name: 'columns', size: 4 }]
    ],
    'blocks.carousel': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'accessibilityLabel', size: 12 }],
      [{ name: 'logos', size: 12 }]
    ],
    'blocks.image-row': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'image', size: 12 }],
      [
        { name: 'attribution', size: 6 },
        { name: 'imagePosition', size: 6 }
      ],
      [{ name: 'content', size: 12 }]
    ],
    'blocks.image-block': [
      [
        { name: 'image', size: 4 },
        { name: 'tabletImage', size: 4 },
        { name: 'mobileImage', size: 4 }
      ],
      [
        { name: 'altText', size: 4 },
        { name: 'needsFullView', size: 4 },
        { name: 'needsOutline', size: 4 }
      ]
    ],
    'blocks.blockquote': [
      [{ name: 'quote', size: 12 }],
      [{ name: 'source', size: 12 }]
    ],
    'blocks.cta-banner': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'text', size: 12 }],
      [
        { name: 'primaryButtonText', size: 6 },
        { name: 'primaryButtonLink', size: 6 }
      ],
      [
        { name: 'secondaryButtonText', size: 6 },
        { name: 'secondaryButtonLink', size: 6 }
      ],
      [{ name: 'backgroundColor', size: 4 }]
    ],
    'blocks.cta-strip': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'description', size: 12 }],
      [
        { name: 'primaryButtonText', size: 6 },
        { name: 'primaryButtonLink', size: 6 }
      ],
      [
        { name: 'secondaryButtonText', size: 6 },
        { name: 'secondaryButtonLink', size: 6 }
      ],
      [{ name: 'color', size: 4 }]
    ],
    'shared.hero': [
      [{ name: 'title', size: 12 }],
      [
        { name: 'description', size: 6 },
        { name: 'backgroundImage', size: 6 }
      ],
      [{ name: 'hero_call_to_action', size: 12 }]
    ],
    'shared.seo': [[{ name: 'metaDescription', size: 12 }]],
    'blocks.table-block': [[{ name: 'content', size: 12 }]],
    'blocks.code-block': [
      [
        { name: 'language', size: 4 },
        { name: 'title', size: 8 }
      ],
      [{ name: 'code', size: 12 }]
    ],
    'blocks.split-layout': [
      [{ name: 'layoutType', size: 12 }],
      [
        { name: 'imagePosition', size: 4 },
        { name: 'image', size: 8 },
        { name: 'videoUrl', size: 8 }
      ],
      [{ name: 'imageAlt', size: 12 }],
      [{ name: 'content', size: 12 }],
      [
        { name: 'quote', size: 8 },
        { name: 'quoteSource', size: 4 }
      ],
      [{ name: 'cta', size: 12 }]
    ]
  }

  const contentTypeService = plugin.service('content-types') as
    | CmContentTypesService
    | undefined
  const componentService = plugin.service('components') as
    | CmComponentsService
    | undefined

  for (const [uid, editLayout] of Object.entries(contentTypeLayouts)) {
    try {
      // Preserve existing layouts (e.g. list) — only replace the edit layout.
      // setModelConfiguration replaces the entire `layouts` key, so we must
      // read the current value and spread it to avoid wiping out `list`.
      const current = await contentTypeService?.findConfiguration({ uid })
      await contentTypeService?.updateConfiguration(
        { uid },
        { layouts: { ...current?.layouts, edit: editLayout } }
      )
      strapi.log.info(`✅ Updated layout for ${uid}`)
    } catch (error) {
      strapi.log.debug(
        `Could not update layout for ${uid}: ${(error as Error).message}`
      )
    }
  }

  for (const [uid, editLayout] of Object.entries(componentLayouts)) {
    try {
      const current = await componentService?.findConfiguration({ uid })
      await componentService?.updateConfiguration(
        { uid },
        { layouts: { ...current?.layouts, edit: editLayout } }
      )
      strapi.log.info(`✅ Updated layout for ${uid}`)
    } catch (error) {
      strapi.log.debug(
        `Could not update layout for ${uid}: ${(error as Error).message}`
      )
    }
  }
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi } */) {
    // Copy schema JSON files after TypeScript compilation
    copySchemas()
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: StrapiInstance }) {
    // Validate paragraph content on save — reject nested JSX before it reaches
    // the DB. Registered as a document-service middleware (see
    // registerDocumentValidation below for why) so it covers every content
    // type's `content` dynamic zone, regardless of which API wrote it.
    strapi.documents.use(async (ctx, next) => {
      if (ctx.action === 'create' || ctx.action === 'update') {
        const validationErr = validateNoNestedJsx(ctx.params.data?.content)
        if (validationErr) throw validationErr
      }
      return next()
    })

    // Required-field validation for optional components/dynamic zones — must run
    // on the raw document data, not in beforeCreate/beforeUpdate lifecycle
    // hooks: by the time those fire, Strapi has already resolved component
    // fields into `{ id, __pivot }` DB references, so a validator reading
    // `event.params.data.primaryCta.text` would always see `undefined`.
    registerDocumentValidation(strapi, 'api::grant-page.grant-page', (body) =>
      mergeValidationErrors(
        validateGrantPagePrimaryCta(body),
        validateGrantPageFaqSection(body),
        validateCtaStrip(body),
        validateGrantInfoCards(body),
        validateContentBlocks(
          Array.isArray(body.content) ? body.content : undefined
        )
      )
    )
    registerDocumentValidation(
      strapi,
      'api::grant-overview-page.grant-overview-page',
      (body) =>
        mergeValidationErrors(
          validateCtaStrip(body),
          validateContentBlocks(
            Array.isArray(body.content) ? body.content : undefined
          )
        )
    )
    registerDocumentValidation(
      strapi,
      'api::profile-page.profile-page',
      (body) =>
        mergeValidationErrors(
          validateProfileCta(body),
          validateContentBlocks(
            Array.isArray(body.content) ? body.content : undefined
          )
        )
    )
    registerDocumentValidation(
      strapi,
      'api::foundation-page.foundation-page',
      (body) =>
        mergeValidationErrors(
          validateHeroFields(body as Parameters<typeof validateHeroFields>[0]),
          validateContentBlocks(
            Array.isArray(body.content) ? body.content : undefined
          )
        )
    )
    registerDocumentValidation(strapi, 'api::summit-page.summit-page', (body) =>
      mergeValidationErrors(
        validateHeroFields(body as Parameters<typeof validateHeroFields>[0]),
        validateContentBlocks(
          Array.isArray(body.content) ? body.content : undefined
        )
      )
    )
    registerDocumentValidation(
      strapi,
      'api::foundation-blog-post.foundation-blog-post',
      (body) =>
        mergeValidationErrors(
          validateBlogFields(body as Parameters<typeof validateBlogFields>[0]),
          validateContentBlocks(
            Array.isArray(body.content) ? body.content : undefined
          )
        )
    )

    // Normalize nav href fields (force leading slash), then validate required
    // menu/CTA labels, before saving to DB
    const NAV_UIDS = new Set([
      'api::foundation-navigation.foundation-navigation',
      'api::summit-navigation.summit-navigation'
    ])
    const REPORT_UID = 'api::report.report'
    strapi.documents.use(async (ctx, next) => {
      if (ctx.action === 'create' || ctx.action === 'update') {
        if (NAV_UIDS.has(ctx.uid) && ctx.params.data) {
          normalizeNavigationInput(
            ctx.params.data as Parameters<typeof normalizeNavigationInput>[0]
          )
          const validationErr = validateNavigationLabels(
            ctx.params.data as Parameters<typeof validateNavigationLabels>[0]
          )
          if (validationErr) throw validationErr
        }

        if (ctx.uid === REPORT_UID && ctx.params.data) {
          const validationErr = validateReportDate(
            ctx.params.data as Parameters<typeof validateReportDate>[0]
          )
          if (validationErr) throw validationErr
        }

      }
      return next()
    })

    // Ensure database directory exists with proper permissions
    // Default database path is .tmp/data.db relative to process.cwd()
    const dbDir = path.resolve(process.cwd(), '.tmp')
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true, mode: 0o775 })
    } else {
      // Ensure directory has write permissions
      try {
        fs.chmodSync(dbDir, 0o775)
      } catch {
        // Ignore permission errors if we can't change them
      }
    }

    // If database file exists, ensure it has write permissions
    const dbPath = path.join(dbDir, 'data.db')
    if (fs.existsSync(dbPath)) {
      try {
        fs.chmodSync(dbPath, 0o664)
      } catch {
        // Ignore permission errors if we can't change them
      }
    }

    // Ensure git sync points at a valid staging clone before handling content events
    await validateGitSyncRepoOnStartup()

    // Redirect uploads to public/uploads/img/original/ and disable image variants
    overrideUploadProvider(strapi)
    await disableImageVariants(strapi)

    // Register any on-disk images that are missing from the DB (fresh DB scenario)
    await seedUploadsFromDisk(strapi)

    // Ensure required locales (en, es) are installed
    await ensureLocales(strapi)

    // Configure pretty field labels for the admin panel
    await configureFieldLabels(strapi)
    await configureLayouts(strapi)

    // Auto-commit uploaded image changes in public/uploads via git sync.
    registerUploadGitSyncLifecycle(strapi)
  }
}
