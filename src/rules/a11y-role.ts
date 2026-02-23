import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const EVENT_HANDLERS = new Set([
  'onClick', 'onDoubleClick', 'onContextMenu',
  'onMouseDown', 'onMouseUp', 'onMouseEnter', 'onMouseLeave',
  'onFocus', 'onBlur',
]);

const ELEMENTS_NEEDING_ROLE = new Set([
  'div', 'span', 'p', 'li', 'td', 'th',
  'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'ul', 'ol',
]);

function hasAttr(
  attrs: (TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute)[],
  nameOrSet: string | Set<string>
): boolean {
  const check = typeof nameOrSet === 'string'
    ? (n: string) => n === nameOrSet
    : (n: string) => nameOrSet.has(n);

  return attrs.some(
    (a) =>
      a.type === 'JSXAttribute' &&
      a.name.type === 'JSXIdentifier' &&
      check(a.name.name)
  );
}

const rule: Rule = {
  id: 'a11y-role',
  severity: 'warning',
  category: 'accessibility',
  frameworks: ['react', 'next'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (node.type !== 'JSXOpeningElement') return;
      if (node.name.type !== 'JSXIdentifier') return;

      const name = node.name.name;
      if (!ELEMENTS_NEEDING_ROLE.has(name)) return;

      const attrs = node.attributes;
      const hasEventHandler = hasAttr(attrs, EVENT_HANDLERS);
      const hasRole = hasAttr(attrs, 'role');

      if (hasEventHandler && !hasRole) {
        const line = node.loc!.start.line;
        const column = node.loc!.start.column;
        const component = detectComponent(node);

        diagnostics.push({
          ruleId: 'a11y-role',
          severity: 'warning',
          category: 'accessibility',
          confidence: 0.70,
          message: `<${name}> has event handler but no role — assistive technologies won't announce it correctly`,
          component,
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix: `// Add the appropriate ARIA role:
<${name} role="button" tabIndex={0} onClick={handler}>

// Common roles: button, link, checkbox, menuitem, tab, listitem, dialog
// Or replace with the semantic HTML element:
// div[role=button] → <button>
// div[role=link]   → <a href="...">
// div[role=list]   → <ul> or <ol>`,
          suggestions: [
            'WCAG 4.1.2: UI components must have a programmatically determinable name and role',
            'Prefer semantic HTML over ARIA roles when possible',
          ],
        });
      }
    });

    return diagnostics;
  },
};

export default rule;
