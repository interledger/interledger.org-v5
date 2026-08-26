/**
 * Flags a <br> left in a field that renders through `marked`
 * (src/utils/main/mdx.ts), which escapes it to plaintext instead of a line
 * break. These fields should use \n (soft enter) / \n\n (real enter)
 * instead — see cms/src/utils/mdx.ts's ckeditorBreaksToNewlines, which
 * converts a CKEditor field's <br>/<br><br> to that convention on export.
 * A <br> surviving into one of these fields means either stale/pre-fix
 * content, or the CMS export that produced it needs a restart to pick up
 * a code change.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const CONTENT_ROOT = path.join(process.cwd(), 'src/content')

const BR_TAG = /<br\b[^>]*>/i
// `escDouble` HTML-entity-encodes a JSX attribute value, so a leftover <br>
// in blockquote/splitLayout's attribute fields shows up entity-encoded.
const BR_ENTITY = /&lt;br\b[^&]*&gt;/i

interface Violation {
  file: string
  fieldPath: string
  snippet: string
}

type FieldHit = Omit<Violation, 'file'>

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function snippetAround(value: string): string {
  const match = BR_TAG.exec(value) ?? BR_ENTITY.exec(value)
  if (!match) return value.slice(0, 60)
  const start = Math.max(0, match.index - 20)
  return value.slice(start, match.index + match[0].length + 20)
}

function checkField(fieldPath: string, value: unknown): FieldHit | undefined {
  const text = str(value)
  if (!text) return undefined
  if (!BR_TAG.test(text) && !BR_ENTITY.test(text)) return undefined
  return { fieldPath, snippet: snippetAround(text) }
}

function listMdxFiles(dir: string, exclude: string[] = []): string[] {
  const full = path.join(CONTENT_ROOT, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full, { recursive: true })
    .filter(
      (entry): entry is string =>
        typeof entry === 'string' &&
        entry.endsWith('.mdx') &&
        !exclude.some((skip) => entry.startsWith(`${skip}${path.sep}`))
    )
    .map((entry) => path.join(full, entry))
}

function relative(file: string): string {
  return path.relative(process.cwd(), file)
}

function hits(...values: Array<FieldHit | undefined>): FieldHit[] {
  return values.filter((hit): hit is FieldHit => hit !== undefined)
}

// Known fields whose value is parsed by `marked` at render time, per content
// type — see the field-split table in cms/src/utils/mdx.ts and the Astro
// components that call parseMarkdown/parseMarkdownInline on them.
const FRONTMATTER_SCANS: Array<{
  dir: string
  scan: (data: Record<string, unknown>) => FieldHit[]
}> = [
  {
    dir: 'grant-pages',
    scan: (data) =>
      hits(
        checkField('programOverview', data.programOverview),
        ...arr(obj(data.infoCards).cards).map((card, i) =>
          checkField(`infoCards.cards[${i}].body`, obj(card).body)
        ),
        ...arr(obj(data.faqSection).items).map((item, i) =>
          checkField(`faqSection.items[${i}].answer`, obj(item).answer)
        ),
        checkField('ctaStrip.description', obj(data.ctaStrip).description)
      )
  },
  {
    dir: 'grant-overview-pages',
    scan: (data) =>
      hits(
        checkField('followUpContent', data.followUpContent),
        checkField('ctaStrip.description', obj(data.ctaStrip).description)
      )
  },
  {
    dir: 'podcast-pages',
    scan: (data) =>
      hits(
        checkField('textSection', data.textSection),
        ...arr(obj(data.titleCards).cards).map((card, i) =>
          checkField(
            `titleCards.cards[${i}].description`,
            obj(card).description
          )
        ),
        checkField('ctaStrip.description', obj(data.ctaStrip).description)
      )
  },
  {
    dir: 'faqs',
    scan: (data) =>
      hits(
        checkField('introParagraph', data.introParagraph),
        ...arr(data.faqSections).flatMap((section, si) =>
          arr(obj(section).items).map((item, ii) =>
            checkField(
              `faqSections[${si}].items[${ii}].answer`,
              obj(item).answer
            )
          )
        )
      )
  }
]

// blockquote's `source` and splitLayout's `quoteSource` are also parsed by
// `marked` (parseMarkdownInline) despite living in the MDX body as JSX
// attributes, not YAML frontmatter — see those two serializers. They can
// appear on any page's dynamic-zone content, so every .mdx file is scanned.
//
// Both regexes assume the double-quoted attribute shape `esc`/`escDouble`
// currently produces in those serializers — if either ever switches to
// escSingle, these patterns need updating too or violations there go
// undetected.
const BODY_ATTR_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  {
    label: '<Blockquote> source attribute',
    regex: /<Blockquote\b[^>]*\bsource="([^"]*)"/g
  },
  {
    label: '<SplitLayout> quoteSource attribute',
    regex: /<SplitLayout\b[^>]*\bquoteSource="([^"]*)"/g
  }
]

function scanBodyAttributes(body: string): FieldHit[] {
  return BODY_ATTR_PATTERNS.flatMap(({ label, regex }) =>
    hits(
      ...Array.from(body.matchAll(regex)).map((match, i) =>
        checkField(`${label}[${i}]`, match[1])
      )
    )
  )
}

describe('no leftover <br> in marked-parsed content', () => {
  it('has no <br> in fields that render through `marked`', () => {
    const frontmatterViolations = FRONTMATTER_SCANS.flatMap(({ dir, scan }) =>
      listMdxFiles(dir).flatMap((file) => {
        const { data } = matter(fs.readFileSync(file, 'utf-8'))
        return scan(data).map((hit) => ({ file: relative(file), ...hit }))
      })
    )

    // docs/ is Starlight content, never synced from Strapi — skip it.
    const bodyAttrViolations = listMdxFiles('.', ['docs']).flatMap((file) => {
      const { content } = matter(fs.readFileSync(file, 'utf-8'))
      return scanBodyAttributes(content).map((hit) => ({
        file: relative(file),
        ...hit
      }))
    })

    const violations: Violation[] = [
      ...frontmatterViolations,
      ...bodyAttrViolations
    ]

    const report = violations
      .map((v) => `  ${v.file} — ${v.fieldPath}: "...${v.snippet}..."`)
      .join('\n')

    expect(
      violations,
      '`marked` escapes <br> to plaintext instead of rendering a line ' +
        'break — use \\n (soft enter) / \\n\\n (real enter) in these ' +
        `fields instead:\n${report}`
    ).toEqual([])
  })
})
