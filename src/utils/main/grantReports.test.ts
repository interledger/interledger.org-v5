import { describe, expect, it } from 'vitest'
import type { GrantReport } from '@/types/airtable'
import { parseGrantReports } from './grantReports'

function report(overrides: Partial<GrantReport> = {}): GrantReport {
  return {
    id: 'recReport0000001',
    grantId: 'recUSF6jZiBVoqG01',
    projectName: 'Gib',
    reportType: 'Interim Report',
    reportNumber: 1,
    publishedDate: '2026-11-15',
    reportingPeriodStart: '2026-05-01',
    reportingPeriodEnd: '2026-10-31',
    summary: 'We built **the thing**.',
    progressOnObjectives: 'On track.',
    whoBenefits: 'Small merchants.',
    outputs: 'A library.',
    whatsNext: 'The final report.',
    license: 'Apache-2.0',
    outputTypes: ['Software'],
    interledgerTechnologies: ['Open Payments'],
    images: [],
    ...overrides
  }
}

describe('parseGrantReports', () => {
  it('accepts reports as the sync writes them', () => {
    const image = {
      path: '/img/grantee-reports/recReport0000001/att1.webp',
      width: 2400,
      height: 1600,
      alt: ''
    }
    const data = [report(), report({ id: 'rec2', images: [image] })]
    expect(parseGrantReports(data)).toEqual(data)
  })

  it('accepts an empty file, as before the first Live report', () => {
    expect(parseGrantReports([])).toEqual([])
  })

  it('fails on a report type the template does not know', () => {
    const result = parseGrantReports([
      { ...report(), reportType: 'Mid-term Report' }
    ])
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('0.reportType')
  })

  it('fails on a date that is not YYYY-MM-DD', () => {
    const result = parseGrantReports([report({ publishedDate: '15/11/2026' })])
    expect((result as Error).message).toContain('0.publishedDate')
  })

  it('fails on a grantId that is not a record ID', () => {
    const result = parseGrantReports([report({ grantId: 'Gib 2022' })])
    expect((result as Error).message).toContain('0.grantId')
  })

  it('fails on an empty section or option list', () => {
    expect(parseGrantReports([report({ summary: '' })])).toBeInstanceOf(Error)
    expect(parseGrantReports([report({ outputTypes: [] })])).toBeInstanceOf(
      Error
    )
  })

  it('fails on an image path that is not site-relative', () => {
    const image = {
      path: 'https://v5.airtableusercontent.com/x',
      width: 1,
      height: 1,
      alt: ''
    }
    expect(parseGrantReports([report({ images: [image] })])).toBeInstanceOf(
      Error
    )
  })

  it('fails on a file that is not a list', () => {
    expect(parseGrantReports({})).toBeInstanceOf(Error)
  })
})
