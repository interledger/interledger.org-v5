import { createPageLifecycle } from '../../../../utils/mdxLifecycle'
import { escapeQuotes } from '../../../../utils/mdx'

export default createPageLifecycle({
  contentTypeUid: 'api::summit-page.summit-page',
  outputDir: 'src/content/summit',
  localizedOutputDir: 'summit',
  logPrefix: 'summit',
  extraFrontmatter: (page) =>
    page.gradient ? [`gradient: "${escapeQuotes(page.gradient as string)}"`] : [],
})
