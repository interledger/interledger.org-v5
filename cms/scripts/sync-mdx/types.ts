import type { ContentTypes } from './config'
import type { StrapiClient } from './strapiClient'

export interface SyncContext {
  contentTypes: ContentTypes
  strapi: StrapiClient
}

export interface SyncResults {
  created: number
  updated: number
  deleted: number
  errors: number
}
