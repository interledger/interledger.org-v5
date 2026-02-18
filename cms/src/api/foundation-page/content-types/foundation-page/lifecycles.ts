import { createPageLifecycle } from '../../../../utils/pageLifecycle'
import { PATHS } from '../../../../utils/paths'

export default createPageLifecycle({
  contentTypeUid: 'api::foundation-page.foundation-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.foundationPages}`,
  localizedOutputDir: PATHS.CONTENT.foundationPages
})
