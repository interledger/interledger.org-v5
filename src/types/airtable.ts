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

export interface TableRecord {
  id: string
  createdTime: string
  fields: {
    [key: string]: string | number | string[]
  }
}

// Specific interface for the Grantee Data - it matches the JSON structure we  generate for the frontend to consume (@/data/airtable/grantee-data.json)
export interface GranteeRecord extends TableRecord {
  fields: {
    Country: string
    'Project Name': string
    'Project Leader': string[]
    'Secondary Grant Program Name': string
    'Start Month': string
    Year: string
    'Total budget approved': number
    'Project Description'?: string
    'Project Links'?: string
    'Thematic Tag'?: string[]
  }
}
