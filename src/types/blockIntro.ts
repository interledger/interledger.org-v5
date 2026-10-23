/**
 * Optional intro every block can open with: Heading (H2), Subheading (H3)
 * and Description. Serialized from the `shared.block-intro` Strapi component
 * into an `intro={{…}}` MDX prop. The description is markdown.
 */
export interface BlockIntroData {
  // Nullable: the Strapi preview passes unset component fields as null.
  heading?: string | null
  subheading?: string | null
  description?: string | null
}

/**
 * Spacing variant of the intro, from the Figma "Used for" property. Set on
 * the block root as `data-intro-variant`; the spacer values per variant live
 * in src/styles/base/variables.css.
 */
export const BLOCK_INTRO_VARIANTS = [
  'universal',
  'button-cta',
  'profile-grid',
  'split-layout'
] as const
export type BlockIntroVariant = (typeof BLOCK_INTRO_VARIANTS)[number]
