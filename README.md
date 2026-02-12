# Interledger.org

The official [Interledger.org](https://interledger.org/) website built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/).

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Bun](https://bun.sh/) >= 1.0

## Quick Start

```bash
bun install
bun run start
```

Site runs at `localhost:1103`.

## Commands

| Command         | Action                |
| :-------------- | :-------------------- |
| `bun run start` | Dev server (port 1103) |
| `bun run build` | Production build      |

## Project Structure

- `cms/` – Strapi CMS for content (see [cms/README.md](cms/README.md))
- `src/content/` – MDX content (blog, docs, pages)
- `cms/scripts/` – Sync and import scripts
