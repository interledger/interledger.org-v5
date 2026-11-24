import { describe, expect, it } from 'vitest'
import { PUBLISHED_RFCS, RFC_SNAPSHOT_DIR } from '../../data/docs/rfcs'
import {
  getRfcSnapshot,
  rfcIdFromSnapshotPath,
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
    const markdown = getRfcSnapshot(id)
    if (markdown instanceof Error) throw markdown
    expect(markdown.trim()).not.toBe('')
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
