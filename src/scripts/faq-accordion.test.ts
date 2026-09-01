import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeFaqPanel,
  handleFaqItemClick,
  initFaqAccordion,
  openFaqPanel,
  questionScrollDestination,
  scrollQuestionIntoView
} from './faq-accordion'

type FakePanel = {
  dataset: Record<string, string | undefined>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

type FakeSummary = {
  addEventListener: ReturnType<typeof vi.fn>
}

type FakeItem = {
  open: boolean
  dataset: Record<string, string | undefined>
  scrollIntoView: ReturnType<typeof vi.fn>
  removeAttribute: ReturnType<typeof vi.fn>
  getBoundingClientRect: () => { top: number }
  querySelector: (selector: string) => FakePanel | FakeSummary | null
}

function makeItem(open = false): {
  item: FakeItem
  panel: FakePanel
  summary: FakeSummary
} {
  const panel: FakePanel = {
    dataset: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
  const summary: FakeSummary = {
    addEventListener: vi.fn()
  }
  const item: FakeItem = {
    open,
    dataset: {},
    scrollIntoView: vi.fn(),
    removeAttribute: vi.fn(),
    getBoundingClientRect: () => ({ top: 400 }),
    querySelector: (selector: string) => {
      if (selector === '[data-faq-panel]') return panel
      if (selector === 'summary') return summary
      return null
    }
  }
  return { item, panel, summary }
}

function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener() {},
    removeEventListener() {}
  }))
}

describe('questionScrollDestination', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('aligns the question top to the header using scroll-margin', () => {
    vi.stubGlobal('scrollY', 200)
    vi.stubGlobal('getComputedStyle', () => ({ scrollMarginTop: '76px' }))
    const item = { getBoundingClientRect: () => ({ top: 120 }) }
    expect(questionScrollDestination(item as HTMLElement)).toBe(200 + 120 - 76)
  })
})

describe('handleFaqItemClick', () => {
  beforeEach(() => {
    stubMatchMedia(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { __siteLenis?: unknown }).__siteLenis
  })

  it('opens the item, closes expanded siblings, and scrolls the opened item', () => {
    const a = makeItem(true)
    a.item.dataset.faqExpanded = 'true'
    a.panel.dataset.open = 'true'
    const b = makeItem(false)

    handleFaqItemClick(
      b.item as unknown as HTMLDetailsElement,
      [a.item, b.item] as unknown as HTMLDetailsElement[]
    )

    expect(a.item.open).toBe(false)
    expect(a.item.dataset.faqExpanded).toBe('false')
    expect(a.panel.dataset.open).toBeUndefined()
    expect(b.item.open).toBe(true)
    expect(b.item.dataset.faqExpanded).toBe('true')
    expect(b.panel.dataset.open).toBe('true')
    expect(b.item.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(a.item.scrollIntoView).not.toHaveBeenCalled()
  })

  it('eases to the live question top so a sibling closing above cannot overshoot', () => {
    stubMatchMedia(false)
    const scrollTo = vi.fn()
    vi.stubGlobal('__siteLenis', { scrollTo })
    vi.stubGlobal('scrollY', 0)
    vi.stubGlobal('getComputedStyle', () => ({ scrollMarginTop: '76px' }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const { item } = makeItem(false)
    let top = 800
    item.getBoundingClientRect = () => ({ top })

    let now = 0
    vi.stubGlobal('performance', { now: () => now })
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })

    scrollQuestionIntoView(item as unknown as HTMLElement)

    now = 200
    top = 500
    const first = frames.shift()
    first?.(now)
    const mid = scrollTo.mock.calls.at(-1)?.[0] as number
    expect(mid).toBeLessThan(800 - 76)

    now = 1400
    top = 500
    const last = frames.shift()
    last?.(now)
    expect(scrollTo).toHaveBeenLastCalledWith(500 - 76, { immediate: true })
    expect(item.scrollIntoView).not.toHaveBeenCalled()
  })

  it('falls back to window.scrollTo when Lenis is not running', () => {
    stubMatchMedia(false)
    const windowScrollTo = vi.fn()
    vi.stubGlobal('scrollTo', windowScrollTo)
    vi.stubGlobal('scrollY', 100)
    vi.stubGlobal('getComputedStyle', () => ({ scrollMarginTop: '70px' }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const { item } = makeItem(false)
    item.getBoundingClientRect = () => ({ top: 400 })

    let now = 0
    vi.stubGlobal('performance', { now: () => now })
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })

    scrollQuestionIntoView(item as unknown as HTMLElement)
    now = 1400
    frames[0](now)

    expect(windowScrollTo).toHaveBeenCalledWith(0, 100 + 400 - 70)
    expect(item.scrollIntoView).not.toHaveBeenCalled()
  })

  it('collapses an already expanded item without scrolling', () => {
    const a = makeItem(true)
    a.item.dataset.faqExpanded = 'true'
    a.panel.dataset.open = 'true'
    const b = makeItem(false)

    handleFaqItemClick(
      a.item as unknown as HTMLDetailsElement,
      [a.item, b.item] as unknown as HTMLDetailsElement[]
    )

    expect(a.item.open).toBe(false)
    expect(a.item.dataset.faqExpanded).toBe('false')
    expect(b.item.open).toBe(false)
    expect(a.item.scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('openFaqPanel / closeFaqPanel animation', () => {
  const rafQueue: FrameRequestCallback[] = []

  beforeEach(() => {
    stubMatchMedia(false)
    rafQueue.length = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function flushRaf() {
    const queued = rafQueue.splice(0)
    queued.forEach((cb) => cb(0))
  }

  it('keeps details open and sets data-open on the next frames', () => {
    const { item, panel } = makeItem(false)
    openFaqPanel(item as unknown as HTMLDetailsElement)
    expect(item.open).toBe(true)
    expect(panel.dataset.open).toBeUndefined()
    flushRaf()
    expect(panel.dataset.open).toBeUndefined()
    flushRaf()
    expect(panel.dataset.open).toBe('true')
  })

  it('does not apply data-open if the item was closed before the frames ran', () => {
    const { item, panel } = makeItem(false)
    openFaqPanel(item as unknown as HTMLDetailsElement)
    closeFaqPanel(item as unknown as HTMLDetailsElement)
    flushRaf()
    flushRaf()
    expect(panel.dataset.open).toBeUndefined()
    expect(item.open).toBe(true)
  })

  it('clears open after the grid-template-rows transition ends', () => {
    const { item, panel } = makeItem(true)
    item.dataset.faqExpanded = 'true'
    panel.dataset.open = 'true'

    closeFaqPanel(item as unknown as HTMLDetailsElement)

    expect(item.open).toBe(true)
    expect(panel.dataset.open).toBeUndefined()
    expect(panel.addEventListener).toHaveBeenCalledWith(
      'transitionend',
      expect.any(Function)
    )

    const onEnd = panel.addEventListener.mock.calls[0][1] as EventListener
    onEnd({
      target: panel,
      propertyName: 'grid-template-rows'
    } as unknown as Event)

    expect(item.open).toBe(false)
  })

  it('falls back to clearing open if transitionend never fires', () => {
    vi.useFakeTimers()
    const { item, panel } = makeItem(true)
    item.dataset.faqExpanded = 'true'
    panel.dataset.open = 'true'

    closeFaqPanel(item as unknown as HTMLDetailsElement)
    expect(item.open).toBe(true)
    vi.advanceTimersByTime(250)
    expect(item.open).toBe(false)
    vi.useRealTimers()
  })

  it('ignores transitionend from nested elements', () => {
    const { item, panel } = makeItem(true)
    item.dataset.faqExpanded = 'true'
    panel.dataset.open = 'true'
    const nested = { dataset: {} }

    closeFaqPanel(item as unknown as HTMLDetailsElement)
    const onEnd = panel.addEventListener.mock.calls[0][1] as EventListener
    onEnd({
      target: nested,
      propertyName: 'grid-template-rows'
    } as unknown as Event)

    expect(item.open).toBe(true)
  })
})

describe('initFaqAccordion', () => {
  beforeEach(() => {
    stubMatchMedia(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('binds summary click once per accordion, strips name, and opens on click', () => {
    const { item, panel, summary } = makeItem(false)
    const accordion = {
      dataset: {} as Record<string, string>,
      querySelectorAll: (selector: string) =>
        selector === '[data-faq-item]' ? [item] : []
    }
    const root = {
      querySelectorAll: (selector: string) =>
        selector === '[data-faq-accordion]' ? [accordion] : []
    }

    initFaqAccordion(root as unknown as ParentNode)
    initFaqAccordion(root as unknown as ParentNode)

    expect(summary.addEventListener).toHaveBeenCalledTimes(1)
    expect(accordion.dataset.faqAccordionReady).toBe('true')
    expect(item.removeAttribute).toHaveBeenCalledWith('name')

    const click = summary.addEventListener.mock.calls[0][1] as (event: {
      preventDefault: () => void
    }) => void
    const preventDefault = vi.fn()
    click({ preventDefault })

    expect(preventDefault).toHaveBeenCalled()
    expect(item.open).toBe(true)
    expect(item.dataset.faqExpanded).toBe('true')
    expect(panel.dataset.open).toBe('true')
    expect(item.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('syncs an item that is already open when JS starts', () => {
    const { item, panel } = makeItem(true)
    const accordion = {
      dataset: {} as Record<string, string>,
      querySelectorAll: (selector: string) =>
        selector === '[data-faq-item]' ? [item] : []
    }
    const root = {
      querySelectorAll: (selector: string) =>
        selector === '[data-faq-accordion]' ? [accordion] : []
    }

    initFaqAccordion(root as unknown as ParentNode)

    expect(item.dataset.faqExpanded).toBe('true')
    expect(panel.dataset.open).toBe('true')
  })
})
