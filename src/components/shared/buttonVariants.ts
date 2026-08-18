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
    'font-poppins text-body-sm-standard',
    'rounded-lg select-none cursor-pointer no-underline hover:no-underline',
    'motion-safe:transition motion-safe:duration-200',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none'
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-button-primary text-neutral-0',
          'hover:bg-button-primary-hover',
          // Focus state: orchid-50 fill, 2px orchid-100 outline drawn inside
          // the button border (so layout doesn't shift), orchid-100 text.
          // Hardcoded to orchid; pillar-aware focus tokens are a follow-up
          // once design specifies per-pillar focus colours.
          'focus-visible:bg-orchid-50 focus-visible:text-orchid-100',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-orchid-100',
          'disabled:bg-button-primary-disabled disabled:text-neutral-25 aria-disabled:bg-button-primary-disabled aria-disabled:text-neutral-25'
        ],
        secondary: ['bg-transparent border'],
        // Footer ghost button. Inline text-with-padding link, no fill, no
        // border by default. Mobile uses h4 typography + black text;
        // tablet/desktop step down to body-sm-standard + neutral-75. Hover
        // deepens to black. The "active" state in Figma is the
        // currently-on-this-page indicator for a footer nav link, surfaced
        // via aria-current="page" (not the CSS :active pseudoclass).
        // Focus draws a 1px orchid-100 border; the transparent default
        // border keeps layout stable. Disabled state is not in Figma.
        ghost: [
          'bg-transparent border border-transparent',
          'text-h4 text-neutral-900',
          'tablet:text-body-sm-standard tablet:text-neutral-75',
          'hover:text-neutral-900',
          'aria-[current=page]:text-orchid-100',
          // The 1px orchid border is the entire focus indicator;
          // suppress the browser's default blue focus ring.
          'focus-visible:border-orchid-100 focus-visible:outline-none'
        ],
        fab: [
          'self-end shrink-0 rounded-full border -rotate-45',
          'tablet:self-center',
          'desktop:self-end',
          'hover:rotate-0',
          'focus-visible:rotate-0',
          'focus-visible:outline-1 focus-visible:-outline-offset-1'
        ]
      },
      // `light`/`dark` are explicit: the caller knows which surface it sits on
      // (e.g. HomepageHero's dark band on an otherwise light page, or the
      // side-by-side swatches in the UI preview). `auto` is for components
      // that can't know, such as dynamic-zone blocks rendered on foundation
      // (light) as well as summit and hackathon (permanently dark). It layers
      // `dark:`-prefixed styles on top of the light ones, following
      // `data-theme` on <html> via the `darkMode` selector in
      // tailwind.config.mjs.
      mode: {
        light: '',
        dark: '',
        auto: ''
      },
      size: {
        lg: 'h-12 gap-sm py-lg min-w-11',
        sm: 'h-11 gap-xs py-md min-w-11'
      },
      iconOnly: {
        true: 'aspect-square px-0',
        false: ''
      },
      iconSide: {
        left: '',
        right: '',
        none: ''
      }
    },
    compoundVariants: [
      {
        variant: 'secondary',
        mode: 'light',
        class: [
          'border-neutral-75 text-neutral-100',
          // Hover: border colour darkens to black and text deepens to black.
          // Fill stays transparent.
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
          // Hover: border colour only changes to white; bg and text stay put.
          'hover:border-neutral-0',
          // Focus: neutral-75 fill, 2px white inset, white text.
          'focus-visible:bg-neutral-75 focus-visible:text-neutral-0',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-neutral-0',
          'disabled:border-neutral-100 disabled:text-neutral-75',
          'aria-disabled:border-neutral-100 aria-disabled:text-neutral-75'
        ]
      },
      // `auto` = the light palette, with the dark one layered behind a `dark:`
      // prefix. Kept as literal strings (no programmatic prefixing of the two
      // lists above) so the Tailwind v4 content scanner can see every class.
      {
        variant: 'secondary',
        mode: 'auto',
        class: [
          'border-neutral-50 text-neutral-100',
          'hover:border-neutral-900 hover:text-neutral-900',
          'focus-visible:bg-neutral-25 focus-visible:text-neutral-900',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-neutral-900',
          'disabled:border-neutral-50 disabled:text-neutral-50',
          'aria-disabled:border-neutral-50 aria-disabled:text-neutral-50',
          'dark:border-neutral-50 dark:text-neutral-25',
          'dark:hover:border-neutral-0 dark:hover:text-neutral-0',
          'dark:focus-visible:bg-neutral-75 dark:focus-visible:text-neutral-0',
          'dark:focus-visible:outline-neutral-0',
          'dark:disabled:border-neutral-100 dark:disabled:text-neutral-75',
          'dark:aria-disabled:border-neutral-100 dark:aria-disabled:text-neutral-75'
        ]
      },
      {
        variant: 'fab',
        mode: 'light',
        class: [
          'border-neutral-75 text-neutral-900',
          'hover:border-neutral-900',
          'focus-visible:outline-solid focus-visible:outline-neutral-900',
          'disabled:text-neutral-50 aria-disabled:text-neutral-50'
        ]
      },
      {
        variant: 'fab',
        mode: 'dark',
        class: [
          'border-neutral-50 text-neutral-25',
          'hover:border-neutral-0 hover:text-neutral-0',
          'focus-visible:outline-neutral-0 focus-visible:text-neutral-0',
          'disabled:border-neutral-100 disabled:text-neutral-75',
          'aria-disabled:border-neutral-100 aria-disabled:text-neutral-75'
        ]
      },
      { iconOnly: false, iconSide: 'left', size: 'lg', class: 'pl-lg pr-xl' },
      { iconOnly: false, iconSide: 'right', size: 'lg', class: 'pl-xl pr-lg' },
      { iconOnly: false, iconSide: 'none', size: 'lg', class: 'px-lg' },
      { iconOnly: false, iconSide: 'left', size: 'sm', class: 'pl-md pr-lg' },
      { iconOnly: false, iconSide: 'right', size: 'sm', class: 'pl-lg pr-md' },
      { iconOnly: false, iconSide: 'none', size: 'sm', class: 'px-md' },
      { variant: 'fab', class: 'aspect-square py-md px-md' },
      // Ghost overrides the boxed-button geometry: no fixed height, no
      // y-padding, no min-width, no rounded corners except on focus, and
      // a tight 4px x-padding regardless of the size variant.
      {
        variant: 'ghost',
        class:
          'h-auto min-w-0 py-0 gap-0 px-xs rounded-none focus-visible:rounded-lg'
      }
    ],
    defaultVariants: {
      variant: 'primary',
      mode: 'light',
      size: 'lg',
      iconOnly: false,
      iconSide: 'none'
    }
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
