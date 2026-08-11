/**
 * Pure helpers for resolving which entry a Content Manager edit view
 * belongs to, and whether a browser draft should be applied.
 */
import {
  CREATE_DOCUMENT_ID,
  readDraft,
  stableStringify,
  type StoredDraft
} from './storage'

export function resolveLocale(
  document: { locale?: string } | undefined
): string {
  if (document?.locale) return document.locale
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('plugins[i18n][locale]') || params.get('locale') || 'en'
  } catch {
    return 'en'
  }
}

export function resolveDocumentId(
  documentIdFromProps: string | undefined,
  ctx: { id?: string; isCreatingEntry: boolean }
): string {
  if (documentIdFromProps) return documentIdFromProps
  if (ctx.id) return ctx.id
  if (ctx.isCreatingEntry) return CREATE_DOCUMENT_ID
  return 'unknown'
}

/**
 * Prefer a draft keyed to the current documentId; if editing an existing
 * entry and none exists, fall back to a leftover create-keyed draft
 * (e.g. create → save rekey not finished yet, or crash mid-create).
 */
export function selectStoredDraft(
  model: string,
  documentId: string,
  locale: string
): StoredDraft | null {
  const forId = readDraft(model, documentId, locale)
  if (forId) return forId
  if (documentId !== CREATE_DOCUMENT_ID) {
    return readDraft(model, CREATE_DOCUMENT_ID, locale)
  }
  return null
}

/** True when stored form values differ from what Strapi loaded as initialValues. */
export function draftDiffersFromInitial(
  draftValues: Record<string, unknown>,
  initialValues: Record<string, unknown> | undefined | null
): boolean {
  return stableStringify(draftValues) !== stableStringify(initialValues ?? {})
}
