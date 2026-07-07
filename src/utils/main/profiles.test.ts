import { describe, it, expect } from 'vitest'
import {
  extractProfileGridPathSlugsFromMdx,
  resolveGridColorIndexes
} from './profileGridColors'

describe('extractProfileGridPathSlugsFromMdx', () => {
  it('parses multiline pathSlugs arrays', () => {
    const body = `<ProfileGrid
  heading="Ambassadors"
  pathSlugs={[
    'ambassador1',
    'Tailer',
    'anca'
  ]}
/>`

    expect(extractProfileGridPathSlugsFromMdx(body)).toEqual([
      ['ambassador1', 'Tailer', 'anca']
    ])
  })

  it('parses inline pathSlugs arrays', () => {
    const body = `<ProfileGrid pathSlugs={['alice','bob']} />`

    expect(extractProfileGridPathSlugsFromMdx(body)).toEqual([['alice', 'bob']])
  })

  it('normalizes leading and trailing slashes', () => {
    const body = `<ProfileGrid pathSlugs={['/cluj/anca/']} />`

    expect(extractProfileGridPathSlugsFromMdx(body)).toEqual([['cluj/anca']])
  })
})

describe('resolveGridColorIndexes', () => {
  it('preserves manual order and skips unknown slugs', () => {
    const known = new Set(['ambassador1', 'anca', 'sarah'])
    const indexes = resolveGridColorIndexes(
      ['ambassador1', 'missing', 'anca', 'sarah'],
      known
    )

    expect(indexes.get('ambassador1')).toBe(0)
    expect(indexes.get('anca')).toBe(1)
    expect(indexes.get('sarah')).toBe(2)
    expect(indexes.has('missing')).toBe(false)
  })

  it('matches About Us ambassador grid positions when all profiles exist', () => {
    const known = new Set([
      'ambassador1',
      'Tailer',
      '321',
      'anca',
      'sarah',
      'hackathon/2025/judges/jane-doe'
    ])
    const indexes = resolveGridColorIndexes(
      [
        'ambassador1',
        'Tailer',
        '321',
        'anca',
        'sarah',
        'hackathon/2025/judges/jane-doe'
      ],
      known
    )

    expect(indexes.get('anca')).toBe(3)
  })

  it('resolves legacy fellowship slugs to grant/fellowship pathSlugs', () => {
    const known = new Set([
      'grant/fellowship/lawil-karama',
      'grant/fellowship/kokayi-walker',
      'grant/fellowship/stephanie-perrin',
      'grant/fellowship/sheena-allen'
    ])
    const indexes = resolveGridColorIndexes(
      [
        'fellowship/lawil-karama',
        'fellowship/kokayi-walker',
        'fellowship/stephanie-perrin',
        'fellowship/sheena-allen'
      ],
      known
    )

    expect(indexes.get('grant/fellowship/lawil-karama')).toBe(0)
    expect(indexes.get('grant/fellowship/kokayi-walker')).toBe(1)
    expect(indexes.get('grant/fellowship/stephanie-perrin')).toBe(2)
    expect(indexes.get('grant/fellowship/sheena-allen')).toBe(3)
  })
})
