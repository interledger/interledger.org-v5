export interface TableMeta {
  tables: Table[]
}

export interface Table {
  id: string
  name: string
  primaryFieldId: string
  fields: Field[]
  views: View[]
}

export interface Field {
  id: string
  name: string
  type: string
  options?: Record<string, unknown>
  description?: string
}
export interface View {
  id: string
  name: string
  type: string
  visibleFieldIds?: string[]
}

export type AirtableFieldValue = string | number | string[]

// A record as the API returns it, keyed by field ID (the sync always sets
// returnFieldsByFieldId). Values are unvalidated.
export interface RawTableRecord {
  id: string
  createdTime: string
  fields: Record<string, unknown>
}

// A record as written to grantee-data.json, keyed by column name. Airtable
// omits empty cells, so any column can be missing.
export interface TableRecord {
  id: string
  createdTime: string
  fields: {
    [key: string]: AirtableFieldValue | undefined
  }
}

export type GrantReportType = 'Interim Report' | 'Final Report'

// A grant report as written to grant-reports.json. Programs can leave the
// report content empty: a text field is then '', a date null, and a list [].
// The five long-text fields are Markdown: Airtable returns rich text that way.
export interface GrantReport {
  id: string
  // Projects record ID. It matches a record in grantee-data.json only when
  // the grant is published in the directory.
  grantId: string
  // The ID that Programs use for the grant, for example 20260504.
  projectId: string
  // The grantee that owns the grant. The sync reads it from Grantees, because
  // grantee-data.json holds published grants only.
  granteeSlug: string
  projectName: string
  reportType: GrantReportType
  reportNumber: number
  publishedDate: string
  reportingPeriodStart: string | null
  reportingPeriodEnd: string | null
  summary: string
  progressOnObjectives: string
  whoBenefits: string
  outputs: string
  whatsNext: string
  license: string
  outputTypes: string[]
  interledgerTechnologies: string[]
  images: SyncedImage[]
}

// One image as written to the JSON files. The file is the sync's own copy
// under public/, never an Airtable URL. alt is '' when programs gave no
// description.
export interface SyncedImage {
  path: string
  width: number
  height: number
  alt: string
}

// A report before the sync joins it to its grantee.
export type UnlinkedGrantReport = Omit<GrantReport, 'granteeSlug'>

// A report as read from Airtable, before the sync downloads its images.
export type GrantReportContent = Omit<UnlinkedGrantReport, 'images'>

// An image attachment to download. The URL expires about 2 hours after the
// API returns it, so the sync downloads it in the same run.
export interface SyncedImageSource {
  attachmentId: string
  url: string
  sizeBytes: number
  alt: string
}

export interface ParsedGrantReport {
  content: GrantReportContent
  imageSources: SyncedImageSource[]
}

export type GranteeType = 'Organisation' | 'Individual'

// A grantee profile as written to grantee-profiles.json. Optional Airtable
// fields are null when programs left them empty.
export interface GranteeProfile {
  id: string
  name: string
  slug: string
  granteeType: GranteeType
  formerlyKnownAs: string | null
  description: string | null
  country: string | null
  website: string | null
  socialWeb: string | null
  twitter: string | null
  linkedIn: string | null
  bluesky: string | null
  // Projects record IDs. Each matches a record in grantee-data.json only
  // when the grant is published in the directory.
  grantIds: string[]
  grantCount: number
  totalCommitted: number
  // Legacy reports (community forum posts linked from Submitted Reports), not
  // the new reports in grant-reports.json, despite the Airtable field name.
  legacyReportCount: number
  thematicTags: string[]
  logo: SyncedImage | null
}

export type GranteeProfileContent = Omit<GranteeProfile, 'logo'>

export interface ParsedGranteeProfile {
  content: GranteeProfileContent
  logoSource: SyncedImageSource | null
}
