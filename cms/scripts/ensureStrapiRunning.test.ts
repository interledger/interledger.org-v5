import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { assertStrapiRunning } from './ensureStrapiRunning'

type ProbeResult = { status: number } | Error

/** Answers each successive probe with the next scripted result, then repeats the last one. */
function stubFetch(results: ProbeResult[]) {
  let call = 0
  const fetchMock = vi.fn(async () => {
    const result = results[Math.min(call, results.length - 1)]!
    call++
    if (result instanceof Error) throw result
    return { status: result.status } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('assertStrapiRunning', () => {
  it('resolves on the first successful probe', async () => {
    const fetchMock = stubFetch([{ status: 200 }])

    await expect(
      assertStrapiRunning('http://strapi.test')
    ).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats 401/403/404 as reachable, not just 2xx', async () => {
    stubFetch([{ status: 404 }])

    await expect(
      assertStrapiRunning('http://strapi.test')
    ).resolves.toBeUndefined()
  })

  it('retries past a transient 502 and succeeds once Strapi is actually up', async () => {
    const fetchMock = stubFetch([
      { status: 502 },
      { status: 502 },
      { status: 200 }
    ])

    const result = assertStrapiRunning('http://strapi.test', 15000)
    await vi.advanceTimersByTimeAsync(2000)

    await expect(result).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries a network error the same as a 5xx', async () => {
    const fetchMock = stubFetch([new Error('ECONNREFUSED'), { status: 200 }])

    const result = assertStrapiRunning('http://strapi.test', 15000)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(result).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up once the total budget elapses while every probe 502s', async () => {
    const fetchMock = stubFetch([{ status: 502 }])

    const result = assertStrapiRunning('http://strapi.test', 3000)
    const assertion = expect(result).rejects.toThrow(
      /does not appear to be running at http:\/\/strapi\.test \(received status 502\)/
    )
    await vi.advanceTimersByTimeAsync(3000)
    await assertion

    // One probe per second within a 3s budget: 0s, 1s, 2s.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('reports the underlying error when every probe fails to connect', async () => {
    stubFetch([new Error('ECONNREFUSED')])

    const result = assertStrapiRunning('http://strapi.test', 500)
    const assertion = expect(result).rejects.toThrow(/ECONNREFUSED/)
    // The retry delay is capped to whatever budget remains, so a sub-second
    // budget gives up in well under a second rather than waiting a full 1s.
    await vi.advanceTimersByTimeAsync(500)
    await assertion
  })

  it('never waits past the total budget even if a probe hangs', async () => {
    // A fetch that never settles on its own - e.g. a connection stuck
    // mid-handshake - must still be cut off by the per-attempt timeout. Real
    // fetch rejects once its AbortSignal fires, so the mock has to as well.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options?: { signal?: AbortSignal }) =>
          new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted.', 'AbortError')
              )
            )
          })
      )
    )

    const result = assertStrapiRunning('http://strapi.test', 500)
    const assertion = expect(result).rejects.toThrow(
      /does not appear to be running/
    )
    await vi.advanceTimersByTimeAsync(500)
    await assertion
  })
})
