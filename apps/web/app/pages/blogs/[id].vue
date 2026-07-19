<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@writer/shared';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

interface TocItem {
  id: string;
  text: string;
  level: number;
}
const toc = ref<TocItem[]>([]);

const route = useRoute();
const router = useRouter();
const id = route.params.id as Id<"documents">;

const { data: doc, error } = useQuery(api.documents.getPublic, { id });
const { data: allDocs } = useQuery(api.documents.getAll);

const adjacentDocs = computed(() => {
  if (!allDocs.value || !id) return { prev: null, next: null };
  const idx = allDocs.value.findIndex((d: any) => d._id === id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx < allDocs.value.length - 1 ? allDocs.value[idx + 1] : null,
    next: idx > 0 ? allDocs.value[idx - 1] : null,
  };
});

watch(() => doc.value?.content, (newContent) => {
  if (newContent) {
    nextTick(() => {
      const contentDiv = document.querySelector('.ProseMirror');
      if (!contentDiv) return;

      const headings = contentDiv.querySelectorAll('h2, h3, h4');
      const items: TocItem[] = [];

      headings.forEach((heading, index) => {
        let id = heading.id;
        if (!id) {
          id = heading.textContent?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || `heading-${index}`;
          heading.id = id;
        }

        items.push({
          id,
          text: heading.textContent || '',
          level: Number(heading.tagName.charAt(1))
        });
      });

      toc.value = items;
    });
  }
}, { immediate: true });
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-12 w-full">
    <UButton variant="ghost" color="neutral" icon="i-lucide-arrow-left" class="mb-8 -ml-2" @click="navigateTo('/blogs')">
      Back to Blogs
    </UButton>

    <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-xl mb-8 flex items-start gap-3 border border-red-200">
      <UIcon name="i-lucide-alert-circle" class="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <h3 class="font-semibold">Failed to load blog post</h3>
        <p class="text-sm mt-1 opacity-90">{{ error.message }}</p>
      </div>
    </div>

    <div v-else-if="doc === undefined" class="flex flex-col items-center justify-center py-24 space-y-4">
      <UIcon name="i-lucide-loader-2" class="w-10 h-10 animate-spin text-primary-500" />
      <span class="text-gray-500 font-medium">Loading story...</span>
    </div>

    <div v-else-if="doc === null" class="text-center py-24 border border-dashed border-gray-300 rounded-2xl">
      <div class="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <UIcon name="i-lucide-file-question" class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-xl font-semibold">Blog Not Found</h3>
      <p class="text-gray-500 mt-2 max-w-sm mx-auto">This document might have been deleted or doesn't exist.</p>
    </div>

    <div v-else>
      <div class="flex flex-col lg:flex-row gap-12 items-start w-full">
        <!-- Left TOC Sidebar -->
        <aside v-if="toc.length" class="hidden lg:block w-64 shrink-0 sticky top-24">
          <h3 class="font-bold text-sm uppercase tracking-wider mb-4 toc-header">On this page</h3>
          <ul class="space-y-3 text-sm">
            <li v-for="item in toc" :key="item.id" :class="{
              'pl-0 font-medium': item.level === 2,
              'pl-4 toc-item-level-3': item.level === 3,
              'pl-8 text-xs toc-item-level-4': item.level === 4
            }">
              <a :href="`#${item.id}`" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                {{ item.text }}
              </a>
            </li>
          </ul>
        </aside>

        <!-- Main Content -->
        <article class="flex-1 w-full">
          <h1 class="text-4xl sm:text-5xl font-extrabold mb-6 mt-4 leading-tight tracking-tight blog-title">
            {{ doc.title || 'Untitled Document' }}
          </h1>

          <div class="flex items-center gap-4 text-sm mb-8 pb-6 border-b blog-meta">
            <span class="flex items-center gap-1.5 font-medium">
              <UIcon name="i-lucide-calendar" class="w-4 h-4" />
              {{ new Date(doc._creationTime).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
              }) }}
            </span>
          </div>

          <!-- Desktop-Style Page Canvas -->
          <div class="w-full relative z-0">
            <div class="h-full tiptap-page">
              <div class="ProseMirror blog-prose" v-html="doc.content"></div>
            </div>
          </div>
        </article>
      </div>

      <!-- Next / Prev Navigation -->
      <div v-if="doc && allDocs"
        class="mt-16 pt-8 flex flex-col sm:flex-row gap-4 justify-between w-full max-w-6xl mx-auto pb-12">
        <!-- Previous Article (Older) -->
        <NuxtLink v-if="adjacentDocs.prev" :to="`/blogs/${adjacentDocs.prev._id}`"
          class="flex-1 group cursor-pointer border rounded-xl p-6 hover:ring-1 transition-all shadow-sm relative overflow-hidden flex flex-col justify-center text-left nav-card">
          <div class="w-8 h-8 rounded-full flex items-center justify-center mb-4 transition-colors nav-card-icon">
            <UIcon name="i-lucide-chevron-left" class="w-4 h-4 transition-colors nav-card-icon-svg" />
          </div>
          <div class="font-bold mb-1 transition-colors truncate nav-card-title">
            {{ adjacentDocs.prev.title || 'Untitled Document' }}
          </div>
          <div class="text-sm line-clamp-2 nav-card-desc">
            Previous Article
          </div>
        </NuxtLink>
        <div v-else class="flex-1"></div>

        <!-- Next Article (Newer) -->
        <NuxtLink v-if="adjacentDocs.next" :to="`/blogs/${adjacentDocs.next._id}`"
          class="flex-1 group cursor-pointer border rounded-xl p-6 hover:ring-1 transition-all shadow-sm relative overflow-hidden flex flex-col justify-center items-end text-right nav-card">
          <div class="w-8 h-8 rounded-full flex items-center justify-center mb-4 transition-colors nav-card-icon">
            <UIcon name="i-lucide-chevron-right" class="w-4 h-4 transition-colors nav-card-icon-svg" />
          </div>
          <div class="font-bold mb-1 transition-colors truncate w-full nav-card-title">
            {{ adjacentDocs.next.title || 'Untitled Document' }}
          </div>
          <div class="text-sm line-clamp-2 nav-card-desc">
            Next Article
          </div>
        </NuxtLink>
        <div v-else class="flex-1"></div>
      </div>
    </div>
  </div>
</template>

<style>
html {
  scroll-behavior: smooth;
}

@reference "~/assets/css/main.css";

/* TOC Sidebar */
.toc-header {
  @apply text-gray-900;
}

.dark .toc-header {
  @apply text-white;
}

.toc-item-level-3 {
  @apply text-gray-500;
}

.dark .toc-item-level-3 {
  @apply text-gray-400;
}

.toc-item-level-4 {
  @apply text-gray-400;
}

.dark .toc-item-level-4 {
  @apply text-gray-500;
}

/* Navigation Cards */
.nav-card {
  @apply border-gray-200 bg-white hover:border-primary-500 hover:ring-primary-500;
}

.dark .nav-card {
  @apply border-gray-800 bg-[#18181B] hover:border-primary-500;
}

.nav-card-icon {
  @apply bg-gray-100 group-hover:bg-primary-50;
}

.dark .nav-card-icon {
  @apply bg-gray-800 group-hover:bg-primary-900/20;
}

.nav-card-icon-svg {
  @apply text-gray-500 group-hover:text-primary-500;
}

.nav-card-title {
  @apply text-gray-900 group-hover:text-primary-600;
}

.dark .nav-card-title {
  @apply text-white group-hover:text-primary-400;
}

.nav-card-desc {
  @apply text-gray-500;
}

.dark .nav-card-desc {
  @apply text-gray-400;
}

/* Local component classes for IDE warning suppression */
.blog-title {
  @apply text-gray-900;
}

.dark .blog-title {
  @apply text-white;
}

.blog-meta {
  @apply text-gray-500 border-gray-200;
}

.dark .blog-meta {
  @apply text-gray-400 border-gray-800;
}

.blog-prose {
  @apply text-gray-900;
}

.dark .blog-prose {
  @apply text-gray-100;
}

/* Page Layout ProseMirror Styles (Mirrored from Desktop App) */
.tiptap-page .ProseMirror {
  @apply outline-none w-full h-full text-base bg-transparent pb-16;
}

.tiptap-page .ProseMirror>*+* {
  margin-top: 1.25em;
}

.tiptap-page .ProseMirror h1,
.tiptap-page .ProseMirror h2,
.tiptap-page .ProseMirror h3,
.tiptap-page .ProseMirror h4 {
  font-family: ui-sans-serif, system-ui, sans-serif;
  @apply text-gray-900;
}

.dark .tiptap-page .ProseMirror h1,
.dark .tiptap-page .ProseMirror h2,
.dark .tiptap-page .ProseMirror h3,
.dark .tiptap-page .ProseMirror h4 {
  @apply text-white;
}

.tiptap-page .ProseMirror h1 {
  @apply text-4xl font-extrabold mb-6 mt-8 tracking-tight;
}

.tiptap-page .ProseMirror h2 {
  @apply text-2xl font-bold mb-4 mt-6 tracking-tight;
}

.tiptap-page .ProseMirror h3 {
  @apply text-xl font-semibold mb-3 mt-5;
}

.tiptap-page .ProseMirror ul {
  @apply list-disc pl-6;
}

.tiptap-page .ProseMirror ol {
  @apply list-decimal pl-6;
}

.tiptap-page .ProseMirror blockquote {
  @apply pl-4 border-l-4 border-primary-500 italic text-gray-600;
}

.dark .tiptap-page .ProseMirror blockquote {
  @apply text-gray-400;
}

.tiptap-page .ProseMirror pre {
  @apply bg-gray-900 text-white p-4 rounded-md font-mono text-sm overflow-x-auto;
}

.dark .tiptap-page .ProseMirror pre {
  @apply bg-black;
}

.tiptap-page .ProseMirror code {
  @apply bg-gray-100 text-primary-600 px-1.5 py-0.5 rounded font-mono text-sm;
}

.dark .tiptap-page .ProseMirror code {
  @apply bg-gray-800 text-primary-400;
}

.tiptap-page .ProseMirror pre code {
  @apply bg-transparent text-inherit px-0 py-0;
}

.tiptap-page .ProseMirror a {
  @apply text-primary-600 underline hover:text-primary-700 cursor-pointer;
}

.dark .tiptap-page .ProseMirror a {
  @apply text-primary-400 hover:text-primary-300;
}

.tiptap-page .ProseMirror img {
  @apply max-w-full h-auto rounded-md border border-gray-200 mx-auto;
}

.dark .tiptap-page .ProseMirror img {
  @apply border-gray-800;
}

.tiptap-page .ProseMirror img[data-align="left"] {
  @apply float-left mr-6 mb-2 mt-2;
}

.tiptap-page .ProseMirror img[data-align="right"] {
  @apply float-right ml-6 mb-2 mt-2;
}

.tiptap-page .ProseMirror img[data-align="center"] {
  @apply block mx-auto my-4;
}

/* Table Styles */
.tiptap-page .ProseMirror table {
  @apply w-full border-collapse border border-gray-300 my-4 table-fixed;
}

.dark .tiptap-page .ProseMirror table {
  @apply border-gray-700;
}

.tiptap-page .ProseMirror td,
.tiptap-page .ProseMirror th {
  @apply border border-gray-300 p-2 min-w-[1em] relative align-top bg-white;
}

.dark .tiptap-page .ProseMirror td,
.dark .tiptap-page .ProseMirror th {
  @apply border-gray-700 bg-gray-900;
}

.tiptap-page .ProseMirror th {
  @apply font-bold bg-gray-100 text-left;
}

.dark .tiptap-page .ProseMirror th {
  @apply bg-gray-800;
}
</style>
