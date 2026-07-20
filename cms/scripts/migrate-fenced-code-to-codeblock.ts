#!/usr/bin/env node

/**
 * Migrate raw markdown fenced code blocks in foundation blog MDX into
 * <CodeBlock> components, so they render through the styled component instead
 * of falling through to default highlighting.
 *
 * This is a targeted rewrite: only fenced `code` nodes are replaced. All other
 * bytes (frontmatter, prose, other components) are preserved verbatim, keeping
 * the diff minimal and reviewable.
 *
 * Usage (from repo root):
 *   pnpm --dir cms tsx scripts/migrate-fenced-code-to-codeblock.ts [--dry-run]
 *
 * INTORG-943
 */

import fs from 'fs'
import path from 'path'
import { remark } from 'remark'
import { visit } from 'unist-util-visit'
import { escDouble } from '../src/serializers/shared'
import { serialize as serializeCodeBlock } from '../src/serializers/blocks/code-block.serializer'

/** Minimal shape of an mdast fenced/indented code node (cms lacks @types/mdast). */
interface CodeNode {
  type: 'code'
  lang?: string | null
  meta?: string | null
  value: string
  position?: {
    start: { offset?: number; column?: number }
    end: { offset?: number }
  }
}

const DRY_RUN = process.argv.includes('--dry-run')

const BLOG_DIR = path.resolve(
  __dirname,
  '../../src/content/foundation-blog-posts'
)

const DEFAULT_LANGUAGE = 'text'
const TITLE_META_RE = /title="([^"]*)"/

/**
 * Fence info-string language -> Code Block component enum value. Keeps Shiki
 * aliases (ts, gql, …) and languages the component supports in sync with the
 * enum in cms/src/components/blocks/code-block.json.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  typescript: 'typescript',
  js: 'javascript',
  javascript: 'javascript',
  jsx: 'jsx',
  tsx: 'tsx',
  html: 'html',
  css: 'css',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  bash: 'bash',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  py: 'python',
  python: 'python',
  rs: 'rust',
  rust: 'rust',
  go: 'go',
  golang: 'go',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
  php: 'php',
  java: 'java',
  ini: 'ini',
  gql: 'graphql',
  graphql: 'graphql',
  http: 'http',
  nginx: 'nginx',
  xml: 'xml',
  webidl: 'webidl',
  text: 'text',
  plaintext: 'text',
  txt: 'text'
}

interface FenceReplacement {
  start: number
  end: number
  replacement: string
}

/**
 * A fenced code block indented inside a container (list item / blockquote) can't
 * become a multi-line JSX expression: its continuation lines fall outside the
 * container and break MDX parsing, and indenting them would corrupt the code.
 * For those, emit a single physical line with a `\n`-escaped string literal
 * (which the sync parser also accepts). Top-level fences keep the readable
 * multi-line template-literal form produced by the shared serializer.
 */
function buildSingleLineCodeBlock(
  code: string,
  language: string,
  title?: string
): string {
  const attrs = [`language="${escDouble(language)}"`]
  if (title) attrs.push(`title="${escDouble(title)}"`)
  attrs.push(`code={${JSON.stringify(code)}}`)
  return `<CodeBlock ${attrs.join(' ')} />`
}

/**
 * Byte ranges of `<Paragraph>…</Paragraph>` wrappers (tags on their own line,
 * as the serializer emits them). A `<CodeBlock>` can't be nested inside a
 * Paragraph block, so fences landing inside one are split out (see below).
 */
function findParagraphRegions(body: string): Array<[number, number]> {
  const tagRe = /^(<Paragraph>|<\/Paragraph>)[ \t]*$/gm
  const openStack: number[] = []
  const regions: Array<[number, number]> = []
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(body)) !== null) {
    if (m[1] === '<Paragraph>') {
      openStack.push(m.index)
    } else {
      const open = openStack.pop()
      if (open != null) regions.push([open, m.index + m[0].length])
    }
  }
  return regions
}

const isInsideParagraph = (
  regions: Array<[number, number]>,
  offset: number
): boolean => regions.some(([open, close]) => offset > open && offset < close)

/**
 * Collect fenced-code replacements for one MDX body. Returns an empty array
 * when the body has no fenced code. Indented code blocks are left untouched.
 */
function collectReplacements(body: string): FenceReplacement[] {
  const tree = remark().parse(body)
  const paragraphRegions = findParagraphRegions(body)
  const replacements: FenceReplacement[] = []

  visit(tree, 'code', (visited) => {
    const node = visited as unknown as CodeNode
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start == null || end == null) return

    // Skip indented code blocks — only convert real fences.
    const rawFence = body.slice(start, end)
    if (!/^(```|~~~)/.test(rawFence)) return

    const rawLang = (node.lang ?? '').trim().toLowerCase()
    const language = LANGUAGE_ALIASES[rawLang] ?? DEFAULT_LANGUAGE
    if (rawLang && !LANGUAGE_ALIASES[rawLang]) {
      console.warn(
        `   ⚠️  unmapped language "${rawLang}" → falling back to "${DEFAULT_LANGUAGE}"`
      )
    }

    // Collapse blank lines inside the code. Prettier's MDX parser treats a
    // blank line in a multi-line `code={`…`}` template literal as a block break
    // and corrupts the tail (escapes `*`, drops indentation). Removing blank
    // lines keeps the block prettier-safe. See CODE_BLOCK note in cms/README.md.
    const code = node.value.replace(/\n(?:[ \t]*\n)+/g, '\n')

    const title = node.meta?.match(TITLE_META_RE)?.[1]
    const isNested = (node.position?.start.column ?? 1) > 1
    const codeBlock = isNested
      ? buildSingleLineCodeBlock(code, language, title)
      : serializeCodeBlock({ code, language, title })

    // A fence inside a <Paragraph> wrapper must become a sibling block:
    // close the paragraph before it and reopen after. Empty halves are
    // pruned later by stripEmptyParagraphs.
    const replacement = isInsideParagraph(paragraphRegions, start)
      ? `</Paragraph>\n\n${codeBlock}\n\n<Paragraph>`
      : codeBlock
    replacements.push({ start, end, replacement })
  })

  return replacements
}

/** Remove empty `<Paragraph></Paragraph>` pairs left by paragraph splitting. */
const stripEmptyParagraphs = (body: string): string =>
  body.replace(/<Paragraph>\s*<\/Paragraph>\n*/g, '')

/** Apply replacements to the body from last to first so offsets stay valid. */
function applyReplacements(
  body: string,
  replacements: FenceReplacement[]
): string {
  return [...replacements]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (acc, { start, end, replacement }) =>
        acc.slice(0, start) + replacement + acc.slice(end),
      body
    )
}

/**
 * Split an MDX file into its raw frontmatter header (including `---` delimiters
 * and trailing newline) and the body. Preserves frontmatter byte-for-byte.
 */
function splitFrontmatterAndBody(raw: string): {
  header: string
  body: string
} {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)
  if (!match) return { header: '', body: raw }
  return { header: match[0], body: raw.slice(match[0].length) }
}

/** Recursively collect .md/.mdx files so localized subfolders (es/) are covered. */
function collectMarkdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectMarkdownFiles(full)
    return /\.mdx?$/.test(entry.name) ? [full] : []
  })
}

function main() {
  console.log('📝 Fenced code → <CodeBlock> migration')
  console.log('='.repeat(50))
  if (DRY_RUN) console.log('🔍 DRY-RUN MODE — no files will be written\n')

  const files = collectMarkdownFiles(BLOG_DIR).sort()

  let migrated = 0
  let totalBlocks = 0

  for (const filepath of files) {
    const file = path.relative(BLOG_DIR, filepath)
    const raw = fs.readFileSync(filepath, 'utf-8')
    const { header, body } = splitFrontmatterAndBody(raw)

    const replacements = collectReplacements(body)
    if (replacements.length === 0) continue

    totalBlocks += replacements.length
    migrated++

    if (DRY_RUN) {
      console.log(`   🔍 ${file} — ${replacements.length} fence(s)`)
      continue
    }

    const newBody = stripEmptyParagraphs(applyReplacements(body, replacements))
    fs.writeFileSync(filepath, header + newBody)
    console.log(`   ✅ ${file} — ${replacements.length} fence(s)`)
  }

  console.log('\n' + '='.repeat(50))
  console.log(
    `📊 ${migrated} file(s), ${totalBlocks} fenced block(s)` +
      (DRY_RUN ? ' would be migrated' : ' migrated')
  )
}

main()
