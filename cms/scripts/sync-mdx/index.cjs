const { resolveProjectRoot, loadCmsEnv } = require('./env');
const { DEFAULT_STRAPI_URL, buildContentTypes } = require('./config');
const { createStrapiClient } = require('./strapi');
const { syncAll } = require('./sync');

async function main() {
  console.log('🚀 MDX → Strapi Sync');
  console.log('='.repeat(50));

  const projectRoot = resolveProjectRoot();
  loadCmsEnv(projectRoot);

  const STRAPI_URL = process.env.STRAPI_URL || DEFAULT_STRAPI_URL;
  const STRAPI_TOKEN =
    process.env.STRAPI_API_TOKEN || process.env.STRAPI_PREVIEW_TOKEN;
  const DRY_RUN = process.argv.includes('--dry-run');

  if (!STRAPI_TOKEN) {
    console.error('❌ Error: STRAPI_API_TOKEN or STRAPI_PREVIEW_TOKEN not set');
    console.error(
      '   STRAPI_API_TOKEN:',
      process.env.STRAPI_API_TOKEN ? 'SET' : 'NOT SET'
    );
    console.error(
      '   STRAPI_PREVIEW_TOKEN:',
      process.env.STRAPI_PREVIEW_TOKEN ? 'SET' : 'NOT SET'
    );
    process.exit(1);
  }

  console.log(`🔗 Connecting to: ${STRAPI_URL}`);
  console.log(`🔑 Token: ${STRAPI_TOKEN.substring(0, 10)}...`);

  if (DRY_RUN) {
    console.log('🔍 DRY-RUN MODE - No changes will be made\n');
  }

  const contentTypes = buildContentTypes(projectRoot);
  const strapi = createStrapiClient({ baseUrl: STRAPI_URL, token: STRAPI_TOKEN });

  const results = await syncAll({
    contentTypes,
    strapi,
    DRY_RUN
  });

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`   ✅ Created: ${results.created}`);
  console.log(`   🔄 Updated: ${results.updated}`);
  console.log(`   🗑️  Deleted: ${results.deleted}`);
  console.log(`   ❌ Errors:  ${results.errors}`);

  if (DRY_RUN) {
    console.log('\n💡 This was a dry-run. Run without --dry-run to apply changes.');
  }

  process.exit(results.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
