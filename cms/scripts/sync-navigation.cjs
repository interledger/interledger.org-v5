#!/usr/bin/env bun

/**
 * Navigation JSON to Strapi Sync Script
 *
 * Usage:
 *   bun scripts/sync-navigation.cjs --dry-run
 *   bun scripts/sync-navigation.cjs
 */

const fs = require('fs');
const path = require('path');
const { resolveProjectRoot, loadCmsEnv } = require('./sync-mdx/env.cjs');
const { DEFAULT_STRAPI_URL } = require('./sync-mdx/config.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

function readJson(filepath) {
  if (!fs.existsSync(filepath)) {
    throw new Error(`Config file not found: ${filepath}`);
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function toStrapiPayload(navigation) {
  const mapItem = (item) => {
    if (!item) return null;
    const payload = { label: item.label };
    if (item.href) payload.href = item.href;
    if (item.openInNewTab) payload.openInNewTab = true;
    return payload;
  };

  const mainMenu = (navigation.mainMenu || []).map((group) => {
    const groupData = { label: group.label };
    if (group.href) groupData.href = group.href;
    if (group.items && group.items.length > 0) {
      groupData.items = group.items.map(mapItem).filter(Boolean);
    }
    return groupData;
  });

  const data = { mainMenu };
  if (navigation.ctaButton) {
    data.ctaButton = mapItem(navigation.ctaButton);
  }

  return { data };
}

async function updateNavigation({ baseUrl, token, apiId, configPath, label }) {
  const navigation = readJson(configPath);
  const payload = toStrapiPayload(navigation);
  const url = `${baseUrl}/api/${apiId}?publicationState=preview`;

  if (DRY_RUN) {
    console.log(`🔍 [DRY-RUN] Would update ${label}: ${configPath}`);
    return;
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to sync ${label}: ${res.status} - ${text}`);
  }

  const result = await res.json();
  console.log(`✅ Synced ${label} (documentId: ${result.data.documentId})`);
}

async function main() {
  const projectRoot = resolveProjectRoot();
  loadCmsEnv(projectRoot);

  const STRAPI_URL = process.env.STRAPI_URL || DEFAULT_STRAPI_URL;
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

  if (!STRAPI_TOKEN) {
    console.error('❌ Error: STRAPI_API_TOKEN not set');
    process.exit(1);
  }

  const configs = [
    {
      apiId: 'navigation',
      configPath: path.join(projectRoot, 'src/config/navigation.json'),
      label: 'navigation'
    },
    {
      apiId: 'summit-navigation',
      configPath: path.join(projectRoot, 'src/config/summit-navigation.json'),
      label: 'summit navigation'
    }
  ];

  for (const config of configs) {
    await updateNavigation({
      baseUrl: STRAPI_URL,
      token: STRAPI_TOKEN,
      apiId: config.apiId,
      configPath: config.configPath,
      label: config.label
    });
  }

  if (DRY_RUN) {
    console.log('\n💡 This was a dry-run. Run without --dry-run to apply changes.');
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
