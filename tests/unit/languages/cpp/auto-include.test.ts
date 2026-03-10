import { describe, it, expect } from 'vitest'
import { computeAutoIncludes } from '../../../../src/languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../../../src/languages/cpp/std'
import { createNode } from '../../../../src/core/semantic-tree'

const registry = createPopulatedRegistry()

function makeProgram(body: ReturnType<typeof createNode>[]) {
  return createNode('program', {}, { body })
}

describe('Auto-include engine', () => {
  describe('computeAutoIncludes', () => {
    it('should return <iostream> for print concept', () => {
      const tree = makeProgram([
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const headers = computeAutoIncludes(tree, registry)
      expect(headers).toContain('<iostream>')
    })

    it('should return <cstdio> for cpp_printf concept', () => {
      const tree = makeProgram([
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp_printf', { format: '%d\\n' }, { args: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const headers = computeAutoIncludes(tree, registry)
      expect(headers).toContain('<cstdio>')
    })

    it('should return <vector> for cpp_vector_declare concept', () => {
      const tree = makeProgram([
        createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
      ])
      const headers = computeAutoIncludes(tree, registry)
      expect(headers).toContain('<vector>')
    })

    it('should return multiple headers for mixed concepts', () => {
      const tree = makeProgram([
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
            createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
          ],
        }),
      ])
      const headers = computeAutoIncludes(tree, registry)
      expect(headers).toContain('<iostream>')
      expect(headers).toContain('<vector>')
    })

    it('should deduplicate headers (multiple print nodes)', () => {
      const tree = makeProgram([
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
        createNode('print', {}, { values: [createNode('var_ref', { name: 'y' })] }),
        createNode('input', {}, { values: [createNode('var_ref', { name: 'z' })] }),
      ])
      const headers = computeAutoIncludes(tree, registry)
      const iostreamCount = headers.filter(h => h === '<iostream>').length
      expect(iostreamCount).toBe(1)
    })

    it('should exclude manually included headers', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'iostream', local: false }),
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const headers = computeAutoIncludes(tree, registry)
      expect(headers).not.toContain('<iostream>')
    })

    it('should return empty for core-only concepts (no #include needed)', () => {
      const tree = makeProgram([
        createNode('var_declare', { name: 'x', type: 'int' }),
        createNode('if', {}, {
          condition: [createNode('compare', { operator: '==' }, {
            left: [createNode('var_ref', { name: 'x' })],
            right: [createNode('number_literal', { value: '0' })],
          })],
          then_body: [],
        }),
      ])
      const headers = computeAutoIncludes(tree, registry)
      expect(headers).toHaveLength(0)
    })

    it('should return sorted headers', () => {
      const tree = makeProgram([
        createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
      ])
      const headers = computeAutoIncludes(tree, registry)
      const sorted = [...headers].sort()
      expect(headers).toEqual(sorted)
    })
  })
})
