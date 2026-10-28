import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GrantReport, GranteeProfile } from '@/types/airtable'
import {
  PROFILE_IMAGES_DIR,
  REPORT_IMAGES_DIR
} from '@/utils/main/syncedImages'

const PUBLIC_DIR = path.resolve(__dirname, '../public')
const DATA_DIR = path.resolve(__dirname, 'data/airtable')

/**
 * The Airtable sync writes the JSON files and the images in one commit. This
 * catches the two drifting apart anyway, for example a hand edit or a partial
 * revert: a JSON image with no file is a broken image on the page, and a file
 * with no JSON image is dead weight in the repo.
 */
function readJson<T>(file: string): T[] {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8'))
}

function listStoredImages(dir: string): string[] {
  const dirPath = path.join(PUBLIC_DIR, dir)
  if (!existsSync(dirPath)) return []
  return readdirSync(dirPath, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(dirPath, file))
    .filter((file) => path.extname(file) !== '')
    .map(
      (file) => `/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`
    )
}

const IMAGE_SETS = [
  {
    name: 'grant report images',
    dir: REPORT_IMAGES_DIR,
    paths: readJson<GrantReport>('grant-reports.json').flatMap(({ images }) =>
      images.map((image) => image.path)
    )
  },
  {
    name: 'grantee logos',
    dir: PROFILE_IMAGES_DIR,
    paths: readJson<GranteeProfile>('grantee-profiles.json').flatMap(
      ({ logo }) => (logo ? [logo.path] : [])
    )
  }
]

describe.each(IMAGE_SETS)('$name', ({ dir, paths }) => {
  it('has a file for every image in the JSON', () => {
    const missing = paths.filter(
      (imagePath) => !existsSync(path.join(PUBLIC_DIR, imagePath))
    )
    expect(missing).toEqual([])
  })

  it('has no stored image that the JSON does not use', () => {
    const used = new Set(paths)
    expect(listStoredImages(dir).filter((file) => !used.has(file))).toEqual([])
  })
})
