/**
 * RFC images, such as the diagrams in the architecture RFC, are synced next to
 * the markdown snapshots so a page never loads them from GitHub. Upstream
 * writes them as absolute raw.githubusercontent.com URLs or as paths relative
 * to the RFC; both resolve to a path in interledger/rfcs, the "source path",
 * which keys the local copy.
 */
import path from 'node:path'
import { parse } from 'node-html-parser'
import { parseRawGitHubPath } from './parseRawGitHubPath'

const { posix } = path

const RFC_RAW_URL_PREFIX = 'https://raw.githubusercontent.com/interledger/rfcs/'

export type RfcImageSource = {
  /** Path inside interledger/rfcs, e.g. `shared/graphs/protocol-suite.svg`. */
  sourcePath: string
  /** Where the sync downloads it from. */
  downloadUrl: string
}

function isAbsoluteUrl(src: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(src) || src.startsWith('//')
}

/**
 * Resolve an `<img src>` from an RFC to the interledger/rfcs file it shows.
 * Returns null for an image hosted anywhere else, which stays as it is.
 */
export function resolveRfcImageSource(
  src: string,
  rfcSourceUrl: string
): RfcImageSource | null {
  if (src.startsWith(RFC_RAW_URL_PREFIX)) {
    const { sourcePath } = parseRawGitHubPath(src, 'RFC image URL')
    return { sourcePath, downloadUrl: src }
  }

  if (isAbsoluteUrl(src) || src.startsWith('/') || src === '') {
    return null
  }

  const { branch, sourcePath: rfcPath } = parseRawGitHubPath(
    rfcSourceUrl,
    'RFC source URL'
  )
  const sourcePath = posix.normalize(posix.join(posix.dirname(rfcPath), src))
  return {
    sourcePath,
    downloadUrl: `${RFC_RAW_URL_PREFIX}${branch}/${sourcePath}`
  }
}

/** Every interledger/rfcs image an RFC's rendered HTML shows, once each. */
export function collectRfcImageSources(
  html: string,
  rfcSourceUrl: string
): RfcImageSource[] {
  const bySourcePath = new Map<string, RfcImageSource>()
  for (const img of parse(html).querySelectorAll('img[src]')) {
    const image = resolveRfcImageSource(
      img.getAttribute('src') ?? '',
      rfcSourceUrl
    )
    if (image) bySourcePath.set(image.sourcePath, image)
  }
  return [...bySourcePath.values()]
}

/**
 * Point every interledger/rfcs `<img>` at its local copy. An image with no
 * local copy is an error rather than a fallback to GitHub: falling back would
 * quietly bring back the runtime dependency the snapshots exist to remove.
 */
export function rewriteRfcImages(
  html: string,
  rfcSourceUrl: string,
  localImageUrl: (sourcePath: string) => string | undefined
): string | Error {
  const document = parse(html)
  const missing: string[] = []

  for (const img of document.querySelectorAll('img[src]')) {
    const image = resolveRfcImageSource(
      img.getAttribute('src') ?? '',
      rfcSourceUrl
    )
    if (!image) continue

    const localUrl = localImageUrl(image.sourcePath)
    if (localUrl === undefined) {
      missing.push(image.sourcePath)
      continue
    }
    img.setAttribute('src', localUrl)
  }

  if (missing.length > 0) {
    return new Error(
      `No local copy of RFC image(s) ${missing.join(', ')} for ${rfcSourceUrl}. Run pnpm sync:rfcs.`
    )
  }
  return document.toString()
}
