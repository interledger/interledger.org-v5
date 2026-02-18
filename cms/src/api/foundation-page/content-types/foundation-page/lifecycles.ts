import { createPageLifecycle, PATHS } from '@/api/utils'

export default createPageLifecycle({
  contentTypeUid: 'api::foundation-page.foundation-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.foundationPages}`,
  localizedOutputDir: PATHS.CONTENT.foundationPages
})
