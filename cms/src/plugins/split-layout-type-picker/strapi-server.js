'use strict'

module.exports = {
  register({ strapi }) {
    strapi.customFields.register({
      name: 'layout-type',
      plugin: 'split-layout-type-picker',
      type: 'string'
    })
  }
}
