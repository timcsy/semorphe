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
import type { BlockSpec, LiftPattern, UniversalTemplate, ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import type { AstNode, LiftContext } from '../../src/core/lift/types'
import { LiftContextData } from '../../src/core/lift/lift-context'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'

import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'

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

  beforeAll(() => {
    lifter = new PatternLifter()
    generator = new TemplateGenerator()
    renderer = new PatternRenderer()
    extractor = new PatternExtractor()

    const registry = new BlockSpecRegistry()
    const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)]
    const allProjections = [
      ...universalBlocks as unknown as BlockProjectionJSON[],
      ...coreBlocks,
      ...allStdModules.flatMap(m => m.blocks),
    ]
    registry.loadFromSplit(allConcepts, allProjections)
    const allSpecs = registry.getAll()

    const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration'])
    lifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
    lifter.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    renderer.loadBlockSpecs(allSpecs)
    extractor.loadBlockSpecs(allSpecs)

    for (const spec of allSpecs) {
      if (spec.codeTemplate?.pattern && spec.concept?.conceptId) {
        generator.registerTemplate(spec.concept.conceptId, spec.codeTemplate)
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

  describe('c_pointer_declare', () => {
    it('should render and extract pointer declaration', () => {
      const sem = createNode('cpp_pointer_declare', { type: 'int', name: 'ptr' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_pointer_declare')
      expect(block!.fields?.TYPE).toBe('int')
      expect(block!.fields?.NAME).toBe('ptr')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_pointer_declare')
      expect(sem2!.properties.type).toBe('int')
      expect(sem2!.properties.name).toBe('ptr')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_pointer_declare', { type: 'int', name: 'ptr' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('int* ptr;')
    })
  })

  describe('c_pointer_deref', () => {
    it('should render and extract pointer dereference', () => {
      const inner = createNode('var_ref', { name: 'ptr' })
      const sem = createNode('cpp_pointer_deref', {}, { ptr: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_pointer_deref')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_pointer_deref')
    })

    it('should generate code', () => {
      const inner = createNode('var_ref', { name: 'p' })
      const sem = createNode('cpp_pointer_deref', {}, { ptr: [inner] })
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
      expect(sem!.concept).toBe('cpp_pointer_deref')
    })
  })

  describe('c_address_of', () => {
    it('should render and extract address-of', () => {
      const inner = createNode('var_ref', { name: 'x' })
      const sem = createNode('cpp_address_of', {}, { var: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_address_of')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_address_of')
    })

    it('should generate code', () => {
      const inner = createNode('var_ref', { name: 'x' })
      const sem = createNode('cpp_address_of', {}, { var: [inner] })
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
      expect(sem!.concept).toBe('cpp_address_of')
    })
  })

  describe('c_free', () => {
    it('should render and extract free()', () => {
      const inner = createNode('var_ref', { name: 'ptr' })
      const sem = createNode('cpp_free', {}, { ptr: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_free')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_free')
    })

    it('should generate code', () => {
      const inner = createNode('var_ref', { name: 'ptr' })
      const sem = createNode('cpp_free', {}, { ptr: [inner] })
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

  describe('c_struct_member_access', () => {
    it('should render and extract struct member access', () => {
      const sem = createNode('cpp_struct_member_access', { obj: 'p', member: 'x' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_struct_member_access')
      expect(block!.fields?.OBJ).toBe('p')
      expect(block!.fields?.MEMBER).toBe('x')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_struct_member_access')
      expect(sem2!.properties.obj).toBe('p')
      expect(sem2!.properties.member).toBe('x')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_struct_member_access', { obj: 'point', member: 'y' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('point.y')
    })

    it('should lift field_expression with . operator', () => {
      const obj = mockNode('identifier', 'p')
      const member = mockNode('field_identifier', 'x')
      const ast = mockNode('field_expression', 'p.x', [obj, unnamed('.', '.'), member], {
        argument: obj,
        field: member,
        operator: unnamed('.', '.'),
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.concept).toBe('cpp_struct_member_access')
    })
  })

  describe('c_struct_pointer_access', () => {
    it('should render and extract struct pointer access', () => {
      const sem = createNode('cpp_struct_pointer_access', { ptr: 'p', member: 'x' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_struct_pointer_access')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_struct_pointer_access')
      expect(sem2!.properties.ptr).toBe('p')
      expect(sem2!.properties.member).toBe('x')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_struct_pointer_access', { ptr: 'node', member: 'next' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('node->next')
    })
  })

  // ─── String Functions ───────────────────────────────────────

  describe('c_strlen', () => {
    it('should render and extract strlen', () => {
      const inner = createNode('var_ref', { name: 's' })
      const sem = createNode('cpp_strlen', {}, { str: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_strlen')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_strlen')
    })

    it('should return null from TemplateGenerator (uses hand-written generator)', () => {
      const inner = createNode('var_ref', { name: 's' })
      const sem = createNode('cpp_strlen', {}, { str: [inner] })
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

  describe('c_strcmp', () => {
    it('should render and extract strcmp', () => {
      const s1 = createNode('var_ref', { name: 'a' })
      const s2 = createNode('var_ref', { name: 'b' })
      const sem = createNode('cpp_strcmp', {}, { s1: [s1], s2: [s2] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_strcmp')
    })

    it('should return null from TemplateGenerator (uses hand-written generator)', () => {
      const s1 = createNode('var_ref', { name: 'a' })
      const s2 = createNode('var_ref', { name: 'b' })
      const sem = createNode('cpp_strcmp', {}, { s1: [s1], s2: [s2] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBeNull()
    })
  })

  describe('c_strcpy', () => {
    it('should return null from TemplateGenerator (uses hand-written generator)', () => {
      const dest = createNode('var_ref', { name: 'dst' })
      const src = createNode('var_ref', { name: 'src' })
      const sem = createNode('cpp_strcpy', {}, { dest: [dest], src: [src] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBeNull()
    })
  })

  // ─── STL Containers ─────────────────────────────────────────

  describe('cpp_vector_declare', () => {
    it('should render and extract vector declaration', () => {
      const sem = createNode('cpp_vector_declare', { type: 'int', name: 'v' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_vector_declare')
      expect(block!.fields?.TYPE).toBe('int')
      expect(block!.fields?.NAME).toBe('v')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_vector_declare')
      expect(sem2!.properties.type).toBe('int')
      expect(sem2!.properties.name).toBe('v')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_vector_declare', { type: 'int', name: 'nums' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::vector<int> nums;')
    })
  })

  describe('cpp_vector_push_back', () => {
    it('should render and extract push_back', () => {
      const val = createNode('number_literal', { value: '42' })
      const sem = createNode('cpp_vector_push_back', { vector: 'v' }, { value: [val] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_vector_push_back')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_vector_push_back')
      expect(sem2!.properties.vector).toBe('v')
    })

    it('should generate code', () => {
      const val = createNode('number_literal', { value: '5' })
      const sem = createNode('cpp_vector_push_back', { vector: 'v' }, { value: [val] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('v.push_back(5);')
    })
  })

  describe('cpp_vector_size', () => {
    it('should render and extract vector size', () => {
      const sem = createNode('cpp_vector_size', { vector: 'v' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_vector_size')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_vector_size')
      expect(sem2!.properties.vector).toBe('v')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_vector_size', { vector: 'nums' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('nums.size()')
    })
  })

  describe('cpp_map_declare', () => {
    it('should render and extract map declaration', () => {
      const sem = createNode('cpp_map_declare', { key_type: 'string', value_type: 'int', name: 'm' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_map_declare')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_map_declare')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_map_declare', { key_type: 'string', value_type: 'int', name: 'dict' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::map<string, int> dict;')
    })
  })

  describe('cpp_string_declare', () => {
    it('should render and extract string declaration', () => {
      const sem = createNode('cpp_string_declare', { name: 's' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_string_declare')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_string_declare')
      expect(sem2!.properties.name).toBe('s')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_string_declare', { name: 'greeting' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::string greeting;')
    })
  })

  describe('cpp_sort', () => {
    it('should render and extract sort', () => {
      const sem = createNode('cpp_sort', { begin: 'v.begin()', end: 'v.end()' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_sort')
    })

    it('should generate code via hand-written generator', () => {
      // cpp_sort uses hand-written generator (not codeTemplate), tested in roundtrip-cpp-algorithm.test.ts
      const sem = createNode('cpp_sort', { begin: 'v.begin()', end: 'v.end()' })
      // TemplateGenerator returns null for hand-written generators — expected
      const code = generator.generate(sem, genCtx)
      expect(code).toBeNull()
    })
  })

  describe('cpp_stack_declare', () => {
    it('should render and extract stack declaration', () => {
      const sem = createNode('cpp_stack_declare', { type: 'int', name: 'st' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_stack_declare')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_stack_declare')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_stack_declare', { type: 'int', name: 'st' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::stack<int> st;')
    })
  })

  describe('cpp_queue_declare', () => {
    it('should generate code', () => {
      const sem = createNode('cpp_queue_declare', { type: 'int', name: 'q' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::queue<int> q;')
    })
  })

  describe('cpp_set_declare', () => {
    it('should generate code', () => {
      const sem = createNode('cpp_set_declare', { type: 'int', name: 's' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('std::set<int> s;')
    })
  })

  // ─── OOP ────────────────────────────────────────────────────

  describe('cpp_new', () => {
    it('should render and extract new expression', () => {
      const sem = createNode('cpp_new', { type: 'Node', args: '' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_new')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_new')
      expect(sem2!.properties.type).toBe('Node')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_new', { type: 'int', args: '5' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('new int(5)')
    })
  })

  describe('cpp_delete', () => {
    it('should render and extract delete', () => {
      const inner = createNode('var_ref', { name: 'ptr' })
      const sem = createNode('cpp_delete', {}, { ptr: [inner] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_delete')
    })

    it('should generate code', () => {
      const inner = createNode('var_ref', { name: 'p' })
      const sem = createNode('cpp_delete', {}, { ptr: [inner] })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('delete p;')
    })
  })

  describe('cpp_method_call', () => {
    it('should render and extract method call statement', () => {
      const sem = createNode('cpp_method_call', { obj: 'v', method: 'clear', args: '' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_method_call')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_method_call')
      expect(sem2!.properties.obj).toBe('v')
      expect(sem2!.properties.method).toBe('clear')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_method_call', { obj: 'v', method: 'push_back', args: '5' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('v.push_back(5);')
    })
  })

  describe('cpp_method_call_expr', () => {
    it('should render and extract method call expression', () => {
      const sem = createNode('cpp_method_call_expr', { obj: 'v', method: 'size', args: '' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_method_call_expr')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_method_call_expr')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_method_call_expr', { obj: 'v', method: 'size', args: '' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('v.size()')
    })
  })

  // ─── Preprocessor (Special) ─────────────────────────────────

  describe('c_ifdef', () => {
    it('should render and extract ifdef', () => {
      const sem = createNode('cpp_ifdef', { condition: 'DEBUG' }, { body: [] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_ifdef')
      expect(block!.fields?.CONDITION).toBe('DEBUG')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_ifdef')
      expect(sem2!.properties.condition).toBe('DEBUG')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_ifdef', { condition: 'DEBUG' }, { body: [] })
      const code = generator.generate(sem, genCtx)
      expect(code).toContain('#ifdef DEBUG')
      expect(code).toContain('#endif')
    })
  })

  describe('c_ifndef', () => {
    it('should render and extract ifndef', () => {
      const sem = createNode('cpp_ifndef', { condition: 'HEADER_H' }, { body: [] })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_ifndef')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_ifndef')
      expect(sem2!.properties.condition).toBe('HEADER_H')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_ifndef', { condition: 'HEADER_H' }, { body: [] })
      const code = generator.generate(sem, genCtx)
      expect(code).toContain('#ifndef HEADER_H')
      expect(code).toContain('#endif')
    })
  })

  // ─── Other Special Blocks ───────────────────────────────────

  describe('c_include', () => {
    it('should render and extract include', () => {
      const sem = createNode('cpp_include', { header: 'iostream' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_include')
      expect(block!.fields?.HEADER).toBe('iostream')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_include')
      expect(sem2!.properties.header).toBe('iostream')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_include', { header: 'stdio.h' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('#include <stdio.h>')
    })
  })

  describe('c_define', () => {
    it('should render and extract define', () => {
      const sem = createNode('cpp_define', { name: 'MAX', value: '100' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_define')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_define')
      expect(sem2!.properties.name).toBe('MAX')
      expect(sem2!.properties.value).toBe('100')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_define', { name: 'PI', value: '3.14' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('#define PI 3.14')
    })
  })

  describe('c_using_namespace', () => {
    it('should render and extract using namespace', () => {
      const sem = createNode('cpp_using_namespace', { ns: 'std' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_using_namespace')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_using_namespace')
      expect(sem2!.properties.ns).toBe('std')
    })

    it('should generate code', () => {
      const sem = createNode('cpp_using_namespace', { ns: 'std' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('using namespace std;')
    })
  })

  describe('c_comment_line', () => {
    it('should render and extract comment', () => {
      const sem = createNode('comment', { text: 'hello' })
      const block = renderer.render(sem)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_comment_line')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('comment')
      expect(sem2!.properties.text).toBe('hello')
    })

    it('should generate code', () => {
      const sem = createNode('comment', { text: 'test' })
      const code = generator.generate(sem, genCtx)
      expect(code).toBe('// test')
    })
  })
})
