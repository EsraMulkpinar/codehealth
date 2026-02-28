import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

function isComponentWrappedInSuspense(ast: TSESTree.Program, componentName: string): boolean {
  const usages: boolean[] = [];
  traverse(ast, (node) => {
    if (
      node.type === 'JSXOpeningElement' &&
      node.name.type === 'JSXIdentifier' &&
      node.name.name === componentName
    ) {
      let insideSuspense = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cur = (node as any).parent;
      while (cur) {
        if (
          cur.type === 'JSXElement' &&
          cur.openingElement?.name?.name === 'Suspense'
        ) {
          insideSuspense = true;
          break;
        }
        cur = cur.parent;
      }
      usages.push(insideSuspense);
    }
  });
  return usages.length > 0 && usages.every(Boolean);
}

const rule: Rule = {
  id: 'use-search-params',
  severity: 'warning',
  category: 'correctness',
  frameworks: ['next'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (
        node.type !== 'CallExpression' ||
        node.callee.type !== 'Identifier' ||
        node.callee.name !== 'useSearchParams'
      ) return;

      const component = detectComponent(node);

      if (isComponentWrappedInSuspense(ast, component)) return;

      const line = node.loc!.start.line;
      const column = node.loc!.start.column;

      diagnostics.push({
        ruleId: 'use-search-params',
        severity: 'warning',
        category: 'correctness',
        confidence: 0.85,
        message: 'useSearchParams() requires a Suspense boundary — wrap the component or its parent',
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Wrap the component with Suspense:
<Suspense fallback={<div>Loading...</div>}>
  <${component} />
</Suspense>

// Or use a separate client component with Suspense in the parent.`,
        suggestions: [
          'Next.js requires Suspense because useSearchParams reads from a dynamic data source',
          'Consider a loading skeleton as the Suspense fallback for better UX',
        ],
      });
    });

    return diagnostics;
  },
};

export default rule;
