import { describe, expect, it } from 'vitest'
import type { RawTableRecord } from '@/types/airtable'
import {
  LEGACY_REPORT_FIELDS,
  findHiddenLegacyReportFields,
  legacyReportFieldIdsToFetch,
  toLegacyGrantReport,
  toLegacyGrantReports
} from './airtableLegacyReports'

const F = LEGACY_REPORT_FIELDS
const GRANT_ID = 'recUSF6jZiBVoqG01'
const OTHER_GRANT_ID = 'recdUkEFGFR3970nG'
const FORUM_URL = 'https://community.interledger.org/gib/interim-report-1-abc'

// A Submitted Reports row with a forum link, as the API returns it.
function row(
  overrides: Record<string, unknown> = {},
  id = 'recRow0000000001'
): RawTableRecord {
  return {
    id,
    createdTime: '2026-11-15T00:00:00.000Z',
    fields: {
      [F.link.id]: FORUM_URL,
      [F.projects.id]: [GRANT_ID],
      [F.reportType.id]: 'Interim Report',
      [F.reportNumber.id]: 1,
      ...overrides
    } as RawTableRecord['fields']
  }
}

describe('toLegacyGrantReport', () => {
  it('reads a row with one forum link', () => {
    expect(toLegacyGrantReport(row())).toEqual({
      grantId: GRANT_ID,
      reportType: 'Interim Report',
      reportNumber: 1,
      url: FORUM_URL
    })
  })

  it('trims the space around the link', () => {
    const result = toLegacyGrantReport(row({ [F.link.id]: `  ${FORUM_URL}\n` }))
    expect(result).toMatchObject({ url: FORUM_URL })
  })

  it('fails on two links in one cell, without printing them', () => {
    const result = toLegacyGrantReport(
      row({ [F.link.id]: `${FORUM_URL}\n${FORUM_URL}-2` })
    )
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('one link, got more text')
    expect((result as Error).message).not.toContain(FORUM_URL)
  })

  it('fails on text that is not a link', () => {
    const result = toLegacyGrantReport(row({ [F.link.id]: 'see the forum' }))
    expect((result as Error).message).toContain('one link, got more text')
    const word = toLegacyGrantReport(row({ [F.link.id]: 'forum' }))
    expect((word as Error).message).toContain('a link, got text')
  })

  it('keeps a link to another site, over http or https', () => {
    for (const url of [
      'https://medium.com/@gib/report',
      'http://gib.example.org/report'
    ]) {
      expect(toLegacyGrantReport(row({ [F.link.id]: url }))).toMatchObject({
        url
      })
    }
  })

  it('fails on a link that is not a web link, without printing it', () => {
    const result = toLegacyGrantReport(
      row({ [F.link.id]: 'mailto:gib@example.org' })
    )
    expect((result as Error).message).toContain('a web link, got mailto:')
    expect((result as Error).message).not.toContain('gib@example.org')
  })

  it('fails on a row linked to two projects or none', () => {
    const two = toLegacyGrantReport(
      row({ [F.projects.id]: [GRANT_ID, OTHER_GRANT_ID] })
    )
    expect((two as Error).message).toContain('exactly one linked project')
    expect(
      toLegacyGrantReport(row({ [F.projects.id]: undefined }))
    ).toBeInstanceOf(Error)
  })

  it('lists every problem of the row, named by record ID', () => {
    const result = toLegacyGrantReport(
      row({
        [F.reportType.id]: undefined,
        [F.reportNumber.id]: 0
      })
    )
    const message = (result as Error).message
    expect(message).toContain('Submitted report recRow0000000001')
    expect(message).toContain('"Report type"')
    expect(message).toContain('"Report Num"')
  })
})

describe('toLegacyGrantReports', () => {
  it('skips rows with no link, without a warning', () => {
    const result = toLegacyGrantReports([
      row({ [F.link.id]: undefined }, 'recRow0000000002'),
      row({ [F.link.id]: '  ' }, 'recRow0000000003')
    ])
    expect(result).toEqual({ reports: [], skipped: [], linkedRows: 0 })
  })

  it('skips a bad row and keeps the others', () => {
    const result = toLegacyGrantReports([
      row(),
      row({ [F.link.id]: 'forum' }, 'recRow0000000002')
    ])
    expect(result.reports).toHaveLength(1)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]).toContain('recRow0000000002')
  })

  it('keeps one report when two rows share a report and a link', () => {
    const result = toLegacyGrantReports([row(), row({}, 'recRow0000000002')])
    expect(result.reports).toHaveLength(1)
    expect(result.skipped).toEqual([])
  })

  it('skips a report whose rows have different links', () => {
    const result = toLegacyGrantReports([
      row(),
      row({ [F.link.id]: `${FORUM_URL}-2` }, 'recRow0000000002')
    ])
    expect(result.reports).toEqual([])
    expect(result.skipped).toEqual([
      '2 different links for one report: recRow0000000001, recRow0000000002'
    ])
    expect(result.linkedRows).toBe(2)
  })

  it('names rows by their Report Id when the label field is given', () => {
    const LABEL = 'fldReportId00000'
    const result = toLegacyGrantReports(
      [
        row({ [LABEL]: 'Gib 1 Interim Report' }),
        row(
          { [LABEL]: 'Gib 1 Interim Report', [F.link.id]: `${FORUM_URL}-2` },
          'recRow0000000002'
        ),
        row(
          { [LABEL]: ' Gib 2 Final Report ', [F.link.id]: 'forum' },
          'recRow0000000003'
        )
      ],
      LABEL
    )
    expect(result.skipped).toEqual([
      expect.stringContaining(
        'Submitted report "Gib 2 Final Report" (ID: recRow0000000003)'
      ),
      '2 different links for one report: "Gib 1 Interim Report" (ID: recRow0000000001), "Gib 1 Interim Report" (ID: recRow0000000002)'
    ])
  })

  it('falls back to the record ID when the Report Id is blank', () => {
    const LABEL = 'fldReportId00000'
    const [message] = toLegacyGrantReports(
      [row({ [LABEL]: '  ', [F.link.id]: 'forum' })],
      LABEL
    ).skipped
    expect(message).toContain('Submitted report recRow0000000001')
  })

  it('sorts by grant, interim first, then by number', () => {
    const result = toLegacyGrantReports([
      row({ [F.reportType.id]: 'Final Report' }, 'recRow0000000001'),
      row(
        { [F.reportNumber.id]: 2, [F.link.id]: `${FORUM_URL}-2` },
        'recRow0000000002'
      ),
      row({ [F.projects.id]: [OTHER_GRANT_ID] }, 'recRow0000000003'),
      row({ [F.link.id]: `${FORUM_URL}-1` }, 'recRow0000000004')
    ])
    expect(
      result.reports.map(({ grantId, reportType, reportNumber }) => [
        grantId,
        reportType,
        reportNumber
      ])
    ).toEqual([
      [OTHER_GRANT_ID, 'Interim Report', 1],
      [GRANT_ID, 'Interim Report', 1],
      [GRANT_ID, 'Interim Report', 2],
      [GRANT_ID, 'Final Report', 1]
    ])
  })
})

describe('findHiddenLegacyReportFields', () => {
  it('names the fields the view hides', () => {
    expect(findHiddenLegacyReportFields(legacyReportFieldIdsToFetch())).toEqual(
      []
    )
    expect(findHiddenLegacyReportFields([F.link.id, F.projects.id])).toEqual([
      'Report type',
      'Report Num'
    ])
  })
})
