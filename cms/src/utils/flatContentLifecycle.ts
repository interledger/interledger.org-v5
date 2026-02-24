/**
 * Factory for flat (non-page) Strapi lifecycle hooks.
 * Handles MDX file writes, deletes, and git commits for content types
 * with flat frontmatter (no dynamic zones, no hero/SEO components).
 * Used by ambassador and similar non-page content types.
 */

import fs from 'fs'
import path from 'path'
import { shouldSkipMdxExport } from './pageLifecycle'
import { gitCommitAndPush } from './gitSync'

export interface FlatContentLifecycleConfig<
  T extends { slug: string; name?: string; locale?: string; publishedAt?: string }
> {
  /** Generates the full MDX file content string for the given entry. */
  generateContent: (entry: T) => string
  /** Returns the output directory for the given locale (undefined = English). */
  getBaseDir: (locale?: string) => string
  /** Label used in log messages and git commit messages, e.g. 'ambassador'. */
  label: string
}

async function writeMdxFile<
  T extends { slug: string; name?: string; locale?: string; publishedAt?: string }
>(config: FlatContentLifecycleConfig<T>, entry: T): Promise<string> {
  const baseDir = config.getBaseDir(entry.locale)
  const filepath = path.join(baseDir, `${entry.slug}.mdx`)
  await fs.promises.mkdir(baseDir, { recursive: true })
  await fs.promises.writeFile(filepath, config.generateContent(entry), 'utf-8')
  console.log(`✅ Generated ${config.label} MDX file: ${filepath}`)
  return filepath
}

async function deleteMdxFile<
  T extends { slug: string; name?: string; locale?: string; publishedAt?: string }
>(config: FlatContentLifecycleConfig<T>, entry: T): Promise<string> {
  const baseDir = config.getBaseDir(entry.locale)
  const filepath = path.join(baseDir, `${entry.slug}.mdx`)
  try {
    await fs.promises.unlink(filepath)
    console.log(`🗑️  Deleted ${config.label} MDX file: ${filepath}`)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`❌ Failed to delete ${config.label} MDX file: ${filepath}`, error)
      throw error
    }
  }
  return filepath
}

/**
 * Creates Strapi lifecycle hooks for a flat content type.
 * afterCreate: writes MDX + git commit when entry is published.
 * afterUpdate: writes MDX + git commit when published, deletes when unpublished.
 * afterDelete: deletes MDX + git commit.
 */
export function createFlatContentLifecycle<
  T extends { slug: string; name?: string; locale?: string; publishedAt?: string }
>(config: FlatContentLifecycleConfig<T>) {
  return {
    async afterCreate(event: { result?: T }) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (result && result.publishedAt) {
        const filepath = await writeMdxFile(config, result)
        await gitCommitAndPush(filepath, `${config.label}: add "${result.name ?? result.slug}"`)
      }
    },

    async afterUpdate(event: { result?: T }) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      if (result.publishedAt) {
        const filepath = await writeMdxFile(config, result)
        await gitCommitAndPush(filepath, `${config.label}: update "${result.name ?? result.slug}"`)
      } else {
        const filepath = await deleteMdxFile(config, result)
        await gitCommitAndPush(filepath, `${config.label}: unpublish "${result.name ?? result.slug}"`)
      }
    },

    async afterDelete(event: { result?: T }) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      const filepath = await deleteMdxFile(config, result)
      await gitCommitAndPush(filepath, `${config.label}: delete "${result.name ?? result.slug}"`)
    }
  }
}
