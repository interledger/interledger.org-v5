// Every value, in order, or one Error joining the message of each result that
// failed, so a caller running independent steps reports every failure at once.
export function collectResults<const T extends readonly unknown[]>(results: {
  readonly [K in keyof T]: T[K] | Error
}): T | Error {
  const errors = results.filter(
    (result): result is Error => result instanceof Error
  )
  if (errors.length > 0) {
    return new Error(errors.map((error) => error.message).join('\n\n'))
  }
  // No result is an Error, so each one is its step's value.
  return results as unknown as T
}
