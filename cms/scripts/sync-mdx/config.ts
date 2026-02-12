import { getContentPath } from '../../src/utils/paths'

export interface ContentTypeConfig {
  dir: string
  apiId: string
  pattern: RegExp
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
      apiId: 'blog-posts',
      pattern: /^(\d{4}-\d{2}-\d{2})-(.+)\.mdx$/
    },
    'foundation-pages': {
      dir: getContentPath(projectRoot, 'foundationPages'),
      apiId: 'foundation-pages',
      pattern: /^(.+)\.mdx$/
    },
    'summit-pages': {
      dir: getContentPath(projectRoot, 'summit'),
      apiId: 'summit-pages',
      pattern: /^(.+)\.mdx$/
    }
  }
}
