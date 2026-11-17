import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pathSlugOnBlur, visiblePathSlugError } from '@/utils'
import { PATH_SLUG_CUSTOM_FIELD } from './pathSlugField'

const API_DIR = path.join(__dirname, '..', 'api')

interface PathSlugAttribute {
  type: string
  customField?: string
  required?: boolean
}

/** Every content type's pathSlug attribute, by `api/type` name. */
function pathSlugAttributes(): Array<[string, PathSlugAttribute]> {
  return readdirSync(API_DIR).flatMap((api) => {
    const typesDir = path.join(API_DIR, api, 'content-types')
    if (!existsSync(typesDir)) return []
    return readdirSync(typesDir).flatMap((type) => {
      const schema = JSON.parse(
        readFileSync(path.join(typesDir, type, 'schema.json'), 'utf8')
      ) as { attributes: Record<string, PathSlugAttribute> }
      const attribute = schema.attributes.pathSlug
      return attribute ? [[`${api}/${type}`, attribute] as const] : []
    })
  })
}

describe('pathSlug fields', () => {
  // The blog's pathSlug is a uid, so it keeps Generate. Save still corrects
  // and checks it.
  const fields = pathSlugAttributes().filter(([, a]) => a.type !== 'uid')

  it('finds the page content types', () => {
    expect(fields.length).toBeGreaterThanOrEqual(10)
  })

  it.each(fields)('%s uses the Path Slug input', (_name, attribute) => {
    expect(attribute).toMatchObject({
      type: 'customField',
      customField: PATH_SLUG_CUSTOM_FIELD,
      required: true
    })
  })
})

describe('pathSlugOnBlur', () => {
  it.each([
    ['About Us', '/about-us/'],
    ['about-us', '/about-us/'],
    ['/Grant/On_Campus', '/grant/on-campus/'],
    ['  ', ''],
    ['pdf page?', '/pdf-page?/']
  ])('corrects %j to %j', (value, corrected) => {
    expect(pathSlugOnBlur(value)).toBe(corrected)
  })

  // No change, so a blur doesn't mark the form as modified. A link stays as
  // typed, so the message still says it is a link.
  it.each(['/about-us/', '', 'https://example.com/about-us/', '/'])(
    'leaves %j alone',
    (value) => {
      expect(pathSlugOnBlur(value)).toBeUndefined()
    }
  )

  it.each([null, undefined, 42])('ignores %j', (value) => {
    expect(pathSlugOnBlur(value)).toBeUndefined()
  })
})

describe('visiblePathSlugError', () => {
  const bad = '/pdf-page!/'

  it('stays quiet while the editor is still typing', () => {
    expect(visiblePathSlugError(bad, undefined, false)).toBeUndefined()
  })

  it('names what to remove once the editor left the field', () => {
    expect(visiblePathSlugError(bad, undefined, true)).toMatch(
      /^Path Slug can only use .* Remove: !$/
    )
  })

  it('shows our message after a failed save, even untouched', () => {
    expect(visiblePathSlugError(bad, 'Invalid', false)).toMatch(
      /^Path Slug can only use/
    )
  })

  // The admin keeps a failed save's errors until the next save.
  it('drops our message from a failed save once the value is fixed', () => {
    const saved =
      'Path Slug can only use lowercase letters, numbers and hyphens between slashes, like /about-us/. Remove: !'
    expect(visiblePathSlugError('/pdf-page/', saved, true)).toBeUndefined()
  })

  it("keeps a failed save's other messages after the value changes", () => {
    const taken = 'Path Slug "/about-us/" is already used by another entry.'
    expect(visiblePathSlugError('/about-us/', taken, true)).toBe(taken)
  })

  it('keeps our message on a blank value', () => {
    const noWord =
      'Path Slug needs at least one word between the slashes, like /about-us/.'
    expect(visiblePathSlugError('', noWord, false)).toBe(noWord)
  })

  it('keeps the form message for an empty or valid value', () => {
    expect(visiblePathSlugError('', 'This value is required', true)).toBe(
      'This value is required'
    )
    expect(visiblePathSlugError('/about-us/', undefined, true)).toBeUndefined()
    expect(visiblePathSlugError(null, 'This value is required', true)).toBe(
      'This value is required'
    )
  })
})
