const CACHE_DIR = 'public/img/optimized'

module.exports = {
  onPreBuild: async ({ utils }) => {
    const restored = await utils.cache.restore(CACHE_DIR)
    if (restored) {
      console.log(`[cache-images] Restored ${CACHE_DIR} from cache`)
    } else {
      console.log(`[cache-images] No cache found — all images will be optimized`)
    }
  },

  onPostBuild: async ({ utils }) => {
    await utils.cache.save(CACHE_DIR)
    console.log(`[cache-images] Saved ${CACHE_DIR} to cache`)
  }
}
