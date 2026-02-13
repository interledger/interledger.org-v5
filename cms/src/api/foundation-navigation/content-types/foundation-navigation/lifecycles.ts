import path from 'path'
import { createNavigationLifecycle } from '../../../../utils/navigationLifecycle'
import { PATHS } from '../../../../../src/utils/paths'

export default createNavigationLifecycle({
  contentTypeUid: 'api::foundation-navigation.foundation-navigation',
  outputPath: path.join(PATHS.CONFIG_ROOT, PATHS.CONFIG.foundationNavigation),
})
