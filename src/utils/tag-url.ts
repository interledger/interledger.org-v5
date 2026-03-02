export function getTagUrl(path: string, tag: string) {
  const slug = tag.toLowerCase().replace(/\s+/g, '-')
  return `${path}/tag/${slug}`
}

export function getTagSlug(tag: string) {
  return tag.toLowerCase().replace(/\s+/g, '-')
}
