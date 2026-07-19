<script setup lang="ts">
import { useQuery, useMutation, convex } from '@writer/shared'
import { api } from '@convex/_generated/api'
import { X, Trash2, Loader2, Image as ImageIcon, Plus } from '@lucide/vue'
import { ref } from 'vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'insert', payload: { url: string, imageId: string }): void
}>()

const { data: images } = useQuery(api.images.list)
const removeImage = useMutation(api.images.remove)
const isDeleting = ref<string | null>(null)

const handleDelete = async (imageId: string) => {
  if (!confirm('Are you sure you want to delete this image?')) return
  
  isDeleting.value = imageId
  try {
    await removeImage({ id: imageId as any })
  } catch (error: any) {
    console.error('Failed to delete image:', error)
    alert(error.message || 'Failed to delete image.')
  } finally {
    isDeleting.value = null
  }
}

const handleInsert = (image: any) => {
  emit('insert', { url: image.url, imageId: image._id })
}

const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const generateUploadUrl = useMutation(api.storage.generateUploadUrl as any)
const createImage = useMutation(api.images.create as any)

const handleUploadClick = () => {
  if (!isUploading.value) fileInput.value?.click()
}

const compressImage = async (file: File, maxSizeMB: number = 1): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Scale down if image is massive (e.g. max 2048px)
        const maxDim = 2048;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        
        ctx.drawImage(img, 0, 0, width, height);
        
        let quality = 0.9;
        const targetSize = maxSizeMB * 1024 * 1024;
        
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return resolve(file);
            
            if (blob.size > targetSize && quality > 0.1) {
              quality -= 0.1;
              tryCompress();
            } else {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          }, 'image/jpeg', quality);
        };
        
        tryCompress();
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  
  isUploading.value = true
  const files = Array.from(target.files)
  
  for (const originalFile of files) {
    try {
      // Compress if over 1MB
      let fileToUpload = originalFile
      if (originalFile.size > 1024 * 1024) {
        fileToUpload = await compressImage(originalFile, 1)
      }
      
      const uploadUrl = await generateUploadUrl({})
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": fileToUpload.type },
        body: fileToUpload,
      })
      const { storageId } = await result.json()
      
      const url = await convex.query(api.storage.getFileUrl as any, { storageId })
      if (url) {
        await createImage({ storageId, url, name: originalFile.name })
      }
    } catch (err) {
      console.error("Upload failed for", originalFile.name, err)
    }
  }
  
  if (target) target.value = ''
  isUploading.value = false
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <!-- Overlay -->
    <div class="absolute inset-0 bg-surface-900/50 backdrop-blur-sm" @click="emit('close')"></div>
    
    <!-- Modal -->
    <div class="relative bg-white dark:bg-surface-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-surface-200 dark:border-surface-800">
      
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-800">
        <h2 class="text-xl font-bold font-display flex items-center gap-2 text-surface-900 dark:text-white">
          <ImageIcon class="w-6 h-6 text-primary-500" />
          Media Explorer
        </h2>
        <div class="flex items-center gap-3">
          <button @click="handleUploadClick" class="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors" :disabled="isUploading">
            <Loader2 v-if="isUploading" class="w-4 h-4 animate-spin" />
            <Plus v-else class="w-4 h-4" />
            <span>{{ isUploading ? 'Uploading...' : 'Add Images' }}</span>
          </button>
          <input type="file" ref="fileInput" multiple accept="image/*" class="hidden" @change="handleFileSelect" />
          
          <button @click="emit('close')" class="text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800" :disabled="isUploading">
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="images === undefined" class="flex flex-col items-center justify-center h-64 text-surface-500">
          <Loader2 class="w-8 h-8 animate-spin mb-4 text-primary-500" />
          <p>Loading media...</p>
        </div>
        
        <div v-else-if="!images || images.length === 0" class="flex flex-col items-center justify-center h-64 text-surface-500 text-center">
          <div class="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mb-4">
            <ImageIcon class="w-8 h-8 text-surface-400" />
          </div>
          <p class="text-lg font-medium text-surface-900 dark:text-white mb-1">No images found</p>
          <p class="text-sm">Upload images from your computer to see them here.</p>
        </div>
        
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div v-for="image in images" :key="image._id" class="group relative aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 hover:border-primary-500 transition-colors shadow-sm">
            <img :src="image.url" :alt="image.name" class="w-full h-full object-cover" />
            
            <!-- Hover actions -->
            <div class="absolute inset-0 bg-surface-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
              <div class="flex justify-end">
                <button 
                  @click="handleDelete(image._id)" 
                  class="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-md shadow-sm transition-colors disabled:opacity-50"
                  title="Delete image"
                  :disabled="isDeleting === image._id"
                >
                  <Loader2 v-if="isDeleting === image._id" class="w-4 h-4 animate-spin" />
                  <Trash2 v-else class="w-4 h-4" />
                </button>
              </div>
              
              <button 
                @click="handleInsert(image)" 
                class="w-full bg-primary-600 hover:bg-primary-500 text-white py-1.5 px-3 rounded text-sm font-medium transition-colors"
              >
                Insert
              </button>
            </div>
            
            <!-- Filename label -->
            <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none">
              <p class="text-white text-xs truncate">{{ image.name }}</p>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>
