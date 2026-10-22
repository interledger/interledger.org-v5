/**
 * The save-time link normalization for a whole document. It walks the data
 * with its schema, so each string is rewritten by what its field is. Kept
 * apart from `relativeLinks.ts`, which must stay import-free: the `src` suite
 * and a migration script import that module directly.
 */
import { traverseEntity } from '@strapi/utils'
import {
  slashInternalMarkdownLinks,
  stripSiteOriginsInText,
  stripUploadOriginsInText,
  toSlashedSlug,
  toStoredHref,
  toStoredUrl
} from './relativeLinks'

// `@strapi/utils` doesn't export its schema types, so they are read off
// `traverseEntity`'s own signature.
type TraverseOptions = Parameters<typeof traverseEntity>[1]
type Model = TraverseOptions['schema']
type Attribute = Parameters<
  Parameters<typeof traverseEntity>[0]
>[0]['attribute']

/** Strapi's model lookup: `undefined` for an unknown uid, such as a typo. */
export type GetModel = (uid: string) => Model | undefined

/** Fields holding one link, stored as a relative, slashed path. */
const HREF_LIKE_FIELDS = new Set([
  'href',
  'link',
  'ctaLink',
  'primaryButtonLink',
  'secondaryButtonLink',
  'authorLink',
  'destination'
])

/** Fields holding a media or external URL, where a bare value is not a path. */
const URL_FIELDS = new Set(['url', 'videoUrl', 'externalUrl'])

const PATH_SEGMENT_FIELDS = new Set(['pathSlug', 'slug'])

/** Fields holding source code, where a URL is an example, not a link. */
const CODE_FIELDS = new Set(['code'])

const CKEDITOR_FIELD = 'plugin::ckeditor5.CKEditor'

/**
 * Only `customField` identifies a CKEditor field in both shapes: Strapi
 * rewrites its `type` from `customField` to `richtext` at startup. Field
 * names don't either: `heading`, `source` and `description` are CKEditor in
 * some components and plain in others.
 */
function isCkeditorField(attribute: Attribute): boolean {
  return attribute?.customField === CKEDITOR_FIELD
}

function normalizeText(text: string, attribute: Attribute) {
  // The upload strip goes first, so an upload on a site host keeps its upload
  // handling.
  const kind = isCkeditorField(attribute) ? 'richText' : 'plainText'
  return slashInternalMarkdownLinks(
    stripSiteOriginsInText(stripUploadOriginsInText(text), kind)
  )
}

/**
 * Returns a copy of a document's data with every link in its stored form:
 * link fields relative and slashed, slugs slashed, and own-site and upload
 * URLs in text fields relative. Components, dynamic zones and relations are
 * walked with their own schemas, so a CKEditor field is found at any depth.
 * Data without a schema is returned as is.
 */
export async function normalizeRelativeLinksInDocumentData<T>(
  data: T,
  schema: Model | undefined,
  getModel: GetModel
): Promise<T> {
  if (!schema) return data
  const normalized = await traverseEntity(
    ({ data: node, key, value, attribute }) => {
      if (typeof value !== 'string' || CODE_FIELDS.has(key)) return
      if (HREF_LIKE_FIELDS.has(key)) node[key] = toStoredHref(value)
      else if (URL_FIELDS.has(key)) node[key] = toStoredUrl(value)
      else if (PATH_SEGMENT_FIELDS.has(key)) node[key] = toSlashedSlug(value)
      else node[key] = normalizeText(value, attribute)
    },
    // Typed as always found, but `traverseEntity` returns a nested value
    // whose schema is missing (a plugin model, an unknown uid) untouched.
    { schema, getModel: getModel as TraverseOptions['getModel'] },
    data as Parameters<typeof traverseEntity>[2]
  )
  // A copy of `data`, same shape: only string values are replaced.
  return normalized as T
}
