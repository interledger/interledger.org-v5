import fs from 'fs'
import path from 'path'
import { gitCommitAndPush, getTargetRepoRoot } from './gitSync'
import { uidToLogLabel } from './mdx'
import { shouldSkipMdxExport } from './pageLifecycle'

import type { Core, UID, Modules } from '@strapi/strapi'

declare const strapi: Core.Strapi

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

export interface NavigationLifecycleConfig<
  T extends UID.ContentType = UID.ContentType
> {
  contentTypeUid: T
  outputPath: string
  populate: Modules.Documents.Params.Populate.Any<T>
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
  const items = group.items?.map(sanitizeMenuItem).filter(Boolean) ?? undefined
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

function writeNavigationFile<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>,
  data: NavigationData
): string {
  const projectRoot = getTargetRepoRoot()
  const outputPath = path.join(projectRoot, config.outputPath)
  const outputDir = path.dirname(outputPath)

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const payload = sanitizeNavigation(data)
    fs.writeFileSync(
      outputPath,
      JSON.stringify(payload, null, 2) + '\n',
      'utf-8'
    )
    console.log(
      `✅ Wrote ${uidToLogLabel(config.contentTypeUid)} JSON: ${outputPath}`
    )
    return outputPath
  } catch (error) {
    console.error(
      `Failed to write ${uidToLogLabel(config.contentTypeUid)} navigation file: ${outputPath}`,
      error
    )
    throw error
  }
}

async function fetchPublishedNavigation<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>
): Promise<NavigationData | null> {
  try {
    const navigation = await strapi.documents(config.contentTypeUid).findFirst({
      status: 'published',
      populate: config.populate
    })
    return navigation as unknown as NavigationData | null
  } catch (error) {
    console.error(
      `Failed to fetch ${uidToLogLabel(config.contentTypeUid)} navigation:`,
      error
    )
    return null
  }
}

async function deleteNavigationFile<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>
): Promise<string | null> {
  const projectRoot = getTargetRepoRoot()
  const outputPath = path.join(projectRoot, config.outputPath)
  try {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
      console.log(
        `🗑️  Deleted ${uidToLogLabel(config.contentTypeUid)} JSON: ${outputPath}`
      )
      return outputPath
    }
    return null
  } catch (error) {
    console.error(
      `Failed to delete ${uidToLogLabel(config.contentTypeUid)} navigation file: ${outputPath}`,
      error
    )
    throw error
  }
}

async function exportAndCommitNavigation<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>,
  action: string
): Promise<void> {
  if (shouldSkipMdxExport()) return
  const label = uidToLogLabel(config.contentTypeUid)
  console.log(`📝 ${action} ${label} JSON`)
  const navigation = await fetchPublishedNavigation(config)
  if (!navigation) {
    console.log(`⏭️  No published ${label} navigation`)
    return
  }
  const outputPath = writeNavigationFile(config, navigation)
  await gitCommitAndPush(
    [outputPath],
    `${label}: ${action.toLowerCase()} navigation`
  )
}

export function createNavigationLifecycle<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>
) {
  return {
    async afterCreate(_event: Event) {
      await exportAndCommitNavigation(config, 'Create')
    },

    async afterUpdate(_event: Event) {
      await exportAndCommitNavigation(config, 'Update')
    },

    async afterDelete(_event: Event) {
      if (shouldSkipMdxExport()) return
      console.log(`🗑️  Deleting ${uidToLogLabel(config.contentTypeUid)} JSON`)
      const deletedPath = await deleteNavigationFile(config)
      if (deletedPath) {
        await gitCommitAndPush(
          [deletedPath],
          `${uidToLogLabel(config.contentTypeUid)}: delete navigation`
        )
      }
    }
  }
}
