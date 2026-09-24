/**
 * Reports MDX files whose name does not match their frontmatter, and renames
 * them on request. See `checkMdxFilenames.ts` for why a mismatch matters.
 *
 * Usage, from the cms directory:
 *   pnpm run check:mdx-filenames          report mismatches, exit 1 on any
 *   pnpm run check:mdx-filenames:fix      rename the mismatched files
 */

import { PATHS, getProjectRoot } from '../src/utils/paths'
import { CONTENT_COLLECTIONS } from '../src/utils/contentCollections'
import {
  checkMdxFilenames,
  collectionDir,
  isRenameBlocked,
  renameFile,
  type Finding
} from './checkMdxFilenames'

function describe(finding: Finding): string {
  return finding.expected
    ? `   ${finding.actual}\n      should be ${finding.expected}`
    : `   ${finding.actual}\n      ${finding.problem}`
}

/** Prints the findings grouped by collection, in the order they are checked. */
function report(findings: Finding[], checked: number): void {
  console.error(`❌ ${findings.length} of ${checked} MDX files are misnamed.\n`)

  for (const collection of CONTENT_COLLECTIONS) {
    const forCollection = findings.filter((f) => f.collection === collection)
    if (forCollection.length === 0) continue
    console.error(`📁 ${PATHS.CONTENT[collection]}`)
    for (const finding of forCollection) console.error(describe(finding))
  }
}

/**
 * Renames what can be renamed. A file is skipped when the derived name is
 * already taken, because the two would then be one Strapi entry and only an
 * editor can say which content to keep.
 */
function fix(projectRoot: string, findings: Finding[]): void {
  for (const finding of findings) {
    if (!finding.expected) continue
    const dir = collectionDir(projectRoot, finding.collection)

    if (isRenameBlocked(dir, finding.actual, finding.expected)) {
      console.error(
        `⚠️  Skipped ${finding.actual}: ${finding.expected} already exists.` +
          ' Both map to one Strapi entry, so remove the stale one by hand.'
      )
      continue
    }

    renameFile(dir, finding.actual, finding.expected)
    console.log(`🔤 Renamed ${finding.actual} → ${finding.expected}`)
  }
}

function main(): void {
  const shouldFix = process.argv.includes('--fix')
  const projectRoot = getProjectRoot()
  const { checked, findings } = checkMdxFilenames(projectRoot)

  if (findings.length === 0) {
    console.log(`✅ All ${checked} MDX filenames match their frontmatter.`)
    return
  }

  report(findings, checked)

  if (!shouldFix) {
    console.error(
      '\nEach one is a duplicate waiting to happen: the next publish writes the' +
        '\nderived name beside it. Run `pnpm run check:mdx-filenames:fix` to' +
        '\nrename them. Routes come from pathSlug, so no URL changes.'
    )
    process.exit(1)
  }

  console.error('')
  fix(projectRoot, findings)

  const unfixable = findings.filter((finding) => !finding.expected)
  if (unfixable.length > 0) {
    console.error(
      `\n⚠️  ${unfixable.length} file(s) need a pathSlug before they can be named.`
    )
    process.exit(1)
  }
}

main()
