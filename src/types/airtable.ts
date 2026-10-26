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

// A grant report as written to grant-reports.json. The sync fails rather than
// write a report with a required value missing, so no field is optional. The
// five long-text fields are Markdown: Airtable returns rich text that way.
export interface GrantReport {
  id: string
  projectName: string
  reportType: GrantReportType
  reportNumber: number
  publishedDate: string
  reportingPeriodStart: string
  reportingPeriodEnd: string
  summary: string
  progressOnObjectives: string
  whoBenefits: string
  outputs: string
  whatsNext: string
  license: string
  outputTypes: string[]
  interledgerTechnologies: string[]
}
