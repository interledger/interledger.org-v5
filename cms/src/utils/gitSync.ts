import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { getProjectRoot, PATHS } from '../../../src/utils/paths'

function escapeForShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}

/**
 * Syncs changes to git: pulls latest with rebase, stages files, commits, and pushes.
 * Resolves even on failure so Strapi saves content.
 */
export async function syncToGit(
  filepath: string | string[],
  message: string
): Promise<void> {
  if (process.env.STRAPI_DISABLE_GIT_SYNC === 'true') {
    console.log('⏭️  Git sync disabled via STRAPI_DISABLE_GIT_SYNC')
    return
  }

  const projectRoot = getProjectRoot()
  const safeMessage = escapeForShell(message)
  const filepaths = Array.isArray(filepath) ? filepath : [filepath]

  // Always include public/uploads if it exists so media changes are committed
  const uploadsDir = path.join(projectRoot, PATHS.UPLOADS)
  const addPaths = filepaths.map((fp) => escapeForShell(fp))
  if (fs.existsSync(uploadsDir)) {
    const uploadsRelative = escapeForShell(
      path.relative(projectRoot, uploadsDir)
    )
    addPaths.push(uploadsRelative)
  }

  return new Promise((resolve) => {
    const commands = [
      'git pull --rebase',
      `git add ${addPaths.map((p) => `'${p}'`).join(' ')}`,
      `git commit -m '${safeMessage}'`,
      'git push'
    ].join(' && ')

    exec(commands, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error(`⚠️  Git sync failed: ${error.message}`)
        if (stderr) console.error(`stderr: ${stderr}`)
        resolve()
        return
      }
      console.log(`✅ Synced to git: ${message}`)
      if (stdout) console.log(stdout)
      resolve()
    })
  })
}
