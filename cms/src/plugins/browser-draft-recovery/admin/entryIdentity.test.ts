import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  draftDiffersFromInitial,
  resolveDocumentId,
  resolveLocale,
  selectStoredDraft
} from './entryIdentity'
import { CREATE_DOCUMENT_ID, writeDraft, type StoredDraft } from './storage'

function mockLocalStorage() {
  const map = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0
  })
  return map
}

function draft(overrides: Partial<StoredDraft> = {}): StoredDraft {
  return {
    version: 1,
    savedAt: '2026-08-11T12:00:00.000Z',
    model: 'm',
    documentId: 'd',
    locale: 'en',
    values: { title: 'draft' },
    ...overrides
  }
}

function stubWindowLocation(search: string | (() => string)) {
  const location = {
    get search() {
      return typeof search === 'function' ? search() : search
    }
  }
  vi.stubGlobal('window', { location })
  vi.stubGlobal('location', location)
}

describe('resolveLocale', () => {
  beforeEach(() => {
    stubWindowLocation('')
  })

  it('prefers document.locale from Content Manager props', () => {
    stubWindowLocation('?plugins[i18n][locale]=es')
    expect(resolveLocale({ locale: 'fr' })).toBe('fr')
  })

  it('reads plugins[i18n][locale] from the query string', () => {
    stubWindowLocation('?plugins[i18n][locale]=es&foo=1')
    expect(resolveLocale(undefined)).toBe('es')
  })

  it('falls back to locale query param', () => {
    stubWindowLocation('?locale=de')
    expect(resolveLocale({})).toBe('de')
  })

  it('defaults to en when nothing is available', () => {
    stubWindowLocation('')
    expect(resolveLocale(undefined)).toBe('en')
  })

  it('defaults to en when location access throws', () => {
    stubWindowLocation(() => {
      throw new Error('no location')
    })
    expect(resolveLocale(undefined)).toBe('en')
  })
})

describe('resolveDocumentId', () => {
  it('prefers documentId from props', () => {
    expect(
      resolveDocumentId('from-props', {
        id: 'from-ctx',
        isCreatingEntry: true
      })
    ).toBe('from-props')
  })

  it('uses context id when props omit documentId', () => {
    expect(
      resolveDocumentId(undefined, {
        id: 'from-ctx',
        isCreatingEntry: false
      })
    ).toBe('from-ctx')
  })

  it('uses create placeholder while creating an entry', () => {
    expect(
      resolveDocumentId(undefined, {
        isCreatingEntry: true
      })
    ).toBe(CREATE_DOCUMENT_ID)
  })

  it('returns unknown when id cannot be resolved', () => {
    expect(
      resolveDocumentId(undefined, {
        isCreatingEntry: false
      })
    ).toBe('unknown')
  })
})

describe('selectStoredDraft', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('returns null when nothing is stored', () => {
    expect(selectStoredDraft('m', 'd', 'en')).toBeNull()
  })

  it('prefers the draft keyed to the current documentId', () => {
    writeDraft(
      draft({
        documentId: 'd',
        values: { title: 'current' }
      })
    )
    writeDraft(
      draft({
        documentId: CREATE_DOCUMENT_ID,
        values: { title: 'create' }
      })
    )
    expect(selectStoredDraft('m', 'd', 'en')?.values).toEqual({
      title: 'current'
    })
  })

  it('falls back to create-keyed draft for an existing documentId', () => {
    writeDraft(
      draft({
        documentId: CREATE_DOCUMENT_ID,
        values: { title: 'create only' }
      })
    )
    expect(selectStoredDraft('m', 'real-id', 'en')?.values).toEqual({
      title: 'create only'
    })
  })

  it('does not fall back when already on the create documentId', () => {
    // no create draft stored
    expect(selectStoredDraft('m', CREATE_DOCUMENT_ID, 'en')).toBeNull()
  })

  it('returns create draft when documentId is create', () => {
    writeDraft(
      draft({
        documentId: CREATE_DOCUMENT_ID,
        values: { title: 'new' }
      })
    )
    expect(selectStoredDraft('m', CREATE_DOCUMENT_ID, 'en')?.values).toEqual({
      title: 'new'
    })
  })

  it('scopes by locale', () => {
    writeDraft(
      draft({
        documentId: 'd',
        locale: 'es',
        values: { title: 'ES' }
      })
    )
    expect(selectStoredDraft('m', 'd', 'en')).toBeNull()
    expect(selectStoredDraft('m', 'd', 'es')?.values).toEqual({
      title: 'ES'
    })
  })
})

describe('draftDiffersFromInitial', () => {
  it('is false when values match ignoring key order', () => {
    expect(draftDiffersFromInitial({ b: 1, a: 2 }, { a: 2, b: 1 })).toBe(false)
  })

  it('is true when field values differ', () => {
    expect(
      draftDiffersFromInitial({ title: 'local' }, { title: 'server' })
    ).toBe(true)
  })

  it('treats missing initialValues as empty object', () => {
    expect(draftDiffersFromInitial({}, null)).toBe(false)
    expect(draftDiffersFromInitial({}, undefined)).toBe(false)
    expect(draftDiffersFromInitial({ title: 'x' }, undefined)).toBe(true)
  })

  it('detects nested dynamic-zone differences', () => {
    const server = {
      content: [{ __component: 'blocks.paragraph', body: 'a' }]
    }
    const local = {
      content: [{ __component: 'blocks.paragraph', body: 'b' }]
    }
    expect(draftDiffersFromInitial(local, server)).toBe(true)
    expect(draftDiffersFromInitial(server, server)).toBe(false)
  })
})
