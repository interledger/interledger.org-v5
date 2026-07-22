export default () => ({
  ckeditor: {
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
      // large files are rejected in the admin with a "file too large" error.
      // Editors use YouTube for big videos. Alternative storage for large media
      // is tracked post-launch in INTORG-902.
      sizeLimit: 5 * 1024 * 1024
    }
  }
})
