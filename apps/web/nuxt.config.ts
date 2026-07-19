// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../../.env.local', import.meta.url)) });

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true }
  },

  runtimeConfig: {
    public: {
      convexUrl: process.env.VITE_CONVEX_URL || ''
    }
  },

  alias: {
    '@convex': fileURLToPath(new URL('../../convex', import.meta.url))
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          '@convex/*': ['../../convex/*']
        }
      }
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
