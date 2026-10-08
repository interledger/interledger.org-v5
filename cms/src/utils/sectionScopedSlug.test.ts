import { describe, it, expect, vi } from 'vitest'
import {
  validateSectionScopedSlug,
  validateUniqueSlug
} from './sectionScopedSlug'

function createDocuments(
  stored: Array<{ documentId: string; pathSlug: string; section: string }> = []
) {
  return {
    findMany: vi.fn(async (options: Record<string, unknown>) => {
      const filters = options.filters as {
        pathSlug: { $in: string[] }
        section: string
      }
      return stored.filter(
        (e) =>
          filters.pathSlug.$in.includes(e.pathSlug) &&
          e.section === filters.section
      )
    }),
    findOne: vi.fn(async (options: Record<string, unknown>) =>
      stored.find((e) => e.documentId === options.documentId)
    )
  }
}

describe('validateSectionScopedSlug', () => {
  // The case a plain `unique: true` on pathSlug wrongly rejected (INTORG-1132).
  it('allows the same pathSlug in a different section', async () => {
    const documents = createDocuments([
      { documentId: 'a', pathSlug: 'faq', section: 'hackathon' }
    ])

    const error = await validateSectionScopedSlug({
      documents,
      data: { pathSlug: 'faq', section: 'foundation' }
    })

    expect(error).toBeUndefined()
  })

  // Stored slugs move from `faq` to `/faq/` (INTORG-1254), so a row may hold
  // either form while the incoming value holds the other.
  it('rejects a duplicate stored in the other slug form', async () => {
    const documents = createDocuments([
      { documentId: 'a', pathSlug: 'faq', section: 'foundation' }
    ])

    const error = await validateSectionScopedSlug({
      documents,
      data: { pathSlug: '/faq/', section: 'foundation' }
    })

    expect(error).toBeDefined()
  })

  it('rejects a second entry with the same pathSlug in the same section', async () => {
    const documents = createDocuments([
      { documentId: 'a', pathSlug: 'faq', section: 'foundation' }
    ])

    const error = await validateSectionScopedSlug({
      documents,
      data: { pathSlug: 'faq', section: 'foundation' }
    })

    expect(error?.message).toContain('already used by another foundation entry')
  })

  it('lets an entry keep its own pathSlug on update', async () => {
    const documents = createDocuments([
      { documentId: 'a', pathSlug: 'faq', section: 'foundation' }
    ])

    const error = await validateSectionScopedSlug({
      documents,
      documentId: 'a',
      data: { pathSlug: 'faq', section: 'foundation' }
    })

    expect(error).toBeUndefined()
  })

  // The admin sends only the changed field. Reading the section off the stored
  // entry is what makes the conflict findable at all.
  it('reads the missing section off the stored entry on a partial update', async () => {
    const documents = createDocuments([
      { documentId: 'a', pathSlug: 'faq', section: 'foundation' },
      { documentId: 'b', pathSlug: 'about', section: 'foundation' }
    ])

    const error = await validateSectionScopedSlug({
      documents,
      documentId: 'b',
      data: { pathSlug: 'faq' }
    })

    expect(documents.findOne).toHaveBeenCalled()
    expect(error?.message).toContain('already used by another foundation entry')
  })

  it('skips the check when pathSlug or section is absent', async () => {
    const documents = createDocuments([
      { documentId: 'a', pathSlug: 'faq', section: 'foundation' }
    ])

    expect(
      await validateSectionScopedSlug({
        documents,
        data: { section: 'foundation' }
      })
    ).toBeUndefined()
    expect(
      await validateSectionScopedSlug({ documents, data: { pathSlug: 'faq' } })
    ).toBeUndefined()
    expect(documents.findMany).not.toHaveBeenCalled()
  })

  it('points the field error at pathSlug so the admin highlights it', async () => {
    const documents = createDocuments([
      { documentId: 'a', pathSlug: 'faq', section: 'foundation' }
    ])

    const error = await validateSectionScopedSlug({
      documents,
      data: { pathSlug: 'faq', section: 'foundation' }
    })

    const details = error?.details as { errors: Array<{ path: string[] }> }
    expect(details.errors[0].path).toEqual(['pathSlug'])
  })

  // The FAQ content type sets draftAndPublish false, so a `status` filter
  // would narrow the very search that has to see every stored row.
  it('does not narrow the conflict search by publication status', async () => {
    const documents = createDocuments()

    await validateSectionScopedSlug({
      documents,
      data: { pathSlug: 'faq', section: 'foundation' }
    })

    const options = documents.findMany.mock.calls[0][0]
    expect(options).not.toHaveProperty('status')
  })

  it('scopes the lookup to the locale being written', async () => {
    const documents = createDocuments()

    await validateSectionScopedSlug({
      documents,
      data: { pathSlug: 'faq', section: 'foundation' },
      locale: 'es'
    })

    expect(documents.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'es' })
    )
  })
})

describe('validateUniqueSlug', () => {
  function createUniqueDocuments(
    stored: Array<{ documentId: string; pathSlug: string }>
  ) {
    return {
      findMany: vi.fn(async (options: Record<string, unknown>) => {
        const filters = options.filters as { pathSlug: { $in: string[] } }
        return stored.filter((e) => filters.pathSlug.$in.includes(e.pathSlug))
      }),
      findOne: vi.fn()
    }
  }

  // Strapi's own unique check misses this: the row holds `about`, the save
  // hook stores `/about/` (INTORG-1254).
  it('rejects a slug another entry holds in the other form', async () => {
    const documents = createUniqueDocuments([
      { documentId: 'a', pathSlug: 'about' }
    ])

    const error = await validateUniqueSlug({
      documents,
      data: { pathSlug: '/about/' },
      locale: 'en'
    })

    expect(error?.message).toContain('/about/')
    expect(documents.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { pathSlug: { $in: ['about', '/about/'] } },
        locale: 'en'
      })
    )
  })

  it('lets an entry keep its own slug', async () => {
    const documents = createUniqueDocuments([
      { documentId: 'a', pathSlug: 'about' }
    ])

    const error = await validateUniqueSlug({
      documents,
      data: { pathSlug: '/about/' },
      documentId: 'a'
    })

    expect(error).toBeUndefined()
  })

  it('skips a partial update that leaves the slug alone', async () => {
    const documents = createUniqueDocuments([])

    const error = await validateUniqueSlug({
      documents,
      data: { title: 'New title' },
      documentId: 'a'
    })

    expect(error).toBeUndefined()
    expect(documents.findMany).not.toHaveBeenCalled()
  })
})
