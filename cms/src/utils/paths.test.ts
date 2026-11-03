import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDatabaseFilePath, getProjectRoot, PATHS } from './paths'

describe('getProjectRoot', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('STRAPI_PROJECT_ROOT', '')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns the parent directory when run from cms/', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/repo/cms')
    expect(getProjectRoot()).toBe('/repo')
  })

  it('returns cwd when run from the project root', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/repo')
    expect(getProjectRoot()).toBe('/repo')
  })

  it('prefers STRAPI_PROJECT_ROOT over cwd, for code and checkout in separate folders', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/app/cms')
    vi.stubEnv('STRAPI_PROJECT_ROOT', '/data/repo')
    expect(getProjectRoot()).toBe('/data/repo')
  })

  it('resolves a relative STRAPI_PROJECT_ROOT against cwd', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/app/cms')
    vi.stubEnv('STRAPI_PROJECT_ROOT', '../checkout')
    expect(getProjectRoot()).toBe(path.resolve('/app/cms', '../checkout'))
  })

  it('ignores an empty STRAPI_PROJECT_ROOT', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/repo/cms')
    vi.stubEnv('STRAPI_PROJECT_ROOT', '')
    expect(getProjectRoot()).toBe('/repo')
  })
})

describe('getDatabaseFilePath', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('DATABASE_FILENAME', '')
    vi.spyOn(process, 'cwd').mockReturnValue('/repo/cms')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('defaults to .tmp/data.db under cwd', () => {
    expect(getDatabaseFilePath()).toBe(path.join('/repo/cms', PATHS.DB_FILE))
  })

  it('resolves a relative DATABASE_FILENAME against cwd', () => {
    vi.stubEnv('DATABASE_FILENAME', '.tmp/ci-dry-run.db')
    expect(getDatabaseFilePath()).toBe('/repo/cms/.tmp/ci-dry-run.db')
  })

  it('keeps an absolute DATABASE_FILENAME, such as a path on a volume', () => {
    vi.stubEnv('DATABASE_FILENAME', '/data/db/data.db')
    expect(getDatabaseFilePath()).toBe('/data/db/data.db')
  })
})
