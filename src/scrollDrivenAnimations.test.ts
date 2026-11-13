import { globSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { describe, expect, it } from 'vitest'

/**
 * `astro dev` serves CSS unminified, so a scroll-driven animation the build
 * minifier breaks still animates locally and is static only once deployed.
 * These tests run that minifier over the source styles to catch it here.
 */

type MinifyCss = (options: {
  filename: string
  code: Uint8Array
  minify: boolean
  errorRecovery: boolean
}) => { code: Uint8Array }

/**
 * Lightning CSS is Vite's build minifier and not a direct dependency, so it is
 * loaded through astro → vite: the same copy the build runs, version and all.
 */
function loadBuildCssMinifier(): MinifyCss {
  const requireFromHere = createRequire(import.meta.url)
  const requireFromAstro = createRequire(
    requireFromHere.resolve('astro/package.json')
  )
  const requireFromVite = createRequire(
    requireFromAstro.resolve('vite/package.json')
  )
  return (requireFromVite('lightningcss') as { transform: MinifyCss }).transform
}

const minifyCss = loadBuildCssMinifier()
const SRC_DIR = import.meta.dirname
const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/g
// Lightning CSS keeps an unknown at-rule as raw tokens and never parses the
// declarations inside it, so a Tailwind `@utility` is checked as a class.
const TAILWIND_UTILITY = /@utility\s+([\w-]+)\s*\{/g
const INNERMOST_VAR = /var\([^()]*\)/g

/** Every stylesheet under src/ that declares an animation. */
function readAnimatedStylesheets(): Array<{ file: string; css: string }> {
  const files = globSync('**/*.{astro,css}', { cwd: SRC_DIR })
  return files
    .map((file) => {
      const source = readFileSync(path.join(SRC_DIR, file), 'utf8')
      const css = file.endsWith('.astro')
        ? Array.from(source.matchAll(STYLE_BLOCK), (match) => match[1]).join(
            '\n'
          )
        : source
      return { file, css: css.replace(TAILWIND_UTILITY, '.$1 {') }
    })
    .filter(({ css }) => css.includes('animation'))
}

/**
 * Mirrors the build: Astro sets Vite's `build.target` to `esnext`, so Vite
 * runs Lightning CSS with no browser targets, which is what lets it fold a
 * timeline into the shorthand. The CSS is minified more than once on its way
 * to the page, and the second pass is what exposes the range bug.
 */
function minifyLikeTheBuild(file: string, css: string): string[] {
  const minifyOnce = (input: string): string =>
    new TextDecoder().decode(
      minifyCss({
        filename: file,
        code: new TextEncoder().encode(input),
        minify: true,
        errorRecovery: true
      }).code
    )
  const firstPass = minifyOnce(css)
  return [firstPass, minifyOnce(firstPass)]
}

function declarationValues(css: string, property: string): string[] {
  const declaration = new RegExp(`(?:^|[{;])${property}:([^;}]*)`, 'g')
  return Array.from(css.matchAll(declaration), (match) => match[1])
}

/** `view()`, `scroll()` or a named `--timeline`, outside any `var()`. */
function namesATimeline(animationShorthand: string): boolean {
  let withoutVars = animationShorthand
  let previous
  do {
    previous = withoutVars
    withoutVars = withoutVars.replace(INNERMOST_VAR, '')
  } while (withoutVars !== previous)
  return /view\(|scroll\(|(?:^|\s)--[\w-]+/.test(withoutVars)
}

const stylesheets = readAnimatedStylesheets()

describe('scroll-driven animations after build minification', () => {
  it('finds the stylesheets to check', () => {
    expect(stylesheets.map(({ file }) => file)).toContain(
      'components/homepage/AnimatedNetwork.astro'
    )
  })

  // Browsers reject an `animation` shorthand that names a timeline, so the
  // whole declaration is dropped. Lightning CSS folds `animation-timeline`
  // into a shorthand set in the same rule: use the longhands there instead.
  it.each(stylesheets)(
    '$file keeps animation-timeline out of the animation shorthand',
    ({ file, css }) => {
      const [, minified] = minifyLikeTheBuild(file, css)
      const folded = declarationValues(minified, 'animation').filter(
        namesATimeline
      )
      expect(folded).toEqual([])
    }
  )

  // Lightning CSS prints `exit 100%` as a bare `exit` and re-reads that as
  // `exit 0%`, so a range that changes between passes ends early. Write a
  // full range as `cover`, or keep the end percentage below 100%.
  it.each(stylesheets)(
    '$file keeps animation-range stable across minifier passes',
    ({ file, css }) => {
      const [firstPass, secondPass] = minifyLikeTheBuild(file, css)
      expect(declarationValues(secondPass, 'animation-range')).toEqual(
        declarationValues(firstPass, 'animation-range')
      )
    }
  )
})
