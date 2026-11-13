import { isRelatedArticleSlug, toSlashedSlug } from './relativeLinks'

/** Shown when the value has no blog segment we can turn into a path. */
const BLOG_PATH_EXAMPLE = '/blog/my-post/'

/**
 * The field uid on the component schema. It has to match the plugin
 * registered in `cms/config/plugins.ts`. A normal string field cannot show
 * our own message under the input.
 */
export const RELATED_ARTICLE_SLUG_FIELD_NAME = 'related-article-slug'

export const RELATED_ARTICLE_SLUG_CUSTOM_FIELD = `plugin::related-article-slug.${RELATED_ARTICLE_SLUG_FIELD_NAME}`

/**
 * A `/blog/{slug}/` to offer the editor. A pasted blog URL keeps its slug.
 * A single segment (`interledger-universe` or `/interledger-universe/`) is
 * the old bare form, so it becomes `/blog/interledger-universe/`. A path
 * that already names another section, such as `/grant/...`, stays the
 * generic example: that slug was never a post.
 */
function suggestedBlogPath(value: string): string {
  const afterBlog = /(?:^|\/)blog\/([A-Za-z0-9._~-]+)/.exec(value)?.[1]
  if (afterBlog) return `/blog/${afterBlog}/`

  const segments = toSlashedSlug(value).split('/').filter(Boolean)
  if (segments.length === 1 && /^[A-Za-z0-9._~-]+$/.test(segments[0])) {
    return `/blog/${segments[0]}/`
  }
  return BLOG_PATH_EXAMPLE
}

/**
 * A related article must be `/blog/{slug}/`, the post's public path. A bare
 * slug, a `/grant/...` path, or a pasted URL used to save and then match no
 * post, so the card never showed (INTORG-1346).
 *
 * Save and MDX sync call this the same way. One segment is both the old
 * `/my-post/` form and a new grant slug such as
 * `/eoi-call-for-papers-reviewer/` or `/grant-slug`, so every value of that
 * shape is rejected. The save hook adds a missing trailing slash and
 * lowercases the value before this runs.
 */
export function relatedArticleSlugError(slug: string): string | undefined {
  if (!toSlashedSlug(slug)) return 'Related Articles: Slug is required'
  if (isRelatedArticleSlug(slug)) return undefined
  return `Related Articles: should be a blog path, like ${suggestedBlogPath(slug)}.`
}

/**
 * The string under Related Post Slug. An empty value keeps the form's
 * required error. A bad value shows our own message.
 */
export function relatedArticleFieldError(
  value: unknown,
  formError?: string
): string | undefined {
  if (typeof value !== 'string' || !toSlashedSlug(value)) return formError
  return relatedArticleSlugError(value)
}

/**
 * Hide the message until the editor leaves the field or a save fails,
 * so typing `/blog/my-post/` does not flash red on the first character.
 */
export function visibleRelatedArticleSlugError(
  value: unknown,
  formError: string | undefined,
  touched: boolean
): string | undefined {
  if (!touched && !formError) return undefined
  return relatedArticleFieldError(value, formError)
}
