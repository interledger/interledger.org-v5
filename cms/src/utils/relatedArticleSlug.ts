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
 * One segment, the form already stored on a post (`my-post` or `/my-post/`).
 * `/blog/my-post/` has two segments, so it is not this form.
 */
const STORED_RELATED_ARTICLE_SLUG = /^\/[A-Za-z0-9._~-]+\/$/

function isStoredRelatedArticleSlug(value: string): boolean {
  return STORED_RELATED_ARTICLE_SLUG.test(toSlashedSlug(value))
}

/**
 * A related article must be `/blog/{slug}/`, the post's public path. A
 * `/grant/...` path or a pasted URL used to save and then match no post, so
 * the card never showed (INTORG-1346).
 *
 * Document validation runs on every create and update, not only publish.
 * Until `sync:mdx` rewrites each row, Strapi still holds `/my-post/`. Pass
 * `allowStoredSlug` on that save so an editor can fix a typo without retyping
 * all three related posts. The MDX sync stays strict. Drop the allowance once
 * every row stores `/blog/{slug}/`. The save hook adds a missing trailing
 * slash before this runs.
 */
export function relatedArticleSlugError(
  slug: string,
  options?: { allowStoredSlug?: boolean }
): string | undefined {
  if (!toSlashedSlug(slug)) return 'Related Articles: Slug is required'
  if (isRelatedArticleSlug(slug)) return undefined
  if (options?.allowStoredSlug && isStoredRelatedArticleSlug(slug)) {
    return undefined
  }
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
  return relatedArticleSlugError(value, { allowStoredSlug: true })
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
