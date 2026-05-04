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
 * wins over CVA defaults. Override patterns are documented in
 * docs/plans/intorg-705.md §4.6:
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
    'rounded-lg select-none',
    'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orchid-100',
    'motion-safe:transition-colors motion-safe:duration-200',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none'
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-button-primary text-neutral-0',
          'hover:bg-button-primary-hover',
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
          'hover:bg-neutral-900 hover:border-neutral-900 hover:text-neutral-0',
          'disabled:text-neutral-50 aria-disabled:text-neutral-50'
        ]
      },
      {
        variant: 'secondary',
        mode: 'dark',
        class: [
          'border-neutral-75 text-neutral-25',
          'hover:bg-neutral-0 hover:border-neutral-0 hover:text-neutral-100',
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
