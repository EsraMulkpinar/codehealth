import fg from 'fast-glob';
import * as path from 'path';
import { parseFile, isParseFailure } from './parser';
import { allRules, ruleMap } from './rules';
import { getRulesForFramework } from './profiles';
import type { Diagnostic, Framework } from './rules/types';

const GLOB_PATTERNS = ['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js'];
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.d.ts',
];

export interface ScanOptions {
  targetPath: string;
  framework?: Framework;
  ruleId?: string;
  ignore?: string[];
}

export interface ScanResult {
  diagnostics: Diagnostic[];
  totalFiles: number;
  scannedFiles: string[];
}

function dedup(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const result: Diagnostic[] = [];

  for (const d of diagnostics) {
    const key = `${d.ruleId}::${d.filePath}::${d.line}`;

    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
    }
  }

  return result;
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const { targetPath, framework, ruleId, ignore = [] } = options;

  const rules = ruleId
    ? [ruleMap.get(ruleId)].filter(Boolean) as typeof allRules
    : getRulesForFramework(framework);

  const files = await fg(GLOB_PATTERNS, {
    cwd: path.resolve(targetPath),
    absolute: true,
    ignore: [...IGNORE_PATTERNS, ...ignore],
  });

  const diagnostics: Diagnostic[] = [];

  for (const filePath of files) {
    const result = parseFile(filePath);

    if (isParseFailure(result)) {
      diagnostics.push({
        ruleId: 'parse-error',
        severity: 'warning',
        category: 'correctness',
        confidence: 1.0,
        message: 'File could not be parsed — syntax error or unsupported syntax',
        component: 'unknown',
        filePath,
        line: result.parseError.line,
        column: 0,
        codeSnippet: [],
        fix: `// Check for syntax errors:\n// ${result.parseError.message}`,
        suggestions: ['Check for missing brackets, invalid JSX, or unsupported syntax'],
      });
      continue;
    }

    if (!result) continue;

    const { ast, sourceLines } = result;

    for (const rule of rules) {
      const ruleDiagnostics = rule.check(ast, filePath, sourceLines);
      diagnostics.push(...ruleDiagnostics);
    }
  }

  return {
    diagnostics: dedup(diagnostics),
    totalFiles: files.length,
    scannedFiles: files,
  };
}

export async function scanFile(
  filePath: string,
  framework?: Framework,
  ruleId?: string
): Promise<Diagnostic[]> {
  const rules = ruleId
    ? [ruleMap.get(ruleId)].filter(Boolean) as typeof allRules
    : getRulesForFramework(framework);

  const result = parseFile(filePath);

  if (isParseFailure(result)) {
    return [{
      ruleId: 'parse-error',
      severity: 'warning',
      category: 'correctness',
      confidence: 1.0,
      message: 'File could not be parsed — syntax error or unsupported syntax',
      component: 'unknown',
      filePath,
      line: result.parseError.line,
      column: 0,
      codeSnippet: [],
      fix: `// Check for syntax errors:\n// ${result.parseError.message}`,
      suggestions: ['Check for missing brackets, invalid JSX, or unsupported syntax'],
    }];
  }

  if (!result) return [];

  const { ast, sourceLines } = result;
  const diagnostics: Diagnostic[] = [];

  for (const rule of rules) {
    diagnostics.push(...rule.check(ast, filePath, sourceLines));
  }

  return dedup(diagnostics);
}
