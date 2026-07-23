#!/usr/bin/env node
/**
 * Prettier wrapper for MDX that protects `CodeBlock` content.
 *
 * Prettier's MDX parser treats a `code={`…`}` attribute as a live JS expression
 * and reformats the template literal — wrapping element attributes and, when the
 * code contains a blank line, corrupting it (escaping `*`, dropping indentation).
 * The CMS export already guards against this in `formatMdx`
 * (cms/src/utils/mdx.ts) by swapping the attribute for a placeholder before
 * formatting and restoring it verbatim afterward.
 *
 * This script applies the SAME protection on the repo side so `pnpm lint` /
 * `pnpm format` agree with the CMS output (no Strapi↔Astro mismatch) and code
 * blocks — blank lines included — round-trip untouched. See INTORG-950.
 *
 * Usage: node scripts/format-mdx.mjs [--check | --write]
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import prettier from 'prettier'

const MODE = process.argv.includes('--write') ? 'write' : 'check'

// Mirror of CODE_BLOCK_ATTR_RE / placeholder in cms/src/utils/mdx.ts — keep in
// sync so both sides protect and restore identically.
const CODE_BLOCK_ATTR_RE = /code=\{`(?:\\.|[^`\\])*`\}/g
const placeholder = (i) => `code={__CODE_BLOCK_ATTR_${i}__}`
const PLACEHOLDER_RE = /code=\{__CODE_BLOCK_ATTR_(\d+)__\}/g

/** Tracked `.mdx` files (NUL-separated to survive odd paths). */
function listMdxFiles() {
  return execSync('git ls-files -z -- "*.mdx"', { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
}

async function formatFile(file) {
  const info = await prettier.getFileInfo(file, {
    ignorePath: '.prettierignore'
  })
  if (info.ignored) return null

  const original = readFileSync(file, 'utf8')
  const stash = []
  const guarded = original.replace(CODE_BLOCK_ATTR_RE, (match) =>
    placeholder(stash.push(match) - 1)
  )

  const config = (await prettier.resolveConfig(file)) ?? {}
  const formatted = await prettier.format(guarded, {
    ...config,
    parser: 'mdx',
    filepath: file
  })

  return formatted.replace(PLACEHOLDER_RE, (_match, i) => stash[Number(i)])
}

async function run() {
  const unformatted = []
  let failed = false

  for (const file of listMdxFiles()) {
    let result
    try {
      result = await formatFile(file)
    } catch (err) {
      console.error(`[format-mdx] error in ${file}: ${err.message}`)
      failed = true
      continue
    }
    if (result === null) continue

    const original = readFileSync(file, 'utf8')
    if (result === original) continue

    if (MODE === 'write') {
      writeFileSync(file, result)
      console.log(`[format-mdx] formatted ${file}`)
    } else {
      unformatted.push(file)
    }
  }

  if (unformatted.length) {
    console.error('[format-mdx] Code style issues found in:')
    for (const file of unformatted) console.error(`  ${file}`)
    console.error("Run 'pnpm format' to fix.")
    failed = true
  }
  if (failed) process.exitCode = 1
}

run()
