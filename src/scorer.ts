import type { Diagnostic, Category } from './rules/types';

export interface ScoreResult {
  score: number;
  label: string;
  errors: number;
  warnings: number;
  affectedFiles: number;
  totalFiles: number;
  byCategory: Record<Category, number>;
}

export function computeScore(
  diagnostics: Diagnostic[],
  totalFiles: number
): ScoreResult {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  const affectedFiles = new Set(diagnostics.map((d) => d.filePath)).size;

  let penalty = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') {
      penalty += d.confidence * 5;
    } else {
      penalty += d.confidence * 1;
    }
  }

  const score = Math.max(0, Math.round(100 - penalty));

  let label: string;
  if (score >= 90) label = 'Excellent';
  else if (score >= 75) label = 'Great';
  else if (score >= 60) label = 'Good';
  else if (score >= 40) label = 'Fair';
  else label = 'Needs work';

  const byCategory: Record<Category, number> = {
    correctness: 0,
    performance: 0,
    'best-practice': 0,
    accessibility: 0,
  };

  for (const d of diagnostics) {
    byCategory[d.category]++;
  }

  return { score, label, errors, warnings, affectedFiles, totalFiles, byCategory };
}
