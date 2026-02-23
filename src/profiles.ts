import type { Framework, Diagnostic } from './rules/types';
import { allRules } from './rules';
import type { Rule } from './rules/types';

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  react:          'React',
  next:           'Next.js',
  'react-native': 'React Native',
  expo:           'Expo',
};

export const FRAMEWORK_DESCRIPTIONS: Record<Framework, string> = {
  react:          'Create React App, Vite, etc.',
  next:           'App Router / Pages Router',
  'react-native': 'Bare workflow',
  expo:           'Managed / Bare workflow',
};

export function getRulesForFramework(framework: Framework | undefined): Rule[] {
  if (!framework) return allRules;
  return allRules.filter((r) => r.frameworks.includes(framework));
}

export function applyExpoOverrides(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.map((d) => {
    if (d.ruleId === 'inline-styles') {
      return {
        ...d,
        suggestions: [
          ...d.suggestions,
          'Use expo-linear-gradient or NativeWind as alternatives',
        ],
      };
    }
    if (d.ruleId === 'no-console-log') {
      return {
        ...d,
        suggestions: [
          ...d.suggestions,
          'Consider expo-dev-client for structured logging',
        ],
      };
    }
    return d;
  });
}
