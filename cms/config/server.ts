import fs from 'fs'
import path from 'path'

/**
 * Strapi's local upload provider writes to `<public>/uploads/`. We need that
 * directory to exist before the provider initialises (its `init` throws otherwise).
 * We also pre-create the `img/original/` subdirectory where our bootstrap
 * override actually stores files.
 */
function ensureUploadDirs(publicDir: string): void {
  for (const sub of ['uploads', 'uploads/img/original']) {
    const dir = path.join(publicDir, sub)
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        console.log(`✅ Created upload folder: ${dir}`)
      }
    } catch (err) {
      console.warn(
        `[Strapi] Could not ensure upload folder exists: ${dir}`,
        err
      )
    }
  }
}

export default ({ env }) => {
  const publicDir = env(
    'STRAPI_PUBLIC_DIR',
    path.resolve(process.cwd(), '../public')
  )
  ensureUploadDirs(publicDir)

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
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
