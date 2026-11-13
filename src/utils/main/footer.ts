import type { MenuGroup, NavigationSite } from '@/types/navigation'
import type { SocialIconName } from '../shared/url'
import { type Locale, type UiKey, useTranslations } from './i18'
import { translatePath } from './translatePath'

export interface SocialLink {
  href: string
  icon: SocialIconName
  labelKey: UiKey
}

/** Interledger's official social profiles, in footer display order. */
export const socialLinks: SocialLink[] = [
  {
    href: 'https://www.youtube.com/@InterledgerFoundation',
    icon: 'youtube',
    labelKey: 'footer.youtube'
  },
  {
    href: 'https://interledger.social/@Interledger',
    icon: 'mastodon',
    labelKey: 'footer.mastodon'
  },
  { href: 'https://x.com/interledger', icon: 'x', labelKey: 'footer.x' },
  {
    href: 'https://github.com/interledger',
    icon: 'github',
    labelKey: 'footer.github'
  },
  {
    href: 'https://www.instagram.com/interledgerfoundation/',
    icon: 'instagram',
    labelKey: 'footer.instagram'
  },
  {
    href: 'https://www.linkedin.com/company/interledger-foundation/',
    icon: 'linkedin',
    labelKey: 'footer.linkedin'
  },
  {
    href: 'https://join.slack.com/t/interledger/shared_invite/zt-44g089zrn-XdSIiHF~cs8Oo_MBmSfECA',
    icon: 'slack',
    labelKey: 'footer.slack'
  }
]

/**
 * The footer's extra nav column — items shown in the footer only, on top of
 * `mainMenu` (shared with the header via `getNavigation`). Hackathon's links
 * all live in its own nav, so it gets nothing here. Summit's nav never had
 * the legal links MicrositeFooter rendered, so it keeps terms and privacy
 * only. Press and FAQ stay on the foundation footer.
 */
export function getFooterOnlyColumn(
  site: NavigationSite,
  lang: Locale
): MenuGroup | null {
  if (site === 'hackathon') return null

  const t = useTranslations(lang)
  const legal = [
    {
      label: t('footer.terms_service'),
      href: translatePath('foundation-pages', lang, 'terms-of-service')
    },
    {
      label: t('footer.privacy_policy'),
      href: translatePath('foundation-pages', lang, 'privacy-policy')
    }
  ]

  return {
    label: t('footer.resources'),
    items:
      site === 'summit'
        ? legal
        : [
            ...legal,
            {
              label: t('footer.press_media'),
              href: translatePath('foundation-pages', lang, 'press')
            },
            {
              label: t('footer.faq'),
              href: translatePath('foundation-pages', lang, 'faq')
            }
          ]
  }
}
