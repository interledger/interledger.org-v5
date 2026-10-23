# Block intro and block spacing: implementation plan

> Status 2026-10-15. Implementation phases for INTORG-1154. **The definitions live in [ADR-009: Every block owns its intro and its spacing](../decisions/009-block-intro-and-block-owned-spacing.md)**: the global spec (A0–A6), the per-block spec (B1–B14), the decisions (D1–D8) and the open design items (E-Q1–E-Q17). IDs below link to those sections. All values are written **Mobile / Tablet / Desktop**.

## Phases

Each phase is one PR into `staging`.

### Phase 0: Foundation (no visual change)

1. **`cms/src/components/shared/block-intro.json`:** `heading` and `subheading` (localized strings), and `description` (CKE `basicMarkdownPreset`, localized). Regenerate `contentTypes.d.ts`.
2. **Types:**
   - `src/types/`: `BlockIntro` and `BlockIntroVariant = 'universal' | 'button-cta' | 'profile-grid' | 'split-layout'`.
   - CMS: a matching input type.
3. **Tokens** in `src/styles/base/variables.css`, following the `--space-section` `@variant` pattern:
   - `--intro-top`, `--intro-h2-pt`, `--intro-h3-pt`, `--intro-h2-h3`, `--intro-h3-desc`, `--intro-desc`
   - `--block-pb`
   - `--media-pt` ([A5](../decisions/009-block-intro-and-block-owned-spacing.md#a5-paragraph-block-media-image--video-table-list))
   - variant overrides for Split layout (desktop) and Button CTA, via `[data-intro-variant=…]`
4. **`src/components/shared/BlockIntro.astro`:**
   - `<header>` with an optional `<h2 id>`, `<h3>` and description (through `parseMarkdown`)
   - padding-based spacers, with the [A1](../decisions/009-block-intro-and-block-owned-spacing.md#a1-intro-every-block) conditions
   - renders nothing when the intro is empty
5. **Self-spacing hook:**
   - The block root gets `data-intro-variant`. `block-intro.css` gives it `padding-block-end: var(--block-pb)`.
   - `rhythm.css` excludes these blocks from the `--space-section` margin, and adds the transitional rules for mixed pages ([how spacing ownership works](../decisions/009-block-intro-and-block-owned-spacing.md#how-spacing-ownership-works)).
   - `DynamicZone.astro` skips `mt-section` for them.
6. **Serializer helper** `serializeIntroProp(intro)` in `cms/src/utils/blockIntro.ts`, exported from the barrel. Normalise the description like Agenda does. Braces need no escaping: MDX parses the expression with acorn.
7. **Sync helper** `getIntroAttr(node)` in `cms/scripts/sync-mdx/jsxExtract.ts`, with shape validation that throws `MdxParserError` on a bad shape.
8. **Tests:**
   - BlockIntro drop rules
   - serializer empty, partial and full
   - sync round-trip and malformed input
   - special characters round-trip

**Phase 0 review follow-ups** (left open on purpose; settle before or during the phase named):

- **Phase 1, first block on the page.** Settled by design ([A6](../decisions/009-block-intro-and-block-owned-spacing.md#a6-h1-hero-only-543261853)): the gap below the hero or bare H1 is 0 and the first block supplies its own top. So the intro's top spacer stays. Remove the templates' own gap under the hero and H1 (e.g. `mb-2xl tablet:mb-3xl` on the hero-less H1 in `FoundationContentPage.astro`) and any top spacing of the prose container. Do it in the template that first renders an intro block.
- **Phase 1, `aria-labelledby`.** Only the h2 gets `headingId`. A block must label its `<section>` only when the intro has a heading (use `normalizeBlockIntro`). An intro with only a subheading renders an h3 with no h2 above it, by design: the editor decides ([A1](../decisions/009-block-intro-and-block-owned-spacing.md#a1-intro-every-block)). Such a block gets an `aria-label` instead.
- **Phase 1, sync handlers.** `getIntroAttr` returns `undefined` (prop absent) or `null` (all fields empty). Both map to `intro: null` in Strapi.
- **Phase 1, preview list.** `SELF_SPACED_BLOCKS` (`src/utils/main/dynamicZoneSpacing.ts`) must list every block that sets `data-intro-variant`. Add a test that ties the two together when the first block is migrated. In the preview, an intro block at the end keeps its 40 bottom padding, which the live page drops.
- **Phase 2, `page-stack`.** `page-stack` (`utilities/spacing.css`) still adds `--space-section` between `<main>` sections. Exclude `[data-intro-variant]` there before InfoCards and GrantFaqSection adopt the intro.
- **Known transitional gaps.** A fake-intro Paragraph (ending on `## Heading`) before an intro block gives 128 on desktop, not 120. A legacy block before an intro block whose intro is empty sits 40 above it ([A2](../decisions/009-block-intro-and-block-owned-spacing.md#a2-block-padding-bottom-every-block-including-paragraph)'s minimum).

### Phase 1: Pilot (CardGrid, FAQ, NumberTiles)

Per block, following the dynamic-zone block checklist:

- **Schema:** add `intro`, keeping `title`/`heading` for now.
- **Serializer:** emit `intro`, falling back to the legacy field.
- **Sync handler:** reads `intro` and still accepts the legacy attribute.
- **Component:** renders `<BlockIntro>`, keeps `aria-labelledby`, sets `data-intro-variant`.

Then:

- Run the migration script (`cms/scripts/migrate-block-intro.ts`, with `--dry-run` and `--fold` for fake intros), then `sync:mdx`.
- Follow-up PR: remove the legacy fields.

No restyle in this phase ([D9](../decisions/009-block-intro-and-block-owned-spacing.md#decision)). CardGrid, FAQ and NumberTiles stay as built; they only gain the intro and the block spacing.

**Phase 1 status (2026-10-19).**

- **Done:** the Phase 0 follow-ups for the first block on the page, `aria-labelledby`, the sync handlers and the preview list.
  - The hero gap drops only when the first section's prose opens with an intro block that has content (`page-stack` in `utilities/spacing.css`, and `HackathonContentPage`).
  - The hero-less H1 margin in `FoundationContentPage` is untouched. No page needs it yet, and a `:has()` can't reach it; handle it in Phase 3.
  - The sync handlers leave `intro` out when it's empty, like other optional fields. The sync replaces the whole dynamic zone, so nothing stale survives.
  - Blocks label their `<section>` by the heading, or the subheading when there is no heading (`blockIntroLabel`).
- **Run `pnpm sync:mdx` right after this merges.** Until it runs, Strapi still holds the unfolded Paragraphs and the legacy titles. An editor save on one of those pages would export the old shape and undo the migration.
- **22 fake intros are left for editors.** They have formatted headings, content before the heading, or lists. List them with `cd cms && pnpm exec tsx scripts/migrate-block-intro.ts --dry-run`.
- **Content follow-up:** `events.mdx` (EN and ES) has a Paragraph ending on "Upcoming Events" right before a CardGrid whose own heading is "October". It now reads as two separate headings, a full section apart.
- **Admin:** component layouts in `cms/src/index.ts` replace Strapi's generated layout. Every block that gains `intro` must be added there too.

**Phase 2a status (2026-10-19).** The intro is on Image, Video, PDF, Quote, Blockquote, Event card, Logo carousel, Profile grid and CTA buttons.

- **`IntroBlockFrame`** (`shared/IntroBlockFrame.astro`) wraps blocks whose content is a reusable component, so that component stays usable without block spacing. The MDX maps point `Blockquote`, `VideoEmbed` and `PdfEmbed` at the block components.
- **Blog posts use the framed blocks like every page** (D3, revised 2026-10-22; the first pass kept them unframed). `blog.css` drops its figure and video bottom margins inside a frame, where the frame's padding is the gap.
- **Logo carousel:**
  - `standalone` keeps the homepage version as built.
  - As a content block it has no side padding of its own, so its intro and logos line up with the other blocks (designer, 2026-10-19).
  - A legacy element after a mid-page carousel reads the default `--block-pb`, not the carousel's 40, so it sits a little too low. No page has one yet.
- **CTA buttons:**
  - Self-spaced only when they have an intro. Without one they keep the tight pairing with the paragraph above (`OWNS_ITS_SPACING`), and the preview is approximate for one with an intro.
  - A heading-only intro drops the buttons' top padding, so the H2 spacer alone is the gap (designer, 2026-10-19).
- **Pre-existing gaps, not from this work:**
  - `FundraisingPage` maps none of these blocks, though its schema allows them.
  - The root `page-preview.astro` doesn't populate image, video or PDF media.

### Phase 2: Remaining blocks

Same recipe as Phase 1. Blocks that are already built only gain the intro and the block spacing ([D9](../decisions/009-block-intro-and-block-owned-spacing.md#decision)). The listed structural changes follow the ADR's [per-block spec](../decisions/009-block-intro-and-block-owned-spacing.md#b-per-block-spec).

| Block                              | Variant      | Today                                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ImageBlock, VideoEmbed             | universal    | none                                            | [B3](../decisions/009-block-intro-and-block-owned-spacing.md#b3-image--video-embed-543142614): media stays as built                                                                                                                                                                                                                                                                                  |
| PdfEmbed                           | universal    | none                                            | [B8](../decisions/009-block-intro-and-block-owned-spacing.md#b8-pdf-embed-546866900): no design; responsive frame and content                                                                                                                                                                                                                                                                        |
| Quote                              | universal    | none                                            | [B6](../decisions/009-block-intro-and-block-owned-spacing.md#b6-quote-546666281-and-blockquote-546766429): stays as built; drop `my-2xl` so the block spacing applies                                                                                                                                                                                                                                |
| Blockquote                         | universal    | none                                            | [B6](../decisions/009-block-intro-and-block-owned-spacing.md#b6-quote-546666281-and-blockquote-546766429), [D8](../decisions/009-block-intro-and-block-owned-spacing.md#decision): stays as built, `source` kept; Quote's padding rules                                                                                                                                                              |
| EventCard                          | universal    | `title`                                         | [B13](../decisions/009-block-intro-and-block-owned-spacing.md#b13-event-card-547473345): stays as built; intro and block spacing only                                                                                                                                                                                                                                                                |
| LogoCarousel                       | universal    | `heading`                                       | [B12](../decisions/009-block-intro-and-block-owned-spacing.md#b12-logo-carousel-547471790): stays as built; heading → left-aligned H2 intro; block pb 40 on every device; drop `fixTrailingMainPadding` if the block padding replaces it                                                                                                                                                             |
| CtaStrip                           | universal    | `heading` + description                         | [B14](../decisions/009-block-intro-and-block-owned-spacing.md#b14-cta-strip-547473965), [D6](../decisions/009-block-intro-and-block-owned-spacing.md#decision): heading → intro; strip stays as built                                                                                                                                                                                                |
| CtaButtons                         | button-cta   | none                                            | [B2](../decisions/009-block-intro-and-block-owned-spacing.md#b2-cta-buttons-543261858-button-cta-intro): buttons stay as built; button group pt 24 / 24 / 32; replaces `OWNS_ITS_SPACING` and the three CTA-pair hacks                                                                                                                                                                               |
| ProfileGrid                        | universal    | `heading`                                       | [B7](../decisions/009-block-intro-and-block-owned-spacing.md#b7-profile-grid-546465604): grid and cards stay as built; drop the tagline `mb-xl`                                                                                                                                                                                                                                                      |
| SplitLayout                        | split-layout | none                                            | [B5](../decisions/009-block-intro-and-block-owned-spacing.md#b5-split-layout-544163402-split-layout-intro), [D7](../decisions/009-block-intro-and-block-owned-spacing.md#decision): columns 60 / 40 (flipped for FAQ accordions), gap 120; media 4:3, radius 24; intro → buttons → media; media padding only with a CTA; button group; new FAQ option in the second column; fix the preview prop gap |
| Agenda                             | universal    | `heading` per day                               | [B4](../decisions/009-block-intro-and-block-owned-spacing.md#b4-agenda-543262257), [D5](../decisions/009-block-intro-and-block-owned-spacing.md#decision): days model and migration; "Day N" + date heading; agenda styles stay as built                                                                                                                                                             |
| InfoCards (grant), GrantFaqSection | universal    | `heading`; `title` + `subtitle` + `description` | single fields                                                                                                                                                                                                                                                                                                                                                                                        |

Not in Figma, so left alone: DonationCards, InternalAdvert, CodeBlock, CalloutText, ReportSection, HackathonAnimation, CtaLink.

### Phase 3: Paragraph block (A3–A5)

Implements [A3](../decisions/009-block-intro-and-block-owned-spacing.md#a3-paragraph-block-headings)–[A5](../decisions/009-block-intro-and-block-owned-spacing.md#a5-paragraph-block-media-image--video-table-list). CSS only, in `src/styles/components/prose/paragraph-block.css`, scoped to `[data-component='Paragraph']`:

1. Zero the `default.css` bottom margins inside the block, and apply the [A3](../decisions/009-block-intro-and-block-owned-spacing.md#a3-paragraph-block-headings)/[A4](../decisions/009-block-intro-and-block-owned-spacing.md#a4-paragraph-block-body) values as padding.
2. H3 and H4 inside the block use the header weight, SemiBold 600 ([A0](../decisions/009-block-intro-and-block-owned-spacing.md#a0-tokens)).
3. Sibling selectors:
   - `> :is(h2,h3,h4):first-child` and `> p:first-child` get the "first" values, only when the block is the first child of the prose container; otherwise the "not first" values.
   - `h2 + p`, `h3 + p`, `h4 + p`, `p + p` get the [A4](../decisions/009-block-intro-and-block-owned-spacing.md#a4-paragraph-block-body) values.
   - Media + p gets the "Image, table or list on top" padding-top (32 / 40 / 60). Media has no padding-bottom, so that padding is the whole gap.
4. Media wrappers `> :is(ul, ol, figure, .table-wrapper, p:has(> img:only-child))` get `padding-block-start: var(--media-pt)` and no padding-bottom. Marked wraps a lone image in a `<p>`.
5. Images, tables and lists stay as built ([D9](../decisions/009-block-intro-and-block-owned-spacing.md#decision)); only their padding-top is new.
6. Block pb `var(--block-pb)`.
7. Delete the `rhythm.css` h2 and fake-intro rules once no content relies on them.
8. Check that the summit and hackathon `[&>h2]` overrides don't conflict.
9. Blog posts are in scope ([D3](../decisions/009-block-intro-and-block-owned-spacing.md#decision)): their Paragraph blocks get the same rules under `[data-prose-blog]`. Zero the `blog.css` margins inside the block the same way, and check a post on its narrow column.
10. Update `src/styles/README.md` and the comment at the top of `rhythm.css`.

### Phase 4: Cleanup

- Remove the legacy fields, the transitional `rhythm.css` rules and unused `--space-block-heading` callers.
- Add a short "every block owns its intro and spacing" section to `CLAUDE.md`.

---

## Verification

- **Tests:** `pnpm test` (`src` suite) and `cd cms && pnpm test` (`cms` suite), plus `test:coverage` in both.
- **New tests per phase:** intro serializer, sync handler, round-trip, BlockIntro rendering and migration scripts.
- **Content checks:**
  - `cd cms && pnpm run check:mdx-filenames`
  - migration `--dry-run` reports
  - `sync:mdx` against a dev Strapi, then confirm the intro and days fields in the Content Manager
- **Build:** `IMAGE_CDN=on pnpm run build`, with no new image-audit or link-validator findings, and no duplicate `<h2>`.
- **Visual:** `pnpm dev` at 375 / 810 / 1440. Measure the gaps against the ADR's [global](../decisions/009-block-intro-and-block-owned-spacing.md#a-global-spec) and [per-block](../decisions/009-block-intro-and-block-owned-spacing.md#b-per-block-spec) specs on:
  - `/our-grantmaking` (fake intro)
  - an FAQ page
  - a NumberTiles page
  - the hackathon timetable (Agenda)
  - a Paragraph-heavy foundation page

  Also check `/page-preview`.

- **Accessibility:**
  - Heading order: page H1 → block H2 → H3 (Agenda day).
  - `aria-labelledby` resolves to the right heading.
  - Focus is visible on FAQ toggles and buttons.
  - The carousel respects `prefers-reduced-motion`.
  - The layout holds at 200% zoom.
