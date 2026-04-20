export function stripTrailingSlash(path: string): string {
  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path
}

export function addTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`
}
