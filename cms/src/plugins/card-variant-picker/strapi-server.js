'use strict'

module.exports = {
  register({ strapi }) {
    strapi.customFields.register({
      name: 'card-variant',
      plugin: 'card-variant-picker',
      type: 'string'
    })
  }
}
