<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { ResizableImage } from '@/extensions/ResizableImage'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import FontFamily from '@tiptap/extension-font-family'
import { Markdown } from 'tiptap-markdown'

import { FontSize } from '@/extensions/FontSize'
import { Indent } from '@/extensions/Indent'
import { LineHeight } from '@/extensions/LineHeight'
import { ParagraphShading } from '@/extensions/ParagraphShading'
import { Callout } from '@/extensions/Callout'

import { useRouter } from 'vue-router'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { convex, useQuery, useMutation, useAuth, parseConvexError } from '@writer/shared'
import MediaExplorerModal from '@/components/MediaExplorerModal.vue'

// Icons
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
  Undo, Redo, Table as TableIcon, PaintBucket, Highlighter, 
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Search, Pilcrow, Indent as IndentIcon, Outdent, 
  Trash2, Plus, ArrowDownToLine, ArrowRightToLine, ChevronDown,
  Eraser, Save, AArrowUp, AArrowDown, Type, AlignVerticalJustifyCenter,
  Loader2, Ban, Code, Quote, MessageSquare, Download, LogOut, Shield,
  Globe, FileText
} from '@lucide/vue'

const router = useRouter()
const { signOut } = useAuth()

const model = defineModel<string>({
  default: '',
})

// UI State
const showFindReplace = ref(false)
const activeDropdown = ref<string | null>(null)

const { data: currentUserRoles } = useQuery(api.permissions.getUserRoles)
const { data: userPermissions } = useQuery(api.permissions.getUserPermissions)
const isAdmin = computed(() => currentUserRoles.value?.includes('admin'))

const toggleDropdown = (name: string) => {
  activeDropdown.value = activeDropdown.value === name ? null : name
}
const closeDropdown = () => activeDropdown.value = null

const currentTextColor = ref('#000000')
const currentHighlightColor = ref('#ffff00')
const currentShadingColor = ref('#e5e7eb')

const documentName = ref('Untitled Document')
const currentDocumentId = ref<string | null>(null)
const currentDocUserId = ref<string | null>(null)
const editorScrollContainer = ref<HTMLElement | null>(null)

const { data: documents } = useQuery(api.documents.list)

const sortedDocuments = computed(() => {
  if (!documents.value) return []
  const ownDocs = (documents.value as any[]).filter(d => d.isOwn)
  const otherDocs = (documents.value as any[]).filter(d => !d.isOwn)
  return [...ownDocs, ...otherDocs]
})

const canEditCurrentDocument = computed(() => {
  if (!userPermissions.value) return false
  if (userPermissions.value.includes('*') || userPermissions.value.includes('doc.update')) {
    return true
  }
  // Check ownership if user has doc.update.own
  if (userPermissions.value.includes('doc.update.own')) {
    if (!currentDocumentId.value) {
      return userPermissions.value.includes('doc.create')
    }
    const loadedDoc = (documents.value as any[])?.find((d: any) => d._id === currentDocumentId.value)
    if (loadedDoc?.isOwn) return true
  }
  return false
})
const saveDoc = useMutation(api.documents.save)
const removeDoc = useMutation(api.documents.remove)
const togglePublishStatusMutation = useMutation(api.documents.togglePublishStatus)

const isCurrentDocPublished = computed(() => {
  if (!currentDocumentId.value || !documents.value) return false
  const doc = (documents.value as any[])?.find(d => d._id === currentDocumentId.value)
  return doc?.isPublished ?? false
})

const handleTogglePublish = async () => {
  if (!currentDocumentId.value || !canEditCurrentDocument.value) return
  const nextState = !isCurrentDocPublished.value
  try {
    await togglePublishStatusMutation({ id: currentDocumentId.value as Id<"documents">, isPublished: nextState })
  } catch (err: unknown) {
    alert(parseConvexError(err, "Failed to update document status."))
  }
}

const isSaving = ref(false)
const isDownloading = ref(false)
let saveTimeout: ReturnType<typeof setTimeout>
let isLoadingDocument = false

const isMediaExplorerOpen = ref(false)
const createImage = useMutation(api.images.create)

const userCanDeleteDoc = (doc: any) => {
  if (!userPermissions.value) return false
  if (userPermissions.value.includes('*') || userPermissions.value.includes('doc.delete')) {
    return true
  }
  if (doc.isOwn && userPermissions.value.includes('doc.delete.own')) {
    return true
  }
  return false
}

const handleMediaInsert = (payload: { url: string, imageId: string }) => {
  if (!canEditCurrentDocument.value) return
  editor.value?.chain().focus().setImage({ src: payload.url, imageId: payload.imageId } as any).run()
  isMediaExplorerOpen.value = false
}

const deleteDocument = async (id: string) => {
  const targetDoc = (documents.value as any[])?.find((d: any) => d._id === id)
  if (targetDoc && !userCanDeleteDoc(targetDoc)) return

  if (confirm("Are you sure you want to delete this document?")) {
    await removeDoc({ id: id as Id<"documents"> })
    if (currentDocumentId.value === id) {
      createNewDocument()
    }
  }
}

const isContentEmpty = (html: string): boolean => {
  if (!html) return true
  if (html.includes('<img')) return false
  
  const textContent = editor.value?.getText().trim() ?? ''
  if (textContent !== '') return false

  const sanitized = html.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>|<[^>]+>|\s/gi, '')
  return sanitized.length === 0
}

const saveDocument = async () => {
  if (!editor.value || !canEditCurrentDocument.value) return
  
  const htmlContent = editor.value.getHTML()
  const savingId = currentDocumentId.value
  const savingTitle = documentName.value
  
  // Prevent saving completely empty new documents
  if (!savingId && isContentEmpty(htmlContent)) {
    return
  }

  isSaving.value = true
  model.value = htmlContent
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlContent, 'text/html')
  const extractedImageIds = Array.from(doc.querySelectorAll('img'))
    .map(img => img.getAttribute('data-image-id'))
    .filter(Boolean) as string[]
  
  const uniqueImageIds = [...new Set(extractedImageIds)]
  
  try {
    const id = await saveDoc({
      id: savingId ? (savingId as Id<"documents">) : undefined,
      title: savingTitle,
      content: htmlContent,
      imageIds: uniqueImageIds as Id<"images">[],
    })
    
    // Only update ID if we haven't switched documents while waiting for network
    if (currentDocumentId.value === savingId) {
      currentDocumentId.value = id
    }
  } catch (error) {
    console.error("Failed to save:", error)
  }
  
  isSaving.value = false
}

const loadDocument = (doc: any) => {
  isLoadingDocument = true
  currentDocumentId.value = doc._id
  currentDocUserId.value = doc.userId
  documentName.value = doc.title
  editor.value?.commands.setContent(doc.content)
  
  if (editorScrollContainer.value) {
    editorScrollContainer.value.scrollTop = 0
  }
  
  closeDropdown()
  setTimeout(() => { isLoadingDocument = false }, 50)
}

const createNewDocument = () => {
  isLoadingDocument = true
  currentDocumentId.value = null
  currentDocUserId.value = null
  documentName.value = 'Untitled Document'
  model.value = ''
  editor.value?.commands.setContent('')
  
  if (editorScrollContainer.value) {
    editorScrollContainer.value.scrollTop = 0
  }
  
  closeDropdown()
  setTimeout(() => { isLoadingDocument = false }, 50)
}

const handleSignOut = async () => {
  if (editor.value && !editor.value.isEmpty) {
    await saveDocument()
  }
  createNewDocument()
  await signOut()
}

watch(documentName, (newVal: string, oldVal: string) => {
  if (isLoadingDocument) return
  if (newVal !== oldVal) {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(saveDocument, 2000)
  }
})

const exportHTML = async () => {
  if (!editor.value) return
  
  if (documentName.value.trim() === 'Untitled Document') {
    const newName = prompt('Before downloading, would you like to rename your document?', documentName.value)
    if (newName !== null && newName.trim() !== '') {
      documentName.value = newName.trim()
    }
  }

  isDownloading.value = true
  
  await new Promise(resolve => setTimeout(resolve, 600)) // Visual indicator
  
  const htmlContent = editor.value.getHTML()
  
  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Export</title>
  <style>
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 816px;
      margin: 40px auto;
      padding: 0 20px;
    }
    img { max-width: 100%; height: auto; }
    img[data-align="left"] { float: left; margin: 0.5rem 1.5rem 0.5rem 0; }
    img[data-align="right"] { float: right; margin: 0.5rem 0 0.5rem 1.5rem; }
    img[data-align="center"] { display: block; margin: 1rem auto; text-align: center; }
    img[data-align="inline"] { display: inline-block; margin: 0 0.25rem; }
    blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 16px; font-style: italic; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
  `
  
  const blob = new Blob([fullHtml], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = documentName.value.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'document'
  a.download = `${safeName}.html`
  a.click()
  URL.revokeObjectURL(url)
  
  isDownloading.value = false
}

const editor = useEditor({
  content: model.value,
  editorProps: {
    attributes: { spellcheck: 'true' },
  },
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: false,
      underline: false,
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'left' }),
    Link.configure({ openOnClick: false }),
    ResizableImage,
    Placeholder.configure({ placeholder: 'Start writing...' }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    Subscript,
    Superscript,
    FontFamily,
    FontSize,
    Indent,
    LineHeight,
    ParagraphShading,
    Callout,
    Markdown.configure({
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ],
  onSelectionUpdate: ({ editor }) => {
    currentTextColor.value = editor.getAttributes('textStyle').color || '#000000'
    currentHighlightColor.value = editor.getAttributes('highlight').color || '#ffff00'
    currentShadingColor.value = editor.getAttributes('paragraph').shading || '#e5e7eb'
  },
  onUpdate: ({ editor }) => {
    if (isLoadingDocument || !canEditCurrentDocument.value) return
    model.value = editor.getHTML()
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(saveDocument, 2000)
  },
})

onBeforeUnmount(() => {
  clearTimeout(saveTimeout)
})

watch([editor, canEditCurrentDocument], ([ed, canEdit]) => {
  if (ed) {
    ed.setEditable(canEdit)
  }
}, { immediate: true })

// Computed State
const currentHeading = computed(() => {
  if (!editor.value) return 'P'
  if (editor.value.isActive('heading', { level: 1 })) return 'H1'
  if (editor.value.isActive('heading', { level: 2 })) return 'H2'
  if (editor.value.isActive('heading', { level: 3 })) return 'H3'
  if (editor.value.isActive('heading', { level: 4 })) return 'H4'
  if (editor.value.isActive('heading', { level: 5 })) return 'H5'
  if (editor.value.isActive('heading', { level: 6 })) return 'H6'
  return 'P'
})

const currentFontSize = computed(() => {
  if (!editor.value) return '16'
  const size = editor.value.getAttributes('textStyle').fontSize
  return size ? size.replace('px', '') : '16'
})

const currentFontFamily = computed(() => {
  if (!editor.value) return 'Default Font'
  const family = editor.value.getAttributes('textStyle').fontFamily
  return family ? family.replace(/['"]/g, '') : 'Default Font'
})

// Heading Command
const setHeading = (level: number) => {
  if (level === 0) {
    editor.value?.chain().focus().setParagraph().run()
  } else {
    editor.value?.chain().focus().toggleHeading({ level: level as any }).run()
  }
  closeDropdown()
}

// Find & Replace
const findText = ref('')
const replaceText = ref('')
const doReplaceNext = () => {
  if (!findText.value || !editor.value) return
  const { doc } = editor.value.state
  let found = false
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.isText && node.text) {
      const index = node.text.toLowerCase().indexOf(findText.value.toLowerCase())
      if (index !== -1) {
        const start = pos + index
        const end = start + findText.value.length
        editor.value?.commands.deleteRange({ from: start, to: end })
        editor.value?.commands.insertContentAt(start, replaceText.value)
        found = true
      }
    }
  })
}

// Formatting Marks
const showFormattingMarks = ref(false)

// Change Case
const applyCase = (type: 'sentence' | 'lower' | 'upper' | 'capitalize' | 'toggle') => {
  if (!editor.value) return
  const { from, to } = editor.value.state.selection
  if (from === to) return
  const text = editor.value.state.doc.textBetween(from, to, ' ')
  if (!text) return
  
  let newText = text
  switch (type) {
    case 'sentence':
      newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
      break
    case 'lower':
      newText = text.toLowerCase()
      break
    case 'upper':
      newText = text.toUpperCase()
      break
    case 'capitalize':
      newText = text.replace(/\b\w/g, l => l.toUpperCase())
      break
    case 'toggle':
      newText = text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('')
      break
  }
  
  editor.value.commands.insertContentAt({ from, to }, newText)
  closeDropdown()
}

// Font Commands
const setFontSize = (size: string) => {
  editor.value?.chain().focus().setFontSize(`${size}px`).run()
  closeDropdown()
}

const setFontFamily = (family: string) => {
  if (family === '') {
    editor.value?.chain().focus().unsetFontFamily().run()
  } else {
    editor.value?.chain().focus().setFontFamily(family).run()
  }
  closeDropdown()
}

const changeFontSize = (delta: number) => {
  if (!editor.value) return
  const numericSize = parseInt(currentFontSize.value) || 16
  const newSize = Math.max(8, numericSize + delta)
  editor.value.chain().focus().setFontSize(`${newSize}px`).run()
}

// Smart Links
const toggleLink = () => {
  if (editor.value?.isActive('link')) {
    editor.value.chain().focus().unsetLink().run()
    return
  }
  
  const previousUrl = editor.value?.getAttributes('link').href
  const url = window.prompt('URL', previousUrl)
  if (url === null) return
  if (url === '') {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  
  let finalUrl = url
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
    finalUrl = `https://${url}`
  }
  
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run()
}

const generateUploadUrl = useMutation(api.storage.generateUploadUrl)

const addImage = async () => {
  if (!canEditCurrentDocument.value) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      try {
        isSaving.value = true
        
        // 1. Generate short-lived upload URL
        const uploadUrl = await generateUploadUrl({})
        
        // 2. POST the file to the URL
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        })
        const { storageId } = await result.json()
        
        // 3. Get the public URL for the file
        const url = await convex.query(api.storage.getFileUrl, { storageId })
        
        if (url) {
          const imageId = await createImage({ storageId, url, name: file.name })
          editor.value?.chain().focus().setImage({ src: url, imageId } as any).run()
        }
      } catch (error: unknown) {
        console.error("Failed to upload image:", error)
        alert(parseConvexError(error, "Failed to upload image. Please try again."))
      } finally {
        isSaving.value = false
      }
    }
  }
  input.click()
}

const insertTable = () => editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()

// Color Palettes
const colorPalette = [
  '#000000', '#444444', '#666666', '#999999', '#cccccc', '#eeeeee', '#f3f6f9', '#ffffff',
  '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff',
  '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7', '#a64d79',
  '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#0b5394', '#351c75', '#741b47'
]

// Handlers for Colors
const applyTextColor = () => editor.value?.chain().focus().setColor(currentTextColor.value).run()
const selectTextColor = (color: string) => {
  currentTextColor.value = color
  applyTextColor()
  closeDropdown()
}
const removeTextColor = () => {
  editor.value?.chain().focus().unsetColor().run()
  closeDropdown()
}

const applyHighlightColor = () => editor.value?.chain().focus().toggleHighlight({ color: currentHighlightColor.value }).run()
const selectHighlightColor = (color: string) => {
  currentHighlightColor.value = color
  applyHighlightColor()
  closeDropdown()
}
const removeHighlightColor = () => {
  editor.value?.chain().focus().unsetHighlight().run()
  closeDropdown()
}

const applyShadingColor = () => editor.value?.chain().focus().setShading(currentShadingColor.value).run()
const selectShadingColor = (color: string) => {
  currentShadingColor.value = color
  applyShadingColor()
  closeDropdown()
}
const removeShadingColor = () => {
  editor.value?.chain().focus().unsetShading().run()
  closeDropdown()
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface-100 dark:bg-surface-950 relative">
    
    <!-- App Header (Moved from App.vue) -->
    <header class="h-12 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex items-center px-4 shrink-0 shadow-sm z-60 justify-between">
      
      <div class="w-1/3 flex items-center gap-2">
        <div class="font-bold tracking-tight text-primary-600 dark:text-primary-500">Writer</div>
        
        <div class="relative">
          <button @click="toggleDropdown('documents')" class="text-xs font-semibold px-2.5 py-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded flex items-center gap-1.5 text-surface-700 dark:text-surface-200 border border-surface-200 dark:border-surface-700 transition-colors shadow-2xs">
            <span>Documents Explorer</span> <ChevronDown class="w-3 h-3 opacity-60" />
          </button>
          
          <div v-if="activeDropdown === 'documents'" class="absolute z-60 top-full mt-1.5 left-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl min-w-72 max-w-80 text-xs py-1.5 overflow-hidden">
            <button @click="createNewDocument" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 text-primary-600 dark:text-primary-400 font-bold flex items-center gap-2">
              <Plus class="w-4 h-4" /> Create New Document
            </button>
            <div class="w-full h-px bg-surface-200 dark:bg-surface-700 my-1"></div>
            
            <div class="max-h-80 overflow-y-auto no-scrollbar divide-y divide-surface-100 dark:divide-surface-700/50">
              <div v-if="!documents" class="px-3 py-2 text-surface-400 italic">Loading documents...</div>
              <div v-else-if="sortedDocuments.length === 0" class="px-3 py-2 text-surface-400 italic">No saved documents</div>
              
              <div 
                v-for="doc in sortedDocuments" 
                :key="doc._id" 
                :class="[
                  'flex items-center justify-between w-full px-3 py-2 group transition-colors',
                  currentDocumentId === doc._id 
                    ? 'bg-primary-50/90 dark:bg-primary-950/60 border-l-2 border-primary-600 dark:border-primary-400 text-primary-950 dark:text-primary-100 font-medium' 
                    : 'hover:bg-surface-50 dark:hover:bg-surface-700/60 text-surface-900 dark:text-surface-100'
                ]"
              >
                <button @click="loadDocument(doc)" class="text-left flex-1 min-w-0 mr-2 cursor-pointer flex items-center justify-between">
                  <div class="min-w-0 flex-1">
                    <div class="font-medium truncate flex items-center gap-1.5" :title="doc.title || 'Untitled Document'">
                      <span class="truncate">{{ doc.title || 'Untitled Document' }}</span>
                      <span :class="[
                        'px-1.5 py-0.2 text-[9px] font-bold rounded uppercase tracking-wider shrink-0 border',
                        doc.isPublished ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      ]">
                        {{ doc.isPublished ? 'Published' : 'Draft' }}
                      </span>
                    </div>
                    <div class="text-[11px] text-surface-500 dark:text-surface-400 truncate flex items-center gap-1.5 mt-0.5">
                      <span v-if="doc.isOwn" class="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Your document"></span>
                      <span>{{ doc.authorEmail }}</span>
                    </div>
                  </div>
                </button>
                <button v-if="userCanDeleteDoc(doc)" @click.stop="deleteDocument(doc._id)" class="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-red-500 rounded transition-opacity cursor-pointer" title="Delete Document">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="w-1/3 flex items-center justify-center gap-2">
        <input 
          v-if="canEditCurrentDocument"
          v-model="documentName" 
          class="text-center text-sm font-medium text-surface-600 dark:text-surface-300 bg-transparent border border-transparent hover:border-surface-300 rounded px-2 py-1 outline-none transition-colors w-full max-w-50" 
        />
        <span v-else class="text-center text-sm font-bold text-surface-800 dark:text-surface-200 truncate max-w-60 cursor-default" :title="documentName">
          {{ documentName }}
        </span>

        <!-- <div v-if="!canEditCurrentDocument" class="flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 rounded-md shrink-0 shadow-2xs">
          <Eye class="w-3.5 h-3.5" /> Read Only
        </div> -->
      </div>
      
      <div class="w-1/3 flex items-center justify-end gap-1">
        <template v-if="canEditCurrentDocument">
          <button @click="editor?.chain().focus().undo().run()" :disabled="!editor?.can().undo()" class="toolbar-btn min-h-7! min-w-7! opacity-70 hover:opacity-100" title="Undo"><Undo class="w-4 h-4" /></button>
          <button @click="editor?.chain().focus().redo().run()" :disabled="!editor?.can().redo()" class="toolbar-btn min-h-7! min-w-7! opacity-70 hover:opacity-100" title="Redo"><Redo class="w-4 h-4" /></button>
          
          <div class="w-px h-5 bg-surface-300 dark:bg-surface-700 mx-1"></div>

          <button @click="saveDocument" class="toolbar-btn min-h-7! min-w-7! p-1" title="Save">
            <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin text-primary-500" />
            <Save v-else class="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </button>
          <button @click="exportHTML" class="toolbar-btn min-h-7! min-w-7! p-1 text-primary-600 dark:text-primary-400" title="Download as HTML">
            <Loader2 v-if="isDownloading" class="w-4 h-4 animate-spin" />
            <Download v-else class="w-4 h-4" />
          </button>

          <!-- Interactive Publish / Draft Toggle Button -->
          <button
            v-if="currentDocumentId"
            @click="handleTogglePublish"
            :class="[
              'flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-md border transition-all cursor-pointer shadow-2xs ml-1',
              isCurrentDocPublished
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200'
                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-200'
            ]"
            :title="isCurrentDocPublished ? 'Published: Visible to web readers. Click to toggle to Draft.' : 'Draft: Only visible to editors. Click to Publish.'"
          >
            <Globe v-if="isCurrentDocPublished" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <FileText v-else class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{{ isCurrentDocPublished ? 'Published' : 'Draft' }}</span>
          </button>
          
          <div class="w-px h-5 bg-surface-300 dark:bg-surface-700 mx-1"></div>
        </template>
        <button
          v-if="isAdmin"
          @click="router.push('/admin')"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/70 hover:bg-purple-200 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 rounded-md transition-colors shadow-sm ml-1 cursor-pointer"
          title="Open Full Admin Portal"
        >
          <Shield class="w-3.5 h-3.5" /> Admin Portal
        </button>

        <button @click="handleSignOut" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm ml-2" title="Sign Out">
          <LogOut class="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </header>

    <!-- Global Clickaway Overlay for Dropdowns -->
    <div v-if="activeDropdown" class="fixed inset-0 z-40" @click="closeDropdown"></div>

    <!-- Read-Only Banner Bar (Rendered when user lacks edit permissions) -->
    <!-- <div v-if="!canEditCurrentDocument" class="h-12 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900 flex items-center justify-center px-4 shrink-0 shadow-2xs z-50">
      <div class="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
        <Eye class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Read-Only Mode: You are viewing this document. Editing, formatting, and media insertion are disabled.</span>
      </div>
    </div> -->

    <!-- Ribbon Toolbar (Rendered ONLY when user HAS edit permission) -->
    <div v-if="canEditCurrentDocument && editor" class="flex flex-col shrink-0 bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 z-50 shadow-sm relative">
      <div class="flex flex-wrap items-center gap-1 px-3 py-2">
        
        <!-- Font Family & Size -->
        <div :class="['relative', activeDropdown === 'fontFamily' ? 'z-50' : 'z-30']">
          <button @click="toggleDropdown('fontFamily')" class="toolbar-select w-26 flex items-center justify-between px-2 py-1 text-xs truncate bg-white dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700">
            <span class="truncate">{{ currentFontFamily }}</span>
            <ChevronDown class="w-3 h-3 ml-1 shrink-0 opacity-50" />
          </button>
          <div v-if="activeDropdown === 'fontFamily'" class="absolute top-full mt-1 left-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg py-1 min-w-50 text-xs max-h-75 overflow-y-auto no-scrollbar">
            <button @click="setFontFamily('')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">Default Font</button>
            <button @click="setFontFamily('Arial')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-[Arial]">Arial</button>
            <button @click="setFontFamily('Comic Sans MS')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap" style="font-family: 'Comic Sans MS'">Comic Sans MS</button>
            <button @click="setFontFamily('Courier New')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap" style="font-family: 'Courier New'">Courier New</button>
            <button @click="setFontFamily('Garamond')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-[Garamond]">Garamond</button>
            <button @click="setFontFamily('Georgia')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-[Georgia]">Georgia</button>
            <button @click="setFontFamily('Helvetica')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-[Helvetica]">Helvetica</button>
            <button @click="setFontFamily('Impact')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-[Impact]">Impact</button>
            <button @click="setFontFamily('Tahoma')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-[Tahoma]">Tahoma</button>
            <button @click="setFontFamily('Times New Roman')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap" style="font-family: 'Times New Roman'">Times New Roman</button>
            <button @click="setFontFamily('Trebuchet MS')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap" style="font-family: 'Trebuchet MS'">Trebuchet MS</button>
            <button @click="setFontFamily('Verdana')" class="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-[Verdana]">Verdana</button>
          </div>
        </div>
        
        <div :class="['relative', activeDropdown === 'fontSize' ? 'z-50' : 'z-30']">
          <button @click="toggleDropdown('fontSize')" class="toolbar-select w-12 flex items-center justify-between px-1.5 py-1 text-xs bg-white dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700">
            <span>{{ currentFontSize }}</span>
            <ChevronDown class="w-3 h-3 ml-0.5 shrink-0 opacity-50" />
          </button>
          <div v-if="activeDropdown === 'fontSize'" class="absolute top-full mt-1 left-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg py-1 min-w-12 text-xs max-h-64 overflow-y-auto no-scrollbar">
            <button v-for="size in ['8','9','10','11','12','14','16','18','20','22','24','26','28','36','48','72']" :key="size" @click="setFontSize(size)" class="w-full text-center px-2 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">
              {{ size }}
            </button>
          </div>
        </div>

        <button @click="changeFontSize(2)" class="toolbar-btn min-h-6! min-w-6!" title="Increase Font Size"><AArrowUp class="w-3.5 h-3.5" /></button>
        <button @click="changeFontSize(-2)" class="toolbar-btn min-h-6! min-w-6!" title="Decrease Font Size"><AArrowDown class="w-3.5 h-3.5" /></button>

        <div class="w-px h-4 bg-surface-300 dark:bg-surface-700 mx-0.5"></div>

        <!-- Formatting & Headers -->
        <button @click="editor?.chain().focus().toggleBold().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('bold') }]" title="Bold"><Bold class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().toggleItalic().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('italic') }]" title="Italic"><Italic class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().toggleUnderline().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('underline') }]" title="Underline"><UnderlineIcon class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().toggleStrike().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('strike') }]" title="Strikethrough"><Strikethrough class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().toggleBlockquote().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('blockquote') }]" title="Blockquote"><Quote class="w-3.5 h-3.5" /></button>
        
        <div :class="['relative', activeDropdown === 'callout' ? 'z-50' : 'z-30']">
          <button @click="toggleDropdown('callout')" :class="['toolbar-btn min-h-6! min-w-6! flex items-center gap-0.5', { 'is-active': editor?.isActive('callout') }]" title="Callout / Alert">
            <MessageSquare class="w-3.5 h-3.5" /><ChevronDown class="w-2.5 h-2.5 -ml-0.5 opacity-60" />
          </button>
          <div v-if="activeDropdown === 'callout'" class="absolute top-full mt-1 left-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg min-w-30 text-sm py-1">
            <button @click="editor?.chain().focus().toggleCallout({ type: 'note' }).run(); closeDropdown()" class="w-full text-left px-3 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-blue-500"></div> Note</button>
            <button @click="editor?.chain().focus().toggleCallout({ type: 'info' }).run(); closeDropdown()" class="w-full text-left px-3 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-blue-400"></div> Info</button>
            <button @click="editor?.chain().focus().toggleCallout({ type: 'warning' }).run(); closeDropdown()" class="w-full text-left px-3 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-orange-500"></div> Warning</button>
            <button @click="editor?.chain().focus().toggleCallout({ type: 'error' }).run(); closeDropdown()" class="w-full text-left px-3 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-red-500"></div> Error</button>
            <button @click="editor?.chain().focus().toggleCallout({ type: 'success' }).run(); closeDropdown()" class="w-full text-left px-3 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-emerald-500"></div> Success</button>
            <button @click="editor?.chain().focus().toggleCallout({ type: 'tip' }).run(); closeDropdown()" class="w-full text-left px-3 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-teal-500"></div> Tip</button>
          </div>
        </div>

        <button @click="editor?.chain().focus().toggleCodeBlock().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('codeBlock') }]" title="Code Block"><Code class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().unsetSuperscript().toggleSubscript().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('subscript') }]" title="Subscript"><SubscriptIcon class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().unsetSubscript().toggleSuperscript().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('superscript') }]" title="Superscript"><SuperscriptIcon class="w-3.5 h-3.5" /></button>

        <div :class="['relative', activeDropdown === 'case' ? 'z-50' : 'z-30']">
          <button @click="toggleDropdown('case')" class="toolbar-btn min-h-6! min-w-6! flex items-center gap-0.5" title="Change Case">
            <Type class="w-3.5 h-3.5" /><ChevronDown class="w-2.5 h-2.5 -ml-0.5 opacity-60" />
          </button>
          <div v-if="activeDropdown === 'case'" class="absolute top-full mt-1 left-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg min-w-40 text-sm py-1">
            <button @click="applyCase('sentence')" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">Sentence case.</button>
            <button @click="applyCase('lower')" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">lowercase</button>
            <button @click="applyCase('upper')" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">UPPERCASE</button>
            <button @click="applyCase('capitalize')" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">Capitalize Each Word</button>
            <button @click="applyCase('toggle')" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">tOGGLE cASE</button>
          </div>
        </div>

        <button @click="editor?.chain().focus().clearNodes().unsetAllMarks().run()" class="toolbar-btn min-h-6! min-w-6! text-red-500 hover:text-red-600 dark:hover:text-red-400" title="Clear Formatting"><Eraser class="w-3.5 h-3.5" /></button>
        
        <div :class="['relative', activeDropdown === 'heading' ? 'z-50' : 'z-30']">
          <button @click="toggleDropdown('heading')" class="toolbar-select w-12 flex items-center justify-between px-1.5 py-1 text-xs truncate bg-white dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700" title="Heading Level">
            <span class="truncate">{{ currentHeading }}</span>
            <ChevronDown class="w-3 h-3 ml-0.5 shrink-0 opacity-50" />
          </button>
          <div v-if="activeDropdown === 'heading'" class="absolute top-full mt-1 left-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg min-w-30 text-sm py-1">
            <button @click="setHeading(0)" :class="['w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': currentHeading === 'P' }]">Normal</button>
            <button @click="setHeading(1)" :class="['w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-bold text-xl', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': currentHeading === 'H1' }]">Heading 1</button>
            <button @click="setHeading(2)" :class="['w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-bold text-lg', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': currentHeading === 'H2' }]">Heading 2</button>
            <button @click="setHeading(3)" :class="['w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-bold text-base', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': currentHeading === 'H3' }]">Heading 3</button>
            <button @click="setHeading(4)" :class="['w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-bold text-sm', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': currentHeading === 'H4' }]">Heading 4</button>
            <button @click="setHeading(5)" :class="['w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-bold text-xs', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': currentHeading === 'H5' }]">Heading 5</button>
            <button @click="setHeading(6)" :class="['w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap font-bold text-[10px]', { 'text-primary-600 bg-surface-50 dark:bg-surface-700': currentHeading === 'H6' }]">Heading 6</button>
          </div>
        </div>

        <div class="w-px h-4 bg-surface-300 dark:bg-surface-700 mx-0.5"></div>

        <!-- Colors -->
        <div class="flex items-center bg-surface-100 dark:bg-surface-800 rounded">
          <button @click="applyTextColor" class="toolbar-btn min-h-6! min-w-6! rounded-r-none! relative hover:bg-surface-200 dark:hover:bg-surface-700" title="Text Color">
            <div class="flex flex-col items-center">
              <span class="font-serif font-bold text-xs leading-none">A</span>
              <div class="w-3 h-1 mt-0.5" :style="{ backgroundColor: currentTextColor }"></div>
            </div>
          </button>
          <div :class="['relative', activeDropdown === 'textColor' ? 'z-50' : 'z-30']">
            <button @click="toggleDropdown('textColor')" class="toolbar-btn min-h-6! min-w-6! rounded-l-none! border-l border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-700" title="Choose Text Color">
              <ChevronDown class="w-3 h-3" />
            </button>
            <div v-if="activeDropdown === 'textColor'" class="absolute top-full mt-1 left-0 md:-ml-8 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg p-2 min-w-40">
              <button @click="removeTextColor" class="w-full flex items-center justify-center gap-2 text-xs py-1.5 mb-2 rounded hover:bg-surface-100 dark:hover:bg-surface-700">
                <Ban class="w-3.5 h-3.5 text-red-500" /> Remove Color
              </button>
              <div class="grid grid-cols-8 gap-1">
                <button v-for="color in colorPalette" :key="color" @click="selectTextColor(color)" class="w-4 h-4 rounded-sm border border-black/10 dark:border-white/10 hover:scale-110 transition-transform cursor-pointer" :style="{ backgroundColor: color }" :title="color"></button>
              </div>
              <div class="mt-2 pt-2 border-t border-surface-200 dark:border-surface-700 flex justify-center">
                <label class="text-xs text-primary-600 dark:text-primary-400 cursor-pointer hover:underline">
                  Custom Color...
                  <input type="color" class="opacity-0 absolute w-0 h-0" @input="e => selectTextColor((e.target as HTMLInputElement).value)" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center bg-surface-100 dark:bg-surface-800 rounded">
          <button @click="applyHighlightColor" class="toolbar-btn min-h-6! min-w-6! rounded-r-none! relative hover:bg-surface-200 dark:hover:bg-surface-700" title="Highlight Color">
            <div class="flex flex-col items-center">
              <Highlighter class="w-3.5 h-3.5" />
              <div class="w-3 h-1 mt-0.5 border border-surface-300 dark:border-surface-600" :style="{ backgroundColor: currentHighlightColor }"></div>
            </div>
          </button>
          <div :class="['relative', activeDropdown === 'highlightColor' ? 'z-50' : 'z-30']">
            <button @click="toggleDropdown('highlightColor')" class="toolbar-btn min-h-6! w-4! px-0! rounded-l-none! border-l border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-700" title="Choose Highlight Color">
              <ChevronDown class="w-3 h-3" />
            </button>
            <div v-if="activeDropdown === 'highlightColor'" class="absolute top-full mt-1 left-0 md:-ml-8 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg p-2 min-w-40">
              <button @click="removeHighlightColor" class="w-full flex items-center justify-center gap-2 text-xs py-1.5 mb-2 rounded hover:bg-surface-100 dark:hover:bg-surface-700">
                <Ban class="w-3.5 h-3.5 text-red-500" /> No Highlight
              </button>
              <div class="grid grid-cols-8 gap-1">
                <button v-for="color in colorPalette" :key="color" @click="selectHighlightColor(color)" class="w-4 h-4 rounded-sm border border-black/10 dark:border-white/10 hover:scale-110 transition-transform cursor-pointer" :style="{ backgroundColor: color }" :title="color"></button>
              </div>
              <div class="mt-2 pt-2 border-t border-surface-200 dark:border-surface-700 flex justify-center">
                <label class="text-xs text-primary-600 dark:text-primary-400 cursor-pointer hover:underline">
                  Custom Color...
                  <input type="color" class="opacity-0 absolute w-0 h-0" @input="e => selectHighlightColor((e.target as HTMLInputElement).value)" />
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <div class="flex items-center bg-surface-100 dark:bg-surface-800 rounded">
          <button @click="applyShadingColor" class="toolbar-btn min-h-6! min-w-6! rounded-r-none! relative hover:bg-surface-200 dark:hover:bg-surface-700" title="Shading">
            <div class="flex flex-col items-center">
              <PaintBucket class="w-3 h-3" />
              <div class="w-3 h-1 mt-0.5 border border-surface-300 dark:border-surface-600" :style="{ backgroundColor: currentShadingColor }"></div>
            </div>
          </button>
          <div :class="['relative', activeDropdown === 'shadingColor' ? 'z-50' : 'z-30']">
            <button @click="toggleDropdown('shadingColor')" class="toolbar-btn min-h-6! w-4! px-0! rounded-l-none! border-l border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-700" title="Choose Shading Color">
              <ChevronDown class="w-3 h-3" />
            </button>
            <div v-if="activeDropdown === 'shadingColor'" class="absolute top-full mt-1 left-0 md:-ml-8 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg p-2 min-w-40">
              <button @click="removeShadingColor" class="w-full flex items-center justify-center gap-2 text-xs py-1.5 mb-2 rounded hover:bg-surface-100 dark:hover:bg-surface-700">
                <Ban class="w-3.5 h-3.5 text-red-500" /> No Shading
              </button>
              <div class="grid grid-cols-8 gap-1">
                <button v-for="color in colorPalette" :key="color" @click="selectShadingColor(color)" class="w-4 h-4 rounded-sm border border-black/10 dark:border-white/10 hover:scale-110 transition-transform cursor-pointer" :style="{ backgroundColor: color }" :title="color"></button>
              </div>
              <div class="mt-2 pt-2 border-t border-surface-200 dark:border-surface-700 flex justify-center">
                <label class="text-xs text-primary-600 dark:text-primary-400 cursor-pointer hover:underline">
                  Custom Color...
                  <input type="color" class="opacity-0 absolute w-0 h-0" @input="e => selectShadingColor((e.target as HTMLInputElement).value)" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="w-px h-4 bg-surface-300 dark:bg-surface-700 mx-0.5"></div>

        <!-- Utility & Inserts -->
        <button @click="showFormattingMarks = !showFormattingMarks" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': showFormattingMarks }]" title="Show Formatting Marks"><Pilcrow class="w-3.5 h-3.5" /></button>
        <button @click="showFindReplace = !showFindReplace" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': showFindReplace }]" title="Find & Replace"><Search class="w-3.5 h-3.5" /></button>
        <button @click="insertTable" class="toolbar-btn min-h-6! min-w-6!" title="Insert Table"><TableIcon class="w-3.5 h-3.5" /></button>
        <button @click="toggleLink" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('link') }]" title="Toggle Link"><LinkIcon class="w-3.5 h-3.5" /></button>
        
        <div :class="['relative', activeDropdown === 'image' ? 'z-50' : 'z-30']">
          <button @click="toggleDropdown('image')" class="toolbar-btn min-h-6! min-w-6! flex items-center gap-0.5" title="Insert Image">
            <ImageIcon class="w-3.5 h-3.5" /><ChevronDown class="w-2.5 h-2.5 -ml-0.5 opacity-60" />
          </button>
          <div v-if="activeDropdown === 'image'" class="absolute top-full mt-1 left-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg min-w-50 text-sm py-1">
            <button @click="addImage(); closeDropdown()" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap flex items-center gap-2"><ImageIcon class="w-4 h-4"/> Upload from computer</button>
            <button @click="isMediaExplorerOpen = true; closeDropdown()" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap flex items-center gap-2"><ImageIcon class="w-4 h-4"/> Select from internal</button>
          </div>
        </div>

        <div class="w-px h-4 bg-surface-300 dark:bg-surface-700 mx-0.5"></div>

        <!-- Paragraph & Lists -->
        <button @click="editor?.chain().focus().setTextAlign('left').run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive({ textAlign: 'left' }) }]" title="Align Left"><AlignLeft class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().setTextAlign('center').run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive({ textAlign: 'center' }) }]" title="Align Center"><AlignCenter class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().setTextAlign('right').run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive({ textAlign: 'right' }) }]" title="Align Right"><AlignRight class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().setTextAlign('justify').run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive({ textAlign: 'justify' }) }]" title="Justify"><AlignJustify class="w-3.5 h-3.5" /></button>
        
        <div :class="['relative', activeDropdown === 'lineSpacing' ? 'z-50' : 'z-30']">
          <button @click="toggleDropdown('lineSpacing')" class="toolbar-btn min-h-6! min-w-6! flex items-center gap-0.5" title="Line Spacing">
            <AlignVerticalJustifyCenter class="w-3.5 h-3.5" /><ChevronDown class="w-2.5 h-2.5 -ml-0.5 opacity-60" />
          </button>
          <div v-if="activeDropdown === 'lineSpacing'" class="absolute top-full mt-1 right-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded shadow-lg py-1 min-w-25 text-sm">
            <button @click="editor?.chain().focus().setLineHeight('1.0').run(); closeDropdown()" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">1.0</button>
            <button @click="editor?.chain().focus().setLineHeight('1.15').run(); closeDropdown()" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">1.15</button>
            <button @click="editor?.chain().focus().setLineHeight('1.5').run(); closeDropdown()" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">1.5</button>
            <button @click="editor?.chain().focus().setLineHeight('2.0').run(); closeDropdown()" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">2.0</button>
            <button @click="editor?.chain().focus().setLineHeight('3.0').run(); closeDropdown()" class="w-full text-left px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-primary-600 whitespace-nowrap">3.0</button>
          </div>
        </div>

        <div class="w-px h-4 bg-surface-300 dark:bg-surface-700 mx-0.5"></div>

        <button @click="editor?.chain().focus().toggleBulletList().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('bulletList') }]" title="Bullet List"><List class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().toggleOrderedList().run()" :class="['toolbar-btn min-h-6! min-w-6!', { 'is-active': editor?.isActive('orderedList') }]" title="Numbered List"><ListOrdered class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().outdent().run()" class="toolbar-btn min-h-6! min-w-6!" title="Decrease Indent"><Outdent class="w-3.5 h-3.5" /></button>
        <button @click="editor?.chain().focus().indent().run()" class="toolbar-btn min-h-6! min-w-6!" title="Increase Indent"><IndentIcon class="w-3.5 h-3.5" /></button>

        <!-- Table Controls (Visible only when in a table) -->
        <div v-if="editor?.isActive('table')" class="flex items-center gap-1 bg-primary-50 dark:bg-primary-900/20 p-0.5 rounded-md border border-primary-200 dark:border-primary-800 ml-1">
          <button @click="editor?.chain().focus().addRowAfter().run()" class="toolbar-btn text-primary-700 dark:text-primary-300 min-h-5! px-1! py-0!" title="Add Row"><Plus class="w-2.5 h-2.5" /><ArrowDownToLine class="w-2.5 h-2.5 -ml-0.5" /></button>
          <button @click="editor?.chain().focus().addColumnAfter().run()" class="toolbar-btn text-primary-700 dark:text-primary-300 min-h-5! px-1! py-0!" title="Add Column"><Plus class="w-2.5 h-2.5" /><ArrowRightToLine class="w-2.5 h-2.5 -ml-0.5" /></button>
          <button @click="editor?.chain().focus().deleteRow().run()" class="toolbar-btn text-red-600 dark:text-red-400 min-h-5! px-1.5! py-0!" title="Delete Row"><Trash2 class="w-2.5 h-2.5" /></button>
          <button @click="editor?.chain().focus().deleteTable().run()" class="toolbar-btn text-red-600 dark:text-red-400 min-h-5! px-1! py-0!" title="Delete Table"><TableIcon class="w-2.5 h-2.5" /><Trash2 class="w-2 h-2 -ml-0.5" /></button>
        </div>

      </div>

      <!-- Find & Replace Sub-toolbar -->
      <div v-if="showFindReplace" class="border-t border-surface-200 dark:border-surface-800 bg-surface-100 dark:bg-surface-800/50 p-2 px-4 flex flex-wrap gap-2 items-center text-sm">
        <input v-model="findText" placeholder="Find..." class="input-minimal w-48" @keyup.enter="doReplaceNext" />
        <input v-model="replaceText" placeholder="Replace with..." class="input-minimal w-48" @keyup.enter="doReplaceNext" />
        <button @click="doReplaceNext" class="bg-primary-600 py-1.5 px-3 text-xs rounded-md shadow-none hover:shadow-none">Replace Next</button>
      </div>
    </div>

    <!-- Canvas Area -->
    <div ref="editorScrollContainer" class="flex-1 overflow-y-auto bg-surface-200 dark:bg-surface-950 p-4 sm:p-8 cursor-text" @click.self="editor?.chain().focus().run()">
      <div :class="['mx-auto w-full max-w-204 min-h-264 bg-white dark:bg-surface-900 shadow-md border border-surface-300 dark:border-surface-800 rounded-sm overflow-hidden transition-colors relative z-0', { 'show-formatting-marks': showFormattingMarks }]">
        <editor-content :editor="editor" class="h-full min-h-264 tiptap-page" />
      </div>
    </div>
    
    <!-- Modals -->
    <MediaExplorerModal 
      :is-open="isMediaExplorerOpen" 
      @close="isMediaExplorerOpen = false" 
      @insert="handleMediaInsert" 
    />
  </div>
</template>

<style>
@reference "@/style.css";

/* Hide Scrollbars completely */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* UI Elements */
.toolbar-btn {
  @apply p-1.5 rounded text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center min-w-8 min-h-8 text-sm;
}
.toolbar-btn.is-active {
  @apply bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300;
}
.toolbar-select {
  @apply bg-transparent border border-surface-200 dark:border-surface-700 rounded text-surface-700 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-white dark:hover:bg-surface-800 transition-colors cursor-pointer;
}
.input-minimal {
  @apply bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded px-2 py-1 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50;
}
.input-minimal::placeholder {
  color: var(--color-surface-400);
}

/* Page Layout ProseMirror Styles */
.tiptap-page .ProseMirror {
  @apply outline-none px-8 sm:px-16 py-12 sm:py-16 w-full h-full min-h-264 text-base text-surface-900 dark:text-surface-50 cursor-text bg-transparent;
}

.tiptap-page .ProseMirror p.is-editor-empty:first-child::before {
  color: var(--color-surface-400);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.tiptap-page .ProseMirror > * + * {
  margin-top: 1.25em;
}
.tiptap-page .ProseMirror h1, .tiptap-page .ProseMirror h2, .tiptap-page .ProseMirror h3, .tiptap-page .ProseMirror h4 {
  font-family: var(--font-display);
}
.tiptap-page .ProseMirror h1 { @apply text-4xl font-extrabold mb-6 mt-8 tracking-tight; }
.tiptap-page .ProseMirror h2 { @apply text-2xl font-bold mb-4 mt-6 tracking-tight; }
.tiptap-page .ProseMirror h3 { @apply text-xl font-semibold mb-3 mt-5; }
.tiptap-page .ProseMirror ul { @apply list-disc pl-6; }
.tiptap-page .ProseMirror ol { @apply list-decimal pl-6; }
.tiptap-page .ProseMirror blockquote { @apply pl-4 border-l-4 border-primary-500 italic text-surface-600 dark:text-surface-400; }
.tiptap-page .ProseMirror pre { @apply bg-surface-900 dark:bg-surface-950 text-white p-4 rounded-md font-mono text-sm overflow-x-auto; }
.tiptap-page .ProseMirror code { @apply bg-surface-200 dark:bg-surface-800 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded font-mono text-sm; }
.tiptap-page .ProseMirror pre code { @apply bg-transparent text-inherit px-0 py-0; }
.tiptap-page .ProseMirror a { @apply text-primary-600 dark:text-primary-400 underline hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer; }
.tiptap-page .ProseMirror img { @apply max-w-full h-auto rounded-md border border-surface-200 dark:border-surface-800 mx-auto; }
.tiptap-page .ProseMirror img.ProseMirror-selectednode { @apply ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-surface-900; }

/* Table Styles */
.tiptap-page .ProseMirror table {
  @apply w-full border-collapse border border-surface-300 dark:border-surface-700 my-4 table-fixed;
}
.tiptap-page .ProseMirror td, .tiptap-page .ProseMirror th {
  @apply border border-surface-300 dark:border-surface-700 p-2 min-w-[1em] relative align-top bg-white dark:bg-surface-900;
}
.tiptap-page .ProseMirror th {
  @apply font-bold bg-surface-100 dark:bg-surface-800 text-left;
}
.tiptap-page .ProseMirror .column-resize-handle {
  @apply absolute -right-1 top-0 bottom-0 w-2 bg-primary-500 pointer-events-none;
}
.tiptap-page .ProseMirror .selectedCell:after {
  @apply content-[''] absolute inset-0 bg-primary-500/20 pointer-events-none z-10;
}

/* Formatting Marks (Pilcrow) */
.show-formatting-marks .ProseMirror p::after,
.show-formatting-marks .ProseMirror h1::after,
.show-formatting-marks .ProseMirror h2::after,
.show-formatting-marks .ProseMirror h3::after,
.show-formatting-marks .ProseMirror li::after {
  content: '¶';
  @apply text-surface-300 dark:text-surface-700 ml-1 font-normal select-none pointer-events-none inline-block;
}
</style>
