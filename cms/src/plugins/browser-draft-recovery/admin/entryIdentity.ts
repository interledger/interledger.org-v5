import { CREATE_DOCUMENT_ID, stableStringify } from './storage'

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

export function draftDiffersFromInitial(
  draftValues: Record<string, unknown>,
  initialValues: Record<string, unknown> | undefined | null
): boolean {
  return stableStringify(draftValues) !== stableStringify(initialValues ?? {})
}

/**
 * Existing entries must wait for CM initialValues so we do not restore over an
 * empty shell before the API payload arrives. Create forms start empty.
 */
export function hasLoadedInitialValues(
  documentId: string,
  initialValues: Record<string, unknown> | undefined
): boolean {
  if (documentId === CREATE_DOCUMENT_ID) return true
  return Object.keys(initialValues ?? {}).length > 0
}
