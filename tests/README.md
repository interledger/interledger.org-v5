# End-to-end tests (Playwright)

Browser tests for public visitor flows on the Astro site. Unit tests stay in Vitest (`pnpm test`); this suite is separate (`pnpm run test:e2e`).

## Prerequisites

- Node.js `>=24` and `<=24.x` (see root `package.json` `engines`)
- [pnpm](https://pnpm.io/installation) (repo uses `pnpm@10.27.0`)
- From the repo root: `pnpm install`
- Playwright browsers (once per machine / after upgrading `@playwright/test`):

```sh
pnpm exec playwright install
# CI / fresh Linux agents also need OS deps:
pnpm exec playwright install --with-deps
```

## Running tests

The config starts (or reuses) the Astro dev server on **port 1103** (`pnpm run start`).

| Command                    | What it does                                     |
| :------------------------- | :----------------------------------------------- |
| `pnpm run test:e2e`        | Run the suite headlessly                         |
| `pnpm run test:e2e:ui`     | Interactive Playwright UI                        |
| `pnpm run test:e2e:report` | Open the last HTML report (`playwright-report/`) |

Useful flags:

```sh
pnpm exec playwright test --headed
pnpm exec playwright test tests/e2e/baseline.spec.ts
pnpm exec playwright test -g "404"
```

If a server is already running at `http://localhost:1103`, local runs reuse it (`reuseExistingServer`). In CI a fresh server is always started.

## Folder structure

```text
tests/
├── README.md           # This file
├── e2e/                # Spec files (*.spec.ts) — only these are executed
├── pages/              # Page Object Model classes
└── utils/              # Shared helpers (add as the suite grows)
```

`playwright.config.ts` sets `testDir` to `./tests`. Specs live under `e2e/`; Page Objects under `pages/` are not picked up as tests.

## Adding a test (Page Object pattern)

1. Prefer an existing Page Object in `tests/pages/`, or add one that owns selectors and user actions for that URL.
2. Write a thin spec in `tests/e2e/` that wires the object to assertions.

Example:

```ts
// tests/pages/BlogIndexPage.ts
import type { Locator, Page } from '@playwright/test'

export class BlogIndexPage {
  readonly page: Page
  readonly heading: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { level: 1 })
  }

  async goto(): Promise<void> {
    await this.page.goto('/blog/')
  }
}
```

```ts
// tests/e2e/blog.spec.ts
import { test, expect } from '@playwright/test'
import { BlogIndexPage } from '../pages/BlogIndexPage'

test('blog index loads', async ({ page }) => {
  const blog = new BlogIndexPage(page)
  await blog.goto()
  await expect(blog.heading).toBeVisible()
})
```

### Conventions

- Prefer role/label locators (`getByRole`) over brittle CSS when possible.
- Internal page URLs end with `/` (site convention). The custom 404 lives at `/404` (no trailing slash).
- Do not assert HTTP `404` for missing pages in local `astro dev`: missing foundation routes redirect to `/404` and often respond with **200** while showing the “Page not found” heading. Netlify applies a real 404 status via `public/_redirects`.
- Keep application code (`src/`) out of E2E PRs unless the product behavior itself must change.
- Run `pnpm run format` and `pnpm run lint` before opening a PR. Target branch: `staging`.
