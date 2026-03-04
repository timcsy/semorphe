#!/usr/bin/env node

/**
 * extract-i18n.mjs
 *
 * Reads block JSON files, extracts Chinese text (messages, tooltips, dropdown labels),
 * replaces them with %{BKY_XXX} references, and writes:
 *   - Modified block JSONs back to their original paths
 *   - src/i18n/zh-TW/blocks.json with all extracted key-value pairs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FILES = [
  'src/blocks/universal.json',
  'src/languages/cpp/blocks/basic.json',
  'src/languages/cpp/blocks/advanced.json',
  'src/languages/cpp/blocks/special.json',
];

const hasChinese = (str) => /[\u4e00-\u9fff]/.test(str);

// ---------------------------------------------------------------------------
// Key-name helpers
// ---------------------------------------------------------------------------

/**
 * Turn a block id like "u_var_declare" into "U_VAR_DECLARE".
 */
function blockPrefix(id) {
  return id.toUpperCase();
}

/**
 * Derive a readable suffix from a dropdown option value.
 * e.g.  "+"  -> "PLUS"
 *       "%"  -> "REMAINDER"
 *       ">=" -> "GE"
 *       "int" -> "INT"
 *       "++"  -> "INCREMENT"
 *       "+="  -> "PLUS_EQ"
 *       "stdio.h" -> "STDIO_H"
 */
const VALUE_MAP = {
  // arithmetic
  '+': 'PLUS',
  '-': 'MINUS',
  '*': 'TIMES',
  '/': 'DIVIDE',
  '%': 'REMAINDER',

  // comparison
  '>': 'GT',
  '<': 'LT',
  '>=': 'GE',
  '<=': 'LE',
  '==': 'EQ',
  '!=': 'NE',

  // logic
  '&&': 'AND',
  '||': 'OR',

  // increment / decrement
  '++': 'INCREMENT',
  '--': 'DECREMENT',

  // compound assignment
  '+=': 'PLUS_EQ',
  '-=': 'MINUS_EQ',
  '*=': 'TIMES_EQ',
  '/=': 'DIVIDE_EQ',
  '%=': 'REMAINDER_EQ',

  // types
  'int': 'INT',
  'float': 'FLOAT',
  'double': 'DOUBLE',
  'char': 'CHAR',
  'long long': 'LONG_LONG',
  'string': 'STRING',
  'std::string': 'STRING',
  'bool': 'BOOL',
  'void': 'VOID',
};

function valueSuffix(value) {
  if (VALUE_MAP[value] != null) {
    return VALUE_MAP[value];
  }
  // For header names like "stdio.h", "iostream", etc.
  return value
    .replace(/\./g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Main extraction logic
// ---------------------------------------------------------------------------

const translations = {}; // key -> Chinese value
const stats = { messages: 0, tooltips: 0, dropdowns: 0, files: 0, blocks: 0 };

/**
 * Track used keys so we can detect (and avoid) duplicates by appending a suffix.
 */
const usedKeys = new Set();

function uniqueKey(base) {
  let key = base;
  let n = 2;
  while (usedKeys.has(key)) {
    key = `${base}_${n}`;
    n++;
  }
  usedKeys.add(key);
  return key;
}

function processBlock(block) {
  const id = block.id;
  const def = block.blockDef;
  const prefix = blockPrefix(id);

  // --- messages (message0 .. message9) ---
  for (let i = 0; i <= 9; i++) {
    const msgField = `message${i}`;
    if (def[msgField] != null && hasChinese(def[msgField])) {
      const key = uniqueKey(`${prefix}_MSG${i}`);
      translations[key] = def[msgField];
      def[msgField] = `%{BKY_${key}}`;
      stats.messages++;
    }
  }

  // --- tooltip ---
  if (def.tooltip != null && typeof def.tooltip === 'string' && hasChinese(def.tooltip)) {
    const key = uniqueKey(`${prefix}_TOOLTIP`);
    translations[key] = def.tooltip;
    def.tooltip = `%{BKY_${key}}`;
    stats.tooltips++;
  }

  // --- args (args0 .. args9) – dropdown options ---
  for (let i = 0; i <= 9; i++) {
    const argsField = `args${i}`;
    if (!Array.isArray(def[argsField])) continue;

    for (const arg of def[argsField]) {
      if (arg.type !== 'field_dropdown') continue;
      if (!Array.isArray(arg.options)) continue;

      const fieldName = arg.name; // e.g. "OP", "TYPE", "HEADER"

      for (const option of arg.options) {
        // option = ["display label", "value"]
        if (!Array.isArray(option) || option.length < 2) continue;
        const label = option[0];
        if (typeof label !== 'string' || !hasChinese(label)) continue;

        const valSuffix = valueSuffix(option[1]);
        const key = uniqueKey(`${prefix}_${fieldName}_${valSuffix}`);
        translations[key] = label;
        option[0] = `%{BKY_${key}}`;
        stats.dropdowns++;
      }
    }
  }

  stats.blocks++;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log('=== extract-i18n: Extracting Chinese text from block definitions ===\n');

for (const relPath of FILES) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    console.warn(`  SKIP (not found): ${relPath}`);
    continue;
  }

  const raw = fs.readFileSync(absPath, 'utf-8');
  const blocks = JSON.parse(raw);

  for (const block of blocks) {
    processBlock(block);
  }

  // Write modified JSON back
  fs.writeFileSync(absPath, JSON.stringify(blocks, null, 2) + '\n', 'utf-8');
  console.log(`  Updated: ${relPath}  (${blocks.length} blocks)`);
  stats.files++;
}

// Write zh-TW translations file
const i18nDir = path.join(ROOT, 'src', 'i18n', 'zh-TW');
fs.mkdirSync(i18nDir, { recursive: true });

const i18nPath = path.join(i18nDir, 'blocks.json');
fs.writeFileSync(i18nPath, JSON.stringify(translations, null, 2) + '\n', 'utf-8');
console.log(`\n  Written: src/i18n/zh-TW/blocks.json  (${Object.keys(translations).length} keys)`);

// Summary
console.log('\n=== Summary ===');
console.log(`  Files processed : ${stats.files}`);
console.log(`  Blocks processed: ${stats.blocks}`);
console.log(`  Messages        : ${stats.messages}`);
console.log(`  Tooltips        : ${stats.tooltips}`);
console.log(`  Dropdown options: ${stats.dropdowns}`);
console.log(`  Total keys      : ${Object.keys(translations).length}`);
console.log('\nDone.');
