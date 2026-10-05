import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEV_BUILD_ID,
  createServerStatusHandler,
  readAdminBuildId,
  resolveAdminIndexHtmlPath,
  type ServerStatusContext
} from './serverStatusEndpoint'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'cms-status-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { recursive: true, force: true })
  }
})

function makeContext(): ServerStatusContext & {
  headers: Record<string, string>
} {
  const headers: Record<string, string> = {}
  return {
    headers,
    set(field, value) {
      headers[field] = value
    }
  }
}

// ── resolveAdminIndexHtmlPath ───────────────────────────────────────────────

describe('resolveAdminIndexHtmlPath', () => {
  it('points at the admin entry that strapi build writes', () => {
    expect(resolveAdminIndexHtmlPath('/srv/cms')).toBe(
      path.join('/srv/cms', 'dist', 'build', 'index.html')
    )
  })
})

// ── readAdminBuildId ────────────────────────────────────────────────────────

describe('readAdminBuildId', () => {
  it('reports the dev build id when no admin has been built', () => {
    const dir = makeTempDir()

    expect(readAdminBuildId(path.join(dir, 'missing.html'))).toBe(DEV_BUILD_ID)
  })

  it('hashes the built entry', () => {
    const dir = makeTempDir()
    const file = path.join(dir, 'index.html')
    writeFileSync(file, '<script src="/admin/app-abc123.js"></script>')

    const buildId = readAdminBuildId(file)

    expect(buildId).not.toBeInstanceOf(Error)
    expect(buildId).toMatch(/^[0-9a-f]{16}$/)
  })

  it('changes when the entry changes and is stable when it does not', () => {
    const dir = makeTempDir()
    const file = path.join(dir, 'index.html')

    writeFileSync(file, '<script src="/admin/app-abc123.js"></script>')
    const before = readAdminBuildId(file)
    expect(readAdminBuildId(file)).toBe(before)

    writeFileSync(file, '<script src="/admin/app-def456.js"></script>')
    expect(readAdminBuildId(file)).not.toBe(before)
  })

  it('returns an Error when the entry exists but cannot be read', () => {
    const dir = makeTempDir()
    const file = path.join(dir, 'index.html')
    writeFileSync(file, 'unreadable')
    chmodSync(file, 0o000)

    const result = readAdminBuildId(file)

    chmodSync(file, 0o644)
    // Root ignores file permissions, so only assert when the read really failed.
    if (result instanceof Error) {
      expect(result.message).toContain('Could not read the admin build')
    } else {
      expect(result).toMatch(/^[0-9a-f]{16}$/)
    }
  })
})

// ── createServerStatusHandler ───────────────────────────────────────────────

describe('createServerStatusHandler', () => {
  it('returns the boot and build identity plus the server clock', () => {
    const handler = createServerStatusHandler(
      { bootId: 'boot-1', buildId: 'build-1' },
      () => 1_700_000_000_000
    )
    const ctx = makeContext()

    handler(ctx)

    expect(ctx.body).toEqual({
      bootId: 'boot-1',
      buildId: 'build-1',
      serverTime: 1_700_000_000_000
    })
  })

  it('forbids caching, so a proxy cannot pin a stale identity', () => {
    const handler = createServerStatusHandler({
      bootId: 'boot-1',
      buildId: 'build-1'
    })
    const ctx = makeContext()

    handler(ctx)

    expect(ctx.headers['Cache-Control']).toBe('no-store')
  })

  it('reports no uptime — the endpoint is unauthenticated', () => {
    const handler = createServerStatusHandler({
      bootId: 'boot-1',
      buildId: 'build-1'
    })
    const ctx = makeContext()

    handler(ctx)

    expect(Object.keys(ctx.body as object).sort()).toEqual([
      'bootId',
      'buildId',
      'serverTime'
    ])
  })
})
