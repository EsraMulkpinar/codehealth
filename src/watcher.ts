import chokidar from 'chokidar';
import * as path from 'path';
import { scanFile } from './scanner';
import { printDiagnostics, printSummary } from './reporter';
import { computeScore } from './scorer';
import type { Diagnostic, Framework } from './rules/types';

const WATCH_EXTENSIONS = /\.(tsx?|jsx?)$/;

export interface WatchOptions {
  targetPath: string;
  framework?: Framework;
  ruleId?: string;
  ignore?: string[];
  allDiagnostics: Map<string, Diagnostic[]>;
  totalFiles: number;
}

export function startWatch(options: WatchOptions): chokidar.FSWatcher {
  const { targetPath, framework, ruleId, ignore = [], allDiagnostics, totalFiles } = options;

  const ignoredPatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.d.ts',
    ...ignore,
  ];

  const watcher = chokidar.watch(path.resolve(targetPath), {
    ignored: ignoredPatterns,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('error', (err: Error) => {
    if ((err as NodeJS.ErrnoException).code === 'EMFILE') {
      console.error('\n[codehealth] EMFILE: too many open files.');
      console.error('Fix: brew install watchman');
      console.error('     (chokidar uses watchman automatically once installed)\n');
      process.exit(1);
    }
    console.error('[codehealth] Watcher error:', err.message);
  });

  async function handleChange(filePath: string): Promise<void> {
    if (!WATCH_EXTENSIONS.test(filePath)) return;

    const newDiagnostics = await scanFile(filePath, framework, ruleId);

    if (newDiagnostics.length === 0) {
      allDiagnostics.delete(filePath);
    } else {
      allDiagnostics.set(filePath, newDiagnostics);
    }

    process.stdout.write('\x1Bc');

    const all = Array.from(allDiagnostics.values()).flat();

    if (all.length > 0) {
      printDiagnostics(all, framework);
    }

    const score = computeScore(all, totalFiles);
    printSummary(score);
    console.log('\n' + dim('Watching for changes...'));
  }

  watcher.on('change', handleChange);
  watcher.on('add', handleChange);

  return watcher;
}

function dim(s: string): string {
  return `\x1b[2m${s}\x1b[0m`;
}
