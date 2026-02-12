import { createPageLifecycle } from '../../../../utils/mdxLifecycle'
import { PATHS } from '../../../../utils/paths'

export default createPageLifecycle({
  contentTypeUid: 'api::summit-page.summit-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summit}`,
  localizedOutputDir: PATHS.CONTENT.summit,
  logPrefix: 'summit',
})
