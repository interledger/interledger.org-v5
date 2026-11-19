'use strict'

module.exports = {
  register({ strapi }) {
    strapi.customFields.register({
      name: 'path-slug',
      plugin: 'path-slug',
      type: 'string'
    })
  }
}
