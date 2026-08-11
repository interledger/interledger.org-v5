/**
 * Invisible Content Manager runner: localStorage autosave of dirty forms and
 * auto-restore after crash/reload. Console logs only (no editor UI).
 *
 * Relies on experimental useContentManagerContext (form.values / setValues / modified).
 */
import { useCallback, useEffect, useRef } from 'react'
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/content-manager/strapi-admin'
import {
  draftDiffersFromInitial,
  hasLoadedInitialValues,
  resolveDocumentId,
  resolveLocale
} from './entryIdentity'
import {
  AUTOSAVE_INTERVAL_MS,
  CREATE_DOCUMENT_ID,
  DIRTY_SNAPSHOT_DELAY_MS,
  clearEntryDrafts,
  draftKey,
  readDraft,
  rekeyCreateDraft,
  stableStringify,
  writeDraft,
  type StoredDraft
} from './storage'

const LOG = '[browser-draft-recovery]'

type FormLike = {
  values: Record<string, unknown>
  initialValues: Record<string, unknown>
  modified: boolean
  setValues: (values: Record<string, unknown>) => void
  getValues?: () => Record<string, unknown>
}

type ContentManagerContext = {
  model: string
  id?: string
  form: FormLike
  isCreatingEntry: boolean
  isLoading?: boolean
}

interface RunnerProps {
  document?: { locale?: string }
  documentId?: string
  model?: string
}

function BrowserDraftRecoveryRunner(props: RunnerProps = {}) {
  const ctx = useContentManagerContext() as ContentManagerContext
  const form = ctx.form
  const model = props.model || ctx.model
  const documentId = resolveDocumentId(props.documentId, ctx)
  const locale = resolveLocale(props.document)
  const canStore = documentId !== 'unknown'

  const lastWrittenRef = useRef('')
  const wasModifiedRef = useRef(false)
  const prevDocumentIdRef = useRef(documentId)
  /** Exactly-once restore guard, keyed by model/documentId/locale. */
  const restoredForKeyRef = useRef('')

  const snapshot = useCallback(
    (reason: string) => {
      if (!canStore || !form?.modified || !form.values) return

      const draft: StoredDraft = {
        version: 1,
        savedAt: new Date().toISOString(),
        model,
        documentId,
        locale,
        values: form.getValues?.() ?? form.values
      }
      const fingerprint = stableStringify(draft.values)
      if (fingerprint === lastWrittenRef.current) return

      const result = writeDraft(draft)
      if (result === 'ok') {
        lastWrittenRef.current = fingerprint
        return
      }
      console.warn(LOG, 'snapshot failed', { reason, result })
    },
    [canStore, form, model, documentId, locale]
  )

  // Auto-restore once per entry after CM has loaded server values.
  useEffect(() => {
    if (!canStore || !form?.setValues || ctx.isLoading) return
    if (!hasLoadedInitialValues(documentId, form.initialValues)) return

    const entryKey = draftKey(model, documentId, locale)
    if (restoredForKeyRef.current === entryKey) return

    // Mark before setValues so re-renders from restore cannot re-enter.
    restoredForKeyRef.current = entryKey

    const draft = readDraft(model, documentId, locale)
    if (!draft?.values) return

    if (!draftDiffersFromInitial(draft.values, form.initialValues)) {
      lastWrittenRef.current = stableStringify(draft.values)
      return
    }

    try {
      form.setValues(draft.values)
      lastWrittenRef.current = stableStringify(draft.values)
      console.log(LOG, 'auto-restored browser draft', {
        savedAt: draft.savedAt,
        key: draftKey(model, draft.documentId, draft.locale)
      })
    } catch (err) {
      console.error(LOG, 'auto-restore failed', err)
    }
  }, [
    canStore,
    ctx.isLoading,
    documentId,
    form,
    form?.initialValues,
    form?.setValues,
    locale,
    model
  ])

  // Interval while dirty (avoid idle timers on clean forms).
  useEffect(() => {
    if (!form?.modified) return
    const id = window.setInterval(
      () => snapshot('interval'),
      AUTOSAVE_INTERVAL_MS
    )
    return () => window.clearInterval(id)
  }, [form?.modified, snapshot])

  useEffect(() => {
    const onHide = () => {
      if (window.document.visibilityState === 'hidden') {
        snapshot('visibilitychange')
      }
    }
    const onUnload = () => snapshot('beforeunload')
    window.document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [snapshot])

  // Debounced snapshot soon after edits (do not wait for the full interval).
  useEffect(() => {
    if (!form?.modified) return
    const t = window.setTimeout(
      () => snapshot('dirty-debounce'),
      DIRTY_SNAPSHOT_DELAY_MS
    )
    return () => window.clearTimeout(t)
  }, [form?.modified, form?.values, snapshot])

  // create → real documentId: keep the draft under the new key while still dirty.
  useEffect(() => {
    const prev = prevDocumentIdRef.current
    prevDocumentIdRef.current = documentId
    if (
      prev !== CREATE_DOCUMENT_ID ||
      documentId === CREATE_DOCUMENT_ID ||
      documentId === 'unknown' ||
      !form?.modified
    ) {
      return
    }
    const migrated = rekeyCreateDraft(model, locale, documentId)
    if (migrated) {
      lastWrittenRef.current = stableStringify(migrated.values)
    }
  }, [documentId, form?.modified, locale, model])

  // Drop browser drafts when the form becomes clean (successful Save path).
  useEffect(() => {
    if (!form || !canStore) return
    if (wasModifiedRef.current && !form.modified) {
      clearEntryDrafts(model, documentId, locale)
      lastWrittenRef.current = ''
    }
    wasModifiedRef.current = form.modified
  }, [canStore, documentId, form, form?.modified, locale, model])

  return null
}

export default BrowserDraftRecoveryRunner
