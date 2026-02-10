import path from 'path'

export const DEFAULT_STRAPI_URL = 'http://localhost:1337'

export interface ContentTypeConfig {
  dir: string
  apiId: string
  pattern: RegExp
}

export interface ContentTypes {
  blog: ContentTypeConfig
  'foundation-pages': ContentTypeConfig
  'summit-pages': ContentTypeConfig
  'grant-pages': ContentTypeConfig
  'hackathon-pages': ContentTypeConfig
  'hackathon-resource-pages': ContentTypeConfig
}

export function buildContentTypes(projectRoot: string): ContentTypes {
  return {
    blog: {
      dir: path.join(projectRoot, 'src/content/blog'),
      apiId: 'blog-posts',
      pattern: /^(\d{4}-\d{2}-\d{2})-(.+)\.mdx$/
    },
    'foundation-pages': {
      dir: path.join(projectRoot, 'src/content/foundation-pages'),
      apiId: 'foundation-pages',
      pattern: /^(.+)\.mdx$/
    },
    'summit-pages': {
      dir: path.join(projectRoot, 'src/content/summit'),
      apiId: 'summit-pages',
      pattern: /^(.+)\.mdx$/
    },
    'grant-pages': {
      dir: path.join(projectRoot, 'src/content/grants'),
      apiId: 'foundation-pages',
      pattern: /^(.+)\.mdx$/
    },
    'hackathon-pages': {
      dir: path.join(projectRoot, 'src/content/summit/hackathon'),
      apiId: 'summit-pages',
      pattern: /^(.+)\.mdx$/
    },
    'hackathon-resource-pages': {
      dir: path.join(projectRoot, 'src/content/summit/hackathon/resources'),
      apiId: 'summit-pages',
      pattern: /^(.+)\.mdx$/
    }
  }
}
