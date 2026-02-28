import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const rule: Rule = {
  id: 'inline-styles',
  severity: 'warning',
  category: 'performance',
  frameworks: ['react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const reported = new Set<number>();

    traverse(ast, (node) => {
      if (
        node.type !== 'JSXAttribute' ||
        node.name.type !== 'JSXIdentifier' ||
        node.name.name !== 'style'
      ) return;

      const val = node.value;
      if (
        val?.type !== 'JSXExpressionContainer' ||
        val.expression.type !== 'ObjectExpression'
      ) return;

      const line = node.loc!.start.line;
      if (reported.has(line)) return;
      reported.add(line);

      const column = node.loc!.start.column;
      const component = detectComponent(node);

      diagnostics.push({
        ruleId: 'inline-styles',
        severity: 'warning',
        category: 'performance',
        confidence: 0.70,
        message: 'Inline style object — use StyleSheet.create() for better performance',
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `import { StyleSheet } from 'react-native';

// Move styles outside the component:
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // ... your styles
  },
});

// Use in JSX:
<View style={styles.container} />`,
        suggestions: [
          'StyleSheet.create() validates styles at dev time and sends them as IDs (not objects) to the native layer',
          'Memoize dynamic styles with useMemo to avoid recreation on every render',
        ],
      });
    });

    return diagnostics;
  },
};

export default rule;
