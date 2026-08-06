import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  BLOG_CONTENT_POPULATE,
  FOUNDATION_PAGE_CONTENT_POPULATE,
  GRANT_OVERVIEW_PAGE_CONTENT_POPULATE,
  GRANT_PAGE_CONTENT_POPULATE,
  HACKATHON_PAGE_CONTENT_POPULATE,
  PROFILE_PAGE_CONTENT_POPULATE,
  REPORT_CONTENT_POPULATE
} from './contentPopulate'

const API_DIR = fileURLToPath(new URL('../api', import.meta.url))

/**
 * Populate config each content type's lifecycle uses to read its dynamic zone
 * back out of Strapi for the MDX export, keyed by API directory name.
 *
 * Grant configs nest the zone under a `content` key because they also populate
 * top-level component fields; the rest are the zone config itself.
 */
const ZONE_POPULATE_BY_CONTENT_TYPE: Record<string, { on: object }> = {
  'foundation-page': FOUNDATION_PAGE_CONTENT_POPULATE,
  'summit-page': FOUNDATION_PAGE_CONTENT_POPULATE,
  'hackathon-page': HACKATHON_PAGE_CONTENT_POPULATE,
  'foundation-blog-post': BLOG_CONTENT_POPULATE,
  'profile-page': PROFILE_PAGE_CONTENT_POPULATE,
  report: REPORT_CONTENT_POPULATE,
  'grant-page': GRANT_PAGE_CONTENT_POPULATE.content,
  'grant-overview-page': GRANT_OVERVIEW_PAGE_CONTENT_POPULATE.content
}

type DynamicZone = { field: string; components: string[] }

/** Dynamic zones declared by a content type's schema, in schema order. */
function readDynamicZones(contentType: string): DynamicZone[] {
  const schemaPath = path.join(
    API_DIR,
    contentType,
    'content-types',
    contentType,
    'schema.json'
  )
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  const attributes: Record<string, { type: string; components?: string[] }> =
    schema.attributes ?? {}

  return Object.entries(attributes)
    .filter(([, attribute]) => attribute.type === 'dynamiczone')
    .map(([field, attribute]) => ({
      field,
      components: attribute.components ?? []
    }))
}

/** API directory names that declare at least one dynamic zone. */
function contentTypesWithDynamicZones(): string[] {
  return readdirSync(API_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((contentType) => readDynamicZones(contentType).length > 0)
    .sort()
}

describe('dynamic zone populate configs', () => {
  const contentTypes = contentTypesWithDynamicZones()

  it('covers every content type that declares a dynamic zone', () => {
    expect(contentTypes).toEqual(
      Object.keys(ZONE_POPULATE_BY_CONTENT_TYPE).sort()
    )
  })

  it.each(contentTypes)('populates every block %s allows', (contentType) => {
    const populate = ZONE_POPULATE_BY_CONTENT_TYPE[contentType]
    expect(
      populate,
      `no populate config mapped for ${contentType}`
    ).toBeDefined()

    const populated = Object.keys(populate.on)
    const zones = readDynamicZones(contentType)
    expect(
      zones,
      `${contentType} declares more than one dynamic zone; ` +
        'ZONE_POPULATE_BY_CONTENT_TYPE maps one config per content type'
    ).toHaveLength(1)

    const missing = zones[0].components.filter(
      (component) => !populated.includes(component)
    )
    expect(
      missing,
      `${contentType}.${zones[0].field} allows components missing from its populate map, ` +
        `so they would be dropped from the MDX export: ${missing.join(', ')}`
    ).toEqual([])
  })
})
