import { describe, expect, it } from 'vitest'
import type { ParsedGrantReport, RawTableRecord } from '@/types/airtable'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_SOURCE_IMAGE_BYTES
} from './airtableFieldValues'
import {
  LIVE_STATUS,
  PUBLICATION_STATUS_FIELD_ID,
  REPORT_FIELDS,
  findHiddenReportFields,
  isLiveReport,
  reportFieldIdsToFetch,
  toGrantReport,
  toGrantReports
} from './airtableReports'

const CREATED = '2026-11-15T00:00:00.000Z'
const F = REPORT_FIELDS

// A Live report with every field set, as the API returns it (keyed by field ID).
function liveReport(
  overrides: Record<string, unknown> = {},
  id = 'rec1'
): RawTableRecord {
  return {
    id,
    createdTime: CREATED,
    fields: {
      [PUBLICATION_STATUS_FIELD_ID]: LIVE_STATUS,
      [F.publishedDate.id]: '2026-11-20',
      [F.reportingPeriodStart.id]: '2026-05-01',
      [F.reportingPeriodEnd.id]: '2026-10-31',
      [F.summary.id]: 'We **shipped** it.\n',
      [F.progressOnObjectives.id]: 'Progress',
      [F.whoBenefits.id]: 'Merchants',
      [F.outputs.id]: 'A library',
      [F.whatsNext.id]: 'More',
      [F.license.id]: 'Apache-2.0',
      [F.outputTypes.id]: ['Software or code'],
      [F.interledgerTechnologies.id]: ['Open Payments'],
      [F.projectName.id]: ['Gib'],
      [F.reportType.id]: ['Interim Report'],
      [F.reportNumber.id]: [1],
      ...overrides
    }
  }
}

// An Airtable attachment object as the API returns it.
function attachment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att1',
    url: 'https://v5.airtableusercontent.com/att1',
    filename: 'photo.jpg',
    size: 1000,
    type: 'image/jpeg',
    ...overrides
  }
}

function expectParsed(result: unknown): ParsedGrantReport {
  expect(result).not.toBeInstanceOf(Error)
  return result as ParsedGrantReport
}

function idsOf(result: unknown): string[] {
  expect(result).not.toBeInstanceOf(Error)
  return (result as ParsedGrantReport[]).map(({ content }) => content.id)
}

function expectError(result: unknown): Error {
  expect(result).toBeInstanceOf(Error)
  return result as Error
}

describe('toGrantReport', () => {
  it('maps a complete record to the report shape', () => {
    expect(expectParsed(toGrantReport(liveReport())).content).toEqual({
      id: 'rec1',
      projectName: 'Gib',
      reportType: 'Interim Report',
      reportNumber: 1,
      publishedDate: '2026-11-20',
      reportingPeriodStart: '2026-05-01',
      reportingPeriodEnd: '2026-10-31',
      summary: 'We **shipped** it.',
      progressOnObjectives: 'Progress',
      whoBenefits: 'Merchants',
      outputs: 'A library',
      whatsNext: 'More',
      license: 'Apache-2.0',
      outputTypes: ['Software or code'],
      interledgerTechnologies: ['Open Payments']
    })
  })

  it('returns no image sources when no image field is set', () => {
    expect(expectParsed(toGrantReport(liveReport())).imageSources).toEqual([])
  })

  it('returns one source per image, in slot order, with its description as alt', () => {
    const parsed = expectParsed(
      toGrantReport(
        liveReport({
          [F.image3.id]: [attachment({ id: 'att3' })],
          [F.imageDescription3.id]: '  A chart  ',
          [F.image1.id]: [attachment({ id: 'att1', size: 2048 })]
        })
      )
    )
    expect(parsed.imageSources).toEqual([
      {
        attachmentId: 'att1',
        url: 'https://v5.airtableusercontent.com/att1',
        sizeBytes: 2048,
        alt: ''
      },
      {
        attachmentId: 'att3',
        url: 'https://v5.airtableusercontent.com/att1',
        sizeBytes: 1000,
        alt: 'A chart'
      }
    ])
  })

  it('accepts every allowed image type', () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      expectParsed(
        toGrantReport(liveReport({ [F.image1.id]: [attachment({ type })] }))
      )
    }
  })

  it('fails on an image type the site does not accept', () => {
    for (const type of ['image/heic', 'application/pdf', 'image/gif']) {
      const error = expectError(
        toGrantReport(liveReport({ [F.image2.id]: [attachment({ type })] }))
      )
      expect(error.message).toContain('"Public Image 2"')
      expect(error.message).toContain(`(got ${type})`)
    }
  })

  it('fails on a file over the source size limit', () => {
    const error = expectError(
      toGrantReport(
        liveReport({
          [F.image1.id]: [attachment({ size: MAX_SOURCE_IMAGE_BYTES + 1 })]
        })
      )
    )
    expect(error.message).toContain(
      '"Public Image 1": expected a file of at most 50 MB'
    )
  })

  it('fails on an attachment without a url', () => {
    expectError(
      toGrantReport(
        liveReport({ [F.image1.id]: [attachment({ url: undefined })] })
      )
    )
  })

  it('lists every problem in one error, named by the Airtable field', () => {
    const error = expectError(
      toGrantReport(
        liveReport({
          [F.summary.id]: '   ',
          [F.publishedDate.id]: undefined,
          [F.outputTypes.id]: []
        })
      )
    )
    expect(error.message).toContain('Gib Interim Report 1 (ID: rec1)')
    expect(error.message).toContain('"Public Summary": expected text')
    expect(error.message).toContain(
      '"Published Date": expected a date, got missing'
    )
    expect(error.message).toContain(
      '"Public Output Types": expected at least one option, got 0 value(s)'
    )
  })

  it('fails when an image field holds more than one file', () => {
    const error = expectError(
      toGrantReport(
        liveReport({
          [F.image2.id]: [attachment(), attachment({ id: 'att2' })]
        })
      )
    )
    expect(error.message).toContain('"Public Image 2": expected at most 1 file')
  })

  it('fails when a lookup does not resolve to exactly one value', () => {
    const none = expectError(
      toGrantReport(liveReport({ [F.projectName.id]: [] }))
    )
    expect(none.message).toContain('"Grantee Project Name"')
    expect(none.message).toContain('(ID: rec1)')

    const two = expectError(
      toGrantReport(liveReport({ [F.reportNumber.id]: [1, 2] }))
    )
    expect(two.message).toContain(
      '"Submitted Report Num": expected exactly one whole number, got 2 value(s)'
    )
  })

  it('fails on a report number that is not a positive whole number', () => {
    for (const value of [0, 1.5, '1']) {
      expectError(toGrantReport(liveReport({ [F.reportNumber.id]: [value] })))
    }
  })

  it('fails on an unknown report type', () => {
    const error = expectError(
      toGrantReport(liveReport({ [F.reportType.id]: ['Annual Report'] }))
    )
    expect(error.message).toContain('expected Interim Report or Final Report')
  })

  it('fails on a date that is not YYYY-MM-DD', () => {
    expectError(
      toGrantReport(liveReport({ [F.reportingPeriodEnd.id]: '31/10/2026' }))
    )
  })

  it('falls back to the record ID when the report cannot be named', () => {
    const error = expectError(
      toGrantReport(
        liveReport({
          [F.projectName.id]: undefined,
          [F.reportType.id]: undefined,
          [F.reportNumber.id]: undefined
        })
      )
    )
    expect(error.message).toMatch(/^Report rec1:/)
  })
})

describe('toGrantReports', () => {
  it('keeps Live reports only', () => {
    const draft = liveReport({ [PUBLICATION_STATUS_FIELD_ID]: 'Draft' }, 'rec2')
    const withdrawn = liveReport(
      { [PUBLICATION_STATUS_FIELD_ID]: 'Withdrawn' },
      'rec3'
    )
    const noStatus = liveReport(
      { [PUBLICATION_STATUS_FIELD_ID]: undefined },
      'rec4'
    )
    const result = toGrantReports([liveReport(), draft, withdrawn, noStatus])
    expect(idsOf(result)).toEqual(['rec1'])
  })

  it('does not fail on a bad report that is not Live', () => {
    const badDraft = liveReport(
      { [PUBLICATION_STATUS_FIELD_ID]: 'Draft', [F.summary.id]: undefined },
      'rec2'
    )
    expect(toGrantReports([badDraft])).toEqual([])
  })

  it('returns an empty list when no report is Live', () => {
    expect(toGrantReports([])).toEqual([])
  })

  it('fails the whole set and lists every bad report', () => {
    const result = toGrantReports([
      liveReport({ [F.summary.id]: undefined }, 'rec1'),
      liveReport(),
      liveReport({ [F.license.id]: undefined }, 'rec3')
    ])
    const error = expectError(result)
    expect(error.message).toContain('2 grant report(s) cannot be published')
    expect(error.message).toContain('(ID: rec1)')
    expect(error.message).toContain('(ID: rec3)')
  })

  it('sorts by project name, then report number, independent of input order', () => {
    const result = toGrantReports([
      liveReport({ [F.projectName.id]: ['Zeta'] }, 'recZ'),
      liveReport({ [F.reportNumber.id]: [2] }, 'recB'),
      liveReport({ [F.reportNumber.id]: [1] }, 'recA')
    ])
    expect(idsOf(result)).toEqual(['recA', 'recB', 'recZ'])
  })
})

describe('isLiveReport', () => {
  it('matches the Live status exactly', () => {
    expect(isLiveReport(liveReport())).toBe(true)
    expect(
      isLiveReport(liveReport({ [PUBLICATION_STATUS_FIELD_ID]: 'live' }))
    ).toBe(false)
  })
})

describe('findHiddenReportFields', () => {
  const allIds = Object.values(REPORT_FIELDS).map(({ id }) => id)

  it('returns nothing when every report field is visible', () => {
    expect(findHiddenReportFields(allIds)).toEqual([])
  })

  it('names each hidden field', () => {
    const visible = allIds.filter((id) => id !== F.license.id)
    expect(findHiddenReportFields(visible)).toEqual(['Public License'])
  })
})

describe('reportFieldIdsToFetch', () => {
  it('fetches every report field plus the status, which is never written', () => {
    const ids = reportFieldIdsToFetch()
    expect(ids).toContain(PUBLICATION_STATUS_FIELD_ID)
    expect(ids).toHaveLength(Object.keys(REPORT_FIELDS).length + 1)
  })
})
