import fs from 'fs'
import path from 'path'
import { getProjectRoot } from '../../../src/utils/paths'
import { syncToGit } from './gitSync'
import { uidToLogLabel } from './mdx'

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
  const projectRoot = getProjectRoot()
  const outputPath = path.join(projectRoot, config.outputPath)
  const outputDir = path.dirname(outputPath)

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const payload = sanitizeNavigation(data)
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
    console.log(`✅ Wrote ${uidToLogLabel(config.contentTypeUid)} JSON: ${outputPath}`)
    return outputPath
  } catch (error) {
    console.error(`Failed to write ${uidToLogLabel(config.contentTypeUid)} navigation file: ${outputPath}`, error)
    throw error
  }
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
    console.error(`Failed to fetch ${uidToLogLabel(config.contentTypeUid)} navigation:`, error)
    return null
  }
}

async function deleteNavigationFile(config: NavigationLifecycleConfig): Promise<string | null> {
  const projectRoot = getProjectRoot()
  const outputPath = path.join(projectRoot, config.outputPath)
  try {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
      console.log(`🗑️  Deleted ${uidToLogLabel(config.contentTypeUid)} JSON: ${outputPath}`)
      return outputPath
    }
    return null
  } catch (error) {
    console.error(`Failed to delete ${uidToLogLabel(config.contentTypeUid)} navigation file: ${outputPath}`, error)
    throw error
  }
}

export function createNavigationLifecycle(config: NavigationLifecycleConfig) {
  return {
    async afterCreate(_event: Event) {
      console.log(`📝 Creating ${uidToLogLabel(config.contentTypeUid)} JSON`)
      const navigation = await fetchPublishedNavigation(config)
      if (!navigation) {
        console.log(`⏭️  No published ${uidToLogLabel(config.contentTypeUid)} navigation`)
        return
      }
      const outputPath = writeNavigationFile(config, navigation)
      await syncToGit(outputPath, `${uidToLogLabel(config.contentTypeUid)}: update navigation`)
    },

    async afterUpdate(_event: Event) {
      console.log(`📝 Updating ${uidToLogLabel(config.contentTypeUid)} JSON`)
      const navigation = await fetchPublishedNavigation(config)

      if (!navigation) {
        const deletedPath = await deleteNavigationFile(config)
        if (deletedPath) {
          await syncToGit(
            deletedPath,
            `${uidToLogLabel(config.contentTypeUid)}: unpublish navigation`
          )
        }
        return
      }

      const outputPath = writeNavigationFile(config, navigation)
      await syncToGit(outputPath, `${uidToLogLabel(config.contentTypeUid)}: update navigation`)
    },

    async afterDelete(_event: Event) {
      console.log(`🗑️  Deleting ${uidToLogLabel(config.contentTypeUid)} JSON`)
      const deletedPath = await deleteNavigationFile(config)
      if (deletedPath) {
        await syncToGit(deletedPath, `${uidToLogLabel(config.contentTypeUid)}: delete navigation`)
      }
    }
  }
}
