import { describe, it, expect } from 'vitest'
import { CppScaffold } from '../../../../src/languages/cpp/cpp-scaffold'
import { createPopulatedRegistry } from '../../../../src/languages/cpp/std'
import { createNode } from '../../../../src/core/semantic-tree'
import type { ScaffoldResult } from '../../../../src/core/program-scaffold'

const resolver = createPopulatedRegistry()
const scaffold = new CppScaffold(resolver)

function makeProgram(body: ReturnType<typeof createNode>[]) {
  return createNode('program', {}, { body })
}

function coutTree() {
  return makeProgram([
    createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
  ])
}

function coutVectorTree() {
  return makeProgram([
    createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
    createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
  ])
}

function emptyTree() {
  return makeProgram([])
}

describe('CppScaffold', () => {
  describe('ScaffoldResult structure', () => {
    it('should return all four sections', () => {
      const result = scaffold.resolve(coutTree(), { cognitiveLevel: 1 })
      expect(result).toHaveProperty('imports')
      expect(result).toHaveProperty('preamble')
      expect(result).toHaveProperty('entryPoint')
      expect(result).toHaveProperty('epilogue')
    })
  })

  describe('L0 (hidden)', () => {
    it('should mark all items as hidden', () => {
      const result = scaffold.resolve(coutTree(), { cognitiveLevel: 0 })
      const allItems = [...result.imports, ...result.preamble, ...result.entryPoint, ...result.epilogue]
      for (const item of allItems) {
        expect(item.visibility).toBe('hidden')
      }
    })
  })

  describe('L1 (ghost)', () => {
    it('should mark all items as ghost', () => {
      const result = scaffold.resolve(coutTree(), { cognitiveLevel: 1 })
      const allItems = [...result.imports, ...result.preamble, ...result.entryPoint, ...result.epilogue]
      for (const item of allItems) {
        expect(item.visibility).toBe('ghost')
      }
    })

    it('should include reason for ghost items', () => {
      const result = scaffold.resolve(coutTree(), { cognitiveLevel: 1 })
      for (const item of result.imports) {
        expect(item.reason).toBeTruthy()
      }
      expect(result.preamble[0].reason).toBeTruthy()
      expect(result.entryPoint[0].reason).toBeTruthy()
      for (const item of result.epilogue) {
        expect(item.reason).toBeTruthy()
      }
    })

    it('should include iostream for cout usage', () => {
      const result = scaffold.resolve(coutTree(), { cognitiveLevel: 1 })
      const importCodes = result.imports.map(i => i.code)
      expect(importCodes).toContain('#include <iostream>')
    })

    it('should include iostream and vector for mixed usage', () => {
      const result = scaffold.resolve(coutVectorTree(), { cognitiveLevel: 1 })
      const importCodes = result.imports.map(i => i.code)
      expect(importCodes).toContain('#include <iostream>')
      expect(importCodes).toContain('#include <vector>')
    })
  })

  describe('L2 (editable)', () => {
    it('should mark all items as editable', () => {
      const result = scaffold.resolve(coutTree(), { cognitiveLevel: 2 })
      const allItems = [...result.imports, ...result.preamble, ...result.entryPoint, ...result.epilogue]
      for (const item of allItems) {
        expect(item.visibility).toBe('editable')
      }
    })
  })

  describe('manualImports deduplication', () => {
    it('should exclude manually imported headers from scaffold', () => {
      const result = scaffold.resolve(coutTree(), {
        cognitiveLevel: 1,
        manualImports: ['<iostream>'],
      })
      const importCodes = result.imports.map(i => i.code)
      expect(importCodes).not.toContain('#include <iostream>')
    })

    it('should exclude C-style equivalent headers (stdio.h ≡ cstdio)', () => {
      const tree = makeProgram([
        createNode('cpp_printf', { format: '%d\\n' }, { args: [createNode('var_ref', { name: 'x' })] }),
      ])
      const result = scaffold.resolve(tree, {
        cognitiveLevel: 1,
        manualImports: ['<stdio.h>'],
      })
      const importCodes = result.imports.map(i => i.code)
      expect(importCodes).not.toContain('#include <cstdio>')
    })
  })

  describe('pinned items', () => {
    it('should keep pinned items editable even at L0', () => {
      const result = scaffold.resolve(coutTree(), {
        cognitiveLevel: 0,
        pinnedItems: ['#include <iostream>'],
      })
      const pinnedImport = result.imports.find(i => i.code === '#include <iostream>')
      expect(pinnedImport).toBeDefined()
      expect(pinnedImport!.visibility).toBe('editable')
      expect(pinnedImport!.pinned).toBe(true)
    })
  })

  describe('empty tree', () => {
    it('should still produce preamble, entryPoint, and epilogue', () => {
      const result = scaffold.resolve(emptyTree(), { cognitiveLevel: 1 })
      expect(result.imports).toHaveLength(0)
      expect(result.preamble).toHaveLength(1)
      expect(result.entryPoint).toHaveLength(1)
      expect(result.epilogue).toHaveLength(2)
    })
  })

  describe('scaffold content', () => {
    it('preamble should be using namespace std', () => {
      const result = scaffold.resolve(emptyTree(), { cognitiveLevel: 2 })
      expect(result.preamble[0].code).toBe('using namespace std;')
    })

    it('entryPoint should be int main() {', () => {
      const result = scaffold.resolve(emptyTree(), { cognitiveLevel: 2 })
      expect(result.entryPoint[0].code).toBe('int main() {')
    })

    it('epilogue should contain return 0; and }', () => {
      const result = scaffold.resolve(emptyTree(), { cognitiveLevel: 2 })
      expect(result.epilogue[0].code).toContain('return 0;')
      expect(result.epilogue[1].code).toBe('}')
    })
  })
})
