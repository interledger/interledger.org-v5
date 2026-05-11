/**
 * Single source of truth for Button + LinkButton class composition.
 *
 * Multi-axis variant matrix (variant × mode × size × iconOnly) handled via
 * CVA compoundVariants. Every Tailwind class below is a literal string so
 * the v4 content scanner can see them. DO NOT introduce template literals
 * or runtime concatenation when adding variants.
 *
 * Caller overrides flow through tailwind-merge (configured in
 * src/utils/twMerge.ts). Button.astro and LinkButton.astro wrap the
 * buttonVariants() result with twMerge so `<Button class="w-full">` cleanly
 * wins over CVA defaults. Override patterns:
 *   - Pattern A: wrap in [data-pillar='X'] (preferred for pillar re-tint)
 *   - Pattern B: inline-style the --color-button-primary{,-hover,-disabled}
 *               vars (preferred for forcing a specific palette colour)
 *   - Pattern C: pass `class` prop (preferred for non-colour utilities)
 */
import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center',
    'font-poppins text-caption',
    'rounded-lg select-none cursor-pointer no-underline hover:no-underline',
    'motion-safe:transition-colors motion-safe:duration-200',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none'
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-button-primary text-neutral-0',
          'hover:bg-button-primary-hover',
          // Focus per Figma node 304:45172: orchid-50 fill, 2px orchid-100
          // outline drawn inside the button border (so layout doesn't shift),
          // orchid-100 text. Hardcoded to orchid; pillar-aware focus tokens
          // are a follow-up once design specifies per-pillar focus colours.
          'focus-visible:bg-orchid-50 focus-visible:text-orchid-100',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-orchid-100',
          'disabled:bg-button-primary-disabled aria-disabled:bg-button-primary-disabled'
        ],
        secondary: ['bg-transparent border']
      },
      mode: {
        light: '',
        dark: ''
      },
      size: {
        lg: 'h-12 gap-sm py-lg min-w-11',
        sm: 'h-11 gap-xs py-md min-w-11'
      },
      iconOnly: {
        true: 'aspect-square px-0',
        false: ''
      }
    },
    compoundVariants: [
      {
        variant: 'secondary',
        mode: 'light',
        class: [
          'border-neutral-50 text-neutral-100',
          // Hover (Figma node 63:1388): border colour darkens to black and
          // text deepens to black. Fill stays transparent.
          'hover:border-neutral-900 hover:text-neutral-900',
          // Focus uses the "filled + 2px contrast inset" pattern. Outline
          // (with -2px offset) stands in for Figma's 2px border so the
          // 1px default border doesn't trigger a layout shift on focus.
          'focus-visible:bg-neutral-25 focus-visible:text-neutral-900',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-neutral-900',
          'disabled:border-neutral-50 disabled:text-neutral-50',
          'aria-disabled:border-neutral-50 aria-disabled:text-neutral-50'
        ]
      },
      {
        variant: 'secondary',
        mode: 'dark',
        class: [
          'border-neutral-75 text-neutral-25',
          // Hover (Figma node 63:1345): border colour only changes to white;
          // bg and text stay put.
          'hover:border-neutral-0',
          // Focus (Figma node 304:44018): neutral-75 fill, 2px white inset,
          // white text.
          'focus-visible:bg-neutral-75 focus-visible:text-neutral-0',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-neutral-0',
          'disabled:border-neutral-100 disabled:text-neutral-75',
          'aria-disabled:border-neutral-100 aria-disabled:text-neutral-75'
        ]
      },
      { iconOnly: false, size: 'lg', class: 'px-xl' },
      { iconOnly: false, size: 'sm', class: 'px-md' }
    ],
    defaultVariants: {
      variant: 'primary',
      mode: 'light',
      size: 'lg',
      iconOnly: false
    }
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
