import { describe, it, expect } from 'vitest';
import { computeScore } from '../src/scorer';
import type { Diagnostic } from '../src/rules/types';

function makeDiag(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    ruleId: 'test-rule',
    severity: 'warning',
    category: 'correctness',
    confidence: 1.0,
    message: 'test message',
    component: 'TestComponent',
    filePath: 'test.tsx',
    line: 1,
    column: 0,
    codeSnippet: [],
    fix: '',
    suggestions: [],
    ...overrides,
  };
}

describe('computeScore', () => {
  it('returns perfect score for zero diagnostics', () => {
    const result = computeScore([], 10);
    expect(result.score).toBe(100);
    expect(result.label).toBe('Excellent');
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.affectedFiles).toBe(0);
    expect(result.totalFiles).toBe(10);
  });

  it('penalizes errors more than warnings', () => {
    const errorResult = computeScore(
      [makeDiag({ severity: 'error', confidence: 1.0 })],
      5,
    );
    const warningResult = computeScore(
      [makeDiag({ severity: 'warning', confidence: 1.0 })],
      5,
    );
    expect(errorResult.score).toBeLessThan(warningResult.score);
  });

  it('counts errors and warnings correctly', () => {
    const diagnostics = [
      makeDiag({ severity: 'error' }),
      makeDiag({ severity: 'error' }),
      makeDiag({ severity: 'warning' }),
    ];
    const result = computeScore(diagnostics, 5);
    expect(result.errors).toBe(2);
    expect(result.warnings).toBe(1);
  });

  it('counts affected files correctly', () => {
    const diagnostics = [
      makeDiag({ filePath: 'a.tsx' }),
      makeDiag({ filePath: 'a.tsx' }),
      makeDiag({ filePath: 'b.tsx' }),
    ];
    const result = computeScore(diagnostics, 5);
    expect(result.affectedFiles).toBe(2);
  });

  it('groups diagnostics by category', () => {
    const diagnostics = [
      makeDiag({ category: 'correctness' }),
      makeDiag({ category: 'performance' }),
      makeDiag({ category: 'performance' }),
      makeDiag({ category: 'accessibility' }),
    ];
    const result = computeScore(diagnostics, 5);
    expect(result.byCategory.correctness).toBe(1);
    expect(result.byCategory.performance).toBe(2);
    expect(result.byCategory.accessibility).toBe(1);
    expect(result.byCategory['best-practice']).toBe(0);
  });

  it('never returns a score below 0', () => {
    const diagnostics = Array.from({ length: 100 }, () =>
      makeDiag({ severity: 'error', confidence: 1.0 }),
    );
    const result = computeScore(diagnostics, 1);
    expect(result.score).toBe(0);
  });

  it('assigns correct labels for score ranges', () => {
    // Excellent: >= 90
    expect(computeScore([], 10).label).toBe('Excellent');

    // Great: 75-89 (penalty of ~15 => 2 warnings + 1 error with confidence 1.0 = 7 penalty => 93)
    // Need penalty ~13: 2 errors confidence 1.0 = 10 penalty => score 90 => still Excellent
    // 3 errors confidence 1.0 = 15 penalty => score 85 => Great
    expect(
      computeScore(
        Array.from({ length: 3 }, () =>
          makeDiag({ severity: 'error', confidence: 1.0 }),
        ),
        10,
      ).label,
    ).toBe('Great');

    // Fair: 40-59
    expect(
      computeScore(
        Array.from({ length: 9 }, () =>
          makeDiag({ severity: 'error', confidence: 1.0 }),
        ),
        10,
      ).label,
    ).toBe('Fair');

    // Needs work: < 40
    expect(
      computeScore(
        Array.from({ length: 50 }, () =>
          makeDiag({ severity: 'error', confidence: 1.0 }),
        ),
        10,
      ).label,
    ).toBe('Needs work');
  });
});
