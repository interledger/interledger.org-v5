import path from 'path'
import { createNavigationLifecycle } from '../../../../utils/navigationLifecycle'
import { PATHS } from '../../../../utils/paths'

export default createNavigationLifecycle({
  contentTypeUid: 'api::summit-navigation.summit-navigation',
  outputPath: path.join(PATHS.CONFIG_ROOT, PATHS.CONFIG.summitNavigation)
})
