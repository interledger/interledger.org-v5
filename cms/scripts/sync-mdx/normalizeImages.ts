/**
 * Converts <img> HTML/JSX tags in MDX content to markdown image syntax.
 *
 * CKEditor5 (used by Strapi) handles markdown images correctly but escapes
 * raw <img> tags with JSX attributes (e.g. style={{}}) as literal text,
 * breaking the image. Running this before sending content to Strapi prevents
 * that.
 *
 * Drops all attributes except src and alt (e.g. style, className).
 */
export function normalizeInlineImages(content: string): string {
  return content.replace(/<img\s+([^>]*?)\s*\/?>/g, (_, attrs) => {
    const src = /\bsrc="([^"]*)"/.exec(attrs)?.[1] ?? ''
    const alt = /\balt="([^"]*)"/.exec(attrs)?.[1] ?? ''
    return `![${alt}](${src})`
  })
}
