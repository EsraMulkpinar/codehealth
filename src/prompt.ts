import * as readline from 'readline';
import pc from 'picocolors';
import type { Framework } from './rules/types';
import { FRAMEWORK_LABELS, FRAMEWORK_DESCRIPTIONS } from './profiles';

const FRAMEWORKS: Framework[] = ['react', 'next', 'react-native', 'expo'];

export async function promptFramework(): Promise<Framework> {
  let selected = 0;

  const isTTY = process.stdin.isTTY && process.stdout.isTTY;

  if (!isTTY) {
    console.error(
      'No framework specified. Use --react, --next, --react-native, or --expo.'
    );
    process.exit(1);
  }

  function renderMenu(): void {
    process.stdout.write('\n');
    process.stdout.write(
      `  ${pc.bold('Select your framework:')}  ${pc.dim('(↑↓ arrow keys, Enter to confirm)')}\n\n`
    );
    for (let i = 0; i < FRAMEWORKS.length; i++) {
      const fw = FRAMEWORKS[i];
      const isActive = i === selected;
      const cursor = isActive ? pc.cyan('❯') : ' ';
      const label = isActive
        ? pc.cyan(pc.bold(FRAMEWORK_LABELS[fw]))
        : FRAMEWORK_LABELS[fw];
      const desc = pc.dim(FRAMEWORK_DESCRIPTIONS[fw]);
      process.stdout.write(`  ${cursor} ${label.padEnd(isActive ? 22 : 14)}  ${desc}\n`);
    }
  }

  function clearMenu(): void {
    const lines = FRAMEWORKS.length + 3;
    for (let i = 0; i < lines; i++) {
      process.stdout.write('\x1B[1A\x1B[2K');
    }
  }

  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    renderMenu();

    function onKey(_: unknown, key: { name: string; ctrl: boolean } | null): void {
      if (!key) return;

      if (key.name === 'up') {
        selected = (selected - 1 + FRAMEWORKS.length) % FRAMEWORKS.length;
        clearMenu();
        renderMenu();
      } else if (key.name === 'down') {
        selected = (selected + 1) % FRAMEWORKS.length;
        clearMenu();
        renderMenu();
      } else if (key.name === 'return') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKey);
        clearMenu();
        const chosen = FRAMEWORKS[selected];
        process.stdout.write(
          `\n  ${pc.green('✓')} Framework: ${pc.cyan(pc.bold(FRAMEWORK_LABELS[chosen]))}\n\n`
        );
        resolve(chosen);
      } else if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(0);
      }
    }

    process.stdin.on('keypress', onKey);
  });
}
