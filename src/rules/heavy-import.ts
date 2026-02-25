import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { getCodeSnippet } from '../component-detector';
import { traverse } from '../traverse';
import type { Diagnostic, Rule } from './types';

const HEAVY_LIBS: Record<string, string> = {
  moment: 'date-fns or dayjs (much smaller)',
  lodash: 'lodash-es with tree shaking, or native JS',
  '@mui/material': '@mui/material with tree-shaking imports',
  '@material-ui/core': '@mui/material with tree-shaking imports',
  'react-data-grid': 'lazy load: const Grid = lazy(() => import("react-data-grid"))',
  'react-pdf': 'lazy load: const PDFViewer = lazy(() => import("react-pdf"))',
  'react-map-gl': 'lazy load: const Map = lazy(() => import("react-map-gl"))',
  'mapbox-gl': 'lazy load: const mapboxgl = lazy(() => import("mapbox-gl"))',
  'chart.js': 'lazy load with react-chartjs-2 or use a lighter alternative',
  recharts: 'lazy load: const Chart = lazy(() => import("recharts"))',
  three: 'lazy load: const THREE = lazy(() => import("three"))',
  '@react-three/fiber': 'lazy load the 3D component',
  xlsx: 'lazy load: const XLSX = lazy(() => import("xlsx"))',
  pdfmake: 'lazy load or use a server-side solution',
  'draft-js': 'lazy load the editor component',
  quill: 'lazy load: const Quill = lazy(() => import("quill"))',
  'monaco-editor': 'lazy load: const Editor = lazy(() => import("@monaco-editor/react"))',
  prismjs: 'use react-syntax-highlighter with async loading',
  'highlight.js': 'use react-syntax-highlighter with async loading',
};

const rule: Rule = {
  id: 'heavy-import',
  severity: 'warning',
  category: 'performance',
  frameworks: ['react', 'next'],

  check(ast, filePath, sourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    traverse(ast, (node) => {
      if (node.type === 'ImportDeclaration') {
        if (node.importKind === 'type') return;
        const hasRuntimeSpecifier =
          node.specifiers.length === 0 ||
          node.specifiers.some((specifier) =>
            specifier.type === 'ImportSpecifier' ? specifier.importKind !== 'type' : true,
          );
        if (!hasRuntimeSpecifier) return;

        const source = node.source.value as string;
        const suggestion = HEAVY_LIBS[source];
        if (!suggestion) return;

        const line = node.loc!.start.line;
        const column = node.loc!.start.column;

        let fix: string;
        if (source === 'moment') {
          fix = `// Replace moment with date-fns:
import { format, parseISO } from 'date-fns';
const formatted = format(parseISO(dateString), 'yyyy-MM-dd');`;
        } else if (source === 'lodash') {
          fix = `// Use tree-shakeable lodash-es:
import { debounce, groupBy } from 'lodash-es';`;
        } else {
          const varName = source.split('/').pop()!.replace(/[-@]/g, '_');
          fix = `// Lazy load the heavy module:
const ${varName} = React.lazy(() => import('${source}'));

// Wrap usage in Suspense:
<Suspense fallback={<div>Loading...</div>}>
  <HeavyComponent />
</Suspense>`;
        }

        diagnostics.push({
          ruleId: 'heavy-import',
          severity: 'warning',
          category: 'performance',
          confidence: 0.80,
          message: `Heavy import "${source}" — consider: ${suggestion}`,
          component: 'module-level',
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix,
          suggestions: [
            `Lazy loading defers the ${source} bundle until it is actually needed`,
            'Use bundle analysis (next build --analyze or webpack-bundle-analyzer) to measure impact',
          ],
        });
      }
    });

    return diagnostics;
  },
};

export default rule;
