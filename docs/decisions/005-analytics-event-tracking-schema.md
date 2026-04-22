# ADR-005: Analytics event tracking schema

**Status:** Proposed
**Date:** 2026-04-21
**Issue:** N/A

## Context

Our Umami event tracking has grown inconsistent and increasingly hard to query. Problems fall into four categories:

**Manual naming drift.** Event names are typed by hand, producing case inconsistencies (`Content Hub` vs `Content hub`), mixed separators (hyphens, en-dashes, spaces), and duplicate multilingual variants. The same interaction appears under several slightly different names, making aggregation unreliable.

**Over-specific event names.** Date-based events like `Blog - 2026-01-07` and content-specific one-offs create effectively unique events that cannot be grouped. Questions like "how do blog cards perform overall?" have no clean answer.

**No ownership model.** There is no enforced separation between page context, component/UI, and content destination. Each event is constructed ad hoc, so naming decisions are inconsistent by construction.

**Misalignment with the stack.** The site is built on reusable Astro components, and stable `pathSlug` identifiers. The analytics layer does not reflect this yet.

Umami's UI is event-name-first, which creates a constraint: page context should appear in the event name, but encoding too much detail fragments events into long-tail noise. The schema must balance queryability with clean aggregation.

## Decision

All tracked link events follow a three-segment schema generated from code and content identifiers — never typed by hand:

```
{page}:{component}:{label}
```

**Page** and **Label** use the same `deriveLabel()` function — Page applied to `Astro.url.pathname`, Label applied to the link's `href`. Both take the last two path segments after stripping locale prefixes and join them with `_`. A profile page at `/grants/fellowship/sheena-allen` and a link pointing to it both produce `fellowship_sheena_allen` — unambiguous at both ends. Nothing is typed by hand.

**Component** is a `const COMPONENT` declared inside each Astro component.

For **Label**, external URLs use the root domain with subdomain preserved where meaningful; GitHub gets special treatment to capture org and repo. The two-segment approach prevents collisions: `/grants/fellowship/sheena-allen`, `/hackathon/judges/sheena-allen`, and `/summit/speakers/sheena-allen` produce `fellowship_sheena_allen`, `judges_sheena_allen`, and `speakers_sheena_allen` — distinct regardless of where the link appears.

A `TrackedLink` Astro component is the single instrumentation point. It accepts `page`, `component`, and `href`, generates the event name, and sets two standard properties on every tracked link:

- `lang` — injected from `Astro.currentLocale`, never set manually
- `link_text` — the visible link text as rendered

This makes `fellowship:hero:submittable` the same event in English and Spanish; the `lang` property distinguishes them. No duplicate events, no multilingual noise.

**Rich text is a deliberate exception.** Body content fields are editor-driven and can contain an unbounded variety of destinations. Encoding every destination into the event name would produce long-tail noise that clutters the event list. Rich text links instead use a two-segment name:

```
{page}:richtext
```

Label, destination URL, and link type are captured as event properties. Because this is an SSG build, attributes are injected at build time by processing the rendered HTML string — no client-side JavaScript required.

## Alternatives considered

**Status quo (manual event strings).** Already producing 300+ events with inconsistent casing, mixed separators, and duplicate multilingual variants. Does not scale.

**Single-segment derivation for page or label.** Collapses important context — `/grants/fellowship/sheena-allen`, `/hackathon/judges/sheena-allen`, and `/summit/speakers/sheena-allen` all produce `sheena_allen` whether used as a page identifier or a link label. Ruled out for both.

**Full path as label.** Produces near-unique event names for deep pages, defeating aggregation. Ruled out.

**Pattern-based locale stripping.** A two-letter path segment that is not a locale code (`go`, `do`) would be incorrectly stripped. Using the project's `locales` export as the source of truth is more reliable. Adopted.

**Rich text using full three-segment schema.** The unbounded variety of editorial destinations would fragment the event list with low-volume, one-off events. Two-segment name with properties preserves drill-down capability while keeping the event list clean. Adopted.

## Consequences

**Positive:**

- Event names are generated, never typed. Casing drift, separator inconsistency, and copy-paste errors are structurally impossible.
- Locale prefixes are stripped from labels; locale is a property. One event per interaction regardless of language.
- `deriveLabel` runs at build time; rich text attributes are injected during the build. No runtime JavaScript dependency.
- Adding a new page requires one `pathSlug` in frontmatter. Adding a new component requires one `const COMPONENT` declaration. No central registry to maintain.
- Umami wildcard queries (`fellowship:*`, `*:hero:*`, `*:*:submittable`) give page-level, component-level, and destination-level views without any schema changes.

**Negative:**

- `TrackedLink` must be adopted across all components to realise consistency benefits. A parallel period where old and new events coexist will require care when interpreting data.
- The two-segment label is a heuristic. Unusual URL structures (very shallow paths, non-standard slugs) may produce less meaningful labels, though `slugify` ensures they are always safe.
- Rich text link tracking depends on build-time HTML processing. Any server-side or client-side rendering path that bypasses this step will not be instrumented.
- `deriveLabel` relies on the `locales` export staying accurate. A locale added to URLs but not to that export will cause the prefix to appear in both page and label segments.
