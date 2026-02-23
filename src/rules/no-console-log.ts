import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

function isInsideDevGuard(node: TSESTree.Node): boolean {
  let current: (TSESTree.Node & { parent?: TSESTree.Node }) | undefined =
    node as TSESTree.Node & { parent?: TSESTree.Node };

  while (current?.parent) {
    const parent = current.parent as TSESTree.Node & { parent?: TSESTree.Node };
    if (
      parent.type === 'IfStatement' &&
      parent.test.type === 'Identifier' &&
      (parent.test as TSESTree.Identifier).name === '__DEV__'
    ) {
      return true;
    }
    current = parent;
  }

  return false;
}

const rule: Rule = {
  id: 'no-console-log',
  severity: 'warning',
  category: 'best-practice',
  frameworks: ['react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (
        node.type !== 'CallExpression' ||
        node.callee.type !== 'MemberExpression' ||
        node.callee.object.type !== 'Identifier' ||
        node.callee.object.name !== 'console' ||
        node.callee.property.type !== 'Identifier'
      ) return;

      const method = node.callee.property.name;
      if (!['log', 'warn', 'error', 'info', 'debug'].includes(method)) return;

      if (isInsideDevGuard(node)) return;

      const line = node.loc!.start.line;
      const column = node.loc!.start.column;

      diagnostics.push({
        ruleId: 'no-console-log',
        severity: 'warning',
        category: 'best-practice',
        confidence: 0.85,
        message: `console.${method}() left in production code — remove or use a proper logger`,
        component: 'module-level',
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Option 1: Remove the console statement entirely

// Option 2: Use __DEV__ guard (React Native built-in):
if (__DEV__) {
  console.${method}('debug info');
}

// Option 3: Use a logger library like react-native-logs:
import { logger } from './logger';
logger.${method === 'log' ? 'debug' : method}('message');`,
        suggestions: [
          'console statements are stripped in release builds by Metro, but leaving them adds noise',
        ],
      });
    });

    return diagnostics;
  },
};

export default rule;
