const path = require('path')

// Load environment variables from root .env BEFORE Strapi config files are evaluated
// This ensures ADMIN_JWT_SECRET and other env vars are available when config/admin.ts runs
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const fs = require('fs')

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

module.exports = () => {
  return {
    register() {
      // Copy schemas when Strapi initializes
      copySchemas()
    },
    bootstrap() {}
  }
}
