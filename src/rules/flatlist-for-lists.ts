import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

function isScrollViewElement(node: TSESTree.JSXOpeningElement): boolean {
  return (
    node.name.type === 'JSXIdentifier' &&
    (node.name.name === 'ScrollView' || node.name.name === 'SafeAreaScrollView')
  );
}

const rule: Rule = {
  id: 'flatlist-for-lists',
  severity: 'warning',
  category: 'performance',
  frameworks: ['react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (
        node.type !== 'CallExpression' ||
        node.callee.type !== 'MemberExpression' ||
        node.callee.property.type !== 'Identifier' ||
        node.callee.property.name !== 'map'
      ) return;

      let current: (TSESTree.Node & { parent?: TSESTree.Node }) | undefined =
        node as TSESTree.Node & { parent?: TSESTree.Node };

      let insideScrollView = false;
      while (current) {
        if (
          current.type === 'JSXElement' &&
          current.openingElement &&
          isScrollViewElement(current.openingElement)
        ) {
          insideScrollView = true;
          break;
        }
        current = current.parent as typeof current;
      }

      if (!insideScrollView) return;

      const line = node.loc!.start.line;
      const column = node.loc!.start.column;
      const component = detectComponent(node);

      diagnostics.push({
        ruleId: 'flatlist-for-lists',
        severity: 'warning',
        category: 'performance',
        confidence: 0.80,
        message: '.map() inside ScrollView — use FlatList for virtualized rendering',
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `import { FlatList } from 'react-native';

// Replace ScrollView + .map() with FlatList:
<FlatList
  data={items}
  keyExtractor={(item) => item.id.toString()}
  renderItem={({ item }) => <ItemComponent item={item} />}
  // Optional performance tweaks:
  initialNumToRender={10}
  maxToRenderPerBatch={10}
/>`,
        suggestions: [
          'FlatList only renders visible items — essential for lists with 50+ items',
          'Use SectionList for grouped data or FlashList (shopify) for even better performance',
        ],
      });
    });

    return diagnostics;
  },
};

export default rule;
