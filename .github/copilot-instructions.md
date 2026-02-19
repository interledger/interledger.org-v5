# GitHub Copilot Onboarding Instructions

## Repository Overview

This repository contains **interledger.org** – the official Interledger Foundation website. It is a **static documentation site** built with **Astro** and **Starlight**, featuring API documentation, technical specifications, and informational content. The project also includes a **Strapi CMS** in the `cms/` directory for managing structured content.

**Repository Size**: Medium (~600 files, ~3MB)  
**Primary Language**: TypeScript/JavaScript (Astro components, MDX, config files)  
**Package Manager**: pnpm  
**Lockfile**: `pnpm-lock.yaml`  
**Node Requirement**: Node.js >=18.20.8 (critical - 18.19.1 is insufficient)  
**Development Port**: localhost:1103

## Build and Validation Commands

### Prerequisites
Ensure these are installed before running any commands:
- **Node.js**: >=18.20.8 (NOT 18.19.1). Check with `node --version`. If using nvm, ensure .nvmrc is respected.
- **pnpm**: Any recent version (verify with `pnpm --version`)

### Essential Commands (must run in repository root)

| Command | Purpose | Duration | Notes |
|---------|---------|----------|-------|
| `pnpm install` | Install dependencies | ~30s | Always run before build/start |
| `pnpm run start` | Start dev server | - | Runs on localhost:1103 |
| `pnpm run build` | Build production site to ./dist/ | ~30-45s | **Will fail with Node < 18.20.8** |
| `pnpm run lint` | Check code formatting and linting | ~20-30s | Fails if ANY ESLint warnings exist |
| `pnpm run format` | Auto-fix formatting and run lint | ~30-40s | Fixes Prettier issues; some warnings may remain |
| `pnpm run preview` | Preview the built site locally | - | Run `pnpm run build` first |

### CI Validation Pipeline

The GitHub Actions workflow (`.github/workflows/test-build.yml`) runs on every PR:
1. Checkout code
2. Setup Node.js (v18)
3. Setup pnpm
4. `pnpm install`
5. **`pnpm run lint`** – Must pass with zero warnings
6. **`pnpm run build`** – Must succeed

**To replicate CI locally**: Run `pnpm install && pnpm run lint && pnpm run build`. Both lint and build must pass with no output errors.

### Important Caveats

- **Node Version**: The system may have multiple Node versions. If build fails with "Node.js vX.X.X is not supported by Astro", upgrade to >=18.20.8. The .nvmrc specifies `lts/iron` (Node 20), which is recommended.
- **Linting Warnings**: The repository has existing ESLint warnings in `cms/src/api/page/content-types/page/lifecycles.ts` that cause lint to fail. These are pre-existing and are not blocking the build itself – only linting checks. `pnpm run format` will attempt to fix issues but may not resolve all warnings.
- **Package Manager**: Only use pnpm for this project.
- **Lockfile**: Keep `pnpm-lock.yaml` committed so CI and local installs stay deterministic.

## Project Layout and Architecture

```
├── src/                       # Main Astro site
│   ├── pages/                 # Route pages (catch-all in [...page].astro)
│   ├── content/               # MDX content organized by section
│   │   ├── blog/              # Blog posts (developers section)
│   │   ├── developers/        # Developer documentation
│   │   ├── docs/              # Specification documents
│   │   ├── foundation-pages/  # Pages managed by Strapi CMS
│   │   └── summit/            # Summit-specific content
│   ├── layouts/               # Astro layout components
│   ├── components/            # Reusable Astro components
│   │   ├── blocks/            # Content blocks
│   │   ├── logos/             # Logo components
│   │   ├── pages/             # Page-specific components
│   │   └── shared/            # Shared UI components
│   ├── config/                # Site configuration (navigation JSON)
│   ├── content.config.ts      # Astro content collections config
│   ├── styles/                # Global CSS (Tailwind, atom-one-light)
│   └── utils/                 # Utility functions
├── cms/                       # Strapi CMS (separate installation)
│   ├── src/api/               # Content-type definitions
│   ├── config/                # Strapi configuration
│   ├── scripts/               # MDX generation scripts
│   ├── public/uploads/        # Uploaded media
│   └── package.json           # CMS dependencies (pnpm)
├── public/                    # Static assets
│   ├── img/                   # Images (organized by section/date)
│   ├── documents/             # PDFs and docs
│   ├── scripts/               # Public JavaScript
│   └── fonts/                 # Web fonts
├── scripts/                   # Root-level build scripts
├── astro.config.mjs           # Astro configuration (port 1103, Starlight setup)
├── tsconfig.json              # TypeScript config (strict mode)
├── tailwind.config.mjs        # Tailwind CSS config
├── eslint.config.js           # Linting rules (ESLint 9 flat config)
└── .prettierrc                # Prettier config (semi: false, singleQuote: true)
```

### Key Configuration Files

- **astro.config.mjs**: Defines Starlight integration, custom components (Header, PageSidebar), redirects, server port (1103)
- **eslint.config.js**: Uses ESLint 9 flat config. Ignores: dist, .astro, node_modules, *.min.js, and specific CMS files
- **tsconfig.json**: Extends Astro strict config with React JSX support
- **tailwind.config.mjs**: Custom font families (Titillium, system), fluid typography from pages.css
- **.prettierrc**: No semicolons, single quotes, no trailing commas

## Content and Routing

- **Main navigation**: Configured in `src/config/navigation.json`
- **Summit navigation**: Configured in `src/config/summit-navigation.json`  
- **Dynamic routing**: `src/pages/[...page].astro` handles catch-all routes
- **Blog routing**: `src/pages/blog/[...page].astro` and `src/pages/developers/blog/[...page].astro` for dated blog content
- **Content collections**: Defined in `src/content.config.ts` using Astro's content loader API

## Content Publishing Workflow

- **Branches**: `staging` is the preview environment, `main` is production.
- **Strapi publishing**: Lifecycle hooks generate MDX and commit/push to `staging`.
- **Netlify**: Auto-builds `staging` to preview and `main` to production.
- **Promotion**: Content moves from `staging` to `main` via PR approval.
- **Preview drafts**: Drafts can be previewed via SSR without publishing.

## Dependency Notes

- **@interledger/docs-design-system** (v0.11.0): Custom design system CSS for Teal theme
- **@astrojs/starlight** (v0.36.3): Documentation framework with Astro
- **starlight-links-validator**: Validates internal links during build (excludes `/participation-guidelines`)
- **starlight-fullview-mode**: Plugin to disable left sidebar on some views
- **sharp**: Image processing for optimization
- **marked, showdown, html-to-text**: Markdown/HTML utilities
- **@astrojs/netlify**: Netlify deployment adapter (site is deployed to Netlify)

## Known Issues and Workarounds

1. **ESLint warnings in CMS**: The file `cms/src/api/page/content-types/page/lifecycles.ts` contains warnings about unused variables and `any` types. These exist in the repo and are pre-existing. They do not block the build but do prevent `pnpm run lint` from passing.

2. **Node version mismatch in CI**: The GitHub Actions workflow uses Node 18, but newer patch versions (>=18.20.8) are required. The workflow's `actions/setup-node@v3` should install a compatible patch version automatically.

3. **Translation structure commented out**: `src/config` in astro.config.mjs has an i18n config block commented with TODO. Do not enable without understanding the full routing implications.

4. **Formatters**: Prettier and ESLint run together. `pnpm run format` runs Prettier, then ESLint with auto-fix. Some ESLint warnings may remain unfixed and require manual intervention.

## CMS Information

The CMS (Strapi v5.31.3) runs independently and uses **pnpm**:
```bash
cd cms
pnpm install
pnpm run develop  # Runs on localhost:1337/admin
pnpm run build    # Production build
```

Content published in the CMS automatically generates MDX files in `src/content/foundation-pages/` via lifecycle hooks. MDX generation is handled by `cms/scripts/sync-mdx.cjs`.

For pages and blog posts, those lifecycle hooks also run a git add/commit/pull --rebase/push to trigger preview builds. Grant tracks only write/delete MDX locally. Set `STRAPI_DISABLE_GIT_SYNC=true` to disable the git sync.

CMS code changes are deployed to the Strapi VM when merged to `staging`. Content-only changes can be rebuilt into Strapi via `cms/scripts/sync-mdx.cjs`.

## Making Changes

When making changes to Astro components, pages, or styles:
1. Run `pnpm run start` to start the dev server (hot reload enabled)
2. Make changes in `src/`
3. Test locally at localhost:1103
4. Before committing, run `pnpm run format` to fix formatting issues
5. If format fails due to ESLint warnings, address warnings manually (check files listed in format output)
6. Verify `pnpm run build` succeeds (no output errors)

For content changes (MDX files), they are hot-reloaded during dev. For navigation changes, edit `src/config/navigation.json` and verify the sidebar updates correctly.

## Files to Avoid Modifying

These files are auto-generated or have special constraints and should not be manually edited unless you understand their dependencies:
- `cms/types/generated/*` – Generated from Strapi content-types
- `cms/src/index.ts` – Generated by Strapi plugin (in eslint ignore list)
- `cms/src/admin/app.tsx` – Generated by Strapi (in eslint ignore list)
- `public/scripts/highlight.min.js` – Minified third-party library
- `src/pages/financial-services.astro` – In eslint ignore list (pre-existing issues)
- `.astro/` directory – Build cache

## Trust These Instructions

This guide contains validated information about the build process, commands, and known issues. If a command fails:
1. Check if Node version is >=18.20.8
2. Verify you ran `pnpm install` first
3. Check the command in the table above for expected duration/behavior
4. Review the known issues section if the failure is pre-existing

Only perform additional searches if:
- Instructions appear outdated or contradict actual behavior
- A new error occurs not mentioned in known issues
- A build step takes significantly longer than documented
