/**
 * Ambassador-specific types
 * Used by ambassador lifecycles and imported by other lifecycles (e.g. page)
 * that reference ambassador relations.
 */

import type { MediaFile } from '../../../types/shared/types'

export interface AmbassadorBase {
  id?: number
  documentId?: string
  slug: string
  name: string
  description?: string
  photo?: MediaFile | null
  photoAlt?: string | null
  linkedinUrl?: string | null
  grantReportUrl?: string | null
}
