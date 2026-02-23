import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const CLIENT_HOOKS = new Set([
  'useState', 'useEffect', 'useReducer', 'useCallback', 'useMemo',
  'useRef', 'useContext', 'useLayoutEffect', 'useImperativeHandle',
  'useTransition', 'useDeferredValue', 'useId',
]);

function hasUseClientDirective(ast: TSESTree.Program): boolean {
  for (const node of ast.body) {
    if (
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'Literal' &&
      node.expression.value === 'use client'
    ) {
      return true;
    }
  }
  return false;
}

function isAppRouterFile(filePath: string): boolean {
  return /[/\\]app[/\\]/.test(filePath);
}

function buildReactHookLocals(ast: TSESTree.Program): Set<string> {
  const locals = new Set<string>();
  for (const node of ast.body) {
    if (node.type !== 'ImportDeclaration') continue;
    if (node.source.value !== 'react') continue;
    for (const spec of node.specifiers) {
      if (spec.type === 'ImportSpecifier') {
        const imported =
          spec.imported.type === 'Identifier' ? spec.imported.name : String((spec.imported as TSESTree.StringLiteral).value);
        if (CLIENT_HOOKS.has(imported)) {
          locals.add(spec.local.name);
        }
      }
    }
  }
  return locals;
}

const rule: Rule = {
  id: 'missing-use-client',
  severity: 'error',
  category: 'correctness',
  frameworks: ['next'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (!isAppRouterFile(filePath)) return diagnostics;

    if (hasUseClientDirective(ast)) return diagnostics;

    const reactHookLocals = buildReactHookLocals(ast);

    function isClientHookCall(node: TSESTree.CallExpression): boolean {
      if (
        node.callee.type === 'Identifier' &&
        reactHookLocals.has(node.callee.name)
      ) {
        return true;
      }
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'React' &&
        node.callee.property.type === 'Identifier' &&
        CLIENT_HOOKS.has(node.callee.property.name)
      ) {
        return true;
      }
      return false;
    }

    const found: TSESTree.CallExpression[] = [];

    traverse(ast, (node) => {
      if (node.type === 'CallExpression' && isClientHookCall(node)) {
        found.push(node);
      }
    });

    if (found.length === 0) return diagnostics;

    const firstHook = found[0];
    const line = firstHook.loc!.start.line;
    const column = firstHook.loc!.start.column;
    const callee = firstHook.callee;
    const hookName =
      callee.type === 'Identifier'
        ? callee.name
        : (callee as TSESTree.MemberExpression).property.type === 'Identifier'
          ? ((callee as TSESTree.MemberExpression).property as TSESTree.Identifier).name
          : 'hook';
    const component = detectComponent(firstHook);

    diagnostics.push({
      ruleId: 'missing-use-client',
      severity: 'error',
      category: 'correctness',
      confidence: 0.95,
      message: `${hookName}() used without "use client" directive — this will fail in Next.js App Router`,
      component,
      filePath,
      line,
      column,
      codeSnippet: getCodeSnippet(sourceLines, line),
      fix: `// Add at the very top of the file (before imports):
'use client';

import React, { ${hookName} } from 'react';
// ... rest of your component`,
      suggestions: [
        'Check if this file should be in the pages/ directory instead',
        'Server Components cannot use hooks — split into a Client Component if needed',
      ],
    });

    return diagnostics;
  },
};

export default rule;
