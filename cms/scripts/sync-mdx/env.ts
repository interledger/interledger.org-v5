import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

export function loadEnv(projectRoot: string): void {
  // Load from root .env
  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }
}
