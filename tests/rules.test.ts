import { describe, it, expect } from 'vitest';
import { allRules, ruleMap } from '../src/rules';
import { getRulesForFramework } from '../src/profiles';

describe('allRules', () => {
  it('contains all 19 rules', () => {
    expect(allRules.length).toBe(19);
  });

  it('each rule has required properties', () => {
    for (const rule of allRules) {
      expect(rule.id).toBeTruthy();
      expect(['error', 'warning']).toContain(rule.severity);
      expect(['correctness', 'performance', 'best-practice', 'accessibility']).toContain(
        rule.category,
      );
      expect(rule.frameworks.length).toBeGreaterThan(0);
      expect(typeof rule.check).toBe('function');
    }
  });

  it('has unique rule ids', () => {
    const ids = allRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ruleMap', () => {
  it('contains the same number of entries as allRules', () => {
    expect(ruleMap.size).toBe(allRules.length);
  });

  it('can look up rules by id', () => {
    expect(ruleMap.get('fetch-in-effect')).toBeDefined();
    expect(ruleMap.get('large-component')).toBeDefined();
    expect(ruleMap.get('nonexistent')).toBeUndefined();
  });
});

describe('getRulesForFramework', () => {
  it('returns all rules when no framework specified', () => {
    const rules = getRulesForFramework(undefined);
    expect(rules.length).toBe(allRules.length);
  });

  it('filters rules for react framework', () => {
    const rules = getRulesForFramework('react');
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.frameworks).toContain('react');
    }
  });

  it('filters rules for next framework', () => {
    const rules = getRulesForFramework('next');
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.frameworks).toContain('next');
    }
  });

  it('filters rules for react-native framework', () => {
    const rules = getRulesForFramework('react-native');
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.frameworks).toContain('react-native');
    }
  });

  it('filters rules for expo framework', () => {
    const rules = getRulesForFramework('expo');
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.frameworks).toContain('expo');
    }
  });
});
