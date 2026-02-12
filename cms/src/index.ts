// Load environment variables from root .env
// This must run BEFORE any config files are loaded
import dotenv from 'dotenv'
import path from 'path'
import { getCmsDir, getProjectRoot, PATHS } from './utils/paths'

// Load .env from project root (one level up from cms directory)
const envPath = path.join(getProjectRoot(), '.env')
const result = dotenv.config({ path: envPath })

if (result.error) {
  console.warn(`⚠️  Warning: Could not load .env from ${envPath}`)
  console.warn(`   Error: ${result.error.message}`)
}

import fs from 'fs'
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

/**
 * Ensure required locales exist in Strapi.
 * Creates locales defined in LOCALES constant if they don't exist.
 */
async function ensureLocales(strapi: any) {
  const localeConfigs: Record<string, string> = {
    en: 'English (en)',
    es: 'Spanish (es)'
  }

  for (const localeCode of LOCALES) {
    try {
      // Check if locale exists using entity service
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
      const displayName = localeConfigs[localeCode] || `${localeCode.toUpperCase()} (${localeCode})`
      await strapi.entityService.create('plugin::i18n.locale', {
        data: {
          code: localeCode,
          name: displayName
        }
      })
      strapi.log.info(`✅ Created locale: ${displayName}`)
    } catch (error: any) {
      // Log but don't fail - locale might already exist or there might be a permission issue
      if (error.message?.includes('already exists') || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        strapi.log.debug(`Locale ${localeCode} already exists (checked via error)`)
      } else {
        strapi.log.warn(`⚠️  Could not create locale ${localeCode}: ${error.message}`)
      }
    }
  }
}

/**
 * Configure pretty labels for field names in the admin panel.
 * This updates the content-manager metadata stored in the database.
 */
async function configureFieldLabels(strapi: any) {
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
    const dbPath = path.resolve(getCmsDir(), PATHS.DB_FILE)
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true, mode: 0o775 })
    } else {
      // Ensure directory has write permissions
      try {
        fs.chmodSync(dbDir, 0o775)
      } catch (error) {
        // Ignore permission errors if we can't change them
      }
    }

    // If database file exists, ensure it has write permissions
    if (fs.existsSync(dbPath)) {
      try {
        fs.chmodSync(dbPath, 0o664)
      } catch (error) {
        // Ignore permission errors if we can't change them
      }
    }

    // Ensure required locales exist
    await ensureLocales(strapi)

    // Configure pretty field labels for the admin panel
    await configureFieldLabels(strapi)
  }
}
