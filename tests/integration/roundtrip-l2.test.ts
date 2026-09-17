/**
 * L2 Block Roundtrip Tests
 *
 * Verifies that all L2 C++ blocks (advanced.json + special preprocessor blocks)
 * can complete Semantic→Block→Semantic and Semantic→Code roundtrip conversions.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { TemplateGenerator } from '../../src/core/projection/template-generator'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { createNode } from '../../src/core/semantic-tree'
import type { BlockSpec, LiftPattern, UniversalTemplate, ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import type { AstNode, LiftContext } from '../../src/core/lift/types'
import { LiftContextData } from '../../src/core/lift/lift-context'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { generateCode } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { tryAstBranches } from '../../src/core/component/lift-branches'
// ⚠️ 觸發膠囊的 lift 註冊——`registerAstBranch` 的分支住在膠囊裡，
// 不載入的話 `tryAstBranches` 永遠回 null（而那與「判別寫錯了」長得一樣）。
import { createTestLifter } from '../helpers/setup-lifter'
import type { StylePreset } from '../../src/core/types'

import { universalComponents, universalBlocks } from '../../src/core/universal'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/lang'
import { allStdModules } from '../../src/languages/cpp/std'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'

function mockNode(
  type: string,
  text: string,
  children: AstNode[] = [],
  fields: Record<string, AstNode | null> = {},
): AstNode {
  const namedChildren = children.filter(c => c.isNamed)
  return {
    type,
    text,
    isNamed: true,
    children,
    namedChildren,
    childForFieldName: (name: string) => fields[name] ?? null,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
  }
}

function unnamed(type: string, text: string): AstNode {
  return { ...mockNode(type, text), isNamed: false }
}

describe('L2 Block Roundtrip', () => {
  let lifter: PatternLifter
  let generator: TemplateGenerator
  let renderer: PatternRenderer
  let extractor: PatternExtractor

  const style: StylePreset = {
    id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' },
    io_style: 'cout', naming_convention: 'camelCase',
    indent_size: 4, brace_style: 'K&R',
    namespace_style: 'using', header_style: 'individual',
  }

  beforeAll(() => {
    createTestLifter() // ⚠️ 只為了觸發膠囊的 lift 註冊（見檔頭 import）
    lifter = new PatternLifter()
    lifter.setGrammar('tree-sitter-cpp')
    generator = new TemplateGenerator()
    renderer = new PatternRenderer()
    extractor = new PatternExtractor()
    registerCppLanguage()

    const registry = new BlockSpecRegistry()
    // ⚠️ **走唯一組裝點，不在這裡自己串一份。**
    // 這是第六份被找到的各自組裝。它們全部在元件膠囊接上正式路徑那天一起現形
    // ——因為膠囊是第一個「只存在於正式路徑」的宣告來源。
    registry.loadFromSplit(allCppComponents(), allCppProjections())
    const allSpecs = registry.getAll()

    const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration'])
    lifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
    lifter.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    renderer.loadBlockSpecs(allSpecs)
    extractor.loadBlockSpecs(allSpecs)

    for (const spec of allSpecs) {
      if (spec.codeTemplate?.pattern && spec.componentMapping?.componentId) {
        // 形態要一起傳——不傳的話變體的模板會蓋掉中性版（實測：少一個分號）
        generator.registerTemplate(
          spec.componentMapping.componentId,
          spec.codeTemplate,
          (spec as { form?: { axis: string; value: string } }).form,
        )
      }
    }
    generator.loadUniversalTemplates(universalTemplatesJson as unknown as UniversalTemplate[])
  })

  function liftCtx(): LiftContext {
    const data = new LiftContextData()
    return {
      lift: (n) => lifter.tryLift(n, liftCtx()),
      liftChildren: (nodes) =>
        nodes.map(n => lifter.tryLift(n, liftCtx())).filter((r): r is NonNullable<typeof r> => r !== null),
      data,
    }
  }

  const genCtx = { indent: 0, style: { indent_size: 4 } as any }

  // ─── Pointer Operations ─────────────────────────────────────

  describe('cpp_pointer_declare', () => {
    it('should render and extract pointer declaration', () => {
      const sem = createNode('cpp:pointer_declare', { type: 'int', name: 'ptr' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_pointer_declare')
      expect(block!.fields?.TYPE).toBe('int')
      expect(block!.fields?.NAME).toBe('ptr')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:pointer_declare')
      expect(sem2!.properties.type).toBe('int')
      expect(sem2!.properties.name).toBe('ptr')
    })

    it('should generate code (via hand-written generator, no codeTemplate)', () => {
      const sem = createNode('cpp:pointer_declare', { type: 'int', name: 'ptr' })
      // cpp_pointer_declare uses hand-written generator (declarations.ts)
      // because codeTemplate can't express optional initializer
      const code = generateCode(sem, 'cpp', style)
      expect(code).toContain('int* ptr')
    })
  })

  describe('cpp_pointer_deref', () => {
    it('should render and extract pointer dereference', () => {
      const inner = createNode('cpp:var_ref', { name: 'ptr' })
      const sem = createNode('cpp:pointer_deref', {}, { ptr: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_pointer_deref')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:pointer_deref')
    })

    it('should generate code', () => {
      const inner = createNode('cpp:var_ref', { name: 'p' })
      const sem = createNode('cpp:pointer_deref', {}, { ptr: [inner] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('*p')
    })

    it('should lift pointer_expression with * operator', () => {
      const arg = mockNode('identifier', 'ptr')
      const ast = mockNode('pointer_expression', '*ptr', [unnamed('*', '*'), arg], {
        operator: unnamed('*', '*'),
        argument: arg,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.componentId).toBe('cpp:pointer_deref')
    })
  })

  describe('cpp_address_of', () => {
    it('should render and extract address-of', () => {
      const inner = createNode('cpp:var_ref', { name: 'x' })
      const sem = createNode('cpp:address_of', {}, { var: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_address_of')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:address_of')
    })

    it('should generate code', () => {
      const inner = createNode('cpp:var_ref', { name: 'x' })
      const sem = createNode('cpp:address_of', {}, { var: [inner] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('&x')
    })

    it('should lift pointer_expression with & operator', () => {
      const arg = mockNode('identifier', 'x')
      const ast = mockNode('pointer_expression', '&x', [unnamed('&', '&'), arg], {
        operator: unnamed('&', '&'),
        argument: arg,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.componentId).toBe('cpp:address_of')
    })
  })

  describe('cpp_free', () => {
    it('should render and extract free()', () => {
      const inner = createNode('cpp:var_ref', { name: 'ptr' })
      const sem = createNode('cpp:free', {}, { ptr: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_free')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:free')
    })

    it('should generate code', () => {
      const inner = createNode('cpp:var_ref', { name: 'ptr' })
      const sem = createNode('cpp:free', {}, { ptr: [inner] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('free(ptr);')
    })

    it('should skip call_expression lift (handled by hand-written lifter)', () => {
      const funcNode = mockNode('identifier', 'free')
      const ast = mockNode('call_expression', 'free(ptr)', [], {
        function: funcNode,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).toBeNull() // call_expression excluded from BlockSpec patterns
    })
  })

  // ─── Struct Operations ──────────────────────────────────────

  describe('cpp_struct_at_member', () => {
    it('should render and extract struct member access', () => {
      const sem = createNode('cpp:struct_at_member', { member: 'x' }, { obj: [createNode('cpp:var_ref', { name: 'p' })] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_struct_at_member')
      // 🟢 `OBJ` 從欄位換成接點（2026-08-26）
      expect(block!.fields?.OBJ, '🔴 欄位長回來了').toBeUndefined()
      expect(block!.inputs?.OBJ?.block?.fields?.NAME).toBe('p')
      expect(block!.fields?.MEMBER).toBe('x')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:struct_at_member')
      // 🟢 **接收者是接點**（2026-08-26）
      expect(sem2!.properties.obj, '🔴 字串屬性長回來了').toBeUndefined()
      expect(sem2!.slots.obj[0].properties.name).toBe('p')
      expect(sem2!.properties.member).toBe('x')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:struct_at_member', { member: 'y' }, { obj: [createNode('cpp:var_ref', { name: 'point' })] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('point.y')
    })

    it('should lift field_expression with . operator（走分支，不走 astPattern）', () => {
      // ⚠️ **這支原本測的是 `blocks.json` 的 `astPattern`，而那份宣告在
      // 2026-08-13 被移除了**——同一顆元件有**兩份 lift 宣告**
      //（`astPattern` ＋ `registerAstBranch`），而 astPattern 優先，
      // 於是 `lift.ts` 那一份**從來沒有被呼叫過**（實測：加 console.log 零輸出）。
      //
      // 代價很具體：astPattern 的 `extract: "text"` 把 `v[0].first` 的 obj 抽成
      // 字串 `"v[0]"`，執行器拿去查 scope 查不到 → `UNDECLARED_VAR`
      // （第三十二條護欄的 1 段缺口）。
      //
      // > **兩份宣告同時存在時，輸的那一份不會報錯——它只是安靜地沒有作用。**
      const obj = mockNode('identifier', 'p')
      const member = mockNode('field_identifier', 'x')
      const ast = mockNode('field_expression', 'p.x', [obj, unnamed('.', '.'), member], {
        argument: obj,
        field: member,
        operator: unnamed('.', '.'),
      })
      const sem = tryAstBranches('field_expression', ast, liftCtx())
      expect(sem, 'field_expression 的分支沒有認領它').not.toBeNull()
      expect(sem!.componentId).toBe('cpp:struct_at_member')
      // 🟢 **接收者一律是接點**（2026-08-26）。
      // 🪦 這裡本來釘的是反向：「單純的識別字仍然走字串屬性，不掛接點」
      // ——那個混合形狀有兩個代價：`m[k].y` 的接收者被寫成字串，
      // 以及積木上多一列「（ ? ）」——那一列是為了裝「不是名字的那一種」，
      // 而它在常見情況下永遠是空的。見 `history/157`。
      expect(sem!.properties.obj, '🔴 字串屬性長回來了').toBeUndefined()
      expect(sem!.slots.obj[0].componentId).toBe('cpp:var_ref')
      expect(sem!.slots.obj[0].properties.name).toBe('p')
    })
  })

  describe('cpp_struct_at_ptr', () => {
    it('should render and extract struct pointer access', () => {
      const sem = createNode('cpp:struct_at_ptr', { obj: 'p', member: 'x' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_struct_at_ptr')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:struct_at_ptr')
      // ⚠️ 這一顆**還沒**遷移（它的接收者仍然是屬性）——見 `_slots_why` 那一批
      expect(sem2!.properties.obj).toBe('p')
      expect(sem2!.properties.member).toBe('x')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:struct_at_ptr', { obj: 'node', member: 'next' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('node->next')
    })
  })

  // ─── String Functions ───────────────────────────────────────

  describe('cpp_cstring_size', () => {
    it('should render and extract strlen', () => {
      const inner = createNode('cpp:var_ref', { name: 's' })
      const sem = createNode('cpp:cstring_size', {}, { str: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_cstring_size')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:cstring_size')
    })

    it('should return null from TemplateGenerator (uses hand-written generator)', () => {
      const inner = createNode('cpp:var_ref', { name: 's' })
      const sem = createNode('cpp:cstring_size', {}, { str: [inner] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBeNull()
    })

    it('should skip call_expression lift (handled by hand-written lifter)', () => {
      const funcNode = mockNode('identifier', 'strlen')
      const ast = mockNode('call_expression', 'strlen(s)', [], {
        function: funcNode,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).toBeNull() // call_expression excluded from BlockSpec patterns
    })
  })

  describe('cpp_cstring_compare', () => {
    it('should render and extract strcmp', () => {
      const s1 = createNode('cpp:var_ref', { name: 'a' })
      const s2 = createNode('cpp:var_ref', { name: 'b' })
      const sem = createNode('cpp:cstring_compare', {}, { s1: [s1], s2: [s2] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_cstring_compare')
    })

    it('should return null from TemplateGenerator (uses hand-written generator)', () => {
      const s1 = createNode('cpp:var_ref', { name: 'a' })
      const s2 = createNode('cpp:var_ref', { name: 'b' })
      const sem = createNode('cpp:cstring_compare', {}, { s1: [s1], s2: [s2] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBeNull()
    })
  })

  describe('cpp_cstring_copy', () => {
    it('should return null from TemplateGenerator (uses hand-written generator)', () => {
      const dest = createNode('cpp:var_ref', { name: 'dst' })
      const src = createNode('cpp:var_ref', { name: 'src' })
      const sem = createNode('cpp:cstring_copy', {}, { dest: [dest], src: [src] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBeNull()
    })
  })

  // ─── STL Containers ─────────────────────────────────────────

  describe('cpp:vector_declare', () => {
    it('should render and extract vector declaration', () => {
      const sem = createNode('cpp:vector_declare', { type: 'int', name: 'v' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_vector_declare')
      expect(block!.fields?.TYPE).toBe('int')
      expect(block!.fields?.NAME).toBe('v')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:vector_declare')
      expect(sem2!.properties.type).toBe('int')
      expect(sem2!.properties.name).toBe('v')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:vector_declare', { type: 'int', name: 'nums' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::vector<int> nums;')
    })
  })

  describe('cpp:container_append', () => {
    it('should render and extract push_back', () => {
      const val = createNode('cpp:literal_number', { value: '42' })
      const sem = createNode('cpp:container_append', {}, { obj: [createNode('cpp:var_ref', { name: 'v' })],  value: [val] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_container_append')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:container_append')
      expect((sem2!.slots.obj[0] as SemanticNode).properties.name).toBe('v')
    })

    it('should generate code', () => {
      const val = createNode('cpp:literal_number', { value: '5' })
      const sem = createNode('cpp:container_append', {}, { obj: [createNode('cpp:var_ref', { name: 'v' })],  value: [val] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('v.push_back(5);')
    })
  })

  describe('cpp:vector_size', () => {
    it('should render and extract vector size', () => {
      const sem = createNode('cpp:vector_size', {}, { obj: [createNode('cpp:var_ref', { name: 'v' })] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_vector_size')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:vector_size')
      expect((sem2!.slots.obj[0] as SemanticNode).properties.name).toBe('v')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:vector_size', {}, { obj: [createNode('cpp:var_ref', { name: 'nums' })] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('nums.size()')
    })
  })

  describe('cpp:map_declare', () => {
    it('should render and extract map declaration', () => {
      const sem = createNode('cpp:map_declare', { key_type: 'string', value_type: 'int', name: 'm' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_map_declare')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:map_declare')
    })

    /**
     * 🔴 **走的是 `generateCode`，不是 `generator.generate`**（2026-09-17）。
     *
     * 這一顆原本宣告了 `codeTemplate`，而那份樣板與膠囊的 `generate.ts` 對同一件事
     * 的說法不一樣（`std::map` vs `map`）。沒有人發現，是因為 `setTemplateGenerator`
     * 在 `src/` 內**零呼叫**——這支測試自己接了一個樣板產生器上去，於是
     * **它驗的是產品跑不到的那一份**。有序性那一軸樣板也表達不了，所以樣板拿掉了。
     *
     * > **一支自己把管線接起來的測試，會驗到一條產品沒有接上的路。**
     */
    it('should generate code', () => {
      const sem = createNode('cpp:map_declare', { key_type: 'string', value_type: 'int', name: 'dict' })
      expect(generateCode(sem, 'cpp', style)).toContain('map<string, int> dict;')
    })

    it('🔴 unordered_map 走同一顆，而它不得被產回成 map', () => {
      const sem = createNode('cpp:map_declare', { key_type: 'int', value_type: 'int', name: 'cnt', ordered: 'false' })
      expect(generateCode(sem, 'cpp', style)).toContain('unordered_map<int, int> cnt;')
    })

    // 同上（面向③）：舊存檔沒有那一格。
    it('🔴 舊存檔（沒有那一格）仍然渲染得出來、抽得回去', () => {
      const sem = createNode('cpp:map_declare', { key_type: 'string', value_type: 'int', name: 'm' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      const back = extractor.extract(block!)
      expect(back!.componentId).toBe('cpp:map_declare')
      expect(back!.properties.ordered ?? 'true').toBe('true')
    })

    /**
     * 🔴 **面向④：走一趟積木回來**（2026-09-17 新增的 `source` 那一格）。
     *
     * `map<char,int> r = f();` 的初始值原本在 lift 就掉了。補上接點之後，
     * lift 與 generate 兩路都接得住——**而那還不足以證明學生動得了它**：
     * 形態表達不出那一格的話，`render → extract` 會安靜地少一塊，
     * 而症狀是「學生一動積木，`= f()` 就從他的程式碼裡不見了」。
     */
    it('🔴 初始值那一格：畫得出來，也抽得回去', () => {
      const sem = createNode('cpp:map_declare',
        { key_type: 'char', value_type: 'int', name: 'r' },
        { source: [createNode('cpp:var_ref', { name: 'other' })] })
      const block = renderer.render(sem)
      expect(block, '🔴 畫不出來').not.toBeNull()
      const back = extractor.extract(block!)
      expect(back!.componentId).toBe('cpp:map_declare')
      expect(back!.slots.source?.length, '🔴 走一趟積木回來就少了初始值').toBe(1)
      expect(back!.slots.source[0].properties.name).toBe('other')
      expect(generateCode(back!, 'cpp', style)).toContain('map<char, int> r = other;')
    })
  })

  describe('cpp:string_declare', () => {
    it('should render and extract string declaration', () => {
      const sem = createNode('cpp:string_declare', { name: 's' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_string_declare')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:string_declare')
      expect(sem2!.properties.name).toBe('s')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:string_declare', { name: 'greeting' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::string greeting;')
    })
  })

  describe('cpp:range_sort', () => {
    it('should render and extract sort', () => {
      const sem = createNode('cpp:range_sort', { begin: 'v.begin()', end: 'v.end()' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_range_sort')
    })

    it('should generate code via hand-written generator', () => {
      // cpp_range_sort uses hand-written generator (not codeTemplate), tested in roundtrip-cpp-algorithm.test.ts
      const sem = createNode('cpp:range_sort', { begin: 'v.begin()', end: 'v.end()' })
      // TemplateGenerator returns null for hand-written generators — expected
      const code = generator.generate(sem, genCtx)
      expect(code).toBeNull()
    })
  })

  describe('cpp:stack_declare', () => {
    it('should render and extract stack declaration', () => {
      const sem = createNode('cpp:stack_declare', { type: 'int', name: 'st' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_stack_declare')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:stack_declare')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:stack_declare', { type: 'int', name: 'st' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::stack<int> st;')
    })
  })

  describe('cpp:queue_declare', () => {
    it('should generate code', () => {
      const sem = createNode('cpp:queue_declare', { type: 'int', name: 'q' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::queue<int> q;')
    })
  })

  /**
   * 🔴 **第六關（開瀏覽器）看到的**：`for (auto it = v.begin(); …)` 的初始那一格
   * 在積木上是一塊**寫死文字**的 `cpp_raw_expression`——畫面上寫著
   * 「直接寫運算式：auto it = v.begin()」。
   *
   * 而並排的對照讓它無所遁形：`for (int i = 0; …)` 的同一格是一顆真的積木
   * （`cpp_var_declare_expression`）——**同族那顆早就有兩個形態，而這一顆只有一個。**
   *
   * > **一個只在【積木這一條投影】上壞掉的缺陷，
   * > lift／generate／execute 三路的測試全部是綠的。**
   */
  describe('cpp:var_declare_auto 的兩個形態', () => {
    it('★ 語句位置：還是原本那一顆', () => {
      const sem = createNode('cpp:var_declare_auto', { name: 'it' },
        { initializer: [createNode('cpp:literal_number', { value: '1' })] })
      expect(renderer.render(sem, undefined, 'statement')!.type).toBe('cpp_var_declare_auto')
    })

    it('🔴 運算式位置：要有自己的形態，不得落成寫死文字', () => {
      const sem = createNode('cpp:var_declare_auto', { name: 'it' },
        { initializer: [createNode('cpp:literal_number', { value: '1' })] })
      const block = renderer.render(sem, undefined, 'expression')
      expect(block, '🔴 畫不出來').not.toBeNull()
      expect(block!.type, '🔴 運算式位置落回語句形態 → for 迴圈的初始那一格會變成一塊文字')
        .toBe('cpp_var_declare_auto_expression')
      // 抽得回去，而且抽回來還是同一個身分
      const back = extractor.extract(block!)
      expect(back!.componentId).toBe('cpp:var_declare_auto')
      expect(back!.properties.name).toBe('it')
    })
  })

  describe('cpp:set_declare', () => {
    // 面向④：與同族那顆對照表同一條理由，見那裡的註解。
    it('🔴 初始值那一格：畫得出來，也抽得回去', () => {
      const sem = createNode('cpp:set_declare',
        { type: 'int', name: 'b' },
        { source: [createNode('cpp:var_ref', { name: 'a' })] })
      const block = renderer.render(sem)
      expect(block, '🔴 畫不出來').not.toBeNull()
      const back = extractor.extract(block!)
      expect(back!.componentId).toBe('cpp:set_declare')
      expect(back!.slots.source?.length, '🔴 走一趟積木回來就少了初始值').toBe(1)
      expect(generateCode(back!, 'cpp', style)).toContain('set<int> b = a;')
    })

    // 同上：這一顆的樣板也拿掉了，所以驗的是產品真的會走的那一條。
    it('should generate code', () => {
      const sem = createNode('cpp:set_declare', { type: 'int', name: 's' })
      expect(generateCode(sem, 'cpp', style)).toContain('set<int> s;')
    })

    it('🔴 multiset 走同一顆，而它不得被產回成 set', () => {
      const sem = createNode('cpp:set_declare', { type: 'int', name: 'ms', unique: 'false' })
      expect(generateCode(sem, 'cpp', style)).toContain('multiset<int> ms;')
    })

    /**
     * 🔴 **面向③：舊存檔載得進來嗎**（2026-09-17）。
     *
     * 這顆積木多了一個下拉欄位，而**既有存檔裡沒有那一格**。
     * 渲染不得因此吐 null，抽取也不得把那一格變成 `undefined` 字串
     * ——那兩種都會讓使用者開啟舊作品時看到一片空白或一個壞掉的欄位。
     */
    it('🔴 舊存檔（沒有那一格）仍然渲染得出來、抽得回去', () => {
      const sem = createNode('cpp:set_declare', { type: 'int', name: 's' })
      const block = renderer.render(sem)
      expect(block, '🔴 渲染吐 null → 工作區一片空白，不是少一個欄位').not.toBeNull()
      expect(block!.type).toBe('cpp_set_declare')
      const back = extractor.extract(block!)
      expect(back!.componentId).toBe('cpp:set_declare')
      expect(back!.properties.name).toBe('s')
      // 抽回來時那一格會拿到下拉的第一個選項——而第一個選項必須是「去重」那一邊。
      expect(back!.properties.unique ?? 'true', '🔴 第一個選項若是 multiset，舊作品會開始留重複').toBe('true')
    })
  })

  // ─── OOP ────────────────────────────────────────────────────

  describe('cpp:new', () => {
    it('should render and extract new expression', () => {
      const sem = createNode('cpp:new', { type: 'Node', args: '' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_new')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:new')
      expect(sem2!.properties.type).toBe('Node')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:new', { type: 'int', args: '5' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('new int(5)')
    })
  })

  describe('cpp:delete', () => {
    it('should render and extract delete', () => {
      const inner = createNode('cpp:var_ref', { name: 'ptr' })
      const sem = createNode('cpp:delete', {}, { ptr: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_delete')
    })

    it('should generate code', () => {
      const inner = createNode('cpp:var_ref', { name: 'p' })
      const sem = createNode('cpp:delete', {}, { ptr: [inner] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('delete p;')
    })
  })

  describe('cpp:method_call', () => {
    it('should render and extract method call statement', () => {
      const sem = createNode('cpp:method_call', {method: 'clear', args: ''}, { obj: [createNode('cpp:var_ref', { name: 'v' })] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_method_call')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:method_call')
      expect((sem2!.slots.obj[0] as SemanticNode).properties.name).toBe('v')
      expect(sem2!.properties.method).toBe('clear')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:method_call', {method: 'push_back', args: '5'}, { obj: [createNode('cpp:var_ref', { name: 'v' })] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('v.push_back(5);')
    })
  })

  describe('cpp:method_call', () => {
    it('should render and extract method call expression', () => {
      const sem = createNode('cpp:method_call', {method: 'size', args: ''}, { obj: [createNode('cpp:var_ref', { name: 'v' })] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_method_call')  // 中性形態（渲染端未給位置）

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:method_call')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:method_call', {method: 'size', args: ''}, { obj: [createNode('cpp:var_ref', { name: 'v' })] })
      // ⚠️ **運算式位置**——B 項合併身分之後，位置由 ctx 說，不由身分編碼
      const code = generator.generate(sem, { ...genCtx, isExpression: true })
      expect(code).toBe('v.size()')
    })
  })

  // ─── Preprocessor (Special) ─────────────────────────────────

  describe('cpp_ifdef', () => {
    it('should render and extract ifdef', () => {
      const sem = createNode('cpp:ifdef', { condition: 'DEBUG' }, { body: [] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_ifdef')
      expect(block!.fields?.CONDITION).toBe('DEBUG')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:ifdef')
      expect(sem2!.properties.condition).toBe('DEBUG')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:ifdef', { condition: 'DEBUG' }, { body: [] })
      const code = generator.generate(sem, genCtx)
      expect(code).toContain('#ifdef DEBUG')
      expect(code).toContain('#endif')
    })
  })

  describe('cpp_ifndef', () => {
    it('should render and extract ifndef', () => {
      const sem = createNode('cpp:ifndef', { condition: 'HEADER_H' }, { body: [] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_ifndef')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:ifndef')
      expect(sem2!.properties.condition).toBe('HEADER_H')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:ifndef', { condition: 'HEADER_H' }, { body: [] })
      const code = generator.generate(sem, genCtx)
      expect(code).toContain('#ifndef HEADER_H')
      expect(code).toContain('#endif')
    })
  })

  // ─── Other Special Blocks ───────────────────────────────────

  describe('cpp_include', () => {
    it('should render and extract include', () => {
      const sem = createNode('cpp:include', { header: 'iostream' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_include')
      expect(block!.fields?.HEADER).toBe('iostream')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:include')
      expect(sem2!.properties.header).toBe('iostream')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:include', { header: 'stdio.h' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('#include <stdio.h>')
    })
  })

  describe('cpp_define', () => {
    it('should render and extract define', () => {
      const sem = createNode('cpp:define', { name: 'MAX', value: '100' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_define')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:define')
      expect(sem2!.properties.name).toBe('MAX')
      expect(sem2!.properties.value).toBe('100')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:define', { name: 'PI', value: '3.14' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('#define PI 3.14')
    })
  })

  describe('cpp_using_namespace', () => {
    it('should render and extract using namespace', () => {
      const sem = createNode('cpp:using_namespace', { ns: 'std' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_using_namespace')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:using_namespace')
      expect(sem2!.properties.ns).toBe('std')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:using_namespace', { ns: 'std' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('using namespace std;')
    })
  })

  describe('cpp_comment', () => {
    it('should render and extract comment', () => {
      const sem = createNode('cpp:comment', { text: 'hello' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_comment')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:comment')
      expect(sem2!.properties.text).toBe('hello')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:comment', { text: 'test' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('// test')
    })
  })
})
