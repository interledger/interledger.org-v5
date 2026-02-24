# Interledger.org Website

![Interledger Foundation](https://github.com/interledger/interledger.org-v5/blob/main/public/img/blog/og-ilf.png)

This repository contains the source code for the [Interledger Foundation website](https://interledger.org), built with [Astro](https://astro.build/), [Starlight](https://starlight.astro.build/) for documentation, and [Strapi](https://strapi.io/) as a headless CMS.

It represents the **fifth major iteration** of interledger.org. For background on previous versions and the site’s evolution, see the [project wiki](https://github.com/interledger/interledger.org-v5/wiki#background).

## Table of Contents

1. [About the Project](#about-the-project)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Local Development](#local-development)
5. [CI / Github Workflows](#ci--github-workflows)
6. [Content Workflow](#content-workflow)
   - [Content Synchronization](#content-synchronization)
   - [Preview functionality](#preview-functionality)
   - [Branches and Deployment](#branches-and-deployment)
   - [Environments](#environments)
7. [Contributing](#contributing)
   - [1. Editor Flow](#1-editor-flow-strapi-workflow)
   - [2. Developer Flow - Website content](#2-developer-flow---website-content-astro-content-collections)
   - [3. Developer Flow - Documentation ](#3-developer-flow---documentation-starlight)
   - [Writing guidelines for developers](#writing-guidelines-for-developers)
8. [More Info](#more-info)

## About the Project

- **Astro** provides a modern static site framework for fast, flexible site building.

- **Starlight** adds a ready-made documentation system, including layouts, navigation, and styling, making it easy to write and maintain docs.

- **Strapi** is the headless CMS for content management. Custom lifecycles hooks have been added to automatically synchronize content with the Astro project.

### Styling

- The frontend styling is built using **Tailwind CSS**.
- Design tokens, utility conventions, and custom styles are documented separately: [Styles README](https://github.com/interledger/interledger.org-v5/blob/main/src/styles/README.md)

## Architecture overview

```mermaid
flowchart
    subgraph gcp["☁️ GCP VM"]
        direction TB
        appclone[("Repo Clone<br/>(running Strapi app)")]
        strapidb[("Strapi Database")]
        strapi[Strapi Admin portal]
        appclone -->|"runs from './cms' folder"| strapi
        strapi -->|"reads/writes"| strapidb
    end

    subgraph github["📦 GitHub Repository"]
        direction TB
        staging["staging branch"]
        main["main branch"]
    end

    subgraph netlify["🚀 Netlify"]
        direction TB
        preview["Preview Site"]
        stagingsite["Staging Site"]
        production["Production Site"]
    end

    editor["👤 Content Editor"]
    dev["👨‍💻 Developer"]
    feature["Feature Branch"]

    editor ==>|"Publish"| strapi
    dev ==>|"Code / Content PR"| feature

    strapi -->|"lifecycle hooks generate MDX & <br/> push via GitHub App"| staging

    appclone -.->|"sync:mdx script<br/>(after pulling staging)"| strapidb


    feature ==>|"PR (approved)"| staging
    feature ==>|"PR"| preview

    staging ==>|"Auto-build"| stagingsite
    staging -->|"PR"| main

    staging -.->|"Pulls updates when <br/> './cms' folder changes"| appclone

    main ==>|"Auto-build"| production

    classDef gcpStyle fill:#4285f4,stroke:#1967d2,color:#fff
    classDef portalStyle fill:#018501,stroke:#1967d2,color:#fff
    classDef githubStyle fill:#24292e,stroke:#000,color:#fff
    classDef netlifyStyle fill:#00c7b7,stroke:#008577,color:#fff
    classDef userStyle fill:#ff6b6b,stroke:#d63031,color:#fff
    classDef branchStyle fill:#6c5ce7,stroke:#5f3dc4,color:#fff

    class strapi portalStyle
    class appclone,stagingclone gcpStyle
    class staging,main,feature githubStyle
    class preview,production,stagingsite netlifyStyle
    class editor,dev userStyle
```

## Project structure:

```text
.
├── .github/
│   ├── workflows/
│   └── copilot-instructions.md
├── cms/        # Strapi backend
│   ├── config/              # Strapi configuration files
│   │   ├── admin.ts
│   │   ├── database.ts
│   │   ├── middlewares.ts
│   │   ├── plugins.ts
│   │   └── server.ts
│   ├── database/                      # Database files
│   │   └── migrations/
│   ├── public/                        # Static assets
│   │   └── uploads/                   # User-uploaded media
│   ├── scripts/              # e.g., sync:mdx, sync-navigation
│   ├── src/         # Astro frontend application
│   │   ├── admin/      # Admin UI customizations
│   │   ├── api/
│   │   │   ├──/{content-type}  # e.g., blog-post, foundation-page
│   │   │       ├── content-types/
│   │   │       │       ├── schema.json
│   │   │       │       └── lifecycles.ts  # MDX generation logic
│   │   │       ├── controllers/
│   │   │       ├── routes/
│   │   │       └── services/
│   │   │   └── utils.ts
│   │   ├── components/                # Reusable Strapi components
│   │   │   ├── blocks/                # Content block components
│   │   │   ├── navigation/
│   │   │   └── shared/                # Shared components
│   │   ├── serializers/               # MDX serialization logic
│   │   │   └── blocks/
│   │   ├── utils/
│   │   └── index.ts
│   └── types/                         # TypeScript type definitions
│   │   └── generated/
│   ├── .env                 # Environment variables
│   ├── .gitignore
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml
│   ├── strapi-server.js
│   ├── tsconfig.json
│   ├── copy-schemas.js
│   └── README.md
├── public/           # Static assets (images, favicons)
├── src/              # Astro project
│   ├── components/    # Astro components
│   ├── config/        # JSON configs (navigation, etc.)
│   ├── content/       # Markdown/MDX content (blog, summit, docs)
│   │   ├── blog/
│   │   ├── developers/
│   │   ├── docs/
│   │   ├── foundation-pages/
│   │   └── summit/
│   ├── layouts/
│   ├── pages/       # Route pages
│   │   ├── blog/
│   │   ├── developers/
│   │   ├── summit/
│   │   ├── [...page].astro
│   │   └── index.astro
│   ├── schemas/
│   ├── styles/       # Global styles
│   ├── utils/        # Utility functions
│   ├── content.config.ts   # Astro content collections config
│   ├── env.d.ts
│   └── middleware.ts
├── .env                 # Environment variables
├── .env.example
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc
├── astro.config.mjs
├── eslint.config.js
├── netlify.toml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── tailwind.config.mjs
└── tsconfig.json
```

## Local Development

### Prerequisites

- [Git](https://git-scm.com/downloads) for version control
- [Node.js](https://nodejs.org/en/download) >= 18.0.0 <= 22.x.x
- [pnpm](https://pnpm.io/installation) >= 9.0.0

### Environment Setup

1. Clone the repository:

```sh
git clone https://github.com/interledger/interledger.org-v5.git
```

2. Install dependencies:

```sh
pnpm install
```

3. Build and start the site:

```sh
# Build for production
pnpm run build

# Start dev server (localhost:1103)
pnpm run start
```

4. For Strapi Admin setup locally, refer to the [/cms/README.md](https://github.com/interledger/interledger.org-v5/blob/main/cms/README.md).

### 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command            | Action                                       |
| :----------------- | :------------------------------------------- |
| `pnpm install`     | Installs dependencies                        |
| `pnpm run start`   | Starts local dev server at `localhost:1103`  |
| `pnpm run build`   | Build your production site to `./dist/`      |
| `pnpm run preview` | Preview your build locally, before deploying |
| `pnpm run format`  | Format code and fix linting issues           |
| `pnpm run lint`    | Check code formatting and linting            |

### 🔍 Code Formatting

This project uses [ESLint](https://eslint.org/) for code linting and [Prettier](https://prettier.io/) for code formatting. Before submitting a pull request, please ensure your code is properly formatted:

1. **Fix issues**: Run `pnpm run format` to automatically format code and fix linting issues
2. **Check before pushing**: Run `pnpm run lint` to verify everything passes (CI will also run this)

ESLint is configured to work with TypeScript and Astro files. The configuration extends recommended rules from ESLint, TypeScript ESLint, and Astro ESLint plugins, and integrates with Prettier to avoid conflicts.

## CI / GitHub Workflows

GitHub Actions run automatically on pull requests and branch merges.

Workflows include:

- Linting (ESLint)
- Formatting validation (Prettier)
- Build validation

Pull requests must pass all checks before merging.

## Content Workflow

### Content Synchronization

**Astro is the source of truth** for site content. Strapi lifecycles and synchronization scripts keep the CMS and Astro `.mdx` files in sync.

1. **Strapi → Astro**:
   - Strapi lifecycle hooks trigger `.mdx` file **creation**, **updates**, and **deletions**.
   - Changes are automatically committed and pushed directly to the `staging` branch, where Strapi acts as a contributor.

2. **Astro → Strapi**:
   - Merges in `staging` sync `.mdx` files back into the Strapi database.
   - Scripts like `sync:mdx` handle the synchronization.

### Preview Functionality

- Editors can preview content from Strapi in real time before publishing.
- Page previews become available after saving content as a **draft** or after **publishing**.
- While the rest of the site is statically generated, preview pages use **server-side rendering** in Astro (`export const prerender = false` in `page-preview.astro`).
- Each content type is mapped to a corresponding preview route.

⚠️ Note: Netlify automatically generates Deploy Previews for pull requests opened against `staging` that can be accessed at: `https://deploy-preview-{PR-number}--interledger-org-v5.netlify.app/`. These previews are **frontend-only** and reflect the Astro build at that PR state.

For more information on Strapi lifecycles, synchronization scripts and preview functionality, see [/cms/README.md](https://github.com/interledger/interledger.org-v5/blob/main/cms/README.md).

### Branches and Deployment

- **`main`**:
  - Serves the live production website.
  - Merges to `main` trigger a Netlify rebuild of the production site.

- **`staging`**:
  - Serves the live staging website (deployed via Netlify).
  - Serves the Strapi Admin interface (running on the GCP VM).
  - Every merge to `staging` that contains changes **outside the `/cms` folder** triggers the GCP VM to pull the latest changes and execute the `sync:mdx` script, which updates the Strapi database based on the Astro `.mdx` files..
  - Any merge to `staging` that modifies files in the `/cms` folder triggers a rebuild of Strapi Admin panel.

### Hosting Architecture

- The Astro website (production and staging) is deployed and hosted via Netlify.
- Strapi (including the Admin panel) runs on a single Google Cloud VM.
- The Strapi instance on the VM tracks the `staging` branch and pulls updates when `/cms` changes are merged.

### Environments

- **Live website** (built from `main`): https://interledger-org-v5.netlify.app/
- **Staging website** (built from `staging`): https://staging--interledger-org-v5.netlify.app/
- **Strapi admin** (controlled via `staging`): https://strapi-admin.interledger.org/

## Contributing

Content can be added in two main ways:

- **Editor workflow (via Strapi Admin)**
- **Developer workflow (via Astro `.mdx` files)**

The developer workflow also includes adding and maintaining documentation.

There are **three contribution paths**, depending on your role and the type of content.

### 1. Editor flow (Strapi workflow)

- Editors create pages and blog posts via **Strapi Admin**.
- Each content type in Strapi has lifecycles configured to **generate/update/delete `.mdx` files in the Astro project** automatically.
  - Example: Creating a blog post in Strapi generates `src/content/blog/{blog-title}.mdx`.
- Content changes are automatically committed and pushed to the `staging` branch by the GitHub App `Interledger Strapi`.

⚠️ Note: Strapi is set up to be a contributor to our code base. When editors use the Strapi interface to make changes, Strapi's lifecycle hooks make commits to the `staging` branch on behalf of the editors.

#### Content Management Documentation

All documentation for working with website content is available in [the wiki](https://github.com/interledger/interledger.org-v5/wiki). Please refer to the wiki for:

- Content creation and editing guidelines
- Adding blog posts and podcast episodes
- Managing multilingual content
- General site-building philosophy

### 2. Developer flow - Website Content (Astro Content Collections)

Developers can add multiple types of content directly to the repository. Each content type has a specific folder and naming convention.

Astro automatically picks up these files, registers them in the appropriate content collection, and generates the correct routes using the associated templates.

**Foundation Blog posts**

- Location: `src/content/foundation-blog-posts`
- Filename format: `YYYY-MM-DD-slug.mdx`

Used for: Foundation news, updates, announcements, thought leadership.

**Tech Blog posts**

- Location: `src/content/developers-blog-posts`
- Filename format: `YYYY-MM-DD-slug.mdx`

Used for: Technical deep dives, implementation updates, engineering insights.

**Foundation Pages**

- Location: `src/content/foundation-pages`
- Filename format: `slug.mdx`

Used for: Static foundation pages such as About, Policy & Advocacy, Team, Grants, etc.

**Summit Pages**

- Location: `src/content/summit-pages`
- Filename format: `slug.mdx`

Used for: Summit landing pages, schedules, speaker lists, event resources.

**⚠️ Important (Schema Validation)**

- Use correct frontmatter for each content type.
- Follow the required schema — **invalid metadata will break the build**.
- See:
  - `src/schemas/content.ts`
  - `src/content.config.ts` <br/>
    to understand the required schema and validation rules for each content collection.

#### Blog metadata and tags

Each blog post includes frontmatter at the top of the file (title, description, date, authors, etc.), including a `tags` field used for filtering on the blog index.

Please **only use the existing, approved tags** unless you have aligned with the tech + comms team on adding a new one. This helps keep the tag filter focused and avoids fragmentation.

**Current tags:**

- Interledger Protocol
- Open Payments
- Web Monetization
- Rafiki
- Updates
- Releases
- Card Payments

If you believe your post needs a new tag, propose it in your PR description or in the `#tech-team` Slack channel so we can decide whether to add it and update this list.

### 3. Developer flow - Documentation (Starlight)

Documentation pages are managed via Starlight.

Docs live in `src/content/docs`.

Starlight looks for `.md` or `.mdx` files in the `src/content/docs/` directory. Each file is exposed as a route based on its file name.

Static assets, like favicons or images, can be placed in the `public/` directory. When referencing these assets in your markdown, you do not have to include `public/` in the file path, so an image would have a path like:

```md
![A lovely description of your beautiful image](/img/YOUR_BEAUTIFUL_IMAGE.png)
```

For more information about the way our documentation projects are set up, please refer to our [documentation style guide](https://interledger.net/#docs-site-building).

#### Developer Contribution Requirements

- Add `.mdx` content in Astro.
- Open PRs against `staging`.
- Use frontmatter correctly — invalid metadata will break the build.
- Run `pnpm run build` and `pnpm run format` before PR.
- The PR must undergo review and pass all checks before it can be merged.

Consult **Writing Guidelines for Developers** below for more details on content structure, metadata, tags, and blog formatting.

### Writing guidelines for developers

**Goal:** Educate, drive adoption, and grow strategic influence.

**Typical Target Audience:**

- Technically-inclined users interested in Interledger development.
- Technically-inclined users interested in financial services technologies, innovations, or developments.
- Users keen on topics like APIs, data analytics, metrics, analysis, and quantitative assessment for digital networks.
- Users interested in privacy and related technologies.

**Possible Content Framework:**

If you're unsure how to structure your writing, you can use this as a guide.

- Introduction / main point
- Context - Interledger’s perspective / stance / commitment on the topic being written [broader categories like privacy, metrics for growth, Digital Financial Inclusion etc.]
- The Challenge (or) The Problem
- The Solution
- The How / implementation
- Roadmap - short-term / long-term
- Note: A call to action (CTA) will be included automatically at the bottom of every post.

Ideal Word Count: Between 1,000 and 2,500 words, with links to relevant documents/pages for a deeper understanding.

#### Getting Started

Discuss Ideas: Before starting, share your blog post ideas with the tech team to ensure alignment and awareness.

Copy the Template: Begin your draft using [this Google Doc template](https://docs.google.com/document/d/1L7vzsYORg9xmf72ljTdmyekpq2vJ7eQZ9atM2uAXgUM/edit?usp=sharing) to maintain a consistent format.

**Review Process**

Initial Reviews:

- Once your draft is ready, request specific reviewers or ask for feedback on the `#tech-team` Slack channel.
- Incorporate feedback and refine the blog post.

Finalizing:

- When the draft is stable, create a pull request in the [interledger.org](https://github.com/interledger/interledger.org-v5) GitHub repo against `staging`.
- Please add links where appropriate so people can easily click to learn more about the concepts you reference.
- Include all images used in the post in the PR.
- No-one is expected to know the ins and outs of Astro (the framework that powers our site), so please tag someone in the frontend team as a reviewer to ensure everything Astro-related is in order.
- The PR will be reviewed by the frontend team before being merged into `staging`.

#### Working with Visuals

- If you need an illustration, submit a design request in advance to Madalina via the `#design` Slack channel using the design request form.
- Before uploading images to GitHub, run them through an image optimizer such as [TinyPNG](https://tinypng.com/).
- Ensure images are appropriately sized; feel free to ask Madalina or Sarah for assistance.

#### Publishing Your Blog Post

- Note: Merging the pull request will **not** publish the blog post immediately. Changes from `staging` are merged into `main` twice a week.
- Ensure the publishing date in the blog post frontmatter matches the intended release date.
- Check with Ioana to confirm the publishing date and keep a consistent posting schedule. Ioana will also handle social media promotion.
- Run `pnpm run build` locally to verify that the page builds correctly.
- Run `pnpm run format` and `pnpm run lint` to format your code and check for any issues before creating a pull request.

## More Info

Details on **Strapi lifecycles**, **MDX syncing**, and **preview functionality**, and how to **set up a local Strapi instance** are documented in [/cms/README.md](https://github.com/interledger/interledger.org-v5/blob/main/cms/README.md).
