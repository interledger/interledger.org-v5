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

      // Fluid typography scale from pages.css
      fontSize: {
        'step--2': 'clamp(0.72rem, 0.6261rem + 0.4174vi, 0.96rem)',
        'step--1': 'clamp(0.9rem, 0.7826rem + 0.5217vi, 1.2rem)',
        'step-0': 'clamp(1.125rem, 0.9783rem + 0.6522vi, 1.5rem)',
        'step-1': 'clamp(1.4063rem, 1.2228rem + 0.8152vi, 1.875rem)',
        'step-2': 'clamp(1.7578rem, 1.5285rem + 1.019vi, 2.3438rem)',
        'step-3': 'clamp(2.1973rem, 1.9107rem + 1.2738vi, 2.9297rem)',
        'step-4': 'clamp(2.7466rem, 2.3883rem + 1.5922vi, 3.6621rem)',
        'step-5': 'clamp(3.4332rem, 2.9854rem + 1.9903vi, 4.5776rem)',
        'step-6': 'clamp(4.2915rem, 3.7318rem + 2.4878vi, 5.722rem)'
      },

      // Fluid spacing scale from pages.css
      spacing: {
        'space-3xs': 'clamp(0.3125rem, 0.288rem + 0.1087vi, 0.375rem)',
        'space-2xs': 'clamp(0.5625rem, 0.4891rem + 0.3261vi, 0.75rem)',
        'space-xs': 'clamp(0.875rem, 0.7772rem + 0.4348vi, 1.125rem)',
        'space-s': 'clamp(1.125rem, 0.9783rem + 0.6522vi, 1.5rem)',
        'space-m': 'clamp(1.6875rem, 1.4674rem + 0.9783vi, 2.25rem)',
        'space-l': 'clamp(2.25rem, 1.9565rem + 1.3043vi, 3rem)',
        'space-xl': 'clamp(3.375rem, 2.9348rem + 1.9565vi, 4.5rem)',
        'space-2xl': 'clamp(4.5rem, 3.913rem + 2.6087vi, 6rem)',
        'space-3xl': 'clamp(6.75rem, 5.8696rem + 3.913vi, 9rem)'
      },

      // Colors from pages.css
      colors: {
        primary: {
          DEFAULT: 'oklch(51.54% 0.088 194.77)',
          fallback: '#007777',
          bg: 'oklch(51.95% 0.089 187.7 / 0.1)',
          'bg-fallback': 'rgba(7, 121, 114, 0.1)',
          hover: '#0c9b9b',
          light: 'oklch(74.53% 0.082 202.65)'
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
