import { type AmbassadorFrontmatterType } from '@/schemas/content'
import {
  type AmbassadorData,
  type StrapiAmbassador
} from '@/components/ambassadors/types'

function isAmbassadorFrontmatterType(
  entry: AmbassadorFrontmatterType | StrapiAmbassador
): entry is AmbassadorFrontmatterType {
  return 'photoAlt' in entry
}

export const toAmbassadorData = (
  entry: AmbassadorFrontmatterType | StrapiAmbassador
): AmbassadorData => {
  const photo = isAmbassadorFrontmatterType(entry)
    ? entry.photo
    : entry.photo?.url
  const photoAlt = isAmbassadorFrontmatterType(entry)
    ? entry.photoAlt
    : entry.photo?.alternativeText

  return {
    name: entry.name,
    pathSlug: entry.pathSlug,
    photo,
    photoAlt,
    quote: entry.quote,
    ...(!isAmbassadorFrontmatterType(entry) && {
      linkedinUrl: entry.linkedinUrl,
      grantReportUrl: entry.grantReportUrl
    })
  }
}
