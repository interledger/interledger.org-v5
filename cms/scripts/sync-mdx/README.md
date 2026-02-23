# sync-mdx

Syncs MDX files to Strapi (MDX → Strapi import only). Run from `cms/`:

```bash
pnpm sync:mdx --dry-run          # Preview changes (any branch)
pnpm sync:mdx                    # Sync (main/staging only)
pnpm sync:mdx --force            # Sync from any branch (e.g. local dev)
```

The script only allows live runs on `main` or `staging`. Use `--force` to bypass this check on other branches (local development only — not for CI).

## Flow

1. **index.ts** – Entry point, environment setup, connects to Strapi
2. **config.ts** – Content type configuration (directories, API IDs)
3. **syncCoordinator.ts** – Orchestrates sync flow: scan → validate → sync operations
4. **scan.ts** – Scans base and locale directories, extracts MDX files
5. **validateFrontmatter.ts** – Validates frontmatter against Zod schemas in `src/schemas/content.ts`
6. **mdxTransformer.ts** – Transforms MDX files to Strapi API payload format
7. **localeMatch.ts** – Matches locale files to English entries via `localizes` field
8. **syncOperations.ts** – Performs Strapi operations: create/update entries, create/update localizations, delete orphans
9. **strapiClient.ts** – Strapi API client wrapper
