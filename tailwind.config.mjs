/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        titillium: ['Titillium', 'Arial', 'sans-serif'],
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
        content: '1160px',
        narrow: '800px',
        wide: '1200px',
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

      // Breakpoints matching existing media queries
      screens: {
        xs: '480px',
        sm: '600px',
        md: '800px',
        lg: '1000px',
        xl: '1060px',
        '2xl': '1324px'
      }
    }
  },
  plugins: []
}
