import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const FORM_ELEMENTS = new Set(['input', 'select', 'textarea']);

function getAttributeValue(
  attrs: (TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute)[],
  name: string
): string | null {
  for (const attr of attrs) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === name
    ) {
      if (attr.value?.type === 'Literal') return String(attr.value.value);
      if (
        attr.value?.type === 'JSXExpressionContainer' &&
        attr.value.expression.type === 'Literal'
      ) {
        return String(attr.value.expression.value);
      }
      return '__dynamic__';
    }
  }
  return null;
}

function hasAttr(
  attrs: (TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute)[],
  name: string
): boolean {
  return getAttributeValue(attrs, name) !== null;
}

const rule: Rule = {
  id: 'a11y-label',
  severity: 'warning',
  category: 'accessibility',
  frameworks: ['react', 'next'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (node.type !== 'JSXOpeningElement') return;
      if (node.name.type !== 'JSXIdentifier') return;

      const name = node.name.name;
      if (!FORM_ELEMENTS.has(name)) return;

      const attrs = node.attributes;
      const typeValue = getAttributeValue(attrs, 'type');
      if (typeValue === 'hidden') return;

      if (
        !hasAttr(attrs, 'aria-label') &&
        !hasAttr(attrs, 'aria-labelledby')
      ) {
        const line = node.loc!.start.line;
        const column = node.loc!.start.column;
        const component = detectComponent(node);

        diagnostics.push({
          ruleId: 'a11y-label',
          severity: 'warning',
          category: 'accessibility',
          confidence: 0.75,
          message: `<${name}> has no accessible label — add aria-label, aria-labelledby, or an associated <label>`,
          component,
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix: `// Option 1: Use aria-label
<${name} aria-label="Descriptive label" />

// Option 2: Associate with a <label> element
<label htmlFor="my-${name}">Label text</label>
<${name} id="my-${name}" />

// Option 3: Use aria-labelledby
<span id="my-label">Label text</span>
<${name} aria-labelledby="my-label" />`,
          suggestions: [
            'WCAG 1.3.1: Form elements must have programmatic labels',
            'Placeholder text is not a substitute for a label',
            'If using id, ensure a <label htmlFor="..."> element is also present',
          ],
        });
      }
    });

    return diagnostics;
  },
};

export default rule;
