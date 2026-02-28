import { describe, it, expect } from 'vitest';
import { parse, simpleTraverse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import fetchInEffect from '../src/rules/fetch-in-effect';
import multipleUsestate from '../src/rules/multiple-usestate';
import indexAsKey from '../src/rules/index-as-key';
import noConsoleLog from '../src/rules/no-console-log';
import largeComponent from '../src/rules/large-component';

function parseCode(code: string): { ast: TSESTree.Program; sourceLines: string[] } {
  const sourceLines = code.split('\n');
  const ast = parse(code, { jsx: true, loc: true, range: true });
  simpleTraverse(ast, {
    enter(node, parent) {
      if (parent) {
        (node as TSESTree.Node & { parent?: TSESTree.Node }).parent = parent;
      }
    },
  });
  return { ast, sourceLines };
}

describe('fetch-in-effect rule', () => {
  it('detects fetch() inside useEffect', () => {
    const code = `
import { useEffect } from 'react';
function MyComponent() {
  useEffect(() => {
    fetch('/api/data');
  }, []);
  return <div />;
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = fetchInEffect.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].ruleId).toBe('fetch-in-effect');
    expect(diagnostics[0].severity).toBe('error');
  });

  it('does not flag fetch outside useEffect', () => {
    const code = `
function fetchData() {
  return fetch('/api/data');
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = fetchInEffect.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(0);
  });
});

describe('multiple-usestate rule', () => {
  it('detects multiple useState calls in a component', () => {
    const code = `
function MyComponent() {
  const [a, setA] = useState(0);
  const [b, setB] = useState('');
  const [c, setC] = useState(false);
  const [d, setD] = useState(null);
  const [e, setE] = useState([]);
  const [f, setF] = useState({});
  return <div />;
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = multipleUsestate.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].ruleId).toBe('multiple-usestate');
  });

  it('does not flag few useState calls', () => {
    const code = `
function MyComponent() {
  const [a, setA] = useState(0);
  const [b, setB] = useState('');
  return <div />;
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = multipleUsestate.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(0);
  });
});

describe('index-as-key rule', () => {
  it('detects index used as key in map', () => {
    const code = `
function List() {
  return items.map((item, index) => <div key={index}>{item}</div>);
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = indexAsKey.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].ruleId).toBe('index-as-key');
  });

  it('does not flag stable keys', () => {
    const code = `
function List() {
  return items.map((item) => <div key={item.id}>{item.name}</div>);
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = indexAsKey.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(0);
  });
});

describe('no-console-log rule', () => {
  it('detects console.log in code', () => {
    const code = `
function doSomething() {
  console.log('debug');
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = noConsoleLog.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].ruleId).toBe('no-console-log');
  });

  it('does not flag console inside __DEV__ guard', () => {
    const code = `
function doSomething() {
  if (__DEV__) {
    console.log('debug');
  }
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = noConsoleLog.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(0);
  });
});

describe('large-component rule', () => {
  it('does not flag small components', () => {
    const code = `
function SmallComponent() {
  return <div>Hello</div>;
}`;
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = largeComponent.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(0);
  });

  it('detects large components over 300 lines', () => {
    const lines = ['function LargeComponent() {'];
    for (let i = 0; i < 310; i++) {
      lines.push(`  const x${i} = ${i};`);
    }
    lines.push('  return <div />;');
    lines.push('}');
    const code = lines.join('\n');
    const { ast, sourceLines } = parseCode(code);
    const diagnostics = largeComponent.check(ast, 'test.tsx', sourceLines);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].ruleId).toBe('large-component');
  });
});
