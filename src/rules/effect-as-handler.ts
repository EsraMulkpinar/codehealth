import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const EVENT_FLAG_PATTERNS = [
  /^(is|was|has)(Clicked|Submitted|Pressed|Triggered|Fired|Called)/i,
  /^(on|handle)[A-Z]/,
  /^(clicked|submitted|toggled|triggered|fired)$/i,
];

function looksLikeEventFlag(name: string): boolean {
  return EVENT_FLAG_PATTERNS.some((p) => p.test(name));
}

function isUseEffectCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === 'Identifier' && node.callee.name === 'useEffect';
}

const rule: Rule = {
  id: 'effect-as-handler',
  severity: 'warning',
  category: 'best-practice',
  frameworks: ['react', 'next', 'react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (node.type !== 'CallExpression' || !isUseEffectCall(node)) return;

      const depsArg = node.arguments[1];
      if (!depsArg || depsArg.type !== 'ArrayExpression') return;

      const deps = depsArg.elements;
      if (deps.length !== 1) return;

      const dep = deps[0];
      if (!dep || dep.type !== 'Identifier' || !looksLikeEventFlag(dep.name)) return;

      const line = node.loc!.start.line;
      const column = node.loc!.start.column;
      const component = detectComponent(node);
      const flagName = dep.name;
      const capitalized = flagName.charAt(0).toUpperCase() + flagName.slice(1);

      diagnostics.push({
        ruleId: 'effect-as-handler',
        severity: 'warning',
        category: 'best-practice',
        confidence: 0.70,
        message: `useEffect([${flagName}]) looks like an event handler — move logic directly into the event handler`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Instead of:
const [${flagName}, set${capitalized}] = useState(false);
useEffect(() => { /* side effect */ }, [${flagName}]);

// Do this — run the effect directly in the handler:
function handleEvent() {
  // put the side effect logic here directly
}`,
        suggestions: [
          'useEffect should synchronize with external systems, not react to user events',
          'Event handlers can be async — no need for the effect pattern',
        ],
      });
    });

    return diagnostics;
  },
};

export default rule;
