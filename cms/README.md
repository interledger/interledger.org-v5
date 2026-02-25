# Interledger - Strapi CMS

This is the Strapi CMS for managing content that will be rendered on the Interledger Website. Custom lifecycle hooks automatically generate MDX files, which are first committed locally in the dedicated `staging clone` and then pushed to the remote `staging branch`. The CMS enables editors to **draft**, **publish**, and **manage** content while keeping the Astro site synchronized.

<!-- Test workflow run -->

## Features

- **Automatic MDX Generation**: Content is converted to MDX and committed to the `staging clone` whenever it is created (published) or updated in Strapi.
- **Draft & Publish Workflow**: Editors can draft content and publish it when ready.
- **SQLite Database**: Lightweight database for easy development and deployment.
- **Frontend Previews**:
  - _server-side rendered_ preview pages generated via Strapi and served from the GCP VM, through Nginx (content stored in Strapi database)
  - Netlify deploy previews for pull requests opened against `staging`.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0 <= 22.x.x
- pnpm >= 9.0.0

### Installation

Dependencies are typically installed already. If not:

```bash
cd cms
pnpm install
```

### Configuration

The CMS is configured via environment variables in `.env`. _Refer to `env.example` for default values and examples_. Key settings:

- `PORT`: CMS runs on port 1337 (default)
- `DATABASE_CLIENT`: Using better-sqlite3
- `MDX_OUTPUT_PATH`: Base output path for page MDX files. Default behavior resolves to `STRAPI_GIT_SYNC_REPO_PATH/src/content/foundation-pages`
- `PAGES_MDX_OUTPUT_PATH`: Legacy page output override (used if `MDX_OUTPUT_PATH` is not set)
- `STRAPI_GIT_SYNC_REPO_PATH`: Target git clone used for lifecycle hook commits (default: `~/interledger.org-v5-staging`)
- `FRONTEND_ORIGINS`: Origins allowed for CORS (e.g., local dev, staging, production Astro sites)

### Git Sync Repository Target

Lifecycle hooks that commit MDX updates now write to a dedicated staging clone configured by `STRAPI_GIT_SYNC_REPO_PATH`.

For page MDX output, the resolution order is:

1. `MDX_OUTPUT_PATH`
2. `PAGES_MDX_OUTPUT_PATH`
3. `src/content/foundation-pages` (resolved inside `STRAPI_GIT_SYNC_REPO_PATH`)

This was introduced to:

- avoid fragile relative-path repo detection,
- ensure content commits happen in the intended staging checkout,
- fail fast on startup if the target folder is missing or not on the `staging` branch.

### Running the CMS - Development

Start the development server:

```bash
cd cms
pnpm run develop
```

The Strapi admin panel will be available at: http://localhost:1337/admin

On first run, you'll be prompted to create an admin user.

### Production Build

To build and run in production:

```bash
cd cms
pnpm run build
pnpm run start
```

> Note: Strapi runs on a Google Cloud VM in production. Deployment is handled directly on the VM and is separate from the Astro website hosted on Netlify.

## Content Types

- All content types are defined under `src/api/{content-type}/content-types/`.
- Lifecycle hooks for each type handle MDX generation (**Strapi -> Astro sync**).
- Scripts inside `/cms/scripts` (e.g., `sync:mdx`, `sync-navigation`) handle synchronizing from Astro MDX files back to the Strapi database for all content types (**Astro → Strapi sync**).

## How It Works

### MDX File Generation

When content is published or updated in Strapi:

1. The lifecycle hooks in `src/api/.../content-types/.../lifecycles.ts` are triggered
2. The content is converted to MDX format with frontmatter
3. An MDX file is created/updated in the staging clone of Astro with the slug as the filename (e.g., `../src/content/foundation-pages/{slug}.mdx`)
4. Astro automatically picks up the new content

### File Naming

MDX files are named using the slug: `{slug}.mdx`

Example: If slug is `interledger-launches-new-platform`, the file will be `interledger-launches-new-platform.mdx`

### Git Commits

- Strapi is set up to be a contributor to our code base. When editors use the Strapi interface to make changes, Strapi's lifecycle hooks make commits to the `staging` branch on behalf of the editors.

### Sync Back from Astro

- On merges to `staging`, the `sync:mdx` script updates the Strapi database with values from Astro `.mdx` files, keeping CMS and site content in sync.

### Unpublishing Content

TODO: ???

For more information on **MDX file generation** and **preview functionality**, see `/scripts/README.md`

## Development Workflow

1. **Start the CMS**:

```bash
cd cms && pnpm run develop
```

2. **Access Admin Panel**: http://localhost:1337/admin
3. **Create Content**: Add new content through the UI
4. **Preview Page**: Save the content as a **draft** or **publish** to enable server-side preview pages directly from the Strapi interface.
5. **Publish**: When ready, publish the content.<br />
   Publishing commits the changes locally in the `staging clone` and pushes them to the remote `staging branch` via the GitHub App.
6. **View on Site**:

- **Locally**: Your Astro dev server automatically picks up the newly generated MDX files.
- **Staging website**: Once changes are merged into staging, Netlify rebuilds the staging site and the updates are visible online.

## File Structure

```
cms/
├── config/              # Strapi configuration files
│   ├── admin.ts
│   ├── database.ts
│   ├── middlewares.ts
│   ├── plugins.ts
│   └── server.ts
├── database/                      # Database files
│   └── migrations/
├── public/                        # Static assets
│   └── uploads/                   # User-uploaded media
├── scripts/              # e.g., sync:mdx, sync-navigation
├── src/
│   ├── admin/      # Admin UI customizations
│   ├── api/
│   │   ├── {content-type}  # e.g., blog-post, foundation-page
│   │       ├── content-types/
│   │       │       ├── schema.json
│   │       │       └── lifecycles.ts  # MDX generation logic
│   │       ├── controllers/
│   │       ├── routes/
│   │       └── services/
│   │   └── utils.ts
│   ├── components/                # Reusable Strapi components
│   │   ├── blocks/                # Content block components
│   │   ├── navigation/
│   │   └── shared/                # Shared components
│   ├── serializers/               # MDX serialization logic
│   │   └── blocks/
│   ├── utils/                     # Utility functions
│   └── index.ts
└── types/                         # TypeScript type definitions
│   └── generated/
├── .env                 # Environment variables
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── strapi-server.js
├── tsconfig.json
├── copy-schemas.js
└── README.md
```

## Tips

- **Rich Text Content**: The content field supports rich text. It will be converted to markdown when generating MDX files.
- **External Links**: If you provide an `externalUrl`, the item will link to the external article instead of a local page.
- **Slugs**: Slugs are auto-generated from the title but can be customized. Ensure they're unique.

## Troubleshooting

### MDX files not generating

1. Check that the content item is **published** (not just saved as draft)
2. Verify the `MDX_OUTPUT_PATH` in `.env` points to the correct directory
3. Check file permissions on the content directory (e.g. `src/content/foundation-pages`)
4. Look for errors in the Strapi console output

### Database issues

The SQLite database is stored in `.tmp/data.db`. To reset:

```bash
rm -rf cms/.tmp
```

Then restart Strapi. You'll need to create a new admin user.

## Security Notes

- The `.env` file contains secrets - never commit it to version control
- Change the default secrets in `.env` before deploying to production
- The CMS is configured to allow CORS from `localhost:1103` (the Astro dev server)
- Update `FRONTEND_ORIGINS` in `.env` and `config/middlewares.ts` for production

## Support

For issues related to:

- **Strapi CMS**: Check [Strapi Documentation](https://docs.strapi.io/)
- **Content Issues**: Check the Strapi console logs
- **Astro Integration**: Check the [main README](https://github.com/interledger/interledger.org-v5/blob/main/README.md) in the repository root
