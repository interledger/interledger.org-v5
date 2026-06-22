import { describe, expect, it } from 'vitest'
import { getVisiblePages, MAX_PAGINATION_THRESHOLD } from './pagination'

describe('getVisiblePages — below threshold (no ellipsis)', () => {
  it('returns all pages when total is 1', () => {
    expect(getVisiblePages(1, 1)).toEqual([1])
  })

  it('returns all pages when total is below the threshold', () => {
    expect(getVisiblePages(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('threshold boundary: 5 pages show all, 6 pages use ellipsis', () => {
    expect(getVisiblePages(1, MAX_PAGINATION_THRESHOLD - 1)).toEqual([
      1, 2, 3, 4, 5
    ])
    expect(getVisiblePages(1, MAX_PAGINATION_THRESHOLD)).toEqual([
      1,
      2,
      3,
      4,
      '...',
      6
    ])
  })
})

describe('getVisiblePages — near start', () => {
  it('page 1: shows minimum start block', () => {
    expect(getVisiblePages(1, 10)).toEqual([1, 2, 3, 4, '...', 10])
  })

  it('page 2: shows minimum start block', () => {
    expect(getVisiblePages(2, 10)).toEqual([1, 2, 3, 4, '...', 10])
  })

  it('page 3: window reaches page 4, no left ellipsis', () => {
    expect(getVisiblePages(3, 10)).toEqual([1, 2, 3, 4, '...', 10])
  })
})

describe('getVisiblePages — middle', () => {
  it('page 4: both ellipses', () => {
    expect(getVisiblePages(4, 10)).toEqual([1, '...', 3, 4, 5, '...', 10])
  })

  it('page 6: both ellipses', () => {
    expect(getVisiblePages(6, 10)).toEqual([1, '...', 5, 6, 7, '...', 10])
  })

  it('page 7: window end adjacent to last two pages, both ellipses', () => {
    expect(getVisiblePages(7, 10)).toEqual([1, '...', 6, 7, 8, '...', 10])
  })
})

describe('getVisiblePages — near end', () => {
  it('page 8: shows minimum end block', () => {
    expect(getVisiblePages(8, 10)).toEqual([1, '...', 7, 8, 9, 10])
  })

  it('page 9: shows minimum end block', () => {
    expect(getVisiblePages(9, 10)).toEqual([1, '...', 7, 8, 9, 10])
  })

  it('last page: shows minimum end block', () => {
    expect(getVisiblePages(10, 10)).toEqual([1, '...', 7, 8, 9, 10])
  })
})

describe('getVisiblePages — invariants', () => {
  it('first page is always the first item', () => {
    for (const current of [1, 4, 7, 10]) {
      const result = getVisiblePages(current, 10)
      expect(result[0]).toBe(1)
    }
  })

  it('last page is always the last item', () => {
    for (const current of [1, 4, 7, 10]) {
      const result = getVisiblePages(current, 10)
      expect(result[result.length - 1]).toBe(10)
    }
  })
})
