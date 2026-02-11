# MDX to Strapi Sync

Script that syncs MDX files from the content directory to the Strapi database.

## Features

- Scans MDX files in content directories (blog, foundation-pages, summit-pages)
- Creates new Strapi entries for new MDX files
- Updates existing entries when MDX content changes
- Deletes Strapi entries when MDX files are removed
- Supports dry-run mode to preview changes

## Setup

### 1. Create Strapi API Token

In Strapi admin (<http://localhost:1337/admin>):

1. Go to **Settings** → **API Tokens**
2. Click **Create new API Token**
3. Name: `MDX Sync Token`
4. Token type: **Full access** (required for create/update/delete operations)
5. Token duration: **Unlimited**
6. Copy the token

### 2. Configure Environment Variables

Add to the root `.env` file:

```env
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your-token-here
```

Both variables are required. The sync script loads `.env` from the project root.

## Usage

### From cms directory (required)

```bash
cd cms
bun run sync:mdx:dry-run  # Preview changes
bun run sync:mdx          # Actually sync
```

## GitHub Actions

The workflow in `.github/workflows/sync-mdx-to-strapi.yml` automatically syncs MDX files to Strapi when changes are pushed to the `main` branch.

### Required GitHub Secrets

- `STRAPI_URL` - URL of your Strapi instance
- `STRAPI_API_TOKEN` - Full access API token from Strapi

## How It Works

1. **Scans MDX files**: Reads all `.mdx` files from content directories
2. **Parses frontmatter**: Extracts metadata (title, description, slug, etc.)
3. **Converts markdown**: Transforms markdown content to HTML
4. **Syncs to Strapi**:
   - Creates new entries if slug doesn't exist
   - Updates existing entries if slug matches
   - Deletes orphaned entries (in Strapi but not in MDX)

## Troubleshooting

### 401 Unauthorized Error

Your API token doesn't have sufficient permissions. Make sure:

- Token type is "Full access" (not "Read-only" or "Custom")
- Token is not expired
- Token is correctly set in environment variables

### Cannot find module 'dotenv'

The script requires dotenv to load environment variables:

```bash
bun add dotenv
```
