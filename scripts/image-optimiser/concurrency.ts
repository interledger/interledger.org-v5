/**
 * Runs `task` over `items` with at most `limit` in flight, preserving input
 * order in the returned array.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  const workerCount = Math.min(Math.max(limit, 1), items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await task(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}
