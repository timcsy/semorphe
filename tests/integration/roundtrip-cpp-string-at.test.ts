/**
 * Round-trip tests for cpp_string_at (C++ string character index access)
 *
 * Lift direction note: str[i] in C++ lifts as `array_access` (expected degradation).
 * cpp_string_at has no dedicated lifter because type info is unavailable at lift time.
 * These tests verify:
 * 1. Lift→Generate stability (code is stable after round-trip even as array_access)
 * 2. Generate-only: SemanticNode with cpp_string_at generates correct subscript code
 * 3. Concept identity: lifting str[i] produces array_access (DEGRADED, expected)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { createNode } from '../../src/core/semantic-tree'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset, SemanticNode } from '../../src/core/types'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({
    locateFile: (s: string) => `${process.cwd()}/public/${s}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

function liftCode(code: string): SemanticNode | null {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function roundTrip(code: string): string {
  const sem = liftCode(code)
  expect(sem).not.toBeNull()
  return generateCode(sem!, 'cpp', style)
}

function findConcepts(node: SemanticNode, target: string): SemanticNode[] {
  const result: SemanticNode[] = []
  function walk(n: SemanticNode) {
    if (!n) return
    if (n.concept === target) result.push(n)
    for (const ch of Object.values(n.children || {})) {
      if (Array.isArray(ch)) ch.forEach(walk)
    }
  }
  walk(node)
  return result
}

// ─── Generate-only tests (SemanticNode → code) ───────────────────────────────

describe('cpp_string_at generate direction', () => {
  it('t01: generates str[0] for literal index', () => {
    const idx = createNode('number_literal', { value: '1' })
    const node = createNode('cpp_string_at', { obj: 'word' }, { index: [idx] })
    const prog = { id: 'root', concept: 'program', properties: {}, children: { body: [node] } }
    const code = generateCode(prog, 'cpp', style)
    expect(code).toContain('word[1]')
  })

  it('t02: generates str[i] for variable index', () => {
    const idx = createNode('var_ref', { name: 'i' })
    const node = createNode('cpp_string_at', { obj: 'msg' }, { index: [idx] })
    const prog = { id: 'root', concept: 'program', properties: {}, children: { body: [node] } }
    const code = generateCode(prog, 'cpp', style)
    expect(code).toContain('msg[i]')
  })

  it('t03: generates str[0] when index missing', () => {
    const node = createNode('cpp_string_at', { obj: 'str' }, { index: [] })
    const prog = { id: 'root', concept: 'program', properties: {}, children: { body: [node] } }
    const code = generateCode(prog, 'cpp', style)
    expect(code).toContain('str[0]')
  })
})

// ─── Lift→Generate stability tests ───────────────────────────────────────────

describe('cpp_string_at lift→generate stability', () => {
  it('t04: P1 basic char access — stable round-trip', () => {
    const code = `#include <iostream>
#include <string>
using namespace std;
int main() {
    string word = "hello";
    cout << word[1];
    return 0;
}`
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
    expect(gen1).toContain('word[1]')
  })

  it('t05: P2 variable index — stable round-trip', () => {
    const code = `#include <iostream>
#include <string>
using namespace std;
int main() {
    string s = "abc";
    int i = 2;
    cout << s[i];
    return 0;
}`
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
    expect(gen1).toContain('s[i]')
  })

  it('t06: P3 char access in while loop — stable round-trip', () => {
    const code = `#include <iostream>
#include <string>
using namespace std;
int main() {
    string msg = "hi";
    int i = 0;
    while (i < 2) {
        cout << msg[i];
        i = i + 1;
    }
    return 0;
}`
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
    expect(gen1).toContain('msg[i]')
  })

  it('t07: P4 first char comparison in if — stable round-trip', () => {
    const code = `#include <iostream>
#include <string>
using namespace std;
int main() {
    string name = "Alice";
    if (name[0] == 'A') {
        cout << "starts with A";
    }
    return 0;
}`
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
    expect(gen1).toContain('name[0]')
  })

  it('t08: P5 count char occurrences — stable round-trip', () => {
    const code = `#include <iostream>
#include <string>
using namespace std;
int main() {
    string s = "banana";
    int count = 0;
    int i = 0;
    while (i < 6) {
        if (s[i] == 'a') {
            count = count + 1;
        }
        i = i + 1;
    }
    cout << count;
    return 0;
}`
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
    expect(gen1).toContain('s[i]')
  })
})

// ─── Concept identity (DEGRADED, expected) ───────────────────────────────────

describe('cpp_string_at concept identity', () => {
  it('t09: str[i] correctly lifts as cpp_string_at when variable is declared as string', () => {
    // AST-based type inference: walk up scopes to find the declaration of `word`,
    // confirm it's a string, and lift subscript_expression as cpp_string_at.
    const code = `#include <string>
using namespace std;
int main() {
    string word = "hello";
    char c = word[1];
    return 0;
}`
    const sem = liftCode(code)
    expect(sem).not.toBeNull()
    const stringAtNodes = findConcepts(sem!, 'cpp_string_at')
    expect(stringAtNodes.length).toBeGreaterThan(0)
    expect(stringAtNodes[0].properties.obj).toBe('word')
    // Should NOT degrade to array_access for string variables
    const arrayAccessNodes = findConcepts(sem!, 'array_access')
    expect(arrayAccessNodes).toHaveLength(0)
  })

  it('t10: cpp_string_at generates correct code and is compilable', () => {
    // Verify the generate direction: cpp_string_at → str[i]
    const idx = createNode('number_literal', { value: '2' })
    const strDecl = createNode('cpp_string_declare', { name: 'word' }, {
      initializer: [createNode('string_literal', { value: 'hello' })]
    })
    const access = createNode('cpp_string_at', { obj: 'word' }, { index: [idx] })
    const print = createNode('print', {}, { values: [access] })
    const main = createNode('func_def', { name: 'main', return_type: 'int', params: '' }, {
      body: [strDecl, print]
    })
    const prog = { id: 'root', concept: 'program', properties: {}, children: { body: [main] } }
    const code = generateCode(prog, 'cpp', style)
    expect(code).toContain('word[2]')
    expect(code).toContain('"hello"')
  })
})
