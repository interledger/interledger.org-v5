import { tryCatchAsync } from '@/utils'

/**
 * Runs `write` for every item and retries the ones that failed until a pass
 * makes no progress. Returns an Error that lists the last failures, if any.
 *
 * The redirect sync needs this because the server checks each write for
 * chains against the table as it is at that moment. A valid file can fail on
 * one row while a row later in the file still holds its old value, and pass
 * once that row is written.
 */
export async function writeUntilSettled<T>(
  items: T[],
  write: (item: T) => Promise<void>,
  onRetry: (count: number) => void = () => {}
): Promise<undefined | Error> {
  let pending = items
  while (pending.length > 0) {
    const failed: { item: T; error: Error }[] = []
    for (const item of pending) {
      const result = await tryCatchAsync(() => write(item))
      if (result instanceof Error) failed.push({ item, error: result })
    }
    if (failed.length === 0) return undefined
    if (failed.length === pending.length) {
      return new Error(
        `${failed.length} write(s) failed:\n  ${failed.map(({ error }) => error.message).join('\n  ')}`
      )
    }
    onRetry(failed.length)
    pending = failed.map(({ item }) => item)
  }
  return undefined
}
