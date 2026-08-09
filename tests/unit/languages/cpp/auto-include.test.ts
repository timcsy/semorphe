import { describe, it, expect } from 'vitest'
import { computeAutoIncludes } from '../../../../src/languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../../../src/languages/cpp/std'
import { createNode } from '../../../../src/core/semantic-tree'

const registry = createPopulatedRegistry()

function makeProgram(body: ReturnType<typeof createNode>[]) {
  return createNode('cpp:program', {}, { body })
}

/** Extract header strings from DependencyEdge[] for backward-compatible assertions */
function headers(edges: ReturnType<typeof computeAutoIncludes>): string[] {
  return edges.map(e => e.header)
}

describe('Auto-include engine', () => {
  describe('computeAutoIncludes', () => {
    it('should return <iostream> for print concept', () => {
      const tree = makeProgram([
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<iostream>')
    })

    it('should return <cstdio> for cpp_printf concept', () => {
      const tree = makeProgram([
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print_formatted', { format: '%d\\n' }, { args: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<cstdio>')
    })

    it('should return <vector> for cpp_vector_declare concept', () => {
      const tree = makeProgram([
        createNode('cpp:vector_declare', { type: 'int', name: 'v' }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<vector>')
    })

    it('should return multiple headers for mixed concepts', () => {
      const tree = makeProgram([
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
            createNode('cpp:vector_declare', { type: 'int', name: 'v' }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<iostream>')
      expect(headers(edges)).toContain('<vector>')
    })

    it('should deduplicate headers (multiple print nodes)', () => {
      const tree = makeProgram([
        createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
        createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'y' })] }),
        createNode('cpp:input', {}, { values: [createNode('cpp:var_ref', { name: 'z' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      const iostreamCount = headers(edges).filter(h => h === '<iostream>').length
      expect(iostreamCount).toBe(1)
    })

    it('should exclude manually included headers', () => {
      const tree = makeProgram([
        createNode('cpp:include', { header: 'iostream', local: false }),
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<iostream>')
    })

    it('should return empty for core-only concepts (no #include needed)', () => {
      const tree = makeProgram([
        createNode('cpp:var_declare', { name: 'x', type: 'int' }),
        createNode('cpp:if', {}, {
          condition: [createNode('cpp:compare', { operator: '==' }, {
            left: [createNode('cpp:var_ref', { name: 'x' })],
            right: [createNode('cpp:literal_number', { value: '0' })],
          })],
          then_body: [],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(edges).toHaveLength(0)
    })

    it('should exclude C-style equivalent of auto-included headers (stdio.h ≡ cstdio)', () => {
      const tree = makeProgram([
        createNode('cpp:include', { header: 'stdio.h', local: false }),
        createNode('cpp:print_formatted', { format: '%d\\n' }, { args: [createNode('cpp:var_ref', { name: 'x' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cstdio>')
    })

    it('should exclude C-style equivalent of auto-included headers (string.h ≡ cstring)', () => {
      const tree = makeProgram([
        createNode('cpp:include', { header: 'string.h', local: false }),
        createNode('cpp:cstring_size', { name: 's' }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cstring>')
    })

    it('should exclude C-style equivalent of auto-included headers (math.h ≡ cmath)', () => {
      const tree = makeProgram([
        createNode('cpp:include', { header: 'math.h', local: false }),
        createNode('cpp_math_func', { func: 'sqrt' }, { args: [createNode('cpp:literal_number', { value: '4' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cmath>')
    })

    it('should return sorted headers', () => {
      const tree = makeProgram([
        createNode('cpp:vector_declare', { type: 'int', name: 'v' }),
        createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      const h = headers(edges)
      const sorted = [...h].sort()
      expect(h).toEqual(sorted)
    })

    it('should return DependencyEdge objects with correct fields', () => {
      const tree = makeProgram([
        createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(edges.length).toBeGreaterThan(0)
      const edge = edges.find(e => e.header === '<iostream>')!
      expect(edge).toBeDefined()
      expect(edge.directive).toBe('#include <iostream>')
      expect(edge.sourceType).toBe('stdlib')
      expect(edge.reason).toBeDefined()
    })
  })
})
