import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  CREATE_DOCUMENT_ID,
  MAX_PAYLOAD_CHARS,
  STORAGE_PREFIX,
  clearDraft,
  draftKey,
  readDraft,
  rekeyCreateDraft,
  stableStringify,
  writeDraft,
  type StoredDraft
} from './storage'

function mockLocalStorage(options?: {
  throwQuotaOnSet?: boolean
  throwCode22?: boolean
  throwGenericOnSet?: boolean
  throwOnRemove?: boolean
}) {
  const map = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (options?.throwQuotaOnSet) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      if (options?.throwCode22) {
        const err = new DOMException('Quota exceeded')
        Object.defineProperty(err, 'code', { value: 22 })
        throw err
      }
      if (options?.throwGenericOnSet) {
        throw new Error('storage disabled')
      }
      map.set(k, v)
    },
    removeItem: (k: string) => {
      if (options?.throwOnRemove) {
        throw new Error('remove failed')
      }
      map.delete(k)
    },
    clear: () => {
      map.clear()
    },
    key: () => null,
    length: 0
  })
  return map
}

function sampleDraft(overrides: Partial<StoredDraft> = {}): StoredDraft {
  return {
    version: 1,
    savedAt: '2026-08-11T12:00:00.000Z',
    model: 'm',
    documentId: 'd',
    locale: 'en',
    values: { title: 'Hello' },
    ...overrides
  }
}

describe('browser-draft-recovery storage', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  describe('draftKey', () => {
    it('scopes keys by model, document, and locale', () => {
      expect(draftKey('m', 'd', 'es')).toBe(`${STORAGE_PREFIX}m::d::es`)
    })

    it('uses the shared storage prefix', () => {
      expect(draftKey('a', 'b', 'c').startsWith(STORAGE_PREFIX)).toBe(true)
    })
  })

  describe('writeDraft / readDraft', () => {
    it('round-trips a draft', () => {
      const draft = sampleDraft({
        model: 'api::foundation-page.foundation-page',
        documentId: 'abc123',
        values: {
          title: 'Hello',
          content: [{ __component: 'blocks.paragraph' }]
        }
      })
      expect(writeDraft(draft)).toBe('ok')
      expect(readDraft(draft.model, draft.documentId, draft.locale)).toEqual(
        draft
      )
    })

    it('returns null when nothing is stored', () => {
      expect(readDraft('m', 'missing', 'en')).toBeNull()
    })

    it('overwrites an existing key', () => {
      writeDraft(sampleDraft({ values: { title: 'v1' } }))
      writeDraft(sampleDraft({ values: { title: 'v2' } }))
      expect(readDraft('m', 'd', 'en')?.values).toEqual({ title: 'v2' })
    })

    it('isolates locales and document ids', () => {
      writeDraft(sampleDraft({ locale: 'en', values: { title: 'EN' } }))
      writeDraft(sampleDraft({ locale: 'es', values: { title: 'ES' } }))
      writeDraft(
        sampleDraft({
          documentId: 'other',
          locale: 'en',
          values: { title: 'OTHER' }
        })
      )

      expect(readDraft('m', 'd', 'en')?.values).toEqual({ title: 'EN' })
      expect(readDraft('m', 'd', 'es')?.values).toEqual({ title: 'ES' })
      expect(readDraft('m', 'other', 'en')?.values).toEqual({
        title: 'OTHER'
      })
    })

    it('returns too-large when payload exceeds MAX_PAYLOAD_CHARS', () => {
      const huge = 'x'.repeat(MAX_PAYLOAD_CHARS)
      const result = writeDraft(sampleDraft({ values: { blob: huge } }))
      expect(result).toBe('too-large')
      expect(readDraft('m', 'd', 'en')).toBeNull()
    })

    it('returns quota when localStorage throws QuotaExceededError', () => {
      mockLocalStorage({ throwQuotaOnSet: true })
      expect(writeDraft(sampleDraft())).toBe('quota')
    })

    it('returns quota when localStorage throws DOMException code 22', () => {
      mockLocalStorage({ throwCode22: true })
      expect(writeDraft(sampleDraft())).toBe('quota')
    })

    it('returns quota and warns on unexpected write errors', () => {
      mockLocalStorage({ throwGenericOnSet: true })
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(writeDraft(sampleDraft())).toBe('quota')
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('readDraft validation', () => {
    it('rejects invalid version', () => {
      localStorage.setItem(
        draftKey('m', 'd', 'en'),
        JSON.stringify({ version: 2, values: { a: 1 } })
      )
      expect(readDraft('m', 'd', 'en')).toBeNull()
    })

    it('rejects array values', () => {
      localStorage.setItem(
        draftKey('m', 'd2', 'en'),
        JSON.stringify({
          version: 1,
          values: ['not', 'an', 'object'],
          model: 'm',
          documentId: 'd2',
          locale: 'en',
          savedAt: 'x'
        })
      )
      expect(readDraft('m', 'd2', 'en')).toBeNull()
    })

    it('rejects missing values', () => {
      localStorage.setItem(
        draftKey('m', 'd', 'en'),
        JSON.stringify({
          version: 1,
          model: 'm',
          documentId: 'd',
          locale: 'en',
          savedAt: 'x'
        })
      )
      expect(readDraft('m', 'd', 'en')).toBeNull()
    })

    it('rejects null values', () => {
      localStorage.setItem(
        draftKey('m', 'd', 'en'),
        JSON.stringify({
          version: 1,
          values: null,
          model: 'm',
          documentId: 'd',
          locale: 'en',
          savedAt: 'x'
        })
      )
      expect(readDraft('m', 'd', 'en')).toBeNull()
    })

    it('returns null on malformed JSON', () => {
      localStorage.setItem(draftKey('m', 'd', 'en'), '{not-json')
      expect(readDraft('m', 'd', 'en')).toBeNull()
    })

    it('returns null when localStorage.getItem throws', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0
      })
      expect(readDraft('m', 'd', 'en')).toBeNull()
    })
  })

  describe('clearDraft', () => {
    it('removes the entry', () => {
      writeDraft(sampleDraft({ values: { a: 1 } }))
      clearDraft('m', 'd', 'en')
      expect(readDraft('m', 'd', 'en')).toBeNull()
    })

    it('is a no-op for missing keys', () => {
      expect(() => clearDraft('m', 'missing', 'en')).not.toThrow()
    })

    it('swallows removeItem errors', () => {
      mockLocalStorage({ throwOnRemove: true })
      expect(() => clearDraft('m', 'd', 'en')).not.toThrow()
    })
  })

  describe('stableStringify', () => {
    it('sorts object keys for deterministic fingerprints', () => {
      expect(stableStringify({ b: 1, a: 2 })).toBe(
        stableStringify({ a: 2, b: 1 })
      )
      expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
    })

    it('sorts nested object keys', () => {
      expect(stableStringify({ z: { b: 1, a: 2 }, y: 0 })).toBe(
        '{"y":0,"z":{"a":2,"b":1}}'
      )
    })

    it('preserves array order while sorting object elements', () => {
      expect(
        stableStringify([
          { b: 1, a: 2 },
          { d: 4, c: 3 }
        ])
      ).toBe('[{"a":2,"b":1},{"c":3,"d":4}]')
    })

    it('handles primitives, null, and empty structures', () => {
      expect(stableStringify(null)).toBe('null')
      expect(stableStringify(1)).toBe('1')
      expect(stableStringify('x')).toBe('"x"')
      expect(stableStringify(true)).toBe('true')
      expect(stableStringify({})).toBe('{}')
      expect(stableStringify([])).toBe('[]')
    })

    it('treats key-order-only differences as equal form state', () => {
      const a = { title: 'T', meta: { b: 2, a: 1 } }
      const b = { meta: { a: 1, b: 2 }, title: 'T' }
      expect(stableStringify(a)).toBe(stableStringify(b))
    })
  })

  describe('rekeyCreateDraft', () => {
    it('moves create-keyed draft to a real documentId', () => {
      writeDraft(
        sampleDraft({
          documentId: CREATE_DOCUMENT_ID,
          values: { title: 'New page' }
        })
      )

      const migrated = rekeyCreateDraft('m', 'en', 'real-doc-id')
      expect(migrated?.documentId).toBe('real-doc-id')
      expect(migrated?.values).toEqual({ title: 'New page' })
      expect(readDraft('m', CREATE_DOCUMENT_ID, 'en')).toBeNull()
      expect(readDraft('m', 'real-doc-id', 'en')?.values).toEqual({
        title: 'New page'
      })
    })

    it('is a no-op for create or unknown targets', () => {
      writeDraft(
        sampleDraft({
          documentId: CREATE_DOCUMENT_ID,
          values: { title: 'New page' }
        })
      )
      expect(rekeyCreateDraft('m', 'en', CREATE_DOCUMENT_ID)).toBeNull()
      expect(rekeyCreateDraft('m', 'en', 'unknown')).toBeNull()
      expect(rekeyCreateDraft('m', 'en', '')).toBeNull()
      expect(readDraft('m', CREATE_DOCUMENT_ID, 'en')).not.toBeNull()
    })

    it('returns null when there is no create draft', () => {
      expect(rekeyCreateDraft('m', 'en', 'real-doc-id')).toBeNull()
    })

    it('returns null when the target write hits quota and keeps the create key', () => {
      const map = mockLocalStorage()
      const createKey = draftKey('m', CREATE_DOCUMENT_ID, 'en')
      map.set(
        createKey,
        JSON.stringify(
          sampleDraft({
            documentId: CREATE_DOCUMENT_ID,
            values: { title: 'ok' }
          })
        )
      )

      vi.stubGlobal('localStorage', {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: () => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        },
        removeItem: (k: string) => {
          map.delete(k)
        },
        clear: () => map.clear(),
        key: () => null,
        length: 0
      })

      expect(rekeyCreateDraft('m', 'en', 'real-doc-id')).toBeNull()
      // create key still present (write failed, so we did not clear)
      expect(readDraft('m', CREATE_DOCUMENT_ID, 'en')).not.toBeNull()
    })

    it('only rekeys the matching locale', () => {
      writeDraft(
        sampleDraft({
          documentId: CREATE_DOCUMENT_ID,
          locale: 'en',
          values: { title: 'EN' }
        })
      )
      writeDraft(
        sampleDraft({
          documentId: CREATE_DOCUMENT_ID,
          locale: 'es',
          values: { title: 'ES' }
        })
      )

      rekeyCreateDraft('m', 'en', 'real-doc-id')
      expect(readDraft('m', CREATE_DOCUMENT_ID, 'en')).toBeNull()
      expect(readDraft('m', 'real-doc-id', 'en')?.values).toEqual({
        title: 'EN'
      })
      expect(readDraft('m', CREATE_DOCUMENT_ID, 'es')?.values).toEqual({
        title: 'ES'
      })
    })
  })
})
