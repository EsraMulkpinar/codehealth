import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

function makeError(filePath: string, line: number, column: number, sourceLines: string[]): Diagnostic {
  return {
    ruleId: 'constants-manifest',
    severity: 'error',
    category: 'correctness',
    confidence: 0.99,
    message: 'Constants.manifest is deprecated in Expo SDK 46+ — use Constants.expoConfig',
    component: 'module-level',
    filePath,
    line,
    column,
    codeSnippet: getCodeSnippet(sourceLines, line),
    fix: `import Constants from 'expo-constants';

// Before (deprecated):
const appName = Constants.manifest?.name;

// After:
const appName = Constants.expoConfig?.name;

// For extra fields (app.json > extra):
const apiUrl = Constants.expoConfig?.extra?.apiUrl;`,
    suggestions: [
      'Constants.manifest was removed in Expo SDK 50 — update immediately',
      'Use Constants.expoConfig for all app.json / app.config.js fields',
    ],
  };
}

const rule: Rule = {
  id: 'constants-manifest',
  severity: 'error',
  category: 'correctness',
  frameworks: ['expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (
        node.type === 'MemberExpression' &&
        node.object.type === 'Identifier' &&
        node.object.name === 'Constants' &&
        node.property.type === 'Identifier' &&
        node.property.name === 'manifest'
      ) {
        const line = node.loc!.start.line;
        const column = node.loc!.start.column;
        diagnostics.push(makeError(filePath, line, column, sourceLines));
        return;
      }

      if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'ObjectPattern' &&
        node.init?.type === 'Identifier' &&
        node.init.name === 'Constants'
      ) {
        for (const prop of (node.id as TSESTree.ObjectPattern).properties) {
          if (prop.type !== 'Property') continue;
          const key = prop.key;
          if (key.type === 'Identifier' && key.name === 'manifest') {
            const line = node.loc!.start.line;
            const column = node.loc!.start.column;
            diagnostics.push(makeError(filePath, line, column, sourceLines));
            break;
          }
        }
      }
    });

    return diagnostics;
  },
};

export default rule;
