/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        titillium: ['Titillium', 'Arial', 'sans-serif'],
        poppins: ['Poppins', 'Arial', 'sans-serif'],
        system: [
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ]
      },

      // NOTE: fontSize, spacing, animations, colors, borderRadius, and boxShadow
      // are now defined via @theme in src/styles/theme.css (single source of truth).

      // Layout constraints (no @theme namespace available)
      maxWidth: {
        content: '1440px',
        narrow: '800px',
        wide: '1600px',
        prose: '960px'
      },

      // Header height
      height: {
        header: '4.375rem'
      },

      // Transitions
      transitionDuration: {
        DEFAULT: '200ms',
        fast: '150ms',
        slow: '300ms'
      },

      // Background gradients
      backgroundImage: {
        'gradient-primary':
          'linear-gradient(to right, oklch(51.54% 0.088 194.77), oklch(74.53% 0.082 202.65))',
        'gradient-primary-fallback':
          'linear-gradient(to right, #007777, #69bcc3)',
        'gradient-dark':
          'linear-gradient(to bottom, hsla(162, 86%, 12%, 1), hsla(176, 100%, 30%, 1))'
      },

      // Breakpoints. md: and lg: are Tailwind v4 defaults kept for legacy
      // code. tablet: (810) and desktop: (1200) are the redesign tiers from
      // Radu's "Layout rules" — new design-system code uses these.
      screens: {
        xs: '480px',
        sm: '600px',
        md: '768px',
        lg: '1024px',
        xl: '1060px',
        '2xl': '1324px',
        tablet: '810px',
        desktop: '1200px'
      }
    }
  },
  plugins: []
}
