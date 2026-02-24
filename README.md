# codehealth

A fast, framework-aware React code scanner that tells you **exactly which component, on which line** has a problem — and gives you a **copy-paste ready fix** for every issue found.

Works completely standalone. No ESLint dependency. No config files needed.

```
codehealth  Next.js  ·  104 files scanned

── correctness ───────────────────────────── 2 ──
 ✗  missing-use-client            2×
    Client hook used without "use client" directive

── best-practice ─────────────────────────── 3 ──
 ⚠  index-as-key                  2×
    Array index used as key — use a stable unique ID instead
 ⚠  effect-set-state              1×
    Multiple setState calls inside useEffect — consider useReducer

╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
  87 / 100  Great  😺  ·  ✗ 2  ·  ⚠ 3  ·  104 files
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```

---

## Install

```bash
npm install -g codehealth
```

Or run without installing:

```bash
npx codehealth .
```

---

## Usage

```bash
codehealth <path> [framework] [options]
```

If you don't pass a framework flag, an interactive prompt lets you pick one with arrow keys.

```bash
codehealth .                     # interactive framework selector
codehealth . --react             # React (CRA, Vite, etc.)
codehealth . --next              # Next.js (App Router / Pages Router)
codehealth . --react-native      # React Native (bare workflow)
codehealth . --expo              # Expo (managed / bare)
```

### Options

| Flag | Description |
|------|-------------|
| `--react` | Use the React rule profile |
| `--next` | Use the Next.js rule profile |
| `--react-native` | Use the React Native rule profile |
| `--expo` | Use the Expo rule profile |
| `-w, --watch` | Re-scan on every file save |
| `-r, --rule <id>` | Run only a single rule |
| `--ignore <pattern>` | Glob pattern to exclude (repeatable) |
| `--list-rules` | List rules for the selected profile |
| `--max-issues <n>` | Show only first N issues (0 = all) |
| `--compact` | Show file headers only, no code snippets or fix details |
| `--ai-prompt` | Output a plain-text AI prompt for refactoring assistance |

### Examples

```bash
codehealth . --next
codehealth . --next --watch
codehealth . --react --rule fetch-in-effect
codehealth . --next --ignore "src/generated/**"
codehealth . --list-rules --expo
codehealth . --next --ai-prompt
```

---

## Interactive Mode

In a TTY terminal, after the scan completes you get an interactive menu:

```
  What would you like to do?  (↑↓ arrow keys, Enter to confirm)

  ❯ Overview & score
    Detailed fixes
    AI refactoring view
    Exit
```

- **Overview & score** — category breakdown and score summary
- **Detailed fixes** — full issue list with affected files, code context and copy-paste fixes
- **AI refactoring view** — grouped output formatted for pasting into an AI assistant
- **Exit** — quit the process

The screen clears between views so output never accumulates.

In non-TTY environments (CI, pipes, redirects) the interactive menu is skipped and output is printed directly.

---

## Framework Profiles

Each framework flag activates a curated set of rules relevant to that stack.

### `--react`
For projects using Create React App, Vite, or any plain React setup.

| Rule | Severity | Description |
|------|----------|-------------|
| `fetch-in-effect` | error | `fetch()` inside `useEffect` — use a data fetching library |
| `multiple-usestate` | warning | 4+ `useState` calls — consider `useReducer` |
| `large-component` | warning | Component over 300 lines — consider splitting |
| `effect-set-state` | warning | Multiple `setState` calls inside one `useEffect` |
| `effect-as-handler` | warning | `useEffect` watching an event flag — move logic to the handler |
| `index-as-key` | warning | `key={index}` in a list — use a stable unique ID |
| `heavy-import` | warning | Heavy library without lazy loading (moment, lodash, etc.) |
| `a11y-autofocus` | warning | `autoFocus` attribute disrupts screen readers |
| `a11y-label` | warning | `<input>` / `<textarea>` with no accessible label |
| `a11y-interactive` | warning | Clickable element with no keyboard listener |
| `a11y-role` | warning | Element with event handler but no ARIA role |
| `no-console-log` | warning | `console` statement in production code |

### `--next`
Everything in `--react`, plus Next.js App Router specific rules.

| Rule | Severity | Description |
|------|----------|-------------|
| `missing-use-client` | **error** | Hook used without `"use client"` directive |
| `use-search-params` | warning | `useSearchParams()` without a `<Suspense>` boundary |
| `img-not-optimized` | warning | Raw `<img>` tag — use `next/image` instead |

### `--react-native`
Core React rules adapted for mobile, plus React Native specific checks. Web a11y rules are excluded.

| Rule | Severity | Description |
|------|----------|-------------|
| `inline-styles` | warning | `style={{ }}` inline object — use `StyleSheet.create()` |
| `flatlist-for-lists` | warning | `.map()` inside `<ScrollView>` — use `<FlatList>` |
| `rn-accessibility` | warning | `<Pressable>` / `<TouchableOpacity>` with no `accessibilityLabel` |

### `--expo`
Everything in `--react-native`, plus Expo specific rules.

| Rule | Severity | Description |
|------|----------|-------------|
| `constants-manifest` | **error** | `Constants.manifest` is deprecated — use `Constants.expoConfig` |

---

## Scoring

Every scan produces a score from 0 to 100.

```
100 - (errors × 5) - (warnings × 1)
```

| Score | Label | |
|-------|-------|-|
| 90–100 | Excellent | 😸 |
| 75–89 | Great | 😺 |
| 50–74 | Needs work | 😾 |
| 0–49 | Needs work | 🙀 |

The process exits with code `1` if any errors are found, making it easy to use in CI.

---

## Watch Mode

```bash
codehealth . --next --watch
```

Uses [chokidar](https://github.com/paulmillr/chokidar) to watch `.ts`, `.tsx`, `.js`, `.jsx` files. When a file changes, only that file is re-scanned and the output is refreshed in place.

---

## CI Usage

```yaml
- name: Run codehealth
  run: npx codehealth . --next
```

Exits with code `1` on errors, `0` on warnings-only or clean scan.

---

## Programmatic API

```typescript
import { scan, getRulesForFramework } from 'codehealth';

const { diagnostics, totalFiles } = await scan({
  targetPath: './src',
  framework: 'next',
});

for (const d of diagnostics) {
  console.log(`${d.ruleId} — ${d.message} (${d.filePath}:${d.line})`);
}
```

### Types

```typescript
interface Diagnostic {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  filePath: string;
  line: number;
  column: number;
  codeSnippet: string[];
  fix: string;
  suggestions: string[];
}

type Framework = 'react' | 'next' | 'react-native' | 'expo';
```

---

## How It Works

1. **Glob** — finds all `.ts/.tsx/.js/.jsx` files (ignores `node_modules`, `dist`, `*.test.*`, etc.)
2. **Parse** — builds an AST using [`@typescript-eslint/typescript-estree`](https://typescript-eslint.io/) with JSX support
3. **Parent refs** — injects `node.parent` on every AST node so rules can walk up the tree
4. **Rules** — each rule traverses the AST, finds matching patterns, and returns `Diagnostic[]`
5. **Score** — calculates a 0–100 health score weighted by severity
6. **Report** — prints colored output with code snippets, fix suggestions and an interactive menu
