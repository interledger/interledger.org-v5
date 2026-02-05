const path = require('path');

const DEFAULT_STRAPI_URL = 'http://localhost:1337';
const NUMERIC_FIELDS = ['order'];

function buildContentTypes(projectRoot) {
  return {
    blog: {
      dir: path.join(projectRoot, 'src/content/blog'),
      apiId: 'blog-posts',
      pattern: /^(\d{4}-\d{2}-\d{2})-(.+)\.mdx$/
    },
    pages: {
      dir: path.join(projectRoot, 'src/content/pages'),
      apiId: 'pages',
      pattern: /^(.+)\.mdx$/
    }
  };
}

module.exports = {
  DEFAULT_STRAPI_URL,
  NUMERIC_FIELDS,
  buildContentTypes
};
