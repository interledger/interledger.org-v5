#!/usr/bin/env node
/**
 * Renders a vitest `json-summary` coverage report as markdown.
 *
 * Both suites — `src` (repo root) and `cms` — write
 * `coverage/coverage-summary.json` via the `json-summary` reporter. This turns one
 * of those into a totals table plus a per-directory breakdown, printed to stdout
 * and appended to `$GITHUB_STEP_SUMMARY` when running in Actions so the numbers
 * land in the PR checks UI rather than only in the job log.
 *
 * Shared by both suites so the two reports stay formatted identically; the cms
 * job invokes it as `node ../scripts/coverage-report.mjs cms`.
 *
 * Usage: node scripts/coverage-report.mjs <src|cms> [summaryPath]
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

const DEFAULT_SUMMARY_PATH = 'coverage/coverage-summary.json'
const METRICS = ['statements', 'branches', 'functions', 'lines']
const MAX_DIRECTORY_ROWS = 15

/** Parsed summary, or an Error if it is missing or malformed. */
function readSummary(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (cause) {
    return new Error(`Could not read a coverage summary at ${path}`, { cause })
  }
}

const percent = (covered, total) =>
  total === 0 ? '100.0' : ((100 * covered) / total).toFixed(1)

function totalsTable(total) {
  const rows = METRICS.map((metric) => {
    const { covered, total: count, pct } = total[metric]
    return `| ${metric} | ${covered} | ${count} | **${pct}%** |`
  })
  return [
    '| Metric | Covered | Total | % |',
    '| --- | --- | --- | --- |',
    ...rows
  ]
}

/** Statement totals per containing directory, largest absolute gap first. */
function rollUpByDirectory(summary) {
  const dirs = new Map()

  for (const [file, metrics] of Object.entries(summary)) {
    if (file === 'total') continue
    // Split on both separators: `relative` yields backslashes on Windows, which
    // would otherwise collapse every file into a single directory row.
    const dir = relative(process.cwd(), file)
      .split(/[\\/]/)
      .slice(0, -1)
      .join('/')
    const acc = dirs.get(dir) ?? { covered: 0, total: 0, files: 0 }
    acc.covered += metrics.statements.covered
    acc.total += metrics.statements.total
    acc.files += 1
    dirs.set(dir, acc)
  }

  return [...dirs]
    .map(([dir, acc]) => ({
      dir: dir || '.',
      ...acc,
      uncovered: acc.total - acc.covered
    }))
    .sort((a, b) => b.uncovered - a.uncovered)
}

/**
 * Directories carrying uncovered statements, worst first.
 *
 * Fully-covered directories are omitted — they represent no debt, and cms has a
 * dozen single-file `src/api/**\/content-types/` lifecycle directories that would
 * otherwise bury the handful of rows worth acting on. The per-file detail is
 * still in the uploaded html report.
 */
function directoryTable(summary) {
  const all = rollUpByDirectory(summary)
  const withDebt = all.filter((d) => d.uncovered > 0)
  const shown = withDebt.slice(0, MAX_DIRECTORY_ROWS)

  const rows = shown.map(
    ({ dir, covered, total, uncovered, files }) =>
      `| \`${dir}\` | ${percent(covered, total)}% | ${uncovered} | ${files} |`
  )

  const notes = []
  if (withDebt.length > shown.length) {
    notes.push(`${withDebt.length - shown.length} further directories omitted.`)
  }
  const fullyCovered = all.length - withDebt.length
  if (fullyCovered > 0) {
    notes.push(
      `${fullyCovered} fully-covered ${fullyCovered === 1 ? 'directory' : 'directories'} omitted.`
    )
  }

  return [
    '| Directory | Statements | Uncovered | Files |',
    '| --- | --- | --- | --- |',
    ...rows,
    ...(notes.length ? ['', `_${notes.join(' ')}_`] : [])
  ]
}

function render(label, summary) {
  const fileCount = Object.keys(summary).length - 1
  return [
    `### Coverage — ${label}`,
    '',
    ...totalsTable(summary.total),
    '',
    '<details>',
    `<summary>By directory (${fileCount} files)</summary>`,
    '',
    ...directoryTable(summary),
    '',
    '</details>'
  ].join('\n')
}

const [label, summaryPath = DEFAULT_SUMMARY_PATH] = process.argv.slice(2)

if (!label) {
  console.error(
    'Usage: node scripts/coverage-report.mjs <src|cms> [summaryPath]'
  )
  process.exit(1)
}

const summary = readSummary(summaryPath)

if (summary instanceof Error) {
  console.error(summary.message)
  process.exit(1)
}

const markdown = render(label, summary)
console.log(markdown)

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n\n`)
}
