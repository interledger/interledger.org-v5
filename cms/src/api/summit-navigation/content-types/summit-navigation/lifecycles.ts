import { createNavigationLifecycle } from '../../../../utils/navigationLifecycle'

export default createNavigationLifecycle({
  contentTypeUid: 'api::summit-navigation.summit-navigation',
  outputPath: 'src/config/summit-navigation.json',
  logPrefix: 'summit-navigation'
})
