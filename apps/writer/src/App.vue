<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@writer/shared'
import Auth from './components/Auth.vue'
import { LoaderCircle } from "@lucide/vue"

const { isAuthenticated, isLoading } = useAuth()
const editorContent = ref('')
</script>

<template>
  <main class="h-screen flex flex-col overflow-hidden">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center p-4">
      <div class="flex flex-col items-center gap-3">
        <LoaderCircle class="animate-spin" />
        <span class="text-sm font-medium text-surface-400">Loading...</span>
      </div>
    </div>

    <!-- Auth State -->
    <Auth v-else-if="!isAuthenticated" />

    <!-- Vue Router View -->
    <router-view v-else v-model="editorContent" class="w-full h-full" />
  </main>
</template>
