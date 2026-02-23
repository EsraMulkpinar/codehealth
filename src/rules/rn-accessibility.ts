import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { detectComponent, getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const TOUCHABLE_ELEMENTS = new Set([
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'Pressable',
]);

function getJSXAttrs(node: TSESTree.JSXOpeningElement): Map<string, TSESTree.JSXAttribute> {
  const attrs = new Map<string, TSESTree.JSXAttribute>();
  for (const attr of node.attributes) {
    if (attr.type === 'JSXAttribute' && attr.name.type === 'JSXIdentifier') {
      attrs.set(attr.name.name, attr);
    }
  }
  return attrs;
}

function hasDerivableLabel(openingElement: TSESTree.JSXOpeningElement): boolean {
  const jsxElement = (openingElement as TSESTree.Node & { parent?: TSESTree.Node }).parent;
  if (!jsxElement || jsxElement.type !== 'JSXElement') return false;

  for (const child of (jsxElement as TSESTree.JSXElement).children) {
    if (child.type !== 'JSXElement') continue;
    const childOpening = child.openingElement;
    if (
      childOpening.name.type === 'JSXIdentifier' &&
      childOpening.name.name === 'Text'
    ) {
      for (const grandchild of child.children) {
        if (grandchild.type === 'JSXText' && grandchild.value.trim().length > 0) {
          return true;
        }
        if (
          grandchild.type === 'JSXExpressionContainer' &&
          grandchild.expression.type === 'Literal' &&
          typeof grandchild.expression.value === 'string'
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

const rule: Rule = {
  id: 'rn-accessibility',
  severity: 'warning',
  category: 'accessibility',
  frameworks: ['react-native', 'expo'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (
        node.type !== 'JSXOpeningElement' ||
        node.name.type !== 'JSXIdentifier' ||
        !TOUCHABLE_ELEMENTS.has(node.name.name)
      ) return;

      const attrs = getJSXAttrs(node);

      const hasLabel = attrs.has('accessibilityLabel') || attrs.has('aria-label');
      if (hasLabel) return;

      const elementName = node.name.name;
      const line = node.loc!.start.line;
      const column = node.loc!.start.column;
      const component = detectComponent(node);

      const derivable = hasDerivableLabel(node);
      const confidence = derivable ? 0.5 : 0.80;

      const suggestions: string[] = [
        'accessibilityLabel should describe the action, not the visual appearance',
        'Add accessibilityRole="button" alongside the label',
      ];
      if (derivable) {
        suggestions.unshift('The inner Text content may be readable by screen readers — verify before adding label');
      }

      diagnostics.push({
        ruleId: 'rn-accessibility',
        severity: 'warning',
        category: 'accessibility',
        confidence,
        message: `<${elementName}> has no accessibilityLabel — screen readers cannot identify this element`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Add accessibilityLabel to describe the action:
<${elementName}
  accessibilityLabel="Submit the form"
  accessibilityRole="button"
  onPress={handlePress}
>
  <Text>Submit</Text>
</${elementName}>`,
        suggestions,
      });
    });

    return diagnostics;
  },
};

export default rule;
