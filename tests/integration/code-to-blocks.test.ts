/**
 * Code-to-Blocks Integration Tests (T050)
 *
 * Verifies that common C++ code patterns are lifted to the correct semantic components
 * and rendered to the correct block types via the JSON-driven pipeline.
 * Uses real tree-sitter parsing.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { generateCode } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry } from '../../src/core/registry'
import { componentLiftStrategyRegistrars } from '../../src/core/component/paths'
import { registerCppTransforms } from '../../src/languages/cpp/core/lifters/transforms'
import { registerCppLiftStrategies } from '../../src/languages/cpp/core/lifters/strategies'
import type { BlockSpec, LiftPattern, StylePreset, ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'

// ⚠️ **第十六個「自己列舉來源」的地方**（今天第六處）。
import { universalComponents, universalBlocks } from '../../src/core/universal'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { componentLiftPatterns } from '../../src/core/component/lift-patterns'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'

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

  lifter = createTestLifter()

  // Wire up JSON-driven PatternLifter with block specs (overrides the one from createTestLifter)
  const specRegistry = new BlockSpecRegistry()
  // ⚠️ **不要自己列宣告來源。** 這裡原本手列
  // `universalComponents ＋ coreComponents ＋ allStdModules`（積木那邊還記得加
  // `componentBlocks()`，概念這邊**忘了**）——於是膠囊的概念一筆都不在，
  // 而症狀是「`x += 5` 辨識不出來」，看起來像 lifter 壞了。
  //
  // > **一份少一半的組裝，錯誤訊息會指向被害者，不是兇手。**
  const allComponents = allCppComponents()
  const allProjections = allCppProjections()
  specRegistry.loadFromSplit(allComponents, allProjections)
  const allSpecs = specRegistry.getAll()

  const transformRegistry = new TransformRegistry()
  registerCoreTransforms(transformRegistry)
  registerCppTransforms(transformRegistry)
  const liftStrategyRegistry = new LiftStrategyRegistry()
  registerCppLiftStrategies(liftStrategyRegistry)
  // ⚠️ **膠囊自帶的策略是【另一半】**——與上面那行是不同的登錄表。
  //
  // 少了這一行，`componentLiftPatterns()` 載進來的樣式會宣告一個查不到的
  // 策略名。🔴 而在 2026-08-18 修掉 `PatternLifter` 的落空分支之前，那些樣式
  // 會**無條件**建出概念節點——同一個病 `loadLiftPatterns` 上面那段註解
  // 也記過：「一份少一半的組裝，錯誤訊息會指向被害者，不是兇手。」
  for (const reg of componentLiftStrategyRegistrars())
    (reg as (r: LiftStrategyRegistry) => void)(liftStrategyRegistry)

  const pl = new PatternLifter()
  pl.setTransformRegistry(transformRegistry)
  pl.setLiftStrategyRegistry(liftStrategyRegistry)
  const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration'])
  pl.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
  // ⚠️ 膠囊自帶的 pattern 也要載——少了它，搬進膠囊的元件辨識不出來。
  pl.loadLiftPatterns([
    ...(liftPatternsJson as unknown as LiftPattern[]),
    ...(componentLiftPatterns() as LiftPattern[]),
  ])
  lifter.setPatternLifter(pl)

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

function findComponents(sem: any): string[] {
  const components: string[] = []
  function walk(node: any) {
    if (!node) return
    if (node.componentId) components.push(node.componentId)
    if (node.children) {
      for (const ch of Object.values(node.children) as any[]) {
        if (Array.isArray(ch)) ch.forEach(walk)
      }
    }
  }
  walk(sem)
  return components
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
    it('should lift i++ to cpp_increment component', () => {
      const sem = liftCode('i++;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:increment')
    })

    it('should render i++ to cpp_increment block', () => {
      const sem = liftCode('i++;')
      const state = renderToBlocklyState(sem!)
      const types = findBlockTypes(state)
      expect(types).toContain('cpp_increment')
    })
  })

  describe('Compound Assignment — x += 5', () => {
    it('should lift x += 5 to cpp_compound_assign component', () => {
      const sem = liftCode('x += 5;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:var_assign_compound')
    })
  })

  describe('Counting for loop', () => {
    it('should lift counting for loop to count_loop component', () => {
      const sem = liftCode('for (int i = 0; i < 10; i++) { x = 1; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:loop_count')
    })

    it('should render to cpp_loop_count block', () => {
      const sem = liftCode('for (int i = 0; i < 10; i++) { x = 1; }')
      const state = renderToBlocklyState(sem!)
      const types = findBlockTypes(state)
      expect(types).toContain('cpp_loop_count')
    })
  })

  describe('Counting for loop with inclusive (<=)', () => {
    it('should lift i <= n counting for loop with inclusive TRUE', () => {
      const sem = liftCode('for (int i = 1; i <= n; i++) { x = 1; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:loop_count')
      // Walk to find the count_loop and check inclusive
      function findNode(node: any, component: string): any {
        if (!node) return null
        if (node.componentId === component) return node
        if (node.children) {
          for (const ch of Object.values(node.children) as any[]) {
            if (Array.isArray(ch)) {
              for (const c of ch) {
                const found = findNode(c, component)
                if (found) return found
              }
            }
          }
        }
        return null
      }
      const countLoop = findNode(sem, 'cpp:loop_count')
      expect(countLoop).not.toBeNull()
      expect(countLoop.properties.inclusive).toBe('TRUE')
    })
  })

  describe('Three-part for loop (non-counting)', () => {
    it('should lift non-counting for loop to cpp_for_loop component', () => {
      const sem = liftCode('for (x = 0; x < 10; x = x + 1) { y = 1; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:loop_for')
    })

    it('should render non-counting for to cpp_loop_for block', () => {
      const sem = liftCode('for (x = 0; x < 10; x = x + 1) { y = 1; }')
      const state = renderToBlocklyState(sem!)
      const types = findBlockTypes(state)
      expect(types).toContain('cpp_loop_for')
    })
  })

  describe('cout / cin I/O', () => {
    it('should lift cout << x to print component', () => {
      const sem = liftCode('cout << x;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:print')
    })

    it('should lift cin >> x to input component', () => {
      const sem = liftCode('cin >> x;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:input')
    })
  })

  describe('if / if-else', () => {
    it('should lift if statement to if component', () => {
      const sem = liftCode('if (x > 0) { y = 1; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:if')
    })

    it('should lift if-else to if component with else_body', () => {
      const sem = liftCode('if (x > 0) { y = 1; } else { y = 0; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:if')
    })
  })

  describe('while loop', () => {
    it('should lift while loop to while_loop component', () => {
      const sem = liftCode('while (x > 0) { x--; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:loop_while')
    })
  })

  describe('Binary expressions', () => {
    it('should lift arithmetic: a + b', () => {
      const sem = liftCode('int r = a + b;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:arithmetic')
    })

    it('should lift comparison: x > 0', () => {
      const sem = liftCode('if (x > 0) {}')
      const components = findComponents(sem)
      expect(components).toContain('cpp:compare')
    })

    it('should lift logic: a && b', () => {
      const sem = liftCode('if (a && b) {}')
      const components = findComponents(sem)
      expect(components).toContain('cpp:logic')
    })
  })

  describe('Unary expressions', () => {
    it('should lift !x to logic_not', () => {
      const sem = liftCode('if (!x) {}')
      const components = findComponents(sem)
      expect(components).toContain('cpp:logic_not')
    })

    it('should lift -x to negate', () => {
      const sem = liftCode('int y = -x;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:negate')
    })
  })

  describe('Pointer operations', () => {
    it('should lift *ptr to cpp_pointer_deref', () => {
      const sem = liftCode('int x = *ptr;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:pointer_deref')
    })

    it('should lift &x to cpp_address_of', () => {
      const sem = liftCode('int *p = &x;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:address_of')
    })
  })

  describe('Function calls', () => {
    it('should lift strlen(s) to cpp_strlen component', () => {
      const sem = liftCode('int n = strlen(s);')
      const components = findComponents(sem)
      expect(components).toContain('cpp:cstring_size')
    })

    it('should lift free(ptr) to cpp_free (hand-written lifter)', () => {
      const sem = liftCode('free(ptr);')
      const components = findComponents(sem)
      // free() is now recognized as cpp_free component
      expect(components).toContain('cpp:free')
    })
  })

  describe('Struct access', () => {
    it('should lift p.x to cpp_struct_member_access', () => {
      const sem = liftCode('int v = p.x;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:struct_at_member')
    })

    it('should lift p->x to cpp_struct_pointer_access', () => {
      const sem = liftCode('int v = p->x;')
      const components = findComponents(sem)
      expect(components).toContain('cpp:struct_at_ptr')
    })
  })

  describe('Preprocessor', () => {
    it('should lift #include to cpp_include', () => {
      const sem = liftCode('#include <iostream>')
      const components = findComponents(sem)
      expect(components).toContain('cpp:include')
    })

    it('should lift #define to cpp_define', () => {
      const sem = liftCode('#define MAX 100')
      const components = findComponents(sem)
      expect(components).toContain('cpp:define')
    })
  })

  describe('Return statement', () => {
    it('should lift return 0 to return component', () => {
      const sem = liftCode('int main() { return 0; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:return')
    })
  })

  describe('Break / Continue', () => {
    it('should lift break to break component', () => {
      const sem = liftCode('while(1) { break; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:break')
    })

    it('should lift continue to continue component', () => {
      const sem = liftCode('while(1) { continue; }')
      const components = findComponents(sem)
      expect(components).toContain('cpp:continue')
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
      const components = findComponents(sem)
      expect(components).toContain('cpp:include')
      expect(components).toContain('cpp:input')
      expect(components).toContain('cpp:loop_count')
      expect(components).toContain('cpp:print')
      expect(components).toContain('cpp:return')

      // Verify code generation roundtrip
      const generated = generateCode(sem!, 'cpp', style)
      expect(generated).toContain('cin')
      expect(generated).toContain('cout')
      expect(generated).toContain('return')
    })

    it('should render full program to block state with scaffold blocks at L2', () => {
      const code = `#include <iostream>
using namespace std;
int main() {
    int x;
    cin >> x;
    return 0;
}`
      const sem = liftCode(code)
      expect(sem).not.toBeNull()
      const state = renderToBlocklyState(sem!)
      const types = findBlockTypes(state)
      // At L2 the full tree should produce blocks for scaffold + body
      expect(types).toContain('cpp_include')
      expect(types).toContain('cpp_var_declare')
      expect(types).toContain('cpp_input')
    })
  })
})
