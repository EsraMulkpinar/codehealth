import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const INTERACTIVE_HANDLERS = new Set(['onClick', 'onDoubleClick', 'onContextMenu']);
const KEYBOARD_HANDLERS = new Set(['onKeyDown', 'onKeyUp', 'onKeyPress']);
const NON_INTERACTIVE_ELEMENTS = new Set([
  'div', 'span', 'p', 'li', 'td', 'th',
  'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
]);

function hasAttr(
  attrs: (TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute)[],
  nameSet: Set<string>
): boolean {
  return attrs.some(
    (a) =>
      a.type === 'JSXAttribute' &&
      a.name.type === 'JSXIdentifier' &&
      nameSet.has(a.name.name)
  );
}

const rule: Rule = {
  id: 'a11y-interactive',
  severity: 'warning',
  category: 'accessibility',
  frameworks: ['react', 'next'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (node.type !== 'JSXOpeningElement') return;
      if (node.name.type !== 'JSXIdentifier') return;

      const name = node.name.name;
      if (!NON_INTERACTIVE_ELEMENTS.has(name)) return;

      const attrs = node.attributes;
      const hasMouseHandler = hasAttr(attrs, INTERACTIVE_HANDLERS);
      const hasKeyboardHandler = hasAttr(attrs, KEYBOARD_HANDLERS);

      if (hasMouseHandler && !hasKeyboardHandler) {
        const line = node.loc!.start.line;
        const column = node.loc!.start.column;
        const component = detectComponent(node);

        diagnostics.push({
          ruleId: 'a11y-interactive',
          severity: 'warning',
          category: 'accessibility',
          confidence: 0.70,
          message: `<${name}> has mouse handler but no keyboard handler — keyboard-only users cannot interact`,
          component,
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix: `// Add keyboard support and proper role:
<${name}
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(e)}
>

// Or better — use a <button> which is keyboard-accessible by default:
<button onClick={handleClick}>...</button>`,
          suggestions: [
            'WCAG 2.1.1: All functionality must be operable via keyboard',
            'Consider replacing with the semantic HTML element (<button>, <a>, etc.)',
          ],
        });
      }
    });

    return diagnostics;
  },
};

export default rule;
