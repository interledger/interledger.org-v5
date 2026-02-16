import { createPageLifecycle } from '../../../../utils/pageLifecycle'
import { PATHS } from '../../../../../src/utils/paths'

export default createPageLifecycle({
  contentTypeUid: 'api::summit-page.summit-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summit}`,
  localizedOutputDir: PATHS.CONTENT.summit
})
