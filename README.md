# Interledger.org

The official [Interledger.org](https://interledger.org/) website built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/).

## Quick Start

```bash
# Install dependencies
bun install

# Start dev server (localhost:1103)
bun run start

# Build for production
bun run build
```

## Architecture Overview
```mermaid
flowchart
    subgraph gcp["☁️ GCP VM"]
        direction TB
        strapi[(Strapi CMS)]
        gitclone[("Git Clone<br/>(staging)")]
        strapi -->|"writes MDX"| gitclone
    end
    
    subgraph github["📦 GitHub Repository"]
        direction TB
        staging["staging branch"]
        main["main branch"]
    end
    
    subgraph netlify["🚀 Netlify"]
        direction TB
        preview["Preview Site"]
        production["Production Site"]
    end
    
    editor["👤 Content Editor"]
    dev["👨‍💻 Developer"]
    feature["Feature Branch"]
    
    editor ==>|"Publish"| strapi
    dev ==>|"Code PR"| feature
    
    gitclone ==>|"Push via<br/>lifecycle hooks"| staging
    feature ==>|"PR"| staging
    
    staging ==>|"Auto-build"| preview
    staging -->|"PR (approved)"| main
    
    main ==>|"Auto-build"| production
    
    gitclone -.-|"Sync after<br/>PR merge"| strapi
    
    classDef gcpStyle fill:#4285f4,stroke:#1967d2,color:#fff
    classDef githubStyle fill:#24292e,stroke:#000,color:#fff
    classDef netlifyStyle fill:#00c7b7,stroke:#008577,color:#fff
    classDef userStyle fill:#ff6b6b,stroke:#d63031,color:#fff
    classDef branchStyle fill:#6c5ce7,stroke:#5f3dc4,color:#fff
    
    class strapi,gitclone gcpStyle
    class staging,main,feature githubStyle
    class preview,production netlifyStyle
    class editor,dev userStyle
```

**Workflow:**
1. **Content editors** publish in Strapi → MDX generated → committed to `staging`
2. **Developers** create feature branches → PR to `staging`
3. **Staging** auto-deploys to Netlify preview for review
4. **Approved changes** merged to `main` via PR
5. **Production** auto-deploys from `main`

**Recovery:** The `sync-mdx.cjs` script can restore Strapi database from MDX files in git.

## Project Structure

```text
├── cms/              # Strapi CMS for content management
├── public/           # Static assets (images, favicons)
├── scripts/          # Sync and import scripts
├── src/
│   ├── components/   # Astro/React components
│   ├── config/       # Site configuration
│   ├── content/      # MDX content (blog, press, docs)
│   ├── layouts/      # Page layouts
│   ├── pages/        # Route pages
│   ├── styles/       # Global styles
│   └── utils/        # Utility functions
└── astro.config.mjs  # Astro configuration
```

## Commands

| Command           | Action                               |
| :---------------- | :----------------------------------- |
| `bun run start`   | Start dev server at `localhost:1103` |
| `bun run build`   | Build production site to `./dist/`   |
| `bun run preview` | Preview production build locally     |
| `bun run format`  | Format code with Prettier/ESLint     |
| `bun run lint`    | Check code formatting and linting    |

## CMS

```bash
cd cms
npm install
npm run develop
```

Admin panel: <http://localhost:1337/admin>

When content is published in Strapi, lifecycle hooks generate MDX and (for pages and blog posts) commit and push those files to GitHub to trigger preview builds. Grant tracks only write MDX locally and do not commit. Set `STRAPI_DISABLE_GIT_SYNC=true` to disable the git commit/push behavior.

Default MDX output locations:
- Pages: `src/content/foundation-pages/` (localized pages: `src/content/{locale}/foundation-pages/`)
- Blog posts: `src/content/blog/`
- Grant tracks: `src/content/grants/`

### Syncing MDX to Strapi

The `cms/scripts/sync-mdx.cjs` script syncs MDX files from git **to** Strapi (reverse direction of lifecycle hooks). This is useful for:

- **Database regeneration**: Rebuild Strapi database from MDX files in git
- **Initial setup**: Populate a fresh Strapi instance with existing content
- **Recovery**: Restore content after database corruption/loss

```bash
cd cms
node scripts/sync-mdx.cjs --dry-run  # Preview changes
node scripts/sync-mdx.cjs            # Apply changes
```

The script:
- Scans MDX files in `src/content/blog`, `src/content/events`, `src/content/pages`
- Creates/updates/deletes Strapi entries to match MDX files
- Handles localized content (matches via `contentId` in frontmatter)
- Requires `STRAPI_API_TOKEN` in `cms/.env` with full access permissions

**Note**: This only syncs content entries, not user accounts, API tokens, or Strapi configuration.

See [cms/README.md](cms/README.md) for details.
