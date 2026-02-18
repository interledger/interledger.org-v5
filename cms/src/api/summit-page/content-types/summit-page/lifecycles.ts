import { createPageLifecycle, PATHS } from '@/api/utils'

export default createPageLifecycle({
  contentTypeUid: 'api::summit-page.summit-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summit}`,
  localizedOutputDir: PATHS.CONTENT.summit
})
