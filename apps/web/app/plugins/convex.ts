import { initConvex, initAuth } from '@writer/shared';
import { defineNuxtPlugin, useRuntimeConfig } from '#imports';

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  
  if (config.public.convexUrl) {
    initConvex(config.public.convexUrl);
    initAuth(config.public.convexUrl);
  } else {
    console.warn("VITE_CONVEX_URL environment variable is missing!");
  }
});
