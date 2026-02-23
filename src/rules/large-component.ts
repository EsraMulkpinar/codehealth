import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const LOC_THRESHOLD = 300;
const HOOK_THRESHOLD = 6;
const JSX_THRESHOLD = 30;

function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

function isFunctionNode(
  node: TSESTree.Node
): node is TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

function getFunctionName(node: TSESTree.Node): string | null {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;
  if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    const parent = (node as TSESTree.Node & { parent?: TSESTree.Node }).parent;
    if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
      return parent.id.name;
    }
  }
  return null;
}

function countHooks(fnNode: TSESTree.Node): number {
  let count = 0;
  traverse(fnNode, (node) => {
    if (node !== fnNode && isFunctionNode(node)) return;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      /^use[A-Z]/.test(node.callee.name)
    ) {
      count++;
    }
  });
  return count;
}

function countJSXNodes(fnNode: TSESTree.Node): number {
  let count = 0;
  traverse(fnNode, (node) => {
    if (node.type === 'JSXElement') count++;
  });
  return count;
}

const rule: Rule = {
  id: 'large-component',
  severity: 'warning',
  category: 'performance',
  frameworks: ['react', 'next', 'react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const visited = new Set<TSESTree.Node>();

    traverse(ast, (node) => {
      if (!isFunctionNode(node) || visited.has(node)) return;
      visited.add(node);

      if (!node.loc) return;
      const name = getFunctionName(node);
      if (!name || !isPascalCase(name)) return;

      const lineCount = node.loc.end.line - node.loc.start.line + 1;
      if (lineCount <= LOC_THRESHOLD) return;

      const hookCount = countHooks(node);
      const jsxCount = countJSXNodes(node);

      const isHighComplexity = hookCount > HOOK_THRESHOLD || jsxCount > JSX_THRESHOLD;
      const confidence = isHighComplexity ? 0.85 : 0.55;

      const line = node.loc.start.line;
      const column = node.loc.start.column;
      const component = detectComponent(node);

      diagnostics.push({
        ruleId: 'large-component',
        severity: 'warning',
        category: 'performance',
        confidence,
        message: `Component is ${lineCount} lines (${hookCount} hooks, ${jsxCount} JSX nodes) — consider splitting`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Extract logical sections into smaller components:
function ${name}Header() { /* ... */ }
function ${name}Body() { /* ... */ }
function ${name}Footer() { /* ... */ }

// Use custom hooks for complex logic:
function use${name}Logic() { /* state + effects */ }`,
        suggestions: [
          'Extract custom hook for state + effect logic',
          'Break JSX into sub-components',
          `Aim for < ${LOC_THRESHOLD} lines, < ${HOOK_THRESHOLD} hooks, < ${JSX_THRESHOLD} JSX nodes`,
        ],
      });
    });

    return diagnostics;
  },
};

export default rule;
