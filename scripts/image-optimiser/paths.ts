import path from 'node:path'

/**
 * Filesystem path → POSIX-separated string. Manifest keys and generated URLs
 * are compared across machines, so they must not carry Windows separators.
 */
export function toPosixPath(value: string): string {
  return value.split(path.sep).join('/')
}
