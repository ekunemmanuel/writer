<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { ref, computed, onUnmounted } from 'vue'
import { AlignLeft, AlignCenter, AlignRight, Type } from '@lucide/vue'

const props = defineProps(nodeViewProps)

const imgRef = ref<HTMLImageElement | null>(null)

const isResizing = ref(false)
const resizeHandle = ref('')
const startX = ref(0)
const startY = ref(0)
const startWidth = ref(0)
const startHeight = ref(0)
const localWidth = ref<string | null>(null)
const localHeight = ref<string | null>(null)


const align = computed(() => props.node.attrs.align || 'center')
const width = computed(() => props.node.attrs.width || '100%')
const height = computed(() => props.node.attrs.height || 'auto')

const setAlign = (newAlign: string) => {
  props.updateAttributes({ align: newAlign })
}

// Resizing Logic
const onResizeStart = (event: MouseEvent, handle: string) => {
  event.preventDefault()
  isResizing.value = true
  resizeHandle.value = handle
  startX.value = event.clientX
  startY.value = event.clientY
  
  if (imgRef.value) {
    startWidth.value = imgRef.value.clientWidth
    startHeight.value = imgRef.value.clientHeight
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (event: MouseEvent) => {
  if (isResizing.value && imgRef.value) {
    const deltaX = event.clientX - startX.value
    const deltaY = event.clientY - startY.value
    
    let newWidth = startWidth.value
    let newHeight = startHeight.value
    
    // East / West
    if (resizeHandle.value.includes('e')) newWidth = Math.max(20, startWidth.value + deltaX)
    if (resizeHandle.value.includes('w')) newWidth = Math.max(20, startWidth.value - deltaX)
    
    // North / South
    if (resizeHandle.value.includes('s')) newHeight = Math.max(20, startHeight.value + deltaY)
    if (resizeHandle.value.includes('n')) newHeight = Math.max(20, startHeight.value - deltaY)
    
    if (resizeHandle.value.includes('e') || resizeHandle.value.includes('w')) {
      localWidth.value = `${newWidth}px`
    }
    if (resizeHandle.value.includes('s') || resizeHandle.value.includes('n')) {
      localHeight.value = `${newHeight}px`
    }
  }
}

const onMouseUp = () => {
  if (isResizing.value) {
    props.updateAttributes({ 
      width: localWidth.value || props.node.attrs.width,
      height: localHeight.value || props.node.attrs.height 
    })
    localWidth.value = null
    localHeight.value = null
  }
  
  isResizing.value = false
  
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <node-view-wrapper 
    ref="wrapperRef"
    :class="[
      'resizable-image-wrapper relative group inline-block',
      `align-${align}`,
      { 'is-selected': selected }
    ]"
    :style="{ 
      width: localWidth || (width !== '100%' ? width : 'auto'), 
      height: localHeight || (height !== 'auto' ? height : 'auto'),
      maxWidth: '100%'
    }"
  >
    <!-- Alignment Toolbar -->
    <div 
      v-if="selected" 
      class="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-lg rounded-md p-1 gap-1 z-50 pointer-events-auto cursor-default"
      @mousedown.stop
    >
      <button @click="setAlign('left')" :class="['p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': align === 'left' }]" title="Float Left">
        <AlignLeft class="w-4 h-4" />
      </button>
      <button @click="setAlign('center')" :class="['p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': align === 'center' }]" title="Center">
        <AlignCenter class="w-4 h-4" />
      </button>
      <button @click="setAlign('right')" :class="['p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': align === 'right' }]" title="Float Right">
        <AlignRight class="w-4 h-4" />
      </button>
      <button @click="setAlign('inline')" :class="['p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': align === 'inline' }]" title="Inline with Text">
        <Type class="w-4 h-4" />
      </button>
    </div>

    <!-- Image -->
    <img 
      ref="imgRef"
      data-drag-handle
      draggable="true"
      :src="node.attrs.src" 
      :alt="node.attrs.alt"
      :title="node.attrs.title"
      :class="[
        'w-full h-full object-fill outline-none',
        { 'ring-2 ring-primary-500': selected }
      ]"
      :style="{ width: localWidth || width, height: localHeight || height }"
    />

    <!-- 8 Resize Handles -->
    <template v-if="selected">
      <!-- Corners -->
      <div class="resize-handle top-0 left-0 cursor-nwse-resize -translate-x-1/2 -translate-y-1/2" @mousedown.stop="onResizeStart($event, 'nw')"></div>
      <div class="resize-handle top-0 right-0 cursor-nesw-resize translate-x-1/2 -translate-y-1/2" @mousedown.stop="onResizeStart($event, 'ne')"></div>
      <div class="resize-handle bottom-0 left-0 cursor-nesw-resize -translate-x-1/2 translate-y-1/2" @mousedown.stop="onResizeStart($event, 'sw')"></div>
      <div class="resize-handle bottom-0 right-0 cursor-nwse-resize translate-x-1/2 translate-y-1/2" @mousedown.stop="onResizeStart($event, 'se')"></div>
      
      <!-- Edges -->
      <div class="resize-handle top-0 left-1/2 cursor-ns-resize -translate-x-1/2 -translate-y-1/2" @mousedown.stop="onResizeStart($event, 'n')"></div>
      <div class="resize-handle bottom-0 left-1/2 cursor-ns-resize -translate-x-1/2 translate-y-1/2" @mousedown.stop="onResizeStart($event, 's')"></div>
      <div class="resize-handle left-0 top-1/2 cursor-ew-resize -translate-x-1/2 -translate-y-1/2" @mousedown.stop="onResizeStart($event, 'w')"></div>
      <div class="resize-handle right-0 top-1/2 cursor-ew-resize translate-x-1/2 -translate-y-1/2" @mousedown.stop="onResizeStart($event, 'e')"></div>
    </template>
  </node-view-wrapper>
</template>

<style>
.resizable-image-wrapper {
  transition: float 0.2s, margin 0.2s;
  display: inline-block;
  vertical-align: text-bottom;
}

/* Align Center (Block simulation inside inline) */
.resizable-image-wrapper.align-center {
  display: flex;
  justify-content: center;
  width: 100%; /* Force width to break lines */
  margin: 1rem 0;
  clear: both;
}

/* Align Left (Float) */
.resizable-image-wrapper.align-left {
  float: left;
  margin: 0.5rem 1.5rem 0.5rem 0;
}

/* Align Right (Float) */
.resizable-image-wrapper.align-right {
  float: right;
  margin: 0.5rem 0 0.5rem 1.5rem;
}

/* Inline */
.resizable-image-wrapper.align-inline {
  display: inline-block;
  float: none;
  margin: 0 0.25rem;
}

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: var(--color-primary-500, #3b82f6);
  border: 1px solid white;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0,0,0,0.3);
  z-index: 10;
}
</style>
