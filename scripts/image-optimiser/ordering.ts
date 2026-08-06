/**
 * Codepoint comparison, deliberately not `localeCompare`: generated manifests
 * are compared across machines and CI runners, so their order must not depend
 * on the host's locale data.
 */
export function compareStrings(a: string, b: string): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}
