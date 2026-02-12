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
6. **entryBuilder.ts** – Builds Strapi payload from MDX
7. **localeMatch.ts** – Finds locale files via `localizes` field
8. **syncOperations.ts** – create/update English entries, create/update localizations, delete orphans
9. **strapi.ts** – Strapi API client

## Tests

- `scan.test.js`, `entryBuilder.test.js`, `sync.test.js` – sync-mdx logic
- `mdx-lifecycle.test.js` – Tests `localizes` field priority from `pageLifecycle.ts` (Strapi → MDX export). Lives here because it validates the shared `localizes` contract.
