# Interledger Developers Portal - Strapi CMS

This is the Strapi CMS for managing content that will be rendered on the Interledger Developers Portal. The CMS automatically generates MDX files that are read by the Astro site.

## Features

- **Automatic MDX Generation**: Content is automatically written to MDX files when published
- **Draft & Publish Workflow**: Content can be drafted and published when ready
- **SQLite Database**: Lightweight database for easy development and deployment

## Getting Started

### Prerequisites

- Node.js >= 18.0.0 <= 22.x.x
- npm >= 6.0.0

### Installation

The dependencies should already be installed. If not, run:

```bash
cd cms
npm install
```

### Configuration

The CMS is configured via environment variables in `.env`. Key settings:

- `PORT`: CMS runs on port 1337 (default)
- `DATABASE_CLIENT`: Using better-sqlite3
- `MDX_OUTPUT_PATH`: Where MDX files are written (`../src/content/foundation-pages`)

### Running the CMS

Start the development server:

```bash
cd cms
npm run develop
```

The Strapi admin panel will be available at: http://localhost:1337/admin

On first run, you'll be prompted to create an admin user.

### Production Build

To build for production:

```bash
cd cms
npm run build
npm run start
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

### Content Preview

Content authors can preview draft pages before publishing. The preview system uses server-side rendering (SSR) to fetch draft content directly from Strapi at runtime, bypassing the build-time MDX pipeline entirely.

#### How it works

1. A content author makes changes in the Strapi admin panel
2. They click **Save / Draft**
3. They click **Open preview** (the button is disabled until the draft is saved or the content is published)
4. Strapi calls the `preview.handler` in `config/admin.ts`, which reads the document from the database and builds a preview URL based on the content type (e.g. `/page-preview?documentId=abc123`)
5. The browser opens `{CLIENT_URL}/page-preview?documentId=abc123` on the Astro dev/SSR server
6. The Astro preview route (`src/pages/page-preview.astro`, which has `prerender = false`) fetches the **draft** content from the Strapi API using the `documentId`
7. The page is rendered at runtime using the `DynamicZone` component, which maps Strapi block types to Astro components
8. The author can edit, save, and re-preview as many times as needed before publishing

**Note:** Preview requires saving first because Strapi reads the document from its database to generate the preview URL. Unsaved changes only exist in the browser and are not available to the preview handler.

This is intentionally separate from the published content flow. Published pages are statically generated from MDX files at build time and have no runtime dependency on Strapi.

#### Setup

**Strapi side** (`cms/.env`):

```env
CLIENT_URL=http://localhost:1103   # Must match the Astro dev server URL
```

The preview handler is configured in `cms/config/admin.ts`. To add preview support for a new content type, add a case to the `getPreviewPathname` switch statement.

**Astro side** (`.env` in project root):

```env
STRAPI_URL=http://localhost:1337
STRAPI_PREVIEW_TOKEN=<your-api-token>
```

The token must have read access to the content types you want to preview (including draft status). You can generate one in the Strapi admin under Settings > API Tokens.

#### Adding preview for a new content type

1. Add a case in `cms/config/admin.ts` `getPreviewPathname()` that returns the preview route path
2. Create an SSR page in `src/pages/` (e.g. `my-type-preview.astro`) with `export const prerender = false`
3. In that page, use `fetchStrapi()` with `status=draft` to fetch the draft content and render it

#### Adding a new block to the page dynamic zone

When you add a new block component to the page content dynamic zone, you **must** also add it to the populate params in `src/pages/page-preview.astro`. In Strapi v5, using `on` (component-specific population) for a dynamic zone acts as a filter — only block types listed in `on` clauses are returned in the API response. Unlisted types are silently excluded.

For blocks with only scalar fields (richtext, string, enum):

```js
'populate[content][on][blocks.my-block][populate]': '*'
```

For blocks with nested components or relations:

```js
'populate[content][on][blocks.my-block][populate][myRelation][populate]': '*'
```

If you forget this step, the block will not appear in the preview even though it exists in Strapi.

#### Component architecture: presentational vs block components

Every Strapi dynamic zone block type needs a corresponding **block component** in `src/components/blocks/` so that the `DynamicZone` component can render it during preview. Whether you also need a separate **presentational component** depends on the data shape.

**When a single component is enough:**

If the Strapi API data can be used directly with minimal transformation, one component can serve both preview and published content. For example, `Paragraph.astro` accepts a `content` string and handles the markdown-to-HTML conversion internally — no separate block adapter needed.

**When you need two components:**

If the Strapi API returns a different shape than what the presentational component expects (nested objects, markdown fields that need conversion, etc.), you need a block adapter to bridge the gap. For example:

- `src/components/ambassadors/Ambassador.astro` — **Presentational component**. Accepts simple, flat props (`name`, `description` as HTML string, `photo` as URL string) and renders the UI. Used by both the published site and preview. Has no knowledge of where the data comes from.

- `src/components/blocks/AmbassadorBlock.astro` — **Block adapter for preview**. Used only by `DynamicZone` during SSR preview. Receives raw Strapi API data (nested `photo` object, markdown `description`) and transforms it into the simple props the presentational component expects (extracts `photo.url`, converts markdown to HTML via `marked`).

For published content, the MDX lifecycle hook in Strapi handles these transformations at publish time, so the presentational component is used directly in the generated MDX. The block adapters are only needed for preview.

**Rule of thumb:** If you need to transform Strapi's API response before rendering (flatten nested objects, convert markdown to HTML, resolve relations), create a block adapter in `src/components/blocks/` that does the transformation and delegates to a presentational component. Otherwise, a single component in `src/components/blocks/` is fine.

## Development Workflow

1. **Start the CMS**: `cd cms && npm run develop`
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
