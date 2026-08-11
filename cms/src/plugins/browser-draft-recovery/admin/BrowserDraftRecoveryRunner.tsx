/**
 * Invisible edit-view runner: autosaves dirty forms to localStorage and
 * auto-restores after reload. Console logs only (no editor UI).
 *
 * Uses experimental useContentManagerContext (form.values / setValues / modified).
 */
import { useCallback, useEffect, useRef } from 'react'
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/content-manager/strapi-admin'
import {
  draftDiffersFromInitial,
  resolveDocumentId,
  resolveLocale,
  selectStoredDraft
} from './entryIdentity'
import {
  AUTOSAVE_INTERVAL_MS,
  CREATE_DOCUMENT_ID,
  clearDraft,
  draftKey,
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

/** Props from CM editView.right-links injection (may be empty). */
interface RunnerProps {
  document?: { locale?: string }
  documentId?: string
  model?: string
}

/**
 * Mounted inside the Content Manager edit view (no visible UI).
 */
export function BrowserDraftRecoveryRunner(props: RunnerProps = {}) {
  const ctx = useContentManagerContext() as {
    model: string
    id?: string
    form: FormLike
    isCreatingEntry: boolean
    isLoading?: boolean
  }

  const form = ctx.form
  const model = props.model || ctx.model
  const documentId = resolveDocumentId(props.documentId, ctx)
  const locale = resolveLocale(props.document)
  const canStore = documentId !== 'unknown'

  const lastWrittenRef = useRef<string>('')
  const wasModifiedRef = useRef(false)
  const prevDocumentIdRef = useRef(documentId)
  /** Entry key we already ran auto-restore for (exactly once per model/id/locale). */
  const restoredForKeyRef = useRef<string>('')
  const loggedMountKeyRef = useRef('')

  const snapshot = useCallback(
    (reason: string) => {
      if (!canStore || !form?.modified || !form.values) {
        return
      }
      const values = form.getValues ? form.getValues() : form.values
      const draft: StoredDraft = {
        version: 1,
        savedAt: new Date().toISOString(),
        model,
        documentId,
        locale,
        values
      }
      const fp = stableStringify(draft.values)
      if (fp === lastWrittenRef.current) {
        return
      }

      const result = writeDraft(draft)
      if (result === 'ok') {
        lastWrittenRef.current = fp

        console.log(LOG, 'snapshot ok', {
          reason,
          key: draftKey(model, documentId, locale),
          savedAt: draft.savedAt,
          chars: JSON.stringify(draft).length
        })
      } else {
        console.warn(LOG, 'snapshot failed', { reason, result })
      }
    },
    [canStore, form, model, documentId, locale]
  )

  // Mount / identity log
  useEffect(() => {
    const key = `${model}::${documentId}::${locale}`
    if (loggedMountKeyRef.current === key) return
    loggedMountKeyRef.current = key

    console.log(LOG, 'active on edit view', {
      model,
      documentId,
      locale,
      canStore,
      isCreatingEntry: ctx.isCreatingEntry,
      isLoading: ctx.isLoading,
      modified: form?.modified,
      storageKey: canStore ? draftKey(model, documentId, locale) : null
    })
  }, [
    model,
    documentId,
    locale,
    canStore,
    ctx.isCreatingEntry,
    ctx.isLoading,
    form?.modified
  ])

  // Auto-restore once per entry when a stored draft differs from what Strapi loaded.
  // Guard is keyed by model/documentId/locale so SPA navigations between entries
  // re-arm restore without a separate reset effect that can race re-renders.
  useEffect(() => {
    if (!canStore || !form?.setValues || ctx.isLoading) return

    const entryKey = draftKey(model, documentId, locale)
    if (restoredForKeyRef.current === entryKey) return

    const draft = selectStoredDraft(model, documentId, locale)

    // Mark this entry before setValues so re-renders from restore cannot re-enter.
    restoredForKeyRef.current = entryKey
    lastWrittenRef.current = ''

    if (!draft?.values) {
       
      console.log(LOG, 'no draft to restore', {
        key: entryKey,
        checkedCreate: documentId !== CREATE_DOCUMENT_ID
      })
      return
    }

    if (!draftDiffersFromInitial(draft.values, form.initialValues)) {
       
      console.log(LOG, 'draft matches server values — skip restore', {
        savedAt: draft.savedAt
      })
      lastWrittenRef.current = stableStringify(draft.values)
      return
    }

     
    console.log(LOG, 'auto-restoring browser draft', {
      savedAt: draft.savedAt,
      fromKey: draftKey(model, draft.documentId, draft.locale),
      fieldCount: Object.keys(draft.values).length
    })
    try {
      form.setValues(draft.values)
      lastWrittenRef.current = stableStringify(draft.values)
       
      console.log(LOG, 'auto-restore applied via setValues')
    } catch (err) {
       
      console.error(LOG, 'auto-restore setValues failed', err)
    }
  }, [
    canStore,
    form,
    form?.initialValues,
    form?.setValues,
    model,
    documentId,
    locale,
    ctx.isLoading
  ])

  // Interval autosave
  useEffect(() => {
    const id = window.setInterval(
      () => snapshot('interval'),
      AUTOSAVE_INTERVAL_MS
    )
    return () => window.clearInterval(id)
  }, [snapshot])

  // Tab hide + page unload
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

  // Snapshot soon after the form becomes dirty (don't wait full 15s)
  useEffect(() => {
    if (!form?.modified) return
    const t = window.setTimeout(() => snapshot('dirty-debounce'), 2_000)
    return () => window.clearTimeout(t)
  }, [form?.modified, form?.values, snapshot])

  // create → real documentId re-key while still dirty
  useEffect(() => {
    const prev = prevDocumentIdRef.current
    prevDocumentIdRef.current = documentId
    if (
      prev === CREATE_DOCUMENT_ID &&
      documentId !== CREATE_DOCUMENT_ID &&
      documentId !== 'unknown' &&
      form?.modified
    ) {
      const migrated = rekeyCreateDraft(model, locale, documentId)
      if (migrated) {
        lastWrittenRef.current = stableStringify(migrated.values)

        console.log(LOG, 're-keyed create draft → real documentId', {
          documentId,
          locale
        })
      }
    }
  }, [documentId, model, locale, form?.modified])

  // Clear when dirty → clean
  useEffect(() => {
    if (!form || !canStore) return
    if (wasModifiedRef.current && !form.modified) {
      clearDraft(model, documentId, locale)
      if (documentId !== CREATE_DOCUMENT_ID) {
        clearDraft(model, CREATE_DOCUMENT_ID, locale)
      }
      lastWrittenRef.current = ''

      console.log(LOG, 'cleared draft (form clean)', {
        key: draftKey(model, documentId, locale)
      })
    }
    wasModifiedRef.current = form.modified
  }, [form, form?.modified, model, documentId, locale, canStore])

  return null
}

export default BrowserDraftRecoveryRunner
