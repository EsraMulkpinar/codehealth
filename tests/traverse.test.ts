import { describe, it, expect } from 'vitest';
import { parse, simpleTraverse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { traverse } from '../src/traverse';
import { detectComponent, getCodeSnippet } from '../src/component-detector';

function parseCode(code: string): TSESTree.Program {
  const ast = parse(code, { jsx: true, loc: true, range: true });
  simpleTraverse(ast, {
    enter(node, parent) {
      if (parent) {
        (node as TSESTree.Node & { parent?: TSESTree.Node }).parent = parent;
      }
    },
  });
  return ast;
}

describe('traverse', () => {
  it('visits all nodes in the AST', () => {
    const ast = parse('const x = 1;', { jsx: true, loc: true, range: true });
    const types: string[] = [];
    traverse(ast, (node) => types.push(node.type));
    expect(types).toContain('Program');
    expect(types).toContain('VariableDeclaration');
    expect(types).toContain('VariableDeclarator');
  });
});

describe('detectComponent', () => {
  it('detects PascalCase function declaration as component', () => {
    const code = `function MyComponent() { return <div />; }`;
    const ast = parseCode(code);
    const fnDecl = ast.body[0] as TSESTree.FunctionDeclaration;
    expect(detectComponent(fnDecl)).toBe('MyComponent');
  });

  it('returns unknown for non-component', () => {
    const code = `const x = 1;`;
    const ast = parseCode(code);
    expect(detectComponent(ast.body[0])).toBe('unknown');
  });
});

describe('getCodeSnippet', () => {
  it('returns snippet around the given line', () => {
    const lines = ['line1', 'line2', 'line3', 'line4', 'line5', 'line6'];
    const snippet = getCodeSnippet(lines, 3);
    expect(snippet.length).toBeGreaterThan(0);
    expect(snippet.some((s) => s.includes('▶'))).toBe(true);
  });

  it('handles line at the beginning of file', () => {
    const lines = ['first', 'second'];
    const snippet = getCodeSnippet(lines, 1);
    expect(snippet.length).toBeGreaterThan(0);
  });
});
