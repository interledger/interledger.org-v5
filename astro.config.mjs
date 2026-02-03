import { defineConfig } from 'astro/config'
import netlify from '@astrojs/netlify'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
  site: 'https://interledger.org',
  output: 'server',
  prerender: {
    default: true
  },
  adapter: netlify(),
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
})
