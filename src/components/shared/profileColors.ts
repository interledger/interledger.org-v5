/**
 * Background color palette for profile avatars and hero headers.
 *
 * 16-color sequence applied by a profile's render position in the grid.
 */

const PROFILE_AVATAR_COLORS = [
  'bg-orchid-100',
  'bg-sea-foam-100',
  'bg-emerald-100',
  'bg-coral-red-100',
  'bg-periwinkle-100',
  'bg-deep-teal-100',
  'bg-tangerine-100',
  'bg-raspberry-100',
  'bg-lavender-100',
  'bg-lagoon-100',
  'bg-apricot-100',
  'bg-flamingo-100',
  'bg-soft-indigo-100',
  'bg-pistachio-100',
  'bg-aqua-mint-100',
  'bg-blush-100'
] as const

/** Lighter tint of the same palette, for hero banners behind a profile's content. */
const PROFILE_HERO_COLORS = [
  'bg-orchid-100/20',
  'bg-sea-foam-100/20',
  'bg-emerald-100/20',
  'bg-coral-red-100/20',
  'bg-periwinkle-100/20',
  'bg-deep-teal-100/20',
  'bg-tangerine-100/20',
  'bg-raspberry-100/20',
  'bg-lavender-100/20',
  'bg-lagoon-100/20',
  'bg-apricot-100/20',
  'bg-flamingo-100/20',
  'bg-soft-indigo-100/20',
  'bg-pistachio-100/20',
  'bg-aqua-mint-100/20',
  'bg-blush-100/20'
] as const

export function getProfileAvatarColorClass(index: number): string {
  return PROFILE_AVATAR_COLORS[index % PROFILE_AVATAR_COLORS.length]
}

export function getProfileHeroColorClass(index: number): string {
  return PROFILE_HERO_COLORS[index % PROFILE_HERO_COLORS.length]
}
