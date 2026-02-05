import { createPageLifecycle } from '../../../../utils/mdxLifecycle'

export default createPageLifecycle({
  contentTypeUid: 'api::page.page',
  outputDir: 'src/content/foundation-pages',
  localizedOutputDir: 'foundation-pages',
  logPrefix: 'page',
})
