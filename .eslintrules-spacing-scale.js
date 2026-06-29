module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce 4px base spacing scale (no fractional values like 1.5, 2.5, 3.5)',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    const fractionalSpacingRegex =
      /(?:^|\s)(?:[\w-]+:)*(?:p[trblxy]?|m[trblxy]?|space-[xy]|gap(?:-[xy])?|inset-[xy]?|top|right|bottom|left|h|w|min-h|min-w|max-h|max-w|tracking)-(?:0\.5|1\.5|2\.5|3\.5|4\.5|5\.5|6\.5)(?=$|\s|\/)/;

    return {
      JSXAttribute(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'className') {
          if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
            const className = node.value.value;
            const matches = className.match(fractionalSpacingRegex);

            if (matches) {
              context.report({
                node,
                message: `Use only 4px base spacing scale. Found fractional value "${matches[0]}". Use these values: p-1(m:4px), p-2(8px), p-3(12px), p-4(16px), p-5(20px), p-6(24px), p-8(32px)`,
                fix(fixer) {
                  const replacement = mapFractionalToStandard(matches[0]);
                  return fixer.replaceTextRange(
                    node.value.range,
                    JSON.stringify(className.replace(matches[0], replacement)),
                  );
                },
              });
            }
          }
        }
      },
      TemplateLiteral(node) {
        if (isClassNameTemplate(node, context)) {
          const raw = node.quasis.map(q => q.value.raw).join('');
          const matches = raw.match(fractionalSpacingRegex);
          if (matches) {
            context.report({
              node,
              message: `Use only 4px base spacing scale. Found fractional value "${matches[0]}"`,
            });
          }
        }
      },
    };
  },
};

function isClassNameTemplate(node, context) {
  return (
    node.parent.type === 'JSXAttribute' &&
    node.parent.name.type === 'JSXIdentifier' &&
    node.parent.name.name === 'className'
  );
}

function mapFractionalToStandard(fractionalClass) {
  const mappings = {
    '0.5': '1',
    '1.5': '2',
    '2.5': '2',
    '3.5': '4',
    '4.5': '5',
    '5.5': '6',
    '6.5': '7',
  };

  for (const [fractional, standard] of Object.entries(mappings)) {
    if (fractionalClass.includes(fractional)) {
      return fractionalClass.replace(fractional, standard);
    }
  }
  return fractionalClass;
}
