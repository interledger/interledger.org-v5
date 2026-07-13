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
      breakpoints: {}
    }
  }
})
