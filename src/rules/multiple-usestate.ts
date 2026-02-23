import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const THRESHOLD = 5;

const FORM_NAME_RE = /Form|Dialog|Modal|Sheet|Drawer/;

function isUseStateCall(node: TSESTree.CallExpression): boolean {
  if (node.callee.type === 'Identifier' && node.callee.name === 'useState') return true;
  if (
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'React' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'useState'
  ) return true;
  return false;
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

const rule: Rule = {
  id: 'multiple-usestate',
  severity: 'warning',
  category: 'best-practice',
  frameworks: ['react', 'next', 'react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const visited = new Set<TSESTree.Node>();

    traverse(ast, (node) => {
      if (!isFunctionNode(node) || visited.has(node)) return;
      visited.add(node);

      const useStateCalls: TSESTree.CallExpression[] = [];

      function collectDirect(n: TSESTree.Node, isRoot: boolean): void {
        if (!isRoot && isFunctionNode(n)) return;

        if (n.type === 'CallExpression' && isUseStateCall(n)) {
          useStateCalls.push(n);
        }

        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const child = (n as Record<string, unknown>)[key];
          if (Array.isArray(child)) {
            for (const c of child) {
              if (c && typeof c === 'object' && 'type' in c) collectDirect(c as TSESTree.Node, false);
            }
          } else if (child && typeof child === 'object' && 'type' in child) {
            collectDirect(child as TSESTree.Node, false);
          }
        }
      }

      collectDirect(node, true);

      if (useStateCalls.length <= THRESHOLD) return;

      const firstCall = useStateCalls[0];
      const line = firstCall.loc!.start.line;
      const column = firstCall.loc!.start.column;
      const component = detectComponent(firstCall);

      const isFormComponent = FORM_NAME_RE.test(component);
      const confidence = isFormComponent ? 0.55 : 0.70;

      diagnostics.push({
        ruleId: 'multiple-usestate',
        severity: 'warning',
        category: 'best-practice',
        confidence,
        message: `${useStateCalls.length} useState calls in ${component} — consider useReducer or a state object`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `const [state, dispatch] = useReducer(reducer, initialState);
// Or group related state:
const [formState, setFormState] = useState({
  field1: '',
  field2: '',
  // ...
});`,
        suggestions: [
          'Consider if all state fields relate to the same concern',
          'Alternatives: zustand, jotai for complex state management',
          'Extract custom hook: use' + component + 'State()',
        ],
      });
    });

    return diagnostics;
  },
};

export default rule;
