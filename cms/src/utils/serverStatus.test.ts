import { describe, expect, it } from 'vitest'
import {
  UNREACHABLE_FAILURE_THRESHOLD,
  createInitialServerStatusState,
  getPollDelayMs,
  getServerNotice,
  nextServerStatus,
  parseServerStatusPayload,
  type ServerStatusPayload,
  type ServerStatusState
} from './serverStatus'

const PAYLOAD: ServerStatusPayload = {
  bootId: 'boot-1',
  buildId: 'build-1',
  serverTime: 1_700_000_000_000
}

function succeed(
  state: ServerStatusState,
  payload: Partial<ServerStatusPayload> = {},
  observedAtMs = PAYLOAD.serverTime
): ServerStatusState {
  return nextServerStatus(state, {
    type: 'poll-success',
    payload: { ...PAYLOAD, ...payload },
    observedAtMs
  })
}

function fail(state: ServerStatusState, times = 1): ServerStatusState {
  let next = state
  for (let i = 0; i < times; i += 1) {
    next = nextServerStatus(next, { type: 'poll-failure' })
  }
  return next
}

// ── parseServerStatusPayload ────────────────────────────────────────────────

describe('parseServerStatusPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(parseServerStatusPayload({ ...PAYLOAD })).toEqual(PAYLOAD)
  })

  it.each([
    ['null', null],
    ['a string (a proxy error page)', '<html>502</html>'],
    ['a missing bootId', { buildId: 'b', serverTime: 1 }],
    ['an empty bootId', { bootId: '', buildId: 'b', serverTime: 1 }],
    ['a missing buildId', { bootId: 'a', serverTime: 1 }],
    ['a missing serverTime', { bootId: 'a', buildId: 'b' }],
    ['a non-numeric serverTime', { bootId: 'a', buildId: 'b', serverTime: 'x' }]
  ])('rejects %s', (_label, value) => {
    expect(parseServerStatusPayload(value)).toBeInstanceOf(Error)
  })
})

// ── reachability ────────────────────────────────────────────────────────────

describe('nextServerStatus reachability', () => {
  it('holds its verdict until the failure threshold, so a blip stays quiet', () => {
    const healthy = succeed(createInitialServerStatusState())
    const oneFailure = fail(healthy)

    expect(UNREACHABLE_FAILURE_THRESHOLD).toBe(2)
    expect(oneFailure.reachability).toBe('healthy')
    expect(getServerNotice(oneFailure)).toBe('none')
  })

  it('reports unreachable once the threshold is met', () => {
    const state = fail(succeed(createInitialServerStatusState()), 2)

    expect(state.reachability).toBe('unreachable')
    expect(getServerNotice(state)).toBe('unreachable')
  })

  it('recovers on the next success', () => {
    const down = fail(succeed(createInitialServerStatusState()), 3)
    const backUp = succeed(down)

    expect(backUp.reachability).toBe('healthy')
    expect(backUp.consecutiveFailures).toBe(0)
  })
})

// ── build identity ──────────────────────────────────────────────────────────

describe('nextServerStatus build identity', () => {
  it('adopts the identifiers from the first poll without flagging anything', () => {
    const state = succeed(createInitialServerStatusState())

    expect(state.firstBuildId).toBe('build-1')
    expect(state.outdated).toBe(false)
    expect(getServerNotice(state)).toBe('none')
  })

  it('flags the bundle as outdated when the build id changes', () => {
    const first = succeed(createInitialServerStatusState())
    const rebuilt = succeed(first, { buildId: 'build-2' })

    expect(rebuilt.outdated).toBe(true)
    expect(getServerNotice(rebuilt)).toBe('outdated')
  })

  it('keeps the outdated flag sticky once set', () => {
    const first = succeed(createInitialServerStatusState())
    const rebuilt = succeed(first, { buildId: 'build-2' })
    const reverted = succeed(rebuilt, { buildId: 'build-1' })

    expect(reverted.outdated).toBe(true)
  })

  it('never flags a dev server, whose build id is constant', () => {
    // `strapi develop` restarts on every source save: a new bootId each time,
    // but the same 'dev' buildId, so nothing should nag.
    let state = succeed(createInitialServerStatusState(), {
      bootId: 'boot-1',
      buildId: 'dev'
    })
    state = fail(state, 2)
    state = succeed(state, { bootId: 'boot-2', buildId: 'dev' })

    expect(state.outdated).toBe(false)
    expect(getServerNotice(state)).toBe('restarted')
  })

  it('treats a lazy-chunk load failure as proof the bundle is stale', () => {
    const state = nextServerStatus(succeed(createInitialServerStatusState()), {
      type: 'asset-load-failure'
    })

    expect(state.outdated).toBe(true)
    expect(getServerNotice(state)).toBe('outdated')
  })
})

// ── restart reporting ───────────────────────────────────────────────────────

describe('nextServerStatus restart reporting', () => {
  it('reports a restart only after downtime we actually observed', () => {
    const down = fail(succeed(createInitialServerStatusState()), 2)
    const backUp = succeed(down, { bootId: 'boot-2' })

    expect(backUp.restarted).toBe(true)
  })

  it('stays silent about a boot id change we never saw fail', () => {
    // A tab suspended across a silent restart: nothing broke, so say nothing.
    const first = succeed(createInitialServerStatusState())
    const laterPoll = succeed(first, { bootId: 'boot-2' })

    expect(laterPoll.restarted).toBe(false)
    expect(getServerNotice(laterPoll)).toBe('none')
  })

  it('does not report a restart when the same process answers again', () => {
    const down = fail(succeed(createInitialServerStatusState()), 2)
    const backUp = succeed(down)

    expect(backUp.restarted).toBe(false)
    expect(getServerNotice(backUp)).toBe('none')
  })

  it('ranks an outdated bundle above a restart', () => {
    const down = fail(succeed(createInitialServerStatusState()), 2)
    const redeployed = succeed(down, { bootId: 'boot-2', buildId: 'build-2' })

    expect(redeployed.restarted).toBe(true)
    expect(getServerNotice(redeployed)).toBe('outdated')
  })
})

// ── clock offset ────────────────────────────────────────────────────────────

describe('nextServerStatus clock offset', () => {
  it('records how far the browser clock trails the server', () => {
    const state = succeed(
      createInitialServerStatusState(),
      {},
      PAYLOAD.serverTime - 5_000
    )

    expect(state.clockOffsetMs).toBe(5_000)
  })
})

// ── getPollDelayMs ──────────────────────────────────────────────────────────

describe('getPollDelayMs', () => {
  const noJitter = () => 0.5

  it('polls every 20s while healthy', () => {
    expect(
      getPollDelayMs(succeed(createInitialServerStatusState()), noJitter)
    ).toBe(20_000)
  })

  it('backs off exponentially while failing', () => {
    const base = createInitialServerStatusState()

    expect(getPollDelayMs(fail(base, 1), noJitter)).toBe(5_000)
    expect(getPollDelayMs(fail(base, 2), noJitter)).toBe(10_000)
    expect(getPollDelayMs(fail(base, 3), noJitter)).toBe(20_000)
  })

  it('caps the backoff at 30s', () => {
    const base = createInitialServerStatusState()

    expect(getPollDelayMs(fail(base, 10), noJitter)).toBe(30_000)
  })

  it('spreads retries with jitter so tabs do not sync up', () => {
    const state = fail(createInitialServerStatusState(), 1)

    expect(getPollDelayMs(state, () => 0)).toBe(4_000)
    expect(getPollDelayMs(state, () => 1)).toBe(6_000)
  })
})
