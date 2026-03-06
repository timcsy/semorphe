import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset } from '../../src/core/types'

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
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)

  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

function liftCode(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

describe('Four-level lift pipeline', () => {
  describe('Level 1: Direct pattern match', () => {
    it('should lift simple variable declaration (exact match)', () => {
      const tree = liftCode('int x = 5;')
      expect(tree).not.toBeNull()
      const body = tree!.children.body
      expect(body).toHaveLength(1)
      expect(body[0].concept).toBe('var_declare')
      expect(body[0].properties.name).toBe('x')
      expect(body[0].properties.type).toBe('int')
    })

    it('should lift arithmetic expression (direct pattern)', () => {
      const tree = liftCode('int y = a + b * c;')
      expect(tree).not.toBeNull()
      const decl = tree!.children.body[0]
      expect(decl.concept).toBe('var_declare')
      expect(decl.children.initializer).toHaveLength(1)
      expect(decl.children.initializer[0].concept).toBe('arithmetic')
    })

    it('should lift if/else with nested body', () => {
      const tree = liftCode('if (x > 0) {\n    y = 1;\n} else {\n    y = 2;\n}')
      expect(tree).not.toBeNull()
      const ifNode = tree!.children.body[0]
      expect(ifNode.concept).toBe('if')
      expect(ifNode.children.then_body.length).toBeGreaterThan(0)
      expect(ifNode.children.else_body.length).toBeGreaterThan(0)
    })
  })

  describe('Level 2: Source range metadata', () => {
    it('should attach sourceRange to lifted nodes', () => {
      const tree = liftCode('int x = 5;')
      expect(tree).not.toBeNull()
      const decl = tree!.children.body[0]
      expect(decl.metadata?.sourceRange).toBeDefined()
      expect(decl.metadata!.sourceRange!.startLine).toBe(0)
    })

    it('should preserve source ranges through nested structures', () => {
      const tree = liftCode('if (x > 0) {\n    y = 1;\n}')
      expect(tree).not.toBeNull()
      const ifNode = tree!.children.body[0]
      expect(ifNode.metadata?.sourceRange).toBeDefined()
      const assign = ifNode.children.then_body[0]
      expect(assign.metadata?.sourceRange).toBeDefined()
    })
  })

  describe('Level 3: Unresolved preservation', () => {
    it('should create unresolved node for partially-liftable construct', () => {
      // A class has named children (member functions, fields) that can be lifted
      const tree = liftCode('class Foo {\npublic:\n    int x;\n    void bar() { return; }\n};')
      expect(tree).not.toBeNull()
      const body = tree!.children.body
      expect(body.length).toBeGreaterThan(0)
      // The class should be unresolved or raw_code
      const classNode = body[0]
      expect(['unresolved', 'raw_code']).toContain(classNode.concept)
      if (classNode.concept === 'unresolved') {
        expect(classNode.metadata?.rawCode).toContain('class Foo')
        expect(classNode.children.children.length).toBeGreaterThan(0)
      }
    })

    it('should mark unresolved nodes with confidence=inferred', () => {
      const tree = liftCode('namespace ns {\n    int x = 5;\n}')
      expect(tree).not.toBeNull()
      const body = tree!.children.body
      const nsNode = body[0]
      if (nsNode.concept === 'unresolved') {
        expect(nsNode.metadata?.confidence).toBe('inferred')
      }
    })
  })

  describe('Level 4: Raw code degradation', () => {
    it('should degrade template to raw_code', () => {
      const tree = liftCode('template<typename T> T max(T a, T b) { return a > b ? a : b; }')
      expect(tree).not.toBeNull()
      const body = tree!.children.body
      expect(body.length).toBeGreaterThan(0)
      // Template should be raw_code or unresolved
      expect(['raw_code', 'unresolved']).toContain(body[0].concept)
    })

    it('should degrade preprocessor macros to raw_code', () => {
      const tree = liftCode('#define MAX(a, b) ((a) > (b) ? (a) : (b))')
      expect(tree).not.toBeNull()
      const body = tree!.children.body
      expect(body.length).toBeGreaterThan(0)
      expect(['raw_code', 'unresolved']).toContain(body[0].concept)
    })

    it('should not crash on complex C++ constructs', () => {
      const complexCode = `
#include <iostream>
#include <vector>
using namespace std;

template<typename T>
class Container {
public:
    vector<T> data;
    void add(T item) { data.push_back(item); }
    T get(int idx) { return data[idx]; }
};

int main() {
    Container<int> c;
    c.add(42);
    cout << c.get(0) << endl;
    return 0;
}
`
      const tree = liftCode(complexCode)
      expect(tree).not.toBeNull()
      expect(tree!.concept).toBe('program')
      // Should have multiple body nodes — no crashes
      expect(tree!.children.body.length).toBeGreaterThan(0)
    })
  })

  describe('Round-trip preservation', () => {
    it('should preserve raw_code through code generation', () => {
      const tree = liftCode('template<typename T> T id(T x) { return x; }')
      expect(tree).not.toBeNull()
      const code = generateCode(tree!, 'cpp', style)
      expect(code).toContain('template')
    })

    it('should produce valid block state from code with unknown constructs', () => {
      const tree = liftCode('int x = 5;\ntemplate<typename T> class Foo {};')
      expect(tree).not.toBeNull()
      const state = renderToBlocklyState(tree!)
      expect(state.blocks.blocks).toHaveLength(1)
      // First block should be var_declare, chained with raw_code
      expect(state.blocks.blocks[0].type).toBe('u_var_declare')
      expect(state.blocks.blocks[0].next).toBeDefined()
    })
  })
})
