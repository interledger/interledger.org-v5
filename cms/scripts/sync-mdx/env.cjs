const fs = require('fs');
const path = require('path');

function resolveProjectRoot(cwd = process.cwd()) {
  const isInCmsDir = cwd.endsWith('/cms') || cwd.endsWith('\\cms');
  return isInCmsDir ? path.join(cwd, '..') : cwd;
}

function loadCmsEnv(projectRoot) {
  // Load from root .env
  delete process.env.STRAPI_API_TOKEN;

  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

module.exports = {
  resolveProjectRoot,
  loadCmsEnv
};
