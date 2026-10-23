/**
 * Shared content shapes reused across more than one content type's
 * lifecycle/MDX generation, so they aren't redeclared per content type.
 * Kept free of runtime imports: the MDX sync parser imports it too.
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

/**
 * Shape of the `shared.block-intro` Strapi component, the optional intro on a
 * dynamic-zone block. `description` is CKEditor markdown. Mirrors `BlockIntro`
 * in src/types/blockIntro.ts.
 */
export interface BlockIntroInput {
  // Nullable: Strapi returns an unset field of a saved component as null.
  heading?: string | null
  subheading?: string | null
  description?: string | null
}

/** Fields of `shared.block-intro`, in the order they are written to MDX. */
export const BLOCK_INTRO_FIELDS = [
  'heading',
  'subheading',
  'description'
] as const satisfies ReadonlyArray<keyof BlockIntroInput>

export type BlockIntroField = (typeof BLOCK_INTRO_FIELDS)[number]

/** A block intro as written to MDX: trimmed, with empty fields left out. */
export type SerializedBlockIntro = Partial<Record<BlockIntroField, string>>
