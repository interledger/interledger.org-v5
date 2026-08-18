import { describe, it, expect } from 'vitest'
import { serialize } from './hackathon-animation.serializer'

describe('hackathon-animation serializer', () => {
  it('always emits the self-closing tag', () => {
    expect(serialize()).toBe('<HackathonAnimation />')
  })
})
