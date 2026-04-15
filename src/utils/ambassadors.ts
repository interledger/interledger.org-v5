import { type AmbassadorFrontmatterType } from '@/schemas/content'
import {
  type AmbassadorData,
  type StrapiAmbassador
} from '@/components/ambassadors/types'

export const toAmbassadorData = (
  entry: AmbassadorFrontmatterType | StrapiAmbassador
): AmbassadorData => {
  const photo = typeof entry.photo === 'string' ? entry.photo : entry.photo?.url
  const photoAlt =
    typeof entry.photo === 'string'
      ? (entry as AmbassadorFrontmatterType).photoAlt
      : entry.photo?.alternativeText

  return {
    name: entry.name,
    pathSlug: entry.pathSlug,
    photo,
    photoAlt,
    quote: entry.quote
  }
}
