/**
 * Code-to-Blocks Integration Tests (T050)
 *
 * Verifies that common C++ code patterns are lifted to the correct semantic concepts
 * and rendered to the correct block types via the JSON-driven pipeline.
 * Uses real tree-sitter parsing.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { Lifter } from '../../src/core/lift/lifter'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { TemplateGenerator } from '../../src/core/projection/template-generator'
import { registerCppLifters } from '../../src/languages/cpp/lifters'
import { generateCode } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import type { BlockSpec, LiftPattern, UniversalTemplate, StylePreset } from '../../src/core/types'

import universalBlocks from '../../src/blocks/universal.json'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'

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
let patternRenderer: PatternRenderer

beforeAll(async () => {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)

  lifter = new Lifter()

  // Wire up JSON-driven PatternLifter
  const allSpecs = [
    ...universalBlocks as unknown as BlockSpec[],
    ...basicBlocks as unknown as BlockSpec[],
    ...advancedBlocks as unknown as BlockSpec[],
    ...specialBlocks as unknown as BlockSpec[],
  ]

  const pl = new PatternLifter()
  pl.loadBlockSpecs(allSpecs)
  pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
  lifter.setPatternLifter(pl)

  // Also register hand-written lifters as fallback
  registerCppLifters(lifter)
  registerCppLanguage()

  // Wire up renderer (both local reference and global for renderToBlocklyState)
  patternRenderer = new PatternRenderer()
  patternRenderer.loadBlockSpecs(allSpecs)
  setPatternRenderer(patternRenderer)
})

function liftCode(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function findConcepts(sem: any): string[] {
  const concepts: string[] = []
  function walk(node: any) {
    if (!node) return
    if (node.concept) concepts.push(node.concept)
    if (node.children) {
      for (const ch of Object.values(node.children) as any[]) {
        if (Array.isArray(ch)) ch.forEach(walk)
      }
    }
  }
  walk(sem)
  return concepts
}

function findBlockTypes(state: any): string[] {
  const types: string[] = []
  function walk(block: any) {
    if (!block) return
    types.push(block.type)
    if (block.next) walk(block.next.block)
    if (block.inputs) {
      for (const inp of Object.values(block.inputs) as any[]) {
        if (inp?.block) walk(inp.block)
      }
    }
  }
  for (const block of state.blocks?.blocks ?? []) {
    walk(block)
  }
  return types
}

describe('Code-to-Blocks Pipeline', () => {
  describe('Increment/Decrement — i++, i--', () => {
    it('should lift i++ to cpp_increment concept', () => {
      const sem = liftCode('i++;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_increment')
    })

    it('should render i++ to c_increment block', () => {
      const sem = liftCode('i++;')
      const state = renderToBlocklyState(sem!)
      const types = findBlockTypes(state)
      expect(types).toContain('c_increment')
    })
  })

  describe('Compound Assignment — x += 5', () => {
    it('should lift x += 5 to cpp_compound_assign concept', () => {
      const sem = liftCode('x += 5;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_compound_assign')
    })
  })

  describe('Counting for loop', () => {
    it('should lift counting for loop to count_loop concept', () => {
      const sem = liftCode('for (int i = 0; i < 10; i++) { x = 1; }')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('count_loop')
    })

    it('should render to u_count_loop block', () => {
      const sem = liftCode('for (int i = 0; i < 10; i++) { x = 1; }')
      const state = renderToBlocklyState(sem!)
      const types = findBlockTypes(state)
      expect(types).toContain('u_count_loop')
    })
  })

  describe('cout / cin I/O', () => {
    it('should lift cout << x to print concept', () => {
      const sem = liftCode('cout << x;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('print')
    })

    it('should lift cin >> x to input concept', () => {
      const sem = liftCode('cin >> x;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('input')
    })
  })

  describe('if / if-else', () => {
    it('should lift if statement to if concept', () => {
      const sem = liftCode('if (x > 0) { y = 1; }')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('if')
    })

    it('should lift if-else to if concept with else_body', () => {
      const sem = liftCode('if (x > 0) { y = 1; } else { y = 0; }')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('if')
    })
  })

  describe('while loop', () => {
    it('should lift while loop to while_loop concept', () => {
      const sem = liftCode('while (x > 0) { x--; }')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('while_loop')
    })
  })

  describe('Binary expressions', () => {
    it('should lift arithmetic: a + b', () => {
      const sem = liftCode('int r = a + b;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('arithmetic')
    })

    it('should lift comparison: x > 0', () => {
      const sem = liftCode('if (x > 0) {}')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('compare')
    })

    it('should lift logic: a && b', () => {
      const sem = liftCode('if (a && b) {}')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('logic')
    })
  })

  describe('Unary expressions', () => {
    it('should lift !x to logic_not', () => {
      const sem = liftCode('if (!x) {}')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('logic_not')
    })

    it('should lift -x to negate', () => {
      const sem = liftCode('int y = -x;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('negate')
    })
  })

  describe('Pointer operations', () => {
    it('should lift *ptr to cpp_pointer_deref', () => {
      const sem = liftCode('int x = *ptr;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_pointer_deref')
    })

    it('should lift &x to cpp_address_of', () => {
      const sem = liftCode('int *p = &x;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_address_of')
    })
  })

  describe('Function calls', () => {
    it('should lift strlen(s) to cpp_strlen', () => {
      const sem = liftCode('int n = strlen(s);')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_strlen')
    })

    it('should lift free(ptr) to cpp_free', () => {
      const sem = liftCode('free(ptr);')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_free')
    })
  })

  describe('Struct access', () => {
    it('should lift p.x to cpp_struct_member_access', () => {
      const sem = liftCode('int v = p.x;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_struct_member_access')
    })

    it('should lift p->x to cpp_struct_pointer_access', () => {
      const sem = liftCode('int v = p->x;')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_struct_pointer_access')
    })
  })

  describe('Preprocessor', () => {
    it('should lift #include to cpp_include', () => {
      const sem = liftCode('#include <iostream>')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_include')
    })

    it('should lift #define to cpp_define', () => {
      const sem = liftCode('#define MAX 100')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_define')
    })
  })

  describe('Return statement', () => {
    it('should lift return 0 to return concept', () => {
      const sem = liftCode('int main() { return 0; }')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('return')
    })
  })

  describe('Break / Continue', () => {
    it('should lift break to break concept', () => {
      const sem = liftCode('while(1) { break; }')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('break')
    })

    it('should lift continue to continue concept', () => {
      const sem = liftCode('while(1) { continue; }')
      const concepts = findConcepts(sem)
      expect(concepts).toContain('continue')
    })
  })

  describe('Full program roundtrip', () => {
    it('should lift a complete APCS-style program', () => {
      const code = `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    int sum = 0;
    for (int i = 1; i <= n; i++) {
        sum = sum + i;
    }
    cout << sum << endl;
    return 0;
}`
      const sem = liftCode(code)
      expect(sem).not.toBeNull()
      const concepts = findConcepts(sem)
      expect(concepts).toContain('cpp_include')
      expect(concepts).toContain('input')
      expect(concepts).toContain('count_loop')
      expect(concepts).toContain('print')
      expect(concepts).toContain('return')

      // Verify code generation roundtrip
      const generated = generateCode(sem!, 'cpp', style)
      expect(generated).toContain('cin')
      expect(generated).toContain('cout')
      expect(generated).toContain('return')
    })
  })
})
