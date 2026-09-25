import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RedirectEntry } from './redirects'

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'redirects-lifecycle-'))
const outputPath = path.join(repoRoot, 'src/config/redirects.json')

const gitCommitAndPush = vi.fn()
let skipExport = false

vi.mock('./gitSync', () => ({
  getTargetRepoRoot: () => repoRoot,
  gitCommitAndPush: (...args: unknown[]) => gitCommitAndPush(...args)
}))

vi.mock('./pageLifecycle', () => ({
  shouldSkipMdxExport: () => skipExport
}))

const { createRedirectsLifecycle } = await import('./redirectsLifecycle')

function stubStrapi(rows: RedirectEntry[]) {
  const findMany = vi.fn(
    async ({ start, limit }: { start: number; limit: number }) =>
      rows.slice(start, start + limit)
  )
  vi.stubGlobal('strapi', { documents: () => ({ findMany }) })
  return findMany
}

function readOutput(): Record<string, unknown[]> {
  return JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
}

beforeEach(() => {
  skipExport = false
  gitCommitAndPush.mockReset()
  fs.rmSync(path.join(repoRoot, 'src'), { recursive: true, force: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createRedirectsLifecycle', () => {
  it('rewrites the whole file from the database and commits it', async () => {
    stubStrapi([
      { source: '/b', destination: '/y', category: 'hackathon' },
      { source: '/a', destination: '/x', category: 'hackathon' }
    ])

    await createRedirectsLifecycle().afterCreate({ result: { source: '/b' } })

    expect(readOutput().hackathon).toEqual([
      { source: '/a', destination: '/x', status: 301 },
      { source: '/b', destination: '/y', status: 301 }
    ])
    expect(gitCommitAndPush).toHaveBeenCalledWith(
      outputPath,
      'redirect: add /b'
    )
  })

  it('pages through more rows than one query returns', async () => {
    const rows: RedirectEntry[] = Array.from({ length: 501 }, (_, i) => ({
      source: `/old-${String(i).padStart(3, '0')}`,
      destination: '/new',
      category: 'site_pages'
    }))
    const findMany = stubStrapi(rows)

    await createRedirectsLifecycle().afterUpdate({ result: { source: '/x' } })

    expect(findMany).toHaveBeenCalledTimes(2)
    expect(readOutput().site_pages).toHaveLength(501)
  })

  it('names the change in the commit, falling back when there is no result', async () => {
    stubStrapi([])
    const lifecycle = createRedirectsLifecycle()

    await lifecycle.afterDelete({ result: { source: '/gone' } })
    await lifecycle.afterDeleteMany()

    expect(gitCommitAndPush.mock.calls.map(([, message]) => message)).toEqual([
      'redirect: delete /gone',
      'redirect: delete redirects'
    ])
  })

  it('writes nothing when the request asks to skip the export', async () => {
    skipExport = true
    const findMany = stubStrapi([])

    await createRedirectsLifecycle().afterUpdate({})

    expect(findMany).not.toHaveBeenCalled()
    expect(fs.existsSync(outputPath)).toBe(false)
    expect(gitCommitAndPush).not.toHaveBeenCalled()
  })

  it('logs instead of failing the save when the export throws', async () => {
    vi.stubGlobal('strapi', {
      documents: () => ({
        findMany: async () => {
          throw new Error('db down')
        }
      })
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      createRedirectsLifecycle().afterUpdate({})
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalled()
    expect(gitCommitAndPush).not.toHaveBeenCalled()
  })
})
