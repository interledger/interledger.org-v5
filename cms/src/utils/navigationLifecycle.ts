import fs from 'fs'
import path from 'path'
import { syncToGit } from './gitSync'

interface MenuItem {
  label: string
  href?: string | null
  openInNewTab?: boolean | null
}

interface MenuGroup {
  label: string
  href?: string | null
  items?: MenuItem[] | null
}

interface NavigationData {
  id?: number
  documentId?: string
  mainMenu?: MenuGroup[]
  ctaButton?: MenuItem | null
  publishedAt?: string | null
}

interface Event {
  result?: NavigationData
}

export interface NavigationLifecycleConfig {
  contentTypeUid: string
  outputPath: string
  logPrefix: string
}

function sanitizeMenuItem(item: MenuItem | null | undefined): MenuItem | null {
  if (!item) return null
  return {
    label: item.label,
    ...(item.href ? { href: item.href } : {}),
    ...(item.openInNewTab ? { openInNewTab: true } : {})
  }
}

function sanitizeMenuGroup(group: MenuGroup): MenuGroup {
  const items =
    group.items?.map(sanitizeMenuItem).filter(Boolean) ?? undefined
  return {
    label: group.label,
    ...(group.href ? { href: group.href } : {}),
    ...(items && items.length > 0 ? { items: items as MenuItem[] } : {})
  }
}

function sanitizeNavigation(data: NavigationData) {
  return {
    mainMenu: (data.mainMenu || []).map(sanitizeMenuGroup),
    ...(data.ctaButton ? { ctaButton: sanitizeMenuItem(data.ctaButton) } : {})
  }
}

function writeNavigationFile(config: NavigationLifecycleConfig, data: NavigationData): string {
  const projectRoot = path.resolve(process.cwd(), '..')
  const outputPath = path.join(projectRoot, config.outputPath)
  const outputDir = path.dirname(outputPath)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const payload = sanitizeNavigation(data)
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
  console.log(`✅ Wrote ${config.logPrefix} JSON: ${outputPath}`)
  return outputPath
}

async function fetchPublishedNavigation(
  config: NavigationLifecycleConfig
): Promise<NavigationData | null> {
  try {
    const navigation = await strapi.documents(config.contentTypeUid as any).findFirst({
      status: 'published',
      populate: {
        mainMenu: { populate: { items: true } },
        ctaButton: true
      }
    })
    return navigation as NavigationData | null
  } catch (error) {
    console.error(`Failed to fetch ${config.logPrefix} navigation:`, error)
    return null
  }
}

async function deleteNavigationFile(config: NavigationLifecycleConfig): Promise<string | null> {
  const projectRoot = path.resolve(process.cwd(), '..')
  const outputPath = path.join(projectRoot, config.outputPath)
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath)
    console.log(`🗑️  Deleted ${config.logPrefix} JSON: ${outputPath}`)
    return outputPath
  }
  return null
}

export function createNavigationLifecycle(config: NavigationLifecycleConfig) {
  return {
    async afterCreate(_event: Event) {
      console.log(`📝 Creating ${config.logPrefix} JSON`)
      const navigation = await fetchPublishedNavigation(config)
      if (!navigation) {
        console.log(`⏭️  No published ${config.logPrefix} navigation`)
        return
      }
      const outputPath = writeNavigationFile(config, navigation)
      await syncToGit(outputPath, `${config.logPrefix}: update navigation`)
    },

    async afterUpdate(_event: Event) {
      console.log(`📝 Updating ${config.logPrefix} JSON`)
      const navigation = await fetchPublishedNavigation(config)

      if (!navigation) {
        const deletedPath = await deleteNavigationFile(config)
        if (deletedPath) {
          await syncToGit(
            deletedPath,
            `${config.logPrefix}: unpublish navigation`
          )
        }
        return
      }

      const outputPath = writeNavigationFile(config, navigation)
      await syncToGit(outputPath, `${config.logPrefix}: update navigation`)
    },

    async afterDelete(_event: Event) {
      console.log(`🗑️  Deleting ${config.logPrefix} JSON`)
      const deletedPath = await deleteNavigationFile(config)
      if (deletedPath) {
        await syncToGit(deletedPath, `${config.logPrefix}: delete navigation`)
      }
    }
  }
}
