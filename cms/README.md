# Interledger - Strapi CMS

This is the Strapi CMS for managing content that will be rendered on the Interledger website. Custom lifecycle hooks automatically generate MDX files, which are first committed locally to the dedicated `staging clone` and then pushed to the remote `staging` branch. The CMS enables editors to **draft**, **publish**, and **manage** content while keeping the Astro site synchronized.

## Features

- **Automatic MDX Generation**: Content is converted to MDX and committed to the `staging clone` whenever it is published or updated in Strapi.
- **Draft & Publish Workflow**: Editors can draft content and publish it when ready.
- **SQLite Database**: Lightweight database for easy development and deployment.
- **Previews**:
  - Strapi stores draft content, and Astro renders previews on demand via an SSR route that fetches the latest data directly from Strapi.
  - TODO ??

## Strapi v5 developer notes

- **i18n `locale` on APIs vs lifecycle `params`**: Document Service calls use top-level `locale`; bulk/plugin updates often use `params.data.locale`; update filters may use `params.where.locale`. See [`docs/STRAPI_I18N_LOCALE.md`](docs/STRAPI_I18N_LOCALE.md) and `readLocaleFromUpdateEvent` in `src/utils/pageLifecycle.ts`.

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

The CMS is configured via environment variables in the root `.env`. Refer to `env.example` for default values and examples.

Key settings:

Set `ASTRO_PREVIEW_URL` to match your Astro dev server port (default `http://localhost:1103`).

#### Environment variables

| Variable                    | Description                                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                      | CMS runs on port 1337 (default)                                                                                                                                                                                         |
| `DATABASE_CLIENT`           | Using better-sqlite3                                                                                                                                                                                                    |
| `ASTRO_PREVIEW_URL`         | Must match the Astro dev server URL (e.g. `http://localhost:1103`)                                                                                                                                                      |
| `MDX_OUTPUT_PATH`           | Base output path for page MDX files. Default behavior resolves to `STRAPI_GIT_SYNC_REPO_PATH/src/content/foundation-pages` for English pages, with localizations written under `src/content/foundation-pages/{locale}/` |
| `PAGES_MDX_OUTPUT_PATH`     | Legacy page output override (used if `MDX_OUTPUT_PATH` is not set)                                                                                                                                                      |
| `STRAPI_GIT_SYNC_REPO_PATH` | Target git clone used for lifecycle hook commits (default: `~/interledger.org-v5-staging`)                                                                                                                              |
| `STRAPI_UPLOADS_BASE_URL`   | Base URL prepended to upload paths in generated content files (e.g. `https://cdn.example.com`). Only needed if uploads are hosted externally. When unset, upload paths stay relative (`/uploads/...`).                  |
| `STRAPI_DISABLE_GIT_SYNC`   | Set to `true` to skip the automatic git commit and push after content changes. Useful in local development.                                                                                                             |
| `FRONTEND_ORIGINS`          | Origins allowed for CORS (e.g., local dev, staging, production Astro sites)                                                                                                                                             |

### Git Sync Repository Target

Lifecycle hooks that commit MDX updates now write to a dedicated staging clone configured by `STRAPI_GIT_SYNC_REPO_PATH`.

For page MDX output, the resolution order is:

1. `MDX_OUTPUT_PATH`
2. `PAGES_MDX_OUTPUT_PATH`
3. `src/content/foundation-pages` (resolved inside `STRAPI_GIT_SYNC_REPO_PATH`)

This was introduced to:

- Avoid fragile relative-path repository detection,
- Ensure content commits happen in the intended staging checkout,
- Fail fast on startup if the target folder is missing or not on the `staging` branch.

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
- Scripts inside `/cms/scripts` (e.g., `sync:mdx`, `sync:navigation`) synchronize Astro MDX files back into the Strapi database for all content types. (**Astro → Strapi sync**).

## How It Works

The CMS supports two synchronization flows: Strapi → Astro (MDX generation) and Astro → Strapi (MDX import).

### Strapi → Astro (MDX File Generation)

When content is published or updated in Strapi:

1. Lifecycle hooks in `src/api/.../content-types/.../lifecycles.ts` are triggered automatically
2. The content is converted to MDX format with frontmatter
3. An MDX file is created/updated under the Astro content tree: for **foundation/summit pages**, the **full path slug** is split on `/` so parent segments become directories and the **last segment** is the `.mdx` filename (English). Localized pages are written under the collection-level `/{locale}/` directory, followed by the same nested slug folders (see `pageLifecycle` in the CMS).
4. Astro automatically picks up the new content

**File Naming**

- MDX files for **pages** (e.g., foundation pages, summit pages) use the **full path slug** from Strapi: segments before the last `/` become directories; the filename is `{lastSegment}.mdx`. <br/>
  Example: slug `interledger-launches-new-platform` → `interledger-launches-new-platform.mdx` at the collection root. Slug `grant/my-page` → `grant/my-page.mdx` under the collection folder.

- MDX files for **blog posts** use a date-prefixed format: `yyyy-mm-dd-{pathSlug}.mdx`<br/>
  Example: `2025-01-15-interledger-launches-new-platform.mdx`

**Git Commits**

- Strapi is configured as a contributor to the codebase. When editors use the Strapi interface to make changes, Strapi's lifecycle hooks make commits to the `staging` branch on behalf of the editors.

### Astro → Strapi (MDX Sync)

- It is also possible for mdx file changes to happen in PRs that get merged into the `staging` branch.

- This allows Astro content (blog posts, events, navigation, etc.) to remain the source of truth while keeping the Strapi database synchronized.

- On pushes to `staging`, changes to `.md` or `.mdx` files in `src/content/foundation-pages`, `src/content/summit-pages`, `src/content/foundation-blog-posts`, or `src/content/ambassadors` trigger the `sync:mdx` workflow job, including localized files under `src/content/<locale>/...`.

**Features**

- Scans MDX files in
  - `src/content/ambassadors`
  - `src/content/foundation-pages`
  - `src/content/summit-pages`
  - `src/content/foundation-blog-posts`
- Also scans localized content under each content-type directory, e.g. `src/content/foundation-pages/es` for those same content roots
- Creates, updates, and deletes Strapi entries to match the MDX file system
- Supports localized content matching
- Supports `dry-run` mode to preview changes
- Automatically runs on pushes to `staging` when supported content paths change

**Setup**

**1. Create Strapi API Token**

In Strapi admin (<http://localhost:1337/admin>):

1. Go to **Settings** → **API Tokens**
2. Click **Create new API Token**
3. Name: `MDX Sync Token`
4. Token type: **Full access** (required for create/update/delete operations)
5. Token duration: **Unlimited**
6. Copy the generated token

**2. Configure Environment Variables**

Add to `cms/.env`:

```env
STRAPI_API_TOKEN=your-token-here
```

**Usage**

Run from the `cms/` directory:

```bash
pnpm run sync:mdx:dry-run     # Preview changes (no writes)
pnpm run sync:mdx             # Execute sync

pnpm run sync:navigation:dry-run
pnpm run sync:navigation
```

**GitHub Actions**

The workflow in `.github/workflows/staging-merge.yml` automatically syncs MDX files to Strapi when changes are pushed to the `staging` branch.

**Required GitHub Secrets**

- `STRAPI_URL` - URL of your Strapi instance
- `STRAPI_API_TOKEN` - Full access API token from Strapi

**How the Sync Works**

1. **Scans MDX files**: Reads all `.mdx` files from content directories
2. **Parses frontmatter**: Extracts metadata (title, description, slug, etc.)
3. **Validates content**: Validates frontmatter using Zod schemas defined in `src/schemas/content.ts`
4. **Converts markdown**: Transforms markdown content to HTML
5. **Syncs to Strapi**:
   - Creates new entries if slug doesn't exist
   - Updates existing entries if slug matches
   - Creates or updates localized entries
   - Deletes orphaned Strapi entries (present in Strapi but not in MDX)

**Content Type Mappings**

- `src/content/foundation-pages/**/*.mdx` → `foundation-pages` (API ID)
- `src/content/summit-pages/**/*.mdx` → `summit-pages` (API ID)
- `src/content/ambassadors/**/*.mdx` → `ambassadors` (API ID)
- `src/content/foundation-blog-posts/**/*.{md,mdx}` → `foundation-blog-posts` (API ID)

These mappings are configured in: `scripts/sync-mdx/config.ts`

#### Page Block Import (current behavior)

For page content types, `sync:mdx` parses MDX body content into ordered dynamic-zone blocks.

- Markdown nodes are imported as `blocks.paragraph`
- Registered JSX handlers map supported components to block payloads
- Unknown JSX components fail the sync with a parser error

Current handlers are registered through side-effect imports in `scripts/sync-mdx/config.ts`.

When adding a new handler, follow:

- [`COMPONENT_IMPORT_TEMPLATE.md`](scripts/sync-mdx/COMPONENT_IMPORT_TEMPLATE.md)

### Unpublishing Content

TODO: ???

### Content Preview

Content authors can preview draft pages before publishing. The preview system uses server-side rendering (SSR) to fetch draft content directly from Strapi at runtime, bypassing the build-time MDX pipeline entirely.

#### How it works

1. A content author makes changes in the Strapi admin panel
2. They click **Save / Draft**
3. They click **Open preview** (the button is disabled until the draft is saved or the content is published)
4. Strapi calls the `preview.handler` in `config/admin.ts`, which reads the document from the database and builds a preview URL based on the content type (e.g. `/page-preview?documentId=abc123`)
5. The browser opens `{ASTRO_PREVIEW_URL}/page-preview?documentId=abc123` on the Astro dev/SSR server
6. The Astro preview route (`src/pages/page-preview.astro`, which has `prerender = false`) fetches the **draft** content from the Strapi API using the `documentId`
7. The page is rendered at runtime using the `DynamicZone` component, which maps Strapi block types to Astro components
8. The author can edit, save, and re-preview as many times as needed before publishing

**Note:** Preview requires saving first because Strapi reads the document from its database to generate the preview URL. Unsaved changes only exist in the browser and are not available to the preview handler.

This is intentionally separate from the published content flow. Published pages are statically generated from MDX files at build time and have no runtime dependency on Strapi.

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

#### Styling rendered HTML from `set:html`

Components that render Strapi richtext fields use `set:html` to inject HTML converted from markdown. Since this injected HTML doesn't receive Astro's scoped data attributes, child elements can inherit unwanted styles from page-level prose selectors (e.g. `[&_strong]:text-primary`).

There are two approaches to control styling of `set:html` content:

**Option A — Tailwind arbitrary variants on container elements:**

```html
<blockquote
  class="[&_strong]:text-inherit [&_p]:mb-0 [&_em]:italic"
></blockquote>
```

Consistent with the pattern used in `[...page].astro` and `Paragraph.astro`. Keeps everything in the template but can get verbose with many overrides.

**Option B — Astro scoped `<style>` with `:global()`:**

```css
<style>
  blockquote :global(strong) { color: inherit; }
  blockquote :global(p) { margin-bottom: 0; }
</style>
```

The parent selector (`blockquote`) retains Astro's scoped attribute, so styles only apply within that component — they won't leak to other parts of the page. `:global()` removes scoping from the child selector so it can reach the injected HTML. Cleaner when there are multiple overrides.

See `Blockquote.astro` for an example using Option B.

## Development Workflow

1. **Start the CMS**:

```bash
cd cms && pnpm run develop
```

2. **Access Admin Panel**: http://localhost:1337/admin
3. **Create Content**: Add new content through the UI
4. **Preview Page**: Save the content as a **draft** or **publish** to enable server-side preview pages directly from the Strapi interface.
5. **Publish**: When ready, publish the content.<br />
   Publishing commits the changes locally to the `staging clone` and pushes them to the remote `staging branch` via the GitHub App.
6. **View on Site**:

- **Locally**: Your Astro dev server automatically picks up the newly generated MDX files.
- [**Staging website**](https://staging--interledger-org-v5.netlify.app/): Once changes are merged into staging, Netlify rebuilds the staging site and the updates are visible online.

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

### 401 Unauthorized Error

Your API token does not have sufficient permissions. Ensure that:

- Token type is "Full access" (not "Read-only" or "Custom")
- Token is not expired
- Token is correctly set in environment variables

### Cannot find module 'dotenv'

The script requires dotenv to load environment variables:

```bash
pnpm add dotenv
```

## Security Notes

- The `.env` file contains secrets - never commit it to version control
- Change the default secrets in `.env` before deploying to production
- Update `FRONTEND_ORIGINS` in `.env` and `config/middlewares.ts` for production

## Support

For issues related to:

- **Strapi CMS**: Check [Strapi Documentation](https://docs.strapi.io/)
- **Content Issues**: Check the Strapi console logs
- **Astro Integration**: Check the [main README](https://github.com/interledger/interledger.org-v5/blob/main/README.md) in the repository root
