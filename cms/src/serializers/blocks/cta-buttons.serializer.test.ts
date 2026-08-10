import { describe, it, expect } from 'vitest'
import { serialize } from './cta-buttons.serializer'
import { SerializerFieldError } from '../../utils'

const primary = { text: 'Apply now', link: '/grants/apply', style: 'primary' }
const secondary = {
  text: 'Read the FAQ',
  link: '/grants/faq',
  style: 'secondary'
}

const fieldErrorsOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    if (error instanceof SerializerFieldError) return error.fieldErrors
    throw error
  }
  throw new Error('expected serialize to throw')
}

describe('cta-buttons serializer', () => {
  it('serializes a single button', () => {
    expect(serialize({ buttons: [primary] })).toBe(
      `<CtaButtons buttons={[{"text":"Apply now","link":"/grants/apply","style":"primary"}]} />`
    )
  })

  it('serializes two buttons in order', () => {
    const out = serialize({ buttons: [primary, secondary] })
    expect(out.indexOf('Apply now')).toBeLessThan(out.indexOf('Read the FAQ'))
  })

  it('emits external when set', () => {
    expect(
      serialize({ buttons: [{ ...secondary, external: true }] })
    ).toContain('"external":true')
  })

  it('emits document when set', () => {
    expect(
      serialize({ buttons: [{ ...secondary, document: true }] })
    ).toContain('"document":true')
  })

  it('omits false flags so a default button round-trips unchanged', () => {
    const out = serialize({
      buttons: [{ ...primary, external: false, document: false }]
    })
    expect(out).not.toContain('external')
    expect(out).not.toContain('document')
  })

  it('fills in the primary default when style is unset', () => {
    const out = serialize({ buttons: [{ text: 'A', link: '/a' }] })
    expect(out).toContain('"style":"primary"')
  })

  it('trims text and link', () => {
    const out = serialize({ buttons: [{ text: '  A  ', link: '  /a  ' }] })
    expect(out).toContain('"text":"A"')
    expect(out).toContain('"link":"/a"')
  })

  describe('composition rules', () => {
    it('rejects an empty block, pointing at buttons', () => {
      expect(fieldErrorsOf(() => serialize({ buttons: [] }))).toEqual([
        expect.objectContaining({ path: ['buttons'] })
      ])
    })

    it('rejects a missing buttons field', () => {
      expect(fieldErrorsOf(() => serialize({}))).toEqual([
        expect.objectContaining({ path: ['buttons'] })
      ])
    })

    it('rejects two primaries, pointing at the second style', () => {
      const errors = fieldErrorsOf(() =>
        serialize({ buttons: [primary, { ...secondary, style: 'primary' }] })
      )
      expect(errors[0].path).toEqual(['buttons', 1, 'style'])
      expect(errors[0].message).toMatch(/both be primary/)
    })

    it('rejects a primary in second position', () => {
      const errors = fieldErrorsOf(() =>
        serialize({ buttons: [secondary, primary] })
      )
      expect(errors[0].message).toMatch(/must come first/)
    })

    it('rejects three buttons', () => {
      const errors = fieldErrorsOf(() =>
        serialize({ buttons: [primary, secondary, secondary] })
      )
      expect(errors[0].path).toEqual(['buttons'])
    })
  })

  describe('field errors', () => {
    it('reports a missing text with an indexed path', () => {
      const errors = fieldErrorsOf(() =>
        serialize({ buttons: [{ link: '/a', style: 'primary' }] })
      )
      expect(errors).toEqual([
        expect.objectContaining({ path: ['buttons', 0, 'text'] })
      ])
    })

    it('reports a missing link with an indexed path', () => {
      const errors = fieldErrorsOf(() =>
        serialize({ buttons: [{ text: 'A', style: 'primary' }] })
      )
      expect(errors).toEqual([
        expect.objectContaining({ path: ['buttons', 0, 'link'] })
      ])
    })

    it('reports every failing field across both buttons at once', () => {
      const errors = fieldErrorsOf(() =>
        serialize({
          buttons: [{ style: 'primary' }, { text: 'B', style: 'secondary' }]
        })
      )
      expect(errors.map((e) => e.path)).toEqual([
        ['buttons', 0, 'text'],
        ['buttons', 0, 'link'],
        ['buttons', 1, 'link']
      ])
    })

    // An unset style counts as primary, so two empty buttons look like two
    // primaries. Reporting that first sends the editor to a Style dropdown
    // they never touched, when the real problem is the missing text
    // (Jonathan, #483).
    it('reports the missing fields, not a style clash, on an empty draft', () => {
      const errors = fieldErrorsOf(() => serialize({ buttons: [{}, {}] }))
      expect(errors.map((e) => e.path)).toEqual([
        ['buttons', 0, 'text'],
        ['buttons', 0, 'link'],
        ['buttons', 1, 'text'],
        ['buttons', 1, 'link']
      ])
    })

    it('still reports a style clash once both buttons are filled in', () => {
      const errors = fieldErrorsOf(() =>
        serialize({ buttons: [primary, { ...secondary, style: 'primary' }] })
      )
      expect(errors.map((e) => e.path)).toEqual([['buttons', 1, 'style']])
    })

    it('rejects external+document on the same button, matching card-grid', () => {
      const errors = fieldErrorsOf(() =>
        serialize({
          buttons: [{ ...secondary, external: true, document: true }]
        })
      )
      expect(errors).toEqual([
        expect.objectContaining({ path: ['buttons', 0, 'document'] })
      ])
    })

    it('reports an unknown style', () => {
      const errors = fieldErrorsOf(() =>
        serialize({ buttons: [{ text: 'A', link: '/a', style: 'tertiary' }] })
      )
      expect(errors).toEqual([
        expect.objectContaining({ path: ['buttons', 0, 'style'] })
      ])
    })
  })
})
