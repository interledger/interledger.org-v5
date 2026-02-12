# Strapi CMS

Content management for the Interledger site. Publishes content to MDX files used by Astro.

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Bun](https://bun.sh/) >= 1.0

## Setup

Create a `.env` file in the **project root** (not in cms/):

```env
# Server
APP_KEYS=...
API_TOKEN_SALT=...
ADMIN_JWT_SECRET=...
TRANSFER_TOKEN_SALT=...

# Strapi API
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your-api-token
```

Generate the server secrets from the `cms` directory:

```bash
bun -e "console.log('APP_KEYS=' + Array(4).fill(0).map(() => require('crypto').randomBytes(16).toString('base64')).join(','))"
bun -e "console.log('API_TOKEN_SALT=' + require('crypto').randomBytes(16).toString('base64'))"
bun -e "console.log('ADMIN_JWT_SECRET=' + require('crypto').randomBytes(16).toString('base64'))"
bun -e "console.log('TRANSFER_TOKEN_SALT=' + require('crypto').randomBytes(16).toString('base64'))"
```

Copy the output into `.env`. Add `STRAPI_URL` and `STRAPI_API_TOKEN` (create token in Strapi Admin → Settings → API Tokens after first run).

## Run

```bash
cd cms
bun install
bun run develop
```

Admin: <http://localhost:1337/admin>

## Sync Scripts

Sync MDX files and navigation config to Strapi. Run from the `cms` directory.

### API Token

Create a token in Strapi Admin → **Settings** → **API Tokens**: name it e.g. `MDX Sync`, type **Full access**, duration **Unlimited**. Add to `.env` as `STRAPI_API_TOKEN`.

### Commands

```bash
bun run sync:mdx:dry-run       # Preview MDX sync
bun run sync:mdx               # Sync MDX content to Strapi
bun run sync:navigation:dry-run # Preview navigation sync
bun run sync:navigation        # Sync navigation config
```

Both require `STRAPI_URL` and `STRAPI_API_TOKEN` in `.env`. The workflow `.github/workflows/sync-mdx-to-strapi.yml` syncs on push to `main` (requires GitHub secrets).

## Testing

Run tests from the `cms` directory:

```bash
bun test
```
