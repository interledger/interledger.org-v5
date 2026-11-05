import { isRelatedArticleSlug, toSlashedSlug } from './relativeLinks'

/** Shown when the value has no blog segment we can turn into a path. */
const BLOG_PATH_EXAMPLE = '/blog/my-post/'

/**
 * The field name registered on the server (`global::`) and in the admin.
 * The component schema's `customField` must stay this uid: a normal string
 * `regex` can only show Strapi's shared "does not match the regex" error.
 */
export const RELATED_ARTICLE_SLUG_FIELD_NAME = 'related-article-slug'

export const RELATED_ARTICLE_SLUG_CUSTOM_FIELD = `global::${RELATED_ARTICLE_SLUG_FIELD_NAME}`

/**
 * A `/blog/{slug}/` to offer the editor. A pasted blog URL keeps its slug.
 * Anything else gets {@link BLOG_PATH_EXAMPLE}, so a grant slug is not
 * rewritten into a blog path that was never a post.
 */
function suggestedBlogPath(value: string): string {
  const afterBlog = /(?:^|\/)blog\/([A-Za-z0-9._~-]+)/.exec(value)?.[1]
  return afterBlog ? `/blog/${afterBlog}/` : BLOG_PATH_EXAMPLE
}

/**
 * A related article must be `/blog/{slug}/`, the post's public path. A bare
 * slug, a `/grant/...` path, or a pasted URL used to save and then match no
 * post, so the card never showed (INTORG-1346). Used on publish, by the MDX
 * sync, and under the field in the admin. The save hook adds a missing
 * trailing slash before this runs.
 */
export function relatedArticleSlugError(slug: string): string | undefined {
  if (!toSlashedSlug(slug)) return 'Related Articles: Slug is required'
  if (isRelatedArticleSlug(slug)) return undefined
  return `This value should be a blog path, like ${suggestedBlogPath(slug)}.`
}

/**
 * The string under Related Post Slug. An empty value keeps the form's
 * required error. A bad value replaces Strapi's shared regex sentence.
 */
export function relatedArticleFieldError(
  value: unknown,
  formError?: string
): string | undefined {
  if (typeof value !== 'string' || !toSlashedSlug(value)) return formError
  return relatedArticleSlugError(value) ?? formError
}

/**
 * Hide the pattern error until the editor leaves the field or a save fails,
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
