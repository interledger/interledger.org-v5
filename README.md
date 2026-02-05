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
bun install
bun run develop
```

Admin panel: <http://localhost:1337/admin>

See [cms/README.md](cms/README.md) for details.
