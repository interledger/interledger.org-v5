import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  draftDiffersFromInitial,
  hasLoadedInitialValues,
  resolveDocumentId,
  resolveLocale
} from './entryIdentity'
import { CREATE_DOCUMENT_ID } from './storage'

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

describe('hasLoadedInitialValues', () => {
  it('allows create forms before initialValues load', () => {
    expect(hasLoadedInitialValues(CREATE_DOCUMENT_ID, undefined)).toBe(true)
    expect(hasLoadedInitialValues(CREATE_DOCUMENT_ID, {})).toBe(true)
  })

  it('waits for initialValues on existing entries', () => {
    expect(hasLoadedInitialValues('doc-1', undefined)).toBe(false)
    expect(hasLoadedInitialValues('doc-1', {})).toBe(false)
    expect(hasLoadedInitialValues('doc-1', { title: '' })).toBe(true)
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
