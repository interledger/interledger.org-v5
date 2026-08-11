/** localStorage key prefix for Content Manager browser drafts. */
export const STORAGE_PREFIX = 'ilf:strapi-browser-draft:'

/** Placeholder documentId while the create form has no real Strapi id yet. */
export const CREATE_DOCUMENT_ID = 'create'

export const AUTOSAVE_INTERVAL_MS = 15_000
export const DIRTY_SNAPSHOT_DELAY_MS = 2_000

/** Soft cap per draft (~5MB total localStorage per origin). */
export const MAX_PAYLOAD_CHARS = 2_500_000

export interface StoredDraft {
  version: 1
  savedAt: string
  model: string
  documentId: string
  locale: string
  values: Record<string, unknown>
}

export function draftKey(
  model: string,
  documentId: string,
  locale: string
): string {
  return `${STORAGE_PREFIX}${model}::${documentId}::${locale}`
}

export function readDraft(
  model: string,
  documentId: string,
  locale: string
): StoredDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(model, documentId, locale))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    if (
      parsed?.version !== 1 ||
      !parsed.values ||
      typeof parsed.values !== 'object' ||
      Array.isArray(parsed.values)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeDraft(
  draft: StoredDraft
): 'ok' | 'quota' | 'too-large' | 'error' {
  try {
    const json = JSON.stringify(draft)
    if (json.length > MAX_PAYLOAD_CHARS) return 'too-large'
    localStorage.setItem(
      draftKey(draft.model, draft.documentId, draft.locale),
      json
    )
    return 'ok'
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22)
    ) {
      return 'quota'
    }
    console.warn('[browser-draft-recovery] unexpected localStorage error:', err)
    return 'error'
  }
}

export function clearDraft(
  model: string,
  documentId: string,
  locale: string
): void {
  try {
    localStorage.removeItem(draftKey(model, documentId, locale))
  } catch {
    /* ignore */
  }
}

/** Clear this entry's draft and any leftover create-keyed draft for the locale. */
export function clearEntryDrafts(
  model: string,
  documentId: string,
  locale: string
): void {
  clearDraft(model, documentId, locale)
  if (documentId !== CREATE_DOCUMENT_ID) {
    clearDraft(model, CREATE_DOCUMENT_ID, locale)
  }
}

/** Move a create-keyed draft onto the real documentId after first Save. */
export function rekeyCreateDraft(
  model: string,
  locale: string,
  realDocumentId: string
): StoredDraft | null {
  if (
    !realDocumentId ||
    realDocumentId === CREATE_DOCUMENT_ID ||
    realDocumentId === 'unknown'
  ) {
    return null
  }
  const fromCreate = readDraft(model, CREATE_DOCUMENT_ID, locale)
  if (!fromCreate) return null

  const next: StoredDraft = {
    ...fromCreate,
    documentId: realDocumentId
  }
  const result = writeDraft(next)
  if (result !== 'ok') return null
  clearDraft(model, CREATE_DOCUMENT_ID, locale)
  return next
}

/** Deterministic JSON for fingerprints (sorted object keys, arrays in order). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeysDeep(obj[key])
  }
  return out
}
