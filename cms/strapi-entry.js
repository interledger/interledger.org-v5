#!/usr/bin/env node

// Load environment variables from root .env BEFORE Strapi starts
// This ensures config files can access ADMIN_JWT_SECRET and other env vars
const path = require('path')
const dotenv = require('dotenv')

// Load .env from project root
const envPath = path.resolve(__dirname, '../.env')
const result = dotenv.config({ path: envPath })

if (result.error) {
  console.warn(`⚠️  Warning: Could not load .env from ${envPath}`)
  console.warn(`   Error: ${result.error.message}`)
}

// Now start Strapi - pass through the command (develop/start)
const { spawn } = require('child_process')
const command = process.argv[2] || 'develop'

// Use the strapi CLI command (it's in node_modules/.bin which is in PATH)
const strapiProcess = spawn('strapi', [command], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
})

strapiProcess.on('exit', (code) => {
  process.exit(code || 0)
})
