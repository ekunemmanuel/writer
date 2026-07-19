import { Extension, CommandProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphShading: {
      setShading: (color: string) => ReturnType;
      unsetShading: () => ReturnType;
    };
  }
}

export const ParagraphShading = Extension.create({
  name: 'paragraphShading',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          shading: {
            default: null,
            parseHTML: element => element.style.backgroundColor || null,
            renderHTML: attributes => {
              if (!attributes.shading) {
                return {};
              }
              return {
                style: `background-color: ${attributes.shading}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setShading: (color: string) => ({ commands }: CommandProps) => {
        return this.options.types.every((type: string) => commands.updateAttributes(type, { shading: color }));
      },
      unsetShading: () => ({ commands }: CommandProps) => {
        return this.options.types.every((type: string) => commands.resetAttributes(type, 'shading'));
      },
    };
  },
});
