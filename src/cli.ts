import { Command } from 'commander';
import * as path from 'path';
import { scan } from './scanner';
import { printHeader, printDiagnostics, printSummary, printNoIssues, printAiPrompt, printCompactIssueList, printAiPromptTerminal, printOverview } from './reporter';
import { computeScore } from './scorer';
import { startWatch } from './watcher';
import { ruleMap } from './rules';
import { getRulesForFramework, FRAMEWORK_LABELS } from './profiles';
import { promptFramework, promptNextAction } from './prompt';
import type { Diagnostic, Framework } from './rules/types';

const program = new Command();

program
  .name('codehealth')
  .description('React code scanner with framework-aware diagnostics and fix snippets')
  .version('1.0.0')
  .argument('[path]', 'Path to scan (directory or file)', '.')
  .option('--react',         'Scan as a React project (CRA, Vite, etc.)')
  .option('--next',          'Scan as a Next.js project (App Router / Pages)')
  .option('--react-native',  'Scan as a React Native project')
  .option('--expo',          'Scan as an Expo project')
  .option('-w, --watch',     'Watch mode — re-scan on file changes')
  .option('-r, --rule <ruleId>', 'Run only a specific rule')
  .option('--ignore <pattern>', 'Glob pattern to ignore (can be repeated)', collect, [])
  .option('--list-rules',    'List all available rules (optionally filtered by framework flag)')
  .option('--max-issues <n>', 'Show only first N issues (0 = all)', '0')
  .option('--compact',       'Show file headers only, no code snippets or fix details')
  .option('--ai-prompt',     'Output a plain-text AI prompt for refactoring assistance')
  .action(async (targetPath: string, options: {
    react?: boolean;
    next?: boolean;
    reactNative?: boolean;
    expo?: boolean;
    watch?: boolean;
    rule?: string;
    ignore: string[];
    listRules?: boolean;
    maxIssues: string;
    compact?: boolean;
    aiPrompt?: boolean;
  }) => {
    let framework: Framework | undefined;
    if (options.react)       framework = 'react';
    else if (options.next)   framework = 'next';
    else if (options.reactNative) framework = 'react-native';
    else if (options.expo)   framework = 'expo';

    if (options.listRules) {
      const rules = getRulesForFramework(framework);
      const header = framework
        ? `Rules for ${FRAMEWORK_LABELS[framework]}:`
        : 'All available rules (use --react / --next / --react-native / --expo to filter):';
      console.log(`\n${header}\n`);
      for (const rule of rules) {
        const icon = rule.severity === 'error' ? '✗' : '⚠';
        const fws = rule.frameworks.join(', ');
        console.log(`  ${icon} ${rule.id.padEnd(28)} [${rule.severity.padEnd(7)}]  [${rule.category.padEnd(14)}]  ${fws}`);
      }
      console.log('');
      process.exit(0);
    }

    if (options.rule && !ruleMap.has(options.rule)) {
      console.error(`Unknown rule: "${options.rule}"`);
      console.error(`Run with --list-rules to see available rules.`);
      process.exit(1);
    }

    if (!framework && !options.rule) {
      framework = await promptFramework();
    }

    const resolvedPath = path.resolve(process.cwd(), targetPath);

    const { diagnostics, totalFiles } = await scan({
      targetPath: resolvedPath,
      framework,
      ruleId: options.rule,
      ignore: options.ignore,
    });

    const score = computeScore(diagnostics, totalFiles);

    const maxIssues = parseInt(options.maxIssues, 10);

    if (options.aiPrompt) {
      if (diagnostics.length === 0) {
        console.log(`# No issues found — score: ${score.score}/100`);
      } else {
        printAiPrompt(diagnostics, framework, score, totalFiles, { maxIssues });
      }
    } else {
      const isTTY = process.stdin.isTTY && process.stdout.isTTY;

      if (isTTY && !options.compact && !options.watch && diagnostics.length > 0) {
        printOverview(diagnostics, framework, score);
        printSummary(score);
        let action = await promptNextAction();
        while (action !== 'skip') {
          process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
          if (action === 'overview') {
            printOverview(diagnostics, framework, score);
            printSummary(score);
          } else if (action === 'fixes') {
            printDiagnostics(diagnostics, framework, { maxIssues, compact: false });
          } else if (action === 'ai-prompt') {
            printAiPromptTerminal(diagnostics, framework, score);
          }
          action = await promptNextAction();
        }
        process.stdin.pause();
      } else {
        printHeader(totalFiles, framework);

        if (diagnostics.length > 0) {
          printCompactIssueList(diagnostics);
        } else {
          printNoIssues(totalFiles);
        }

        printSummary(score);
      }
    }

    if (options.watch) {
      console.log('\nWatching for changes...\n');

      const diagMap = new Map<string, Diagnostic[]>();
      for (const diag of diagnostics) {
        if (!diagMap.has(diag.filePath)) diagMap.set(diag.filePath, []);
        diagMap.get(diag.filePath)!.push(diag);
      }

      startWatch({
        targetPath: resolvedPath,
        framework,
        ruleId: options.rule,
        ignore: options.ignore,
        allDiagnostics: diagMap,
        totalFiles,
      });
    } else {
      if (!options.aiPrompt && score.errors > 0) {
        process.exit(1);
      }
    }
  });

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

program.parse(process.argv);
