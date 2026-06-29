module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce semantic color tokens instead of literal colors',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null, // No auto-fix - semantic token mapping requires context
    schema: [],
  },
  create(context) {
    // Patterns for literal color tokens to flag
    const literalColorPatterns = [
      // text-white, text-black
      /\btext-white\b/,
      /\btext-black\b/,
      // bg-white, bg-black, bg-white/XX, bg-black/XX
      /\bbg-white(\/\d+)?\b/,
      /\bbg-black(\/\d+)?\b/,
      // text-slate-XXX (any value)
      /\btext-slate-\d+\b/,
      // text-amber-XXX (any value)
      /\btext-amber-\d+\b/,
      // text-gray-XXX (any value)
      /\btext-gray-\d+\b/,
      // bg-slate-XXX, bg-gray-XXX, bg-amber-XXX
      /\bbg-slate-\d+\b/,
      /\bbg-gray-\d+\b/,
      /\bbg-amber-\d+\b/,
    ];

    function reportLiteralColor(node, match) {
      context.report({
        node,
        message: `Use semantic color tokens instead of literal colors. Found '${match}'. Use 'text-on-primary', 'text-text-primary', 'bg-surface', 'bg-background' or other semantic tokens instead.`,
      });
    }

    return {
      JSXAttribute(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'className') {
          if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
            const className = node.value.value;
            for (const pattern of literalColorPatterns) {
              const match = className.match(pattern);
              if (match) {
                reportLiteralColor(node, match[0]);
                break; // Report one at a time
              }
            }
          }
        }
      },
      TemplateLiteral(node) {
        if (
          node.parent.type === 'JSXAttribute' &&
          node.parent.name.type === 'JSXIdentifier' &&
          node.parent.name.name === 'className'
        ) {
          const raw = node.quasis.map(q => q.value.raw).join('');
          for (const pattern of literalColorPatterns) {
            const match = raw.match(pattern);
            if (match) {
              reportLiteralColor(node, match[0]);
              break;
            }
          }
        }
      },
    };
  },
};
