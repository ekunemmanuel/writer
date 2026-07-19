import Image from '@tiptap/extension-image'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ResizableImageNodeView from '@/components/ResizableImageNodeView.vue'

export const ResizableImage = Image.extend({
  inline: true,
  group: 'inline',

  addAttributes() {
    return {
      ...this.parent?.(),
      imageId: {
        default: null,
        parseHTML: element => element.getAttribute('data-image-id'),
        renderHTML: attributes => {
          if (!attributes.imageId) return {}
          return { 'data-image-id': attributes.imageId }
        },
      },
      width: {
        default: '100%',
        parseHTML: element => element.getAttribute('width') || '100%',
        renderHTML: attributes => {
          return {
            width: attributes.width,
          }
        },
      },
      height: {
        default: 'auto',
        parseHTML: element => element.getAttribute('height') || 'auto',
        renderHTML: attributes => {
          return { height: attributes.height }
        },
      },
      align: {
        default: 'center', // left, center, right, inline
        parseHTML: element => element.getAttribute('data-align') || 'center',
        renderHTML: attributes => {
          return {
            'data-align': attributes.align,
          }
        },
      },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(ResizableImageNodeView)
  },
})
