import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function copyDir(src, dest) {
  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else if (entry.name.endsWith('.json')) {
      fs.copyFileSync(srcPath, destPath)
      console.log(`✓ Copied ${srcPath} to ${destPath}`)
    }
  }
}

// Copy all JSON files from src to dist/src
const srcDir = path.join(__dirname, 'src')
const destDir = path.join(__dirname, 'dist', 'src')

console.log('📋 Copying schema JSON files...')
copyDir(srcDir, destDir)
console.log('✅ Schema files copied successfully!')
