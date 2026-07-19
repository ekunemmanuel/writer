<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@writer/shared'
import RichTextEditor from './components/RichTextEditor.vue'
import Auth from './components/Auth.vue'

const { isAuthenticated } = useAuth()
const editorContent = ref('')
</script>

<template>
  <main class="h-screen flex flex-col">
    <Auth v-if="!isAuthenticated" />
    <RichTextEditor v-else v-model="editorContent" class="w-full h-full" />
  </main>
</template>

