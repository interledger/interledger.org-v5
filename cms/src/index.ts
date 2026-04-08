import * as fs from 'fs'
import * as path from 'path'
import { validateGitSyncRepoOnStartup } from './utils/gitSync'
import { validateNoNestedJsx } from './utils/contentValidation'
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

interface StrapiInstance {
  documents: (uid: string) => StrapiDocumentService
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
      pathSlug: 'URL Slug',
      description: 'Description',
      photo: 'Photo',
      linkedinUrl: 'LinkedIn URL',
      grantReportUrl: 'Grant Report URL'
    },
    'api::foundation-blog-post.foundation-blog-post': {
      title: 'Title',
      description: 'Description',
      pathSlug: 'Full Path Slug',
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
    }
  }

  const contentTypeDescriptions: Record<string, Record<string, string>> = {
    'api::foundation-page.foundation-page': {
      pathSlug:
        'Path relative to the site root (/). Examples: about-us → /about-us; grant/grant-for-web → /grant/grant-for-web. No leading slash.'
    },
    'api::summit-page.summit-page': {
      pathSlug:
        'Path relative to /summit/. Examples: faq → /summit/faq; schedule → /summit/schedule. Do not include /summit/ or a leading slash.'
    },
    'api::foundation-blog-post.foundation-blog-post': {
      pathSlug:
        'Path relative to /blog/. Example: my-article-title → /blog/my-article-title. Do not include /blog/ or a leading slash.'
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
      author: 'Author Name',
      profileBio: 'Author Bio',
      profileImage: 'Profile Photo'
    },
    'shared.hero': {
      title: 'Hero Title',
      description: 'Hero Description',
      backgroundImage: 'Background Image',
      secondaryCtas: 'Secondary Buttons'
    },
    'shared.seo': {
      metaDescription: 'Meta Description'
    },
    'blocks.ambassador': {
      ambassador: 'Ambassador',
      showLinks: 'Show Social Links'
    },
    'blocks.ambassadors-grid': {
      heading: 'Heading',
      ambassadors: 'Ambassadors'
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
      external: 'External Link',
      analytics_event_label: 'Analytics Event Label'
    },
    'blocks.paragraph': {
      content: 'Content',
      alignment: 'Alignment'
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
    'blocks.carousel': {
      heading: 'Section Heading',
      items: 'Slides',
      autoplay: 'Autoplay',
      interval: 'Autoplay Interval (ms)'
    },
    'blocks.carousel-item': {
      quote: 'Quote',
      author: 'Author Name',
      role: 'Job Title',
      organization: 'Organization',
      image: 'Photo'
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
    'blocks.image-row': {
      heading: 'Heading',
      content: 'Content',
      image: 'Image',
      imagePosition: 'Image Position',
      attribution: 'Image Attribution'
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
    'api::foundation-blog-post.foundation-blog-post': [
      [{ name: 'title', size: 12 }],
      [{ name: 'pathSlug', size: 12 }],
      [
        { name: 'date', size: 4 },
        { name: 'pillar', size: 4 },
        { name: 'language', size: 4 }
      ],
      [
        { name: 'featureImage', size: 6 },
        { name: 'thumbnailImage', size: 6 }
      ],
      [{ name: 'description', size: 12 }],
      [{ name: 'content', size: 12 }],
      [{ name: 'articleBio', size: 12 }],
      [{ name: 'tags', size: 12 }]
    ],
    'api::ambassador.ambassador': [
      [
        { name: 'name', size: 6 },
        { name: 'pathSlug', size: 6 }
      ],
      [
        { name: 'linkedinUrl', size: 6 },
        { name: 'grantReportUrl', size: 6 }
      ],
      [{ name: 'photo', size: 12 }],
      [{ name: 'description', size: 12 }]
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
      [{ name: 'author', size: 6 }],
      [
        { name: 'profileImage', size: 6 },
        { name: 'profileBio', size: 6 }
      ]
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
      [{ name: 'items', size: 12 }],
      [
        { name: 'autoplay', size: 4 },
        { name: 'interval', size: 4 }
      ]
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
    'shared.hero': [
      [{ name: 'title', size: 12 }],
      [
        { name: 'description', size: 6 },
        { name: 'backgroundImage', size: 6 }
      ],
      [{ name: 'secondaryCtas', size: 12 }]
    ],
    'shared.seo': [[{ name: 'metaDescription', size: 12 }]]
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
  async bootstrap({
    strapi
  }: {
    strapi: StrapiInstance & {
      server?: { use?: (middleware: unknown) => void }
    }
  }) {
    // Validate paragraph content on save — reject nested JSX before it reaches the DB.
    // Registered as Koa middleware so errors return a proper 400 with message in the UI.
    const CONTENT_MANAGER_PATTERN =
      /^\/content-manager\/collection-types\/api::/
    strapi.server?.use?.(
      async (
        ctx: {
          method?: string
          url?: string
          request?: { body?: { content?: unknown } }
          status?: number
          body?: unknown
        },
        next: () => Promise<void>
      ) => {
        if (
          (ctx.method === 'PUT' || ctx.method === 'POST') &&
          CONTENT_MANAGER_PATTERN.test(ctx.url ?? '')
        ) {
          try {
            validateNoNestedJsx(ctx.request?.body?.content)
          } catch (err: unknown) {
            ctx.status = 400
            ctx.body = {
              data: null,
              error: {
                status: 400,
                name: 'ValidationError',
                message: err instanceof Error ? err.message : String(err)
              }
            }
            return
          }
        }
        await next()
      }
    )

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
