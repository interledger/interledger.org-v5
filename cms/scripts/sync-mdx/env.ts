import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

export function resolveProjectRoot(cwd = process.cwd()): string {
  const isInCmsDir = cwd.endsWith('/cms') || cwd.endsWith('\\cms')
  return isInCmsDir ? path.join(cwd, '..') : cwd
}

export function loadEnv(projectRoot: string): void {
  // Load from root .env
  delete process.env.STRAPI_API_TOKEN

  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }
}
