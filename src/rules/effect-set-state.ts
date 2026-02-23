import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const THRESHOLD = 5;

function isUseEffectCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === 'Identifier' && node.callee.name === 'useEffect';
}

function buildSetterNames(ast: TSESTree.Program): Set<string> {
  const setters = new Set<string>();

  traverse(ast, (node) => {
    if (
      node.type !== 'VariableDeclarator' ||
      node.id.type !== 'ArrayPattern' ||
      !node.init ||
      node.init.type !== 'CallExpression'
    ) return;

    const init = node.init;
    const isUseState =
      (init.callee.type === 'Identifier' && init.callee.name === 'useState') ||
      (init.callee.type === 'MemberExpression' &&
        init.callee.object.type === 'Identifier' &&
        init.callee.object.name === 'React' &&
        init.callee.property.type === 'Identifier' &&
        (init.callee.property as TSESTree.Identifier).name === 'useState');

    if (!isUseState) return;

    const elements = node.id.elements;
    if (elements.length >= 2) {
      const setter = elements[1];
      if (setter && setter.type === 'Identifier') {
        setters.add(setter.name);
      }
    }
  });

  return setters;
}

const rule: Rule = {
  id: 'effect-set-state',
  severity: 'warning',
  category: 'best-practice',
  frameworks: ['react', 'next', 'react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const setterNames = buildSetterNames(ast);

    function isSetterCall(node: TSESTree.CallExpression): boolean {
      if (node.callee.type !== 'Identifier') return false;
      const name = node.callee.name;
      if (setterNames.size > 0) return setterNames.has(name);
      return /^set[A-Z]/.test(name);
    }

    traverse(ast, (node) => {
      if (node.type !== 'CallExpression' || !isUseEffectCall(node)) return;

      const callback = node.arguments[0];
      if (!callback) return;

      const setStateCalls: TSESTree.CallExpression[] = [];
      traverse(callback, (child) => {
        if (child.type === 'CallExpression' && isSetterCall(child)) {
          setStateCalls.push(child);
        }
      });

      if (setStateCalls.length < THRESHOLD) return;

      const line = node.loc!.start.line;
      const column = node.loc!.start.column;
      const component = detectComponent(node);

      diagnostics.push({
        ruleId: 'effect-set-state',
        severity: 'warning',
        category: 'best-practice',
        confidence: 0.80,
        message: `${setStateCalls.length} setState calls inside useEffect — consider useReducer to batch updates`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `const [state, dispatch] = useReducer((state, action) => {
  switch (action.type) {
    case 'LOADED': return { ...state, ...action.payload };
    default: return state;
  }
}, initialState);

useEffect(() => {
  dispatch({ type: 'LOADED', payload: { /* ... */ } });
}, [deps]);`,
        suggestions: [
          'Consider if all these state updates can be derived from a single source of truth',
          'Group related state fields into one object to reduce setter count',
        ],
      });
    });

    return diagnostics;
  },
};

export default rule;
