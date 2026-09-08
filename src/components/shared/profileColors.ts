/**
 * Color pairs for profile avatars and hero headers (Figma foreground/background).
 *
 * Both roles are applied as Tailwind `bg-*` fills: the avatar pair on the
 * circular photo frame in ProfileCard / ProfileDetailPage, the hero pair on
 * the detail-page banner. Grid position picks the pair via
 * `index % PROFILE_COLOR_PAIRS.length`.
 *
 * Light and dark palettes share the same background cycle (aqua mint → blush →
 * pistachio → apricot in light; royal purple → ocean → forest green → wine in
 * dark) but
 * use different accent hues on the avatar ring.
 */

interface ProfileColorPair {
  avatar: { light: string; dark: string }
  hero: { light: string; dark: string }
}

const PROFILE_COLOR_PAIRS: ProfileColorPair[] = [
  {
    avatar: { light: 'bg-lavender-100', dark: 'bg-soft-indigo-100' },
    hero: { light: 'bg-aqua-mint-100', dark: 'bg-royal-purple-100' }
  },
  {
    avatar: { light: 'bg-soft-indigo-100', dark: 'bg-deep-teal-100' },
    hero: { light: 'bg-blush-100', dark: 'bg-ocean-100' }
  },
  {
    avatar: { light: 'bg-flamingo-100', dark: 'bg-tangerine-100' },
    hero: { light: 'bg-pistachio-100', dark: 'bg-forest-green-100' }
  },
  {
    avatar: { light: 'bg-coral-red-100', dark: 'bg-raspberry-100' },
    hero: { light: 'bg-apricot-100', dark: 'bg-wine-100' }
  },
  {
    avatar: { light: 'bg-flamingo-100', dark: 'bg-lavender-100' },
    hero: { light: 'bg-aqua-mint-100', dark: 'bg-royal-purple-100' }
  },
  {
    avatar: { light: 'bg-emerald-100', dark: 'bg-lagoon-100' },
    hero: { light: 'bg-blush-100', dark: 'bg-ocean-100' }
  },
  {
    avatar: { light: 'bg-tangerine-100', dark: 'bg-raspberry-100' },
    hero: { light: 'bg-pistachio-100', dark: 'bg-forest-green-100' }
  },
  {
    avatar: { light: 'bg-soft-indigo-100', dark: 'bg-orchid-100' },
    hero: { light: 'bg-apricot-100', dark: 'bg-wine-100' }
  },
  {
    avatar: { light: 'bg-tangerine-100', dark: 'bg-deep-teal-100' },
    hero: { light: 'bg-aqua-mint-100', dark: 'bg-royal-purple-100' }
  },
  {
    avatar: { light: 'bg-coral-red-100', dark: 'bg-orchid-100' },
    hero: { light: 'bg-blush-100', dark: 'bg-ocean-100' }
  },
  {
    avatar: { light: 'bg-lavender-100', dark: 'bg-tangerine-100' },
    hero: { light: 'bg-pistachio-100', dark: 'bg-forest-green-100' }
  },
  {
    avatar: { light: 'bg-emerald-100', dark: 'bg-periwinkle-100' },
    hero: { light: 'bg-apricot-100', dark: 'bg-wine-100' }
  }
]

function themedColorClass(light: string, dark: string): string {
  return `${light} dark:${dark}`
}

export function getProfileAvatarColorClass(index: number): string {
  const pair = PROFILE_COLOR_PAIRS[index % PROFILE_COLOR_PAIRS.length]
  return themedColorClass(pair.avatar.light, pair.avatar.dark)
}

export function getProfileHeroColorClass(index: number): string {
  const pair = PROFILE_COLOR_PAIRS[index % PROFILE_COLOR_PAIRS.length]
  return themedColorClass(pair.hero.light, pair.hero.dark)
}
