<script setup lang="ts">
import { api } from '@convex/_generated/api';
import { useQuery } from '@writer/shared';

const { data: documents, error } = useQuery(api.documents.getAll);

// Helper function to strip HTML tags for clean preview text
const getPreviewText = (htmlContent?: string) => {
  if (!htmlContent) return '';
  return htmlContent.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
};
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-12 w-full">
    <div class="flex flex-col items-center mb-12 text-center">
      <h1 class="text-4xl font-extrabold mb-4 tracking-tight">Our Latest Blogs</h1>
      <p class="text-lg  max-w-2xl">Discover all the latest updates, stories, and
        thoughts written directly from our rich text editor.</p>
    </div>

    <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-xl mb-8 flex items-start gap-3 border border-red-200">
      <UIcon name="i-lucide-alert-circle" class="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <h3 class="font-semibold">Failed to load blogs</h3>
        <p class="text-sm mt-1 opacity-90">{{ error.message }}</p>
      </div>
    </div>

    <div v-else-if="documents === undefined" class="flex flex-col items-center justify-center py-24 space-y-4">
      <UIcon name="i-lucide-loader-2" class="w-10 h-10 animate-spin text-primary-500" />
      <span class="text-gray-500 font-medium">Loading stories...</span>
    </div>

    <div v-else-if="documents.length === 0" class="text-center py-24 border border-dashed border-gray-300 rounded-2xl">
      <div class="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <UIcon name="i-lucide-file-text" class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-xl font-semibold text-gray-900">No blogs published yet</h3>
      <p class="text-gray-500 mt-2 max-w-sm mx-auto">It looks like the database is empty. Check back
        later for new content!</p>
    </div>

    <div v-else class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="doc in documents" :key="doc._id"
        @click="navigateTo(`/blogs/${doc._id}`)"
        class="group hover:ring-2 hover:ring-primary-500/50 transition-all cursor-pointer flex flex-col overflow-hidden">
        <template #header>
          <div class="flex items-center gap-2 mb-2 text-xs font-medium text-primary-500">
            <UIcon name="i-lucide-hash" class="w-3.5 h-3.5" />
            <span>Document</span>
          </div>
          <h2 class="text-xl font-bold  line-clamp-1 leading-tight group-hover:text-primary-600 transition-colors">
            {{ doc.title || 'Untitled Document' }}
          </h2>
        </template>

        <p class=" line-clamp-3 grow text-sm leading-relaxed">
          {{ getPreviewText(doc.content) || 'No content available...' }}
        </p>

        <template #footer>
          <div class="text-xs  flex items-center justify-between w-full pt-2">
            <span class="flex items-center gap-1.5 font-medium">
              <UIcon name="i-lucide-calendar" class="w-4 h-4" />
              {{ new Date(doc._creationTime).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day:
                  'numeric'
              }) }}
            </span>
            <UButton size="sm" variant="ghost" color="primary"
              class="opacity-0 group-hover:opacity-100 transition-opacity -mr-2" trailing-icon="i-lucide-arrow-right">
              Read
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
