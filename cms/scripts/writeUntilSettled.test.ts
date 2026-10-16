import { describe, expect, it } from 'vitest'
import { writeUntilSettled } from './writeUntilSettled'

/**
 * A fake store that refuses a write while a row it depends on still holds
 * its old value, as the server's chain check does.
 */
function storeWithDependencies(dependsOn: Record<string, string>) {
  const written: string[] = []
  const attempts: string[] = []
  const write = async (item: string) => {
    attempts.push(item)
    const blocker = dependsOn[item]
    if (blocker && !written.includes(blocker)) {
      throw new Error(`${item} is blocked by ${blocker}`)
    }
    written.push(item)
  }
  return { write, written, attempts }
}

describe('writeUntilSettled', () => {
  // INTORG-1295: the create of /es/tech/hacktoberfest/ came first in the
  // file, but only passes once /es/hacktoberfest/ points past it.
  it('retries a write that passes once a later write lands', async () => {
    const store = storeWithDependencies({ create: 'update' })

    const result = await writeUntilSettled(['create', 'update'], store.write)

    expect(result).toBeUndefined()
    expect(store.written).toEqual(['update', 'create'])
  })

  it('settles a dependency chain over several passes', async () => {
    const store = storeWithDependencies({ a: 'b', b: 'c' })
    const retries: number[] = []

    const result = await writeUntilSettled(['a', 'b', 'c'], store.write, (n) =>
      retries.push(n)
    )

    expect(result).toBeUndefined()
    expect(store.written).toEqual(['c', 'b', 'a'])
    expect(retries).toEqual([2, 1])
  })

  it('returns every failure when a pass makes no progress', async () => {
    const store = storeWithDependencies({ a: 'missing', b: 'missing' })

    const result = await writeUntilSettled(['a', 'b'], store.write)

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('a is blocked by missing')
    expect((result as Error).message).toContain('b is blocked by missing')
    expect(store.attempts).toEqual(['a', 'b'])
  })

  it('keeps the writes that passed when one never does', async () => {
    const store = storeWithDependencies({ a: 'missing' })

    const result = await writeUntilSettled(['a', 'b'], store.write)

    expect((result as Error).message).toContain('1 write(s) failed')
    expect(store.written).toEqual(['b'])
    expect(store.attempts).toEqual(['a', 'b', 'a'])
  })

  it('does nothing for no items', async () => {
    const store = storeWithDependencies({})

    await expect(writeUntilSettled([], store.write)).resolves.toBeUndefined()
    expect(store.attempts).toEqual([])
  })
})
