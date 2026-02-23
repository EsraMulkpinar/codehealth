import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const rule: Rule = {
  id: 'index-as-key',
  severity: 'warning',
  category: 'best-practice',
  frameworks: ['react', 'next', 'react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (
        node.type !== 'CallExpression' ||
        node.callee.type !== 'MemberExpression' ||
        node.callee.property.type !== 'Identifier' ||
        node.callee.property.name !== 'map'
      ) return;

      const callback = node.arguments[0];
      if (
        !callback ||
        (callback.type !== 'ArrowFunctionExpression' &&
          callback.type !== 'FunctionExpression')
      ) return;

      const params = callback.params;
      if (params.length < 2 || params[1].type !== 'Identifier') return;

      const indexParamName = params[1].name;

      traverse(callback, (child) => {
        if (
          child.type === 'JSXAttribute' &&
          child.name.type === 'JSXIdentifier' &&
          child.name.name === 'key' &&
          child.value?.type === 'JSXExpressionContainer' &&
          child.value.expression.type === 'Identifier' &&
          child.value.expression.name === indexParamName
        ) {
          const line = child.loc!.start.line;
          const column = child.loc!.start.column;
          const component = detectComponent(child);

          diagnostics.push({
            ruleId: 'index-as-key',
            severity: 'warning',
            category: 'best-practice',
            confidence: 0.90,
            message: `key={${indexParamName}} (array index) — use a stable unique ID instead`,
            component,
            filePath,
            line,
            column,
            codeSnippet: getCodeSnippet(sourceLines, line),
            fix: `// Use a stable unique identifier from the data:
items.map((item) => (
  <Component key={item.id} {...item} />
))

// If items have no ID, add one when creating the array:
const itemsWithIds = rawItems.map((item) => ({ ...item, id: item.id ?? crypto.randomUUID() }));`,
            suggestions: [
              'Index keys cause incorrect reconciliation when items are reordered or filtered',
              'If data has no natural ID, generate stable IDs at the data-fetching layer',
            ],
          });
        }
      });
    });

    return diagnostics;
  },
};

export default rule;
