import type { TSESTree } from '@typescript-eslint/typescript-estree';

const SKIP_KEYS = new Set(['parent', 'loc', 'range', 'tokens', 'comments']);

type Visitor = (node: TSESTree.Node) => void;

export function traverse(node: TSESTree.Node, visitor: Visitor): void {
  visitor(node);

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;

    const child = (node as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && 'type' in c) {
          traverse(c as TSESTree.Node, visitor);
        }
      }
    } else if (child && typeof child === 'object' && 'type' in child) {
      traverse(child as TSESTree.Node, visitor);
    }
  }
}
