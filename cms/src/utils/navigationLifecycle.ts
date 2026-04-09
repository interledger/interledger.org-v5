import fs from 'fs'
import path from 'path'
import { gitCommitAndPush, getTargetRepoRoot } from './gitSync'
import { LOCALES, defaultLang, uidToLogLabel } from './mdx'
import { shouldSkipMdxExport } from './pageLifecycle'

import type { StrapiGlobal } from './strapiTypes'

declare const strapi: StrapiGlobal

export interface MenuItem {
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

export function sanitizeMenuItem(
  item: MenuItem | null | undefined
): MenuItem | null {
  if (!item) return null
  return {
    label: item.label,
    ...(item.href ? { href: item.href } : {}),
    ...(item.openInNewTab ? { openInNewTab: true } : {})
  }
}

export function sanitizeMenuGroup(group: MenuGroup): MenuGroup {
  const items = group.items?.map(sanitizeMenuItem).filter(Boolean) ?? undefined
  return {
    label: group.label,
    ...(group.href ? { href: group.href } : {}),
    ...(items && items.length > 0 ? { items: items as MenuItem[] } : {})
  }
}

export function sanitizeNavigation(data: NavigationData) {
  return {
    mainMenu: (data.mainMenu || []).map(sanitizeMenuGroup),
    ...(data.ctaButton ? { ctaButton: sanitizeMenuItem(data.ctaButton) } : {})
  }
}

export function getLocaleOutputPath(
  config: NavigationLifecycleConfig,
  locale: string
): string {
  const projectRoot = getTargetRepoRoot()
  return path.join(
    projectRoot,
    config.outputPath.replace(/\.json$/, `.${locale}.json`)
  )
}

function writeNavigationFile(
  config: NavigationLifecycleConfig,
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

async function fetchPublishedNavigation(
  config: NavigationLifecycleConfig,
  locale: string
): Promise<NavigationData | null> {
  try {
    const navigation = await strapi.documents(config.contentTypeUid).findFirst({
      status: 'published',
      locale,
      populate: {
        mainMenu: { populate: { items: true } },
        ctaButton: true
      }
    })
    return navigation as NavigationData | null
  } catch (error) {
    console.error(
      `Failed to fetch ${uidToLogLabel(config.contentTypeUid)} [${locale}] navigation:`,
      error
    )
    return null
  }
}

async function exportAllLocales(
  config: NavigationLifecycleConfig
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

function deleteNavigationFiles(config: NavigationLifecycleConfig): string[] {
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

export function createNavigationLifecycle(config: NavigationLifecycleConfig) {
  return {
    async afterCreate(_event: Event) {
      if (shouldSkipMdxExport()) return
      console.log(`📝 Creating ${uidToLogLabel(config.contentTypeUid)} JSON`)
      const outputPaths = await exportAllLocales(config)
      if (outputPaths.length > 0) {
        await gitCommitAndPush(
          outputPaths,
          `${uidToLogLabel(config.contentTypeUid)}: update navigation`
        )
      }
    },

    async afterDelete(_event: Event) {
      if (shouldSkipMdxExport()) return
      console.log(`🗑️  Deleting ${uidToLogLabel(config.contentTypeUid)} JSON`)
      const deletedPaths = deleteNavigationFiles(config)
      if (deletedPaths.length > 0) {
        await gitCommitAndPush(
          deletedPaths,
          `${uidToLogLabel(config.contentTypeUid)}: delete navigation`
        )
      }
    }
  }
}
