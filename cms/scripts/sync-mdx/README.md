# sync-mdx

Syncs MDX files to Strapi (MDX → Strapi import only). Run from `cms/`:

```bash
bun run sync:mdx:dry-run   # Preview changes
bun run sync:mdx           # Apply (main branch only)
```

## Flow

1. **index.ts** – Entry point, env, branch check
2. **config.ts** – Content type config (dir, apiId)
3. **sync.ts** – Main flow: scan → validate → sync
4. **scan.ts** – Scans base + locale dirs → `MDXFile[]`
5. **validateFrontmatter.ts** – Validates via shared schemas in `src/schemas/content.ts`
6. **mdxTransformer.ts** – Transforms MDX files to Strapi payload format
7. **localeMatch.ts** – Finds locale files via `localizes` field
8. **syncOperations.ts** – create/update English entries, create/update localizations, delete orphans
9. **strapiClient.ts** – Strapi API client

