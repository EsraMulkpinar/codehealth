import type { Rule } from './types';

import fetchInEffect from './fetch-in-effect';
import multipleUsestate from './multiple-usestate';
import largeComponent from './large-component';
import effectSetState from './effect-set-state';
import effectAsHandler from './effect-as-handler';
import indexAsKey from './index-as-key';

import a11yAutofocus from './a11y-autofocus';
import a11yLabel from './a11y-label';
import a11yInteractive from './a11y-interactive';
import a11yRole from './a11y-role';
import heavyImport from './heavy-import';

import useSearchParams from './use-search-params';
import missingUseClient from './missing-use-client';
import imgNotOptimized from './img-not-optimized';

import inlineStyles from './inline-styles';
import noConsoleLog from './no-console-log';
import flatlistForLists from './flatlist-for-lists';
import rnAccessibility from './rn-accessibility';

import constantsManifest from './constants-manifest';

export const allRules: Rule[] = [
  fetchInEffect,
  multipleUsestate,
  largeComponent,
  effectSetState,
  effectAsHandler,
  indexAsKey,
  a11yAutofocus,
  a11yLabel,
  a11yInteractive,
  a11yRole,
  heavyImport,
  useSearchParams,
  missingUseClient,
  imgNotOptimized,
  inlineStyles,
  noConsoleLog,
  flatlistForLists,
  rnAccessibility,
  constantsManifest,
];

export const ruleMap = new Map<string, Rule>(
  allRules.map((r) => [r.id, r])
);

export { type Rule, type Diagnostic, type Framework } from './types';
