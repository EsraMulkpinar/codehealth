import type { TSESTree } from '@typescript-eslint/typescript-estree';

type NodeWithParent = TSESTree.Node & { parent?: NodeWithParent };

function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

function getNameFromPattern(pattern: TSESTree.BindingName): string | null {
  if (pattern.type === 'Identifier') {
    return pattern.name;
  }
  return null;
}

export function detectComponent(node: TSESTree.Node): string {
  let current: NodeWithParent | undefined = node as NodeWithParent;

  while (current) {
    if (current.type === 'FunctionDeclaration' && current.id) {
      const name = current.id.name;
      if (isPascalCase(name)) return name;
    }

    if (current.type === 'VariableDeclarator') {
      const name = getNameFromPattern(current.id);
      if (name && isPascalCase(name)) {
        const init = current.init;
        if (
          init &&
          (init.type === 'ArrowFunctionExpression' ||
            init.type === 'FunctionExpression')
        ) {
          return name;
        }
      }
    }

    if (current.type === 'ExportDefaultDeclaration') {
      const decl = current.declaration;
      if (
        decl.type === 'FunctionDeclaration' ||
        decl.type === 'ArrowFunctionExpression' ||
        decl.type === 'FunctionExpression'
      ) {
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          return decl.id.name;
        }
        return 'DefaultExport';
      }
    }

    current = current.parent;
  }

  return 'unknown';
}

export function getCodeSnippet(sourceLines: string[], line: number): string[] {
  const start = Math.max(0, line - 3);
  const end = Math.min(sourceLines.length - 1, line + 1);
  const snippet: string[] = [];

  for (let i = start; i <= end; i++) {
    const lineNum = i + 1;
    const prefix = lineNum === line ? '▶' : ' ';
    snippet.push(`${prefix} ${String(lineNum).padStart(3)} │  ${sourceLines[i]}`);
  }

  return snippet;
}
