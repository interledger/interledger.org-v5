import { describe, expect, it } from 'vitest'
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
  selectPublishedGranteeFields,
  toGranteeRecord,
  toGranteeRecords
} from './airtableRecords'

const CREATED = '2020-01-01T00:00:00.000Z'
const PUBLISHED_FIELD_ID = 'fldPublished'
const PUBLISHED = 'Published on Website'
const NAME_ID = GRANTEE_FIELDS['Project Name'].id
const COUNTRY_ID = GRANTEE_FIELDS.Country.id
const LEADER_ID = GRANTEE_FIELDS['Project Leader'].id
const ALL_COLUMNS = Object.keys(GRANTEE_FIELDS) as GranteeFieldName[]
const NO_CONTACTS = new Map<string, string>()

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

function errorMessage(result: unknown): string {
  expect(result).toBeInstanceOf(Error)
  return result instanceof Error ? result.message : ''
}

function expectRecord(result: TableRecord | Error): TableRecord {
  expect(result).not.toBeInstanceOf(Error)
  return result as TableRecord
}

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
  const contacts = new Map([
    ['recAda', 'Ada Lovelace'],
    ['recGrace', 'Grace Hopper']
  ])

  it('renames mapped field IDs to column names and drops unmapped columns', () => {
    const result = toGranteeRecord(
      raw({
        [NAME_ID]: 'X',
        [GRANTEE_FIELDS['Total budget approved'].id]: 100,
        [GRANTEE_FIELDS['Thematic Tag'].id]: ['a', 'b'],
        [PUBLISHED_FIELD_ID]: PUBLISHED,
        fldUnmapped: 'hidden'
      }),
      NO_CONTACTS
    )
    expect(result).toEqual(
      record({
        'Project Name': 'X',
        'Total budget approved': 100,
        'Thematic Tag': ['a', 'b']
      })
    )
  })

  it('writes columns in map order, whatever order Airtable returns them in', () => {
    const { fields } = expectRecord(
      toGranteeRecord(
        raw({ [COUNTRY_ID]: 'Kenya', [NAME_ID]: 'X' }),
        NO_CONTACTS
      )
    )
    expect(Object.keys(fields)).toEqual(['Project Name', 'Country'])
  })

  it('writes a blank optional value as it is', () => {
    const { fields } = expectRecord(
      toGranteeRecord(raw({ [NAME_ID]: 'X', [COUNTRY_ID]: '  ' }), NO_CONTACTS)
    )
    expect(fields.Country).toBe('  ')
  })

  it.each([
    ['Total budget approved', '100', 'expected number, got string'],
    ['Thematic Tag', 'Payments', 'expected string[], got string'],
    ['Project Links', ['a', 1], 'expected string[], got array'],
    ['Country', true, 'expected string, got boolean'],
    ['Country', null, 'expected string, got null'],
    ['Year', ['2024'], 'expected string | number, got string[]']
  ] as const)('fails on a wrong-shaped %s value', (column, value, reason) => {
    const message = errorMessage(
      toGranteeRecord(
        raw({ [NAME_ID]: 'X', [GRANTEE_FIELDS[column].id]: value }),
        NO_CONTACTS
      )
    )
    expect(message).toContain(`"${column}": ${reason}`)
  })

  it.each(['2024', 2024])('keeps a Year of %j', (year) => {
    const { fields } = expectRecord(
      toGranteeRecord(
        raw({ [NAME_ID]: 'X', [GRANTEE_FIELDS.Year.id]: year }),
        NO_CONTACTS
      )
    )
    expect(fields.Year).toBe(year)
  })

  it('lists every problem of the record, labelled with its project name and ID', () => {
    const message = errorMessage(
      toGranteeRecord(
        raw({
          [NAME_ID]: 'X',
          [GRANTEE_FIELDS.Year.id]: { error: '#ERROR!' },
          [COUNTRY_ID]: 1,
          [GRANTEE_FIELDS['Total budget approved'].id]: { specialValue: 'NaN' }
        }),
        NO_CONTACTS
      )
    )
    expect(message).toBe(
      [
        'Record X (ID: rec1):',
        '  - "Year": formula error (#ERROR!)',
        '  - "Country": expected string, got number',
        '  - "Total budget approved": formula error (NaN)'
      ].join('\n')
    )
  })

  it.each([
    ['absent', {}],
    ['undefined', { [NAME_ID]: undefined }],
    ['blank', { [NAME_ID]: '   ' }]
  ])(
    'fails on a missing Project Name (%s), labelled by the record ID',
    (_case, fields) => {
      expect(errorMessage(toGranteeRecord(raw(fields), NO_CONTACTS))).toBe(
        'Record rec1:\n  - "Project Name": missing'
      )
    }
  )

  it('reports a wrong-shaped Project Name once, not also as missing', () => {
    expect(
      errorMessage(toGranteeRecord(raw({ [NAME_ID]: ['X'] }), NO_CONTACTS))
    ).toBe('Record rec1:\n  - "Project Name": expected string, got string[]')
  })

  it('replaces leader IDs with contact names, in order', () => {
    const { fields } = expectRecord(
      toGranteeRecord(
        raw({ [NAME_ID]: 'X', [LEADER_ID]: ['recGrace', 'recAda'] }),
        contacts
      )
    )
    expect(fields['Project Leader']).toEqual(['Grace Hopper', 'Ada Lovelace'])
  })

  it('fails on leaders with no named contact, with the record’s other problems', () => {
    const message = errorMessage(
      toGranteeRecord(
        raw({
          [NAME_ID]: 'X',
          [COUNTRY_ID]: 1,
          [LEADER_ID]: ['recAda', 'recMissing', 'recGone']
        }),
        contacts
      )
    )
    expect(message).toBe(
      [
        'Record X (ID: rec1):',
        '  - "Country": expected string, got number',
        '  - "Project Leader": no contact name for recMissing, recGone'
      ].join('\n')
    )
  })
})

describe('toGranteeRecords', () => {
  it('lists every bad record in one error', () => {
    const message = errorMessage(
      toGranteeRecords(
        [
          raw({}, 'recA'),
          raw({ [NAME_ID]: 'B' }, 'recB'),
          raw({ [NAME_ID]: 'C', [COUNTRY_ID]: 1 }, 'recC')
        ],
        NO_CONTACTS
      )
    )
    expect(message).toMatch(/^2 record\(s\) cannot be published:\n/)
    expect(message).toContain('Record recA:')
    expect(message).toContain('Record C (ID: recC):')
    expect(message).not.toContain('recB')
  })

  it('returns the records when every one is valid', () => {
    expect(
      toGranteeRecords(
        [raw({ [NAME_ID]: 'A' }, 'recA'), raw({ [NAME_ID]: 'B' }, 'recB')],
        NO_CONTACTS
      )
    ).toEqual([
      record({ 'Project Name': 'A' }, 'recA'),
      record({ 'Project Name': 'B' }, 'recB')
    ])
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
})

describe('buildContactNameMap', () => {
  it('skips missing, blank and non-string names', () => {
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
