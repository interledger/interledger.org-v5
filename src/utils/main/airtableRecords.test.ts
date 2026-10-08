import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TableRecord } from '@/types/airtable'
import {
  buildContactNameMap,
  filterPublishedRecords,
  isTableRecord,
  resolveProjectLeaders,
  sanitizeRecordFields,
  warnOnMissingProjectNames
} from './airtableRecords'

const LEADER = 'Project Leader'
const PUBLISHED = 'Published on Website'

function record(fields: TableRecord['fields'], id = 'rec1'): TableRecord {
  return { id, createdTime: '2020-01-01T00:00:00.000Z', fields }
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

describe('buildContactNameMap', () => {
  it('skips a contact whose name field is missing instead of throwing', () => {
    // Regression: contact recm3znGloYdWgXcj had no name and aborted the whole sync.
    const contacts = [
      record({}, 'recm3znGloYdWgXcj'),
      record({ Name: 'Ada Lovelace' }, 'recAda')
    ]
    const map = buildContactNameMap(contacts, 'Name')
    expect([...map]).toEqual([['recAda', 'Ada Lovelace']])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('recm3znGloYdWgXcj')
    )
  })

  it('skips a contact whose name is blank or not a string', () => {
    const contacts = [
      record({ Name: '   ' }, 'recBlank'),
      record({ Name: 42 }, 'recNumber'),
      record({ Name: 'Ada Lovelace' }, 'recAda')
    ]
    expect([...buildContactNameMap(contacts, 'Name').keys()]).toEqual([
      'recAda'
    ])
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('throws when no contact has a name, as after a field type change', () => {
    // A lookup field returns string[], which is a valid field value but not a name.
    const contacts = [
      record({ Name: ['Ada Lovelace'] }, 'recAda'),
      record({ Name: ['Grace Hopper'] }, 'recGrace')
    ]
    expect(() => buildContactNameMap(contacts, 'Name')).toThrow(
      /No contact in 2 records has a name in "Name"/
    )
  })

  it('returns an empty map for an empty contacts table', () => {
    expect(buildContactNameMap([], 'Name').size).toBe(0)
  })
})

describe('resolveProjectLeaders', () => {
  const contacts = new Map([
    ['recAda', 'Ada Lovelace'],
    ['recGrace', 'Grace Hopper']
  ])

  it('leaves a record with no leader field unchanged', () => {
    const input = record({ 'Project Name': 'X' })
    expect(resolveProjectLeaders([input], contacts, LEADER)).toEqual([input])
    expect(warn).not.toHaveBeenCalled()
  })

  it('replaces leader IDs with contact names', () => {
    const [result] = resolveProjectLeaders(
      [record({ [LEADER]: ['recAda', 'recGrace'] })],
      contacts,
      LEADER
    )
    expect(result?.fields[LEADER]).toEqual(['Ada Lovelace', 'Grace Hopper'])
  })

  it('drops leaders with no named contact rather than writing a placeholder', () => {
    const [result] = resolveProjectLeaders(
      [record({ 'Project Name': 'X', [LEADER]: ['recAda', 'recMissing'] })],
      contacts,
      LEADER
    )
    expect(result?.fields[LEADER]).toEqual(['Ada Lovelace'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('recMissing'))
  })

  it('removes the field when no leader resolves', () => {
    const [result] = resolveProjectLeaders(
      [record({ 'Project Name': 'X', [LEADER]: ['recMissing'] })],
      contacts,
      LEADER
    )
    expect(result?.fields).toEqual({ 'Project Name': 'X' })
  })

  it('removes a non-array leader field instead of throwing', () => {
    const [result] = resolveProjectLeaders(
      [record({ 'Project Name': 'X', [LEADER]: 'recAda' })],
      contacts,
      LEADER
    )
    expect(result?.fields).toEqual({ 'Project Name': 'X' })
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('sanitizeRecordFields', () => {
  it('removes formula errors and unsupported values, keeping valid ones', () => {
    const raw = {
      id: 'rec1',
      createdTime: '2020-01-01T00:00:00.000Z',
      fields: {
        'Project Name': 'X',
        Budget: 100,
        Tags: ['a', 'b'],
        Broken: { error: '#ERROR!' },
        Ratio: { specialValue: 'NaN' },
        Checkbox: true,
        Attachment: [{ url: 'https://example.com/a.png' }],
        Mixed: ['a', 1],
        Empty: null
      }
    }
    sanitizeRecordFields(raw)
    expect(raw.fields).toEqual({
      'Project Name': 'X',
      Budget: 100,
      Tags: ['a', 'b']
    })
    expect(warn).toHaveBeenCalledTimes(6)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('X (ID: rec1)'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('#ERROR!'))
  })

  it('ignores values without a fields object', () => {
    expect(() => sanitizeRecordFields(null)).not.toThrow()
    expect(() => sanitizeRecordFields({ id: 'rec1' })).not.toThrow()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('isTableRecord', () => {
  it('accepts a sanitised record and one with no fields set', () => {
    const raw = { ...record({}), fields: { Name: 'X', Flag: true } }
    sanitizeRecordFields(raw)
    expect(isTableRecord(raw)).toBe(true)
    expect(isTableRecord(record({}))).toBe(true)
  })

  it('rejects records missing id, createdTime or fields', () => {
    expect(isTableRecord({ createdTime: 'x', fields: {} })).toBe(false)
    expect(isTableRecord({ id: 'rec1', fields: {} })).toBe(false)
    expect(isTableRecord({ id: 'rec1', createdTime: 'x' })).toBe(false)
  })

  it('rejects unsanitised values', () => {
    expect(isTableRecord({ ...record({}), fields: { Flag: true } })).toBe(false)
  })
})

describe('filterPublishedRecords', () => {
  it('keeps published records and strips the flag', () => {
    const result = filterPublishedRecords(
      [
        record({ 'Project Name': 'A', [PUBLISHED]: PUBLISHED }, 'recA'),
        record({ 'Project Name': 'B' }, 'recB')
      ],
      PUBLISHED
    )
    expect(result).toEqual([record({ 'Project Name': 'A' }, 'recA')])
  })

  it('refuses to write an empty directory when nothing matches', () => {
    expect(() =>
      filterPublishedRecords([record({ 'Project Name': 'A' })], PUBLISHED)
    ).toThrow(/matched 0 of 1/)
  })

  it('returns an empty list for empty input', () => {
    expect(filterPublishedRecords([], PUBLISHED)).toEqual([])
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
