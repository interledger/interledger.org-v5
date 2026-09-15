export async function tryCatchAsync<T>(
  fn: () => T | Promise<T>
): Promise<T | Error> {
  try {
    return await fn()
  } catch (err) {
    // JS lets you throw any value; coerce non-Error throws so the return type holds.
    return err instanceof Error ? err : new Error(String(err))
  }
}

/**
 * The synchronous counterpart to {@link tryCatchAsync}, for wrapping throwing
 * synchronous APIs such as `fs.writeFileSync` or `JSON.parse`.
 */
export function tryCatch<T>(fn: () => T): T | Error {
  try {
    return fn()
  } catch (err) {
    // JS lets you throw any value; coerce non-Error throws so the return type holds.
    return err instanceof Error ? err : new Error(String(err))
  }
}
