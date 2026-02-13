import { getContentPath } from '../../../src/utils/paths'

export interface ContentTypeConfig {
  dir: string
  apiId: string
}

export interface ContentTypes {
  blog: ContentTypeConfig
  'foundation-pages': ContentTypeConfig
  'summit-pages': ContentTypeConfig
}

export function buildContentTypes(projectRoot: string): ContentTypes {
  return {
    blog: {
      dir: getContentPath(projectRoot, 'blog'),
      apiId: 'blog-posts'
    },
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
