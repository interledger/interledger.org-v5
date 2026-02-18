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

      // Fluid typography scale
      // References CSS variables from base/variables.css
      fontSize: {
        'step--2': 'var(--step--2)',
        'step--1': 'var(--step--1)',
        'step-0': 'var(--step-0)',
        'step-1': 'var(--step-1)',
        'step-2': 'var(--step-2)',
        'step-3': 'var(--step-3)',
        'step-4': 'var(--step-4)',
        'step-5': 'var(--step-5)',
        'step-6': 'var(--step-6)'
      },

      // Fluid spacing scale
      // References CSS variables from base/variables.css
      spacing: {
        'space-3xs': 'var(--space-3xs)',
        'space-2xs': 'var(--space-2xs)',
        'space-xs': 'var(--space-xs)',
        'space-s': 'var(--space-s)',
        'space-m': 'var(--space-m)',
        'space-l': 'var(--space-l)',
        'space-xl': 'var(--space-xl)',
        'space-2xl': 'var(--space-2xl)',
        'space-3xl': 'var(--space-3xl)'
      },

      // Colors (migrated from legacy pages.css)
      // NOTE: 'primary' is now dynamic via @theme inline in tailwind.css
      // It reads from var(--color-primary) which responds to [data-pillar] overrides
      colors: {
        mission: {
          DEFAULT: 'oklch(55.27% 0.205 32.62)',
          fallback: '#c24b3d'
        },
        frost: 'rgba(255, 255, 255, 0.5)',
        gray: {
          DEFAULT: '#444',
          header: '#eee',
          table: '#f6f7f9',
          'inline-code': '#edeef3'
        }
      },

      // Layout constraints
      maxWidth: {
        content: '1160px',
        narrow: '800px',
        wide: '1200px',
        prose: '960px'
      },

      // Border radius
      borderRadius: {
        DEFAULT: '6px',
        card: '8px',
        pill: '10em',
        button: '1rem'
      },

      // Box shadows
      boxShadow: {
        DEFAULT:
          '0px 1px 1px hsla(0, 0%, 0%, 0.06), 0px 2px 2px hsla(0, 0%, 0%, 0.06)',
        card: '0 4px 12px rgba(0, 0, 0, 0.1)',
        primary: '0px 0px 12px -4px oklch(51.54% 0.088 194.77)'
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
