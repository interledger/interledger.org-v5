import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GrantReport } from '@/types/airtable'
import { REPORT_IMAGES_DIR } from '@/utils/main/reportImages'

const PUBLIC_DIR = path.resolve(__dirname, '../public')
const REPORTS_JSON = path.resolve(__dirname, 'data/airtable/grant-reports.json')

/**
 * The Airtable sync writes grant-reports.json and the report images in one
 * commit. This catches the two drifting apart anyway, for example a hand edit
 * or a partial revert: a JSON image with no file is a broken image on the
 * page, and a file with no JSON image is dead weight in the repo.
 */
function readReports(): GrantReport[] {
  return JSON.parse(readFileSync(REPORTS_JSON, 'utf8'))
}

function listStoredImages(): string[] {
  const dir = path.join(PUBLIC_DIR, REPORT_IMAGES_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(dir, file))
    .filter((file) => path.extname(file) !== '')
    .map(
      (file) => `/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`
    )
}

describe('grant report images', () => {
  const reports = readReports()
  const jsonPaths = reports.flatMap(({ images }) => images.map((i) => i.path))

  it('has a file for every image in grant-reports.json', () => {
    const missing = jsonPaths.filter(
      (imagePath) => !existsSync(path.join(PUBLIC_DIR, imagePath))
    )
    expect(missing).toEqual([])
  })

  it('has no stored image that grant-reports.json does not use', () => {
    const used = new Set(jsonPaths)
    expect(listStoredImages().filter((file) => !used.has(file))).toEqual([])
  })
})
