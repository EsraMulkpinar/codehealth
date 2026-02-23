"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  FRAMEWORK_DESCRIPTIONS: () => FRAMEWORK_DESCRIPTIONS,
  FRAMEWORK_LABELS: () => FRAMEWORK_LABELS,
  allRules: () => allRules,
  computeScore: () => computeScore,
  getRulesForFramework: () => getRulesForFramework,
  ruleMap: () => ruleMap,
  scan: () => scan,
  scanFile: () => scanFile
});
module.exports = __toCommonJS(index_exports);

// src/scanner.ts
var import_fast_glob = __toESM(require("fast-glob"));
var path = __toESM(require("path"));

// src/parser.ts
var import_typescript_estree = require("@typescript-eslint/typescript-estree");
var fs = __toESM(require("fs"));
function isParseFailure(result) {
  return result !== null && "parseError" in result;
}
function parseFile(filePath) {
  try {
    const source = fs.readFileSync(filePath, "utf-8");
    const sourceLines = source.split("\n");
    const ast = (0, import_typescript_estree.parse)(source, {
      jsx: true,
      loc: true,
      range: true,
      comment: false,
      tokens: false
    });
    addParentRefs(ast);
    return { ast, sourceLines };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lineMatch = msg.match(/\((\d+):/);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
    return { parseError: { filePath, message: msg, line } };
  }
}
function addParentRefs(ast) {
  (0, import_typescript_estree.simpleTraverse)(ast, {
    enter(node, parent) {
      if (parent) {
        node.parent = parent;
      }
    }
  });
}

// src/component-detector.ts
function isPascalCase(name) {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}
function getNameFromPattern(pattern) {
  if (pattern.type === "Identifier") {
    return pattern.name;
  }
  return null;
}
function detectComponent(node) {
  let current = node;
  while (current) {
    if (current.type === "FunctionDeclaration" && current.id) {
      const name = current.id.name;
      if (isPascalCase(name)) return name;
    }
    if (current.type === "VariableDeclarator") {
      const name = getNameFromPattern(current.id);
      if (name && isPascalCase(name)) {
        const init = current.init;
        if (init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
          return name;
        }
      }
    }
    if (current.type === "ExportDefaultDeclaration") {
      const decl = current.declaration;
      if (decl.type === "FunctionDeclaration" || decl.type === "ArrowFunctionExpression" || decl.type === "FunctionExpression") {
        if (decl.type === "FunctionDeclaration" && decl.id) {
          return decl.id.name;
        }
        return "DefaultExport";
      }
    }
    current = current.parent;
  }
  return "unknown";
}
function getCodeSnippet(sourceLines, line) {
  const start = Math.max(0, line - 3);
  const end = Math.min(sourceLines.length - 1, line + 1);
  const snippet = [];
  for (let i = start; i <= end; i++) {
    const lineNum = i + 1;
    const prefix = lineNum === line ? "\u25B6" : " ";
    snippet.push(`${prefix} ${String(lineNum).padStart(3)} \u2502  ${sourceLines[i]}`);
  }
  return snippet;
}

// src/traverse.ts
var SKIP_KEYS = /* @__PURE__ */ new Set(["parent", "loc", "range", "tokens", "comments"]);
function traverse(node, visitor) {
  visitor(node);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === "object" && "type" in c) {
          traverse(c, visitor);
        }
      }
    } else if (child && typeof child === "object" && "type" in child) {
      traverse(child, visitor);
    }
  }
}

// src/rules/fetch-in-effect.ts
function isUseEffectCall(node) {
  return node.callee.type === "Identifier" && node.callee.name === "useEffect";
}
var rule = {
  id: "fetch-in-effect",
  severity: "error",
  category: "correctness",
  frameworks: ["react", "next", "react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type === "CallExpression" && isUseEffectCall(node)) {
        const callback = node.arguments[0];
        if (!callback) return;
        traverse(callback, (child) => {
          if (child.type !== "CallExpression") return;
          const callee = child.callee;
          const isBareCall = callee.type === "Identifier" && callee.name === "fetch";
          const isQualifiedCall = callee.type === "MemberExpression" && callee.object.type === "Identifier" && (callee.object.name === "window" || callee.object.name === "globalThis") && callee.property.type === "Identifier" && callee.property.name === "fetch";
          if (isBareCall || isQualifiedCall) {
            const line = child.loc.start.line;
            const column = child.loc.start.column;
            const component = detectComponent(child);
            diagnostics.push({
              ruleId: "fetch-in-effect",
              severity: "error",
              category: "correctness",
              confidence: 0.95,
              message: "fetch() inside useEffect \u2014 use a data fetching library instead",
              component,
              filePath,
              line,
              column,
              codeSnippet: getCodeSnippet(sourceLines, line),
              fix: `const { data, isLoading } = useQuery({
  queryKey: ['your-key'],
  queryFn: () => fetch('/api/endpoint').then(r => r.json())
});`,
              suggestions: [
                "TanStack Query (react-query) handles caching, deduplication, and background refetching",
                "SWR is a lighter alternative: const { data } = useSWR(key, fetcher)",
                "Race conditions in useEffect fetches are hard to handle \u2014 libraries do this for you"
              ]
            });
          }
        });
      }
    });
    return diagnostics;
  }
};
var fetch_in_effect_default = rule;

// src/rules/multiple-usestate.ts
var THRESHOLD = 5;
var FORM_NAME_RE = /Form|Dialog|Modal|Sheet|Drawer/;
function isUseStateCall(node) {
  if (node.callee.type === "Identifier" && node.callee.name === "useState") return true;
  if (node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier" && node.callee.object.name === "React" && node.callee.property.type === "Identifier" && node.callee.property.name === "useState") return true;
  return false;
}
function isFunctionNode(node) {
  return node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";
}
var rule2 = {
  id: "multiple-usestate",
  severity: "warning",
  category: "best-practice",
  frameworks: ["react", "next", "react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    const visited = /* @__PURE__ */ new Set();
    traverse(ast, (node) => {
      if (!isFunctionNode(node) || visited.has(node)) return;
      visited.add(node);
      const useStateCalls = [];
      function collectDirect(n, isRoot) {
        if (!isRoot && isFunctionNode(n)) return;
        if (n.type === "CallExpression" && isUseStateCall(n)) {
          useStateCalls.push(n);
        }
        for (const key of Object.keys(n)) {
          if (key === "parent" || key === "loc" || key === "range") continue;
          const child = n[key];
          if (Array.isArray(child)) {
            for (const c of child) {
              if (c && typeof c === "object" && "type" in c) collectDirect(c, false);
            }
          } else if (child && typeof child === "object" && "type" in child) {
            collectDirect(child, false);
          }
        }
      }
      collectDirect(node, true);
      if (useStateCalls.length <= THRESHOLD) return;
      const firstCall = useStateCalls[0];
      const line = firstCall.loc.start.line;
      const column = firstCall.loc.start.column;
      const component = detectComponent(firstCall);
      const isFormComponent = FORM_NAME_RE.test(component);
      const confidence = isFormComponent ? 0.55 : 0.7;
      diagnostics.push({
        ruleId: "multiple-usestate",
        severity: "warning",
        category: "best-practice",
        confidence,
        message: `${useStateCalls.length} useState calls in ${component} \u2014 consider useReducer or a state object`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `const [state, dispatch] = useReducer(reducer, initialState);
// Or group related state:
const [formState, setFormState] = useState({
  field1: '',
  field2: '',
  // ...
});`,
        suggestions: [
          "Consider if all state fields relate to the same concern",
          "Alternatives: zustand, jotai for complex state management",
          "Extract custom hook: use" + component + "State()"
        ]
      });
    });
    return diagnostics;
  }
};
var multiple_usestate_default = rule2;

// src/rules/large-component.ts
var LOC_THRESHOLD = 300;
var HOOK_THRESHOLD = 6;
var JSX_THRESHOLD = 30;
function isPascalCase2(name) {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}
function isFunctionNode2(node) {
  return node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";
}
function getFunctionName(node) {
  if (node.type === "FunctionDeclaration" && node.id) return node.id.name;
  if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
    const parent = node.parent;
    if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") {
      return parent.id.name;
    }
  }
  return null;
}
function countHooks(fnNode) {
  let count = 0;
  traverse(fnNode, (node) => {
    if (node !== fnNode && isFunctionNode2(node)) return;
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && /^use[A-Z]/.test(node.callee.name)) {
      count++;
    }
  });
  return count;
}
function countJSXNodes(fnNode) {
  let count = 0;
  traverse(fnNode, (node) => {
    if (node.type === "JSXElement") count++;
  });
  return count;
}
var rule3 = {
  id: "large-component",
  severity: "warning",
  category: "performance",
  frameworks: ["react", "next", "react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    const visited = /* @__PURE__ */ new Set();
    traverse(ast, (node) => {
      if (!isFunctionNode2(node) || visited.has(node)) return;
      visited.add(node);
      if (!node.loc) return;
      const name = getFunctionName(node);
      if (!name || !isPascalCase2(name)) return;
      const lineCount = node.loc.end.line - node.loc.start.line + 1;
      if (lineCount <= LOC_THRESHOLD) return;
      const hookCount = countHooks(node);
      const jsxCount = countJSXNodes(node);
      const isHighComplexity = hookCount > HOOK_THRESHOLD || jsxCount > JSX_THRESHOLD;
      const confidence = isHighComplexity ? 0.85 : 0.55;
      const line = node.loc.start.line;
      const column = node.loc.start.column;
      const component = detectComponent(node);
      diagnostics.push({
        ruleId: "large-component",
        severity: "warning",
        category: "performance",
        confidence,
        message: `Component is ${lineCount} lines (${hookCount} hooks, ${jsxCount} JSX nodes) \u2014 consider splitting`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Extract logical sections into smaller components:
function ${name}Header() { /* ... */ }
function ${name}Body() { /* ... */ }
function ${name}Footer() { /* ... */ }

// Use custom hooks for complex logic:
function use${name}Logic() { /* state + effects */ }`,
        suggestions: [
          "Extract custom hook for state + effect logic",
          "Break JSX into sub-components",
          `Aim for < ${LOC_THRESHOLD} lines, < ${HOOK_THRESHOLD} hooks, < ${JSX_THRESHOLD} JSX nodes`
        ]
      });
    });
    return diagnostics;
  }
};
var large_component_default = rule3;

// src/rules/effect-set-state.ts
var THRESHOLD2 = 5;
function isUseEffectCall2(node) {
  return node.callee.type === "Identifier" && node.callee.name === "useEffect";
}
function buildSetterNames(ast) {
  const setters = /* @__PURE__ */ new Set();
  traverse(ast, (node) => {
    if (node.type !== "VariableDeclarator" || node.id.type !== "ArrayPattern" || !node.init || node.init.type !== "CallExpression") return;
    const init = node.init;
    const isUseState = init.callee.type === "Identifier" && init.callee.name === "useState" || init.callee.type === "MemberExpression" && init.callee.object.type === "Identifier" && init.callee.object.name === "React" && init.callee.property.type === "Identifier" && init.callee.property.name === "useState";
    if (!isUseState) return;
    const elements = node.id.elements;
    if (elements.length >= 2) {
      const setter = elements[1];
      if (setter && setter.type === "Identifier") {
        setters.add(setter.name);
      }
    }
  });
  return setters;
}
var rule4 = {
  id: "effect-set-state",
  severity: "warning",
  category: "best-practice",
  frameworks: ["react", "next", "react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    const setterNames = buildSetterNames(ast);
    function isSetterCall(node) {
      if (node.callee.type !== "Identifier") return false;
      const name = node.callee.name;
      if (setterNames.size > 0) return setterNames.has(name);
      return /^set[A-Z]/.test(name);
    }
    traverse(ast, (node) => {
      if (node.type !== "CallExpression" || !isUseEffectCall2(node)) return;
      const callback = node.arguments[0];
      if (!callback) return;
      const setStateCalls = [];
      traverse(callback, (child) => {
        if (child.type === "CallExpression" && isSetterCall(child)) {
          setStateCalls.push(child);
        }
      });
      if (setStateCalls.length < THRESHOLD2) return;
      const line = node.loc.start.line;
      const column = node.loc.start.column;
      const component = detectComponent(node);
      diagnostics.push({
        ruleId: "effect-set-state",
        severity: "warning",
        category: "best-practice",
        confidence: 0.8,
        message: `${setStateCalls.length} setState calls inside useEffect \u2014 consider useReducer to batch updates`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `const [state, dispatch] = useReducer((state, action) => {
  switch (action.type) {
    case 'LOADED': return { ...state, ...action.payload };
    default: return state;
  }
}, initialState);

useEffect(() => {
  dispatch({ type: 'LOADED', payload: { /* ... */ } });
}, [deps]);`,
        suggestions: [
          "Consider if all these state updates can be derived from a single source of truth",
          "Group related state fields into one object to reduce setter count"
        ]
      });
    });
    return diagnostics;
  }
};
var effect_set_state_default = rule4;

// src/rules/effect-as-handler.ts
var EVENT_FLAG_PATTERNS = [
  /^(is|was|has)(Clicked|Submitted|Pressed|Triggered|Fired|Called)/i,
  /^(on|handle)[A-Z]/,
  /^(clicked|submitted|toggled|triggered|fired)$/i
];
function looksLikeEventFlag(name) {
  return EVENT_FLAG_PATTERNS.some((p) => p.test(name));
}
function isUseEffectCall3(node) {
  return node.callee.type === "Identifier" && node.callee.name === "useEffect";
}
var rule5 = {
  id: "effect-as-handler",
  severity: "warning",
  category: "best-practice",
  frameworks: ["react", "next", "react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "CallExpression" || !isUseEffectCall3(node)) return;
      const depsArg = node.arguments[1];
      if (!depsArg || depsArg.type !== "ArrayExpression") return;
      const deps = depsArg.elements;
      if (deps.length !== 1) return;
      const dep = deps[0];
      if (!dep || dep.type !== "Identifier" || !looksLikeEventFlag(dep.name)) return;
      const line = node.loc.start.line;
      const column = node.loc.start.column;
      const component = detectComponent(node);
      const flagName = dep.name;
      const capitalized = flagName.charAt(0).toUpperCase() + flagName.slice(1);
      diagnostics.push({
        ruleId: "effect-as-handler",
        severity: "warning",
        category: "best-practice",
        confidence: 0.7,
        message: `useEffect([${flagName}]) looks like an event handler \u2014 move logic directly into the event handler`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Instead of:
const [${flagName}, set${capitalized}] = useState(false);
useEffect(() => { /* side effect */ }, [${flagName}]);

// Do this \u2014 run the effect directly in the handler:
function handleEvent() {
  // put the side effect logic here directly
}`,
        suggestions: [
          "useEffect should synchronize with external systems, not react to user events",
          "Event handlers can be async \u2014 no need for the effect pattern"
        ]
      });
    });
    return diagnostics;
  }
};
var effect_as_handler_default = rule5;

// src/rules/index-as-key.ts
var rule6 = {
  id: "index-as-key",
  severity: "warning",
  category: "best-practice",
  frameworks: ["react", "next", "react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression" || node.callee.property.type !== "Identifier" || node.callee.property.name !== "map") return;
      const callback = node.arguments[0];
      if (!callback || callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") return;
      const params = callback.params;
      if (params.length < 2 || params[1].type !== "Identifier") return;
      const indexParamName = params[1].name;
      traverse(callback, (child) => {
        if (child.type === "JSXAttribute" && child.name.type === "JSXIdentifier" && child.name.name === "key" && child.value?.type === "JSXExpressionContainer" && child.value.expression.type === "Identifier" && child.value.expression.name === indexParamName) {
          const line = child.loc.start.line;
          const column = child.loc.start.column;
          const component = detectComponent(child);
          diagnostics.push({
            ruleId: "index-as-key",
            severity: "warning",
            category: "best-practice",
            confidence: 0.9,
            message: `key={${indexParamName}} (array index) \u2014 use a stable unique ID instead`,
            component,
            filePath,
            line,
            column,
            codeSnippet: getCodeSnippet(sourceLines, line),
            fix: `// Use a stable unique identifier from the data:
items.map((item) => (
  <Component key={item.id} {...item} />
))

// If items have no ID, add one when creating the array:
const itemsWithIds = rawItems.map((item) => ({ ...item, id: item.id ?? crypto.randomUUID() }));`,
            suggestions: [
              "Index keys cause incorrect reconciliation when items are reordered or filtered",
              "If data has no natural ID, generate stable IDs at the data-fetching layer"
            ]
          });
        }
      });
    });
    return diagnostics;
  }
};
var index_as_key_default = rule6;

// src/rules/a11y-autofocus.ts
var rule7 = {
  id: "a11y-autofocus",
  severity: "warning",
  category: "accessibility",
  frameworks: ["react", "next"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "JSXAttribute" || node.name.type !== "JSXIdentifier" || node.name.name !== "autoFocus") return;
      if (node.value?.type === "JSXExpressionContainer" && node.value.expression.type === "Literal" && node.value.expression.value === false) return;
      const line = node.loc.start.line;
      const column = node.loc.start.column;
      const component = detectComponent(node);
      diagnostics.push({
        ruleId: "a11y-autofocus",
        severity: "warning",
        category: "accessibility",
        confidence: 0.85,
        message: "autoFocus disrupts screen readers and keyboard navigation",
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Remove autoFocus, or focus programmatically after user action:
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  // Only focus when modal/dialog opens, not on initial page load
  if (isOpen) inputRef.current?.focus();
}, [isOpen]);

<input ref={inputRef} />`,
        suggestions: [
          "If focusing inside a modal, use the dialog role and manage focus with useEffect",
          "WCAG 2.4.3: Focus order must be logical and predictable"
        ]
      });
    });
    return diagnostics;
  }
};
var a11y_autofocus_default = rule7;

// src/rules/a11y-label.ts
var FORM_ELEMENTS = /* @__PURE__ */ new Set(["input", "select", "textarea"]);
function getAttributeValue(attrs, name) {
  for (const attr of attrs) {
    if (attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier" && attr.name.name === name) {
      if (attr.value?.type === "Literal") return String(attr.value.value);
      if (attr.value?.type === "JSXExpressionContainer" && attr.value.expression.type === "Literal") {
        return String(attr.value.expression.value);
      }
      return "__dynamic__";
    }
  }
  return null;
}
function hasAttr(attrs, name) {
  return getAttributeValue(attrs, name) !== null;
}
var rule8 = {
  id: "a11y-label",
  severity: "warning",
  category: "accessibility",
  frameworks: ["react", "next"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "JSXOpeningElement") return;
      if (node.name.type !== "JSXIdentifier") return;
      const name = node.name.name;
      if (!FORM_ELEMENTS.has(name)) return;
      const attrs = node.attributes;
      const typeValue = getAttributeValue(attrs, "type");
      if (typeValue === "hidden") return;
      if (!hasAttr(attrs, "aria-label") && !hasAttr(attrs, "aria-labelledby")) {
        const line = node.loc.start.line;
        const column = node.loc.start.column;
        const component = detectComponent(node);
        diagnostics.push({
          ruleId: "a11y-label",
          severity: "warning",
          category: "accessibility",
          confidence: 0.75,
          message: `<${name}> has no accessible label \u2014 add aria-label, aria-labelledby, or an associated <label>`,
          component,
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix: `// Option 1: Use aria-label
<${name} aria-label="Descriptive label" />

// Option 2: Associate with a <label> element
<label htmlFor="my-${name}">Label text</label>
<${name} id="my-${name}" />

// Option 3: Use aria-labelledby
<span id="my-label">Label text</span>
<${name} aria-labelledby="my-label" />`,
          suggestions: [
            "WCAG 1.3.1: Form elements must have programmatic labels",
            "Placeholder text is not a substitute for a label",
            'If using id, ensure a <label htmlFor="..."> element is also present'
          ]
        });
      }
    });
    return diagnostics;
  }
};
var a11y_label_default = rule8;

// src/rules/a11y-interactive.ts
var INTERACTIVE_HANDLERS = /* @__PURE__ */ new Set(["onClick", "onDoubleClick", "onContextMenu"]);
var KEYBOARD_HANDLERS = /* @__PURE__ */ new Set(["onKeyDown", "onKeyUp", "onKeyPress"]);
var NON_INTERACTIVE_ELEMENTS = /* @__PURE__ */ new Set([
  "div",
  "span",
  "p",
  "li",
  "td",
  "th",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "nav"
]);
function hasAttr2(attrs, nameSet) {
  return attrs.some(
    (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && nameSet.has(a.name.name)
  );
}
var rule9 = {
  id: "a11y-interactive",
  severity: "warning",
  category: "accessibility",
  frameworks: ["react", "next"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "JSXOpeningElement") return;
      if (node.name.type !== "JSXIdentifier") return;
      const name = node.name.name;
      if (!NON_INTERACTIVE_ELEMENTS.has(name)) return;
      const attrs = node.attributes;
      const hasMouseHandler = hasAttr2(attrs, INTERACTIVE_HANDLERS);
      const hasKeyboardHandler = hasAttr2(attrs, KEYBOARD_HANDLERS);
      if (hasMouseHandler && !hasKeyboardHandler) {
        const line = node.loc.start.line;
        const column = node.loc.start.column;
        const component = detectComponent(node);
        diagnostics.push({
          ruleId: "a11y-interactive",
          severity: "warning",
          category: "accessibility",
          confidence: 0.7,
          message: `<${name}> has mouse handler but no keyboard handler \u2014 keyboard-only users cannot interact`,
          component,
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix: `// Add keyboard support and proper role:
<${name}
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(e)}
>

// Or better \u2014 use a <button> which is keyboard-accessible by default:
<button onClick={handleClick}>...</button>`,
          suggestions: [
            "WCAG 2.1.1: All functionality must be operable via keyboard",
            "Consider replacing with the semantic HTML element (<button>, <a>, etc.)"
          ]
        });
      }
    });
    return diagnostics;
  }
};
var a11y_interactive_default = rule9;

// src/rules/a11y-role.ts
var EVENT_HANDLERS = /* @__PURE__ */ new Set([
  "onClick",
  "onDoubleClick",
  "onContextMenu",
  "onMouseDown",
  "onMouseUp",
  "onMouseEnter",
  "onMouseLeave",
  "onFocus",
  "onBlur"
]);
var ELEMENTS_NEEDING_ROLE = /* @__PURE__ */ new Set([
  "div",
  "span",
  "p",
  "li",
  "td",
  "th",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "nav",
  "ul",
  "ol"
]);
function hasAttr3(attrs, nameOrSet) {
  const check = typeof nameOrSet === "string" ? (n) => n === nameOrSet : (n) => nameOrSet.has(n);
  return attrs.some(
    (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && check(a.name.name)
  );
}
var rule10 = {
  id: "a11y-role",
  severity: "warning",
  category: "accessibility",
  frameworks: ["react", "next"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "JSXOpeningElement") return;
      if (node.name.type !== "JSXIdentifier") return;
      const name = node.name.name;
      if (!ELEMENTS_NEEDING_ROLE.has(name)) return;
      const attrs = node.attributes;
      const hasEventHandler = hasAttr3(attrs, EVENT_HANDLERS);
      const hasRole = hasAttr3(attrs, "role");
      if (hasEventHandler && !hasRole) {
        const line = node.loc.start.line;
        const column = node.loc.start.column;
        const component = detectComponent(node);
        diagnostics.push({
          ruleId: "a11y-role",
          severity: "warning",
          category: "accessibility",
          confidence: 0.7,
          message: `<${name}> has event handler but no role \u2014 assistive technologies won't announce it correctly`,
          component,
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix: `// Add the appropriate ARIA role:
<${name} role="button" tabIndex={0} onClick={handler}>

// Common roles: button, link, checkbox, menuitem, tab, listitem, dialog
// Or replace with the semantic HTML element:
// div[role=button] \u2192 <button>
// div[role=link]   \u2192 <a href="...">
// div[role=list]   \u2192 <ul> or <ol>`,
          suggestions: [
            "WCAG 4.1.2: UI components must have a programmatically determinable name and role",
            "Prefer semantic HTML over ARIA roles when possible"
          ]
        });
      }
    });
    return diagnostics;
  }
};
var a11y_role_default = rule10;

// src/rules/heavy-import.ts
var HEAVY_LIBS = {
  moment: "date-fns or dayjs (much smaller)",
  lodash: "lodash-es with tree shaking, or native JS",
  "@mui/material": "@mui/material with tree-shaking imports",
  "@material-ui/core": "@mui/material with tree-shaking imports",
  "react-data-grid": 'lazy load: const Grid = lazy(() => import("react-data-grid"))',
  "react-pdf": 'lazy load: const PDFViewer = lazy(() => import("react-pdf"))',
  "react-map-gl": 'lazy load: const Map = lazy(() => import("react-map-gl"))',
  "mapbox-gl": 'lazy load: const mapboxgl = lazy(() => import("mapbox-gl"))',
  "chart.js": "lazy load with react-chartjs-2 or use a lighter alternative",
  recharts: 'lazy load: const Chart = lazy(() => import("recharts"))',
  three: 'lazy load: const THREE = lazy(() => import("three"))',
  "@react-three/fiber": "lazy load the 3D component",
  xlsx: 'lazy load: const XLSX = lazy(() => import("xlsx"))',
  pdfmake: "lazy load or use a server-side solution",
  "draft-js": "lazy load the editor component",
  quill: 'lazy load: const Quill = lazy(() => import("quill"))',
  "monaco-editor": 'lazy load: const Editor = lazy(() => import("@monaco-editor/react"))',
  prismjs: "use react-syntax-highlighter with async loading",
  "highlight.js": "use react-syntax-highlighter with async loading"
};
var rule11 = {
  id: "heavy-import",
  severity: "warning",
  category: "performance",
  frameworks: ["react", "next"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type === "ImportDeclaration") {
        const source = node.source.value;
        const suggestion = HEAVY_LIBS[source];
        if (!suggestion) return;
        const line = node.loc.start.line;
        const column = node.loc.start.column;
        let fix;
        if (source === "moment") {
          fix = `// Replace moment with date-fns:
import { format, parseISO } from 'date-fns';
const formatted = format(parseISO(dateString), 'yyyy-MM-dd');`;
        } else if (source === "lodash") {
          fix = `// Use tree-shakeable lodash-es:
import { debounce, groupBy } from 'lodash-es';`;
        } else {
          const varName = source.split("/").pop().replace(/[-@]/g, "_");
          fix = `// Lazy load the heavy module:
const ${varName} = React.lazy(() => import('${source}'));

// Wrap usage in Suspense:
<Suspense fallback={<div>Loading...</div>}>
  <HeavyComponent />
</Suspense>`;
        }
        diagnostics.push({
          ruleId: "heavy-import",
          severity: "warning",
          category: "performance",
          confidence: 0.8,
          message: `Heavy import "${source}" \u2014 consider: ${suggestion}`,
          component: "module-level",
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix,
          suggestions: [
            `Lazy loading defers the ${source} bundle until it is actually needed`,
            "Use bundle analysis (next build --analyze or webpack-bundle-analyzer) to measure impact"
          ]
        });
      }
    });
    return diagnostics;
  }
};
var heavy_import_default = rule11;

// src/rules/use-search-params.ts
function isComponentWrappedInSuspense(ast, componentName) {
  const usages = [];
  traverse(ast, (node) => {
    if (node.type === "JSXOpeningElement" && node.name.type === "JSXIdentifier" && node.name.name === componentName) {
      let insideSuspense = false;
      let cur = node.parent;
      while (cur) {
        if (cur.type === "JSXElement" && cur.openingElement?.name?.name === "Suspense") {
          insideSuspense = true;
          break;
        }
        cur = cur.parent;
      }
      usages.push(insideSuspense);
    }
  });
  return usages.length > 0 && usages.every(Boolean);
}
var rule12 = {
  id: "use-search-params",
  severity: "warning",
  category: "correctness",
  frameworks: ["next"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "CallExpression" || node.callee.type !== "Identifier" || node.callee.name !== "useSearchParams") return;
      const component = detectComponent(node);
      if (isComponentWrappedInSuspense(ast, component)) return;
      const line = node.loc.start.line;
      const column = node.loc.start.column;
      diagnostics.push({
        ruleId: "use-search-params",
        severity: "warning",
        category: "correctness",
        confidence: 0.85,
        message: "useSearchParams() requires a Suspense boundary \u2014 wrap the component or its parent",
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Wrap the component with Suspense:
<Suspense fallback={<div>Loading...</div>}>
  <${component} />
</Suspense>

// Or use a separate client component with Suspense in the parent.`,
        suggestions: [
          "Next.js requires Suspense because useSearchParams reads from a dynamic data source",
          "Consider a loading skeleton as the Suspense fallback for better UX"
        ]
      });
    });
    return diagnostics;
  }
};
var use_search_params_default = rule12;

// src/rules/missing-use-client.ts
var CLIENT_HOOKS = /* @__PURE__ */ new Set([
  "useState",
  "useEffect",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useContext",
  "useLayoutEffect",
  "useImperativeHandle",
  "useTransition",
  "useDeferredValue",
  "useId"
]);
function hasUseClientDirective(ast) {
  for (const node of ast.body) {
    if (node.type === "ExpressionStatement" && node.expression.type === "Literal" && node.expression.value === "use client") {
      return true;
    }
  }
  return false;
}
function isAppRouterFile(filePath) {
  return /[/\\]app[/\\]/.test(filePath);
}
function buildReactHookLocals(ast) {
  const locals = /* @__PURE__ */ new Set();
  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration") continue;
    if (node.source.value !== "react") continue;
    for (const spec of node.specifiers) {
      if (spec.type === "ImportSpecifier") {
        const imported = spec.imported.type === "Identifier" ? spec.imported.name : String(spec.imported.value);
        if (CLIENT_HOOKS.has(imported)) {
          locals.add(spec.local.name);
        }
      }
    }
  }
  return locals;
}
var rule13 = {
  id: "missing-use-client",
  severity: "error",
  category: "correctness",
  frameworks: ["next"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    if (!isAppRouterFile(filePath)) return diagnostics;
    if (hasUseClientDirective(ast)) return diagnostics;
    const reactHookLocals = buildReactHookLocals(ast);
    function isClientHookCall(node) {
      if (node.callee.type === "Identifier" && reactHookLocals.has(node.callee.name)) {
        return true;
      }
      if (node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier" && node.callee.object.name === "React" && node.callee.property.type === "Identifier" && CLIENT_HOOKS.has(node.callee.property.name)) {
        return true;
      }
      return false;
    }
    const found = [];
    traverse(ast, (node) => {
      if (node.type === "CallExpression" && isClientHookCall(node)) {
        found.push(node);
      }
    });
    if (found.length === 0) return diagnostics;
    const firstHook = found[0];
    const line = firstHook.loc.start.line;
    const column = firstHook.loc.start.column;
    const callee = firstHook.callee;
    const hookName = callee.type === "Identifier" ? callee.name : callee.property.type === "Identifier" ? callee.property.name : "hook";
    const component = detectComponent(firstHook);
    diagnostics.push({
      ruleId: "missing-use-client",
      severity: "error",
      category: "correctness",
      confidence: 0.95,
      message: `${hookName}() used without "use client" directive \u2014 this will fail in Next.js App Router`,
      component,
      filePath,
      line,
      column,
      codeSnippet: getCodeSnippet(sourceLines, line),
      fix: `// Add at the very top of the file (before imports):
'use client';

import React, { ${hookName} } from 'react';
// ... rest of your component`,
      suggestions: [
        "Check if this file should be in the pages/ directory instead",
        "Server Components cannot use hooks \u2014 split into a Client Component if needed"
      ]
    });
    return diagnostics;
  }
};
var missing_use_client_default = rule13;

// src/rules/img-not-optimized.ts
function hasSrcAttr(node) {
  return node.attributes.some(
    (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "src"
  );
}
var rule14 = {
  id: "img-not-optimized",
  severity: "warning",
  category: "performance",
  frameworks: ["next"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type === "JSXOpeningElement" && node.name.type === "JSXIdentifier" && node.name.name === "img") {
        if (!hasSrcAttr(node)) return;
        const line = node.loc.start.line;
        const column = node.loc.start.column;
        const component = detectComponent(node);
        diagnostics.push({
          ruleId: "img-not-optimized",
          severity: "warning",
          category: "performance",
          confidence: 0.85,
          message: "<img> tag used \u2014 use Next.js <Image> for automatic optimization",
          component,
          filePath,
          line,
          column,
          codeSnippet: getCodeSnippet(sourceLines, line),
          fix: `import Image from 'next/image';

// Replace <img> with <Image>:
<Image
  src="/your-image.png"
  alt="Descriptive alt text"
  width={800}
  height={600}
/>

// For images with unknown dimensions, use fill:
<div style={{ position: 'relative', width: '100%', height: 300 }}>
  <Image src="/your-image.png" alt="..." fill style={{ objectFit: 'cover' }} />
</div>`,
          suggestions: [
            "Next.js <Image> provides automatic WebP conversion, lazy loading, and size optimization",
            "Add width and height to prevent layout shift (CLS)"
          ]
        });
      }
    });
    return diagnostics;
  }
};
var img_not_optimized_default = rule14;

// src/rules/inline-styles.ts
var rule15 = {
  id: "inline-styles",
  severity: "warning",
  category: "performance",
  frameworks: ["react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    const reported = /* @__PURE__ */ new Set();
    traverse(ast, (node) => {
      if (node.type !== "JSXAttribute" || node.name.type !== "JSXIdentifier" || node.name.name !== "style") return;
      const val = node.value;
      if (val?.type !== "JSXExpressionContainer" || val.expression.type !== "ObjectExpression") return;
      const line = node.loc.start.line;
      if (reported.has(line)) return;
      reported.add(line);
      const column = node.loc.start.column;
      const component = detectComponent(node);
      diagnostics.push({
        ruleId: "inline-styles",
        severity: "warning",
        category: "performance",
        confidence: 0.7,
        message: "Inline style object \u2014 use StyleSheet.create() for better performance",
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `import { StyleSheet } from 'react-native';

// Move styles outside the component:
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // ... your styles
  },
});

// Use in JSX:
<View style={styles.container} />`,
        suggestions: [
          "StyleSheet.create() validates styles at dev time and sends them as IDs (not objects) to the native layer",
          "Memoize dynamic styles with useMemo to avoid recreation on every render"
        ]
      });
    });
    return diagnostics;
  }
};
var inline_styles_default = rule15;

// src/rules/no-console-log.ts
function isInsideDevGuard(node) {
  let current = node;
  while (current?.parent) {
    const parent = current.parent;
    if (parent.type === "IfStatement" && parent.test.type === "Identifier" && parent.test.name === "__DEV__") {
      return true;
    }
    current = parent;
  }
  return false;
}
var rule16 = {
  id: "no-console-log",
  severity: "warning",
  category: "best-practice",
  frameworks: ["react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression" || node.callee.object.type !== "Identifier" || node.callee.object.name !== "console" || node.callee.property.type !== "Identifier") return;
      const method = node.callee.property.name;
      if (!["log", "warn", "error", "info", "debug"].includes(method)) return;
      if (isInsideDevGuard(node)) return;
      const line = node.loc.start.line;
      const column = node.loc.start.column;
      diagnostics.push({
        ruleId: "no-console-log",
        severity: "warning",
        category: "best-practice",
        confidence: 0.85,
        message: `console.${method}() left in production code \u2014 remove or use a proper logger`,
        component: "module-level",
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Option 1: Remove the console statement entirely

// Option 2: Use __DEV__ guard (React Native built-in):
if (__DEV__) {
  console.${method}('debug info');
}

// Option 3: Use a logger library like react-native-logs:
import { logger } from './logger';
logger.${method === "log" ? "debug" : method}('message');`,
        suggestions: [
          "console statements are stripped in release builds by Metro, but leaving them adds noise"
        ]
      });
    });
    return diagnostics;
  }
};
var no_console_log_default = rule16;

// src/rules/flatlist-for-lists.ts
function isScrollViewElement(node) {
  return node.name.type === "JSXIdentifier" && (node.name.name === "ScrollView" || node.name.name === "SafeAreaScrollView");
}
var rule17 = {
  id: "flatlist-for-lists",
  severity: "warning",
  category: "performance",
  frameworks: ["react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression" || node.callee.property.type !== "Identifier" || node.callee.property.name !== "map") return;
      let current = node;
      let insideScrollView = false;
      while (current) {
        if (current.type === "JSXElement" && current.openingElement && isScrollViewElement(current.openingElement)) {
          insideScrollView = true;
          break;
        }
        current = current.parent;
      }
      if (!insideScrollView) return;
      const line = node.loc.start.line;
      const column = node.loc.start.column;
      const component = detectComponent(node);
      diagnostics.push({
        ruleId: "flatlist-for-lists",
        severity: "warning",
        category: "performance",
        confidence: 0.8,
        message: ".map() inside ScrollView \u2014 use FlatList for virtualized rendering",
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `import { FlatList } from 'react-native';

// Replace ScrollView + .map() with FlatList:
<FlatList
  data={items}
  keyExtractor={(item) => item.id.toString()}
  renderItem={({ item }) => <ItemComponent item={item} />}
  // Optional performance tweaks:
  initialNumToRender={10}
  maxToRenderPerBatch={10}
/>`,
        suggestions: [
          "FlatList only renders visible items \u2014 essential for lists with 50+ items",
          "Use SectionList for grouped data or FlashList (shopify) for even better performance"
        ]
      });
    });
    return diagnostics;
  }
};
var flatlist_for_lists_default = rule17;

// src/rules/rn-accessibility.ts
var TOUCHABLE_ELEMENTS = /* @__PURE__ */ new Set([
  "TouchableOpacity",
  "TouchableHighlight",
  "TouchableWithoutFeedback",
  "TouchableNativeFeedback",
  "Pressable"
]);
function getJSXAttrs(node) {
  const attrs = /* @__PURE__ */ new Map();
  for (const attr of node.attributes) {
    if (attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier") {
      attrs.set(attr.name.name, attr);
    }
  }
  return attrs;
}
function hasDerivableLabel(openingElement) {
  const jsxElement = openingElement.parent;
  if (!jsxElement || jsxElement.type !== "JSXElement") return false;
  for (const child of jsxElement.children) {
    if (child.type !== "JSXElement") continue;
    const childOpening = child.openingElement;
    if (childOpening.name.type === "JSXIdentifier" && childOpening.name.name === "Text") {
      for (const grandchild of child.children) {
        if (grandchild.type === "JSXText" && grandchild.value.trim().length > 0) {
          return true;
        }
        if (grandchild.type === "JSXExpressionContainer" && grandchild.expression.type === "Literal" && typeof grandchild.expression.value === "string") {
          return true;
        }
      }
    }
  }
  return false;
}
var rule18 = {
  id: "rn-accessibility",
  severity: "warning",
  category: "accessibility",
  frameworks: ["react-native", "expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type !== "JSXOpeningElement" || node.name.type !== "JSXIdentifier" || !TOUCHABLE_ELEMENTS.has(node.name.name)) return;
      const attrs = getJSXAttrs(node);
      const hasLabel = attrs.has("accessibilityLabel") || attrs.has("aria-label");
      if (hasLabel) return;
      const elementName = node.name.name;
      const line = node.loc.start.line;
      const column = node.loc.start.column;
      const component = detectComponent(node);
      const derivable = hasDerivableLabel(node);
      const confidence = derivable ? 0.5 : 0.8;
      const suggestions = [
        "accessibilityLabel should describe the action, not the visual appearance",
        'Add accessibilityRole="button" alongside the label'
      ];
      if (derivable) {
        suggestions.unshift("The inner Text content may be readable by screen readers \u2014 verify before adding label");
      }
      diagnostics.push({
        ruleId: "rn-accessibility",
        severity: "warning",
        category: "accessibility",
        confidence,
        message: `<${elementName}> has no accessibilityLabel \u2014 screen readers cannot identify this element`,
        component,
        filePath,
        line,
        column,
        codeSnippet: getCodeSnippet(sourceLines, line),
        fix: `// Add accessibilityLabel to describe the action:
<${elementName}
  accessibilityLabel="Submit the form"
  accessibilityRole="button"
  onPress={handlePress}
>
  <Text>Submit</Text>
</${elementName}>`,
        suggestions
      });
    });
    return diagnostics;
  }
};
var rn_accessibility_default = rule18;

// src/rules/constants-manifest.ts
function makeError(filePath, line, column, sourceLines) {
  return {
    ruleId: "constants-manifest",
    severity: "error",
    category: "correctness",
    confidence: 0.99,
    message: "Constants.manifest is deprecated in Expo SDK 46+ \u2014 use Constants.expoConfig",
    component: "module-level",
    filePath,
    line,
    column,
    codeSnippet: getCodeSnippet(sourceLines, line),
    fix: `import Constants from 'expo-constants';

// Before (deprecated):
const appName = Constants.manifest?.name;

// After:
const appName = Constants.expoConfig?.name;

// For extra fields (app.json > extra):
const apiUrl = Constants.expoConfig?.extra?.apiUrl;`,
    suggestions: [
      "Constants.manifest was removed in Expo SDK 50 \u2014 update immediately",
      "Use Constants.expoConfig for all app.json / app.config.js fields"
    ]
  };
}
var rule19 = {
  id: "constants-manifest",
  severity: "error",
  category: "correctness",
  frameworks: ["expo"],
  check(ast, filePath, sourceLines) {
    const diagnostics = [];
    traverse(ast, (node) => {
      if (node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "Constants" && node.property.type === "Identifier" && node.property.name === "manifest") {
        const line = node.loc.start.line;
        const column = node.loc.start.column;
        diagnostics.push(makeError(filePath, line, column, sourceLines));
        return;
      }
      if (node.type === "VariableDeclarator" && node.id.type === "ObjectPattern" && node.init?.type === "Identifier" && node.init.name === "Constants") {
        for (const prop of node.id.properties) {
          if (prop.type !== "Property") continue;
          const key = prop.key;
          if (key.type === "Identifier" && key.name === "manifest") {
            const line = node.loc.start.line;
            const column = node.loc.start.column;
            diagnostics.push(makeError(filePath, line, column, sourceLines));
            break;
          }
        }
      }
    });
    return diagnostics;
  }
};
var constants_manifest_default = rule19;

// src/rules/index.ts
var allRules = [
  fetch_in_effect_default,
  multiple_usestate_default,
  large_component_default,
  effect_set_state_default,
  effect_as_handler_default,
  index_as_key_default,
  a11y_autofocus_default,
  a11y_label_default,
  a11y_interactive_default,
  a11y_role_default,
  heavy_import_default,
  use_search_params_default,
  missing_use_client_default,
  img_not_optimized_default,
  inline_styles_default,
  no_console_log_default,
  flatlist_for_lists_default,
  rn_accessibility_default,
  constants_manifest_default
];
var ruleMap = new Map(
  allRules.map((r) => [r.id, r])
);

// src/profiles.ts
var FRAMEWORK_LABELS = {
  react: "React",
  next: "Next.js",
  "react-native": "React Native",
  expo: "Expo"
};
var FRAMEWORK_DESCRIPTIONS = {
  react: "Create React App, Vite, etc.",
  next: "App Router / Pages Router",
  "react-native": "Bare workflow",
  expo: "Managed / Bare workflow"
};
function getRulesForFramework(framework) {
  if (!framework) return allRules;
  return allRules.filter((r) => r.frameworks.includes(framework));
}

// src/scanner.ts
var GLOB_PATTERNS = ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"];
var IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.d.ts"
];
function dedup(diagnostics) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const d of diagnostics) {
    const key = `${d.ruleId}::${d.filePath}::${d.line}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
    }
  }
  return result;
}
async function scan(options) {
  const { targetPath, framework, ruleId, ignore = [] } = options;
  const rules = ruleId ? [ruleMap.get(ruleId)].filter(Boolean) : getRulesForFramework(framework);
  const files = await (0, import_fast_glob.default)(GLOB_PATTERNS, {
    cwd: path.resolve(targetPath),
    absolute: true,
    ignore: [...IGNORE_PATTERNS, ...ignore]
  });
  const diagnostics = [];
  for (const filePath of files) {
    const result = parseFile(filePath);
    if (isParseFailure(result)) {
      diagnostics.push({
        ruleId: "parse-error",
        severity: "warning",
        category: "correctness",
        confidence: 1,
        message: "File could not be parsed \u2014 syntax error or unsupported syntax",
        component: "unknown",
        filePath,
        line: result.parseError.line,
        column: 0,
        codeSnippet: [],
        fix: `// Check for syntax errors:
// ${result.parseError.message}`,
        suggestions: ["Check for missing brackets, invalid JSX, or unsupported syntax"]
      });
      continue;
    }
    if (!result) continue;
    const { ast, sourceLines } = result;
    for (const rule20 of rules) {
      const ruleDiagnostics = rule20.check(ast, filePath, sourceLines);
      diagnostics.push(...ruleDiagnostics);
    }
  }
  return {
    diagnostics: dedup(diagnostics),
    totalFiles: files.length,
    scannedFiles: files
  };
}
async function scanFile(filePath, framework, ruleId) {
  const rules = ruleId ? [ruleMap.get(ruleId)].filter(Boolean) : getRulesForFramework(framework);
  const result = parseFile(filePath);
  if (isParseFailure(result)) {
    return [{
      ruleId: "parse-error",
      severity: "warning",
      category: "correctness",
      confidence: 1,
      message: "File could not be parsed \u2014 syntax error or unsupported syntax",
      component: "unknown",
      filePath,
      line: result.parseError.line,
      column: 0,
      codeSnippet: [],
      fix: `// Check for syntax errors:
// ${result.parseError.message}`,
      suggestions: ["Check for missing brackets, invalid JSX, or unsupported syntax"]
    }];
  }
  if (!result) return [];
  const { ast, sourceLines } = result;
  const diagnostics = [];
  for (const rule20 of rules) {
    diagnostics.push(...rule20.check(ast, filePath, sourceLines));
  }
  return dedup(diagnostics);
}

// src/scorer.ts
function computeScore(diagnostics, totalFiles) {
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  const affectedFiles = new Set(diagnostics.map((d) => d.filePath)).size;
  let penalty = 0;
  for (const d of diagnostics) {
    if (d.severity === "error") {
      penalty += d.confidence * 5;
    } else {
      penalty += d.confidence * 1;
    }
  }
  const score = Math.max(0, Math.round(100 - penalty));
  let label;
  if (score >= 90) label = "Excellent";
  else if (score >= 75) label = "Great";
  else if (score >= 60) label = "Good";
  else if (score >= 40) label = "Fair";
  else label = "Needs work";
  const byCategory = {
    correctness: 0,
    performance: 0,
    "best-practice": 0,
    accessibility: 0
  };
  for (const d of diagnostics) {
    byCategory[d.category]++;
  }
  return { score, label, errors, warnings, affectedFiles, totalFiles, byCategory };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FRAMEWORK_DESCRIPTIONS,
  FRAMEWORK_LABELS,
  allRules,
  computeScore,
  getRulesForFramework,
  ruleMap,
  scan,
  scanFile
});
