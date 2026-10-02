import fs from 'fs'
import path from 'path'
import { gitCommitAndPush, getTargetRepoRoot, withGitSyncLock } from './gitSync'
import { LOCALES, defaultLang, uidToLogLabel } from './mdx'
import { shouldSkipMdxExport } from './pageLifecycle'
import { ensureLeadingSlash } from './relativeLinks'

import type { Core, UID, Modules } from '@strapi/strapi'

declare const strapi: Core.Strapi

export interface MenuItem {
  label: string
  href?: string | null
  openInNewTab?: boolean | null
}

export interface MenuSubGroup {
  label: string
  items?: MenuItem[] | null
}

export interface MenuGroup {
  label: string
  href?: string | null
  items?: MenuItem[] | null
  subGroups?: MenuSubGroup[] | null
}

export interface NavigationData {
  id?: number
  documentId?: string
  locale?: string
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

function normalizeHref(href: string | null | undefined): string | undefined {
  if (!href) return undefined
  return ensureLeadingSlash(href)
}

export function sanitizeMenuItem(
  item: MenuItem | null | undefined
): MenuItem | null {
  if (!item) return null
  const href = normalizeHref(item.href)
  return {
    label: item.label,
    ...(href ? { href } : {}),
    ...(item.openInNewTab ? { openInNewTab: true } : {})
  }
}

export function sanitizeMenuSubGroup(subGroup: MenuSubGroup): MenuSubGroup {
  const items =
    subGroup.items?.map(sanitizeMenuItem).filter(Boolean) ?? undefined
  return {
    label: subGroup.label,
    ...(items && items.length > 0 ? { items: items as MenuItem[] } : {})
  }
}

export function sanitizeMenuGroup(group: MenuGroup): MenuGroup {
  const items = group.items?.map(sanitizeMenuItem).filter(Boolean) ?? undefined
  const href = normalizeHref(group.href)
  const subGroups = group.subGroups?.map(sanitizeMenuSubGroup) ?? undefined
  return {
    label: group.label,
    ...(href ? { href } : {}),
    ...(items && items.length > 0 ? { items: items as MenuItem[] } : {}),
    ...(subGroups && subGroups.length > 0 ? { subGroups } : {})
  }
}

export function sanitizeNavigation(data: NavigationData) {
  return {
    mainMenu: (data.mainMenu || []).map(sanitizeMenuGroup),
    ...(data.ctaButton ? { ctaButton: sanitizeMenuItem(data.ctaButton) } : {})
  }
}

export function getLocaleOutputPath<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>,
  locale: string
): string {
  const projectRoot = getTargetRepoRoot()
  if (locale === defaultLang) {
    return path.join(projectRoot, config.outputPath)
  }
  return path.join(
    projectRoot,
    config.outputPath.replace(/\.json$/, `.${locale}.json`)
  )
}

function writeNavigationFile<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>,
  locale: string,
  data: NavigationData
): string {
  const outputPath = getLocaleOutputPath(config, locale)
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
      `✅ Wrote ${uidToLogLabel(config.contentTypeUid)} [${locale}] JSON: ${outputPath}`
    )
    return outputPath
  } catch (error) {
    console.error(
      `Failed to write ${uidToLogLabel(config.contentTypeUid)} [${locale}] navigation file: ${outputPath}`,
      error
    )
    throw error
  }
}

async function fetchPublishedNavigation<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>,
  locale: string
): Promise<NavigationData | null> {
  try {
    const navigation = await strapi.documents(config.contentTypeUid).findFirst({
      status: 'published',
      locale,
      populate: config.populate
    })
    return navigation as unknown as NavigationData | null
  } catch (error) {
    console.error(
      `Failed to fetch ${uidToLogLabel(config.contentTypeUid)} [${locale}] navigation:`,
      error
    )
    return null
  }
}

async function exportAllLocales<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>
): Promise<string[]> {
  const outputPaths: string[] = []
  const defaultNav = await fetchPublishedNavigation(config, defaultLang)

  for (const locale of LOCALES) {
    try {
      const navigation =
        locale === defaultLang
          ? defaultNav
          : ((await fetchPublishedNavigation(config, locale)) ?? defaultNav)

      if (!navigation) {
        console.log(
          `⏭️  No published ${uidToLogLabel(config.contentTypeUid)} [${locale}] navigation`
        )
        continue
      }

      const outputPath = writeNavigationFile(config, locale, navigation)
      outputPaths.push(outputPath)
    } catch (error) {
      console.error(
        `⚠️  Failed to export ${uidToLogLabel(config.contentTypeUid)} [${locale}] navigation:`,
        error
      )
    }
  }

  return outputPaths
}

function deleteNavigationFiles<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>
): string[] {
  const deletedPaths: string[] = []

  for (const locale of LOCALES) {
    const outputPath = getLocaleOutputPath(config, locale)
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath)
        console.log(
          `🗑️  Deleted ${uidToLogLabel(config.contentTypeUid)} [${locale}] JSON: ${outputPath}`
        )
        deletedPaths.push(outputPath)
      }
    } catch (error) {
      console.error(
        `Failed to delete ${uidToLogLabel(config.contentTypeUid)} [${locale}] navigation file: ${outputPath}`,
        error
      )
    }
  }

  return deletedPaths
}

/**
 * Runs a navigation file change and its commit as one critical section, so a
 * slower save can't write an older snapshot over a newer one and commit it
 * last. Failures are logged, not thrown: the entry is already saved, and the
 * next save rewrites the file from the database.
 */
async function underGitSyncLock(
  label: string,
  work: () => Promise<void>
): Promise<void> {
  const result = await withGitSyncLock(work)
  if (result instanceof Error) {
    console.error(`❌ Failed to export ${label} navigation:`, result)
  }
}

async function exportAndCommitNavigation<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>,
  action: string
): Promise<void> {
  // Read while the save's request is still current: the skip header lives on
  // its context, and a queued export may run well after it.
  if (shouldSkipMdxExport()) return
  const label = uidToLogLabel(config.contentTypeUid)
  await underGitSyncLock(label, async () => {
    console.log(`📝 ${action} ${label} JSON`)
    const outputPaths = await exportAllLocales(config)
    if (outputPaths.length > 0) {
      await gitCommitAndPush(
        outputPaths,
        `${label}: ${action.toLowerCase()} navigation`
      )
    }
  })
}

async function deleteAndCommitNavigation<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>
): Promise<void> {
  if (shouldSkipMdxExport()) return
  const label = uidToLogLabel(config.contentTypeUid)
  await underGitSyncLock(label, async () => {
    console.log(`🗑️  Deleting ${label} JSON`)
    const deletedPaths = deleteNavigationFiles(config)
    if (deletedPaths.length > 0) {
      await gitCommitAndPush(deletedPaths, `${label}: delete navigation`)
    }
  })
}

export function normalizeNavigationInput(data: NavigationData): void {
  data.mainMenu?.forEach((group) => {
    group.href = normalizeHref(group.href) ?? group.href
    group.items?.forEach((item) => {
      item.href = normalizeHref(item.href) ?? item.href
    })
    group.subGroups?.forEach((subGroup) => {
      subGroup.items?.forEach((item) => {
        item.href = normalizeHref(item.href) ?? item.href
      })
    })
  })
  if (data.ctaButton) {
    data.ctaButton.href =
      normalizeHref(data.ctaButton.href) ?? data.ctaButton.href
  }
}

interface BeforeEvent {
  params: { data: NavigationData }
}

export function createNavigationLifecycle<T extends UID.ContentType>(
  config: NavigationLifecycleConfig<T>
) {
  return {
    beforeCreate(event: BeforeEvent) {
      normalizeNavigationInput(event.params.data)
    },

    beforeUpdate(event: BeforeEvent) {
      normalizeNavigationInput(event.params.data)
    },

    async afterCreate(_event: Event) {
      await exportAndCommitNavigation(config, 'Create')
    },

    async afterUpdate(_event: Event) {
      await exportAndCommitNavigation(config, 'Update')
    },

    async afterDelete(_event: Event) {
      await deleteAndCommitNavigation(config)
    }
  }
}
