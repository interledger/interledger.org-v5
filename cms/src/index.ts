import * as fs from 'fs'
import * as path from 'path'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import {
  scheduleGitSync,
  validateGitSyncRepoOnStartup,
  validateNoNestedJsx,
  validateReportDate,
  validateReportContent,
  normalizeNavigationInput,
  validateHeroFields,
  validateGrantPagePrimaryCta,
  validateGrantPageFaqSection,
  validateFaqSections,
  validateGrantInfoCards,
  validateProfileCta,
  validateCtaStrip,
  validateBlogFields,
  validatePodcastPageFields,
  validateNavigationLabels,
  validateCardGridVariantsForContentType,
  mergeValidationErrors,
  toValidationError,
  normalizeRelativeLinksInDocumentData,
  LOCALES,
  shouldSkipMdxExport
} from './utils'
import {
  validateContentBlocks,
  sanitizeCardGridsInDocumentData
} from './serializers/blocks'
import { errors } from '@strapi/utils'
import {
  formatFileSize,
  imageOverSizeLimitError,
  imageSizeLimitError,
  isImageOverSizeLimit,
  isMediaOverSizeLimit,
  mediaSizeLimitError,
  IMAGE_EXTENSIONS,
  MAX_IMAGE_SIZE_LABEL
} from './utils/uploadLimits'
import { SEED_MIME_BY_EXT, SEEDABLE_EXTENSIONS } from './utils/seedMedia'
import { CARD_GRID_VARIANT_DEFINITIONS } from './utils/cardGrid'

const CARD_GRID_ADMIN_FIELD_LABELS = Object.fromEntries(
  CARD_GRID_VARIANT_DEFINITIONS.map((variant) => [
    variant.cardsField,
    variant.fieldLabel
  ])
)

const CARD_GRID_CARD_FIELD_LAYOUT = CARD_GRID_VARIANT_DEFINITIONS.map(
  (variant) => [{ name: variant.cardsField, size: 12 }]
)

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

interface CmConfiguration {
  settings?: Record<string, unknown>
  metadatas?: Record<string, FieldMetadata>
  layouts?: {
    list?: unknown[]
    edit?: EditLayoutField[][]
  }
  options?: Record<string, unknown>
}

interface CmContentTypesService {
  findConfiguration: (obj: { uid: string }) => Promise<CmConfiguration | null>
  updateConfiguration: (
    obj: { uid: string },
    config: CmConfiguration
  ) => Promise<void>
}

interface CmComponentsService {
  findComponent: (uid: string) => { uid: string } | null
  findConfiguration: (component: {
    uid: string
  }) => Promise<CmConfiguration | null>
  updateConfiguration: (
    component: { uid: string },
    config: CmConfiguration
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
  checkFileSize: (file: UploadFile, options?: unknown) => Promise<void>
}

export interface UploadFile {
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
interface KoaContext {
  request: { headers: Record<string, string | string[] | undefined> }
  status: number
  body: unknown
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
  server: {
    router: {
      post: (path: string, handler: (ctx: KoaContext) => Promise<void>) => void
    }
  }
  service: (uid: string) => unknown
}

/**
 * Media types whose uploads are git-committed and served from the repo. Images
 * have always been; video and PDF were added for INTORG-876, gated by the 5 MB
 * upload size cap in `config/plugins.ts`. Larger media is out of scope here —
 * tracked for alternative (CDN/cloud) storage in INTORG-902. Non-string mime
 * falls through to a sync (matches the prior default).
 */
function shouldGitSyncUpload(mime: unknown): boolean {
  if (typeof mime !== 'string') return true
  return (
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime === 'application/pdf'
  )
}

function registerUploadGitSyncLifecycle(strapi: StrapiInstance): void {
  strapi.db?.lifecycles?.subscribe({
    models: ['plugin::upload.file'],
    afterCreate(event) {
      if (shouldSkipMdxExport()) return
      if (!shouldGitSyncUpload(event.result?.mime)) return

      console.log('📦 Upload created, scheduling git sync')
      scheduleGitSync('upload')
    },
    afterUpdate(event) {
      if (shouldSkipMdxExport()) return
      if (!shouldGitSyncUpload(event.result?.mime)) return

      console.log('📦 Upload updated, scheduling git sync')
      scheduleGitSync('upload')
    },
    afterDelete(event) {
      if (shouldSkipMdxExport()) return
      if (!shouldGitSyncUpload(event.result?.mime)) return

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
 * Strapi normalizes `file.size` to kilobytes (`bytesToKbytes` in @strapi/utils,
 * which divides by 1000) before the provider ever sees the file. Comparing it
 * against a byte limit directly silently disables the check.
 */
const BYTES_PER_STRAPI_KBYTE = 1000

function getUploadFileSizeBytes(file: UploadFile): number {
  if (typeof file.size === 'number') return file.size * BYTES_PER_STRAPI_KBYTE
  if (file.buffer) return file.buffer.length
  return 0
}

function getUploadLabel(file: UploadFile): string {
  if (typeof file.name === 'string') return file.name
  return `${file.hash ?? 'upload'}${file.ext ?? ''}`
}

function normalizeUploadExt(ext: string): string {
  const lower = ext.toLowerCase()
  // Strapi's `file.ext` normally includes the leading dot (".png"); IMAGE_EXTENSIONS
  // / MIME_BY_EXT keys use that same format. Normalize so a bare "png" still matches.
  return lower.startsWith('.') ? lower : `.${lower}`
}

function isImageUpload(file: UploadFile): boolean {
  const mime = typeof file.mime === 'string' ? file.mime : ''
  if (mime.startsWith('image/')) return true
  // Explicit non-image MIME (e.g. application/pdf, video/*) must not fall
  // through to the extension check — seedable media includes those too.
  if (mime) return false

  const rawExt = typeof file.ext === 'string' ? file.ext : ''
  if (!rawExt) return false
  return IMAGE_EXTENSIONS.has(normalizeUploadExt(rawExt))
}

/**
 * Enforces both upload ceilings — 2 MB for images, 5 MB for everything else —
 * with a message that names the actual size and tells the editor what to do
 * about it (INTORG-1000).
 */
export function assertUploadWithinLimit(file: UploadFile, label: string): void {
  const sizeBytes = getUploadFileSizeBytes(file)
  // size/buffer unknown (0) — stream uploads are enforced mid-pipe instead.
  if (sizeBytes === 0) return

  if (isImageUpload(file)) {
    if (isImageOverSizeLimit(sizeBytes)) {
      throw new errors.PayloadTooLargeError(
        imageSizeLimitError(label, sizeBytes)
      )
    }
    return
  }

  if (isMediaOverSizeLimit(sizeBytes)) {
    throw new errors.PayloadTooLargeError(mediaSizeLimitError(label, sizeBytes))
  }
}

/**
 * Wraps the provider's own size check so ours runs first — an oversized file
 * then gets our actionable message instead of the provider's bare "exceeds size
 * limit of 5 MB".
 *
 * The wrapped check is async, so its result has to be awaited. Calling it and
 * dropping the promise turned a rejection into an unhandled rejection, which
 * killed the Strapi process and left the editor staring at a network error
 * instead of an explanation (INTORG-1000).
 */
export function createCheckFileSize(
  originalCheckFileSize?: (file: UploadFile, options?: unknown) => Promise<void>
) {
  return async (file: UploadFile, options?: unknown): Promise<void> => {
    assertUploadWithinLimit(file, getUploadLabel(file))
    await originalCheckFileSize?.(file, options)
  }
}

function assertWrittenImageWithinLimit(
  file: UploadFile,
  dest: string,
  label: string
): void {
  if (!isImageUpload(file)) return

  const { size } = fs.statSync(dest)
  if (isImageOverSizeLimit(size)) {
    fs.unlinkSync(dest)
    throw new errors.PayloadTooLargeError(imageSizeLimitError(label, size))
  }
}

/**
 * Counts bytes while piping an image upload so we can abort as soon as the
 * stream exceeds the 2 MB image limit, instead of writing a huge file and
 * unlinking it in the post-write check (when `file.size` / `buffer` were absent).
 * The real size is unknown at that point, so the message omits it.
 */
function createImageSizeLimitTransform(label: string): Transform {
  let bytesSeen = 0
  return new Transform({
    transform(chunk, _encoding, callback) {
      bytesSeen += chunk.length
      if (isImageOverSizeLimit(bytesSeen)) {
        callback(
          new errors.PayloadTooLargeError(imageOverSizeLimitError(label))
        )
        return
      }
      callback(null, chunk)
    }
  })
}

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
  const originalCheckFileSize = provider.checkFileSize?.bind(provider)

  provider.checkFileSize = createCheckFileSize(originalCheckFileSize)

  provider.uploadStream = async (file: UploadFile) => {
    const stream = file.stream ?? file.getStream?.()
    if (!stream) throw new Error('Missing file stream')
    const label = getUploadLabel(file)
    assertUploadWithinLimit(file, label)
    const dest = path.join(uploadPath, `${file.hash}${file.ext}`)
    try {
      if (isImageUpload(file)) {
        await pipeline(
          stream,
          createImageSizeLimitTransform(label),
          fs.createWriteStream(dest)
        )
      } else {
        await pipeline(stream, fs.createWriteStream(dest))
      }
    } catch (err) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
      throw err
    }
    assertWrittenImageWithinLimit(file, dest, label)
    file.url = `${UPLOAD_URL_PREFIX}/${file.hash}${file.ext}`
  }

  provider.upload = async (file: UploadFile) => {
    if (!file.buffer) throw new Error('Missing file buffer')
    const label = getUploadLabel(file)
    assertUploadWithinLimit(file, label)
    const dest = path.join(uploadPath, `${file.hash}${file.ext}`)
    fs.writeFileSync(dest, file.buffer)
    assertWrittenImageWithinLimit(file, dest, label)
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

  strapi.log.info(
    `✅ Upload provider redirected to ${uploadPath} (${MAX_IMAGE_SIZE_LABEL} limit enforced)`
  )
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

/**
 * Directories under `public/` to scan for seedable media.
 * Each entry maps a disk path (relative to public/) to the URL prefix it's
 * served at. Files found on disk but missing from Strapi's `upload_file`
 * table are inserted so MDX references remain valid after a fresh database.
 */
const SEED_DIRS: ReadonlyArray<{ dir: string; urlPrefix: string }> = [
  { dir: `uploads/${UPLOAD_SUBDIR}`, urlPrefix: `/uploads/${UPLOAD_SUBDIR}` },
  { dir: 'img', urlPrefix: '/img' }
]
const EXCLUDED_SEED_SUBDIRS = new Set(['optimized'])

async function seedUploadsFromDisk(strapi: StrapiInstance): Promise<number> {
  const query = strapi.db?.query('plugin::upload.file')
  if (!query) {
    strapi.log.warn('⚠️  DB query API unavailable — skipping upload seeding')
    return 0
  }

  const publicDir = strapi.dirs.static.public
  let seeded = 0

  for (const { dir, urlPrefix } of SEED_DIRS) {
    const absDir = path.join(publicDir, dir)
    if (!fs.existsSync(absDir)) continue

    const files = collectMediaPaths(absDir)

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
      if (IMAGE_EXTENSIONS.has(ext) && isImageOverSizeLimit(stat.size)) {
        strapi.log.warn(
          `⚠️  Skipping seed for oversized image (${formatFileSize(stat.size)}): ${url}`
        )
        continue
      }
      const sizeKB = Number((stat.size / 1024).toFixed(2))
      const mime = SEED_MIME_BY_EXT[ext] ?? 'application/octet-stream'

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
  return seeded
}

interface AdminApiTokenService {
  getByName: (name: string) => Promise<{ id: string | number } | null>
  create: (attributes: {
    name: string
    description: string
    type: 'full-access'
    lifespan: null
  }) => Promise<{ accessKey: string }>
}

const CI_API_TOKEN_NAME = 'ci-dry-run'

/**
 * CI-only: creates a full-access API token so an ephemeral, freshly-booted
 * Strapi instance (built-and-dryrun PR check) can be used as a sync target
 * without any manual admin-panel setup. No-op unless CI_API_TOKEN_OUTPUT_PATH
 * is set. Strapi only returns a token's raw value once, at creation time, so
 * it's written straight to disk for the calling CI step to read.
 */
async function ensureCiApiToken(strapi: StrapiInstance): Promise<void> {
  const outputPath = process.env.CI_API_TOKEN_OUTPUT_PATH
  if (!outputPath) return

  const tokenService = strapi.service(
    'admin::api-token'
  ) as AdminApiTokenService

  const existing = await tokenService.getByName(CI_API_TOKEN_NAME)
  if (existing) {
    strapi.log.warn(
      `[CI] API token "${CI_API_TOKEN_NAME}" already exists from a previous boot; its raw value can't be re-read, skipping token-file write.`
    )
    return
  }

  const token = await tokenService.create({
    name: CI_API_TOKEN_NAME,
    description:
      'Ephemeral token for the build-and-dryrun PR check. Safe to revoke or ignore.',
    type: 'full-access',
    lifespan: null
  })

  fs.writeFileSync(outputPath, token.accessKey, { mode: 0o600 })
  strapi.log.info(`[CI] Wrote API token to ${outputPath}`)
}

function collectMediaPaths(dir: string): string[] {
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
      pathSlug: 'Path Slug',
      section: 'Section',
      media: 'Photo',
      tagline: 'Tag line',
      description: 'Description',
      role: 'Role',
      category: 'Category',
      content: 'Biography'
    },
    'api::foundation-blog-post.foundation-blog-post': {
      title: 'Title',
      description: 'Short Description',
      pathSlug: 'Path Slug',
      date: 'Publish Date',
      lastUpdated: 'Last Updated',
      featured: 'Featured',
      featureMedia: 'Feature Image (Desktop)',
      featureImageMobile: 'Feature Image (Mobile)',
      thumbnailMedia: 'Article Thumbnail',
      content: 'Content',
      articleBio: 'Author',
      categories: 'Categories',
      relatedArticles: 'Other Relevant Articles',
      language: 'Language'
    },
    'api::foundation-page.foundation-page': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      description: 'Short Description',
      hero: 'Hero',
      content: 'Page Content'
    },
    'api::summit-page.summit-page': {
      title: 'Title',
      pathSlug: 'Path Slug',
      description: 'Short Description',
      hero: 'Hero',
      content: 'Content'
    },
    'api::hackathon-page.hackathon-page': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      description: 'Short Description',
      hero: 'Hero',
      content: 'Page Content'
    },
    'api::foundation-navigation.foundation-navigation': {
      mainMenu: 'Main Menu',
      ctaButton: 'CTA Button'
    },
    'api::summit-navigation.summit-navigation': {
      mainMenu: 'Main Menu',
      ctaButton: 'CTA Button'
    },
    'api::hackathon-navigation.hackathon-navigation': {
      mainMenu: 'Main Menu',
      ctaButton: 'CTA Button'
    },
    'api::grant-page.grant-page': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      description: 'Short Description',
      hero: 'Hero',
      programOverview: 'Program Overview',
      primaryCta: 'Primary Call to Action',
      infoCards: 'Information Cards',
      content: 'Content',
      ctaStrip: 'CTA Strip',
      faqSection: 'FAQ Section'
    },
    'api::grant-overview-page.grant-overview-page': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      description: 'Short Description',
      hero: 'Hero',
      content: 'Content',
      ctaStrip: 'CTA Strip',
      followUpContent: 'Follow-up Content'
    },
    'api::faq.faq': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      section: 'Section',
      heading: 'Heading',
      description: 'Short Description',
      introParagraph: 'Intro Paragraph',
      faqSections: 'FAQ Sections'
    },
    'api::report.report': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      section: 'Section',
      heading: 'Heading',
      description: 'Short Description',
      introParagraph: 'Intro Paragraph',
      date: 'Date',
      content: 'Report Sections'
    },
    'api::podcast-page.podcast-page': {
      title: 'Page Title',
      pathSlug: 'Path Slug',
      description: 'Short Description',
      hero: 'Hero',
      titleCards: 'Title Cards',
      podcasts: 'Podcasts',
      ctaStrip: 'CTA Strip'
    }
  }

  const contentTypeDescriptions: Record<string, Record<string, string>> = {
    'api::profile-page.profile-page': {
      tagline:
        'Used on profile grids below the avatar and name. Not shown on the profile page.',
      category:
        'Groups related profiles so a Profile Grid can list everyone who shares this label (e.g. "Past Fellows", "2025 Hackathon Judges").',
      media:
        'The photo is cropped to a circle on the site — upload an image that works in that shape, with the face centred and clear of the edges.',
      pathSlug:
        'Path relative to the chosen Section, no leading slash, e.g. 2025/judges/jane-doe. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
      role: "Job title or role shown under the profile name on the profile page (e.g. 'Open Web Advocate & Open Source Contributor').",
      section:
        'Site section for routing and breadcrumbs. Use foundation for profiles at the site root or under a full pathSlug (e.g. grant/fellowship/jane-doe); summit or hackathon when the profile lives under that microsite prefix.',
      description:
        'Short intro blurb shown on the profile page, above the biography sections. Also used for SEO.'
    },
    'api::foundation-page.foundation-page': {
      title:
        'Enter only the page name, e.g. "Our Grantmaking" — not "Interledger Foundation | Our Grantmaking". The "Interledger Foundation |" part is added automatically in the browser tab.',
      pathSlug:
        'Path relative to the site root (/). Example: about-us → /about-us; no leading slash. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
      description: 'Short description used for SEO. Aim for 120–160 characters.'
    },
    'api::summit-page.summit-page': {
      title:
        'Enter only the page name, e.g. "Schedule" — not "Interledger Summit | Schedule". The "Interledger Summit |" part is added automatically in the browser tab.',
      pathSlug:
        'Path relative to /summit/. Example: faq → /summit/faq. Do not include /summit/ or a leading slash. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
      description: 'Short description used for SEO. Aim for 120–160 characters.'
    },
    'api::hackathon-page.hackathon-page': {
      title:
        'Enter only the page name, e.g. "Rules" — not "Interledger Hackathon | Rules". The "Interledger Hackathon |" part is added automatically in the browser tab.',
      pathSlug:
        'Path relative to /hackathon/. Example: overview → /hackathon/overview. Do not include /hackathon/ or a leading slash. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
      description: 'Short description used for SEO. Aim for 120–160 characters.'
    },
    'api::grant-page.grant-page': {
      title:
        'Enter only the page name, e.g. "On-Campus Education" — not "Interledger Foundation | On-Campus Education". The "Interledger Foundation |" part is added automatically in the browser tab.',
      pathSlug:
        'Path relative to /grant/. Example: education/on-campus → /grant/education/on-campus. No leading slash. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
      description:
        'Short description used for SEO and card text. Aim for 120–160 characters.'
    },
    'api::grant-overview-page.grant-overview-page': {
      title:
        'Enter only the page name, e.g. "Education" — not "Interledger Foundation | Education". The "Interledger Foundation |" part is added automatically in the browser tab.',
      pathSlug:
        'Path relative to /grant/. Example: education → /grant/education. No leading slash. Must not clash with any Grant Page slug. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
      description:
        'Short description used for SEO and card text. Aim for 120–160 characters.'
    },
    'api::podcast-page.podcast-page': {
      title:
        'Enter only the page name, e.g. "Future Money" — not "Interledger Foundation | Future Money". The "Interledger Foundation |" part is added automatically in the browser tab.',
      pathSlug:
        'Path must be set to "podcast". We only render one page with slug "podcast", at /podcast. Other slugs will not be built. If you need changes contact the frontend dev team.',
      description:
        'Short description used for SEO. Aim for 120–160 characters.',
      titleCards:
        'List every featured podcast series shown at the top of the page.',
      podcasts:
        'The full list of podcast episodes. Author in chronological order (oldest first); the site displays newest first.'
    },
    'api::foundation-blog-post.foundation-blog-post': {
      title:
        'The actual title of the blog post — shown as the article heading, in the browser tab, and in blog listings. The "Interledger Foundation |" prefix is added automatically in the browser tab.',
      pathSlug:
        'Path relative to /blog/. Example: my-article-title → /blog/my-article-title. Do not include /blog/ or a leading slash. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
      description:
        'Short description used for SEO and card text. Aim for 120–160 characters.',
      lastUpdated:
        'Only fill in this field when the post has had a meaningful editorial update (revised text, new sections, or corrected facts).',
      featured:
        'Check to pin this post as a featured article. Up to three featured posts appear in the section at the top of the blog listing page.',
      featureMedia: 'Desktop feature image (required). Dimensions: 720 x 428.',
      featureImageMobile:
        'Optional mobile feature image. Dimensions: 358 x 240. Falls back to the desktop image when empty. Set alternative text on this media file when the mobile crop or content differs from desktop.',
      thumbnailMedia: 'Optional listing thumbnail. Dimensions: 240 x 140.',
      relatedArticles:
        'Add exactly 3 slugs of related blog posts to display in the "You may also like" section. Enter the slug only (e.g. my-related-post), not the full URL.'
    },
    'api::faq.faq': {
      title:
        'Enter only the page name, e.g. "Frequently Asked Questions" — not "Interledger Foundation | Frequently Asked Questions". The site name for the chosen Section (Interledger Foundation, Interledger Summit, or Interledger Hackathon) is added automatically in the browser tab.',
      pathSlug:
        'Path relative to the chosen Section, no leading slash. For section: foundation this is the full path from the site root (e.g. grant/education/on-campus/faq). For summit or hackathon, leave off the summit/ or hackathon/ prefix. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
      section:
        'Site section for routing and breadcrumbs. Use foundation for FAQs at the site root or under a full pathSlug; summit or hackathon when the FAQ lives under that microsite prefix.',
      description:
        'Short description used for SEO and card text. Aim for 120–160 characters.',
      heading:
        'The heading shown at the top of the FAQ page. Can differ from the Page Title.',
      introParagraph: 'Optional intro paragraph shown below the heading.'
      // NOTE: Strapi's admin does not render a description/hint for
      // repeatable-component fields like faqSections (confirmed against
      // @strapi/content-manager's ComponentInput — it renders Field.Label
      // and Field.Error but never Field.Hint). The equivalent guidance lives
      // on blocks.faq-section/blocks.faq-item's own scalar fields below,
      // where hints do render.
    },
    'api::report.report': {
      title:
        'Enter only the page name, e.g. "Annual Report 2025" — not "Interledger Foundation | Annual Report 2025". The site name for the chosen Section (Interledger Foundation, Interledger Summit, or Interledger Hackathon) is added automatically in the browser tab.',
      pathSlug:
        'Path relative to the chosen Section, no leading slash. For section: foundation this is the full path from the site root (e.g. policy-and-advocacy/role-stablecoins-...). For summit or hackathon, leave off the summit/ or hackathon/ prefix. For the Spanish entry, do not prefix with es/ — it’s added automatically.',
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
      media: 'Photo'
    },
    'shared.hero': {
      title: 'Hero Title',
      description: 'Hero Description',
      media: 'Background Image (Desktop) — landscape, 1920x1080px recommended',
      backgroundImageMobile: 'Background Image (Mobile)',
      hero_call_to_action: 'Call-to-action Button'
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
    'blocks.podcast-item': {
      title: 'Title',
      description: 'Description',
      url: 'URL',
      series: 'Series'
    },
    'blocks.quote': {
      quote: 'Quote',
      authorName: 'Author Name',
      authorImage: 'Author Image',
      authorLink: 'Author Link'
    },
    'blocks.callout-text': {
      content: 'Content'
    },
    'shared.cta-link': {
      link: 'Link',
      text: 'Button Text',
      style: 'Style',
      external: 'External Link',
      document: 'Document Download'
    },
    'shared.primary-cta-link': {
      link: 'Link',
      text: 'Button Text',
      external: 'External Link',
      document: 'Document Download'
    },
    'shared.cta-button': {
      link: 'Link',
      text: 'Button Text',
      style: 'Style',
      external: 'External Link',
      document: 'Document Download'
    },
    'blocks.cta-buttons': {
      buttons: 'Buttons'
    },
    'shared.secondary-cta-link': {
      link: 'Link',
      text: 'Button Text',
      external: 'External Link',
      document: 'Document Download'
    },
    'blocks.card-grid': {
      title: 'Title',
      ariaLabel: 'Accessibility label',
      variant: 'Card variant',
      columns: 'Columns',
      ...CARD_GRID_ADMIN_FIELD_LABELS
    },
    'blocks.resource-card': {
      heading: 'Heading',
      description: 'Description',
      secondaryCta: 'Secondary call-to-action button'
    },
    'blocks.navigation-card': {
      heading: 'Heading',
      secondaryCta: 'Secondary call-to-action button'
    },
    'shared.report-date': {
      publishDate: 'Publish Date',
      lastUpdated: 'Last Updated'
    },
    'blocks.report-section': {
      heading: 'Section Heading',
      reportText: 'Content Blocks'
    },
    'blocks.report-text': {
      textType: 'Block Type',
      textContent: 'Paragraph Content',
      textDisclaimer: 'Disclaimer Text'
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
      ctaExternal: 'External Link',
      ctaDocument: 'Document Download',
      items: 'FAQ Items'
    },
    'blocks.grant-faq-item': {
      question: 'Question',
      answer: 'Answer'
    },
    'blocks.faq-section': {
      heading: 'Section Heading',
      items: 'Questions'
    },
    'blocks.faq': {
      heading: 'Heading',
      items: 'Questions'
    },
    'blocks.faq-item': {
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
      body: 'Card Body',
      image: 'Image',
      imageAlt: 'Image alternative text'
    },
    'blocks.carousel': {
      heading: 'Section Heading',
      logos: 'Logos',
      accessibilityLabel: 'Accessibility label'
    },
    'blocks.carousel-logo': {
      image: 'Logo Image',
      alternativeText: 'Alternative Text'
    },
    'blocks.number-tiles': {
      title: 'Title (optional)',
      tiles: 'Tiles'
    },
    'blocks.number-tile': {
      number: 'Number',
      prefix: 'Prefix (currency)',
      suffix: 'Suffix',
      description: 'Description'
    },
    'blocks.agenda': {
      heading: 'Heading (optional)',
      items: 'Agenda items (minimum 2)'
    },
    'blocks.agenda-item': {
      time: 'Time',
      activity: 'Activity',
      additionalInfo: 'Additional information (optional)'
    },
    'blocks.event-card': {
      title: 'Title',
      when: 'When',
      where: 'Where',
      apply: 'Apply'
    },
    'blocks.event-card-when': {
      title: 'Title',
      text: 'Text',
      date: 'Date',
      time: 'Time'
    },
    'blocks.event-card-where': {
      title: 'Title',
      text: 'Text',
      location: 'Location'
    },
    'blocks.event-card-apply': {
      title: 'Title',
      text: 'Text',
      primaryCta: 'Primary CTA button'
    },

    'blocks.cta-strip': {
      heading: 'Heading',
      description: 'Description',
      primaryButtonText: 'Primary Button Text',
      primaryButtonLink: 'Primary Button URL',
      primaryButtonExternal: 'Primary External Link',
      primaryButtonDocument: 'Primary Document Download',
      secondaryButtonText: 'Secondary Button Text',
      secondaryButtonLink: 'Secondary Button URL',
      secondaryButtonExternal: 'Secondary External Link',
      secondaryButtonDocument: 'Secondary Document Download'
    },
    'blocks.image-row': {
      heading: 'Heading',
      content: 'Content',
      media: 'Image',
      imagePosition: 'Image Position',
      attribution: 'Image Attribution'
    },
    'blocks.image-block': {
      media: 'Image',
      tabletImage: 'Tablet image variant (optional)',
      mobileImage: 'Mobile image variant (optional)',
      needsFullView: 'Needs full view',
      needsOutline: 'Needs outline'
    },
    'shared.localized-media': {
      image: 'Image',
      alternativeText: 'Alternative Text'
    },
    'blocks.code-block': {
      code: 'Code',
      language: 'Language',
      title: 'Title (optional)'
    },
    'blocks.video-embed': {
      source: 'Source',
      externalUrl: 'Video URL',
      file: 'Video file',
      title: 'Title'
    },
    'blocks.split-layout': {
      layoutType: 'Layout',
      imagePosition: 'Image position',
      displayRatio: 'Display ratio',
      // Deliberately not "Image" — SplitLayoutTypePicker.tsx's field show/hide
      // logic identifies the nested media picker by its exact label text
      // ("Image", from shared.localized-media's own field label) and would
      // become ambiguous if this wrapper field used the same text.
      media: 'Media',
      videoUrl: 'Video URL',
      content: 'Content',
      quote: 'Quote',
      quoteSource: 'Quote Attribution',
      cta: 'Call-to-action Button'
    },
    'blocks.title-card': {
      heading: 'Heading',
      subHeading: 'Sub heading',
      description: 'Description',
      secondaryCta: 'Secondary call-to-action button'
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
      media:
        'Upload a square image with the subject’s face centred. The image will be cropped to a circle on the page, so keep the face clear of the edges.',
      profileBio: 'We recommend a max of 255 characters'
    },
    'shared.related-article': {
      slug: 'Add exactly 3. Enter the slug of the related post - the segment after /blog/, not the full URL (e.g. my-related-post). No leading slash'
    },
    'blocks.profile-grid': {
      category: 'Option A: show profiles by category (leave profiles empty)',
      profiles: 'Option B: pick profiles manually (leave category empty)'
    },
    'blocks.paragraph': {
      content:
        'Footnotes: write [^1] inline, then [^1]: Your note at the end of this block.'
    },
    'blocks.podcast-item': {
      description: 'Ideally within 225 characters.',
      url: 'A Castopod or YouTube embed link, e.g. https://podcast.interledger.org/@futuremoneypodcast/episodes/example-embed'
    },
    'blocks.image-block': {
      tabletImage:
        'Use if your image needs different proportions or cropping on medium-sized screens.',
      mobileImage:
        'Use if your image needs different proportions or cropping on small screens.',
      needsFullView:
        'Enable for complex images, diagrams, or anything where fine detail matters.',
      needsOutline:
        'Enable if the image has a white or light background and needs a boundary to separate it from blending into the page.'
    },
    'shared.hero': {
      backgroundImageMobile:
        'Optional mobile hero image. Recommended size: 768×480px. Falls back to the desktop image when absent.'
    },
    'shared.localized-media': {
      alternativeText:
        'Describe the image if it conveys information. Leave blank if the image is purely decorative. Set per locale, and change the image itself here too if the graphic has text baked in that needs translating.'
    },
    'blocks.video-embed': {
      source:
        'Choose "external_url" for a YouTube, Vimeo, or direct video link, or "media_library" to upload a video file. Videos over 5 MB are rejected; use YouTube for larger videos.',
      externalUrl:
        'A YouTube or Vimeo link, or a direct link to a video file (.mp4, .webm, .ogg, .mov).',
      file: 'Upload a video file (max 5 MB). For larger videos, use YouTube or Vimeo and paste the link in the URL field instead.',
      title:
        'A short, descriptive title used as the accessible label for the video.'
    },
    'blocks.info-cards': {
      heading:
        'Optional. When filled in, renders as three information cards before the CTA strip. Heading is optional; all three cards require both a heading and body.'
    },
    'blocks.info-card': {
      heading: 'Required card title.',
      body: 'Required unless an image is set. Supports markdown including bullet lists.',
      image:
        'Optional cover photo. Use a square image (1:1). It fills the card without stretching. When set, the card shows the photo instead of the heading and body.',
      imageAlt:
        'Describe the photo for screen readers. Falls back to the card heading if left blank.'
    },
    'blocks.faq-section': {
      heading:
        'Required. Also becomes the label in the FAQ page’s left-hand navigation, so keep it short. At least 1 question is required below.'
    },
    'blocks.faq': {
      heading:
        'Optional. Shown above the questions. Leave blank to run the questions straight on from the content above. At least 1 question is required below.'
    },
    'blocks.faq-item': {
      question: 'Required.',
      answer: 'Required.'
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
      displayRatio:
        'Content-to-media width. Default 2:1 (wider content). 1:1 equal columns; 1:2 wider media.',
      videoUrl:
        'YouTube or Vimeo URL. When set, takes precedence over the image.',
      quote:
        'Quote text. When set, renders as a blockquote instead of the Content field.',
      quoteSource: 'Attribution shown below the quote (e.g. "Jane Doe, CEO").',
      content:
        'Rich text for the content column. Leave empty when using a Quote.'
    },
    'blocks.title-card-grid': {
      ariaLabel:
        'Used by screen readers to describe this group of cards. This text is not visible on the page. Example: "Grant options" or "Ways to get involved".'
    },
    'shared.secondary-cta-link': {
      link: 'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). Only use a full URL (http:// or https://...) when External Link is checked.',
      document:
        'Mark as a downloadable document (shows a download icon). Cannot be combined with External Link. For a PDF: upload it in the Media Library, open it, press Copy Link, and paste the link here. The origin is removed for you on save, leaving /uploads/img/original/your-file.pdf.',
      external: 'Opens in a new tab. Cannot be combined with Document Download.'
    },
    'shared.cta-button': {
      link: 'For a page on this site, start with a forward slash (e.g. /grants/apply). Only use a full URL (https://...) when External Link is checked.',
      style:
        'Primary is the filled button, Secondary is the outlined one. With two buttons you can use one Primary and one Secondary, or two Secondary, and the Primary must come first.',
      document:
        'Mark as a downloadable document (shows a download icon). Cannot be combined with External Link. For a PDF: upload it in the Media Library, open it, press Copy Link, and paste the link here. The origin is removed for you on save, leaving /uploads/img/original/your-file.pdf.',
      external: 'Opens in a new tab. Cannot be combined with Document Download.'
    },
    'blocks.cta-buttons': {
      buttons:
        'One button, or two side by side. On mobile they stack and both go full width.'
    },
    'shared.cta-link': {
      link: 'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). Only use a full URL (http:// or https://...) when External Link is checked.',
      document:
        'Mark as a downloadable document (shows a download icon). Cannot be combined with External Link. For a PDF: upload it in the Media Library, open it, press Copy Link, and paste the link here. The origin is removed for you on save, leaving /uploads/img/original/your-file.pdf.',
      external: 'Opens in a new tab. Cannot be combined with Document Download.'
    },
    'shared.primary-cta-link': {
      link: 'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). Only use a full URL (http:// or https://...) when External Link is checked.',
      document:
        'Mark as a downloadable document (shows a download icon). Cannot be combined with External Link. For a PDF: upload it in the Media Library, open it, press Copy Link, and paste the link here. The origin is removed for you on save, leaving /uploads/img/original/your-file.pdf.',
      external: 'Opens in a new tab. Cannot be combined with Document Download.'
    },
    'navigation.menu-item': {
      href: 'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). For an external site, use a full URL starting with http:// or https://.'
    },
    'navigation.menu-group': {
      href: 'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). For an external site, use a full URL starting with http:// or https://.'
    },
    'blocks.card': {
      link: 'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). For an external site, use a full URL starting with http:// or https://.'
    },
    'blocks.card-link': {
      href: 'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). For an external site, use a full URL starting with http:// or https://.'
    },
    'blocks.grant-faq-section': {
      ctaLink:
        'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). For an external site, use a full URL starting with http:// or https://.',
      ctaExternal:
        'Opens in a new tab. Cannot be combined with Document Download.',
      ctaDocument:
        'Mark as a downloadable document (shows a download icon). Cannot be combined with External Link. For a PDF: upload it in the Media Library, open it, press Copy Link, and paste the link here. The origin is removed for you on save, leaving /uploads/img/original/your-file.pdf.'
    },
    'blocks.card-grid': {
      title: 'Optional. Shown above the cards as a heading.',
      ariaLabel:
        'Used by screen readers to describe this group of cards. This text is not visible on the page.',
      // Clear any previously stored helper text for the variant custom field.
      variant: '',
      columns:
        'Desktop layout. One column is only for Navigation. Resource grids need at least two cards and cannot use One.'
    },
    'blocks.resource-card': {
      heading: 'Required card title.',
      description: 'Required. Supports markdown.',
      secondaryCta: 'Required link button (internal, external, or document).'
    },
    'blocks.navigation-card': {
      heading: 'Required card title.',
      secondaryCta: 'Required link (internal, external, or document).'
    },
    'blocks.carousel': {
      accessibilityLabel:
        'Used by screen readers to describe this logo carousel. This text is not visible on the page. Example: "Partner logos" or "Our sponsors".',
      logos: 'Add one entry per logo. Recommended image size: 240×80.'
    },
    'blocks.carousel-logo': {
      image: 'Partner logo image. Recommended size: 240×80.',
      alternativeText:
        'Short description of the logo for screen readers (e.g. the organization name). Shown next to each logo — not in the Media Library.'
    },
    'blocks.number-tile': {
      number:
        'Enter digits only (e.g. "1000") — the site formats thousands with commas. Do not include the prefix or suffix here.',
      prefix:
        'Optional symbol shown tight against the front of the number, e.g. "$" for a monetary amount.',
      suffix: 'Optional suffix shown after the number, e.g. "M+" or "+".'
    },
    'blocks.agenda': {
      heading: 'Optional. E.g. "Day 1 – Nov 8, 2026".'
    },
    'blocks.event-card': {
      title: 'Optional heading shown above the When / Where / Apply columns.',
      when: 'This box is intended to explain when an event is taking place.',
      where: 'This box is intended to explain where an event is taking place.',
      apply:
        'Optional. This box is intended for application, registration, or interest actions. When omitted, When and Where expand to fill the card.'
    },
    'blocks.event-card-when': {
      title: 'Required. Column heading, e.g. "When?".',
      text: 'Optional supporting copy shown under the title.',
      date: 'Optional. Free-text date range, e.g. "November 8–9, 2025".',
      time: 'Optional. Free-text duration or start time, e.g. "24h" or "9:00 am".'
    },
    'blocks.event-card-where': {
      title: 'Required. Column heading, e.g. "Where?".',
      text: 'Optional supporting copy shown under the title.',
      location: 'Optional. Venue or address; multi-line text is fine.'
    },
    'blocks.event-card-apply': {
      title: 'Optional. Column heading, e.g. "Apply".',
      text: 'Optional supporting copy shown under the title, above the button.',
      primaryCta:
        'Required. Primary button label, URL, and internal/external flag.'
    },
    'blocks.cta-strip': {
      primaryButtonLink:
        'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). For an external site, use a full URL starting with http:// or https://.',
      primaryButtonExternal:
        'Opens in a new tab. Cannot be combined with Document Download.',
      primaryButtonDocument:
        'Mark as a downloadable document (shows a download icon). Cannot be combined with External Link. For a PDF: upload it in the Media Library, open it, press Copy Link, and paste the link here. The origin is removed for you on save, leaving /uploads/img/original/your-file.pdf.',
      secondaryButtonLink:
        'For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). For an external site, use a full URL starting with http:// or https://.',
      secondaryButtonExternal:
        'Opens in a new tab. Cannot be combined with Document Download.',
      secondaryButtonDocument:
        'Mark as a downloadable document (shows a download icon). Cannot be combined with External Link. For a PDF: upload it in the Media Library, open it, press Copy Link, and paste the link here. The origin is removed for you on save, leaving /uploads/img/original/your-file.pdf.'
    },
    'blocks.quote': {
      authorLink:
        'Optional. For a page on this site, start with a forward slash (e.g. /grant/our-grantmaking). For an external site, use a full URL starting with http:// or https://.'
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
export function buildLayoutConfiguration(
  current: CmConfiguration | null | undefined,
  edit: EditLayoutField[][],
  settings: Record<string, unknown> = {}
): CmConfiguration {
  return {
    settings: { ...current?.settings, ...settings },
    metadatas: current?.metadatas ?? {},
    layouts: { ...current?.layouts, edit },
    ...(current?.options ? { options: current.options } : {})
  }
}

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
        { name: 'featureMedia', size: 6 },
        { name: 'featureImageMobile', size: 6 }
      ],
      [{ name: 'thumbnailMedia', size: 6 }],
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
      [{ name: 'category', size: 6 }],
      [{ name: 'media', size: 12 }],
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
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'hero', size: 12 }],
      [{ name: 'content', size: 12 }]
    ],
    'api::summit-page.summit-page': [
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'hero', size: 12 }],
      [{ name: 'content', size: 12 }]
    ],
    'api::hackathon-page.hackathon-page': [
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'hero', size: 12 }],
      [{ name: 'content', size: 12 }]
    ],
    'api::grant-overview-page.grant-overview-page': [
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'hero', size: 12 }],
      [{ name: 'content', size: 12 }],
      [{ name: 'ctaStrip', size: 12 }],
      [{ name: 'followUpContent', size: 12 }]
    ],
    'api::podcast-page.podcast-page': [
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'hero', size: 12 }],
      [{ name: 'titleCards', size: 12 }],
      [{ name: 'podcasts', size: 12 }],
      [{ name: 'ctaStrip', size: 12 }]
    ],
    'api::grant-page.grant-page': [
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'hero', size: 12 }],
      [{ name: 'programOverview', size: 12 }],
      [{ name: 'primaryCta', size: 12 }],
      [{ name: 'infoCards', size: 12 }],
      [{ name: 'content', size: 12 }],
      [{ name: 'faqSection', size: 12 }],
      [{ name: 'ctaStrip', size: 12 }]
    ],
    'api::faq.faq': [
      [
        { name: 'title', size: 6 },
        { name: 'section', size: 6 }
      ],
      [{ name: 'pathSlug', size: 12 }],
      [{ name: 'heading', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'introParagraph', size: 12 }],
      [{ name: 'faqSections', size: 12 }]
    ]
  }

  // These layouts REPLACE whatever Strapi generated, they do not merge with it.
  // Any field missing from the list below is missing from the edit form, even
  // though it exists on the component and the API returns it.
  //
  // So adding a field to a component schema is only half the job: add it here
  // too, or an editor never sees it. `document` on `shared.cta-link` and the
  // four flags on `blocks.cta-strip` were both invisible for exactly this
  // reason (INTORG-938).
  //
  // Components without an entry here are safe: Strapi appends new fields to
  // its own generated layout.
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
      [{ name: 'media', size: 6 }],
      [{ name: 'profileBio', size: 12 }]
    ],
    'shared.related-article': [[{ name: 'slug', size: 8 }]],
    'blocks.profile-grid': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'category', size: 12 }],
      [{ name: 'profiles', size: 12 }]
    ],
    'blocks.podcast-item': [
      [
        { name: 'title', size: 6 },
        { name: 'series', size: 6 }
      ],
      [{ name: 'url', size: 12 }],
      [{ name: 'description', size: 12 }]
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
    'blocks.carousel-logo': [
      [{ name: 'image', size: 6 }],
      [{ name: 'alternativeText', size: 6 }]
    ],
    'blocks.number-tiles': [
      [{ name: 'title', size: 12 }],
      [{ name: 'tiles', size: 12 }]
    ],
    'blocks.number-tile': [
      [
        { name: 'prefix', size: 4 },
        { name: 'number', size: 4 },
        { name: 'suffix', size: 4 }
      ],
      [{ name: 'description', size: 12 }]
    ],
    'blocks.agenda': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'items', size: 12 }]
    ],
    'blocks.agenda-item': [
      [
        { name: 'time', size: 6 },
        { name: 'activity', size: 6 }
      ],
      [{ name: 'additionalInfo', size: 12 }]
    ],
    'blocks.event-card': [
      [{ name: 'title', size: 12 }],
      [{ name: 'when', size: 12 }],
      [{ name: 'where', size: 12 }],
      [{ name: 'apply', size: 12 }]
    ],
    'blocks.event-card-when': [
      [{ name: 'title', size: 12 }],
      [{ name: 'text', size: 12 }],
      [
        { name: 'date', size: 6 },
        { name: 'time', size: 6 }
      ]
    ],
    'blocks.event-card-where': [
      [{ name: 'title', size: 12 }],
      [{ name: 'text', size: 12 }],
      [{ name: 'location', size: 12 }]
    ],
    'blocks.event-card-apply': [
      [{ name: 'title', size: 12 }],
      [{ name: 'text', size: 12 }],
      [{ name: 'primaryCta', size: 12 }]
    ],
    'blocks.image-row': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'media', size: 12 }],
      [
        { name: 'attribution', size: 6 },
        { name: 'imagePosition', size: 6 }
      ],
      [{ name: 'content', size: 12 }]
    ],
    'blocks.image-block': [
      [{ name: 'media', size: 12 }],
      [
        { name: 'tabletImage', size: 6 },
        { name: 'mobileImage', size: 6 }
      ],
      [
        { name: 'needsFullView', size: 6 },
        { name: 'needsOutline', size: 6 }
      ]
    ],
    'blocks.blockquote': [
      [{ name: 'quote', size: 12 }],
      [{ name: 'source', size: 12 }]
    ],
    'blocks.quote': [
      [{ name: 'quote', size: 12 }],
      [
        { name: 'authorName', size: 4 },
        { name: 'authorLink', size: 4 },
        { name: 'authorImage', size: 4 }
      ]
    ],
    'blocks.cta-strip': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'description', size: 12 }],
      [
        { name: 'primaryButtonText', size: 6 },
        { name: 'primaryButtonLink', size: 6 }
      ],
      [
        { name: 'primaryButtonExternal', size: 6 },
        { name: 'primaryButtonDocument', size: 6 }
      ],
      [
        { name: 'secondaryButtonText', size: 6 },
        { name: 'secondaryButtonLink', size: 6 }
      ],
      [
        { name: 'secondaryButtonExternal', size: 6 },
        { name: 'secondaryButtonDocument', size: 6 }
      ]
    ],
    'shared.hero': [
      [{ name: 'title', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'media', size: 12 }],
      [{ name: 'backgroundImageMobile', size: 12 }],
      [{ name: 'hero_call_to_action', size: 12 }]
    ],
    'shared.cta-link': [
      [
        { name: 'link', size: 4 },
        { name: 'text', size: 4 },
        { name: 'style', size: 4 }
      ],
      [
        { name: 'external', size: 4 },
        { name: 'document', size: 4 }
      ]
    ],
    'shared.cta-button': [
      [
        { name: 'text', size: 6 },
        { name: 'link', size: 6 }
      ],
      [
        { name: 'style', size: 4 },
        { name: 'external', size: 4 },
        { name: 'document', size: 4 }
      ]
    ],
    'blocks.cta-buttons': [[{ name: 'buttons', size: 12 }]],
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
      [{ name: 'image', size: 12 }],
      [
        { name: 'imagePosition', size: 3 },
        { name: 'displayRatio', size: 3 },
        { name: 'imageAlt', size: 6 },
        { name: 'videoUrl', size: 6 }
      ],
      [{ name: 'media', size: 12 }],
      [{ name: 'content', size: 12 }],
      [
        { name: 'quote', size: 8 },
        { name: 'quoteSource', size: 4 }
      ],
      [{ name: 'cta', size: 12 }]
    ],
    'blocks.title-card': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'subHeading', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'secondaryCta', size: 12 }]
    ],
    'blocks.info-card': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'body', size: 12 }],
      [
        { name: 'image', size: 6 },
        { name: 'imageAlt', size: 6 }
      ]
    ],
    'blocks.card-grid': [
      [{ name: 'variant', size: 12 }],
      [{ name: 'title', size: 12 }],
      [
        { name: 'columns', size: 6 },
        { name: 'ariaLabel', size: 6 }
      ],
      ...CARD_GRID_CARD_FIELD_LAYOUT
    ],
    'blocks.resource-card': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'description', size: 12 }],
      [{ name: 'secondaryCta', size: 12 }]
    ],
    'blocks.navigation-card': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'secondaryCta', size: 12 }]
    ],
    'blocks.report-section': [
      [{ name: 'heading', size: 12 }],
      [{ name: 'reportText', size: 12 }]
    ],
    'blocks.report-text': [
      [{ name: 'textType', size: 6 }],
      [{ name: 'textContent', size: 12 }],
      [{ name: 'textDisclaimer', size: 12 }]
    ],
    'blocks.grant-faq-section': [
      [{ name: 'title', size: 12 }],
      [{ name: 'subtitle', size: 12 }],
      [{ name: 'description', size: 12 }],
      [
        { name: 'ctaText', size: 6 },
        { name: 'ctaLink', size: 6 }
      ],
      [{ name: 'items', size: 12 }]
    ],
    'shared.secondary-cta-link': [
      [
        { name: 'text', size: 6 },
        { name: 'link', size: 6 }
      ],
      [
        { name: 'external', size: 6 },
        { name: 'document', size: 6 }
      ]
    ]
  }
  const componentMainFields: Record<string, string> = {
    'blocks.agenda-item': 'time',
    'blocks.report-text': 'textType',
    // Collapsed repeatable rows show the button label rather than a generic
    // "CTA Button", so an editor can see both buttons without expanding them.
    'shared.cta-button': 'text'
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
        buildLayoutConfiguration(current, editLayout)
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
        buildLayoutConfiguration(
          current,
          editLayout,
          componentMainFields[uid]
            ? { mainField: componentMainFields[uid] }
            : undefined
        )
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
    // Seed-media endpoint: lets sync:images trigger seedUploadsFromDisk without
    // restarting Strapi. Auth is STRAPI_API_TOKEN (same as other sync scripts)
    // because this route bypasses Strapi's standard auth middleware.
    strapi.server.router.post('/api/seed-media', async (ctx) => {
      const bearer = String(ctx.request.headers['authorization'] ?? '').replace(
        'Bearer ',
        ''
      )
      if (!bearer || bearer !== process.env.STRAPI_API_TOKEN) {
        ctx.status = 401
        ctx.body = { error: 'Unauthorized' }
        return
      }
      const seeded = await seedUploadsFromDisk(strapi)
      ctx.body = { seeded }
    })

    // Nav content types already normalize their own href fields via
    // normalizeNavigationInput below — excluded here to avoid two
    // normalizers touching the same fields.
    const NAV_UIDS = new Set([
      'api::foundation-navigation.foundation-navigation',
      'api::summit-navigation.summit-navigation',
      'api::hackathon-navigation.hackathon-navigation'
    ])

    // Validate paragraph content on save — reject nested JSX before it reaches
    // the DB. Registered as a document-service middleware (see
    // registerDocumentValidation below for why) so it covers every content
    // type's `content` dynamic zone, regardless of which API wrote it.
    strapi.documents.use(async (ctx, next) => {
      if (ctx.action === 'create' || ctx.action === 'update') {
        // Auto-correct relative-link slashes (add a leading slash to
        // href-like fields that are missing one, strip one from path-segment
        // fields that shouldn't have one) before any validation below runs.
        if (!NAV_UIDS.has(ctx.uid)) {
          normalizeRelativeLinksInDocumentData(ctx.params.data)
        }

        // Drop inactive card-grid variant arrays before schema/business
        // validation so empty Title/Resource/Info/Navigation fields that
        // aren't the selected variant never fail the save. Sanitize can
        // throw SerializerFieldError when multiple sections have cards —
        // map that to a ValidationError so the admin highlights the field
        // instead of returning a 500.
        try {
          sanitizeCardGridsInDocumentData(ctx.params.data)
        } catch (err) {
          throw toValidationError(err)
        }
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
        ),
        validateCardGridVariantsForContentType(
          body,
          'api::grant-page.grant-page'
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
          ),
          validateCardGridVariantsForContentType(
            body,
            'api::grant-overview-page.grant-overview-page'
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
    registerDocumentValidation(strapi, 'api::faq.faq', (body) =>
      validateFaqSections(body)
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
      'api::hackathon-page.hackathon-page',
      (body) =>
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
    registerDocumentValidation(
      strapi,
      'api::podcast-page.podcast-page',
      (body) => validatePodcastPageFields(body)
    )
    registerDocumentValidation(strapi, 'api::report.report', (body) =>
      mergeValidationErrors(
        validateReportDate(body),
        validateReportContent(body),
        validateContentBlocks(
          Array.isArray(body.content) ? body.content : undefined
        )
      )
    )

    // Normalize nav href fields (force leading slash), then validate required
    // menu/CTA labels, before saving to DB
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

    // CI-only, no-op otherwise: provisions an API token for the ephemeral
    // Strapi instance the build-and-dryrun PR check boots from this branch's code.
    await ensureCiApiToken(strapi)

    // Ensure required locales (en, es) are installed
    await ensureLocales(strapi)

    // Configure pretty field labels for the admin panel
    await configureFieldLabels(strapi)
    await configureLayouts(strapi)

    // Auto-commit uploaded image changes in public/uploads via git sync.
    registerUploadGitSyncLifecycle(strapi)
  }
}
