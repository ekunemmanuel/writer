<script setup lang="ts">
import { NodeViewWrapper, NodeViewContent, nodeViewProps } from '@tiptap/vue-3'
import { computed } from 'vue'
import {
  Info,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Quote,
  Bug,
  Lightbulb,
} from '@lucide/vue'

const props = defineProps(nodeViewProps)

const type = computed(() => props.node.attrs.type || 'note')

const config = computed(() => {
  switch (type.value.toLowerCase()) {
    case 'warning':
    case 'caution':
    case 'attention':
      return {
        icon: AlertTriangle,
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-950/30',
        border: 'border-orange-500',
        title: type.value.charAt(0).toUpperCase() + type.value.slice(1),
      }
    case 'danger':
    case 'error':
    case 'bug':
      return {
        icon: type.value === 'bug' ? Bug : XCircle,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-500',
        title: type.value.charAt(0).toUpperCase() + type.value.slice(1),
      }
    case 'success':
    case 'check':
    case 'done':
      return {
        icon: CheckCircle2,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-500',
        title: type.value.charAt(0).toUpperCase() + type.value.slice(1),
      }
    case 'tip':
    case 'hint':
    case 'important':
      return {
        icon: Flame,
        color: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950/30',
        border: 'border-teal-500',
        title: type.value.charAt(0).toUpperCase() + type.value.slice(1),
      }
    case 'question':
    case 'help':
    case 'faq':
      return {
        icon: HelpCircle,
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-950/30',
        border: 'border-green-500',
        title: type.value.charAt(0).toUpperCase() + type.value.slice(1),
      }
    case 'quote':
    case 'cite':
      return {
        icon: Quote,
        color: 'text-gray-600 dark:text-gray-400',
        bg: 'bg-gray-50 dark:bg-gray-900/50',
        border: 'border-gray-500',
        title: type.value.charAt(0).toUpperCase() + type.value.slice(1),
      }
    case 'idea':
      return {
        icon: Lightbulb,
        color: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-950/30',
        border: 'border-yellow-500',
        title: type.value.charAt(0).toUpperCase() + type.value.slice(1),
      }
    case 'note':
    case 'info':
    default:
      return {
        icon: type.value === 'info' ? Info : FileText,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50/50 dark:bg-blue-950/20',
        border: 'border-blue-500',
        title: type.value.charAt(0).toUpperCase() + type.value.slice(1),
      }
  }
})
</script>

<template>
  <node-view-wrapper class="my-4">
    <div :class="['relative rounded-r border-l-4 p-4 shadow-sm', config.bg, config.border]">
      <div :class="['flex items-center gap-2 font-bold mb-2', config.color]">
        <component :is="config.icon" class="w-5 h-5" />
        <span>{{ config.title }}</span>
      </div>
      <node-view-content class="text-surface-800 dark:text-surface-200 prose-p:my-1 text-[15px] leading-relaxed" />
    </div>
  </node-view-wrapper>
</template>

<style>
/* Remove margin from the last paragraph to avoid extra padding at the bottom */
.callout p:last-child {
  margin-bottom: 0;
}
</style>
