import { describe, it, expect, beforeAll } from 'vitest'
import { generateCodeWithMapping } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createNode } from '../../src/core/semantic-tree'
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

beforeAll(() => {
  registerCppLanguage()
})

function makeProgram(...body: ReturnType<typeof createNode>[]) {
  return {
    id: 'root',
    concept: 'program',
    properties: {},
    children: { body },
    metadata: {},
  }
}

describe('CodeMapping integration (nodeId-based)', () => {
  it('should produce mappings using nodeId for nodes with id', () => {
    const decl = createNode('var_declare', { name: 'x', type: 'int' }, {
      initializer: [createNode('number_literal', { value: '5' })],
    })

    const print = createNode('print', {}, {
      values: [createNode('var_ref', { name: 'x' })],
    })

    const tree = makeProgram(decl, print)
    const { code, mappings } = generateCodeWithMapping(tree, 'cpp', style)
    expect(code).toContain('int x = 5;')
    expect(code).toContain('cout')
    // Mappings use nodeId (node.id from createNode)
    expect(mappings.length).toBeGreaterThanOrEqual(2)

    const declMapping = mappings.find(m => m.nodeId === decl.id)
    const printMapping = mappings.find(m => m.nodeId === print.id)
    expect(declMapping).toBeDefined()
    expect(printMapping).toBeDefined()
    expect(declMapping!.startLine).toBeLessThan(printMapping!.startLine)
    // No blockId field
    expect('blockId' in declMapping!).toBe(false)
  })

  it('should produce mappings for all nodes with id (no blockId dependency)', () => {
    // This is the key US1 test: nodes created by createNode have id automatically,
    // so mappings are produced WITHOUT needing metadata.blockId
    const decl = createNode('var_declare', { name: 'x', type: 'int' }, {
      initializer: [createNode('number_literal', { value: '1' })],
    })
    const tree = makeProgram(decl)
    const { mappings } = generateCodeWithMapping(tree, 'cpp', style)
    // Now produces mappings (using node.id) — previously was empty without blockId
    expect(mappings.length).toBeGreaterThanOrEqual(1)
    expect(mappings[0].nodeId).toBe(decl.id)
  })

  it('should handle nested structures with nodeId', () => {
    const cond = createNode('compare', { operator: '>' }, {
      left: [createNode('var_ref', { name: 'x' })],
      right: [createNode('number_literal', { value: '0' })],
    })

    const print = createNode('print', {}, {
      values: [createNode('string_literal', { value: 'positive' })],
    })

    const ifNode = createNode('if', {}, {
      condition: [cond],
      then_body: [print],
      else_body: [],
    })

    const tree = makeProgram(ifNode)
    const { mappings } = generateCodeWithMapping(tree, 'cpp', style)
    const ifMapping = mappings.find(m => m.nodeId === ifNode.id)
    const printMapping = mappings.find(m => m.nodeId === print.id)
    expect(ifMapping).toBeDefined()
    expect(printMapping).toBeDefined()
    // The print is contained within the if's range
    expect(printMapping!.startLine).toBeGreaterThanOrEqual(ifMapping!.startLine)
    expect(printMapping!.endLine).toBeLessThanOrEqual(ifMapping!.endLine)
  })

  it('should produce CodeMapping from lifted tree without Blockly rendering (FR-005)', () => {
    // Simulates a lifted tree — nodes have id from createNode(), no metadata.blockId
    const print = createNode('print', {}, {
      values: [createNode('string_literal', { value: 'Hello' })],
    })
    const tree = makeProgram(print)
    const { code, mappings } = generateCodeWithMapping(tree, 'cpp', style)

    expect(code).toContain('cout')
    expect(mappings.length).toBeGreaterThanOrEqual(1)
    expect(mappings.every(m => m.nodeId && m.startLine >= 0)).toBe(true)
    expect(mappings.every(m => !('blockId' in m))).toBe(true)
  })
})

describe('Round-trip node identity (US3)', () => {
  it('should produce valid nodeIds in CodeMapping after round-trip (best-effort)', () => {
    // Create tree → generate code → verify codeMappings have valid nodeIds
    const decl = createNode('var_declare', { name: 'x', type: 'int' }, {
      initializer: [createNode('number_literal', { value: '5' })],
    })
    const print = createNode('print', {}, {
      values: [createNode('var_ref', { name: 'x' })],
    })

    const tree = makeProgram(decl, print)
    const { mappings } = generateCodeWithMapping(tree, 'cpp', style)

    // All mappings should have valid, non-empty nodeIds
    expect(mappings.length).toBeGreaterThanOrEqual(2)
    for (const m of mappings) {
      expect(m.nodeId).toBeTruthy()
      expect(typeof m.nodeId).toBe('string')
      expect(m.nodeId.length).toBeGreaterThan(0)
    }
  })

  it('all createNode-produced nodes should have id (prerequisite for identity)', () => {
    const node = createNode('var_declare', { name: 'x', type: 'int' }, { initializer: [] })
    expect(node.id).toBeTruthy()
    expect(typeof node.id).toBe('string')
    expect(node.id.startsWith('node_')).toBe(true)
  })
})
