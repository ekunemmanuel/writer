import { Extension, CommandProps } from '@tiptap/core';

export interface FontSizeOptions {
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize: fontSize => ({ chain, state, tr, dispatch }) => {
        if (state.selection.empty) {
          const { $from } = state.selection;
          const textBefore = $from.nodeBefore?.text;
          
          if (textBefore && textBefore.endsWith('\u200B')) {
            tr.delete($from.pos - 1, $from.pos);
          }
          
          // Merge existing textStyle attributes (e.g. color, fontFamily)
          const markType = state.schema.marks.textStyle;
          const existingMarks = state.storedMarks || $from.marks();
          let attrs = { fontSize };
          const existingTextStyle = existingMarks.find(m => m.type === markType);
          if (existingTextStyle) {
            attrs = { ...existingTextStyle.attrs, fontSize };
          }
          
          tr.addStoredMark(markType.create(attrs));
          tr.insertText('\u200B');
          if (dispatch) dispatch(tr);
          return true;
        }
        
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }: CommandProps) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});
