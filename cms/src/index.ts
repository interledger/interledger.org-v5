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

interface StrapiContentManagerService {
  findConfiguration: (options: { uid: string }) => Promise<{
    metadatas?: Record<string, FieldMetadata>
  } | null>
  updateConfiguration: (
    uidOptions: { uid: string },
    config: { metadatas: Record<string, FieldMetadata> }
  ) => Promise<void>
}

interface StrapiInstance {
  entityService: StrapiEntityService
  log: StrapiLogger
  plugin: (name: string) =>
    | {
        service: (serviceName: string) => StrapiContentManagerService
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
 */
async function configureFieldLabels(strapi: StrapiInstance) {
  // Map of content type UIDs to their field label configurations
  // All fields get human-readable labels for better UX
  const labelConfigs: Record<string, Record<string, string>> = {
    'api::blog-post.blog-post': {
      title: 'Title',
      description: 'Description',
      slug: 'URL Slug',
      date: 'Publish Date',
      lang: 'Language',
      featuredImage: 'Featured Image',
      ogImageUrl: 'OG Image URL',
      content: 'Content',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
      publishedAt: 'Published At'
    },
    'api::foundation-blog-post.foundation-blog-post': {
      title: 'Title',
      description: 'Description',
      slug: 'URL Slug',
      date: 'Publish Date',
      featuredImage: 'Featured Image',
      content: 'Content',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
      publishedAt: 'Published At'
    },
    'api::foundation-page.foundation-page': {
      title: 'Title',
      slug: 'URL Slug',
      path: 'Route Path (e.g. /grant/ambassadors)',
      pageType: 'Page Type (Grant, Policy, Developer)',
      seo: 'SEO',
      hero: 'Hero',
      content: 'Content',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
      publishedAt: 'Published At'
    },
    'api::summit-page.summit-page': {
      title: 'Title',
      slug: 'URL Slug',
      path: 'Route Path',
      pageType: 'Page Type (Hackathon, Hackathon Resource)',
      seo: 'SEO',
      hero: 'Hero',
      content: 'Content',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
      publishedAt: 'Published At'
    },
    'api::press-item.press-item': {
      title: 'Title',
      description: 'Description',
      publishDate: 'Publish Date',
      slug: 'URL Slug',
      publication: 'Publication Name',
      publicationLogo: 'Publication Logo URL',
      externalUrl: 'External URL',
      content: 'Content',
      featured: 'Featured',
      category: 'Category',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
      publishedAt: 'Published At'
    },
    'api::info-item.info-item': {
      title: 'Title',
      content: 'Content',
      order: 'Display Order',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
      publishedAt: 'Published At'
    }
  }

  for (const [uid, labels] of Object.entries(labelConfigs)) {
    if (Object.keys(labels).length === 0) continue

    try {
      // Get the content-manager plugin service
      const contentManagerService = strapi
        .plugin('content-manager')
        ?.service('content-types')
      if (!contentManagerService) continue

      // Get current configuration
      const configuration = await contentManagerService.findConfiguration({
        uid
      })
      if (!configuration?.metadatas) continue

      let needsUpdate = false
      const updatedMetadatas = { ...configuration.metadatas }

      for (const [fieldName, label] of Object.entries(labels)) {
        if (updatedMetadatas[fieldName]) {
          const currentEditLabel = updatedMetadatas[fieldName]?.edit?.label

          // Update if label is default (same as field name, case-insensitive), empty, or not set
          const isDefaultLabel =
            !currentEditLabel ||
            currentEditLabel === fieldName ||
            currentEditLabel.toLowerCase() === fieldName.toLowerCase()

          if (isDefaultLabel && currentEditLabel !== label) {
            updatedMetadatas[fieldName] = {
              ...updatedMetadatas[fieldName],
              edit: {
                ...updatedMetadatas[fieldName]?.edit,
                label
              },
              list: {
                ...updatedMetadatas[fieldName]?.list,
                label
              }
            }
            needsUpdate = true
          }
        }
      }

      if (needsUpdate) {
        await contentManagerService.updateConfiguration(
          { uid },
          { metadatas: updatedMetadatas }
        )
        strapi.log.info(`✅ Updated field labels for ${uid}`)
      }
    } catch (error) {
      // Log but don't fail - configuration might not exist yet
      strapi.log.debug(`Could not update labels for ${uid}: ${error.message}`)
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
  }
}
