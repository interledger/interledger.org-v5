import {
  getContentPath,
  getTargetRepoRoot,
  createFlatLocaleMdxLifecycle,
  generateReportMdx,
  pathSlugToMdxFilename,
  REPORT_CONTENT_POPULATE
} from '../../../../utils'
import type { ReportBase } from '../../types'

interface Report extends ReportBase {
  publishedAt?: string
  locale?: string
  documentId?: string
}

export default createFlatLocaleMdxLifecycle<Report, 'api::report.report'>({
  contentTypeUid: 'api::report.report',
  label: 'report',
  getBaseDir: (locale) => getContentPath(getTargetRepoRoot(), 'reports', locale),
  toMdxFilename: pathSlugToMdxFilename,
  generateContent: generateReportMdx,
  populate: { content: REPORT_CONTENT_POPULATE, date: true }
})
