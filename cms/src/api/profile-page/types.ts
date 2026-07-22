/**
 * ProfilePage-specific types.
 * Used by the profile-page lifecycle and any lifecycle that references profile pages.
 */

import type { MediaFile } from '../../../types/shared/types'

export interface ProfilePageCta {
  text?: string
  link?: string
  style?: 'primary' | 'secondary'
  external?: boolean
}

export interface ProfilePageBase {
  id?: number
  documentId?: string
  pathSlug: string
  name: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  description?: string | null
  media?: { image?: MediaFile | null; alternativeText?: string } | null
  category?: string | null
  tagline?: string | null
  role?: string | null
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  cta?: ProfilePageCta | null
}
