import * as fs from 'fs'
import * as path from 'path'
import { validateGitSyncRepoOnStartup } from './utils/gitSync'
import { LOCALES } from './utils/mdx'

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

// Strapi instance type for lifecycle functions
interface StrapiEntityService {
  findMany: (
    uid: string,
    options: Record<string, unknown>
  ) => Promise<unknown[]>
  create: (
    uid: string,
    options: { data: Record<string, unknown> }
  ) => Promise<unknown>
}

interface StrapiLogger {
  debug: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
}

interface FieldMetadata {
  edit?: {
    label?: string
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

interface StrapiInstance {
  entityService: StrapiEntityService
  log: StrapiLogger
  plugin: (name: string) =>
    | {
        service: (
          name: string
        ) => CmContentTypesService | CmComponentsService | undefined
      }
    | undefined
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
      const existingLocales = await strapi.entityService.findMany(
        'plugin::i18n.locale',
        {
          filters: { code: localeCode },
          limit: 1
        }
      )

      if (existingLocales && existingLocales.length > 0) {
        strapi.log.debug(`✅ Locale ${localeCode} already exists`)
        continue
      }

      // Create locale if it doesn't exist
      const displayName =
        localeConfigs[localeCode] ||
        `${localeCode.toUpperCase()} (${localeCode})`
      await strapi.entityService.create('plugin::i18n.locale', {
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
    'api::ambassador.ambassador': {
      name: 'Name',
      slug: 'URL Slug',
      description: 'Description',
      photo: 'Photo',
      linkedinUrl: 'LinkedIn URL',
      grantReportUrl: 'Grant Report URL'
    },
    'api::foundation-blog-post.foundation-blog-post': {
      title: 'Title',
      description: 'Description',
      slug: 'URL Slug',
      date: 'Publish Date',
      pillar: 'Pillar',
      featureImage: 'Feature Image',
      thumbnailImage: 'Article Thumbnail',
      content: 'Content',
      articleBio: 'Article Bio',
      tags: 'Tags',
      language: 'Language'
    },
    'api::foundation-page.foundation-page': {
      title: 'Page Title',
      slug: 'URL Slug',
      path: 'Route Path',
      pageType: 'Page Type',
      seo: 'SEO',
      hero: 'Hero',
      content: 'Page Content'
    },
    'api::summit-page.summit-page': {
      title: 'Title',
      slug: 'URL Slug',
      path: 'Route Path',
      pageType: 'Page Type',
      seo: 'SEO',
      hero: 'Hero',
      content: 'Content'
    }
  }

  const componentLabels: Record<string, Record<string, string>> = {
    'shared.hero': {
      title: 'Hero Title',
      description: 'Hero Description',
      backgroundImage: 'Background Image',
      secondaryCtas: 'Secondary Buttons'
    },
    'shared.seo': {
      metaTitle: 'Meta Title',
      metaDescription: 'Meta Description',
      metaImage: 'Social Share Image',
      keywords: 'Keywords',
      canonicalUrl: 'Canonical URL'
    },
    'blocks.ambassadors-grid': {
      heading: 'Heading',
      ambassadors: 'Ambassadors'
    },
    'shared.cta-link': {
      link: 'Link',
      text: 'Button Text',
      style: 'Style',
      external: 'External Link',
      analytics_event_label: 'Analytics Event Label'
    },
    'blocks.paragraph': {
      content: 'Content',
      alignment: 'Alignment'
    }
  }

  async function applyLabels(
    service: CmContentTypesService | CmComponentsService,
    uid: string,
    labels: Record<string, string>
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
      const isDefault = !currentLabel || currentLabel === fieldName
      if (isDefault && currentLabel !== label) {
        updatedMetadatas[fieldName] = {
          ...meta,
          edit: { ...meta.edit, label },
          list: { ...meta.list, label }
        }
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      await service.updateConfiguration({ uid }, { metadatas: updatedMetadatas })
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
      await applyLabels(contentTypeService, uid, labels)
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
      await applyLabels(componentService, uid, labels)
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
    'api::ambassador.ambassador': [
      [{ name: 'name', size: 6 }, { name: 'slug', size: 6 }],
      [{ name: 'linkedinUrl', size: 6 }, { name: 'grantReportUrl', size: 6 }],
      [{ name: 'photo', size: 12 }],
      [{ name: 'description', size: 12 }]
    ]
  }

  const componentLayouts: Record<string, EditLayoutField[][]> = {
    'shared.hero': [
      [{ name: 'title', size: 12 }],
      [{ name: 'description', size: 6 }, { name: 'backgroundImage', size: 6 }],
      [{ name: 'secondaryCtas', size: 12 }]
    ],
    'shared.seo': [
      [{ name: 'metaTitle', size: 6 }, { name: 'canonicalUrl', size: 6 }],
      [{ name: 'metaDescription', size: 6 }, { name: 'keywords', size: 6 }],
      [{ name: 'metaImage', size: 12 }]
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
  async bootstrap({ strapi }) {
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

    // Ensure required locales (en, es) are installed
    await ensureLocales(strapi)

    // Configure pretty field labels for the admin panel
    await configureFieldLabels(strapi)
    await configureLayouts(strapi)
  }
}
