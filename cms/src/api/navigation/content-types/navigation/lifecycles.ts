import { createNavigationLifecycle } from '../../../../utils/navigationLifecycle'

export default createNavigationLifecycle({
  contentTypeUid: 'api::navigation.navigation',
  outputPath: 'src/config/navigation.json',
  logPrefix: 'navigation'
})
