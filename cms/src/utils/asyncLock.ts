import { AsyncLocalStorage } from 'async_hooks'
import { tryCatchAsync } from './tryCatch'

/**
 * One hold on a lock. `released` flips when the holder's work settles, so
 * async work it started that outlives it (a timer, a stray promise) inherits
 * the context but can't mistake itself for the holder.
 */
interface LockHold {
  released: boolean
}

export interface AsyncLock {
  /**
   * Run `fn` once every earlier holder has finished. Holders run one at a
   * time in call order. Calls made inside `fn` run straight away instead of
   * queueing behind it, so a critical section can call code that takes the
   * same lock without deadlocking; those nested calls don't serialize
   * against each other, so await them in turn.
   *
   * Never rejects: a throw from `fn` comes back as an `Error`, and the next
   * holder still runs.
   */
  run<T>(fn: () => T | Promise<T>): Promise<T | Error>
}

/**
 * An in-process mutex. It serializes work inside one Node process only;
 * several Strapi instances sharing a database or checkout would need a lock
 * outside the process.
 */
export function createAsyncLock(): AsyncLock {
  const holder = new AsyncLocalStorage<LockHold>()
  let tail: Promise<unknown> = Promise.resolve()

  return {
    run<T>(fn: () => T | Promise<T>): Promise<T | Error> {
      const current = holder.getStore()
      if (current && !current.released) return tryCatchAsync(fn)

      const next = tail.then(() => {
        const hold: LockHold = { released: false }
        return holder
          .run(hold, () => tryCatchAsync(fn))
          .finally(() => {
            hold.released = true
          })
      })
      tail = next
      return next
    }
  }
}
