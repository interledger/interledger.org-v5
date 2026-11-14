import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitCommandError } from '../src/utils/gitSync'
import {
  readSyncAllFromCloneConfig,
  syncAllArgs,
  syncAllFromClone,
  type SyncAllFromCloneConfig,
  type SyncAllFromCloneDeps
} from './syncAllFromClone'

const required = {
  GIT_REPO_URL: 'https://example.org/repo.git',
  GIT_BRANCH: 'staging',
  GIT_REPO_PATH: '/tmp/repo',
  STRAPI_URL: 'http://strapi:1337',
  STRAPI_API_TOKEN: 'token'
}

describe('readSyncAllFromCloneConfig', () => {
  it('reads the configuration', () => {
    expect(readSyncAllFromCloneConfig(required)).toEqual({
      repoUrl: required.GIT_REPO_URL,
      branch: 'staging',
      repoPath: '/tmp/repo',
      strapiUrl: 'http://strapi:1337',
      force: false
    })
  })

  it('reads SYNC_FORCE', () => {
    const config = readSyncAllFromCloneConfig({
      ...required,
      SYNC_FORCE: 'true'
    })

    expect(config).toMatchObject({ force: true })
  })

  it('requires the API token, although only the sync scripts read it', () => {
    const config = readSyncAllFromCloneConfig({
      ...required,
      STRAPI_API_TOKEN: ''
    })

    expect((config as Error).message).toBe(
      'Missing environment variables: STRAPI_API_TOKEN'
    )
  })
})

describe('syncAllArgs', () => {
  it('passes --force only when asked', () => {
    expect(syncAllArgs(false)).toEqual([])
    expect(syncAllArgs(true)).toEqual(['--force'])
  })
})

describe('syncAllFromClone', () => {
  let root: string
  let config: SyncAllFromCloneConfig

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-sync-all-'))
    config = {
      repoUrl: 'https://example.org/repo.git',
      branch: 'staging',
      repoPath: path.join(root, 'repo'),
      strapiUrl: 'http://strapi:1337',
      force: true
    }
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  function fakeDeps(
    overrides: Partial<SyncAllFromCloneDeps> = {}
  ): SyncAllFromCloneDeps {
    return {
      git: vi.fn(async () => 'abc1234 subject'),
      log: vi.fn(),
      waitForStrapi: vi.fn(async () => undefined),
      runSyncAll: vi.fn(() => 0),
      ...overrides
    }
  }

  it('clones a fresh shallow copy, then syncs from it', async () => {
    fs.mkdirSync(config.repoPath)
    fs.writeFileSync(path.join(config.repoPath, 'leftover'), 'x')
    const deps = fakeDeps()

    expect(await syncAllFromClone(config, deps)).toBe(0)
    expect(fs.existsSync(config.repoPath)).toBe(false)
    expect(deps.git).toHaveBeenCalledWith(
      [
        'clone',
        '--depth',
        '1',
        '--branch',
        'staging',
        config.repoUrl,
        config.repoPath
      ],
      root
    )
    expect(deps.log).toHaveBeenCalledWith('Syncing from abc1234 subject')
    expect(deps.runSyncAll).toHaveBeenCalledWith(['--force'], config.repoPath)
  })

  it('returns the exit code of sync:all', async () => {
    const deps = fakeDeps({ runSyncAll: vi.fn(() => 3) })

    expect(await syncAllFromClone(config, deps)).toBe(3)
  })

  it('does not clone while Strapi is unhealthy', async () => {
    const deps = fakeDeps({
      waitForStrapi: vi.fn(async () => new Error('not running'))
    })

    expect(await syncAllFromClone(config, deps)).toEqual(
      new Error('not running')
    )
    expect(deps.git).not.toHaveBeenCalled()
    expect(deps.runSyncAll).not.toHaveBeenCalled()
  })

  it('does not sync when the clone fails', async () => {
    const cloneError = new GitCommandError('git clone', '', 'denied', 'denied')
    const deps = fakeDeps({ git: vi.fn(async () => cloneError) })

    expect(await syncAllFromClone(config, deps)).toBe(cloneError)
    expect(deps.runSyncAll).not.toHaveBeenCalled()
  })
})
