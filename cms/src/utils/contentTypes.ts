/**
 * Shared content shapes reused across more than one content type's
 * lifecycle/MDX generation, so they aren't redeclared per content type.
 */

/** Shape of the `shared.article-bio` Strapi component, used by both report and blog. */
export interface AuthorBio {
  // Nullable: Strapi populates an empty bio component's unset author as null.
  author: string | null
  link?: string
  profileBio?: string
  media?: {
    image?: { url: string; name: string }
    alternativeText?: string | null
  }
}
