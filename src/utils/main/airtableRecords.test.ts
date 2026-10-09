import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import type { RawTableRecord, TableRecord } from '@/types/airtable'
import {
  GRANTEE_FIELDS,
  type GranteeFieldName,
  checkGranteeFieldsPresent,
  buildContactNameMap,
  filterPublishedRecords,
  findRenamedFields,
  isRawTableRecord,
  listUnrenderedViewFields,
  resolveProjectLeaders,
  selectPublishedGranteeFields,
  toGranteeRecord,
  warnOnMissingProjectNames
} from './airtableRecords'

const CREATED = '2020-01-01T00:00:00.000Z'
const PUBLISHED_FIELD_ID = 'fldPublished'
const PUBLISHED = 'Published on Website'
const NAME_ID = GRANTEE_FIELDS['Project Name'].id
const ALL_COLUMNS = Object.keys(GRANTEE_FIELDS) as GranteeFieldName[]

function raw(fields: Record<string, unknown>, id = 'rec1'): RawTableRecord {
  return { id, createdTime: CREATED, fields }
}

function record(fields: TableRecord['fields'], id = 'rec1'): TableRecord {
  return { id, createdTime: CREATED, fields }
}

// A record with every grantee column set, as the sync writes it.
function completeRecord(id = 'rec1'): TableRecord {
  return record(
    {
      'Project Name': 'X',
      'Secondary Grant Program Name': 'Program',
      Year: '2024',
      'Start Month': '2024-01',
      Country: 'Kenya',
      'Project Leader': ['Ada Lovelace'],
      'Thematic Tag': ['Payments'],
      'Project Description': 'About X',
      'Total budget approved': 100,
      'Project Links': ['https://example.com']
    },
    id
  )
}

function withoutColumns(
  source: TableRecord,
  ...columns: string[]
): TableRecord {
  const fields = { ...source.fields }
  for (const column of columns) delete fields[column]
  return { ...source, fields }
}

// The record as Airtable returns it: keyed by field ID.
function toRaw(source: TableRecord): RawTableRecord {
  const fields = Object.fromEntries(
    Object.entries(GRANTEE_FIELDS).map(([name, { id }]) => [
      id,
      source.fields[name]
    ])
  )
  return raw(fields, source.id)
}

function errorMessage(result: unknown): string {
  expect(result).toBeInstanceOf(Error)
  return result instanceof Error ? result.message : ''
}

let warn: MockInstance<typeof console.warn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

describe('isRawTableRecord', () => {
  it('accepts any field values', () => {
    expect(
      isRawTableRecord(raw({ a: true, b: { error: '#ERROR!' }, c: null }))
    ).toBe(true)
    expect(isRawTableRecord(raw({}))).toBe(true)
  })

  it('rejects null and records missing id, createdTime or fields', () => {
    expect(isRawTableRecord(null)).toBe(false)
    expect(isRawTableRecord({ createdTime: CREATED, fields: {} })).toBe(false)
    expect(isRawTableRecord({ id: 'rec1', fields: {} })).toBe(false)
    expect(isRawTableRecord({ id: 'rec1', createdTime: CREATED })).toBe(false)
  })
})

describe('filterPublishedRecords', () => {
  it('keeps published records and drops drafts, whatever the drafts hold', () => {
    const published = raw(
      { [NAME_ID]: 'A', [PUBLISHED_FIELD_ID]: PUBLISHED },
      'recA'
    )
    const draft = raw({ [NAME_ID]: { error: '#ERROR!' }, x: true }, 'recB')
    expect(
      filterPublishedRecords([published, draft], PUBLISHED_FIELD_ID)
    ).toEqual([published])
    expect(warn).not.toHaveBeenCalled()
  })

  it('refuses to write an empty directory when nothing matches', () => {
    expect(
      errorMessage(
        filterPublishedRecords([raw({ [NAME_ID]: 'A' })], PUBLISHED_FIELD_ID)
      )
    ).toMatch(/matched 0 of 1/)
  })

  it('returns an empty list for empty input', () => {
    expect(filterPublishedRecords([], PUBLISHED_FIELD_ID)).toEqual([])
  })
})

describe('toGranteeRecord', () => {
  it('renames mapped field IDs to column names and drops unmapped columns', () => {
    const result = toGranteeRecord(
      raw({
        [NAME_ID]: 'X',
        [GRANTEE_FIELDS['Total budget approved'].id]: 100,
        [GRANTEE_FIELDS['Thematic Tag'].id]: ['a', 'b'],
        [PUBLISHED_FIELD_ID]: PUBLISHED,
        fldUnmapped: 'hidden'
      })
    )
    expect(result).toEqual(
      record({
        'Project Name': 'X',
        'Total budget approved': 100,
        'Thematic Tag': ['a', 'b']
      })
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('writes columns in map order, whatever order Airtable returns them in', () => {
    const result = toGranteeRecord(
      raw({ [GRANTEE_FIELDS.Country.id]: 'Kenya', [NAME_ID]: 'X' })
    )
    expect(Object.keys(result.fields)).toEqual(['Project Name', 'Country'])
  })

  it.each([
    ['Project Name', ['X'], 'expected string, got string[]'],
    ['Total budget approved', '100', 'expected number, got string'],
    ['Thematic Tag', 'Payments', 'expected string[], got string'],
    ['Project Links', ['a', 1], 'expected string[], got array'],
    ['Country', true, 'expected string, got boolean'],
    ['Country', null, 'expected string, got null'],
    ['Year', ['2024'], 'expected string | number, got string[]']
  ] as const)(
    'drops a wrong-shaped %s value with a warning',
    (column, value, reason) => {
      const result = toGranteeRecord(
        raw({ [NAME_ID]: 'X', [GRANTEE_FIELDS[column].id]: value })
      )
      expect(result.fields[column]).toBeUndefined()
      expect(warn).toHaveBeenCalledOnce()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`"${column}"`))
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(reason))
    }
  )

  it.each(['2024', 2024])('keeps a Year of %j without warning', (year) => {
    const result = toGranteeRecord(
      raw({ [NAME_ID]: 'X', [GRANTEE_FIELDS.Year.id]: year })
    )
    expect(result.fields.Year).toBe(year)
    expect(warn).not.toHaveBeenCalled()
  })

  it('labels a warning with the project name and record ID', () => {
    toGranteeRecord(raw({ [NAME_ID]: 'X', [GRANTEE_FIELDS.Country.id]: 1 }))
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('for record X (ID: rec1) ')
    )
  })

  it('labels a warning with the bare record ID when the name is blank', () => {
    toGranteeRecord(raw({ [NAME_ID]: '   ', [GRANTEE_FIELDS.Country.id]: 1 }))
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('for record rec1 — ')
    )
  })

  it('warns with the reason on a formula error', () => {
    const result = toGranteeRecord(
      raw({
        [NAME_ID]: 'X',
        [GRANTEE_FIELDS.Year.id]: { error: '#ERROR!' },
        [GRANTEE_FIELDS['Total budget approved'].id]: { specialValue: 'NaN' }
      })
    )
    expect(result.fields).toEqual({ 'Project Name': 'X' })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Formula error (#ERROR!) in field "Year"')
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Formula error (NaN) in field "Total budget approved"'
      )
    )
  })

  it('labels a warning with the record ID when there is no project name', () => {
    toGranteeRecord(raw({ [GRANTEE_FIELDS.Country.id]: 1 }, 'recNoName'))
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('for record recNoName ')
    )
  })
})

describe('checkGranteeFieldsPresent', () => {
  it('passes when each column is set on at least one record', () => {
    expect(
      checkGranteeFieldsPresent(
        [
          withoutColumns(completeRecord('recA'), 'Project Links'),
          record({ 'Project Links': ['https://example.com'] }, 'recB')
        ],
        ALL_COLUMNS
      )
    ).toBeUndefined()
  })

  it('returns an error listing every column absent from all records', () => {
    const incomplete = withoutColumns(
      completeRecord(),
      'Country',
      'Project Links'
    )
    expect(
      errorMessage(checkGranteeFieldsPresent([incomplete], ALL_COLUMNS))
    ).toMatch(/"Country", "Project Links"/)
  })

  it('counts blank strings and empty or all-blank arrays as absent', () => {
    const fields = {
      ...completeRecord().fields,
      Year: '  ',
      'Thematic Tag': [],
      'Project Links': ['', '  ']
    }
    expect(
      errorMessage(checkGranteeFieldsPresent([record(fields)], ALL_COLUMNS))
    ).toMatch(/"Year", "Thematic Tag", "Project Links"/)
  })

  it('checks only the columns it is given', () => {
    const noBudget = withoutColumns(completeRecord(), 'Total budget approved')
    const published = ALL_COLUMNS.filter(
      (name) => name !== 'Total budget approved'
    )
    expect(checkGranteeFieldsPresent([noBudget], published)).toBeUndefined()
  })

  it('refuses to write an empty directory when there are no records', () => {
    expect(errorMessage(checkGranteeFieldsPresent([], ALL_COLUMNS))).toMatch(
      /No published records/
    )
  })

  it('fails on a column whose type changed in every record', () => {
    const records = ['recA', 'recB'].map((id) => {
      const { fields } = toRaw(completeRecord(id))
      return toGranteeRecord(raw({ ...fields, [NAME_ID]: ['X'] }, id))
    })
    expect(
      errorMessage(checkGranteeFieldsPresent(records, ALL_COLUMNS))
    ).toMatch(/"Project Name"/)
  })

  it('fails when no project leader resolves to a named contact', () => {
    const unresolved = record({
      ...completeRecord().fields,
      'Project Leader': ['recUnnamed']
    })
    const records = resolveProjectLeaders([unresolved], new Map())
    expect(
      errorMessage(checkGranteeFieldsPresent(records, ALL_COLUMNS))
    ).toMatch(/"Project Leader"/)
  })
})

describe('buildContactNameMap', () => {
  it('skips missing, blank and non-string names without warning', () => {
    // Regression: contact recm3znGloYdWgXcj had no name and aborted the whole sync.
    const contacts = [
      raw({}, 'recm3znGloYdWgXcj'),
      raw({ fldName: '   ' }, 'recBlank'),
      raw({ fldName: 42 }, 'recNumber'),
      raw({ fldName: { error: '#ERROR!' } }, 'recError'),
      raw({ fldName: 'Ada Lovelace' }, 'recAda')
    ]
    expect([...buildContactNameMap(contacts, 'fldName')]).toEqual([
      ['recAda', 'Ada Lovelace']
    ])
    expect(warn).not.toHaveBeenCalled()
  })

  it('stores names trimmed', () => {
    const contacts = [raw({ fldName: ' Ada Lovelace ' }, 'recAda')]
    expect(buildContactNameMap(contacts, 'fldName').get('recAda')).toBe(
      'Ada Lovelace'
    )
  })

  it('returns an empty map rather than throwing when no contact is named', () => {
    const contacts = [raw({ fldName: ['Ada Lovelace'] }, 'recAda')]
    expect(buildContactNameMap(contacts, 'fldName').size).toBe(0)
  })
})

describe('resolveProjectLeaders', () => {
  const contacts = new Map([
    ['recAda', 'Ada Lovelace'],
    ['recGrace', 'Grace Hopper']
  ])

  it('leaves a record with no leader field unchanged', () => {
    const input = record({ 'Project Name': 'X' })
    expect(resolveProjectLeaders([input], contacts)).toEqual([input])
    expect(warn).not.toHaveBeenCalled()
  })

  it('replaces leader IDs with contact names', () => {
    const [result] = resolveProjectLeaders(
      [record({ 'Project Leader': ['recAda', 'recGrace'] })],
      contacts
    )
    expect(result?.fields['Project Leader']).toEqual([
      'Ada Lovelace',
      'Grace Hopper'
    ])
  })

  it('drops leaders with no named contact rather than writing a placeholder', () => {
    const [result] = resolveProjectLeaders(
      [
        record({
          'Project Name': 'X',
          'Project Leader': ['recAda', 'recMissing']
        })
      ],
      contacts
    )
    expect(result?.fields['Project Leader']).toEqual(['Ada Lovelace'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('recMissing'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('X (ID: rec1)'))
  })

  it('removes the field when no leader resolves', () => {
    const [result] = resolveProjectLeaders(
      [record({ 'Project Name': 'X', 'Project Leader': ['recMissing'] })],
      contacts
    )
    expect(result?.fields).toEqual({ 'Project Name': 'X' })
  })
})

describe('selectPublishedGranteeFields', () => {
  const idOf = (name: GranteeFieldName) => GRANTEE_FIELDS[name].id

  it('publishes the rendered columns visible in the view, in map order', () => {
    const visible = [idOf('Country'), 'fldProject', NAME_ID]
    expect(selectPublishedGranteeFields(visible)).toEqual({
      published: ['Project Name', 'Country'],
      hidden: ALL_COLUMNS.filter(
        (name) => name !== 'Project Name' && name !== 'Country'
      )
    })
  })

  it('publishes every rendered column when all are visible', () => {
    const visible = ALL_COLUMNS.map(idOf)
    expect(selectPublishedGranteeFields(visible)).toEqual({
      published: ALL_COLUMNS,
      hidden: []
    })
  })

  it('returns an error when Project Name is hidden, since the site drops unnamed grantees', () => {
    const visible = ALL_COLUMNS.filter((name) => name !== 'Project Name').map(
      idOf
    )
    expect(errorMessage(selectPublishedGranteeFields(visible))).toMatch(
      /"Project Name"/
    )
  })

  it('returns an error when the view has no visible columns', () => {
    expect(errorMessage(selectPublishedGranteeFields([]))).toMatch(
      /"Project Name"/
    )
  })
})

describe('listUnrenderedViewFields', () => {
  const fields = [
    { id: 'fldProject', name: 'Project', type: 'singleLineText' },
    { id: NAME_ID, name: 'Project Name', type: 'singleLineText' },
    { id: PUBLISHED_FIELD_ID, name: PUBLISHED, type: 'singleSelect' }
  ]

  it('names visible columns the site does not render, publish flag included', () => {
    expect(
      listUnrenderedViewFields(
        ['fldProject', NAME_ID, PUBLISHED_FIELD_ID],
        fields
      )
    ).toEqual(['Project', PUBLISHED])
  })

  it('falls back to the field ID when the column is missing from metadata', () => {
    expect(listUnrenderedViewFields(['fldGhost'], fields)).toEqual(['fldGhost'])
  })

  it('is empty when every visible column is rendered', () => {
    expect(listUnrenderedViewFields([NAME_ID], fields)).toEqual([])
  })
})

describe('findRenamedFields', () => {
  const expected = [
    { name: 'Project Name', id: NAME_ID },
    { name: 'Country', id: 'fldCountry' }
  ]

  it('pairs each column whose Airtable name differs from the name in code', () => {
    const fields = [
      { id: NAME_ID, name: 'Project Name', type: 'singleLineText' },
      { id: 'fldCountry', name: 'Country of residence', type: 'singleLineText' }
    ]
    expect(findRenamedFields(expected, fields)).toEqual([
      { name: 'Country', airtableName: 'Country of residence' }
    ])
  })

  it('is empty when every name matches', () => {
    const fields = [
      { id: NAME_ID, name: 'Project Name', type: 'singleLineText' },
      { id: 'fldCountry', name: 'Country', type: 'singleLineText' }
    ]
    expect(findRenamedFields(expected, fields)).toEqual([])
  })

  it('skips a column missing from the metadata, which fails elsewhere', () => {
    const fields = [
      { id: NAME_ID, name: 'Project Name', type: 'singleLineText' }
    ]
    expect(findRenamedFields(expected, fields)).toEqual([])
  })
})

describe('warnOnMissingProjectNames', () => {
  it('warns once per record with a missing or blank name', () => {
    warnOnMissingProjectNames([
      record({ 'Project Name': 'A' }, 'recA'),
      record({}, 'recMissing'),
      record({ 'Project Name': '  ' }, 'recBlank')
    ])
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('recMissing'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('recBlank'))
  })

  it('stays quiet when every record has a name', () => {
    warnOnMissingProjectNames([record({ 'Project Name': 'A' })])
    expect(warn).not.toHaveBeenCalled()
  })
})
