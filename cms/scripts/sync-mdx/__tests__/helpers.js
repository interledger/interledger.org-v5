const fs = require('fs')
const path = require('path')
const os = require('os')

const tempDirs = new Set()

function makeTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'))
  tempDirs.add(tmpDir)
  return tmpDir
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function registerCleanup(afterEach) {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.clear()
  })
}

module.exports = { makeTmpDir, writeFile, registerCleanup }
