import { describe, it, expect } from 'vitest'
import { PATHS } from './paths'
import { CONTENT_COLLECTION_NAMING_RULES } from './contentCollections'

describe('CONTENT_COLLECTION_NAMING_RULES', () => {
  // A collection missing from this map is a collection the filename check
  // skips, which is how INTORG-1237 stayed invisible for months.
  it('covers every exported content collection', () => {
    expect(Object.keys(CONTENT_COLLECTION_NAMING_RULES).sort()).toEqual(
      Object.keys(PATHS.CONTENT).sort()
    )
  })
})
