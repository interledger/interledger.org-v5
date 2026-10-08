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

// Airtable omits empty cells from `fields`, so any field can be missing.
export interface TableRecord {
  id: string
  createdTime: string
  fields: {
    [key: string]: AirtableFieldValue | undefined
  }
}
