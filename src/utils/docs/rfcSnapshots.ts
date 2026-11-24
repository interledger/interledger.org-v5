/**
 * Local snapshots of the upstream RFC markdown, written by `pnpm sync:rfcs`
 * (scripts/sync-rfcs.ts). RFC pages render from these so the build never
 * fetches from GitHub. The glob bundles the files at build time.
 */
import { RFC_SNAPSHOT_DIR } from '../../data/docs/rfcs'

// import.meta.glob takes only a literal, so this repeats RFC_SNAPSHOT_DIR.
const SNAPSHOTS = import.meta.glob<string>('/src/data/docs/rfcs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
})

const SNAPSHOT_BY_ID = new Map(
  Object.entries(SNAPSHOTS).map(([path, markdown]) => [
    rfcIdFromSnapshotPath(path),
    markdown
  ])
)

export function rfcIdFromSnapshotPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.md$/, '')
}

/** The files the glob bundled, as root-relative paths such as `/src/…/x.md`. */
export function rfcSnapshotPaths(): string[] {
  return Object.keys(SNAPSHOTS)
}

export function rfcSnapshotIds(): string[] {
  return [...SNAPSHOT_BY_ID.keys()]
}

export function getRfcSnapshot(id: string): string | Error {
  const markdown = SNAPSHOT_BY_ID.get(id)
  if (markdown === undefined) {
    return new Error(
      `No RFC snapshot for "${id}" in ${RFC_SNAPSHOT_DIR}. Run pnpm sync:rfcs.`
    )
  }
  return markdown
}
