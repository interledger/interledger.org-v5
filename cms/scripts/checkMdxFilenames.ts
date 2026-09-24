/**
 * Checks that every exported MDX file is named the way its Strapi lifecycle
 * would name it.
 *
 * A file whose name does not match its frontmatter is a latent duplicate: the
 * next publish writes the derived name beside it, both files then map to one
 * Strapi entry, and `sync:mdx` refuses the whole content type (INTORG-1237).
 * Renaming the file is always safe, because routes come from `pathSlug`, never
 * from the filename.
 *
 * Imports reach into `../src/utils/*` directly rather than through `@/utils`.
 * The barrel pulls in sharp, prettier and Strapi, and the CI job that runs this
 * installs with `--ignore-scripts`, so sharp has no built binary there.
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import matter from 'gray-matter'
import { PATHS } from '../src/utils/paths'
import { LOCALES, defaultLang } from '../src/utils/locales'
import { mdxRelativePath } from '../src/utils/mdxFilenames'
import {
  CONTENT_COLLECTIONS,
  CONTENT_COLLECTION_NAMING_RULES,
  type ContentCollection
} from '../src/utils/contentCollections'

/** An MDX file on disk, with the frontmatter its name should derive from. */
export interface ContentFile {
  collection: ContentCollection
  /** Path within the collection directory, locale folder included. */
  relativePath: string
  frontmatter: Record<string, unknown>
}

/** A file whose name does not match, or cannot be derived from, its frontmatter. */
export interface Finding {
  collection: ContentCollection
  actual: string
  /** The name the lifecycle would write. Absent when it cannot be derived. */
  expected?: string
  /** Why no name could be derived. Absent for an ordinary mismatch. */
  problem?: string
}

export interface CheckResult {
  /** Number of MDX files read. */
  checked: number
  findings: Finding[]
}

const LOCALE_DIRS = new Set(LOCALES.filter((locale) => locale !== defaultLang))

/** Directory holding one collection's MDX files, across all locales. */
export function collectionDir(
  projectRoot: string,
  collection: ContentCollection
): string {
  return path.join(projectRoot, PATHS.CONTENT_ROOT, PATHS.CONTENT[collection])
}

/**
 * Formats a frontmatter date as `YYYY-MM-DD`. YAML parses a bare `2026-01-22`
 * into a Date at UTC midnight, while a quoted one stays a string; both reach
 * this function and both must come back in the form the filename uses.
 */
export function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  }
  return typeof value === 'string' ? value.trim() : ''
}

/** Reads a frontmatter field as a trimmed string, or null when it is absent. */
function readString(
  frontmatter: Record<string, unknown>,
  field: string
): string | null {
  const value = frontmatter[field]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Locale of a file: its frontmatter, else the locale folder it sits in. */
export function resolveFileLocale(file: ContentFile): string {
  const declared = readString(file.frontmatter, 'locale')
  if (declared) return declared
  const firstSegment = file.relativePath.split('/')[0]
  return firstSegment && LOCALE_DIRS.has(firstSegment)
    ? firstSegment
    : defaultLang
}

/**
 * Compares each file against the name its lifecycle would write.
 * Returns one finding per file that does not match.
 */
export function findFilenameMismatches(files: ContentFile[]): Finding[] {
  const findings: Finding[] = []

  for (const file of files) {
    const { collection, relativePath, frontmatter } = file
    const pathSlug = readString(frontmatter, 'pathSlug')

    if (!pathSlug) {
      findings.push({
        collection,
        actual: relativePath,
        problem: 'no pathSlug in frontmatter, so no filename can be derived'
      })
      continue
    }

    let expected: string
    try {
      expected = mdxRelativePath(CONTENT_COLLECTION_NAMING_RULES[collection], {
        pathSlug,
        locale: resolveFileLocale(file),
        englishSlug: readString(frontmatter, 'localizes'),
        date: toIsoDate(frontmatter.date),
        section: readString(frontmatter, 'section')
      })
    } catch (error) {
      findings.push({
        collection,
        actual: relativePath,
        problem: error instanceof Error ? error.message : String(error)
      })
      continue
    }

    if (expected !== relativePath) {
      findings.push({ collection, actual: relativePath, expected })
    }
  }

  return findings
}

/** Reads every MDX file of one collection, across all locale folders. */
export function readCollection(
  projectRoot: string,
  collection: ContentCollection
): ContentFile[] {
  const dir = collectionDir(projectRoot, collection)
  if (!fs.existsSync(dir)) return []

  const entries = fs.readdirSync(dir, { recursive: true }) as string[]
  const files: ContentFile[] = []

  for (const entry of entries) {
    if (!entry.endsWith('.mdx')) continue
    const raw = fs.readFileSync(path.join(dir, entry), 'utf-8')
    files.push({
      collection,
      relativePath: entry.split(path.sep).join('/'),
      frontmatter: matter(raw).data as Record<string, unknown>
    })
  }

  return files
}

/** Reads every exported collection and reports the files that are misnamed. */
export function checkMdxFilenames(projectRoot: string): CheckResult {
  let checked = 0
  const findings: Finding[] = []

  for (const collection of CONTENT_COLLECTIONS) {
    const files = readCollection(projectRoot, collection)
    checked += files.length
    findings.push(...findFilenameMismatches(files))
  }

  return { checked, findings }
}

/**
 * True when the derived name already belongs to a different file.
 *
 * A rename that only changes case never collides: on the case-insensitive
 * filesystems macOS ships with, the two names are one file, so an existence
 * check on the destination reports the source itself.
 */
export function isRenameBlocked(
  dir: string,
  from: string,
  to: string
): boolean {
  if (from.toLowerCase() === to.toLowerCase()) return false
  return fs.existsSync(path.join(dir, to))
}

/**
 * Renames one file with `git mv`, so the move stays a rename in history.
 *
 * A rename that only changes case goes through a temporary name: on the
 * case-insensitive filesystems macOS ships with, source and destination are
 * one path, and git refuses to overwrite it.
 */
export function renameFile(dir: string, from: string, to: string): void {
  const gitMv = (source: string, destination: string) =>
    execFileSync('git', ['mv', source, destination], { cwd: dir })

  fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true })

  if (from.toLowerCase() === to.toLowerCase()) {
    const staging = `${to}.rename-staging`
    gitMv(from, staging)
    gitMv(staging, to)
    return
  }

  gitMv(from, to)
}
