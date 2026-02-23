import pc from 'picocolors';
import type { Diagnostic, Framework, Category } from './rules/types';
import type { ScoreResult } from './scorer';
import { FRAMEWORK_LABELS } from './profiles';

const VERSION = '0.2.2';

const AUTO_GROUP_THRESHOLD = 20;
const MAX_LOCATIONS_SHOWN = 5;

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function confidenceDots(confidence: number): string {
  const filled = Math.round(confidence * 5);
  const empty = 5 - filled;
  return pc.yellow('●'.repeat(filled)) + pc.dim('○'.repeat(empty));
}

function categoryColor(cat: Category): (s: string) => string {
  switch (cat) {
    case 'correctness':  return pc.red;
    case 'performance':  return pc.yellow;
    case 'best-practice': return pc.cyan;
    case 'accessibility': return (s: string) => pc.bold(pc.magenta(s));
  }
}

function categoryLabel(cat: Category): string {
  return categoryColor(cat)(cat);
}

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const map = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    if (!map.has(d.filePath)) map.set(d.filePath, []);
    map.get(d.filePath)!.push(d);
  }
  return map;
}

function groupByRule(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const map = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    if (!map.has(d.ruleId)) map.set(d.ruleId, []);
    map.get(d.ruleId)!.push(d);
  }
  const sorted = new Map(
    [...map.entries()].sort(([, a], [, b]) => {
      const aHasError = a.some((d) => d.severity === 'error') ? 0 : 1;
      const bHasError = b.some((d) => d.severity === 'error') ? 0 : 1;
      if (aHasError !== bHasError) return aHasError - bHasError;
      return b.length - a.length;
    })
  );
  return sorted;
}

const RULE_SUMMARY: Record<string, string> = {
  'fetch-in-effect':    'fetch() inside useEffect — use a data fetching library instead',
  'multiple-usestate':  'Multiple useState calls — consider useReducer or a state object',
  'effect-set-state':   'Multiple setState calls inside useEffect — consider useReducer',
  'large-component':    'Component too large — consider splitting into smaller components',
  'effect-as-handler':  'useEffect used as an event handler — move logic into the handler',
  'index-as-key':       'Array index used as key — use a stable unique ID instead',
  'heavy-import':       'Heavy import detected — consider lazy loading or a lighter alternative',
  'img-not-optimized':  '<img> tag — use Next.js <Image> for automatic optimization',
  'inline-styles':      'Inline style object — use StyleSheet.create() for better performance',
  'a11y-label':         'Form element has no accessible label — add aria-label or aria-labelledby',
  'a11y-autofocus':     'autoFocus disrupts screen readers and keyboard navigation',
  'a11y-interactive':   'Mouse handler without keyboard handler — add keyboard interaction',
  'a11y-role':          'Event handler without role — add role for assistive technologies',
  'use-search-params':  'useSearchParams() requires a Suspense boundary',
  'missing-use-client': 'Client hook used without "use client" directive',
  'constants-manifest': 'Constants.manifest deprecated — use Constants.expoConfig',
  'no-console-log':     'console statement in production code — remove or use a logger',
  'flatlist-for-lists': '.map() inside ScrollView — use FlatList for virtualization',
  'rn-accessibility':   'No accessibilityLabel — screen readers cannot identify this element',
};

function normalizeMessage(ruleId: string, fallback: string): string {
  return RULE_SUMMARY[ruleId] ?? fallback;
}

function printGroupedByRule(diagnostics: Diagnostic[]): void {
  const byRule = groupByRule(diagnostics);
  const totalRules = byRule.size;

  for (const [ruleId, reps] of byRule) {
    const rep = reps[0];
    const icon = rep.severity === 'error' ? pc.red('✗') : pc.yellow('⚠');
    const cat = `[${categoryLabel(rep.category)}]`;
    const avgConf = reps.reduce((s, d) => s + d.confidence, 0) / reps.length;
    const dots = confidenceDots(avgConf);
    const countStr = pc.yellow(String(reps.length)) + ` occurrence${reps.length === 1 ? '' : 's'}`;

    console.log(`  ${icon}  ${pc.dim(ruleId)}  ${cat}  ${dots}  ${countStr}`);
    console.log(`     ${pc.bold(normalizeMessage(ruleId, rep.message))}`);
    console.log('');

    const fileMap = new Map<string, number[]>();
    for (const d of reps) {
      const relPath = d.filePath.includes('/src/')
        ? d.filePath.substring(d.filePath.indexOf('/src/') + 1)
        : d.filePath;
      if (!fileMap.has(relPath)) fileMap.set(relPath, []);
      fileMap.get(relPath)!.push(d.line);
    }

    const fileEntries = [...fileMap.entries()];
    console.log(`     ${pc.dim('Affected files:')}`);
    const shown = fileEntries.slice(0, MAX_LOCATIONS_SHOWN);
    for (const [fp, lines] of shown) {
      const lineStr = lines.map((l) => `line ${l}`).join(', ');
      console.log(`     ${pc.dim('›')} ${pc.cyan(fp)}  ${pc.dim(lineStr)}`);
    }
    if (fileEntries.length > MAX_LOCATIONS_SHOWN) {
      console.log(`     ${pc.dim(`+ ${fileEntries.length - MAX_LOCATIONS_SHOWN} more files`)}`);
    }
    console.log('');

    console.log(`     ${pc.green('Fix')} ${'─'.repeat(50)}`);
    for (const line of rep.fix.split('\n')) {
      console.log(`     ${pc.green(line)}`);
    }

    if (rep.suggestions.length > 0) {
      console.log('');
      console.log(`     ${pc.cyan('Suggestions')}`);
      for (const s of rep.suggestions) {
        console.log(`     ${pc.dim('›')} ${s}`);
      }
    }

    console.log('');
    console.log('  ' + pc.dim('─'.repeat(60)));
    console.log('');
  }

  console.log(pc.dim(`  Grouped view: ${diagnostics.length} issues across ${totalRules} rules.`));
  console.log('');
}

function buildAiPrompt(
  diagnostics: Diagnostic[],
  framework: Framework | undefined,
  score: ScoreResult,
  totalFiles: number,
  options?: { maxIssues?: number }
): string {
  const maxIssues = options?.maxIssues ?? 0;
  const visible = maxIssues > 0 ? diagnostics.slice(0, maxIssues) : diagnostics;
  const truncated = visible.length < diagnostics.length;

  const fwLabel = framework ? FRAMEWORK_LABELS[framework] : 'React';
  const errors = visible.filter((d) => d.severity === 'error');
  const warnings = visible.filter((d) => d.severity === 'warning');

  const affectedFiles = new Set(visible.map((d) => d.filePath)).size;

  const lines: string[] = [];

  lines.push('# codehealth AI Refactoring Prompt');
  lines.push('');
  lines.push('## Project Context');
  lines.push(`- **Framework:** ${fwLabel}`);
  lines.push(`- **Files scanned:** ${totalFiles}`);
  lines.push(`- **Health score:** ${score.score} / 100 (${score.label})`);
  lines.push(`- **Issues found:** ${score.errors} ${score.errors === 1 ? 'error' : 'errors'}, ${score.warnings} ${score.warnings === 1 ? 'warning' : 'warnings'} across ${affectedFiles} files`);
  if (truncated) {
    lines.push(`- **Note:** Showing first ${visible.length} of ${diagnostics.length} issues`);
  }
  lines.push('');

  function renderGroup(group: Diagnostic[]): string[] {
    const out: string[] = [];
    const byRule = groupByRule(group);

    for (const [ruleId, reps] of byRule) {
      const rep = reps[0];
      const summary = normalizeMessage(ruleId, rep.message);
      out.push(`### \`${ruleId}\` — ${summary}`);
      out.push(`**Category:** ${rep.category} | **Occurrences:** ${reps.length}`);
      out.push('');

      out.push('**Affected locations:**');
      const fileMap = new Map<string, number[]>();
      for (const d of reps) {
        const relPath = d.filePath.includes('/src/')
          ? d.filePath.substring(d.filePath.indexOf('/src/') + 1)
          : d.filePath;
        if (!fileMap.has(relPath)) fileMap.set(relPath, []);
        fileMap.get(relPath)!.push(d.line);
      }
      for (const [fp, ls] of fileMap) {
        const lineStr = ls.map((l) => `line ${l}`).join(', ');
        out.push(`- \`${fp}\` ${lineStr}`);
      }
      out.push('');

      if (rep.codeSnippet.length > 0) {
        out.push('**Code context (first occurrence):**');
        out.push('```tsx');
        for (const l of rep.codeSnippet) {
          out.push(stripAnsi(l));
        }
        out.push('```');
        out.push('');
      }

      out.push('**Suggested fix:**');
      out.push('```tsx');
      out.push(stripAnsi(rep.fix));
      out.push('```');
      out.push('');

      if (rep.suggestions.length > 0) {
        out.push('**Additional notes:**');
        for (const s of rep.suggestions) {
          out.push(`- ${stripAnsi(s)}`);
        }
        out.push('');
      }
    }

    return out;
  }

  if (errors.length > 0) {
    lines.push(`## Errors (${errors.length})`);
    lines.push('These issues are likely to cause runtime failures or incorrect behavior.');
    lines.push('');
    lines.push(...renderGroup(errors));
  }

  if (warnings.length > 0) {
    lines.push(`## Warnings (${warnings.length})`);
    lines.push('These issues represent code quality, performance, or accessibility improvements.');
    lines.push('');
    lines.push(...renderGroup(warnings));
  }

  lines.push('---');
  lines.push('');
  lines.push('## Instructions for AI');
  lines.push('You are a senior React engineer reviewing the issues above. For each rule group, please:');
  lines.push('1. Explain why the pattern is problematic in 1-2 sentences');
  lines.push('2. Show a concrete refactored version of the first affected file');
  lines.push('3. Note any edge cases or trade-offs');
  lines.push('');
  lines.push('Focus on errors first, then warnings. Keep explanations concise and actionable.');

  return lines.join('\n');
}

export function printAiPrompt(
  diagnostics: Diagnostic[],
  framework: Framework | undefined,
  score: ScoreResult,
  totalFiles: number,
  options?: { maxIssues?: number }
): void {
  process.stdout.write(buildAiPrompt(diagnostics, framework, score, totalFiles, options) + '\n');
}

export function printAiPromptInline(
  diagnostics: Diagnostic[],
  framework: Framework | undefined,
  score: ScoreResult,
  totalFiles: number,
  options?: { maxIssues?: number }
): void {
  console.log('');
  console.log(pc.dim('─── AI Refactoring Prompt ' + '─'.repeat(35)));
  console.log('');
  process.stdout.write(buildAiPrompt(diagnostics, framework, score, totalFiles, options) + '\n');
}

export function printHeader(fileCount: number, framework?: Framework): void {
  const fwLabel = framework ? ` · ${FRAMEWORK_LABELS[framework]}` : '';
  console.log(
    pc.bold(`codehealth v${VERSION}`) +
    pc.dim(fwLabel) +
    pc.dim(` · ${fileCount} files scanned`)
  );
  console.log('');
}

export function printDiagnostic(diag: Diagnostic): void {
  const icon = diag.severity === 'error' ? pc.red('✗') : pc.yellow('⚠');
  const loc = pc.dim(`${diag.line}:${diag.column}`);
  const rule = pc.dim(diag.ruleId);
  const cat = `[${categoryLabel(diag.category)}]`;
  const dots = confidenceDots(diag.confidence);

  console.log(`  ${icon}  ${loc}  ${rule}  ${cat}  ${dots}`);
  console.log(`     ${pc.bold(diag.message)}`);
  console.log('');

  for (const line of diag.codeSnippet) {
    if (line.startsWith('▶')) {
      console.log('  ' + pc.yellow(line));
    } else {
      console.log('  ' + pc.dim(line));
    }
  }

  if (diag.codeSnippet.length > 0) console.log('');

  console.log(`     ${pc.green('Fix')} ${'─'.repeat(50)}`);
  for (const line of diag.fix.split('\n')) {
    console.log(`     ${pc.green(line)}`);
  }

  if (diag.suggestions.length > 0) {
    console.log('');
    console.log(`     ${pc.cyan('Suggestions')}`);
    for (const s of diag.suggestions) {
      console.log(`     ${pc.dim('›')} ${s}`);
    }
  }

  console.log('');
}

function printCompactDiagnostic(diag: Diagnostic): void {
  const icon = diag.severity === 'error' ? pc.red('✗') : pc.yellow('⚠');
  console.log(`  ${icon}  ${pc.dim(`${diag.line}:${diag.column}`)}  ${pc.dim(diag.ruleId)}  [${categoryLabel(diag.category)}]  ${confidenceDots(diag.confidence)}`);
  console.log(`     ${pc.dim(diag.message)}`);
}

export function printDiagnostics(
  diagnostics: Diagnostic[],
  framework?: Framework,
  options?: { maxIssues?: number; compact?: boolean }
): void {
  if (diagnostics.length === 0) return;

  const maxIssues = options?.maxIssues ?? 0;
  const compact = options?.compact ?? false;

  const totalCount = diagnostics.length;
  const visible = maxIssues > 0 ? diagnostics.slice(0, maxIssues) : diagnostics;

  if (visible.length >= AUTO_GROUP_THRESHOLD) {
    printGroupedByRule(visible);
    if (maxIssues > 0 && totalCount > maxIssues) {
      console.log(pc.dim(`  Showing ${maxIssues} of ${totalCount} issues. Use --max-issues 0 to see all.`));
      console.log('');
    }
    return;
  }

  const byFile = groupByFile(visible);

  for (const [filePath, fileDiags] of byFile) {
    const issueWord = fileDiags.length === 1 ? 'issue' : 'issues';
    const relPath = filePath.includes('/src/')
      ? filePath.substring(filePath.indexOf('/src/') + 1)
      : filePath;

    const header = `  ${pc.cyan(relPath)}   ${pc.yellow(String(fileDiags.length))} ${issueWord}`;
    console.log(header);
    console.log('  ' + pc.dim('─'.repeat(Math.max(60, stripAnsi(header).length - 2))));
    console.log('');

    for (const diag of fileDiags) {
      if (compact) {
        printCompactDiagnostic(diag);
      } else {
        printDiagnostic(diag);
      }
    }

    console.log('  ' + pc.dim('─'.repeat(60)));
    console.log('');
  }

  if (maxIssues > 0 && totalCount > maxIssues) {
    console.log(pc.dim(`  Showing ${maxIssues} of ${totalCount} issues. Use --max-issues 0 to see all.`));
    console.log('');
  }
}

export function printSummary(result: ScoreResult): void {
  const { score, label, errors, warnings, affectedFiles, totalFiles, byCategory } = result;

  const BOX_WIDTH = 63;
  const BAR_WIDTH = 50;
  const filled = Math.round((score / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;

  let scoreColor: (s: string) => string;
  if (score >= 90) scoreColor = pc.green;
  else if (score >= 75) scoreColor = pc.cyan;
  else if (score >= 60) scoreColor = pc.yellow;
  else scoreColor = pc.red;

  const bar = scoreColor('█'.repeat(filled)) + pc.dim('░'.repeat(empty));

  const errStr =
    errors > 0
      ? pc.red(`✗ ${errors} ${errors === 1 ? 'error' : 'errors'}`)
      : pc.dim('✗ 0 errors');
  const warnStr =
    warnings > 0
      ? pc.yellow(`⚠ ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`)
      : pc.dim('⚠ 0 warnings');
  const fileStr = pc.dim(`in ${affectedFiles}/${totalFiles} files`);

  const border = '─'.repeat(BOX_WIDTH);
  const pad = (s: string, target: number) =>
    s + ' '.repeat(Math.max(0, target - stripAnsi(s).length));

  const scoreLine = `  ${scoreColor(pc.bold(`${score} / 100`))}  ${pc.dim(label)}`;
  const statsLine = `  ${errStr}   ${warnStr}   ${fileStr}`;

  const cats: Category[] = ['correctness', 'performance', 'best-practice', 'accessibility'];
  const catEntries = cats.map((cat) => {
    const count = byCategory[cat];
    const dots = count > 0
      ? categoryColor(cat)('●'.repeat(Math.min(count, 5)))
      : pc.dim('○');
    return `${pc.dim(cat)}  ${dots}  ${count > 0 ? categoryColor(cat)(String(count)) : pc.dim('0')}`;
  });

  const catLine1 = `  ${pad(catEntries[0], 32)}  ${catEntries[2]}`;
  const catLine2 = `  ${pad(catEntries[1], 32)}  ${catEntries[3]}`;

  function boxLine(content: string): string {
    const raw = stripAnsi(content);
    const padding = Math.max(0, BOX_WIDTH - raw.length - 2);
    return pc.dim('│') + content + ' '.repeat(padding) + pc.dim('│');
  }

  console.log(pc.dim('┌' + border + '┐'));
  console.log(boxLine(`  ${pc.bold('codehealth')}${' '.repeat(BOX_WIDTH - 14)}${scoreColor(pc.bold(`${score} / 100`))}  ${pc.dim(label)}`));
  console.log(boxLine('  ' + bar));
  console.log(pc.dim('│') + ' '.repeat(BOX_WIDTH + 2) + pc.dim('│'));
  console.log(boxLine(statsLine));
  console.log(pc.dim('│') + ' '.repeat(BOX_WIDTH + 2) + pc.dim('│'));
  console.log(boxLine(catLine1));
  console.log(boxLine(catLine2));
  console.log(pc.dim('└' + border + '┘'));
}

export function printNoIssues(totalFiles: number): void {
  console.log(pc.green('✓') + ` No issues found in ${totalFiles} files.\n`);
}
