const CACHE_DIR = 'public/img/optimized'

// Mirrors isImageCdnEnabled() in src/utils/main/imageCdn.ts. Duplicated rather
// than imported because Netlify build plugins are plain CJS and cannot load the
// TypeScript util — keep the two in step.
//
// The plugin must no-op when the CDN is on. `public/` is copied wholesale into
// `dist/`, so restoring ~122 MB of variants that nothing references would bloat
// every deploy and make it look like the build-time pipeline still ran.
const FALSEY = new Set(['', '0', 'false', 'no', 'off'])

function isImageCdnEnabled(env) {
  const netlify = env.NETLIFY
  if (netlify === undefined || FALSEY.has(netlify.trim().toLowerCase())) {
    return false
  }
  return (env.IMAGE_CDN || '').trim().toLowerCase() !== 'off'
}

module.exports = {
  onPreBuild: async ({ utils }) => {
    if (isImageCdnEnabled(process.env)) {
      console.log(
        `[cache-images] Netlify Image CDN is on — skipping restore of ${CACHE_DIR}`
      )
      return
    }

    const restored = await utils.cache.restore(CACHE_DIR)
    if (restored) {
      console.log(`[cache-images] Restored ${CACHE_DIR} from cache`)
    } else {
      console.log(
        `[cache-images] No cache found — all images will be optimized`
      )
    }
  },

  onPostBuild: async ({ utils }) => {
    if (isImageCdnEnabled(process.env)) {
      console.log(
        `[cache-images] Netlify Image CDN is on — nothing to save for ${CACHE_DIR}`
      )
      return
    }

    await utils.cache.save(CACHE_DIR)
    console.log(`[cache-images] Saved ${CACHE_DIR} to cache`)
  }
}
