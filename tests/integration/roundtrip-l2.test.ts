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
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { generateCode } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { tryAstBranches } from '../../src/core/component/lift-branches'
// ⚠️ 觸發膠囊的 lift 註冊——`registerAstBranch` 的分支住在膠囊裡，
// 不載入的話 `tryAstBranches` 永遠回 null（而那與「判別寫錯了」長得一樣）。
import { createTestLifter } from '../helpers/setup-lifter'
import type { StylePreset } from '../../src/core/types'

import { universalComponents, universalBlocks } from '../../src/core/universal'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/core'
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
      const sem = createNode('cpp:struct_at_member', { obj: 'p', member: 'x' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_struct_at_member')
      expect(block!.fields?.OBJ).toBe('p')
      expect(block!.fields?.MEMBER).toBe('x')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:struct_at_member')
      expect(sem2!.properties.obj).toBe('p')
      expect(sem2!.properties.member).toBe('x')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:struct_at_member', { obj: 'point', member: 'y' })
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
      expect(sem!.properties.obj).toBe('p')
      // ★ 反向：單純的識別字仍然走**字串屬性**，不掛接點
      // ——掛了的話 `p.first` 這種最常見的寫法會多一層而產生器讀不到。
      expect(sem!.children?.obj).toBeUndefined()
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
      const sem = createNode('cpp:container_append', { obj: 'v' }, { value: [val] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_container_append')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:container_append')
      expect(sem2!.properties.obj).toBe('v')
    })

    it('should generate code', () => {
      const val = createNode('cpp:literal_number', { value: '5' })
      const sem = createNode('cpp:container_append', { obj: 'v' }, { value: [val] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('v.push_back(5);')
    })
  })

  describe('cpp:vector_size', () => {
    it('should render and extract vector size', () => {
      const sem = createNode('cpp:vector_size', { obj: 'v' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_vector_size')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:vector_size')
      expect(sem2!.properties.obj).toBe('v')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:vector_size', { obj: 'nums' })
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

    it('should generate code', () => {
      const sem = createNode('cpp:map_declare', { key_type: 'string', value_type: 'int', name: 'dict' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::map<string, int> dict;')
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

  describe('cpp:set_declare', () => {
    it('should generate code', () => {
      const sem = createNode('cpp:set_declare', { type: 'int', name: 's' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::set<int> s;')
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
      const sem = createNode('cpp:method_call', { obj: 'v', method: 'clear', args: '' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_method_call')

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:method_call')
      expect(sem2!.properties.obj).toBe('v')
      expect(sem2!.properties.method).toBe('clear')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:method_call', { obj: 'v', method: 'push_back', args: '5' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('v.push_back(5);')
    })
  })

  describe('cpp:method_call', () => {
    it('should render and extract method call expression', () => {
      const sem = createNode('cpp:method_call', { obj: 'v', method: 'size', args: '' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_method_call')  // 中性形態（渲染端未給位置）

      const sem2 = extractor.extract(block!)
      expect(sem2!.componentId).toBe('cpp:method_call')
    })

    it('should generate code', () => {
      const sem = createNode('cpp:method_call', { obj: 'v', method: 'size', args: '' })
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
