import { describe, expect, it } from 'vitest'
import { createAsyncLock } from './asyncLock'

// The queueing, re-entrancy and released-hold rules are exercised through
// withGitSyncLock in gitSync.test.ts; these cover what is per instance.
describe('createAsyncLock', () => {
  it('serializes holders of one lock', async () => {
    const lock = createAsyncLock()
    const events: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const first = lock.run(async () => {
      events.push('first:start')
      await gate
      events.push('first:end')
    })
    const second = lock.run(() => events.push('second'))
    await Promise.resolve()
    release()
    await Promise.all([first, second])

    expect(events).toEqual(['first:start', 'first:end', 'second'])
  })

  it('does not block holders of a different lock', async () => {
    const held = createAsyncLock()
    const other = createAsyncLock()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const holder = held.run(() => gate)
    const result = await other.run(() => 'ran')
    release()
    await holder

    expect(result).toBe('ran')
  })

  it('does not treat a hold on another lock as its own', async () => {
    const outer = createAsyncLock()
    const inner = createAsyncLock()
    const events: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const innerHolder = inner.run(async () => {
      events.push('inner:start')
      await gate
      events.push('inner:end')
    })
    const nested = outer.run(() =>
      inner.run(() => {
        events.push('nested')
      })
    )
    await Promise.resolve()
    release()
    await Promise.all([innerHolder, nested])

    expect(events).toEqual(['inner:start', 'inner:end', 'nested'])
  })
})
