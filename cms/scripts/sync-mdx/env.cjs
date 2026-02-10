const fs = require('fs');
const path = require('path');

function resolveProjectRoot(cwd = process.cwd()) {
  const isInCmsDir = cwd.endsWith('/cms') || cwd.endsWith('\\cms');
  return isInCmsDir ? path.join(cwd, '..') : cwd;
}

function loadCmsEnv(projectRoot) {
  // Ensure cms/.env takes precedence
  delete process.env.STRAPI_API_TOKEN;

  const envPath = path.join(projectRoot, 'cms', '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

module.exports = {
  resolveProjectRoot,
  loadCmsEnv
};
