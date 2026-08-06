import type { VariantFormat } from './ports'

export const VARIANT_FORMATS: readonly VariantFormat[] = ['webp', 'avif']

/** Suffix of the variant encoded at the source's intrinsic size. */
export const FULL_SIZE_SUFFIX = 'full'

export interface PlannedVariant {
  fileName: string
  format: VariantFormat
  /** `null` encodes at the source's intrinsic size (no resize). */
  width: number | null
}

export interface VariantPlan {
  /** Resized widths, ascending. Excludes the unsized full-size pair. */
  widths: number[]
  variants: PlannedVariant[]
}

/**
 * Decides which files an image should produce. Pure — no filesystem, no
 * encoder — so the naming and width rules can be asserted directly.
 */
export function planVariants(
  baseName: string,
  intrinsicWidth: number,
  targetWidths: readonly number[]
): VariantPlan {
  if (intrinsicWidth <= 0) return { widths: [], variants: [] }

  const widths = resolveWidths(intrinsicWidth, targetWidths)
  return {
    widths,
    variants: [
      ...widths.flatMap((width) => formatPair(baseName, String(width), width)),
      ...formatPair(baseName, FULL_SIZE_SUFFIX, null)
    ]
  }
}

/**
 * Target widths the source can actually fill, plus its intrinsic width.
 *
 * The intrinsic width is always emitted even when it isn't a target: otherwise
 * a 1200px original only gets 640 (+ full), and responsive srcsets that omit
 * `-full` force the browser to upscale 640 on desktop (INTORG-934).
 */
function resolveWidths(
  intrinsicWidth: number,
  targetWidths: readonly number[]
): number[] {
  const widths = new Set(targetWidths.filter((w) => w <= intrinsicWidth))
  widths.add(intrinsicWidth)
  return [...widths].sort((a, b) => a - b)
}

function formatPair(
  baseName: string,
  suffix: string,
  width: number | null
): PlannedVariant[] {
  return VARIANT_FORMATS.map((format) => ({
    fileName: `${baseName}-${suffix}.${format}`,
    format,
    width
  }))
}
