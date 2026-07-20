# ADR-008: Exclude `public/img` and `public/uploads` from the Netlify SSR function bundle

**Status:** Accepted
**Date:** 2026-07-18
**Issue:** N/A (found during INTORG-856 investigation; discovered via a failed production-like deploy on PR #398)

---

## Context

Netlify deploys started failing outright, with a fatal, not-very-descriptive error:

```
Failed to create function: invalid parameter for function creation: Invalid AWS Lambda parameters used in this request.
Failed to upload file: ssr
...
Deploy did not succeed with HTTP Error 400: [PUT /deploys/{deploy_id}/functions/{name}]
```

The failure first showed up on PR #398 ("Apply the new 404 page design"), while an earlier PR (#389) had deployed fine. The 404 page change itself didn't add any large images or assets — the real cause was something that had been quietly building up for a while, and #398 just happened to be the PR that tipped it over.

### What's actually failing, and why

Most of this site is prerendered — built once into plain HTML at build time, with no server involved when a visitor requests the page. But a handful of routes need to run server-side code on every request instead (for example, the CMS preview pages, which fetch live content from Strapi to show an editor what their draft will look like). Netlify runs that server-side code as an AWS Lambda function, and it packages up everything that code might need — the compiled site code, `node_modules` dependencies, and any files it might read — into one deployable bundle.

AWS Lambda has a hard size limit on that bundle (roughly 250MB unzipped). If the bundle is packaged too large, Lambda simply refuses to create the function — which is the generic, unhelpful error above.

This project's `astro.config.mjs` doesn't configure the Netlify adapter to split routes into separate functions (no `functionPerRoute` option is set), so **every one of these server-rendered routes across the whole site shares one single bundle**, called `ssr`. If any one of them needs a large file, the whole shared bundle gets larger — for every route, not just the one that needs it.

One of the utility functions used by several page components, `getOptimizedImage()` (`src/utils/main/images.ts`), checks whether a pre-optimized version of an image already exists, by checking the filesystem directly:

```ts
const publicDir = path.join(process.cwd(), 'public')
const exists = (rel: string) => fs.existsSync(path.join(publicDir, rel))
```

When Netlify's build tooling figures out what files a server-rendered route actually needs to run (so it knows what to package into the Lambda bundle), it does this by tracing which files the code touches. Because this function reads from the `public/` folder at runtime rather than only at build time, that tracing logic can't tell which specific files under `public/` it might need — so, to be safe, it copies the **entire** `public/` folder into the bundle, image assets and all.

That folder is not small. `public/img` holds every image the CMS has ever had optimized versions generated for, and it only ever grows — at the time of writing it was over 200MB, plus a few more MB in `public/uploads`. A local test build showed the resulting Lambda bundle at roughly **300MB — already over Lambda's ~250MB limit** before counting anything else in it.

This wasn't something PR #398 introduced — it had been a problem waiting to happen for a while. A local build of the commit right before #398 already came out to 84–205MB (it varies because `public/img`'s exact contents are pulled from live CMS data at build time, so the number is different every time you build). PR #398 happened to push it over the edge — partly by switching to a broader import that pulled a bit more code into the bundle, and partly just because the CMS's image library had grown a bit more by then. PR #389, just before it, likely only passed because it happened to land on a day the total was still just barely under the limit.

---

## Decision

Told the Netlify adapter to leave `public/img` and `public/uploads` out of the server bundle entirely, via `astro.config.mjs`:

```ts
adapter: netlify({
  // public/img and public/uploads are CMS-driven and can grow into the
  // hundreds of MB. getOptimizedImage() (src/utils/main/images.ts) does a
  // runtime fs.existsSync check against public/, which makes the function
  // bundler's dependency tracer pull the whole directory into the SSR
  // function — pushing it past AWS Lambda's size limit. These assets are
  // served by the CDN / read at build time only, never needed at Lambda
  // runtime, so they're excluded from the function bundle here.
  excludeFiles: ['./public/img/**/*', './public/uploads/**/*']
}),
```

This is a supported option on the adapter specifically for this situation — files matched by these patterns are simply never copied into the deployed function, no matter what the dependency tracing thinks it needs.

Verified locally: the `ssr` function bundle dropped from ~300MB down to **57MB**. The excluded folders still show up as empty-ish placeholders in the bundle (a small manifest file, a `.gitkeep`), but the actual image files are gone from it.

Commit: `db024003` — *"exclude public/ files from netlify lambda bundle"*.

### A side effect this creates (tracked separately, not fixed here)

`getOptimizedImage()` isn't only used by prerendered (build-time) pages — it's also called by the same CMS preview routes mentioned above (`page-preview`, `profile-preview`, `blog/preview` in both English and Spanish), which run at request time, inside the deployed Lambda. Before this change, those routes could find optimized images because the whole `public/` folder happened to be sitting right there in the bundle. Now that it's deliberately excluded, `fs.existsSync()` will always come back `false` for those routes in production — the files genuinely aren't there anymore. `getOptimizedImage()` doesn't error in that case; it just quietly returns "no optimized version available," so preview pages fall back to showing the original, unoptimized image instead. Nothing breaks, but the preview no longer shows what a real visitor would actually see. There's no log or warning when this happens, so it isn't obvious unless someone happens to notice.

This doesn't affect the actual public-facing site — prerendered pages are built with the full `public/` folder available at build time; this exclusion only affects what ships inside the deployed request-time function.

The real fix is to stop `getOptimizedImage()` from checking the filesystem at request time at all, and instead have it consult a small manifest of "which optimized images exist" that gets generated once at build time. That's tracked as a follow-up rather than done here, to keep this deploy-blocking fix small and low-risk.

---

## Alternatives considered

**Split each server-rendered route into its own separate Lambda function (`functionPerRoute: true`).** Would mean one route's oversized dependencies couldn't drag down every other route's bundle with it. A reasonable extra safety measure, but doesn't fix the actual cause (the filesystem check at request time) — the same route would still need the same exclusion. Worth doing alongside the real fix, not instead of it.

**Fix `getOptimizedImage()` properly right away, instead of excluding the files.** This is the better long-term fix, but it's more work — it touches the image-build pipeline, needs a new manifest format, and needs its own tests. Deploys were actively broken, so the small, low-risk config change was made first to unblock things immediately, with the real fix tracked separately.

**Move `public/img` out of this repo (e.g., a separate repo or submodule) to make the whole checkout smaller.** Wouldn't actually help — the file-tracing tool would still find and copy whatever's on disk at build time regardless of which repo it physically lives in. This addresses a different problem (repo size) than the one causing the deploy failure.

---

## Consequences

**Positive**

- Netlify deploys work again, with real headroom to spare (57MB used out of a ~250MB limit), even though `public/img` will keep growing as more content gets added to the CMS.
- The fix was a one-line config change — no application code had to change.

**Negative / watch for**

- **CMS preview pages now silently show unoptimized images in production.** No error, no log — the only way to notice is that a previewed image looks like the original upload rather than the responsive, compressed version a real visitor would see. Tracked as a follow-up: replace the runtime filesystem check in `getOptimizedImage()` with a build-time manifest, so these pages don't depend on `public/` being present in the deployed function at all.
- **This fixes the symptom, not the underlying habit that caused it.** If any other piece of code ever adds a similar "check the filesystem at request time" pattern against another large, growing folder, the same kind of failure can happen again under a different folder name, and would need its own exclusion added. The manifest-based fix removes the underlying cause; this change is a stopgap that's good enough for now.
- `public/img`'s size is driven entirely by how much content is in the CMS, not by anything in this codebase — there's no natural ceiling on how large it can get. Treat this fix as "buys headroom for now," not "solved permanently." If the *build itself* (not just the deployed function) ever starts running into resource limits because of this folder's size, that's a sign this needs revisiting.

---

## How to reproduce / verify locally

1. `pnpm run build` from the repo root (builds both the static site and the Netlify function).
2. `du -sh .netlify/v1/functions/ssr` — should stay comfortably under Lambda's ~250MB limit. At the time of writing this measured ~57MB.
3. `find .netlify/v1/functions/ssr/public -type f -iname "*.webp" -o -iname "*.jpg" -o -iname "*.png" -o -iname "*.avif"` — should turn up next to nothing (a few small, unrelated static images like the `sessionize-speakers` photos — not the CMS-driven `public/img`/`public/uploads` folders).
4. Clean up afterwards: `rm -rf .netlify dist` (both are gitignored, safe to delete).
