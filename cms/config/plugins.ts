import { MAX_MEDIA_BYTES } from '../src/utils/uploadLimits'

export default () => ({
  // Community plugin used by all rich-text fields (`plugin::ckeditor5.CKEditor`).
  // Do not also enable the official `@ckeditor/strapi-plugin-ckeditor` package
  // (plugin name `ckeditor`) — loading both double-registers core and throws
  // `ckeditor-duplicated-modules` in the admin.
  ckeditor5: {
    enabled: true
  },
  'split-layout-type-picker': {
    enabled: true,
    resolve: './src/plugins/split-layout-type-picker'
  },
  'record-locking': {
    enabled: true,
    config: {
      showTakeoverButton: true,
      transports: ['websocket']
    }
  },
  upload: {
    config: {
      provider: 'local',
      breakpoints: {},
      // 5 MB cap (INTORG-876): uploaded media is git-committed into the repo, so
      // large files are rejected in the admin. Editors use YouTube for big
      // videos. Alternative storage for large media is tracked post-launch in
      // INTORG-902. The bootstrap upload override enforces the same ceiling with
      // a friendlier message, plus a tighter 2 MB one for images.
      sizeLimit: MAX_MEDIA_BYTES
    }
  }
})
