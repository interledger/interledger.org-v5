import { describe, expect, it } from 'vitest'
import { tryCatch, tryCatchAsync } from './tryCatch'

describe('tryCatchAsync', () => {
  it('returns the resolved value when the function succeeds', async () => {
    expect(await tryCatchAsync(async () => 42)).toBe(42)
  })

  it('returns the rejected Error instead of throwing', async () => {
    const boom = new Error('boom')
    expect(
      await tryCatchAsync(async () => {
        throw boom
      })
    ).toBe(boom)
  })

  it('coerces non-Error throws into Error so the return type holds', async () => {
    const result = await tryCatchAsync(async () => {
      throw 'just a string'
    })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('just a string')
  })
})

describe('tryCatch', () => {
  it('returns the value when the function succeeds', () => {
    expect(tryCatch(() => 42)).toBe(42)
  })

  it('returns the thrown Error instead of throwing', () => {
    const boom = new Error('boom')
    const result = tryCatch(() => {
      throw boom
    })

    expect(result).toBe(boom)
  })

  it('coerces non-Error throws into Error so the return type holds', () => {
    const result = tryCatch(() => {
      throw 'just a string'
    })

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('just a string')
  })

  it('preserves the errno code that callers narrow on', () => {
    // The lock implementation distinguishes EEXIST and ENOENT from real
    // failures, so the original error object has to survive intact.
    const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' })
    const result = tryCatch(() => {
      throw enoent
    })

    expect((result as NodeJS.ErrnoException).code).toBe('ENOENT')
  })
})
