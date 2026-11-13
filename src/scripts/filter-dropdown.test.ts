import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindFilterDropdown, initFilterDropdowns } from './filter-dropdown'

class DomNode {}

type Listener = (event: {
  key?: string
  relatedTarget?: unknown
  target?: unknown
}) => void

function createDetails(withSummary = true) {
  const inside = new DomNode()
  const summary = { focus: vi.fn() }
  const listeners = new Map<string, Listener[]>()
  const details = {
    open: true,
    dataset: {} as Record<string, string | undefined>,
    contains(node: unknown) {
      return node === inside
    },
    querySelector(selector: string) {
      if (selector === 'summary' && withSummary) return summary
      return null
    },
    addEventListener(type: string, listener: Listener) {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
    }
  }
  return { details, summary, inside, listeners }
}

function stubDocument() {
  const listeners = new Map<string, Listener[]>()
  vi.stubGlobal('Node', DomNode)
  vi.stubGlobal('document', {
    addEventListener(type: string, listener: Listener) {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
    }
  })
  return listeners
}

function fire(
  listeners: Map<string, Listener[]>,
  type: string,
  event: Parameters<Listener>[0]
) {
  for (const listener of listeners.get(type) ?? []) listener(event)
}

describe('bindFilterDropdown', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('closes on Escape and returns focus to the summary', () => {
    const documentListeners = stubDocument()
    const { details, summary, listeners } = createDetails()
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    fire(listeners, 'keydown', { key: 'Escape' })

    expect(details.open).toBe(false)
    expect(summary.focus).toHaveBeenCalledOnce()
    expect(documentListeners.get('pointerdown')).toHaveLength(1)
  })

  it('ignores Escape when the dropdown is already closed', () => {
    stubDocument()
    const { details, summary, listeners } = createDetails()
    details.open = false
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    fire(listeners, 'keydown', { key: 'Escape' })

    expect(details.open).toBe(false)
    expect(summary.focus).not.toHaveBeenCalled()
  })

  it('does not close or move focus for any other key', () => {
    stubDocument()
    const { details, summary, listeners } = createDetails()
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    fire(listeners, 'keydown', { key: 'Tab' })

    expect(details.open).toBe(true)
    expect(summary.focus).not.toHaveBeenCalled()
  })

  it('closes on Escape without a summary to focus', () => {
    stubDocument()
    const { details, listeners } = createDetails(false)
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    fire(listeners, 'keydown', { key: 'Escape' })

    expect(details.open).toBe(false)
  })

  it('stays open when focus moves to an option inside the panel', () => {
    stubDocument()
    const { details, inside, listeners } = createDetails()
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    fire(listeners, 'focusout', { relatedTarget: inside })

    expect(details.open).toBe(true)
  })

  it('closes when focus leaves the dropdown', () => {
    stubDocument()
    const { details, listeners } = createDetails()
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    fire(listeners, 'focusout', { relatedTarget: new DomNode() })

    expect(details.open).toBe(false)
  })

  it('closes when focus leaves the document entirely', () => {
    stubDocument()
    const { details, listeners } = createDetails()
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    fire(listeners, 'focusout', { relatedTarget: null })

    expect(details.open).toBe(false)
  })

  it('closes on a pointer press outside and ignores one inside', () => {
    const documentListeners = stubDocument()
    const { details, inside } = createDetails()
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    fire(documentListeners, 'pointerdown', { target: inside })
    expect(details.open).toBe(true)

    fire(documentListeners, 'pointerdown', { target: new DomNode() })
    expect(details.open).toBe(false)
  })

  it('ignores a pointer press while closed, and a target that is not a node', () => {
    const documentListeners = stubDocument()
    const { details } = createDetails()
    bindFilterDropdown(details as unknown as HTMLDetailsElement)

    details.open = false
    fire(documentListeners, 'pointerdown', { target: new DomNode() })
    expect(details.open).toBe(false)

    details.open = true
    fire(documentListeners, 'pointerdown', { target: 'not-a-node' })
    expect(details.open).toBe(true)
  })

  it('closes only the dropdown that does not contain the press', () => {
    const documentListeners = stubDocument()
    const first = createDetails()
    const second = createDetails()
    bindFilterDropdown(first.details as unknown as HTMLDetailsElement)
    bindFilterDropdown(second.details as unknown as HTMLDetailsElement)

    fire(documentListeners, 'pointerdown', { target: first.inside })

    expect(first.details.open).toBe(true)
    expect(second.details.open).toBe(false)
  })

  it('binds each dropdown once', () => {
    const documentListeners = stubDocument()
    const { details, listeners } = createDetails()
    const element = details as unknown as HTMLDetailsElement

    bindFilterDropdown(element)
    bindFilterDropdown(element)

    expect(listeners.get('keydown')).toHaveLength(1)
    expect(listeners.get('focusout')).toHaveLength(1)
    expect(documentListeners.get('pointerdown')).toHaveLength(1)
  })
})

describe('initFilterDropdowns', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('binds every dropdown under the root', () => {
    stubDocument()
    const first = createDetails()
    const second = createDetails()
    const root = {
      querySelectorAll: (selector: string) =>
        selector === '[data-filter-dropdown]'
          ? [first.details, second.details]
          : []
    }

    initFilterDropdowns(root as unknown as ParentNode)

    expect(first.details.dataset.filterDropdownBound).toBe('true')
    expect(second.details.dataset.filterDropdownBound).toBe('true')
  })
})
