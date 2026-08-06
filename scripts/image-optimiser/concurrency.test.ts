import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from './concurrency'

describe('mapWithConcurrency', () => {
  it('returns results in input order even when tasks finish out of order', async () => {
    const delays = [30, 0, 20, 10]

    const results = await mapWithConcurrency(
      delays,
      4,
      async (delay, index) => {
        await new Promise((resolve) => setTimeout(resolve, delay))
        return index
      }
    )

    expect(results).toEqual([0, 1, 2, 3])
  })

  it('runs no more than `limit` tasks at once', async () => {
    let inFlight = 0
    let peak = 0

    await mapWithConcurrency(Array.from({ length: 12 }), 4, async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight--
    })

    expect(peak).toBe(4)
  })

  it('visits every item exactly once', async () => {
    const items = Array.from({ length: 25 }, (_, index) => index)
    const seen: number[] = []

    await mapWithConcurrency(items, 4, async (item) => {
      seen.push(item)
    })

    expect([...seen].sort((a, b) => a - b)).toEqual(items)
  })

  it('handles an empty list without spawning workers', async () => {
    let calls = 0

    const results = await mapWithConcurrency([], 4, async () => {
      calls++
      return 'never'
    })

    expect(results).toEqual([])
    expect(calls).toBe(0)
  })

  it('caps workers at the item count when the limit is higher', async () => {
    let peak = 0
    let inFlight = 0

    await mapWithConcurrency([1, 2], 10, async (value) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight--
      return value
    })

    expect(peak).toBe(2)
  })

  it('still makes progress when the limit is zero or negative', async () => {
    expect(await mapWithConcurrency([1, 2, 3], 0, async (n) => n * 2)).toEqual([
      2, 4, 6
    ])
  })
})
