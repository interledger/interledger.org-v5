'use strict'

module.exports = {
  register({ strapi }) {
    strapi.customFields.register({
      name: 'related-article-slug',
      plugin: 'related-article-slug',
      type: 'string'
    })
  }
}
