import { createPageLifecycle } from '../../../../utils/mdxLifecycle'

export default createPageLifecycle({
  contentTypeUid: 'api::foundation-page.foundation-page',
  outputDir: 'src/content/foundation-pages',
  localizedOutputDir: 'foundation-pages',
  logPrefix: 'page',
})
