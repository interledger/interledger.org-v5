import fs from 'fs'
import path from 'path'

/**
 * Local upload provider requires `public/uploads` to exist before the upload
 * plugin registers (app `register` runs too late). Create it when this config loads.
 */
function ensureUploadsFolder(publicDir: string): void {
  const uploadsDir = path.join(publicDir, 'uploads')
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
      console.log(`✅ Created Strapi upload folder: ${uploadsDir}`)
    }
  } catch (err) {
    console.warn('[Strapi] Could not ensure upload folder exists:', err)
  }
}

export default ({ env }) => {
  const publicDir = env(
    'STRAPI_PUBLIC_DIR',
    path.resolve(process.cwd(), '../public')
  )
  ensureUploadsFolder(publicDir)

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    // Point Strapi's public directory at the repo root's /public so uploads land in /public/uploads
    dirs: {
      public: publicDir
    },
    app: {
      keys: env.array('APP_KEYS')
    },
    webhooks: {
      populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false)
    }
  }
}
