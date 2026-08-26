import { describe, it, expect } from 'vitest'
import {
  formatIdentity,
  identityForEntry,
  identityForMdx,
  identityKey
} from './entryIdentity'
import { createMdxFile } from './test-utils'

const BY_SLUG = {}
const BY_SECTION_AND_SLUG = { sectionScopedIdentity: true }

describe('identityForMdx', () => {
  it('drops section for a content type keyed on pathSlug alone', () => {
    const mdx = createMdxFile({ pathSlug: 'faq', section: 'hackathon' })

    expect(identityForMdx(BY_SLUG, mdx)).toEqual({
      pathSlug: 'faq',
      section: null
    })
  })

  it('keeps section for a section-scoped content type', () => {
    const mdx = createMdxFile({ pathSlug: 'faq', section: 'hackathon' })

    expect(identityForMdx(BY_SECTION_AND_SLUG, mdx)).toEqual({
      pathSlug: 'faq',
      section: 'hackathon'
    })
  })

  // A section-scoped type whose frontmatter is missing the field. The schema
  // marks section required, so this is a malformed file, not a valid state.
  it('yields a null section when the frontmatter has none', () => {
    const mdx = createMdxFile({ pathSlug: 'faq', section: null })

    expect(identityForMdx(BY_SECTION_AND_SLUG, mdx).section).toBeNull()
  })
})

describe('identityForEntry', () => {
  it('reads section off a Strapi entry when section-scoped', () => {
    const entry = {
      documentId: 'abc',
      pathSlug: 'faq',
      section: 'foundation'
    }

    expect(identityForEntry(BY_SECTION_AND_SLUG, entry)).toEqual({
      pathSlug: 'faq',
      section: 'foundation'
    })
  })

  // A Strapi entry created before `section` existed comes back without it.
  // It must not silently key as some other section.
  it('yields a null section when the entry has none', () => {
    const entry = { documentId: 'abc', pathSlug: 'faq' }

    expect(identityForEntry(BY_SECTION_AND_SLUG, entry).section).toBeNull()
  })

  it('ignores section for a content type keyed on pathSlug alone', () => {
    const entry = { documentId: 'abc', pathSlug: 'faq', section: 'hackathon' }

    expect(identityForEntry(BY_SLUG, entry).section).toBeNull()
  })
})

describe('identityKey', () => {
  // The whole point of INTORG-1132: these two must not share a key.
  it('separates the same pathSlug in two sections', () => {
    const foundation = identityKey({ pathSlug: 'faq', section: 'foundation' })
    const hackathon = identityKey({ pathSlug: 'faq', section: 'hackathon' })

    expect(foundation).not.toBe(hackathon)
  })

  it('falls back to the bare pathSlug when there is no section', () => {
    expect(identityKey({ pathSlug: 'about-us', section: null })).toBe(
      'about-us'
    )
  })

  // A slug containing the section name must not collide with a real pair.
  it('does not confuse a slug that looks like a prefixed path', () => {
    const prefixedSlug = identityKey({
      pathSlug: 'hackathon/faq',
      section: null
    })
    const realPair = identityKey({ pathSlug: 'faq', section: 'hackathon' })

    expect(prefixedSlug).not.toBe(realPair)
  })
})

describe('formatIdentity', () => {
  it('names the section so a log line distinguishes the two FAQs', () => {
    expect(formatIdentity({ pathSlug: 'faq', section: 'hackathon' })).toBe(
      'faq (hackathon)'
    )
  })

  it('prints the bare pathSlug when there is no section', () => {
    expect(formatIdentity({ pathSlug: 'about-us', section: null })).toBe(
      'about-us'
    )
  })
})
