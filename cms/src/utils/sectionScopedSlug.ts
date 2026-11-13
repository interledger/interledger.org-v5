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
import { slugVariants } from './relativeLinks'
import { defaultLang } from './locales'

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

  // No `status` filter: these content types set draftAndPublish false, so
  // every row is the stored row and a status would only narrow the search
  // that has to see everything. `documentId` comes back regardless of
  // `fields`, which is what lets an entry recognize itself below.
  // Two rows are enough: at most one of them can be this entry.
  const conflicts = (await check.documents.findMany({
    filters: { pathSlug: { $in: slugVariants(pathSlug) }, section },
    locale: check.locale,
    fields: ['pathSlug', 'section'],
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

/**
 * Reject a write whose pathSlug another entry of the same type already holds
 * in this locale, whichever form either side is stored in.
 *
 * For content types with a plain `unique: true` pathSlug. Strapi's own check
 * compares exact strings, so while some rows still hold `about` and the save
 * hook stores `/about/` (INTORG-1254), it lets a second page claim the same
 * route and the same MDX file. Returns undefined when the write is fine.
 */
export async function validateUniqueSlug(
  check: SectionScopedSlugCheck
): Promise<errors.ValidationError | undefined> {
  const pathSlug = asString(check.data.pathSlug)
  // Absent on a partial update that leaves the slug alone, so nothing moved.
  if (!pathSlug) return undefined

  const conflicts = (await check.documents.findMany({
    filters: { pathSlug: { $in: slugVariants(pathSlug) } },
    locale: check.locale,
    fields: ['pathSlug'],
    limit: 2
  })) as SlugAndSection[]

  const other = conflicts.find(
    (entry) => asString(entry.documentId) !== check.documentId
  )
  if (!other) return undefined

  const message = `Path Slug "${pathSlug}" is already used by another entry.`
  return new errors.ValidationError(message, {
    errors: [{ path: ['pathSlug'], message, name: 'ValidationError' }]
  })
}

export interface CrossCollectionSlugCheck {
  /** Document service of the *other* collection that shares the URL tree. */
  otherDocuments: SectionScopedSlugFinder
  /** Shown in the error, e.g. "Grant Page". */
  otherLabel: string
  /** Raw `ctx.params.data` from the document-service middleware. */
  data: Record<string, unknown>
  /** Locale being written. Defaults to the default locale. */
  locale?: string
}

/**
 * Reject a write whose pathSlug an entry of a *different* content type already
 * routes to in this locale, when both types share a URL prefix (grant pages
 * and grant overview pages both live under /grant/). Being a different
 * collection, no row can be this entry, so no documentId is needed.
 */
export async function validateSlugFreeInOtherCollection(
  check: CrossCollectionSlugCheck
): Promise<errors.ValidationError | undefined> {
  const pathSlug = asString(check.data.pathSlug)
  // Absent on a partial update that leaves the slug alone, so nothing moved.
  if (!pathSlug) return undefined

  const locale = check.locale ?? defaultLang
  const filters = { pathSlug: { $in: slugVariants(pathSlug) } }

  const sameLocale = await check.otherDocuments.findMany({
    filters,
    locale,
    fields: ['pathSlug'],
    limit: 1
  })
  if (sameLocale.length > 0) {
    return crossCollectionSlugError(
      `Path Slug "${pathSlug}" is already used by a ${check.otherLabel}. Slugs must be unique across both collections.`
    )
  }

  if (locale === defaultLang) return undefined
  if (!(await isEnglishFallbackRoute(check.otherDocuments, filters, locale))) {
    return undefined
  }
  return crossCollectionSlugError(
    `Path Slug "${pathSlug}" is already used by an English ${check.otherLabel} with no ${locale} version. The site shows that page at the ${locale} URL too, so the two would share one address.`
  )
}

/**
 * True when an English entry holds the slug and has no row in `locale`. The
 * site builds a localized route for such an entry from its English slug
 * (`getLocalizedPaths`), so the slug is taken in `locale` as well.
 */
async function isEnglishFallbackRoute(
  documents: SectionScopedSlugFinder,
  filters: Record<string, unknown>,
  locale: string
): Promise<boolean> {
  const englishMatches = (await documents.findMany({
    filters,
    locale: defaultLang,
    fields: ['pathSlug']
  })) as Array<{ documentId?: unknown }>

  for (const entry of englishMatches) {
    const documentId = asString(entry.documentId)
    if (!documentId) continue
    const translation = await documents.findOne({
      documentId,
      locale,
      fields: ['pathSlug']
    })
    if (!translation) return true
  }
  return false
}

function crossCollectionSlugError(message: string): errors.ValidationError {
  return new errors.ValidationError(message, {
    errors: [{ path: ['pathSlug'], message, name: 'ValidationError' }]
  })
}
