import { getContentPath } from '@/utils/paths'

export interface ContentTypeConfig {
  dir: string
  apiId: string
}

export interface ContentTypes {
  'foundation-pages': ContentTypeConfig
  'summit-pages': ContentTypeConfig
  'foundation-blog-posts': ContentTypeConfig
}

export function buildContentTypes(projectRoot: string): ContentTypes {
  return {
    'foundation-pages': {
      dir: getContentPath(projectRoot, 'foundationPages'),
      apiId: 'foundation-pages'
    },
    'summit-pages': {
      dir: getContentPath(projectRoot, 'summitPages'),
      apiId: 'summit-pages'
    },
    'foundation-blog-posts': {
      dir: getContentPath(projectRoot, 'blog'),
      apiId: 'foundation-blog-posts'
    }
  }
}
