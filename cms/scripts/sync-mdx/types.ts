import type { ContentTypes } from './config'
import type { StrapiClient } from './strapi'

export interface SyncContext {
  contentTypes: ContentTypes
  strapi: StrapiClient
  DRY_RUN: boolean
}

export interface SyncResults {
  created: number
  updated: number
  deleted: number
  errors: number
}
