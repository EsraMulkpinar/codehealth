import * as path from 'path';

import { parse, simpleTraverse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs';

export interface ParseResult {
  ast: TSESTree.Program;
  sourceLines: string[];
}

export interface ParseFailure {
  parseError: {
    filePath: string;
    message: string;
    line: number;
  };
}

export function isParseFailure(result: ParseResult | ParseFailure | null): result is ParseFailure {
  return result !== null && 'parseError' in result;
}

export function parseFile(filePath: string): ParseResult | ParseFailure | null {
  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    const sourceLines = source.split('\n');

    const ext = path.extname(filePath);
    const isJsx = ext === '.tsx' || ext === '.jsx';

    const ast = parse(source, {
      jsx: isJsx,
      loc: true,
      range: true,
      comment: false,
      tokens: false,
      filePath,
    });

    addParentRefs(ast);

    return { ast, sourceLines };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const lineMatch = msg.match(/\((\d+):/);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
    return { parseError: { filePath, message: msg, line } };
  }
}

function addParentRefs(ast: TSESTree.Program): void {
  simpleTraverse(ast, {
    enter(node, parent) {
      if (parent) {
        (node as TSESTree.Node & { parent?: TSESTree.Node }).parent = parent;
      }
    },
  });
}
