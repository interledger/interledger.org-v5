import FoundationPageLayout from '@/layouts/FoundationPageLayout.astro'
import SummitPageLayout from '@/layouts/SummitPageLayout.astro'
import HackathonPageLayout from '@/layouts/HackathonPageLayout.astro'
import type { SiteSection } from './static-paths'

export function getSectionPageLayout(section: SiteSection | null | undefined) {
  if (section === 'summit') return SummitPageLayout
  if (section === 'hackathon') return HackathonPageLayout
  return FoundationPageLayout
}
