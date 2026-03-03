import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function copySchemas() {
  const srcDir = path.join(__dirname, 'src')
  const destDir = path.join(__dirname, 'dist', 'src')

  function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath)
      } else if (entry.name.endsWith('.json')) {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  copyDir(srcDir, destDir)
  console.log('✅ Schema files copied successfully')
}

export default () => {
  return {
    register() {
      // Copy schemas when Strapi initializes
      copySchemas()
    },
    bootstrap() {}
  }
}
