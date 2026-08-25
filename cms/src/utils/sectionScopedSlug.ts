/**
 * Uniqueness check for content types whose `pathSlug` is section-relative.
 *
 * faqs, profiles and reports all live in one flat collection but route under
 * different URL trees, so `/faq` and `/hackathon/faq` are both pathSlug `faq`.
 * A plain `unique: true` on pathSlug therefore rejects a legitimate second
 * section, which is what kept the foundation FAQ out of Strapi (INTORG-1132).
 *
 * The real constraint is the pair: within one locale, a section may hold a
 * given pathSlug once. Two entries that share both would collide in the URL
 * and in the flat MDX filename, so reject the second one here instead.
 */

import { errors } from '@strapi/utils'

/** The slice of the Strapi document service this check needs. */
export interface SectionScopedSlugFinder {
  findMany: (options: Record<string, unknown>) => Promise<unknown[]>
  findOne: (options: Record<string, unknown>) => Promise<unknown>
}

interface SlugAndSection {
  pathSlug?: unknown
  section?: unknown
  documentId?: unknown
}

export interface SectionScopedSlugCheck {
  documents: SectionScopedSlugFinder
  /** Raw `ctx.params.data` from the document-service middleware. */
  data: Record<string, unknown>
  /** Present on update, absent on create. */
  documentId?: string
  /** Locale being written. Defaults to the caller's default locale. */
  locale?: string
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Resolve the pathSlug and section this write ends up with.
 *
 * An admin update sends a partial patch, so a field the editor did not touch
 * is absent from `data`. Read the missing half off the stored entry, otherwise
 * a rename would compare against an empty section and never find its twin.
 */
async function resolveEffectivePair(
  check: SectionScopedSlugCheck
): Promise<{ pathSlug?: string; section?: string }> {
  const fromData = {
    pathSlug: asString(check.data.pathSlug),
    section: asString(check.data.section)
  }

  if (!check.documentId || (fromData.pathSlug && fromData.section)) {
    return fromData
  }

  const stored = (await check.documents.findOne({
    documentId: check.documentId,
    locale: check.locale,
    fields: ['pathSlug', 'section']
  })) as SlugAndSection | null

  return {
    pathSlug: fromData.pathSlug ?? asString(stored?.pathSlug),
    section: fromData.section ?? asString(stored?.section)
  }
}

/**
 * Reject a write that would give one section two entries with the same
 * pathSlug in the same locale. Returns undefined when the write is fine.
 */
export async function validateSectionScopedSlug(
  check: SectionScopedSlugCheck
): Promise<errors.ValidationError | undefined> {
  const { pathSlug, section } = await resolveEffectivePair(check)

  // A missing pathSlug or section is the `required` validator's job, not ours.
  if (!pathSlug || !section) return undefined

  const conflicts = (await check.documents.findMany({
    filters: { pathSlug, section },
    locale: check.locale,
    fields: ['pathSlug', 'section'],
    status: 'draft',
    limit: 2
  })) as SlugAndSection[]

  const other = conflicts.find(
    (entry) => asString(entry.documentId) !== check.documentId
  )
  if (!other) return undefined

  const message = `Path Slug "${pathSlug}" is already used by another ${section} entry. Path Slug must be unique within a Section.`
  return new errors.ValidationError(message, {
    errors: [{ path: ['pathSlug'], message, name: 'ValidationError' }]
  })
}
