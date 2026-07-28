/**
 * MDX generation for the podcast-page content type.
 *
 * Kept in utils (not in the api lifecycle file) so it can be unit-tested
 * without Strapi loading a test file from the api directory at runtime.
 *
 * Unlike foundation-page/grant-overview-page, podcast-page has no `content`
 * dynamic zone — title cards and podcast episodes are page-owned repeatable
 * components, flattened straight into frontmatter (no JSX serialization).
 */

import matter from 'gray-matter'
import isHtml from 'is-html'
import type { MediaFile } from '../../types/shared/types'
import {
  defaultLang,
  MATTER_STRINGIFY_OPTIONS,
  heroFrontmatter,
  getImageUrl,
  htmlToMarkdown,
  type HeroCta
} from './mdx'

/** CKEditor (basicMarkdownPreset) fields are usually already markdown, but
 * defensively convert if Strapi ever hands back HTML (matches
 * generateFaqMdx's identical pattern). */
function ckeditorFieldToMarkdown(value: string): string {
  return (isHtml(value) ? htmlToMarkdown(value) : value).trim()
}

export interface PodcastPageHero {
  title?: string
  description?: string
  backgroundImage?: MediaFile | null
  backgroundImageMobile?: MediaFile | null
  hero_call_to_action?: HeroCta | null
}

export interface PodcastPageCtaStrip {
  heading?: string
  description?: string
  primaryButtonText?: string
  primaryButtonLink?: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
  color?: 'purple' | 'green'
}

export interface PodcastPageTitleCard {
  heading: string
  subHeading?: string
  description: string
  secondaryCta: { text: string; link: string; external?: boolean }
}

export interface PodcastPageTitleCardGrid {
  columns: 'Three' | 'Two'
  ariaLabel: string
  titleCards: PodcastPageTitleCard[]
}

export interface PodcastPageItem {
  title: string
  description: string
  url: string
  series: 'Interledger Salon' | 'Future Money' | 'Off the Ledger'
  episode?: string | null
  coverImage?: MediaFile | null
}

export interface PodcastPageInput {
  title: string
  pathSlug: string
  description: string
  hero?: PodcastPageHero | null
  titleCards: PodcastPageTitleCardGrid
  podcasts: PodcastPageItem[]
  ctaStrip: PodcastPageCtaStrip
  locale?: string
}

function titleCardsFrontmatter(grid: PodcastPageTitleCardGrid) {
  return {
    columns: grid.columns,
    ariaLabel: grid.ariaLabel,
    cards: grid.titleCards.map((card) => ({
      heading: card.heading,
      ...(card.subHeading ? { subHeading: card.subHeading } : {}),
      description: ckeditorFieldToMarkdown(card.description),
      secondaryCta: {
        text: card.secondaryCta.text,
        link: card.secondaryCta.link,
        ...(card.secondaryCta.external ? { external: true } : {})
      }
    }))
  }
}

function ctaStripFrontmatter(ctaStrip: PodcastPageCtaStrip) {
  return {
    heading: ctaStrip.heading ?? '',
    description: ctaStrip.description ?? '',
    buttonText: ctaStrip.primaryButtonText ?? '',
    buttonLink: ctaStrip.primaryButtonLink ?? '',
    color: ctaStrip.color ?? 'purple',
    ...(ctaStrip.secondaryButtonText
      ? { secondaryButtonText: ctaStrip.secondaryButtonText }
      : {}),
    ...(ctaStrip.secondaryButtonLink
      ? { secondaryButtonLink: ctaStrip.secondaryButtonLink }
      : {})
  }
}

function podcastsFrontmatter(podcasts: PodcastPageItem[]) {
  return podcasts.map((podcast) => ({
    title: podcast.title,
    description: podcast.description,
    url: podcast.url,
    series: podcast.series,
    ...(podcast.episode ? { episode: podcast.episode } : {}),
    coverImage: getImageUrl(podcast.coverImage) ?? null
  }))
}

/**
 * Serialize the podcast-page into MDX (frontmatter only — no body).
 * For non-default locales, `englishSlug` is written as `localizes`.
 */
export function generatePodcastPageMdx(
  page: PodcastPageInput,
  englishSlug?: string
): string {
  const locale = page.locale ?? defaultLang
  const isLocalized = locale !== defaultLang

  const frontmatter: Record<string, unknown> = {
    title: page.title,
    pathSlug: page.pathSlug,
    description: page.description,
    ...heroFrontmatter(page.hero ?? undefined),
    titleCards: titleCardsFrontmatter(page.titleCards),
    podcasts: podcastsFrontmatter(page.podcasts),
    ctaStrip: ctaStripFrontmatter(page.ctaStrip),
    locale,
    ...(isLocalized && englishSlug ? { localizes: englishSlug } : {})
  }

  return matter.stringify('', frontmatter, MATTER_STRINGIFY_OPTIONS)
}
