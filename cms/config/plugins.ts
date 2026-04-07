export default () => ({
  upload: {
    config: {
      // Images → optimized/ (gitignored). Admin uploads also copy masters to img/original/ (overwrite by slugged name). Use pnpm sync:images to bulk re-import from original/.
      provider: '@interledger/strapi-upload-local-split'
    }
  },
  ckeditor: {
    enabled: true
  },
  'record-locking': {
    enabled: true,
    config: {
      showTakeoverButton: true,
      transports: ['websocket']
    }
  }
})
