import OptimizedImage from '@/components/shared/OptimizedImage.astro'

/**
 * Overrides every MDX body takes, whatever else its template registers.
 *
 * CKEditor stores images as Markdown, so `![alt](src)` compiles to an `img`
 * element that this routes through the image optimizer. A template that leaves
 * it out serves the raw original. Rich text rendered as an HTML string instead
 * goes through Marked's `image` renderer (`renderOptimizedImageHtml`), which
 * must emit the same markup.
 */
export const RICH_TEXT_MDX_COMPONENTS = {
  img: OptimizedImage
}
