# ADR-009: Every block owns its intro and its spacing

**Status:** Proposed
**Date:** 2026-10-15
**Issue:** INTORG-1154

---

## Context

Spacing between blocks is inconsistent. Each block either has no title or renders one ad hoc, so related content sits behind jarring gaps. To title a block, editors fake an intro with a `<Paragraph>` that ends in `## Heading`, and `prose/rhythm.css` carries dedicated rules (`:has(> h2:last-child)`) just to make that pattern look right.

Today the gaps belong to the container. `--space-section` (64 / 80 / 120) is a margin on every top-level block. Text keeps the 32px prose rhythm, and adjacent margins collapse. Block titles are inconsistent: some blocks use a `title` field, others a `heading`, and they render with different markup.

The approved design (Figma file `Tjtpc6NlHguR9DUcemSVb5`, "ILF New Design") replaces this with two rules:

1. **Every block accepts the same optional intro:** Heading (H2), Subheading (H3) and Description.
2. **Every block owns its spacing:** a top spacer from the intro and a fixed bottom padding. The design also defines how headings, paragraphs and media are spaced inside the Paragraph block.

The designer is explicit: _"between H2, H3 and description, is using spacer containers (not spacing). To be built exactly like this."_ Gaps **add up and never collapse**, which margins cannot express.

The work spans Strapi (schema, serializers, MDX ↔ Strapi sync, content migration) and Astro (components, CSS), so it ships in phases. The phase plan lives in [the task document](../tasks/block-intro-and-paragraph-spacing.md), not here.

All values in this ADR are **Mobile / Tablet / Desktop** in px unless a table says otherwise. Breakpoints are `tablet:` (810) and `desktop:` (1200).

### Figma sources

All designs are in the [ILF New Design](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-74250) Figma file (`Tjtpc6NlHguR9DUcemSVb5`). Each node ID below links to its frame. The master board is **"Spacing Consistency – based on Strapi building model"** ([`5474:74250`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-74250)). It contains everything below:

| Part                                                                                                                              | Node                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intro master ("Standalone accessories")                                                                                           | [`5297:65020`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5297-65020) (component set [`5034:18595`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5034-18595))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| H2 / H3 containers                                                                                                                | [`5298:65102`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5298-65102)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| H4 container                                                                                                                      | [`5353:17361`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5353-17361)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Paragraph body                                                                                                                    | [`5034:18528`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5034-18528) (component set [`5033:17962`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5033-17962))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| H1 (hero only)                                                                                                                    | [`5432:61853`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5432-61853)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Block sub-components (image, table, list, …)                                                                                      | [`5420:28545`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5420-28545)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Q&A with design                                                                                                                   | [`5392:27351`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5392-27351)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Strapi blocks** (section [`5474:74127`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-74127)) | Paragraph [`5420:28552`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5420-28552), CTA buttons [`5432:61858`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5432-61858), Image/Video [`5431:42614`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5431-42614), Agenda [`5432:62257`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5432-62257), Split layout [`5441:63402`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5441-63402), Quote [`5466:66281`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5466-66281), Blockquote [`5467:66429`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5467-66429), Profile Grid [`5464:65604`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5464-65604), PDF [`5468:66900`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5468-66900), FAQ [`5474:71806`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-71806), Number tiles [`5471:67951`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5471-67951), Card Grid [`5474:68122`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-68122), Logo carousel [`5474:71790`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-71790), Event card [`5474:73345`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-73345), CTA strip [`5474:73965`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-73965) |

---

## Decision

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| D1  | **Data model.** A shared Strapi component `shared.block-intro` = `{ heading: string, subheading: string, description: CKEditor basicMarkdown }`, added as an optional `intro` field on each block. It is serialized to MDX as one `intro={{…}}` prop. Existing `title`/`heading` values migrate into `intro.heading`.                                                                                                                                                                                                                                                                    | Agreed                             |
| D2  | **Spacing ownership.** A block whose root carries `data-intro-variant` owns its top (the intro) and its bottom (`--block-pb`, [A2](#a2-block-padding-bottom-every-block-including-paragraph)). It sits out the `--space-section` rhythm, both in `prose/rhythm.css` and in the Strapi preview (`DynamicZone.astro`). All spacers are padding, never margin.                                                                                                                                                                                                                              | Agreed                             |
| D3  | **Paragraph spec scope.** The paragraph rules ([A3](#a3-paragraph-block-headings)–[A5](#a5-paragraph-block-media-image--video-table-list)) apply only to `[data-component='Paragraph']`, on every template, blog posts included. Blog posts also use the block frame and intro like any page. Markdown outside a Paragraph block and profile (`.max-w-narrow`) running text are untouched.                                                                                                                                                                                               | Agreed (blog in scope, 2026-10-22) |
| D4  | **Rollout.** Blocks adopt the intro one at a time, piloting on CardGrid, FAQ and NumberTiles. While pages mix migrated and legacy blocks, transitional rules keep the gap between the two kinds at `--space-section` (see below).                                                                                                                                                                                                                                                                                                                                                        | Agreed                             |
| D5  | **Agenda days.** Agenda gets `intro` plus a repeatable `days: blocks.agenda-day = { date: date, items: agenda-item[] }`. "Day N" is rendered from the index (an i18n string), not stored. Editors pick the date with Strapi's native date picker. Consecutive per-day Agenda blocks are merged into one by migration.                                                                                                                                                                                                                                                                    | Pending sign-off                   |
| D6  | **CTA strip.** `heading` moves into `intro.heading`. The strip keeps its own `description` (the in-strip copy) and buttons.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Proposed                           |
| D7  | **Split layout.** Split layout gets `intro`. The first column becomes intro + an optional button group (primary + secondary, replacing the single `cta`). The media is always 4:3. The second column holds media, or a list of FAQ accordions, which flips the column widths ([B5](#b5-split-layout-544163402-split-layout-intro)). The FAQ option is new to the Strapi model.                                                                                                                                                                                                           | Pending sign-off                   |
| D8  | **Blockquote `source`.** Blockquote keeps its Strapi structure, `source` included, and its current rendering. Only the spacing rules change (designer, 2026-10-16).                                                                                                                                                                                                                                                                                                                                                                                                                      | Agreed                             |
| D9  | **Spacing only, existing components unchanged.** This work is about spacing consistency between and within sections, around components that are already built and documented. Every block component and every paragraph sub-component (image, table, list) keeps its current implementation. Figma uses them as placeholders to show the spacing, so their drawings are not a restyle (designer, 2026-10-16). The only structural changes are the ones the design asks for explicitly: the intro (D1), the Agenda days (D5), the CTA strip heading (D6) and the Split layout rules (D7). | Agreed                             |

### How spacing ownership works

- **Tokens.** `src/styles/base/variables.css` defines `--intro-top`, `--intro-h2-pt`, `--intro-h2-h3`, `--intro-h3-pt`, `--intro-h3-desc`, `--intro-desc`, `--block-pb` and `--media-pt`, per breakpoint, from the existing spacing tokens. They are declared on `:root` and again on every `[data-intro-variant]`, so a nested block starts from the defaults. Variants override only what differs ([A1](#a1-intro-every-block)).
- **Intro.** `src/components/shared/BlockIntro.astro` renders a `<header>` with the h2, h3 and description. Each spacer is padding on the element above it, so it disappears with that element. An empty intro renders nothing.
- **Block.** `[data-intro-variant]` gets `padding-block-end: var(--block-pb)` (`components/block-intro.css`). At the end of the prose that padding drops, like the trailing margins today.
- **Mixed pages (transitional).** A legacy element before an intro block keeps only `--block-pb` below it. A legacy element after one takes `--space-section − --block-pb` above it. Both rules reach across the `<script>` Astro emits after a component, and CTAs apply the same rule through a utility. On desktop, with a heading in the intro, every pair of blocks therefore stays 120 apart. These rules are deleted once every block owns its spacing.

### A. Global spec

#### A0. Tokens

All the typography tokens already exist in `src/styles/theme.css`. Bare `h1`–`h4` pick them up from `reset.css`.

| Style                     | Mobile | Tablet | Desktop | Weight                               |
| ------------------------- | ------ | ------ | ------- | ------------------------------------ |
| H1 (hero only)            | 40/48  | 56/64  | 76/84   | 700                                  |
| H2                        | 32/40  | 40/48  | 56/64   | 600                                  |
| H3                        | 24/32  | 28/36  | 40/48   | 500; **600** as a header (see below) |
| H4                        | 20/30  | 22/32  | 28/40   | 500; **600** as a header (see below) |
| Body / description ("H5") | 18/28  | 18/28  | 20/30   | 400                                  |
| body-lg                   | 16/26  | 16/26  | 16/26   | 400 / 600                            |
| body-sm                   | 14/22  | 14/22  | 14/22   | 400                                  |

**Header weight (Figma, 2026-10-21).** Headings drawn as headers, the intro subheading and the Paragraph block's H3 and H4, use Figma's "H3 (for header)" and "H4 (for header)" styles. These are the same sizes in **SemiBold (600)**. The global H3 and H4 tokens stay Medium (500) for the components that use them, such as card titles and FAQ questions. In code, `font-semibold` sits on those headings: `BlockIntro` now, and the Paragraph block in Phase 3.

Colours:

| Use                         | Token         | Hex     |
| --------------------------- | ------------- | ------- |
| Headings                    | `neutral-900` | #000    |
| Body and description        | `neutral-100` | #292929 |
| **List text** (intentional) | `neutral-150` | #0d0d0d |
| Quote text and some labels  | `neutral-75`  | #595959 |

Breakpoints are `tablet:` (810) and `desktop:` (1200).

Figma padding names map to the project's spacing tokens like this (Figma name → value → project token):

| Figma | Value | Project token   |
| ----- | ----- | --------------- |
| xs    | 4     | `xs`            |
| sm    | 8     | `sm`            |
| md    | 12    | `md`            |
| lg    | 16    | `lg`            |
| xl    | 24    | `xl`            |
| 2xl   | 32    | `2xl`           |
| 3xl   | 40    | **`3xl-tight`** |
| 4xl   | 60    | `4xl`           |
| 5xl   | 80    | `5xl`           |
| 6xl   | 120   | `6xl`           |

No new spacing tokens are needed.

#### A1. Intro (every block)

Stack, top to bottom:

`top spacer → H2 (pt) → H2→H3 spacer → H3 (pt) → H3→desc spacer → description → description spacer → block content → block padding-bottom`

|                                                     | Mobile | Tablet | Desktop |
| --------------------------------------------------- | ------ | ------ | ------- |
| Top spacer (renders whenever the intro has content) | 24     | 32     | 40      |
| H2 padding-top                                      | 24     | 32     | 40      |
| H2→H3 spacer (with H2)                              | 40     | 48     | 60      |
| H3 padding-top                                      | 16     | 24     | 32      |
| H3→desc spacer (with H3)                            | 24     | 32     | 40      |
| Description spacer (with description)               | 24     | 32     | 60      |

The real distance from the top of the block to the H2 text is the top spacer plus the H2 padding-top: **48 / 64 / 80**.

Variant overrides:

| Variant          | Used by                                                                                                         | Differences from the table above                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Universal**    | PDF, Number tiles, Quote, Blockquote, Event card, Card Grid, Logo carousel, FAQ, CTA strip, Image/Video, Agenda | none                                                              |
| **Button CTA**   | CTA buttons block                                                                                               | description spacer **0**                                          |
| **Profile Grid** | Profile Grid                                                                                                    | none; same values as Universal since the latest pass              |
| **Split layout** | Split layout                                                                                                    | desktop: top spacer **0**, H2→H3 **40**, description spacer **0** |

Rules:

- An intro with all three fields empty renders nothing, not even the top spacer.
- Heading is always `<h2>` and Subheading always `<h3>`. Visual size stays tied to the level.
- An intro with only a subheading renders it as `<h3>`, never promoted to `<h2>`. The editor decides the content and is told about the skipped level (designer, 2026-10-16). The same goes for a Paragraph that starts with an H3.
- The description is rich text: paragraphs, links and bold.

#### A2. Block padding-bottom (every block, including Paragraph)

**24 / 32 / 40**, confirmed by design. This is the minimum spacing a block owns even when it has no intro.

Gap between two blocks, from the end of one block's content to the next block's H2 text: pb + top spacer + H2 pt = **72 / 96 / 120**. Desktop equals today's `--space-section` (120).

#### A3. Paragraph block: headings

| Element | Context           | Mobile pt/pb | Tablet pt/pb | Desktop pt/pb |
| ------- | ----------------- | ------------ | ------------ | ------------- |
| H2      | first in the flow | 60 / 12      | 80 / 16      | 120 / 24      |
| H2      | not first         | 40 / 12      | 60 / 16      | 80 / 24       |
| H3      | first             | 60 / 8       | 80 / 12      | 120 / 16      |
| H3      | not first         | 24 / 8       | 32 / 12      | 40 / 16       |
| H4      | first             | 60 / 4       | 80 / 8       | 120 / 12      |
| H4      | not first         | 16 / 4       | 24 / 8       | 32 / 12       |

- **"First"** means nothing sits above it in the flow, which is the top of the content. A heading after any block, including another Paragraph block, uses "not first", because that block's padding-bottom (40) supplies the rest: 40 + 80 = 120.
- **Stacked headings** need no special rule. They add up, e.g. H2 → H2 = 24 + 80 = 104.

#### A4. Paragraph block: body

Padding-bottom is **8 / 12 / 16**. Paragraphs inside one container stack with gap 16. Padding-top depends on what is directly above:

| Above                                   | Mobile | Tablet | Desktop |
| --------------------------------------- | ------ | ------ | ------- |
| nothing (block starts with a paragraph) | 60     | 80     | 120     |
| H2                                      | 24     | 32     | 40      |
| H3                                      | 16     | 24     | 32      |
| H4                                      | 12     | 16     | 24      |
| Paragraph                               | 16     | 24     | 32      |
| Image, table or list                    | 32     | 40     | 60      |

Resulting desktop gaps:

| Transition | Calculation | Gap                                           |
| ---------- | ----------- | --------------------------------------------- |
| H2 → p     | 24 + 40     | 64                                            |
| H3 → p     | 16 + 32     | 48                                            |
| H4 → p     | 12 + 24     | 36                                            |
| **p → p**  | 16 + 32     | **48** (today 32: an intended visible change) |
| p → H2     | 16 + 80     | 96                                            |
| media → p  | 0 + 60      | 60                                            |

#### A5. Paragraph block: media (image / video, table, list)

These are "used under a paragraph" sub-components ([`5420:28545`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5420-28545)).

|                          | Mobile | Tablet | Desktop |
| ------------------------ | ------ | ------ | ------- |
| Container padding-top    | 24     | 32     | **60**  |
| Container padding-bottom | 0      | 0      | 0       |

- Media inside a paragraph has **no padding-bottom** (designer, 2026-10-16). What follows supplies the whole gap: a paragraph uses its "Image, table or list on top" padding-top ([A4](#a4-paragraph-block-body), 32 / 40 / 60), and a heading uses its "not first" padding-top ([A3](#a3-paragraph-block-headings)).
- The image, table and list themselves stay as built (D9), including the triangle list bullets and horizontal table scroll on mobile. Only their padding-top is new.

#### A6. H1 (hero only), [`5432:61853`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5432-61853)

Padding-top / padding-bottom:

|            | Mobile  | Tablet  | Desktop |
| ---------- | ------- | ------- | ------- |
| H1 pt / pb | 24 / 12 | 32 / 16 | 40 / 24 |

- **Content starts the same way under every hero**, with or without an image (designer, 2026-10-16). The gap between the hero (or a bare H1) and the first block is **0**. The perceived space comes only from the first block's own top: its intro's top spacer, or the "first" padding-top of the Paragraph's first element ([A3](#a3-paragraph-block-headings), [A4](#a4-paragraph-block-body)). For example, a page whose first block is a Paragraph starting with an H2 uses H2 "first" (60 / 80 / 120).
- **Hero body text** after the H1 uses the H4 container spacing with Start=No ([A3](#a3-paragraph-block-headings): pt 16 / 24 / 32, pb 4 / 8 / 12). The paragraph variant "H1 on top" is removed (designer, 2026-10-16). Figma doesn't draw a hero body, so its text style stays as built.

### B. Per-block spec

Each block below is: Universal intro ([A1](#a1-intro-every-block)), then its content, then pb 24 / 32 / 40 ([A2](#a2-block-padding-bottom-every-block-including-paragraph)), unless noted. The content itself stays as built (D9). Figma anomalies are listed under [Open design items](#open-design-items-2026-10-16), not repeated here.

#### B1. Paragraph ([`5420:28552`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5420-28552))

- [A3](#a3-paragraph-block-headings)–[A5](#a5-paragraph-block-media-image--video-table-list) apply.
- Six examples are drawn: H2/H3/H4 nesting, H2-p-H3-p-p, H2-p-H2-p, plus image, table and list variants.

#### B2. CTA buttons ([`5432:61858`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5432-61858)), Button CTA intro

- The buttons stay as built.
- The button group sits pt 24 / 24 / 32 below the intro, with gap 24, side by side on tablet and desktop and stacked full width on mobile. When the intro is only a heading, the button group has no top padding: the H2 spacer is the gap (designer, 2026-10-19).
- The Button CTA intro has no description spacer ([A1](#a1-intro-every-block)).

#### B3. Image / Video embed ([`5431:42614`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5431-42614))

- One block covers ImageBlock and VideoEmbed. The media stays as built.

#### B4. Agenda ([`5432:62257`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5432-62257))

- **Day heading:** "Day N", then the date. Semantically an `<h3>`.
- **"Day N" is not editable.** It is numbered automatically from 1, in order. **The date is the editable field**, ideally a date picker (designer). See D5.
- The agenda styles stay as built, apart from the day heading (designer, 2026-10-16).

#### B5. Split layout ([`5441:63402`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5441-63402)), Split layout intro

**Desktop:** 2 columns, gap **120** in every variant, with or without a CTA (designer, 2026-10-16; was 60).

| Second column holds | First column (intro + buttons) | Second column |
| ------------------- | ------------------------------ | ------------- |
| Media               | full width, max **60%**        | max **40%**   |
| FAQ accordions      | max **40%**                    | max **60%**   |

- The intro column is top-aligned. A media column is vertically centred; an FAQ column is top-aligned.
- Media is on the right, and its aspect ratio is **4:3**, the only ratio for now.
- **FAQ variant** ([`5487:82409`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5487-82409), with CTA [`5487:82525`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5487-82525)): the second column holds the existing FAQ component (D9), unchanged. Only desktop is drawn.

**Tablet and mobile:** stacked, in the order **intro → buttons → media**, or **intro → buttons → FAQ** for the FAQ variant.

**Details:**

- Media: radius 24. **Only with a CTA**, the media sits in a wrapper with the paragraph-media padding (desktop pt 60 / pb 40, tablet py 32, mobile py 24). Without a CTA there is no wrapper.
- Buttons: as in B2.
- The Split layout intro variant drops the top and description spacers on desktop and uses a 40 H2→H3 spacer. On tablet and mobile it matches Universal. Both are intentional ([A1](#a1-intro-every-block)).
- **Figma is not the reference for widths and ratios here.** It can't express percentages, so its columns (`1fr 0.75fr`) and image sizes don't match. Follow the rules above. The 1px black border on the CTA image wrappers only highlights the padding; it is not part of the design.

#### B6. Quote ([`5466:66281`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5466-66281)) and Blockquote ([`5467:66429`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5467-66429))

- Both stay as built (D9). The Figma Blockquote frame is the Quote with the author removed. Ignore it and use the Blockquote that is already implemented, `source` included (D8).
- Both follow the same padding rules: the Universal intro and block pb 24 / 32 / 40.

#### B7. Profile Grid ([`5464:65604`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5464-65604))

- The grid and cards stay as built. Only the Universal intro and the block spacing change.

#### B8. PDF embed ([`5468:66900`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5468-66900))

- There is no design for the PDF embed. The Figma frame is a placeholder.
- Build it without design, using what is standard: **both the frame and its content are responsive**.

#### B9. FAQ ([`5474:71806`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-71806))

- The FAQ component stays as built: states, items and content are unchanged.

#### B10. Number tiles ([`5471:67951`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5471-67951))

- The tiles stay as built on every device.

#### B11. Card Grid ([`5474:68122`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-68122))

- The grid and cards stay as built. The block uses the Universal intro on every device.

#### B12. Logo carousel ([`5474:71790`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-71790))

- The carousel stays as built. The desktop border-top drawn in Figma is not meant to be there.
- The heading moves into the Universal intro, left-aligned like every other block (it was centred).
- **No side padding of its own:** the carousel runs the full width of the content column, like the other blocks (designer, 2026-10-19). The homepage carousel, outside the block system, keeps its gutters.
- Block pb is **40 on every device**, on purpose. With the core's own pb that leaves 80 below the ticker.

#### B13. Event card ([`5474:73345`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-73345))

- The event card stays as built.

#### B14. CTA strip ([`5474:73965`](https://www.figma.com/design/Tjtpc6NlHguR9DUcemSVb5/ILF-New-Design?node-id=5474-73965))

- **The heading moves out of the strip, into the intro above it** (D6).
- The strip itself (copy, buttons, background, motif) stays as built.

---

## Alternatives considered

- **Keep container-owned margins (`--space-section`) and add a heading to each block.** Rejected. Margins collapse, so the stacked spacers the design specifies (top spacer + H2 padding + H2→H3 spacer…) can't be expressed. The fake-intro rules in `rhythm.css` show how much special-casing that model already needs.
- **A standalone "Intro" block placed before any block.** This is the fake-intro pattern made official. Rejected: the intro and its content would be two blocks, so the editor can separate them, and the gap between them stays a rhythm problem instead of belonging to one block.
- **Per-block heading fields, each block rendering its own title.** This is the status quo (`title` on some blocks, `heading` on others). Rejected: it gives inconsistent markup and spacing, and no subheading or description.
- **One global rhythm rewrite for all prose, profile included.** Rejected for now (D3). The paragraph spec is drawn for the Paragraph block only. Blog posts get it through their Paragraph blocks; a blog body written as plain Markdown, and the profile template, keep their own rhythm.
- **Migrate every block in one release.** Rejected (D4). Each block touches schema, serializer, sync handler, component and content, so a phased rollout with transitional rules keeps each change reviewable.

---

## Consequences

**Positive**

- One intro component, one data shape and one set of tokens for every block. Editors stop faking intros.
- Gaps are predictable and match the design: 72 / 96 / 120 from block to block, heading included.
- Blocks are self-contained, so a block renders the same in the MDX page and the Strapi preview.

**Negative / costs**

- Every block needs a schema change, serializer, sync handler, component change and a content migration. Legacy `title`/`heading` fields live alongside `intro` until each migration has run on staging and production.
- During the rollout, mixed pages depend on transitional CSS, and `SELF_SPACED_BLOCKS` must be kept in step with the components by hand. A few edge cases differ from the target. A fake-intro Paragraph before an intro block gives 128 on desktop, and an intro block with an empty intro sits 40 below a legacy one.
- The paragraph spec changes visible spacing on every rich-text page. For example, p → p becomes 48 on desktop, up from 32.
- Under the hero the gap becomes 0, and the first block supplies its own top. The templates' current gap below the hero or bare H1 (for example `mb-2xl tablet:mb-3xl` on the hero-less H1) has to go, or it stacks on that top.

---

## Open design items (2026-10-16)

### Resolved with design

- ~~Top spacer~~: 40 / 32 / 24, and the master is updated.
- ~~Paragraph block pb~~: 24 / 32 / 40.
- ~~H1 variant names~~: fixed.
- ~~List text #0d0d0d~~: intentional.
- ~~Agenda "Day N"~~: automatic, with the date editable.
- ~~E-Q1 Paragraph examples 4–5, tablet pb~~: fixed to 32.
- ~~E-Q2 Paragraph after media~~: "Image, table or list on top" stays (32 / 40 / 60), and media in a paragraph now has pb 0.
- ~~E-Q3 Paragraph examples 5–6, mobile~~: fixed to the Mobile variant.
- ~~E-Q4 Agenda tablet day heading~~: fixed, 22/32.
- ~~E-Q5 Number tiles~~: the tiles stay as built (D9).
- ~~E-Q7 Content under the hero~~: the gap is 0 and the first block supplies its own top ([A6](#a6-h1-hero-only-543261853)).
- ~~E-Q8 Mobile pb~~: Quote, Blockquote and Split layout fixed to 24. Logo carousel's 40 on every device is on purpose.
- ~~E-Q9 Blockquote attribution~~: `source` stays; Blockquote is an existing component with Quote's padding rules (D8).
- ~~E-Q10 Profile Grid~~: the intro is Universal now and the grid rules stay as built (D9).
- ~~E-Q11 Split layout~~: order is intro → buttons → media; media padding only with a CTA; 4:3 only; columns 60 / 40 with gap 60, flipped for FAQ accordions ([B5](#b5-split-layout-544163402-split-layout-intro)). Figma's widths and ratios are not the reference.
- ~~E-Q12 PDF embed~~: no design; responsive frame and content.
- ~~E-Q13 FAQ~~, ~~E-Q14 Event card~~, ~~E-Q15 Logo carousel~~: existing components, unchanged (D9).
- ~~E-Q16 Split layout description spacer~~: intentional.
- ~~E-Q18 Card Grid and Profile Grid mobile intro~~: fixed to Universal / Mobile. Cards stay as built (D9).
- ~~E-Q19 "H1 on top"~~: removed. The hero body uses the H4 container with Start=No ([A6](#a6-h1-hero-only-543261853)).
- ~~E-Q20 Split layout widths and ratio~~: follow the stated rules, not Figma. FAQ variant exists in production. Ignore the 1px border.
- ~~E-Q21 Quote~~ and ~~E-Q22 paragraph table~~: existing components, unchanged (D9).
- ~~E-Q20 Split layout mobile pb without CTA~~: fixed to 24.
- ~~E-Q23 Agenda~~: styles stay as built; only the day heading changes.
- ~~E-Q24 Split layout gap and FAQ stacking~~: 120 on every desktop frame, CTA included. The FAQ variant stacks like the media one on tablet and mobile: intro → buttons → FAQ.

### Still open

1. **E-Q17. Canvas details (no action):**
   - Spacer layers are named "Spacer between H1 & H2" but sit between H2 and H3.
   - Some spacers have opacity equal to their height (60%, 48%).
   - Several layers are named `his`.
   - Paragraph block: the mobile row label still reads "padding 32" (blocks measure 24), list containers are named "Table container", and tablet example 4 reads "H2 H eading".
   - Card Grid tablet and mobile frames are 597 and 310 wide, and the Profile Grid desktop frame is 1420.
