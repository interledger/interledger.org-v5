# ADR-002: Spanish fallback disclaimer behavior for Speaker list pages

**Status:** Proposed
**Date:** 2026-04-09
**Issue:** N/A

## Context

Spanish routes fall back to English when a translation is missing. We need to show a disclaimer when that fallback affects the current page, but avoid showing it when the visible page content is still acceptable in Spanish. The speakers list page only has a tritle that can be translated, the rest is all the same for EN or ES. This means fallback content is actually perfectly fine for ES and the disclaimer makes no sense (provided the page title is translated).

## Decision

Show the Spanish fallback disclaimer only when the current page renders fallback English content.

- Do show it on content pages, blog posts, session pages, and speaker detail pages when they fall back.
- Do not show it on the Summit speakers list just because linked speaker bios are untranslated.

## Alternatives considered

### Show the disclaimer whenever any related translation is missing

Rejected because it over-signals fallback, especially on the Summit speakers list. If a speaker isn't translated it list page still works in Spanish.

## Consequences

**Positive:**

- Readers only see the disclaimer when it explains visible content.
- The Summit speakers list avoids a misleading warning.

**Negative:**

- This could change in the future with how the page is handled.
