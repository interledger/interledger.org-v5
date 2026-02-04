import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'

const isDev = process.env.ASTRO_MODE === 'dev' || process.env.NODE_ENV === 'development'

// https://astro.build/config
// TODO: temporary fix for local env to run
export default defineConfig(async () => {
  const adapter = isDev ? undefined : (await import('@astrojs/netlify')).default

  return {
    site: 'https://interledger.org',
    output: 'static',
    prerender: {
      default: true
    },
    adapter: adapter ? adapter() : undefined,
    integrations: [
      mdx()
    ],
    vite: {
      plugins: [tailwindcss()]
    },
    redirects: {
      '/hacktoberfest': 'https://interledger.org/hacktoberfest',
      '/hacktoberfest-2023': 'https://interledger.org/hacktoberfest'
    },
    server: {
      port: 1103
    }
  }
})
