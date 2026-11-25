import { describe, expect, it } from 'vitest'
import { parse } from 'node-html-parser'
import {
  PUBLISHED_RFCS,
  RFC_IMAGE_DIR,
  RFC_SNAPSHOT_DIR
} from '../../data/docs/rfcs'
import { collectRfcImageSources } from './rfcImages'
import { renderRfcMarkdown, rfcMarkdownToHtml } from './renderRfcMarkdown'
import {
  getRfcImageUrl,
  getRfcSnapshot,
  rfcIdFromSnapshotPath,
  rfcImagePaths,
  rfcSnapshotIds,
  rfcSnapshotPaths
} from './rfcSnapshots'

const publishedIds = PUBLISHED_RFCS.map(({ id }) => id)

describe('RFC snapshots', () => {
  // The glob repeats RFC_SNAPSHOT_DIR as a literal. If the two drift, the sync
  // writes one folder while the pages read another, and upstream updates stop
  // reaching the site with every other test still green.
  it('reads the folder the sync writes to', () => {
    const outside = rfcSnapshotPaths().filter(
      (snapshotPath) => !snapshotPath.startsWith(`/${RFC_SNAPSHOT_DIR}/`)
    )
    expect(rfcSnapshotPaths()).not.toEqual([])
    expect(outside).toEqual([])
  })

  it('has a snapshot for every published RFC', () => {
    const missing = publishedIds.filter((id) => !rfcSnapshotIds().includes(id))
    expect(missing, 'run pnpm sync:rfcs').toEqual([])
  })

  it('has no snapshot without a published RFC', () => {
    const published = new Set<string>(publishedIds)
    const orphans = rfcSnapshotIds().filter((id) => !published.has(id))
    expect(orphans, 'run pnpm sync:rfcs to remove them').toEqual([])
  })

  it.each(publishedIds)('%s snapshot is not empty', (id) => {
    expect(snapshotOf(id).trim()).not.toBe('')
  })
})

function snapshotOf(id: string): string {
  const markdown = getRfcSnapshot(id)
  if (markdown instanceof Error) throw markdown
  return markdown
}

describe('RFC images', () => {
  // INTORG-1465: the diagrams loaded from GitHub at view time, so an upstream
  // SVG change went live unreviewed and a GitHub outage broke the images.
  it.each(PUBLISHED_RFCS)('$id shows no image from GitHub', (rfc) => {
    const html = renderRfcMarkdown(snapshotOf(rfc.id), {
      sourceUrl: rfc.sourceRawUrl,
      docsBasePath: '/developers',
      localImageUrl: getRfcImageUrl
    })
    if (html instanceof Error) throw html

    const remote = parse(html)
      .querySelectorAll('img')
      .map((img) => img.getAttribute('src') ?? '')
      .filter((src) => src.includes('githubusercontent.com'))
    expect(remote).toEqual([])
  })

  it('reads the folder the sync writes images to', () => {
    const outside = rfcImagePaths().filter(
      (imagePath) => !imagePath.startsWith(`/${RFC_IMAGE_DIR}/`)
    )
    expect(outside).toEqual([])
  })

  it('has no image that no RFC shows', () => {
    const shown = new Set(
      PUBLISHED_RFCS.flatMap((rfc) =>
        collectRfcImageSources(
          rfcMarkdownToHtml(snapshotOf(rfc.id)),
          rfc.sourceRawUrl
        ).map(({ sourcePath }) => `/${RFC_IMAGE_DIR}/${sourcePath}`)
      )
    )
    const orphans = rfcImagePaths().filter((imagePath) => !shown.has(imagePath))
    expect(orphans, 'run pnpm sync:rfcs to remove them').toEqual([])
  })
})

describe('getRfcSnapshot', () => {
  it('returns an error naming the id and the fix when there is no snapshot', () => {
    const result = getRfcSnapshot('no-such-rfc')
    expect(result).toBeInstanceOf(Error)
    expect(String(result)).toContain('no-such-rfc')
    expect(String(result)).toContain('pnpm sync:rfcs')
  })
})

describe('rfcIdFromSnapshotPath', () => {
  it('takes the id from the file name', () => {
    expect(
      rfcIdFromSnapshotPath('/src/data/docs/rfcs/stream-protocol.md')
    ).toBe('stream-protocol')
  })
})
