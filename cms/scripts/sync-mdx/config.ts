import { getContentPath } from '../../src/utils/paths'

export interface ContentTypeConfig {
  dir: string
  apiId: string
}

export interface ContentTypes {
  'foundation-pages': ContentTypeConfig
  'summit-pages': ContentTypeConfig
}

export function buildContentTypes(projectRoot: string): ContentTypes {
  return {
    'foundation-pages': {
      dir: getContentPath(projectRoot, 'foundationPages'),
      apiId: 'foundation-pages'
    },
    'summit-pages': {
      dir: getContentPath(projectRoot, 'summit'),
      apiId: 'summit-pages'
    }
  }
}
