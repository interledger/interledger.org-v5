import { createPageLifecycle } from '../../../../utils/pageLifecycle'
import { PATHS } from '../../../../utils/paths'

export default createPageLifecycle({
  contentTypeUid: 'api::summit-page.summit-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summitPages}`,
  localizedOutputDir: PATHS.CONTENT.summitPages
})
