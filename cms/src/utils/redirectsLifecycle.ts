import fs from 'fs'
import path from 'path'
import { gitCommitAndPush, getTargetRepoRoot, withGitSyncLock } from './gitSync'
import { shouldSkipMdxExport } from './pageLifecycle'
import { PATHS } from './paths'
import { serializeRedirectConfig, type RedirectEntry } from './redirects'

import type { Core } from '@strapi/strapi'

declare const strapi: Core.Strapi

const REDIRECT_UID = 'api::redirect.redirect'
/** Rows per query while reading every redirect back for export. */
const EXPORT_PAGE_SIZE = 500

interface RedirectEvent {
  result?: { source?: string }
}

async function fetchAllRedirects(): Promise<RedirectEntry[]> {
  const entries: RedirectEntry[] = []
  for (let start = 0; ; start += EXPORT_PAGE_SIZE) {
    const page = (await strapi.documents(REDIRECT_UID).findMany({
      fields: [
        'source',
        'destination',
        'category',
        'redirectType',
        'enabled',
        'note'
      ],
      sort: 'source:asc',
      start,
      limit: EXPORT_PAGE_SIZE
    })) as unknown as RedirectEntry[]
    entries.push(...page)
    if (page.length < EXPORT_PAGE_SIZE) return entries
  }
}

function writeRedirectsFile(entries: RedirectEntry[]): string {
  const outputPath = path.join(
    getTargetRepoRoot(),
    PATHS.CONFIG_ROOT,
    PATHS.CONFIG.redirects
  )
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const config = serializeRedirectConfig(entries)
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
  console.log(`✅ Wrote ${entries.length} redirects: ${outputPath}`)
  return outputPath
}

/**
 * Rewrites the whole file from the database rather than patching one entry,
 * so the file can never drift from what editors see in the admin.
 */
async function exportAndCommitRedirects(
  action: 'add' | 'update' | 'delete',
  event: RedirectEvent
): Promise<void> {
  try {
    const outputPath = writeRedirectsFile(await fetchAllRedirects())
    const subject = event.result?.source ?? 'redirects'
    await gitCommitAndPush(outputPath, `redirect: ${action} ${subject}`)
  } catch (error) {
    // Don't fail the editor's save over the export — the entry is stored, and
    // the next save rewrites the file from the database anyway.
    console.error('❌ Failed to export redirects:', error)
  }
}

/**
 * Holds the checkout lock across the database read, the file write and the
 * commit. Every export writes the same file, so a slower save could otherwise
 * write an older snapshot and commit it last, dropping the other edit. Under
 * the lock each export reads the database only once the previous one has
 * committed, so the last file written is always the latest state.
 */
async function queueExport(
  action: 'add' | 'update' | 'delete',
  event: RedirectEvent
): Promise<void> {
  // Read while the save's request is still the current one: the skip header
  // lives on its context, and a queued export may run well after it.
  if (shouldSkipMdxExport()) return
  // exportAndCommitRedirects catches its own failures, so this never errors.
  await withGitSyncLock(() => exportAndCommitRedirects(action, event))
}

export function createRedirectsLifecycle() {
  return {
    async afterCreate(event: RedirectEvent) {
      await queueExport('add', event)
    },

    async afterUpdate(event: RedirectEvent) {
      await queueExport('update', event)
    },

    async afterDelete(event: RedirectEvent) {
      await queueExport('delete', event)
    },

    // Editors can't delete (see redirectDeleteError), but a developer removing
    // rows from the Strapi console still has to leave the file in step.
    async afterDeleteMany() {
      await queueExport('delete', {})
    }
  }
}
