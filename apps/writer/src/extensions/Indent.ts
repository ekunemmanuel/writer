import { Extension, CommandProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'blockquote'],
      minLevel: 0,
      maxLevel: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: element => {
              const padding = element.style.marginLeft || element.style.paddingLeft;
              if (padding) {
                return parseInt(padding, 10) / 20; // Assume 20px per level
              }
              return 0;
            },
            renderHTML: attributes => {
              if (!attributes.indent) {
                return {};
              }
              return {
                style: `margin-left: ${attributes.indent * 20}px`, // 20px indent per level
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent: () => ({ tr, state, dispatch }: CommandProps) => {
        const { selection } = state;
        let applied = false;
        tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            const indent = (node.attrs.indent || 0) + 1;
            if (indent <= this.options.maxLevel) {
              tr.setNodeMarkup(pos, node.type, { ...node.attrs, indent });
              applied = true;
            }
          }
        });
        if (dispatch && applied) dispatch(tr);
        return applied;
      },
      outdent: () => ({ tr, state, dispatch }: CommandProps) => {
        const { selection } = state;
        let applied = false;
        tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            const indent = (node.attrs.indent || 0) - 1;
            if (indent >= this.options.minLevel) {
              tr.setNodeMarkup(pos, node.type, { ...node.attrs, indent });
              applied = true;
            }
          }
        });
        if (dispatch && applied) dispatch(tr);
        return applied;
      },
    };
  },
  
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    }
  }
});
