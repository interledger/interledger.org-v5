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
