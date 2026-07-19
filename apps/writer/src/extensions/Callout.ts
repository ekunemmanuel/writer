import { Node, mergeAttributes, textblockTypeInputRule } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import CalloutNodeView from '@/components/CalloutNodeView.vue'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (options?: { type?: string }) => ReturnType
      toggleCallout: (options?: { type?: string }) => ReturnType
    }
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: element => element.getAttribute('data-type'),
        renderHTML: attributes => {
          return {
            'data-type': attributes.type,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.callout',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'callout' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(CalloutNodeView)
  },

  addCommands() {
    return {
      setCallout: attributes => ({ commands }) => {
        return commands.setNode(this.name, attributes)
      },
      toggleCallout: attributes => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph', attributes)
      },
    }
  },

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^\s*>\s*\[!([a-zA-Z]+)\]\s$/,
        type: this.type,
        getAttributes: match => {
          const type = match[1].toLowerCase()
          return { type }
        },
      }),
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('calloutTransformer'),
        appendTransaction: (transactions, _oldState, newState) => {
          let tr = newState.tr
          let modified = false

          if (!transactions.some(t => t.docChanged)) return null

          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'blockquote') {
              const firstChild = node.firstChild
              if (firstChild && firstChild.type.name === 'paragraph') {
                const text = firstChild.textContent
                const match = text.match(/^\s*\[!([a-zA-Z]+)\]\s*(.*)$/is)
                if (match) {
                  const calloutType = match[1].toLowerCase()
                  const remainingText = match[2]

                  const { type } = this
                  
                  const schema = newState.schema
                  const newPara = schema.nodes.paragraph.create(
                    null,
                    remainingText ? schema.text(remainingText) : undefined
                  )

                  const children: any[] = [newPara]
                  for (let i = 1; i < node.childCount; i++) {
                    children.push(node.child(i))
                  }

                  const newCallout = type.create({ type: calloutType }, children)
                  
                  tr.replaceWith(pos, pos + node.nodeSize, newCallout)
                  modified = true
                  return false
                }
              }
            }
          })

          return modified ? tr : null
        },
      }),
    ]
  },
})
