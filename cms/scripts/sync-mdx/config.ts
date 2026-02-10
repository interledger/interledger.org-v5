import path from 'path'

export const DEFAULT_STRAPI_URL = 'http://localhost:1337'

export interface ContentTypeConfig {
  dir: string
  apiId: string
  pattern: RegExp
}

export interface ContentTypes {
  blog: ContentTypeConfig
  pages: ContentTypeConfig
  summitPages: ContentTypeConfig
}

export function buildContentTypes(projectRoot: string): ContentTypes {
  return {
    blog: {
      dir: path.join(projectRoot, 'src/content/blog'),
      apiId: 'blog-posts',
      pattern: /^(\d{4}-\d{2}-\d{2})-(.+)\.mdx$/
    },
    pages: {
      dir: path.join(projectRoot, 'src/content/foundation-pages'),
      apiId: 'pages',
      pattern: /^(.+)\.mdx$/
    },
    summitPages: {
      dir: path.join(projectRoot, 'src/content/summit'),
      apiId: 'summit-pages',
      pattern: /^(.+)\.mdx$/
    }
  }
}
