import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

function isUseEffectCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === 'Identifier' && node.callee.name === 'useEffect';
}

const rule: Rule = {
  id: 'fetch-in-effect',
  severity: 'error',
  category: 'correctness',
  frameworks: ['react', 'next', 'react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (node.type === 'CallExpression' && isUseEffectCall(node)) {
        const callback = node.arguments[0];
        if (!callback) return;

        traverse(callback, (child) => {
          if (child.type !== 'CallExpression') return;
          const callee = child.callee;
          const isBareCall =
            callee.type === 'Identifier' && callee.name === 'fetch';
          const isQualifiedCall =
            callee.type === 'MemberExpression' &&
            callee.object.type === 'Identifier' &&
            (callee.object.name === 'window' || callee.object.name === 'globalThis') &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 'fetch';
          if (isBareCall || isQualifiedCall) {
            const line = child.loc!.start.line;
            const column = child.loc!.start.column;
            const component = detectComponent(child);

            diagnostics.push({
              ruleId: 'fetch-in-effect',
              severity: 'error',
              category: 'correctness',
              confidence: 0.95,
              message: 'fetch() inside useEffect — use a data fetching library instead',
              component,
              filePath,
              line,
              column,
              codeSnippet: getCodeSnippet(sourceLines, line),
              fix: `const { data, isLoading } = useQuery({
  queryKey: ['your-key'],
  queryFn: () => fetch('/api/endpoint').then(r => r.json())
});`,
              suggestions: [
                'TanStack Query (react-query) handles caching, deduplication, and background refetching',
                'SWR is a lighter alternative: const { data } = useSWR(key, fetcher)',
                'Race conditions in useEffect fetches are hard to handle — libraries do this for you',
              ],
            });
          }
        });
      }
    });

    return diagnostics;
  },
};

export default rule;
