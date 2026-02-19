# CMS Scripts

Scripts in this folder sync local content/config into Strapi.

## Prerequisites

Add these to the project root `.env`:

```env
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your-token-here
```

Use a Strapi API token with write access to the synced content types.

## Usage

Run from `cms/`:

```bash
bun run sync:mdx:dry-run
bun run sync:mdx

bun run sync:navigation:dry-run
bun run sync:navigation
```

## What each script syncs

- `sync:mdx`
  - Syncs MDX page content for:
    - `foundation-pages` from `src/content/foundation-pages` (+ locale variants like `src/content/es/foundation-pages`)
    - `summit-pages` from `src/content/summit-pages` (+ locale variants like `src/content/es/summit-pages`)
  - Creates, updates, and deletes Strapi entries to match filesystem state.
  - Non-dry-run execution is restricted to the `main` branch.
- `sync:navigation`
  - Syncs:
    - `src/config/foundation-navigation.json` -> `foundation-navigation`
    - `src/config/summit-navigation.json` -> `summit-navigation`

## Notes

- `--dry-run` previews changes without writing to Strapi.
- Detailed MDX sync internals are documented in `cms/scripts/sync-mdx/README.md`.
