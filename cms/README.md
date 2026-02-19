# Interledger Developers Portal - Strapi CMS

This is the Strapi CMS for managing content that will be rendered on the Interledger Developers Portal. The CMS automatically generates MDX files that are read by the Astro site.

## Features

- **Automatic MDX Generation**: Content is automatically written to MDX files when published
- **Draft & Publish Workflow**: Content can be drafted and published when ready
- **SQLite Database**: Lightweight database for easy development and deployment

## Getting Started

### Prerequisites

- Node.js >= 18.0.0 <= 22.x.x
- pnpm

### Installation

The dependencies should already be installed. If not, run:

```bash
cd cms
pnpm install
```

### Configuration

The CMS is configured via environment variables in `.env`. Key settings:

- `PORT`: CMS runs on port 1337 (default)
- `DATABASE_CLIENT`: Using better-sqlite3
- `MDX_OUTPUT_PATH`: Base output path for page MDX files. Default behavior resolves to `STRAPI_GIT_SYNC_REPO_PATH/src/content/foundation-pages`
- `PAGES_MDX_OUTPUT_PATH`: Legacy page output override (used if `MDX_OUTPUT_PATH` is not set)
- `STRAPI_GIT_SYNC_REPO_PATH`: Target git clone used for lifecycle hook commits (default: `~/interledger.org-v5-staging`)

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

### Running the CMS

Start the development server:

```bash
cd cms
pnpm run develop
```

The Strapi admin panel will be available at: http://localhost:1337/admin

On first run, you'll be prompted to create an admin user.

### Production Build

To build for production:

```bash
cd cms
pnpm run build
pnpm run start
```

## Content Types

## How It Works

### MDX File Generation

When you publish or update content in Strapi:

1. The lifecycle hooks in `src/api/.../content-types/.../lifecycles.ts` are triggered
2. The content is converted to MDX format with frontmatter
3. An MDX file is created/updated in `../src/content/.../` with the slug as the filename
4. The Astro site automatically picks up the new content

### File Naming

MDX files are named using the slug: `{slug}.mdx`

Example: If slug is `interledger-launches-new-platform`, the file will be `interledger-launches-new-platform.mdx`

### Unpublishing Content

??

## Development Workflow

1. **Start the CMS**: `cd cms && pnpm run develop`
2. **Access Admin Panel**: http://localhost:1337/admin
3. **Create Content**: Add new content through the UI
4. **Publish**: When ready, publish the content
5. **View on Site**: The content automatically appears at the generated URL

## File Structure

```
cms/
├── config/              # Strapi configuration files
│   ├── admin.ts
│   ├── database.ts
│   ├── middlewares.ts
│   └── server.ts
├── src/
│   ├── api/
│   │   └── blog-post/
│   │       ├── content-types/
│   │       │   └── blog-post/
│   │       │       ├── schema.json
│   │       │       └── lifecycles.ts  # MDX generation logic
│   │       ├── controllers/
│   │       ├── routes/
│   │       └── services/
│   └── index.ts
├── .env                 # Environment variables
├── .gitignore
├── package.json
├── tsconfig.json
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
- **Astro Integration**: Check the main README in the repository root
