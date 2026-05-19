import { describe, expect, it } from 'vitest'
import { tryCatchAsync } from './tryCatch'

describe('tryCatchAsync', () => {
  it('returns the resolved value when the function succeeds', async () => {
    const result = await tryCatchAsync(async () => 42)
    expect(result).toBe(42)
  })

  it('returns the rejected Error instead of throwing', async () => {
    const boom = new Error('boom')
    const result = await tryCatchAsync(async () => {
      throw boom
    })
    expect(result).toBe(boom)
  })

  it('coerces non-Error throws into Error so the return type holds', async () => {
    const result = await tryCatchAsync(async () => {
      throw 'just a string'
    })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('just a string')
  })

  it('catches synchronous throws when given a sync function', async () => {
    const result = await tryCatchAsync(() => {
      throw new Error('sync throw')
    })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('sync throw')
  })

  it('returns sync values when given a non-async function', async () => {
    const result = await tryCatchAsync(() => 'sync result')
    expect(result).toBe('sync result')
  })
})
