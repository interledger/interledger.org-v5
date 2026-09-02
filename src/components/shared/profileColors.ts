/**
 * Foreground/background color pairs for profile avatars and hero headers.
 *
 * 12-pair sequence from design — avatar circle uses the saturated foreground;
 * detail-page hero banner uses the lighter background tint. Position in the
 * grid determines which pair applies (index % 12).
 */

const PROFILE_COLOR_PAIRS = [
  { avatar: 'bg-lavender-100', hero: 'bg-aqua-mint-50' },
  { avatar: 'bg-soft-indigo-100', hero: 'bg-blush-50' },
  { avatar: 'bg-flamingo-100', hero: 'bg-pistachio-50' },
  { avatar: 'bg-coral-red-100', hero: 'bg-apricot-50' },
  { avatar: 'bg-flamingo-100', hero: 'bg-aqua-mint-50' },
  { avatar: 'bg-emerald-100', hero: 'bg-blush-50' },
  { avatar: 'bg-tangerine-100', hero: 'bg-pistachio-50' },
  { avatar: 'bg-soft-indigo-100', hero: 'bg-apricot-50' },
  { avatar: 'bg-tangerine-100', hero: 'bg-aqua-mint-50' },
  { avatar: 'bg-coral-red-100', hero: 'bg-blush-50' },
  { avatar: 'bg-lavender-100', hero: 'bg-pistachio-50' },
  { avatar: 'bg-emerald-100', hero: 'bg-apricot-50' }
] as const

export function getProfileAvatarColorClass(index: number): string {
  return PROFILE_COLOR_PAIRS[index % PROFILE_COLOR_PAIRS.length].avatar
}

export function getProfileHeroColorClass(index: number): string {
  return PROFILE_COLOR_PAIRS[index % PROFILE_COLOR_PAIRS.length].hero
}
